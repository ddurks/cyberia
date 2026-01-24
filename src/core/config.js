// Configuration for connecting to backend
// Switch between local development and production

// Get the host IP from URL (for network access) or use localhost
const getServerHost = () => {
  // If accessing via IP (e.g., 192.168.1.x:3000), use that IP for server
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return hostname; // Use same IP as frontend
  }
  return 'localhost';
};

export const NetworkConfig = {
  // Local development (direct to world server)
  LOCAL_DIRECT: {
    get worldServerUrl() {
      return `ws://${getServerHost()}:7777`;
    },
    mode: "direct",
  },

  // Production (AWS deployment with matchmaker)
  PRODUCTION: {
    matchmakerUrl: "wss://your-api-id.execute-api.us-east-2.amazonaws.com/prod",
    mode: "matchmaker",
  },
};

// Current environment
export const CURRENT_ENV = "LOCAL_DIRECT"; // Change to 'LOCAL_DIRECT' or 'PRODUCTION'

export function getNetworkConfig() {
  return NetworkConfig[CURRENT_ENV];
}

// Local dev bypass token
export const LOCAL_DEV_TOKEN = "local-dev-bypass";
