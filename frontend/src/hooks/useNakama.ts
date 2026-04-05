import { createContext, useContext } from "react";
import { Client, Session, Socket } from "@heroiclabs/nakama-js";

const NAKAMA_HOST = import.meta.env.VITE_NAKAMA_HOST || "localhost";
const NAKAMA_PORT = import.meta.env.VITE_NAKAMA_PORT || "7350";
const NAKAMA_KEY = import.meta.env.VITE_NAKAMA_KEY || "defaultkey";
const USE_SSL = import.meta.env.VITE_NAKAMA_SSL === "true";

export interface NakamaContextValue {
  client: Client;
  session: Session | null;
  socket: Socket | null;
  isConnected: boolean;
  userId: string | null;
  username: string | null;
  connect: () => Promise<void>;
}

// Singleton client — created once for the lifetime of the app
export const nakamaClient = new Client(NAKAMA_KEY, NAKAMA_HOST, NAKAMA_PORT, USE_SSL);

export const NakamaContext = createContext<NakamaContextValue>({
  client: nakamaClient,
  session: null,
  socket: null,
  isConnected: false,
  userId: null,
  username: null,
  connect: async () => {},
});

export function useNakama(): NakamaContextValue {
  return useContext(NakamaContext);
}

// Utilities for device-based auth.
// Uses sessionStorage so each browser tab gets its own unique identity,
// allowing two tabs in the same browser to play against each other.
export function getDeviceId(): string {
  let deviceId = sessionStorage.getItem("nakama_device_id");
  if (!deviceId) {
    deviceId =
      "device_" +
      Math.random().toString(36).substring(2) +
      Date.now().toString(36);
    sessionStorage.setItem("nakama_device_id", deviceId);
  }
  return deviceId;
}

export function getStoredUsername(): string | null {
  return sessionStorage.getItem("nakama_username");
}

export function setStoredUsername(username: string): void {
  sessionStorage.setItem("nakama_username", username);
}

export function generateUsername(): string {
  const adjectives = ["Swift", "Bold", "Clever", "Brave", "Keen", "Sharp", "Quick", "Wise"];
  const nouns = ["Fox", "Wolf", "Bear", "Eagle", "Lion", "Tiger", "Hawk", "Drake"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${adj}${noun}${num}`;
}
