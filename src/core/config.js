// Configuration for connecting to backend
// Switch between local development and production

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
    // API Gateway WebSocket endpoint
    matchmakerUrl: "wss://53fh1o7fy9.execute-api.us-east-2.amazonaws.com/prod/",
    mode: "matchmaker",
  },
};

// Current environment
export const CURRENT_ENV =
  process.env.NODE_ENV === "production" ? "PRODUCTION" : "LOCAL_DIRECT";

export function getNetworkConfig() {
  const config = NetworkConfig[CURRENT_ENV];
  if (typeof window !== "undefined") {
    console.log("[DEBUG] Environment:", CURRENT_ENV);
    console.log("[DEBUG] Using config:", config);
    if (config.matchmakerUrl) {
      console.log("[DEBUG] WebSocket URL:", config.matchmakerUrl);
    }
  }
  return config;
}

// Local dev bypass token
export const LOCAL_DEV_TOKEN = "local-dev-bypass";
