// Network client for connecting to drawvidverse matchmaker and world server
// Handles WebSocket connections, authentication, and message protocol

import { VoiceManager } from "./voiceManager.js";
import { FEATURES } from "../core/config.js";

export class NetworkClient {
  constructor() {
    this.matchmakerWs = null;
    this.worldWs = null;
    this.playerId = null;
    this.token = null;
    this.worldEndpoint = null;
    this.worldId = null; // Store worldId for bootstrap upload
    this.authenticated = false;
    this.joined = false;
    this.connected = false; // Master connection flag

    // Player customization
    this.playerName = "Player";
    this.coatColor = { r: 255, g: 255, b: 255 };

    // Voice manager for proximity audio
    this.voiceManager = null;

    // Callbacks
    this.onConnected = null;
    this.onSnapshot = null;
    this.onBootstrapRequired = null;
    this.onBootstrapData = null;
    this.onVoicePeers = null;
    this.onChat = null; // Callback for chat messages
    this.onBulletSpawn = null; // Callback for bullet spawn
    this.onBulletHit = null; // Callback for bullet hit
    this.onGunSpawn = null; // Callback for gun spawn
    this.onGunDisappear = null; // Callback for gun disappear
    this.onVideoSync = null; // Callback for synced video timestamp
    this.onError = null;
    this.onStatus = null; // Status updates for loading screen
    this.onProgress = null; // Progress percentage updates (percent, elapsed)

    this.inputSeq = 0;
    this.lastSentInput = null;
    this.inputHistory = []; // Store last 120 inputs (2 seconds at 60fps)
    this.maxInputHistory = 120;
  }

