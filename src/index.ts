import { env } from "./env";
import { TinyFaxPrinterManager } from "./classes/tinyFaxPrinterManager";
import { getRooms } from "./getRooms";
import { TinyFaxSocketManager } from "./classes/tinyFaxSocketManager";

const printerIp = env.TF_PRINTER_IP ?? "192.168.1.87";
const printerPort = env.TF_PRINTER_PORT ?? 9100;

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

const printers = new TinyFaxPrinterManager({
  host: printerIp,
  port: printerPort,
});

const socketManager = new TinyFaxSocketManager({
  rooms,
  accessToken,
  printers,
});

const shutDownSequence = () => {
  console.log(`\n🖨️ Shutting down...`);
  printers.disconnect();
  socketManager.disconnectSockets();
  console.log("🗿 Goodbye from tiny-fax");
  process.exit();
};

process.on("SIGINT", shutDownSequence);
process.on("SIGTERM", shutDownSequence);
process.on("SIGKILL", shutDownSequence);
process.on("beforeExit", shutDownSequence);

printers.on("printerCountChange", (count) => {
  console.log(`🖨️ Connected printers: ${count}`);
  if (count > 0 && socketManager.status === "idle") {
    // First time connecting sockets
    void socketManager.connect();
  } else if (count === 0 && socketManager.status === "connected") {
    // No printers connected, disconnect sockets
    socketManager.disconnectSockets();
  } else if (count > 0 && socketManager.status === "disconnected") {
    // Reconnect sockets if printers are connected
    void socketManager.reconnect();
  }
});
await printers.connect();
