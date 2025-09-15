import EventEmitter from "eventemitter3";
import type { Status } from "../types/status";
import type { ErrorLike } from "bun";
import { getBit } from "../utils";
import { Heartbeat, type HeartbeatCallback } from "./heartbeat";

type NetworkReceiptPrinterEvents = {
  connected: () => void;
  data: (data: Buffer<ArrayBufferLike>) => void;
  disconnected: (expected: boolean) => void;
  error: (error: ErrorLike) => void;
};

type NetworkReceiptPrinterOptions = {
  host: string;
  port: number;
};

type NetworkPrinterReportedStatus = {
  online: boolean;
  waitingForOnlineRecovery: boolean;
};

const RETRY_WAIT_SECONDS = 15;
// ESC/POS real-time status (printer status) DLE EOT 1
// more info here: https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/dle_eot.html
const STATUS_POLL = new Uint8Array([0x10, 0x04, 0x01]);

class NetworkReceiptPrinter extends EventEmitter<NetworkReceiptPrinterEvents> {
  private socket: Bun.Socket<Buffer<ArrayBufferLike>> | null = null;
  private _status: Status = "idle";
  private printerReportedStatus: NetworkPrinterReportedStatus | null = null;
  private heartbeat;

  options: NetworkReceiptPrinterOptions;

  constructor(options: NetworkReceiptPrinterOptions) {
    super();

    this.options = {
      host: options.host || "localhost",
      port: options.port || 9100,
    };

    this.heartbeat = new Heartbeat();
  }

  private heartbeatCallback: HeartbeatCallback = (late) => {
    if (this._status !== "connected" || !this.socket) return;

    if (late) {
      console.warn("🛜 Heartbeat timeout. Forcing disconnect.");
      this.forceDisconnect();
      return;
    }

    // Send status poll. If the cable is unplugged, a write will eventually error.
    try {
      this.socket.write(STATUS_POLL);
    } catch (err) {
      console.error("🛜 Heartbeat write failed:", err);
      this.forceDisconnect(err as Error);
    }
  };

  async connect(): Promise<void> {
    if (this._status === "connected" || this._status === "connecting") {
      console.log("🛜 Already connected to network printer.");
      return;
    }

    this._status = "connecting";

    return new Promise<void>((resolve, reject) => {
      try {
        Bun.connect<Buffer<ArrayBufferLike>>({
          hostname: this.options.host,
          port: this.options.port,
          socket: {
            open: (socket) => {
              this._status = "connected";
              this.socket = socket;
              this.heartbeat.beat();
              this.heartbeat.start(this.heartbeatCallback);
              this.emit("connected");
              resolve();
            },
            data: (_, data) => {
              // value of data is 0xx1xx10b where x denoted bits that contain status data
              // more info here: https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/dle_eot.html
              const byte = data.readUInt8();
              const status = {
                online: !getBit(byte, 3),
                waitingForOnlineRecovery: !!getBit(byte, 5),
              };
              this.printerReportedStatus = status;
              this.heartbeat.beat();
              void this.emit("data", data);
            },
            close: (_, error) => {
              console.error("🛜 Network printer connection closed.");
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
              console.error("🛜 Network printer connection error.");
              const firstPhase = this._status === "connecting";
              this._status = "error";
              this.emit("error", error);
              this.socket?.end();
              if (firstPhase) {
                reject(error);
              }
            },
            end: () => {
              console.error("🛜 Network printer connection ended.");
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
            connectError: (_, error: ErrorLike) => {
              this._status = "error";
              this.emit("error", error);
              this.socket?.end();
              reject(error);
              if (error.code !== "ECONNREFUSED") {
                console.error("❌ Network printer connection error:", error);
              } else {
                this.scheduleConnectRetry();
              }
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

  /**
   * A wrapper around `connect()` that catches errors so they don't need to be caught upstream.
   */
  async safeConnect() {
    try {
      await this.connect();
    } catch (err) {
      // not being able to connect is an expected and acceptable outcome
      return;
    }
  }

  scheduleConnectRetry() {
    // console.log(
    //   `🛜 Waiting ${RETRY_WAIT_SECONDS}s to retry network printer connection...`
    // );
    setTimeout(async () => {
      await this.safeConnect();
    }, RETRY_WAIT_SECONDS * 1000);
  }

  async disconnect() {
    this.heartbeat.stop();
    this.socket?.end();
    this._status = "disconnected";
  }

  private forceDisconnect(err?: Error) {
    if (this._status === "disconnected" || this._status === "error") return;
    if (err) this.emit("error", err);
    this._status = "disconnected";
    try {
      this.socket?.end();
    } catch {
      /* ignore */
    }
    this.heartbeat.stop();
    this.emit("disconnected", false);
    this.scheduleConnectRetry();
  }

  print(command: Uint8Array<ArrayBufferLike>) {
    if (!this.socket) {
      console.error("🛜 Cannot print: Not connected to network printer.");
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

  /** Get the connection status of the printer */
  get status() {
    return this._status;
  }

  /** Get the last reported status from the print (ESC/POS real-time status) */
  get reportedStatus() {
    return this.printerReportedStatus;
  }
}

export default NetworkReceiptPrinter;
