import { env } from "../env";
import {
  zImageMessage,
  type ImageMessage,
  type MessageBody,
} from "../types/message";
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
  private disconnectIntentional = false;
  private updateRoomsAndReconnect: () => void;
  isConnected = false;

  constructor({
    room,
    accessToken,
    printerIp,
    printerPort,
    printer,
    updateRoomsAndReconnect,
  }: {
    room: Room;
    accessToken: string;
    printerIp?: string;
    printerPort?: number;
    printer?: TinyFaxPrinter;
    updateRoomsAndReconnect: () => void;
  }) {
    this.url = `${env.TF_API_URL}/room/${room.id}`;
    this.roomName = room.name;
    this.accessToken = accessToken;
    this.updateRoomsAndReconnect = updateRoomsAndReconnect;
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
    // Connect to the WebSocket server

    // We smuggle the JWT through the protocol options because the
    // WebSocket API doesn't allow for custom headers.
    this.socket = new WebSocket(this.url, this.accessToken);

    this.socket.addEventListener("open", () => {
      this.isConnected = true;
      this.disconnectIntentional = false; // reset the disconnect flag
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
      }, 1000 * 60 * 5); // every 5 minutes
    });

    this.socket.addEventListener("message", async (event) => {
      let message: ImageMessage | string = "";

      // try to parse the incoming message as JSON incase it's an image message
      try {
        message = JSON.parse(event.data as string) as ImageMessage;
      } catch (e) {
        message = event.data as string;
      }

      if (typeof message !== "string") {
        await this.printer.printImageFromString(message);
      } else {
        const commandHandled = this.handleCommand(event.data);
        // don't print command messages
        if (commandHandled) return;
        this.printer.print(event.data);
      }
    });

    this.socket.addEventListener("close", (event) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      console.error("❌ Disconnected from chat server:");
      console.error(`Code: ${event.code}`);
      console.error(`Reason: ${event.reason}`);
      this.isConnected = false;
      if (!this.disconnectIntentional) {
        this.printer.printInBox(
          `Disconnected from ${this.roomName}. Reconnecting in 5 seconds...`
        );
        setTimeout(() => {
          this.reconnect();
        }, 5000);
      }
    });

    this.socket.addEventListener("error", (err) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
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

  handleCommand(message: string): Boolean {
    switch (message) {
      case "!pong":
        return true;
      case "!update_rooms":
        console.log("!update_rooms command received");
        this.updateRoomsAndReconnect();
        return true;
      default:
        return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.disconnectIntentional = true;
      this.socket.close();
      this.isConnected = false;
      console.log("⛓️‍💥 Socket disconnect successful.");
    }
  }

  destroy() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
