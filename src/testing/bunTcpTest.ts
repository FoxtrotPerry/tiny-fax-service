import { getImageData, imageFromBuffer } from "@canvas/image";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { getAdjustedImageDimensions } from "../utils";

console.log("Connecting to printer...");

const socket = await Bun.connect<Buffer<ArrayBufferLike>>({
  hostname: "192.168.1.87",
  port: 9100,
  socket: {
    open: () => {
      console.log("Connected to printer");
    },
    close: () => {
      console.log("Disconnected from printer");
    },
    data: (data) => {
      console.log("Printer response:", data);
    },
    error: (e) => {
      console.error("Printer connection error:", e);
    },
    connectError: (e) => {
      console.error("Printer connection error:", e);
    },
    end: () => {
      console.log("Printer connection ended");
    },
    timeout: () => {
      console.error("Printer connection timed out");
      process.exit(0);
    },
    handshake: () => {
      console.log("Printer handshake complete");
    },
  },
  // exclusive: true,
});

process.on("beforeExit", () => {
  socket.end();
});

const print = function (command: Uint8Array<ArrayBufferLike>) {
  let CHUNK_SIZE = 1024;
  let offset = 0;
  let i = 0;

  while (offset < command.length) {
    const chunk = command.slice(offset, offset + CHUNK_SIZE);

    // await new Promise((resolve) => {
    //   socket.write(chunk, undefined);
    //   resolve(null);
    // });
    socket.write(chunk, undefined);

    offset += CHUNK_SIZE;
    i++;
  }
};

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

print(printerMessage);

print(printerMessage);

socket.timeout(1);
