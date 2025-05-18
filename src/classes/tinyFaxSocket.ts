import { env } from "../env";
import type { MessageBody } from "../types/message";
import type { Room } from "../types/room";
import { send } from "../utils";
import { TinyFaxPrinter } from "./tinyFaxPrinter";

export class TinyFaxSocket {
  private roomName: string;
  private socket: WebSocket | null = null;
  private url: string;
  private accessToken: string;
  private printer: TinyFaxPrinter;
  private pingInterval: NodeJS.Timer | null = null;
  isConnected = false;

  constructor({
    room,
    accessToken,
    printerIp,
    printerPort,
    printer,
  }: {
    room: Room;
    accessToken: string;
    printerIp?: string;
    printerPort?: number;
    printer?: TinyFaxPrinter;
  }) {
    this.url = `${env.TF_API_URL}/room/${room.id}`;
    this.roomName = room.name;
    this.accessToken = accessToken;
    if (!printer && printerIp && printerPort) {
      this.printer = new TinyFaxPrinter({
        host: printerIp,
        port: printerPort,
      });
    } else if (printer && !printerIp && !printerPort) {
      this.printer = printer;
    } else {
      throw new Error(
        "Either pass in printer, or printerIp and printerPort to the TinyFaxSocket constructor"
      );
    }
  }

  async connect() {
    // Connect to the printer first

    this.printer.connect();
    await this.printer.waitForConnection();

    // Connect to the WebSocket server

    // We smuggle the JWT through the protocol options because the
    // WebSocket API doesn't allow for custom headers.
    this.socket = new WebSocket(this.url, this.accessToken);

    this.socket.addEventListener("open", () => {
      this.isConnected = true;
      console.log(`🌐 Connected to chat room ${this.roomName}`);
      this.pingInterval = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          send({
            socket: this.socket,
            payload: {
              action: "ping",
              message: "What it do council",
              userId: "",
            },
          });
        }
      }, 30 * 1000); // every 30 seconds
      this.printer.printInBox(`Connected to ${this.roomName}!`);
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
