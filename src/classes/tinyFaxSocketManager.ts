import { getRooms } from "../getRooms";
import type { Room } from "../types/room";
import { TinyFaxPrinterManager } from "./tinyFaxPrinterManager";
import { TinyFaxSocket } from "./tinyFaxSocket";

/**
 * Manages all of the socket connections to the TinyFax API.
 */
export class TinyFaxSocketManager {
  private rooms: Room[];
  private accessToken: string;
  private printers: TinyFaxPrinterManager;
  private sockets: TinyFaxSocket[] | null = null;
  status: "idle" | "connecting" | "connected" | "disconnected" | "refreshing" =
    "idle";

  constructor({
    rooms,
    accessToken,
    printers,
  }: {
    rooms: Room[];
    accessToken: string;
    printers: TinyFaxPrinterManager;
  }) {
    this.rooms = rooms;
    this.accessToken = accessToken;
    this.printers = printers;
    this.sockets = rooms.map((room) => {
      return new TinyFaxSocket({
        room,
        accessToken,
        printers,
        updateRoomsAndReconnect: this.updateRoomsAndReconnect.bind(this),
      });
    });
  }

  async connectSockets() {
    if (this.sockets) {
      await Promise.all(
        this.sockets.map(async (socket) => await socket.connect())
      );
      this.status = "connected";
      this.printConnectedRooms();
    }
  }

  async connect() {
    if (this.status === "connected") {
      console.log("🌐 Already connected to available rooms.");
      return;
    }
    if (this.status === "connecting") {
      console.log("🌐 Already connecting to available rooms.");
      return;
    }

    console.log("🌐 Connecting to available rooms...");
    await this.connectSockets();
  }

  async reconnect() {
    if (this.status === "connecting") {
      return;
    }
    this.status = "connecting";
    console.log("🌐 Reconnecting to all rooms...");
    // Reconnect to the printers first
    this.disconnectSockets();
    await this.connectSockets();
  }

  public async updateRoomsAndReconnect() {
    if (this.status === "refreshing") {
      console.log("🌐 Already updating rooms.");
      return;
    }
    this.status = "refreshing";
    console.log("🌐 Updating rooms...");
    if (this.printers.anyConnected) {
      this.printers.printInBox(
        "Updating room connections, disconnecting from all rooms..."
      );
    }
    this.rooms = await getRooms(this.accessToken);
    // Disconnect all sockets
    if (this.sockets) {
      this.sockets.forEach((socket) => {
        socket?.disconnect();
        socket?.destroy();
      });
    }
    this.sockets = this.rooms.map((room) => {
      return new TinyFaxSocket({
        room,
        accessToken: this.accessToken,
        printers: this.printers,
        updateRoomsAndReconnect: this.updateRoomsAndReconnect.bind(this),
      });
    });
    if (this.sockets) {
      await Promise.all(
        this.sockets.map(async (socket) => {
          await socket.connect();
        })
      );
      this.status = "connected";
      console.log("🌐 Refreshed rooms successfully.");
      if (this.printers.anyConnected) {
        this.printConnectedRooms();
      }
    } else {
      console.error("❌ No sockets found");
    }
  }

  disconnectSockets() {
    if (this.sockets) {
      console.log("🌐 Disconnecting from all rooms...");
      this.sockets.forEach((socket) => {
        socket?.disconnect();
        socket?.destroy();
      });
      this.status = "disconnected";
      console.log("🌐 Disconnected from all rooms.");
    }
  }

  private printConnectedRooms() {
    if (this.printers.anyConnected) {
      console.table(
        this.rooms.map((room) => ({
          "Connected rooms:": room.name,
        }))
      );
      this.printers.printInBox(
        `Connected to ${this.rooms.length} rooms: ${this.rooms
          .map((room) => room.name)
          .join(", ")}`
      );
    }
  }
}
