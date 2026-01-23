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
  async connectDirectly(worldServerUrl, token) {
    this.token = token;
    this.worldEndpoint = { url: worldServerUrl };
    await this._connectToWorldServer();
  }

  // Send input to world server
  sendInput(mx, mz, yaw, jump) {
    // Debug every call for now
    if (this.inputSeq % 60 === 0 || !this.worldWs || !this.joined) {
      console.log(
        "sendInput called:",
        "worldWs:",
        !!this.worldWs,
        "joined:",
        this.joined,
        "seq:",
        this.inputSeq,
        "mx:",
        mx,
        "mz:",
        mz,
      );
    }

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
      console.log("⏳ Queueing bootstrap upload until joined...");
      const checkJoined = setInterval(() => {
        if (this.joined) {
          clearInterval(checkJoined);
          console.log("✅ Now joined, sending queued bootstrap...");
          this._sendToWorld({
            t: "bootstrapUpload",
            worldId: "local",
            version: 1,
            payload,
          });
          console.log(`✅ Bootstrap sent to server`);
        }
      }, 50); // Check every 50ms
      return;
    }

    console.log(`📤 Sending bootstrap to server...`);
    this._sendToWorld({
      t: "bootstrapUpload",
      worldId: "local", // Will be overridden by server
      version: 1,
      payload,
    });
    console.log(`✅ Bootstrap sent to server`);
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
      console.log(`🌍 Connecting to world server: ${this.worldEndpoint.url}`);

      this.worldWs = new WebSocket(this.worldEndpoint.url);

      this.worldWs.onopen = () => {
        console.log("✓ Connected to world server");

        // Authenticate
        this._sendToWorld({
          t: "auth",
          token: this.token,
        });

        // Immediately send join after auth
        // (server will queue it until auth completes)
        this._sendToWorld({
          t: "join",
          name: "Player",
        });
      };

      this.worldWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this._handleWorldMessage(msg);

        if (msg.t === "welcome") {
          this.authenticated = true;
          this.joined = true;
          this.connected = true; // Mark as fully connected
          this.playerId = msg.playerId;
          console.log("✓ Joined world as", this.playerId);
          if (this.onConnected) {
            this.onConnected(this.playerId);
          }
          resolve();
        }
      };

      this.worldWs.onerror = (error) => {
        console.error("World server error:", error);
        reject(error);
      };

      this.worldWs.onclose = () => {
        console.log("World server connection closed");
        this.authenticated = false;
        this.joined = false;
      };
    });
  }

  _handleMatchmakerMessage(msg) {
    console.log("← Matchmaker:", msg.t);

    if (msg.t === "status") {
      console.log(`  Status: ${msg.msg}`);
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
      console.log("← World:", msg.t, msg);
    }

    switch (msg.t) {
      case "welcome":
        // Welcome already handled in onmessage for connection flow
        break;

      case "bootstrapRequired":
        console.log("← Bootstrap required (first player)");
        if (this.onBootstrapRequired) {
          this.onBootstrapRequired();
        }
        break;

      case "bootstrapData":
        console.log("← Bootstrap data received");
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
