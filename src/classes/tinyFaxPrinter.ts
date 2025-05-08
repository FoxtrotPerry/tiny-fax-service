import NetworkReceiptPrinter from "@point-of-sale/network-receipt-printer";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";

export class TinyFaxPrinter {
  private printer?: NetworkReceiptPrinter;
  private encoder: ReceiptPrinterEncoder;
  private host: string;
  private port: number;
  private retries = 0;
  status: "idle" | "connected" | "disconnected" | "error" = "idle";

  constructor({ host, port }: { host: string; port: number }) {
    this.host = host;
    this.port = port;
    this.encoder = new ReceiptPrinterEncoder({
      language: "esc-pos",
    });
  }

  connect() {
    this.printer = new NetworkReceiptPrinter({
      host: this.host,
      port: this.port,
    });

    this.printer.addEventListener("connected", () => {
      this.status = "connected";
      console.log("🖨️  Connected to printer!");
    });

    this.printer.addEventListener("disconnected", () => {
      this.status = "disconnected";
      console.log("❌ Printer disconnected.");
    });

    try {
      this.printer.connect();
    } catch (error) {
      this.status = "error";
      console.error("Error connecting to printer:", error);
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
}
