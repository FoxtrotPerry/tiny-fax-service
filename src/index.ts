import { env } from "./env";
import { TinyFaxPrinter } from "./classes/tinyFaxPrinter";
import { getRooms } from "./getRooms";
import { TinyFaxSocketManager } from "./classes/tinyFaxSocketManager";
import { secrets } from "bun";
import { accessTokenKeys } from "./constants";
import type { TokenData } from "./types/token";

const printerIp = env.TF_PRINTER_IP ?? "192.168.1.87";
const printerPort = env.TF_PRINTER_PORT ?? 9100;

/*
 * Check for required keys
 */

let accessToken: string | null = null;

const accessTokenFromStore = await secrets.get(accessTokenKeys);
if (accessTokenFromStore) {
  accessToken = accessTokenFromStore;
} else {
  const file = Bun.file("tokens.json");
  const fileExists = await file.exists();
  if (!fileExists) {
    console.error("TF: 'tokens.json' does not exist!");
    process.exit(1);
  }
  const contents: TokenData = await file.json();
  const accessTokenFromFile = contents?.accessToken as string;
  accessToken = accessTokenFromFile;
}

if (!accessToken) {
  console.error("TF: ACCESS TOKEN NOT FOUND");
  process.exit(1);
}

/*
 * Check for required env vars
 */

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
