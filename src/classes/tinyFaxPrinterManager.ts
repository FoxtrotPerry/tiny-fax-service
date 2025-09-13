import NetworkReceiptPrinter from "@point-of-sale/network-receipt-printer";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { getImageData, imageFromBuffer, Image } from "@canvas/image";
import { getAdjustedImageDimensions, wait } from "../utils";
import { env } from "../env";
import type { ImageMessage } from "../types/message";
import { UsbReceiptPrinter } from "./usbReceiptPrinter";
import type { Status } from "../types/status";

// TODO: Strongly consider not using NetworkReceiptPrinter and instead write our own

type ConnectionType = "network" | "usb";

export class TinyFaxPrinterManager {
  private networkPrinter?: NetworkReceiptPrinter;
  private usbPrinter?: UsbReceiptPrinter;
  private encoder: ReceiptPrinterEncoder;
  private host?: string;
  private port?: number;
  private retries = 0;
  networkPrinterStatus: Status = "idle";
  usbPrinterStatus: Status = "idle";

  constructor(networkArgs?: { host: string; port: number }) {
    console.log("🖨️  Initializing printer...");
    this.usbPrinter = new UsbReceiptPrinter();
    if (networkArgs) {
      const { host, port } = networkArgs;
      this.host = host;
      this.port = port;

      this.networkPrinter = new NetworkReceiptPrinter({
        host: this.host,
        port: this.port,
        timeout: 0,
      });

      this.networkPrinter.addEventListener("connected", () => {
        this.networkPrinterStatus = "connected";
        console.log("🖨️  Connected to printer!");
      });

      this.networkPrinter.addEventListener("disconnected", () => {
        this.networkPrinterStatus = "disconnected";
        console.log(
          "❌ Network printer disconnected. Will attempt to reconnect..."
        );
        this.connect();
      });

      // TODO: Will have to write my own NetworkReceiptPrinter to handle errors and reconnect on error :/
      // this.networkPrinter.addEventListener("error", (e) => {
      //   this.networkPrinterStatus = "error";
      //   console.error("❌ Printer connection error:", e);
      // });

      // this.networkPrinter.addEventListener("timeout", () => {
      //   this.networkPrinterStatus = "timeout";
      //   console.error("⌛️ Printer connection timed out");
      // });
    }
    this.encoder = new ReceiptPrinterEncoder({
      language: "esc-pos",
    });
  }

  async connect() {
    const printersToConnect: Promise<void>[] = [];
    if (this.networkPrinter)
      printersToConnect.push(this.connectNetworkPrinter());
    if (this.usbPrinter) printersToConnect.push(this.connectUsbPrinter());
    await Promise.all(printersToConnect);
  }

  async connectNetworkPrinter() {
    if (!this.networkPrinter) {
      console.error("❌ No network printer instantiated.");
      return;
    }
    if (this.networkPrinterStatus === "connected") {
      console.log("🖨️  Already connected to a printer.");
      return;
    }
    if (this.networkPrinterStatus === "connecting") {
      console.log("⏳ Already connecting to printer.");
      return;
    }

    this.networkPrinter.connect();
    return new Promise<void>(async (resolve, reject) => {
      const waitMs = 200;
      while (this.retries < 10) {
        if (this.networkPrinterStatus === "connected") {
          resolve();
        } else if (
          this.networkPrinterStatus === "error" ||
          this.networkPrinterStatus === "timeout"
        ) {
          reject(new Error("Failed to connect to printer"));
        }
        await wait(waitMs, this.retries);
        this.retries++;
        console.log(this.retries);
      }
      resolve();
    });
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

    await this.usbPrinter.connect({
      onConnected: () => {
        this.usbPrinterStatus = "connected";
      },
    });

    // this.usbPrinter.print(
    //   this.encoder
    //     .initialize()
    //     .text("USB Printer Connected!")
    //     .newline(9)
    //     .encode()
    // );
  }

  disconnect() {
    if (this.networkPrinter) {
      this.networkPrinter.disconnect();
      this.networkPrinterStatus = "disconnected";
      console.log("🖨️  Disconnected from printer.");
    }
    if (this.usbPrinter) {
      this.usbPrinter.disconnect();
      this.usbPrinterStatus = "disconnected";
      console.log("🖨️  Disconnected from USB printer.");
    }
  }

  reconnect() {
    if (this.networkPrinter) {
      this.networkPrinter.disconnect();
      this.networkPrinterStatus = "disconnected";
      console.log("🖨️  Reconnecting to printer...");
      this.connect();
    }
    if (this.usbPrinter) {
      this.usbPrinter.disconnect();
      this.usbPrinterStatus = "disconnected";
      console.log("🖨️  Reconnecting to USB printer...");
      this.connect();
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
    if (this.networkPrinterStatus !== "connected") {
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
    if (this.networkPrinterStatus === "connected") {
      this.networkPrinter?.print(message);
    }
    if (this.usbPrinterStatus === "connected") {
      this.usbPrinter?.print(message);
    }
  }

  get anyConnected() {
    return (
      this.networkPrinterStatus === "connected" ||
      this.usbPrinterStatus === "connected"
    );
  }

  get noneConnected() {
    return (
      this.networkPrinterStatus !== "connected" &&
      this.usbPrinterStatus !== "connected"
    );
  }
}
