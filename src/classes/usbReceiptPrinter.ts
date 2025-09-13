import { OutEndpoint, type Interface, usb } from "usb";
import { DEVICE_PROFILES } from "../constants/deviceProfiles";

/**
 * Class representing a TinyFax USB receipt printer.
 *
 * Needs to implement the following methods:
 * - connect(): Promise<void>
 * - disconnect(): void
 * - print(message: Uint8Array<ArrayBufferLike>): void
 */

export class UsbReceiptPrinter {
  private interface: Interface | null = null;
  private devices: usb.Device[] = [];
  private foundPrinterDevice: usb.Device | null = null;
  private foundPrinterProfile: (typeof DEVICE_PROFILES)[number] | null = null;
  private endpoint: OutEndpoint | null = null;
  private kernelDriverDetached = false;
  status:
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error"
    | "timeout" = "idle";

  constructor() {
    usb.on("attach", (device) => {
      const matchingProfile = this.checkDevice(device);
      if (matchingProfile) {
        console.log("Matching printer profile found. Reconnecting...");
        this.foundPrinterDevice = device;
        this.foundPrinterProfile = matchingProfile;
        this.connect();
      }
    });
  }

  async connect({
    onConnected,
  }: {
    onConnected?: () => void;
  } = {}) {
    this.status = "connecting";
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
      this.status = "error";
      console.error("❌ No known USB printers found.");
      return;
    }

    this.foundPrinterDevice.open();

    /*
     * GET THE PRINTER INTERFACE
     */

    this.interface = this.foundPrinterDevice.interfaces?.[0] ?? null;

    if (!this.interface) {
      this.status = "error";
      this.foundPrinterDevice;
      console.error("❌ No interfaces found on printer.");
      return;
    }

    if (this.interface.isKernelDriverActive()) {
      console.log("Detaching kernel driver...");
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

    const endpoint = this.interface.endpoints.find(
      (ep) => ep.direction === "out"
    ) as OutEndpoint | undefined;

    if (!endpoint) {
      console.error("❌ Could not find endpoint.");
      return;
    }

    this.endpoint = endpoint;

    this.endpoint.on("error", (err) => {
      console.error("❌ Error during transfer: ", err);
    });

    console.log("✅ Connected to USB printer.");

    this.status = "connected";
    onConnected?.();
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
    if (this.endpoint === null) {
      console.error("❌ No endpoint to disconnect.");
      return;
    }

    console.log("Disconnecting from USB printer...");
    this.endpoint.removeAllListeners("error");
    this.interface.release(true, (releaseError) => {
      if (releaseError) {
        console.error("❌ Could not release interface: ", releaseError);
      }
      if (this.kernelDriverDetached) {
        try {
          console.log("Re-attaching kernel driver...");
          this.interface?.attachKernelDriver();
        } catch (e) {
          console.error("❌ Could not re-attach kernel driver: ", e);
        }
      }
      this.foundPrinterDevice?.close();
    });

    this.interface = null;
    this.endpoint = null;
    this.foundPrinterDevice = null;
    this.kernelDriverDetached = false;
    this.status = "disconnected";
  }

  async print(message: Uint8Array<ArrayBufferLike>) {
    if (this.endpoint === null) {
      console.error("❌ No endpoint to use for printing.");
      return;
    }
    await this.endpoint.transferAsync(Buffer.from(message));
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
}
