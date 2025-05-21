import { TinyFaxSocket } from "./classes/tinyFaxSocket";
import { env } from "./env";
import { TinyFaxPrinter } from "./classes/tinyFaxPrinter";
import { getRooms } from "./getRooms";
import { TinyFaxSocketManager } from "./classes/tinyFaxSocketManager";

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

const printer = new TinyFaxPrinter({
  host: printerIp,
  port: printerPort,
});

const socketManager = new TinyFaxSocketManager({
  rooms,
  accessToken,
  printer,
});

await socketManager.connect();
