import { OutEndpoint, type Interface, usb, InEndpoint } from "usb";
import { DEVICE_PROFILES } from "../constants/deviceProfiles";
import EventEmitter from "eventemitter3";

type UsbReceiptPrinterEvents = {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  timeout: () => void;
};

export class UsbReceiptPrinter extends EventEmitter<UsbReceiptPrinterEvents> {
  private interface: Interface | null = null;
  private devices: usb.Device[] = [];
  private foundPrinterDevice: usb.Device | null = null;
  private foundPrinterProfile: (typeof DEVICE_PROFILES)[number] | null = null;
  private outEndpoint: OutEndpoint | null = null;
  private inEndpoint: InEndpoint | null = null;
  private kernelDriverDetached = false;
  _status:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"
    | "timeout" = "idle";

  constructor() {
    super();
    usb.on("attach", (device) => {
      const matchingProfile = this.checkDevice(device);
      if (matchingProfile) {
        console.log("🔌 Matching printer profile found. Reconnecting...");
        this.foundPrinterDevice = device;
        this.foundPrinterProfile = matchingProfile;
        this.connect();
      }
    });

    usb.on("detach", (device) => {
      if (
        this.foundPrinterDevice &&
        device.deviceAddress === this.foundPrinterDevice.deviceAddress
      ) {
        console.log("🔌 USB Printer unplugged. Performing cleanup...");
        // this.foundPrinterDevice = null;
        // this.foundPrinterProfile = null;
        // this.endpoint = null;
        // this.interface = null;
        // this._status = "disconnected";
        this.disconnect();
      }
    });
  }

  async connect() {
    if (this._status === "connected") {
      console.log("🔌 Already connected to USB printer.");
      return;
    }
    this._status = "connecting";
    this.devices = usb.getDeviceList();

    /*
     * FIND THE PRINTER USB DEVICE
     */

    for (let i = 0; i < this.devices.length; i++) {
      const device = this.devices[i];
      const matchingProfile = this.checkDevice(device);
      if (matchingProfile) {
        this.foundPrinterDevice = device;
        this.foundPrinterProfile = matchingProfile;
      }
    }

    if (!this.foundPrinterDevice || !this.foundPrinterProfile) {
      this._status = "error";
      console.log("🔌 No known USB printers found.");
      return;
    }

    this.foundPrinterDevice.open();

    /*
     * GET THE PRINTER INTERFACE
     */

    this.interface = this.foundPrinterDevice.interfaces?.[0] ?? null;

    if (!this.interface) {
      this._status = "error";
      this.foundPrinterDevice;
      console.error("❌ No interfaces found on printer.");
      return;
    }

    if (this.interface.isKernelDriverActive()) {
      console.log("🔌 Detaching kernel driver...");
      try {
        this.interface.detachKernelDriver();
        this.kernelDriverDetached = true;
      } catch (e) {
        console.error("❌ Could not detach kernel driver: ", e);
        return;
      }
    }

    this.interface.claim();

    /*
     * GET THE ENDPOINT
     */

    this.interface.endpoints.forEach((ep) => {
      if (ep.direction === "out") this.outEndpoint = ep as OutEndpoint;
      else if (ep.direction === "in") this.inEndpoint = ep as InEndpoint;
    });

    if (!this.outEndpoint) {
      console.error("❌ Could not find endpoint.");
      return;
    }

    this.outEndpoint.on("error", (err) => {
      console.error("❌ Error during transfer: ", err);
    });

    this._status = "connected";
    this.emit("connected");
  }

  async disconnect() {
    if (this.foundPrinterDevice === null) {
      console.error("❌ No device to disconnect.");
      return;
    }
    if (this.interface === null) {
      console.error("❌ No interface to disconnect.");
      return;
    }
    if (this.outEndpoint === null) {
      console.error("❌ No endpoint to disconnect.");
      return;
    }

    console.log("🔌 Disconnecting from USB printer...");
    this.outEndpoint.removeAllListeners("error");
    this.interface.release(true, (releaseError) => {
      if (releaseError) {
        console.error("❌ Could not release interface: ", releaseError);
      }
      if (this.kernelDriverDetached) {
        try {
          console.log("🔌 Re-attaching kernel driver...");
          this.interface?.attachKernelDriver();
        } catch (e) {
          console.error("❌ Could not re-attach kernel driver: ", e);
        }
      }
      this.foundPrinterDevice?.close();
    });

    this.interface = null;
    this.outEndpoint = null;
    this.foundPrinterDevice = null;
    this.kernelDriverDetached = false;
    this._status = "disconnected";
  }

  async print(message: Uint8Array<ArrayBufferLike>) {
    if (this.outEndpoint === null) {
      console.error("❌ No endpoint to use for printing.");
      return;
    }
    await this.outEndpoint.transferAsync(Buffer.from(message));
  }

  private checkDevice(device: usb.Device) {
    const deviceDesc = device.deviceDescriptor;
    const matchingProfile = DEVICE_PROFILES.find((profile) => {
      const filter = profile.filters[0] as {
        vendorId: number;
        productId?: number;
      };
      if (typeof filter.productId === "undefined") {
        return deviceDesc.idVendor === filter.vendorId;
      } else {
        return (
          deviceDesc.idVendor === filter.vendorId &&
          deviceDesc.idProduct === filter.productId
        );
      }
    });
    return matchingProfile;
  }

  get status() {
    return this._status;
  }
}
