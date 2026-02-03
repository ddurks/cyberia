// Configuration for connecting to backend
// Switch between local development and production

// Feature flags
export const FEATURES = {
  PROXIMITY_VOICE: false, // Set to true to enable WebRTC proximity voice
};

// Get the host IP from URL (for network access) or use localhost
const getServerHost = () => {
  // If accessing via IP (e.g., 192.168.1.x:3000), use that IP for server
  const hostname = window.location.hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "") {
    return hostname; // Use same IP as frontend
  }
  return "localhost";
};

export const NetworkConfig = {
  // Local development (direct to world server)
  LOCAL_DIRECT: {
    get worldServerUrl() {
      // Support manual IP override via URL parameter for iOS debugging
      const urlParams = new URLSearchParams(window.location.search);
      const manualIP = urlParams.get("serverip");
      if (manualIP) {
        return `ws://${manualIP}:7777`;
      }

      // Use Vite proxy to work around iOS Safari WebSocket bug
      // This allows WebSocket connections from the same origin
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}/ws`;
    },
    mode: "direct",
  },

  // Production (AWS deployment with matchmaker)
  PRODUCTION: {
    matchmakerUrl: "wss://matchmaker.drawvid.com/",
    mode: "matchmaker",
  },
};

// Current environment
export const CURRENT_ENV = "PRODUCTION";

export function getNetworkConfig() {
  const config = NetworkConfig[CURRENT_ENV];
  return config;
}

// Local dev bypass token
export const LOCAL_DEV_TOKEN = "local-dev-bypass";
