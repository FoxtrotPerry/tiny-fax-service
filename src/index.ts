import { TinyFaxSocket } from "./classes/tinyFaxSocket";
import { env } from "./env";
import { TinyFaxPrinter } from "./classes/tinyFaxPrinter";
import { getRooms } from "./getRooms";

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

if (!contents?.accessToken || typeof contents.accessToken !== "string") {
  console.error("TF: ACCESS TOKEN NOT FOUND");
  process.exit(1);
}

// can now safely assign accessToken
const accessToken = contents.accessToken as string;

const rooms = await getRooms(accessToken);

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
    printer,
  });
  return roomSocket;
});

await Promise.all(
  roomSockets.map(async (roomSocket) => {
    await roomSocket.connect();
  })
);
