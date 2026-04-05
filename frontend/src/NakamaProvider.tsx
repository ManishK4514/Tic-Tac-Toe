import { useState, useCallback, ReactNode } from "react";
import { Session, Socket } from "@heroiclabs/nakama-js";
import {
  NakamaContext,
  nakamaClient,
  getDeviceId,
  getStoredUsername,
  generateUsername,
  setStoredUsername,
} from "./hooks/useNakama";

interface NakamaProviderProps {
  children: ReactNode;
}

export function NakamaProvider({ children }: NakamaProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    // Reuse existing connection if already connected
    if (isConnected && session && socket) return;

    const deviceId = getDeviceId();
    let username = getStoredUsername();
    if (!username) {
      username = generateUsername();
      setStoredUsername(username);
    }

    // Authenticate with device ID (creates account on first run)
    const newSession = await nakamaClient.authenticateDevice(deviceId, true, username);
    setSession(newSession);

    // Create and connect socket
    const newSocket = nakamaClient.createSocket(
      import.meta.env.VITE_NAKAMA_SSL === "true",
      false
    );

    newSocket.ondisconnect = () => {
      setIsConnected(false);
    };

    await newSocket.connect(newSession, true);
    setSocket(newSocket);
    setIsConnected(true);
  }, [isConnected, session, socket]);

  return (
    <NakamaContext.Provider
      value={{
        client: nakamaClient,
        session,
        socket,
        isConnected,
        userId: session?.user_id ?? null,
        username: session?.username ?? null,
        connect,
      }}
    >
      {children}
    </NakamaContext.Provider>
  );
}
