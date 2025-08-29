/**
 * Sets up initial token values
 */

import { secrets } from "bun";
import { accessTokenKeys, refreshTokenKeys } from "./constants";

const firstArgIndex = process.env.NODE_ENV === "development" ? 2 : 1;

try {
  console.log(process.argv);
  const { accessToken, refreshToken } = JSON.parse(process.argv[firstArgIndex]);
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    throw new Error("Invalid token values provided.");
  }
  console.log({ accessToken, refreshToken });
  // await Promise.all([
  //   secrets.set({ ...accessTokenKeys, value: accessToken }),
  //   secrets.set({ ...refreshTokenKeys, value: refreshToken }),
  // ]);
} catch (e) {
  console.error(
    "TF: Invalid JSON provided as first argument in initialization.",
    e
  );
  process.exit(1);
}
