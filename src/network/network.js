// Network client for connecting to drawvidverse matchmaker and world server
// Handles WebSocket connections, authentication, and message protocol

export class NetworkClient {
  constructor() {
    this.matchmakerWs = null;
    this.worldWs = null;
    this.playerId = null;
    this.token = null;
    this.worldEndpoint = null;
    this.authenticated = false;
    this.joined = false;
    this.connected = false; // Master connection flag

    // Callbacks
    this.onConnected = null;
    this.onSnapshot = null;
    this.onBootstrapRequired = null;
    this.onBootstrapData = null;
    this.onVoicePeers = null;
    this.onError = null;

    this.inputSeq = 0;
    this.lastSentInput = null;
    this.inputHistory = []; // Store last 120 inputs (2 seconds at 60fps)
    this.maxInputHistory = 120;
  }

  // Connect to matchmaker
  connectToMatchmaker(matchmakerUrl) {
    return new Promise((resolve, reject) => {
      console.log(`🎮 Connecting to matchmaker: ${matchmakerUrl}`);

      this.matchmakerWs = new WebSocket(matchmakerUrl);

      this.matchmakerWs.onopen = () => {
        console.log("✓ Connected to matchmaker");
        resolve();
      };

      this.matchmakerWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this._handleMatchmakerMessage(msg);
      };

      this.matchmakerWs.onerror = (error) => {
        console.error("Matchmaker error:", error);
        reject(error);
      };

      this.matchmakerWs.onclose = () => {
        console.log("Matchmaker connection closed");
      };
    });
  }

  // Create or join a world
  async createAndJoinWorld(gameKey = "cyberia", worldId = null) {
    if (!this.matchmakerWs || this.matchmakerWs.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to matchmaker");
    }

    // Create world if no worldId provided
    if (!worldId) {
      worldId = await this._createWorld(gameKey);
    }

    // Join the world
    await this._joinWorld(gameKey, worldId);

    // Connect to world server
    await this._connectToWorldServer();
  }

  // Connect directly to world server (bypass matchmaker for local dev)
  async connectDirectly(worldServerUrl, token, coatColor) {
    this.token = token;
    this.coatColor = coatColor;
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

  // Upload world bootstrap (terrain + trees)
  uploadBootstrap(payload) {
    console.log(
      `📤 uploadBootstrap called: worldWs=${!!this.worldWs} joined=${this.joined} hasHeightmap=${!!payload?.heightmap}`,
    );

    if (!this.worldWs) {
      console.warn("⚠️ Cannot upload bootstrap: not connected to world server");
      return;
    }

    // If not joined yet, queue the upload
    if (!this.joined) {
      // Queueing bootstrap upload until joined
      const checkJoined = setInterval(() => {
        if (this.joined) {
          clearInterval(checkJoined);
          // Now joined, sending queued bootstrap
          this._sendToWorld({
            t: "bootstrapUpload",
            worldId: "local",
            version: 1,
            payload,
          });
          // Bootstrap sent
        }
      }, 50); // Check every 50ms
      return;
    }

    // Sending bootstrap to server
    this._sendToWorld({
      t: "bootstrapUpload",
      worldId: "local", // Will be overridden by server
      version: 1,
      payload,
    });
    // Bootstrap sent
  }

  // Send WebRTC signaling
  sendRTCOffer(to, sdp) {
    this._sendToWorld({ t: "rtcOffer", to, sdp });
  }

  sendRTCAnswer(to, sdp) {
    this._sendToWorld({ t: "rtcAnswer", to, sdp });
  }

  sendRTCIce(to, candidate) {
    this._sendToWorld({ t: "rtcIce", to, candidate });
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
      const handler = (msg) => {
        if (msg.t === "worldCreated") {
          this.matchmakerWs.removeEventListener("message", handler);
          resolve(msg.worldId);
        }
      };
      this.matchmakerWs.addEventListener("message", (e) =>
        handler(JSON.parse(e.data)),
      );

      this._sendToMatchmaker({
        t: "createWorld",
        gameKey,
      });
    });
  }

  _joinWorld(gameKey, worldId) {
    return new Promise((resolve, reject) => {
      const handler = (msg) => {
        if (msg.t === "joinResult") {
          this.matchmakerWs.removeEventListener("message", handler);
          this.worldEndpoint = {
            url: `ws://${msg.endpoint.ip}:${msg.endpoint.port}`,
          };
          this.token = msg.token;
          console.log("✓ Received world endpoint:", this.worldEndpoint.url);
          resolve();
        } else if (msg.t === "err") {
          this.matchmakerWs.removeEventListener("message", handler);
          reject(new Error(msg.msg));
        }
      };
      this.matchmakerWs.addEventListener("message", (e) =>
        handler(JSON.parse(e.data)),
      );

      this._sendToMatchmaker({
        t: "joinWorld",
        gameKey,
        worldId,
      });
    });
  }

  async _connectToWorldServer() {
    return new Promise((resolve, reject) => {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      // Connection timeout - iOS can be slower
      const connectionTimeout = setTimeout(() => {
        if (!this.authenticated) {
          if (this.worldWs) {
            this.worldWs.close();
          }
          reject(new Error("Connection timeout"));
        }
      }, 15000); // Increased from 10s to 15s for iOS

      // CRITICAL: Create WebSocket and set ALL handlers synchronously
      // to avoid race condition on fast connections / slow mobile devices
      try {
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
                    name: "Player",
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
              name: "Player",
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
          console.error("WebSocket error:", error);
          clearTimeout(connectionTimeout);
          reject(error);
        };

        this.worldWs.onclose = (event) => {
          clearTimeout(connectionTimeout);
          this.authenticated = false;
          this.joined = false;
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
        if (this.onVoicePeers) {
          this.onVoicePeers(msg.peers);
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
      this.worldWs.send(JSON.stringify(msg));
    }
  }
}
