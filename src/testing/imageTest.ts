import { TinyFaxPrinter } from "../classes/tinyFaxPrinter";
import { printerConfig } from "../constants/printerConfig";

const printer = new TinyFaxPrinter(printerConfig);

await printer.connect();
await printer.waitForConnection();

const image = Bun.file(`src/testing/image.jpg`);
const imageBuffer = await image.arrayBuffer();
const arrBuffer = new Uint8Array(imageBuffer);

await printer.printImage(arrBuffer);
