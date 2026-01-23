// Multiplayer integration layer
// Manages network players and syncs state with server

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class MultiplayerManager {
  constructor(scene, localCharacter, footprintSystem) {
    this.scene = scene;
    this.localCharacter = localCharacter; // Reference to guy
    this.footprintSystem = footprintSystem; // Reference to footprint system
    this.networkPlayers = new Map(); // playerId -> { mesh, mixer, position, etc }
    this.localPlayerId = null;
    this.interpolationDelay = 100; // ms
    this.loader = new GLTFLoader();
    this.loadingPlayers = new Set(); // Track players currently being loaded
    this.onServerState = null; // Callback for server reconciliation
  }

  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }

  // Handle snapshot from server
  handleSnapshot(snapshot) {
    if (!snapshot || !snapshot.p) return;

    // Debug: occasionally log raw snapshot data
    if (Math.random() < 0.01) {
      console.log("📦 Snapshot:", snapshot.p.length, "players");
    }

    // Update ALL players including self from server (server-authoritative)
    const currentPlayerIds = new Set();

    for (const playerData of snapshot.p) {
      // Skip local player - we use client-side prediction
      if (playerData.id === this.localPlayerId) {
        // Store server state for reconciliation
        if (this.onServerState) {
          this.onServerState(playerData);
        }
        continue;
      }

      currentPlayerIds.add(playerData.id);

      if (
        !this.networkPlayers.has(playerData.id) &&
        !this.loadingPlayers.has(playerData.id)
      ) {
        this._createNetworkPlayer(playerData);
      } else if (this.networkPlayers.has(playerData.id)) {
        this._updateNetworkPlayer(playerData);
      }
    }

    // Remove disconnected players
    for (const [playerId, player] of this.networkPlayers) {
      if (!currentPlayerIds.has(playerId)) {
        this._removeNetworkPlayer(playerId);
      }
    }

    // Debug: log player count occasionally
    if (Math.random() < 0.01) {
      console.log("📊 Network players:", this.networkPlayers.size);
    }
  }

  // Create new network player
  _createNetworkPlayer(playerData) {
    console.log(
      "➕ Adding network player:",
      playerData.id,
      "at",
      playerData.x,
      playerData.y,
      playerData.z,
    );

    // Mark as loading to prevent duplicates
    this.loadingPlayers.add(playerData.id);

    // Load fresh model for each player (avoiding clone issues)
    this.loader.load("./assets/cyberian.glb", (gltf) => {
      const model = gltf.scene;

      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });

      // Set position from snapshot data
      model.position.set(playerData.x, playerData.y, playerData.z);

      // Calculate initial rotation from velocity (same as we do in update)
      const initialSpeed = Math.sqrt(
        playerData.vx * playerData.vx + playerData.vz * playerData.vz,
      );
      if (initialSpeed > 0.1) {
        const angle = Math.atan2(-playerData.vx, -playerData.vz) + Math.PI;
        model.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      } else {
        // Idle - use default rotation (will be corrected when they start moving)
        model.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      }
      model.scale.set(0.25, 0.25, 0.25); // Same scale as local player

      // Set up animations
      const mixer = new THREE.AnimationMixer(model);
      const animationsMap = new Map();
      gltf.animations.forEach((clip) => {
        animationsMap.set(clip.name, mixer.clipAction(clip));
      });

      // Start with idle animation
      if (animationsMap.has("idle")) {
        animationsMap.get("idle").play();
      }

      this.scene.add(model);
      console.log("✅ Network player added:", playerData.name);

      this.networkPlayers.set(playerData.id, {
        model,
        mixer,
        animationsMap,
        currentAnimation: "idle",
        targetPosition: new THREE.Vector3(
          playerData.x,
          playerData.y,
          playerData.z,
        ),
        targetRotation: playerData.yaw + Math.PI,
        velocity: new THREE.Vector3(
          playerData.vx,
          playerData.vy,
          playerData.vz,
        ),
        grounded: playerData.grounded,
        name: playerData.name,
      });

      // Done loading
      this.loadingPlayers.delete(playerData.id);
    });
  }

  // Update existing network player
  _updateNetworkPlayer(playerData) {
    const player = this.networkPlayers.get(playerData.id);
    if (!player) return;

    // Update target position from snapshot
    player.targetPosition.set(playerData.x, playerData.y, playerData.z);
    player.targetRotation = playerData.yaw;
    player.velocity.set(playerData.vx, playerData.vy, playerData.vz);
    player.grounded = playerData.grounded;
  }

  // Remove network player
  _removeNetworkPlayer(playerId) {
    console.log("➖ Removing network player:", playerId);

    const player = this.networkPlayers.get(playerId);
    if (player) {
      this.scene.remove(player.model);
      this.networkPlayers.delete(playerId);
    }
  }

  // Update all network players (call in animation loop)
  update(delta) {
    for (const [playerId, player] of this.networkPlayers) {
      if (!player.model) continue;

      // Smooth interpolation for XZ, instant snap for Y (server has authoritative terrain)
      // Server Y includes capsule radius offset, so we subtract to match terrain
      player.model.position.x +=
        (player.targetPosition.x - player.model.position.x) * 0.3;
      player.model.position.y = player.targetPosition.y - 0.35; // Subtract capsule radius to match terrain
      player.model.position.z +=
        (player.targetPosition.z - player.model.position.z) * 0.3;

      // Calculate rotation from velocity direction (like local player does)
      const speed = Math.sqrt(
        player.velocity.x * player.velocity.x +
          player.velocity.z * player.velocity.z,
      );

      if (speed > 0.1) {
        // Moving - face movement direction
        const targetAngle =
          Math.atan2(-player.velocity.x, -player.velocity.z) + Math.PI;
        const targetQuat = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          targetAngle,
        );
        player.model.quaternion.slerp(targetQuat, 0.2);
      }

      // Add footprints for moving network players
      if (this.footprintSystem && player.grounded && speed > 0.5) {
        const currentPos = player.model.position;
        if (
          !player.lastFootprintPos ||
          currentPos.distanceTo(player.lastFootprintPos) > 1.2
        ) {
          // Calculate movement direction from velocity
          const moveDir = new THREE.Vector3(
            player.velocity.x,
            0,
            player.velocity.z,
          ).normalize();
          if (moveDir.length() > 0) {
            this.footprintSystem.addFootprint(currentPos, moveDir);
            player.lastFootprintPos = currentPos.clone();
          }
        }
      }

      // Update animation based on velocity
      if (player.mixer && player.animationsMap) {
        const isMoving = speed > 1.5; // Higher threshold - server velocity is damped
        const isGrounded = player.grounded;

        let targetAnim = "idle";
        if (!isGrounded) {
          targetAnim = "float";
        } else if (isMoving) {
          targetAnim = "run";
        }

        // Switch animation if changed
        if (
          targetAnim !== player.currentAnimation &&
          player.animationsMap.has(targetAnim)
        ) {
          const current = player.animationsMap.get(player.currentAnimation);
          const next = player.animationsMap.get(targetAnim);
          if (current) current.fadeOut(0.2);
          if (next) next.reset().fadeIn(0.2).play();
          player.currentAnimation = targetAnim;
        }

        player.mixer.update(delta);
      }
    }
  }

  // Create name tag sprite
  _createNameTag(name) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "white";
    context.font = "bold 24px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 0.5, 1);

    return sprite;
  }

  // Generate random color for player
  _randomColor() {
    const colors = [
      0x00ff00, // Green
      0x0000ff, // Blue
      0xff00ff, // Magenta
      0xffff00, // Yellow
      0x00ffff, // Cyan
      0xff8800, // Orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  dispose() {
    for (const [playerId, player] of this.networkPlayers) {
      this._removeNetworkPlayer(playerId);
    }
    this.networkPlayers.clear();
  }
}
