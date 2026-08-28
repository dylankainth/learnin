import React, { createContext, useContext, useEffect, useRef, useState, PropsWithChildren } from "react";
import NetInfo from "@react-native-community/netinfo";
import { showToast } from "./toast";

type ReconnectListener = () => void;
const reconnectListeners = new Set<ReconnectListener>();

/**
 * Registers `fn` to run whenever the app transitions from offline back
 * online, so a screen can silently re-fetch the data it showed from cache.
 * Returns an unsubscribe function — call it from a cleanup / useEffect return.
 */
export function onReconnect(fn: ReconnectListener): () => void {
  reconnectListeners.add(fn);
  return () => reconnectListeners.delete(fn);
}

interface ConnectivityContextValue {
  isOnline: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({ isOnline: true });

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState(true);
  const wasOffline = useRef(false);
  const hasSeenFirstState = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);

      if (!hasSeenFirstState.current) {
        // Don't fire a "back online" toast just because the app happened to
        // launch online — only real offline → online transitions count.
        hasSeenFirstState.current = true;
        wasOffline.current = !online;
        return;
      }

      if (online && wasOffline.current) {
        showToast("Back online — refreshing…");
        reconnectListeners.forEach((fn) => {
          try {
            fn();
          } catch {
            // one screen's refresh failing shouldn't block the others
          }
        });
      }
      wasOffline.current = !online;
    });

    return unsubscribe;
  }, []);

  return <ConnectivityContext.Provider value={{ isOnline }}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityContextValue {
  return useContext(ConnectivityContext);
}

/** Re-runs `callback` whenever the app comes back online after being offline. */
export function useOnReconnect(callback: ReconnectListener) {
  useEffect(() => onReconnect(callback), [callback]);
}
