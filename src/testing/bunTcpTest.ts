import { getImageData, imageFromBuffer } from "@canvas/image";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { getAdjustedImageDimensions } from "../utils";
import NetworkReceiptPrinter from "../classes/networkReceiptPrinter";

console.log("Connecting to printer...");

const printer = new NetworkReceiptPrinter({
  host: "192.168.1.87",
  port: 9100,
});

await printer.connect();

process.on("beforeExit", () => {
  printer.disconnect();
});

const encoder = new ReceiptPrinterEncoder();
const image = Bun.file(`src/testing/image.jpg`);
const arrBuffer = new Uint8Array(await image.arrayBuffer());
const imageData = getImageData(await imageFromBuffer(arrBuffer));

if (!imageData) {
  process.exit(1);
}

const dimensions = getAdjustedImageDimensions(
  imageData.width,
  imageData.height,
  568,
  true // scale to fit
);

const printerMessage = encoder
  .initialize()
  .image(imageData, dimensions.width, dimensions.height, "atkinson")
  .box(
    {
      align: "left",
      style: "single",
      marginLeft: 0,
      marginRight: 0,
      paddingLeft: 1,
    },
    "Waddup council"
  )
  .newline(9)
  .encode();

printer.print(printerMessage);

process.exit(0);
