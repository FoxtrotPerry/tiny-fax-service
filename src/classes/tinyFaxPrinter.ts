import NetworkReceiptPrinter from "@point-of-sale/network-receipt-printer";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { getImageData, imageFromBuffer } from "@canvas/image";
import { getAdjustedImageDimensions, wait } from "../utils";
import { env } from "../env";
import type { ImageMessage } from "../types/message";

// TODO: Strongly consider not using NetworkReceiptPrinter and instead write our own

export class TinyFaxPrinter {
  private printer?: NetworkReceiptPrinter;
  private encoder: ReceiptPrinterEncoder;
  private host: string;
  private port: number;
  private retries = 0;
  status:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"
    | "timeout" = "idle";

  constructor({ host, port }: { host: string; port: number }) {
    this.host = host;
    this.port = port;
    this.encoder = new ReceiptPrinterEncoder({
      language: "esc-pos",
    });
  }

  async connect() {
    if (this.status === "connected") {
      console.log("🖨️  Already connected to printer.");
      return;
    }
    if (this.status === "connecting") {
      console.log("🖨️  Already connecting to printer.");
      return;
    }

    this.printer = new NetworkReceiptPrinter({
      host: this.host,
      port: this.port,
      timeout: 0,
    });

    this.printer.addEventListener("connected", () => {
      this.status = "connected";
      console.log("🖨️  Connected to printer!");
    });

    this.printer.addEventListener("disconnected", () => {
      this.status = "disconnected";
      console.log("❌ Printer disconnected. Will attempt to reconnect...");
      this.connect();
    });

    // TODO: Will have to write my own NetworkReceiptPrinter to handle errors and reconnect on error :/
    // this.printer.addEventListener("error", (e) => {
    //   this.status = "error";
    //   console.error("❌ Printer connection error:", e);
    // });

    // this.printer.addEventListener("timeout", () => {
    //   this.status = "timeout";
    //   console.error("⌛️ Printer connection timed out");
    // });

    this.printer.connect();
    return new Promise<void>(async (resolve, reject) => {
      const waitMs = 200;
      while (this.retries < 100) {
        if (this.status === "connected") {
          resolve();
        } else if (this.status === "error" || this.status === "timeout") {
          reject(new Error("Failed to connect to printer"));
        }
        await wait(waitMs, this.retries);
      }
    });
  }

  disconnect() {
    if (this.printer) {
      this.printer.disconnect();
      this.status = "disconnected";
      console.log("🖨️  Disconnected from printer.");
    }
  }

  reconnect() {
    if (this.printer) {
      this.printer.disconnect();
      this.status = "disconnected";
      console.log("🖨️  Reconnecting to printer...");
      this.connect();
    }
  }

  printInBox(message: string) {
    if (this.status !== "connected") {
      console.error("Cannot print, printer is not connected.");
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

    this.printer?.print(printerMessage);
  }

  async print(message: string) {
    if (this.status !== "connected") {
      await this.connect();
      console.error("Cannot print, printer is not connected.");
      return;
    }

    const printerMessage = this.encoder
      .initialize()
      .text(message.slice(0, env.TF_MESSAGE_CHAR_LIMIT))
      .newline(9)
      .encode();

    this.printer?.print(printerMessage);
  }

  async printImageMessage({ image: imageURL, text }: ImageMessage) {
    if (this.status !== "connected") {
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

      this.printer?.print(printerMessage);
    } catch (e) {
      console.error("Error printing image", e);
      return;
    }
  }
}
