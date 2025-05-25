import NetworkReceiptPrinter from "@point-of-sale/network-receipt-printer";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { getImageData, imageFromBuffer, Image } from "@canvas/image";
import { getAdjustedImageDimensions } from "../utils";
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

  connect() {
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
      console.log("❌ Printer disconnected.");
    });

    // this.printer.addEventListener("error", (e) => {
    //   this.status = "error";
    //   console.error("❌ Printer connection error:", e);
    // });

    // this.printer.addEventListener("timeout", () => {
    //   this.status = "timeout";
    //   console.error("⌛️ Printer connection timed out");
    // });

    this.printer.connect();
    this.status = "connecting";

    // try {
    //   this.printer.connect();
    // } catch (error) {
    //   this.status = "error";
    // }
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

  /**
   * Call this right after connecting to the printer to wait for the
   * connection to be established.
   * This is useful for when you want to wait for the printer to be
   * connected before sending any print jobs.
   */
  async waitForConnection() {
    while (true) {
      if (this.status === "connected") {
        break;
      }
      console.log(`Waiting for printer to connect...`);
      // wait 500ms before next check
      const wait = async (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms * (this.retries + 1)));
      await wait(500);
      console.log(`Will try again in ${500 * (this.retries + 1)}ms...`);
      this.retries++;
      if (this.retries > 10) {
        console.error("❌ Printer connection timed out.");
        break;
      }
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

  print(message: string) {
    if (this.status !== "connected") {
      console.error("Cannot print, printer is not connected.");
      return;
    }

    const printerMessage = this.encoder
      .initialize()
      .text(message)
      .newline(9)
      .encode();

    this.printer?.print(printerMessage);
  }

  async printImage(imageBuffer: Uint8Array<ArrayBufferLike>, text?: string) {
    if (this.status !== "connected") {
      console.error("Cannot print, printer is not connected.");
      return;
    }

    const imageData = getImageData(await imageFromBuffer(imageBuffer));
    const dimensions = getAdjustedImageDimensions(
      imageData?.width,
      imageData?.height,
      env.TF_PRINTER_PX_WIDTH ?? 568
    );

    const printerMessage = this.encoder
      .initialize()
      .image(imageData, dimensions.width, dimensions.height, "atkinson")
      .newline(1)
      .text(text ?? "")
      .newline(9)
      .encode();

    this.printer?.print(printerMessage);
  }

  async printImageFromString({ image: imageURL, text }: ImageMessage) {
    if (this.status !== "connected") {
      console.error("Cannot print, printer is not connected.");
      return;
    }

    const imageBuffer = await fetch(imageURL)
      .then((response) => response.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer));

    const imageData = getImageData(await imageFromBuffer(imageBuffer));
    const dimensions = getAdjustedImageDimensions(
      imageData?.width,
      imageData?.height,
      env.TF_PRINTER_PX_WIDTH ?? 568
    );

    const printerMessage = this.encoder
      .initialize()
      .image(imageData, dimensions.width, dimensions.height, "atkinson")
      .newline(1)
      .text(text ?? "")
      .newline(9)
      .encode();

    this.printer?.print(printerMessage);
  }
}
