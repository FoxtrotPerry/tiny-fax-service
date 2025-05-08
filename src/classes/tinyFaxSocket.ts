import type { MessageBody } from "../types/message";
import { TinyFaxPrinter } from "./tinyFaxPrinter";

export class TinyFaxSocket {
  private socket: WebSocket | null = null;
  private url: URL;
  private accessToken: string;
  private printer: TinyFaxPrinter;
  isConnected = false;

  constructor({
    url,
    accessToken,
    printerIp,
    printerPort,
  }: {
    url: URL;
    accessToken: string;
    printerIp: string;
    printerPort: number;
  }) {
    this.url = url;
    this.accessToken = accessToken;
    this.printer = new TinyFaxPrinter({
      host: printerIp,
      port: printerPort,
    });
  }

  async connect() {
    // Connect to the printer first

    this.printer.connect();
    await this.printer.waitForConnection();

    // Connect to the WebSocket server

    // We smuggle the JWT through the protocol options because the
    // WebSocket API doesn't allow for custom headers.
    // FIXME: Config to use actual JWT
    this.socket = new WebSocket(this.url, this.accessToken);

    this.socket.addEventListener("open", () => {
      this.isConnected = true;
      console.log("🌐 Connected to chat server!");
      const message = {
        message: "",
        action: "listen",
      } satisfies MessageBody;
      this.socket?.send(JSON.stringify(message));
      this.printer.printInBox(
        `Connected to ${this.url.searchParams.get("roomId")}!`
      );
    });

    this.socket.addEventListener("message", (event) => {
      console.log("📠 Message received:", event.data);
      this.printer.print(event.data);
    });

    this.socket.addEventListener("close", (event) => {
      console.error("❌ Disconnected from chat server:");
      console.error(`Code: ${event.code}`);
      console.error(`Reason: ${event.reason}`);
      this.isConnected = false;
      this.printer.printInBox("Disconnected. Reconnecting in 5 seconds...");
      setTimeout(() => {
        this.reconnect();
      }, 5000);
    });

    this.socket.addEventListener("error", (err) => {
      console.error("WebSocket error: ", err);
    });
  }

  reconnect() {
    console.log("🔄 Reconnecting to chat server...");
    if (this.socket) {
      this.socket.close();
    }
    this.connect();
  }
}
