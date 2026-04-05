import { env } from "../env";
import { type ImageMessage } from "../types/message";
import type { Room } from "../types/room";
import { send } from "../utils";
import { TinyFaxPrinterManager } from "./tinyFaxPrinterManager";

export class TinyFaxSocket {
  private roomName: string;
  private socket: WebSocket | null = null;
  private url: string;
  private accessToken: string;
  private printers: TinyFaxPrinterManager;
  private pingInterval: NodeJS.Timeout | null = null;
  private disconnectIntentional = false;
  private updateRoomsAndReconnect: () => void;
  private reconnectCadence: number = 5000;
  isConnected = false;

  constructor({
    room,
    accessToken,
    printerIp,
    printerPort,
    printers,
    updateRoomsAndReconnect,
  }: {
    room: Room;
    accessToken: string;
    printerIp?: string;
    printerPort?: number;
    printers?: TinyFaxPrinterManager;
    updateRoomsAndReconnect: () => void;
  }) {
    this.url = `${env.TF_API_URL}/room/${room.id}`;
    this.roomName = room.name;
    this.accessToken = accessToken;
    this.updateRoomsAndReconnect = updateRoomsAndReconnect;
    if (!printers && printerIp && printerPort) {
      this.printers = new TinyFaxPrinterManager({
        host: printerIp,
        port: printerPort,
      });
    } else if (printers && !printerIp && !printerPort) {
      this.printers = printers;
    } else {
      throw new Error(
        "Either pass in printer, or printerIp and printerPort to the TinyFaxSocket constructor",
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

      if (this.socket?.readyState === WebSocket.OPEN) {
        send({
          socket: this.socket,
          payload: {
            action: "listen",
            message: "What it do council",
            userId: "",
          },
        });
      }

      this.pingInterval = setInterval(
        () => {
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
        },
        1000 * 60 * 5,
      );
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
        await this.printers.printImageMessage(message);
      } else {
        const commandHandled = this.handleCommand(event.data);
        // don't print command messages
        if (commandHandled) return;
        this.printers.print(event.data);
      }
    });

    this.socket.addEventListener("close", (event) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      if (!this.disconnectIntentional) {
        if (!this.isConnected) {
          // only print the reconnect message if we were previously connected
          // to avoid printing on all subsequent reconnect attempts
          this.printers.printInBox(
            `Disconnected from ${this.roomName}. Attempting to reconnect...`,
          );
        }
        setTimeout(() => {
          this.reconnect();
        }, this.reconnectCadence);
      }
      this.isConnected = false;
    });

    this.socket.addEventListener("error", (err) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      console.error("WebSocket error: ", err);
    });
  }

  async reconnect() {
    console.log("🔄 Reconnecting to chat server...");
    if (this.socket) {
      this.socket.close();
    }
    await this.connect();
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
      // console.log("⛓️‍💥 Socket disconnect successful.");
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
