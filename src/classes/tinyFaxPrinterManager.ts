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

  constructor(networkArgs?: { host: string; port: number }) {
    super();
    this.usbPrinter = new UsbReceiptPrinter();
    this.usbPrinter.on("disconnected", () => {
      this.emitPrinterCountChange();
    });
    this.usbPrinter.on("connected", () => {
      this.emitPrinterCountChange();
    });
    this.usbPrinter.on("error", () => {
      this.emitPrinterCountChange();
    });
    this.usbPrinter.on("timeout", () => {
      this.emitPrinterCountChange();
    });
    if (networkArgs) {
      const { host, port } = networkArgs;

      this.networkPrinter = new NetworkReceiptPrinter({
        host,
        port,
      });

      this.networkPrinter.on("connected", () => {
        console.log("🛜 Connected to network printer!");
        this.emitPrinterCountChange();
      });

      this.networkPrinter.on("disconnected", () => {
        this.emitPrinterCountChange();
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
    if (this.usbPrinter && this.usbPrinter.status !== "connected") {
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
      console.log("🛜 Already connected to a network printer.");
      return;
    }
    if (this.networkPrinter?.status === "connecting") {
      console.log("🛜 Already connecting to network printer.");
      return;
    }

    try {
      await this.networkPrinter.safeConnect();
    } catch (e) {
      // not being able to connect is an expected and acceptable outcome
      return;
    }
  }

  async connectUsbPrinter() {
    if (!this.usbPrinter) {
      console.error("❌ No USB printer configured.");
      return;
    }
    if (this.usbPrinter.status === "connected") {
      console.log("🔌 Already connected to a USB printer.");
      return;
    }
    if (this.usbPrinter.status === "connecting") {
      console.log("🔌 Already connecting to USB printer.");
      return;
    }

    await this.usbPrinter.connect();
  }

  disconnect() {
    if (this.networkPrinter) {
      this.networkPrinter.disconnect();
      console.log("🛜 Disconnected from network printer.");
    }
    if (this.usbPrinter) {
      this.usbPrinter.disconnect();
      console.log("🔌 Disconnected from USB printer.");
    }
  }

  printInBox(message: string) {
    if (this.noneConnected) {
      console.error("❌ Cannot print, no printer is connected.");
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
      console.error("❌ Cannot print, no printer is connected.");
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
      console.error("❌ Cannot print, printer is not connected.");
      return;
    }

    try {
      const imageBuffer = await fetch(imageURL)
        .then((response) => response.arrayBuffer())
        .then((buffer) => new Uint8Array(buffer));

      const imageData = getImageData(await imageFromBuffer(imageBuffer));

      if (!imageData) {
        console.error("❌ Failed to get image data from buffered image.");
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
    if (this.usbPrinter.status === "connected") {
      this.usbPrinter?.print(message);
    }
  }

  get anyConnected() {
    return (
      this.networkPrinter?.status === "connected" ||
      this.usbPrinter.status === "connected"
    );
  }

  get noneConnected() {
    return (
      this.networkPrinter?.status !== "connected" &&
      this.usbPrinter.status !== "connected"
    );
  }

  get connectedCount() {
    let count = 0;
    if (this.networkPrinter?.status === "connected") count++;
    if (this.usbPrinter.status === "connected") count++;
    return count;
  }

  private emitPrinterCountChange() {
    this.emit("printerCountChange", this.connectedCount);
  }
}
