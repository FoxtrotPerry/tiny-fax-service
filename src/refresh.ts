/**
 * Refresh Protocol
 * 1. Check the last time the access tokens were refreshed
 * 2. If within two days of expiration, attempt to refresh tokens
 * 3. Save new "issued at" unix timestamp
 */

import axios from "axios";
import { env } from "./env";

// constants

const unixNow = Math.round(Date.now() / 1000);
const secondsInDay = 60 * 60 * 24;
// const fiveDaysInSeconds = secondsInDay * 5;

// ensure refresh token exists

const tokensFile = Bun.file("tokens.json");
const tokensExist = await tokensFile.exists();

if (!tokensExist) {
  console.error("TF: 'tokens.json' does not exist!");
  process.exit(1);
}

const tokensContents = await tokensFile.json();

/**
 * Check for required env vars
 */
if (!tokensContents?.refreshToken) {
  console.error("TF: REFRESH TOKEN NOT FOUND");
  process.exit(1);
}

const refreshToken = tokensContents.refreshToken;

// check if token is nearing expiration

const iatFile = Bun.file("iat.json");
const fileExists = await iatFile.exists();

if (fileExists) {
  const iatContents = await iatFile.json(); // { iat: number }

  // if the token was refreshed within the last five days, we don't bother refreshing
  if (iatContents.iat > unixNow - secondsInDay) {
    console.log(
      "Token has been refreshed within the last 24 hours, aborting refresh."
    );
    process.exit(0);
  }
} else {
  console.log("iat log not found, refreshing tokens...");
}

// if we've gotten here, a token refresh is required

const refreshResp = await axios.post(`${env.TF_API_URL}/token/refresh`, {
  refreshToken,
});

const newTokens = refreshResp.data;

Bun.write("tokens.json", JSON.stringify(newTokens));

Bun.write("iat.json", JSON.stringify({ iat: Math.round(Date.now() / 1000) }));

process.exit(0);
