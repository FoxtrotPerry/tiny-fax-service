import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import EventEmitter from "eventemitter3";
import { getImageData, imageFromBuffer, Image } from "@canvas/image";
import { getAdjustedImageDimensions, wait } from "../utils";
import { env } from "../env";
import type { ImageMessage } from "../types/message";
import { UsbReceiptPrinter } from "./usbReceiptPrinter";
import type { Status } from "../types/status";
import NetworkReceiptPrinter from "./networkReceiptPrinter";

// TODO: Strongly consider not using NetworkReceiptPrinter and instead write our own

type PrinterManagerEvents = {
  printerCountChange: (count: number) => void;
};

export class TinyFaxPrinterManager extends EventEmitter<PrinterManagerEvents> {
  private networkPrinter?: NetworkReceiptPrinter;
  private usbPrinter: UsbReceiptPrinter;
  private encoder: ReceiptPrinterEncoder;
  usbPrinterStatus: Status = "idle";

  constructor(networkArgs?: { host: string; port: number }) {
    super();
    this.usbPrinter = new UsbReceiptPrinter();
    if (networkArgs) {
      const { host, port } = networkArgs;

      this.networkPrinter = new NetworkReceiptPrinter({
        host,
        port,
        timeout: 0,
      });

      this.networkPrinter.on("connected", () => {
        console.log("🖨️ Connected to network printer!");
        this.emitPrinterCountChange();
      });

      this.networkPrinter.on("disconnected", () => {
        // only trigger a reconnect if we were previously connected
        if (this.networkPrinter?.status !== "connected") {
          return;
        }
        console.log(
          "❌ Network printer disconnected. Will attempt to reconnect..."
        );
        wait(2000).then(() => {
          this.connectNetworkPrinter();
        });
      });

      this.networkPrinter.on("error", (e) => {
        console.error("❌ Printer connection error:", e);
      });

      this.networkPrinter.on("timeout", () => {
        console.error("⌛️ Printer connection timed out");
      });
    }
    this.encoder = new ReceiptPrinterEncoder({
      language: "esc-pos",
    });
  }

  async connect() {
    const connectingPrinters: Promise<void>[] = [];
    if (this.networkPrinter && this.networkPrinter?.status !== "connected") {
      connectingPrinters.push(this.connectNetworkPrinter());
    }
    if (this.usbPrinter && this.usbPrinterStatus !== "connected") {
      connectingPrinters.push(this.connectUsbPrinter());
    }
    await Promise.all(connectingPrinters);
  }

  async connectNetworkPrinter() {
    if (!this.networkPrinter) {
      console.error("❌ No network printer instantiated.");
      return;
    }
    if (this.networkPrinter?.status === "connected") {
      console.log("🖨️  Already connected to a network printer.");
      return;
    }
    if (this.networkPrinter?.status === "connecting") {
      console.log("⏳ Already connecting to network printer.");
      return;
    }

    try {
      await this.networkPrinter.connect();
    } catch (e) {
      console.error("❌ Error connecting to network printer:", e);
      return;
    }
  }

  async connectUsbPrinter() {
    if (!this.usbPrinter) {
      console.error("❌ No USB printer configured.");
      return;
    }
    if (this.usbPrinter.status === "connected") {
      console.log("🖨️  Already connected to a USB printer.");
      return;
    }
    if (this.usbPrinter.status === "connecting") {
      console.log("⏳ Already connecting to USB printer.");
      return;
    }

    this.usbPrinter.on("connected", () => {
      this.usbPrinterStatus = "connected";
      this.emitPrinterCountChange();
    });

    await this.usbPrinter.connect();
  }

  disconnect() {
    if (this.networkPrinter) {
      this.networkPrinter.disconnect();
      console.log("🖨️ Disconnected from network printer.");
    }
    if (this.usbPrinter) {
      this.usbPrinter.disconnect();
      this.usbPrinterStatus = "disconnected";
      console.log("🖨️ Disconnected from USB printer.");
    }
  }

  printInBox(message: string) {
    if (this.noneConnected) {
      console.error("Cannot print, no printer is connected.");
      return;
    }

    const printerMessage = this.encoder
      .initialize()
      .box(
        {
          align: "left",
          style: "double",
          marginLeft: 0,
          marginRight: 0,
          paddingLeft: 1,
        },
        message
      )
      .newline(8)
      .cut()
      .encode();

    this.broadcastPrint(printerMessage);
  }

  async print(message: string) {
    if (this.noneConnected) {
      console.error("Cannot print, no printer is connected.");
      return;
    }

    const printerMessage = this.encoder
      .initialize()
      .text(message.slice(0, env.TF_MESSAGE_CHAR_LIMIT))
      .newline(9)
      .encode();

    this.broadcastPrint(printerMessage);
  }

  async printImageMessage({ image: imageURL, text }: ImageMessage) {
    if (this.networkPrinter?.status !== "connected") {
      console.error("Cannot print, printer is not connected.");
      return;
    }

    try {
      const imageBuffer = await fetch(imageURL)
        .then((response) => response.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));

      const imageData = getImageData(await imageFromBuffer(imageBuffer));

      if (!imageData) {
        console.error("Failed to get image data from buffered image.");
        return;
      }

      const dimensions = getAdjustedImageDimensions(
        imageData.width,
        imageData.height,
        env.TF_PRINTER_PX_WIDTH ?? 568,
        true // scale to fit
      );

      // don't try this at home, kids...
      Object.defineProperty(imageData, "constructor", {
        value: {
          ...imageData?.constructor,
          // Minification impacts class names in tiny-fax's binary, so we
          // need to set the imageData's constructor name to be what
          // encoder's .image function expects.
          name: "ImageData",
        },
      });

      const printerMessage = this.encoder
        .initialize()
        .image(imageData, dimensions.width, dimensions.height, "atkinson")
        .box(
          {
            align: "left",
            style: "single",
            marginLeft: 0,
            marginRight: 0,
            paddingLeft: 1,
          },
          text.slice(0, env.TF_MESSAGE_CHAR_LIMIT)
        )
        .newline(9)
        .encode();

      this.networkPrinter?.print(printerMessage);
    } catch (e) {
      console.error("Error printing image", e);
      return;
    }
  }

  broadcastPrint(message: Uint8Array<ArrayBufferLike>) {
    if (this.networkPrinter?.status === "connected") {
      this.networkPrinter?.print(message);
    }
    if (this.usbPrinterStatus === "connected") {
      this.usbPrinter?.print(message);
    }
  }

  get anyConnected() {
    return (
      this.networkPrinter?.status === "connected" ||
      this.usbPrinterStatus === "connected"
    );
  }

  get noneConnected() {
    return (
      this.networkPrinter?.status !== "connected" &&
      this.usbPrinterStatus !== "connected"
    );
  }

  get connectedCount() {
    let count = 0;
    if (this.networkPrinter?.status === "connected") count++;
    if (this.usbPrinterStatus === "connected") count++;
    return count;
  }

  private emitPrinterCountChange() {
    this.emit("printerCountChange", this.connectedCount);
  }
}
