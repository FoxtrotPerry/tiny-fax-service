import EventEmitter from "eventemitter3";
import type { Status } from "../types/status";

type NetworkReceiptPrinterEvents = {
  connected: () => void;
  data: (data: Buffer<ArrayBufferLike>) => void;
  disconnected: (expected: boolean) => void;
  timeout: () => void;
  error: (error: Error) => void;
};

type NetworkReceiptPrinterOptions = {
  host: string;
  port: number;
  timeout?: number;
};

class NetworkReceiptPrinter extends EventEmitter<NetworkReceiptPrinterEvents> {
  private socket: Bun.Socket<Buffer<ArrayBufferLike>> | null = null;
  private _status: Status = "idle";

  options: NetworkReceiptPrinterOptions;

  constructor(options: NetworkReceiptPrinterOptions) {
    super();

    this.options = {
      host: options.host || "localhost",
      port: options.port || 9100,
      timeout: options.timeout,
    };
  }

  async connect(): Promise<void> {
    if (this._status === "connected" || this._status === "connecting") {
      console.log("🖨️ Already connected to network printer.");
      return;
    }

    this._status = "connecting";

    return new Promise<void>((resolve, reject) => {
      try {
        // FIXME: Find way to ensure ERRCONNREFUSED errors are not logged.
        Bun.connect<Buffer<ArrayBufferLike>>({
          hostname: this.options.host,
          port: this.options.port,
          socket: {
            open: (socket) => {
              this._status = "connected";
              this.socket = socket;
              this.emit("connected");
            },
            data: (_, data) => void this.emit("data", data),
            close: (_, error) => {
              let expected = false;
              if (error) {
                this._status = "error";
                const err = new Error("Connection closed during handshake");
                this.emit("error", err);
                this.emit("disconnected", expected);
                reject(err);
                return;
              }
              this._status = "disconnected";
              this.emit("disconnected", expected);
            },
            error: (_, error) => {
              const firstPhase = this._status === "connecting";
              this._status = "error";
              this.emit("error", error);
              this.socket?.end();
              if (firstPhase) {
                reject(error);
              }
            },
            end: () => {
              if (this._status === "connecting") {
                const err = new Error("Connection ended during handshake");
                this._status = "error";
                this.emit("error", err);
                reject(err);
              } else {
                this._status = "disconnected";
                this.emit("disconnected", false);
              }
              this.socket?.end();
            },
            timeout: () => {
              const err = new Error("Connection timeout");
              this._status = "timeout";
              this.emit("timeout");
              this.emit("error", err);
              this.socket?.end();
              reject(err);
            },
          },
        });
      } catch (err) {
        this._status = "error";
        this.emit("error", err as Error);
        reject(err);
      }
    });
  }

  async disconnect() {
    this.socket?.end();
  }

  print(command: Uint8Array<ArrayBufferLike>) {
    if (!this.socket) {
      console.error("❌ Cannot print: Not connected to network printer.");
      return;
    }

    const CHUNK_SIZE = 1024;
    let offset = 0;
    let i = 0;

    while (offset < command.length) {
      const chunk = command.slice(offset, offset + CHUNK_SIZE);

      this.socket.write(chunk, undefined);

      offset += CHUNK_SIZE;
      i++;
    }
  }

  get status() {
    return this._status;
  }
}

export default NetworkReceiptPrinter;
