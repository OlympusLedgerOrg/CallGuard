/**
 * CallGuard mobile app configuration.
 *
 * Set CALLGUARD_SERVER_URL to the address of your running CallGuard server.
 * In development this is usually your local IP (not localhost) so the
 * phone/emulator can reach it over the network.
 *
 * Examples:
 *   http://192.168.1.42:3000   ← local dev (use your machine's LAN IP)
 *   https://abc123.ngrok.io    ← ngrok tunnel
 *   https://callguard.example.com ← production
 */

import Constants from "expo-constants";

const ENV_URL =
  Constants.expoConfig?.extra?.CALLGUARD_SERVER_URL ||
  process.env.CALLGUARD_SERVER_URL;

const SERVER_URL = ENV_URL || "http://localhost:3000";

export default {
  SERVER_URL,
};
