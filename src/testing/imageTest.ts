import { imageFromBuffer } from "@canvas/image";
import { TinyFaxPrinter } from "../classes/tinyFaxPrinter";
import { printerConfig } from "../constants/printerConfig";
import type { ImageMessage } from "../types/message";

const printer = new TinyFaxPrinter(printerConfig);

await printer.connect();
await printer.waitForConnection();

const image = Bun.file(`src/testing/image.jpg`);
const imageBuffer = await image.arrayBuffer();
const arrBuffer = new Uint8Array(imageBuffer);

await printer.printImage(arrBuffer);

// convert the image to a base64 string
const base64String = Buffer.from(arrBuffer).toString("base64");
const base64ImageUrl = `data:image/jpeg;base64,${base64String}`;

const message: ImageMessage = {
  text: "This is a test image",
  image: base64ImageUrl,
};

const messageString = JSON.stringify(message);
const parsed = JSON.parse(messageString) as ImageMessage;

await printer.printImageFromString(parsed);
