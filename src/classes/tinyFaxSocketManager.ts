import { getRooms } from "../getRooms";
import type { Room } from "../types/room";
import { TinyFaxPrinter } from "./tinyFaxPrinter";
import { TinyFaxSocket } from "./tinyFaxSocket";

/**
 * Manages all of the socket connections to the TinyFax API.
 */
export class TinyFaxSocketManager {
  private rooms: Room[];
  private accessToken: string;
  private printer: TinyFaxPrinter;
  private sockets: TinyFaxSocket[] | null = null;
  private status:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "refreshing" = "idle";

  constructor({
    rooms,
    accessToken,
    printer,
  }: {
    rooms: Room[];
    accessToken: string;
    printer: TinyFaxPrinter;
  }) {
    this.rooms = rooms;
    this.accessToken = accessToken;
    this.printer = printer;
    this.sockets = rooms.map((room) => {
      return new TinyFaxSocket({
        room,
        accessToken,
        printer,
        updateRoomsAndReconnect: this.updateRoomsAndReconnect.bind(this),
      });
    });
  }

  async connect() {
    if (this.status === "connected") {
      console.log("🌐 Already connected to all rooms.");
      return;
    }
    if (this.status === "connecting") {
      console.log("🌐 Already connecting to all rooms.");
      return;
    }
    this.status = "connecting";
    // Connect to the printer first
    await this.printer.connect();
    await this.printer.waitForConnection();

    if (this.printer.status !== "connected") {
      console.error("❌ Printer connection failed.");
      return;
    }

    // Connect to all WebSocket servers
    if (this.sockets) {
      await Promise.all(
        this.sockets.map(async (socket) => {
          await socket.connect();
        })
      );
      this.status = "connected";
    }
  }

  public async updateRoomsAndReconnect() {
    if (this.status === "refreshing") {
      console.log("🌐 Already refreshing rooms.");
      return;
    }
    this.status = "refreshing";
    console.log("🌐 Refreshing rooms...");
    this.rooms = await getRooms(this.accessToken);
    // Disconnect all sockets
    if (this.sockets) {
      this.sockets.forEach((socket) => {
        socket?.disconnect();
      });
    }
    if (this.rooms.length === 0) {
      console.error("❌ No rooms found");
      return;
    }
    this.sockets = this.rooms.map((room) => {
      return new TinyFaxSocket({
        room,
        accessToken: this.accessToken,
        printer: this.printer,
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
    } else {
      console.error("❌ No sockets found");
    }
  }
}
