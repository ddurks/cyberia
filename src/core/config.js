// Configuration for connecting to backend
// Switch between local development and production

export const NetworkConfig = {
  // Local development (use local matchmaker)
  LOCAL: {
    matchmakerUrl: "ws://localhost:8080",
    mode: "matchmaker",
  },

  // Local development (direct to world server, bypass matchmaker)
  LOCAL_DIRECT: {
    worldServerUrl: "ws://localhost:7777",
    token: null, // Will be generated
    mode: "direct",
  },

  // Production (AWS deployment)
  PRODUCTION: {
    matchmakerUrl: "wss://your-api-id.execute-api.us-east-2.amazonaws.com/prod",
    mode: "matchmaker",
  },
};

// Current environment
export const CURRENT_ENV = "LOCAL"; // Change to 'LOCAL_DIRECT' or 'PRODUCTION'

export function getNetworkConfig() {
  return NetworkConfig[CURRENT_ENV];
}

// Helper to generate JWT for direct connection (local dev only)
export function generateLocalToken(
  playerId,
  gameKey = "cyberia",
  worldId = "local",
) {
  // In production, this would be done by matchmaker
  // For local dev, we can generate a simple token
  const payload = {
    sub: playerId,
    gameKey,
    worldId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  };

  // Simple base64 encoding (NOT SECURE - only for local dev!)
  // In production, this uses proper JWT signing
  return btoa(JSON.stringify(payload));
}
