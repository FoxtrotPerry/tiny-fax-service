import { env } from "bun";
import type { MessageBody } from "./types/message";

export function send({
  socket,
  payload,
}: {
  socket: WebSocket | null;
  payload: MessageBody;
}) {
  const payloadString = JSON.stringify(payload);
  socket?.send(payloadString);
}

/**
 * Returns the closest width and height that is a multiple of 8 and doesn't exceed the maxWidth and maxHeight while keeping the aspect ratio.
 */
export const getAdjustedImageDimensions = (
  width: number,
  height: number,
  /** maxWidth is important to enforce because printer paper is only so wide, but can print vertically as much as needed */
  maxWidth?: number,
  /** if true, will return dimensions that are as close as possible to maxWidth of the paper while maintaining aspect ration */
  scaleToFit: boolean = true
) => {
  // Calculate the adjusted width of the image that doesn't exceed the maxWidth
  const adjustedWidth =
    scaleToFit && maxWidth
      ? Math.floor(maxWidth / 8) * 8
      : Math.floor(Math.min(width, maxWidth ?? width) / 8) * 8;
  // Calculate the adjusted height of the image that keeps the aspect ratio and is a multiple of 8
  const adjustedHeight =
    Math.floor(Math.floor((adjustedWidth / width) * height) / 8) * 8;

  return {
    width: adjustedWidth,
    height: adjustedHeight,
  };
};

export const wait = async (ms: number, retries?: number) =>
  new Promise((resolve) =>
    setTimeout(resolve, retries ? ms * (retries + 1) : ms)
  );

export function debounce<Func extends (...args: any[]) => void>(
  func: Func,
  wait: number
): (...args: Parameters<Func>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<Func>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