  // Connect to matchmaker
  connectToMatchmaker(matchmakerUrl) {
    const startTime = Date.now();
    const log = (msg) =>
      console.log(
        `[Network ${((Date.now() - startTime) / 1000).toFixed(2)}s] ${msg}`,
      );

    return new Promise((resolve, reject) => {
      log(`Connecting to matchmaker: ${matchmakerUrl}`);

      try {
        log(`[DEBUG] Creating WebSocket with URL: ${matchmakerUrl}`);
        this.matchmakerWs = new WebSocket(matchmakerUrl);
      } catch (e) {
        log(`Error creating WebSocket: ${e}`);
        reject(e);
        return;
      }

      const onOpenHandler = () => {
        log("✓ Connected to matchmaker");
        resolve();
      };

      const onMessageHandler = (event) => {
        const msg = JSON.parse(event.data);
        this._handleMatchmakerMessage(msg);
      };

      const onErrorHandler = (error) => {
        // Log as much detail as possible
        log(
          `Matchmaker error: ${error && error.message ? error.message : JSON.stringify(error)}`,
        );
        if (error && error.error) {
          log(`Error detail: ${JSON.stringify(error.error)}`);
        }
        if (typeof error === "object") {
          log(
            `Error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`,
          );
        }
        // Try to log the event if available
        if (window && window.event) {
          log(`Window event: ${JSON.stringify(window.event)}`);
        }
        reject(
          new Error(
            `WebSocket connection failed: ${error && error.message ? error.message : JSON.stringify(error)}`,
          ),
        );
      };

      const onCloseHandler = (event) => {
        log(`Matchmaker connection closed: code=${event.code}`);
        // Auto-reload on abnormal closure (1006) or server restart (1011)
        if (event.code === 1006 || event.code === 1011) {
          log("Unexpected disconnect, reloading page...");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      };

      this.matchmakerWs.addEventListener("open", onOpenHandler);
      this.matchmakerWs.addEventListener("message", onMessageHandler);
      this.matchmakerWs.addEventListener("error", onErrorHandler);
      this.matchmakerWs.addEventListener("close", onCloseHandler);
    });
  }

  // Create or join a world
  async createAndJoinWorld(
    gameKey = "cyberia",
    worldId = null,
    coatColor = null,
  ) {
    const startTime = Date.now();
    const log = (msg) =>
      console.log(
        `[Network ${((Date.now() - startTime) / 1000).toFixed(2)}s] ${msg}`,
      );

    log(`Starting with gameKey: ${gameKey}`);

    if (!this.matchmakerWs || this.matchmakerWs.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to matchmaker");
    }

    // Store coat color for later use when connecting to world server
    if (coatColor) {
      this.coatColor = coatColor;
    }

    // Create world if no worldId provided
    if (!worldId) {
      log("Creating new world...");
      worldId = await this._createWorld(gameKey);
      log(`World created: ${worldId}`);
    }

    // Join the world
    log(`Joining world: ${worldId}`);
    await this._joinWorld(gameKey, worldId);
    log(`World joined, connecting to world server...`);

    // Connect to world server
    await this._connectToWorldServer();
    log(`Connected to world server!`);
  }

  // Connect directly to world server (bypass matchmaker for local dev)
  async connectDirectly(
    worldServerUrl,
    token,
    coatColor,
    worldId = "test-world",
  ) {
    this.token = token;
    this.worldId = worldId;
    if (coatColor) {
      this.coatColor = coatColor;
    }
    this.worldEndpoint = { url: worldServerUrl };
    await this._connectToWorldServer();
  }

  // Send input to world server
  sendInput(mx, mz, yaw, jump) {
    if (!this.worldWs || !this.joined) {
      return;
    }

    this.inputSeq++;

    // Store input for reconciliation
    this.inputHistory.push({
      seq: this.inputSeq,
      mx,
      mz,
      yaw,
      jump,
      timestamp: Date.now(),
    });

    // Keep only recent inputs
    if (this.inputHistory.length > this.maxInputHistory) {
      this.inputHistory.shift();
    }

    this._sendToWorld({
      t: "in",
      seq: this.inputSeq,
      mx,
      mz,
      yaw,
      jump,
    });
  }

  // Fire bullet from player
  fireBullet(posX, posY, posZ, velX, velY, velZ) {
    if (!this.worldWs || !this.joined) {
      return;
    }

    this._sendToWorld({
      t: "fb", // Fire bullet
      x: posX,
      y: posY,
      z: posZ,
      vx: velX,
      vy: velY,
      vz: velZ,
    });
  }

  // Spawn gun for player
  spawnGun() {
    if (!this.worldWs || !this.joined) {
      return;
    }

    this._sendToWorld({
      t: "gs", // Gun spawn
    });
  }

  // Send dance animation
  sendDance() {
    if (!this.worldWs || !this.joined) {
      return;
    }

    this._sendToWorld({
      t: "d", // Dance
    });
  }

  // Upload world bootstrap (terrain + trees)
  uploadBootstrap(payload) {
    console.log(
      `📤 uploadBootstrap called: worldWs=${!!this.worldWs} joined=${this.joined}`,
    );

    if (!this.worldWs) {
      console.warn("⚠️ Cannot upload bootstrap: not connected to world server");
      return;
    }

    // If not joined yet, queue the upload
    if (!this.joined) {
      const checkJoined = setInterval(() => {
        if (this.joined) {
          clearInterval(checkJoined);
          this._sendToWorld({
            t: "bootstrapUpload",
            worldId: this.worldId,
            version: 1,
            payload,
          });
        }
      }, 50);
      return;
    }

    this._sendToWorld({
      t: "bootstrapUpload",
      worldId: this.worldId,
      version: 1,
      payload,
    });
  }

  // Send WebRTC signaling
  sendRTCOffer(to, sdp) {
    const msg = { t: "rtcOffer", to, sdp };
    this._sendToWorld(msg);
  }

  sendRTCAnswer(to, sdp) {
    const msg = { t: "rtcAnswer", to, sdp };
    this._sendToWorld(msg);
  }

  sendRTCIce(to, candidate) {
    const msg = { t: "rtcIce", to, candidate };
    this._sendToWorld(msg);
  }

  disconnect() {
    if (this.worldWs) {
      this.worldWs.close();
    }
    if (this.matchmakerWs) {
      this.matchmakerWs.close();
    }
  }

  // Private methods

  _createWorld(gameKey) {
    return new Promise((resolve) => {
      if (this.onStatus)
        this.onStatus("Submitting Request to Bureau of World Allocation...");

      const handler = (msg) => {
        if (msg.t === "worldCreated") {
          console.log(
            "[_createWorld] Received worldCreated response:",
            msg.worldId,
          );
          if (this.onStatus)
            this.onStatus("World Resources Approved by State Committee!");
          this.matchmakerWs.removeEventListener("message", handler);
          resolve(msg.worldId);
        }
      };
      this.matchmakerWs.addEventListener("message", (e) =>
        handler(JSON.parse(e.data)),
      );

      console.log(
        "[_createWorld] Sending createWorld with worldId: cyberia-public",
      );
      this._sendToMatchmaker({
        t: "createWorld",
        gameKey,
        worldId: "cyberia-public", // Fixed world ID - all players join the same world
      });
    });
  }

  _joinWorld(gameKey, worldId) {
    return new Promise((resolve, reject) => {
      if (this.onStatus)
        this.onStatus("Awaiting Clearance from Ministry of Entry...");

      const handler = (msg) => {
        if (msg.t === "status") {
          // Real-time progress updates from server startup
          if (this.onStatus) {
            this.onStatus(msg.msg);
          }
          // Callback for progress updates
          if (this.onProgress) {
            this.onProgress(msg.progress, msg.elapsed);
          }
        } else if (msg.t === "joinResult") {
          if (this.onStatus)
            this.onStatus("Entry Visa Granted! Preparing Transport...");
          this.matchmakerWs.removeEventListener("message", handler);
          // Store worldId for later use in bootstrap upload
          this.worldId = worldId;
          // Use WSS with domain name through NLB (omit port 443 as it's the default for wss://)
          let endpoint = `wss://${msg.endpoint.ip}`;

          // When running locally, proxy the world server through the dev server
          if (
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
          ) {
            endpoint = `ws://localhost:3000/world-ws`;
          }

          this.worldEndpoint = {
            url: endpoint,
          };
          this.token = msg.token;
          resolve();
        } else if (msg.t === "err") {
          this.matchmakerWs.removeEventListener("message", handler);
          reject(new Error(msg.msg));
        }
      };
      this.matchmakerWs.addEventListener("message", (e) => {
        const parsed = JSON.parse(e.data);
        handler(parsed);
      });

      this._sendToMatchmaker({
        t: "joinWorld",
        gameKey,
        worldId,
      });
    });
  }

  async _connectToWorldServer() {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const startTime = Date.now();
    const log = (msg) =>
      console.log(
        `[WorldServer ${((Date.now() - startTime) / 1000).toFixed(2)}s] ${msg}`,
      );

    if (this.onStatus)
      this.onStatus("Comrade Server is Warming Up Production Facilities...");
    log(`Starting connection to ${this.worldEndpoint.url}`);
    return await this._attemptWorldServerConnection(isIOS, log, startTime);
  }

  async _attemptWorldServerConnection(isIOS, log, startTime) {
    return new Promise((resolve, reject) => {
      if (log) log(`Connecting...`);
      if (this.onStatus)
        this.onStatus("Your Patience Serves The Collective, Comrade...");

      // Connection timeout - World server can take up to 90+ seconds to start
      // Setting 90 second timeout for slow backend startup
      const connectionTimeout = setTimeout(() => {
        if (!this.authenticated) {
          if (this.worldWs) {
            this.worldWs.close();
          }
          if (log) log(`Connection timeout after 90s`);
          reject(new Error("Connection timeout"));
        }
      }, 90000); // 90 seconds

      // CRITICAL: Create WebSocket and set ALL handlers synchronously
      // to avoid race condition on fast connections / slow mobile devices
      try {
        log(`[DEBUG] Creating WebSocket with URL: ${this.worldEndpoint.url}`);
        this.worldWs = new WebSocket(this.worldEndpoint.url);

        // Set binary type explicitly for iOS
        this.worldWs.binaryType = "arraybuffer";

        // iOS Safari workaround: onopen doesn't always fire reliably
        // Poll readyState as a backup
        const readyStatePoller = setInterval(() => {
          if (!this.worldWs) {
            clearInterval(readyStatePoller);
            return;
          }

          if (this.worldWs.readyState === WebSocket.OPEN) {
            clearInterval(readyStatePoller);

            // Critical iOS fix: Wait 200ms before sending to ensure message handlers are ready
            setTimeout(
              () => {
                try {
                  this._sendToWorld({
                    t: "auth",
                    token: this.token,
                  });

                  this._sendToWorld({
                    t: "join",
                    name: this.playerName,
                    coatColor: this.coatColor,
                  });
                } catch (error) {
                  console.error("Connection error:", error);
                  clearTimeout(connectionTimeout);
                  reject(error);
                }
              },
              isIOS ? 200 : 0,
            );
          } else if (
            this.worldWs.readyState === WebSocket.CLOSED ||
            this.worldWs.readyState === WebSocket.CLOSING
          ) {
            clearInterval(readyStatePoller);
            console.error("❌ WebSocket closed before opening");
          }
        }, 100); // Check every 100ms

        // Attach ALL event handlers immediately, before any async operations
        this.worldWs.onopen = () => {
          clearInterval(readyStatePoller);
          // Authenticate
          try {
            this._sendToWorld({
              t: "auth",
              token: this.token,
            });

            // Immediately send join after auth
            // (server will queue it until auth completes)
            this._sendToWorld({
              t: "join",
              name: this.playerName,
              coatColor: this.coatColor,
            });
          } catch (error) {
            console.error("Connection error:", error);
            clearTimeout(connectionTimeout);
            reject(error);
          }
        };

        this.worldWs.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this._handleWorldMessage(msg);

            if (msg.t === "welcome") {
              clearTimeout(connectionTimeout);
              this.authenticated = true;
              this.joined = true;
              this.connected = true; // Mark as fully connected
              this.playerId = msg.playerId;
              if (log) log(`✓ Welcome received, authenticated!`);

              // Initialize voice manager (if enabled)
              if (FEATURES.PROXIMITY_VOICE && !this.voiceManager) {
                this.voiceManager = new VoiceManager(this);
              }

              if (this.onConnected) {
                this.onConnected(this.playerId);
              }
              resolve();
            }
          } catch (error) {
            console.error("❌ Error processing message:", error, event.data);
          }
        };

        this.worldWs.onerror = (error) => {
          // Log as much detail as possible
          console.error("WebSocket error:", error);
          if (error && error.error) {
            console.error("Error detail:", JSON.stringify(error.error));
          }
          if (typeof error === "object") {
            console.error(
              "Error object:",
              JSON.stringify(error, Object.getOwnPropertyNames(error)),
            );
          }
          if (window && window.event) {
            console.error("Window event:", JSON.stringify(window.event));
          }
          clearTimeout(connectionTimeout);
          reject(error);
        };

        this.worldWs.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.authenticated = false;
          this.joined = false;
          this.connected = false; // Mark as disconnected
          // Gracefully fall back to offline mode instead of reloading
          console.log(
            `World server disconnected (code ${event.code}). Falling back to offline mode.`,
          );
        };
      } catch (error) {
        clearTimeout(connectionTimeout);
        reject(error);
      }
    });
  }

  _handleMatchmakerMessage(msg) {
    // Matchmaker message received

    if (msg.t === "status") {
      // Status message
    }

    if (msg.t === "err") {
      console.error("Matchmaker error:", msg.msg);
      if (this.onError) {
        this.onError("matchmaker", msg.msg);
      }
    }
  }

  _handleWorldMessage(msg) {
    // Skip logging noisy messages
    if (msg.t !== "voicePeers" && msg.t !== "s") {
      // World message received
    }

    switch (msg.t) {
      case "welcome":
        // Welcome already handled in onmessage for connection flow
        break;

      case "bootstrapRequired":
        // Bootstrap required (first player)
        if (this.onBootstrapRequired) {
          this.onBootstrapRequired();
        }
        break;

      case "bootstrapData":
        // Bootstrap data received
        if (this.onBootstrapData) {
          this.onBootstrapData(msg.payload);
        }
        break;

      case "s": // Snapshot
        if (this.onSnapshot) {
          this.onSnapshot(msg);
        }
        break;

      case "voicePeers":
        if (FEATURES.PROXIMITY_VOICE && this.voiceManager && this.playerId) {
          this.voiceManager.updateVoicePeers(msg.peers, this.playerId);
        }
        if (this.onVoicePeers) {
          this.onVoicePeers(msg.peers);
        }
        break;

      case "rtcOffer":
        if (FEATURES.PROXIMITY_VOICE && this.voiceManager) {
          this.voiceManager.handleRTCOffer(msg.from, msg.sdp);
        }
        break;

      case "rtcAnswer":
        if (FEATURES.PROXIMITY_VOICE && this.voiceManager) {
          this.voiceManager.handleRTCAnswer(msg.from, msg.sdp);
        }
        break;

      case "rtcIce":
        if (FEATURES.PROXIMITY_VOICE && this.voiceManager) {
          this.voiceManager.handleRTCIce(msg.from, msg.candidate);
        }
        break;

      case "err":
        console.error("World server error:", msg.msg);
        if (this.onError) {
          this.onError("world", msg.msg);
        }
        break;

      case "pong":
        // Ping response
        break;

      case "videoSync":
        // Synced video timestamp from server
        if (this.onVideoSync) {
          this.onVideoSync(msg.timestamp);
        }
        break;

      case "chat":
        // Chat message from another player
        if (this.onChat) {
          this.onChat({
            playerId: msg.playerId,
            playerName: msg.playerName,
            text: msg.text,
            timestamp: msg.timestamp,
          });
        }
        break;

      case "b":
        // Bullet spawn
        if (this.onBulletSpawn) {
          this.onBulletSpawn({
            id: msg.id,
            x: msg.x,
            y: msg.y,
            z: msg.z,
            vx: msg.vx,
            vy: msg.vy,
            vz: msg.vz,
            playerId: msg.playerId,
          });
        }
        break;

      case "bh":
        // Bullet hit
        if (this.onBulletHit) {
          this.onBulletHit({
            bulletId: msg.bulletId,
            targetPlayerId: msg.targetPlayerId,
            shooterId: msg.shooterId,
          });
        }
        break;

      case "gs":
        // Gun spawn
        if (this.onGunSpawn) {
          this.onGunSpawn({
            playerId: msg.playerId,
          });
        }
        break;

      case "gd":
        // Gun disappear
        if (this.onGunDisappear) {
          this.onGunDisappear({
            playerId: msg.playerId,
          });
        }
        break;

      case "d":
        // Dance
        if (this.onDance) {
          this.onDance(msg.playerId);
        }
        break;

      default:
        console.log("← Unknown message:", msg.t);
    }
  }

  _sendToMatchmaker(msg) {
    if (this.matchmakerWs && this.matchmakerWs.readyState === WebSocket.OPEN) {
      this.matchmakerWs.send(JSON.stringify(msg));
    }
  }

  _sendToWorld(msg) {
    if (this.worldWs && this.worldWs.readyState === WebSocket.OPEN) {
      const json = JSON.stringify(msg);
      // Log message size for large messages
      if (json.length > 50000) {
        console.warn(
          `[Network] Large message being sent: ${(json.length / 1024).toFixed(2)}KB (type: ${msg.t})`,
        );
      }
      this.worldWs.send(json);
    }
  }
}
