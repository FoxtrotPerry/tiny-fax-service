import type { MessageQuery } from "./types/message";
import { TinyFaxSocket } from "./classes/tinyFaxSocket";
import { env } from "./env";
import axios, { AxiosError } from "axios";
import type { Room } from "./types/room";
import { TinyFaxPrinter } from "./classes/tinyFaxPrinter";

const printerIp = env.TF_PRINTER_IP ?? "192.168.1.87";
const printerPort = Number.parseInt(env.TF_PRINTER_PORT ?? "") ?? 9100;

/*
 * Check for required keys
 */

const file = Bun.file("tokens.json");
const fileExists = await file.exists();

if (!fileExists) {
  console.error("TF: 'tokens.json' does not exist!");
  process.exit(1);
}

const contents = await file.json();

/*
 * Check for required env vars
 */

const accessUrl = env.TF_API_URL;

if (!contents?.accessToken || typeof contents.accessToken !== "string") {
  console.error("TF: ACCESS TOKEN NOT FOUND");
  process.exit(1);
}

// can now safely assign accessToken
const accessToken = contents.accessToken as string;

/*
 * Get the user's available rooms
 */

let rooms: Room[] = [];

try {
  const availableRooms = await axios.get<Room[]>(`${accessUrl}/room`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  rooms = availableRooms.data;
} catch (error: unknown) {
  if (error instanceof AxiosError) {
    console.error("TF: Failed to get available rooms!");
    console.error(error.status, error.response?.data);
    process.exit(1);
  }
}

if (rooms.length === 0) {
  console.error("TF: No rooms found for user!");
  process.exit(1);
}

/*
 * Connect to the chat server
 */

// TODO: Could possible create just one TinyFaxPrinter instance and share it across all rooms.

const printer = new TinyFaxPrinter({
  host: printerIp,
  port: printerPort,
});

const roomSockets = rooms.map((room) => {
  const roomSocket = new TinyFaxSocket({
    room,
    accessToken,
    // printerIp,
    // printerPort,
    printer,
  });
  return roomSocket;
});

await Promise.all(
  roomSockets.map(async (roomSocket) => {
    await roomSocket.connect();
  })
);
