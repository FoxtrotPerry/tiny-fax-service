import type { MessageQuery } from "./types/message";
import { TinyFaxSocket } from "./classes/tinyFaxSocket";

const PRINTER_DEFAULT_IP = "192.168.1.87";
const PRINTER_DEFAULT_PORT = 9100;

/**
 * Check for required keys
 */

const file = Bun.file("tokens.json");
const fileExists = await file.exists();

if (!fileExists) {
  console.error("TF: 'tokens.json' does not exist!");
  process.exit(1);
}

const contents = await file.json();

/**
 * Check for required env vars
 */

const accessUrl = process.env.TF_ACCESS_URL;
let printerIp = process.env.TF_PRINTER_IP;
let printerPort = Number.parseInt(process.env.TF_PRINTER_PORT ?? "");

if (!contents?.accessToken || typeof contents.accessToken !== "string") {
  console.error("TF: ACCESS TOKEN NOT FOUND");
  process.exit(1);
}

// can now safely assign accessToken
const accessToken = contents.accessToken as string;

if (!accessUrl) {
  console.error("TF: TF_ACCESS_URL ENV VAR NOT FOUND");
  process.exit(1);
}

if (!printerIp) {
  console.log(
    `TF: TF_PRINTER_IP NOT FOUND, USING DEFAULT (${PRINTER_DEFAULT_IP})`
  );
  printerIp = PRINTER_DEFAULT_IP;
}

if (Number.isNaN(printerPort)) {
  console.log(
    `TF: TF_PRINTER_PORT NOT FOUND, USING DEFAULT (${PRINTER_DEFAULT_PORT})`
  );
  printerPort = PRINTER_DEFAULT_PORT;
}

/**
 * Connect to the chat server
 */

const params = new URLSearchParams({
  roomId: "berlin",
} satisfies MessageQuery);
const url = new URL(`${accessUrl}?${params.toString()}`);

const tinyFaxSocket = new TinyFaxSocket({
  url,
  accessToken,
  printerIp,
  printerPort,
});

await tinyFaxSocket.connect();
