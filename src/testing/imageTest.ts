import NetworkReceiptPrinter from "@point-of-sale/network-receipt-printer";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { TinyFaxPrinterManager } from "../classes/tinyFaxPrinterManager";
import type { ImageMessage } from "../types/message";
import { printerConfig } from "../constants/printerConfig";

const printer = new TinyFaxPrinterManager(printerConfig);

await printer.connect();

const image = Bun.file(`src/testing/image.jpg`);
const imageBuffer = await image.arrayBuffer();
const arrBuffer = new Uint8Array(imageBuffer);

// convert the image to a base64 string
const base64String = Buffer.from(arrBuffer).toString("base64");
const base64ImageUrl = `data:image/jpeg;base64,${base64String}`;

const message: ImageMessage = {
  text: "Waddup council",
  image: base64ImageUrl,
};

const messageString = JSON.stringify(message);
const parsed = JSON.parse(messageString) as ImageMessage;

await printer.printImageMessage(parsed);

// Wait 3 seconds for printing to finish
setTimeout(() => {
  process.exit(0);
}, 3000);
