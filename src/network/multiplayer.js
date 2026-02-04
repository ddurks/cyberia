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
    this.bullets = new Map(); // bulletId -> { model, velocity, createdAt }
    this.bulletModel = null; // Cached bullet model
    this.gunModel = null; // Cached gun model
    this.playerGuns = new Map(); // playerId -> { model, spawnTime }
  }

  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }

  // Handle snapshot from server
  handleSnapshot(snapshot) {
    if (!snapshot || !snapshot.p) return;

    // Handle local player state from server (server sends it in 'you' field)
    if (snapshot.you && snapshot.you.id === this.localPlayerId) {
      if (this.onServerState) {
        this.onServerState(snapshot.you);
      }
    }

    // Update ALL other players from server
    const currentPlayerIds = new Set();

    for (const playerData of snapshot.p) {
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
          // Apply player's coat color if available
          // Colors are in 0-255 range, convert to 0-1 for Three.js
          if (
            object.material &&
            object.material.name === "snowsuit" &&
            playerData.coatColor
          ) {
            object.material.color.setRGB(
              playerData.coatColor.r / 255,
              playerData.coatColor.g / 255,
              playerData.coatColor.b / 255,
            );
          }
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

      // Create name tag with player's coat color
      const nameTag = this._createNameTag(
        playerData.name,
        playerData.coatColor,
      );
      nameTag.position.copy(model.position);
      nameTag.position.y -= 0.5; // 0.5 units below player
      nameTag.renderOrder = 1; // Render over ground but under players/trees
      this.scene.add(nameTag);
      // Network player added

      this.networkPlayers.set(playerData.id, {
        model,
        mixer,
        animationsMap,
        currentAnimation: "idle",
        coatColor: playerData.coatColor,
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
        nameTag,
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

    // Update gun position if player has an active gun
    if (this.playerGuns.has(playerData.id)) {
      this.updatePlayerGunPosition(playerData.id, player.model);
    }
  }

  // Remove network player
  _removeNetworkPlayer(playerId) {
    // Removing network player

    const player = this.networkPlayers.get(playerId);
    if (player) {
      this.scene.remove(player.model);
      if (player.nameTag) {
        this.scene.remove(player.nameTag);
      }
      this.networkPlayers.delete(playerId);
    }
  }

  // Update all network players (call in animation loop)
  update(delta) {
    for (const [playerId, player] of this.networkPlayers) {
      if (!player.model) continue;

      // Calculate speed from velocity
      const speed = Math.sqrt(
        player.velocity.x * player.velocity.x +
          player.velocity.z * player.velocity.z,
      );

      // Check if there's distance to travel to target (including vertical for falling)
      const distanceToTarget = Math.sqrt(
        Math.pow(player.targetPosition.x - player.model.position.x, 2) +
          Math.pow(
            player.targetPosition.y - 0.35 - player.model.position.y,
            2,
          ) +
          Math.pow(player.targetPosition.z - player.model.position.z, 2),
      );

      const isStationary = speed < 0.1;

      // Optimize: Skip interpolation for stationary players who are already at target
      if (!isStationary || distanceToTarget > 0.1) {
        // Only interpolate if moving OR if there's significant position error
        const lerpFactor = 0.15; // Gentle interpolation for smoothness
        player.model.position.x +=
          (player.targetPosition.x - player.model.position.x) * lerpFactor;
        player.model.position.y +=
          (player.targetPosition.y - 0.35 - player.model.position.y) *
          lerpFactor; // Subtract capsule radius
        player.model.position.z +=
          (player.targetPosition.z - player.model.position.z) * lerpFactor;
      }

      // Calculate rotation from velocity direction (like local player does)
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

      // Update name tag position
      if (player.nameTag) {
        player.nameTag.position.copy(player.model.position);
        player.nameTag.position.y -= 0.5; // 0.5 units below player
      }

      // Update animation based on whether player has distance to cover
      if (player.mixer && player.animationsMap) {
        const isGrounded = player.grounded;

        // Animate as running if there's significant distance to target position OR if velocity is non-zero
        // (the lerp will move them toward it, or they're actively moving)
        const isMoving = (distanceToTarget > 0.2 || speed > 0.5) && isGrounded;

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

  // Create name tag sprite with player outfit color
  _createNameTag(name, coatColor) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = 256;
    canvas.height = 64;

    // Transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Text color matches player outfit
    let textColor = "#ffffff"; // Default white
    if (coatColor) {
      const r = Math.floor(coatColor.r || 0);
      const g = Math.floor(coatColor.g || 0);
      const b = Math.floor(coatColor.b || 0);
      textColor = `rgb(${r}, ${g}, ${b})`;
    }

    context.fillStyle = textColor;
    context.font = "bold 28px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false, // Render through ground so it's always visible
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.5, 0.5, 1);

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

    // Clean up bullets
    for (const [bulletId, bullet] of this.bullets) {
      if (bullet.model && bullet.model.parent) {
        this.scene.remove(bullet.model);
      }
    }
    this.bullets.clear();
  }

  // Load bullet model
  loadBulletModel() {
    return new Promise((resolve) => {
      if (this.bulletModel) {
        resolve(this.bulletModel);
      } else {
        this.loader.load("./assets/bullet.glb", (gltf) => {
          this.bulletModel = gltf.scene;
          resolve(this.bulletModel);
        });
      }
    });
  }

  // Load gun model
  loadGunModel() {
    return new Promise((resolve) => {
      if (this.gunModel) {
        resolve(this.gunModel);
      } else {
        this.loader.load("./assets/gun.glb", (gltf) => {
          this.gunModel = gltf.scene;
          resolve(this.gunModel);
        });
      }
    });
  }

  // Spawn gun for a networked player when they fire
  spawnGunForPlayer(playerId, playerModel) {
    if (!this.gunModel || !playerModel) return;

    // Remove old gun if it exists
    if (this.playerGuns.has(playerId)) {
      const oldGun = this.playerGuns.get(playerId);
      this.scene.remove(oldGun.model);
    }

    // Clone gun model
    const gun = this.gunModel.clone();
    gun.scale.set(0.25, 0.25, 0.25);

    // Position gun relative to player
    const right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1);
    const up = new THREE.Vector3(0, 1, 0);

    right.applyQuaternion(playerModel.quaternion);
    forward.applyQuaternion(playerModel.quaternion);
    up.applyQuaternion(playerModel.quaternion);

    const gunPos = playerModel.position.clone();
    gunPos.addScaledVector(right, -0.3);
    gunPos.addScaledVector(forward, -0.5);
    gunPos.addScaledVector(up, 0.4);

    gun.position.copy(gunPos);

    // Rotate gun to face forward
    const quat = new THREE.Quaternion();
    quat.setFromEuler(playerModel.rotation);
    gun.quaternion.copy(quat);

    this.scene.add(gun);

    this.playerGuns.set(playerId, {
      model: gun,
      spawnTime: performance.now(),
    });
  }

  // Update gun position for a networked player
  updatePlayerGunPosition(playerId, playerModel) {
    if (!this.playerGuns.has(playerId)) return;

    const gunData = this.playerGuns.get(playerId);

    // Position gun relative to player
    const right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1);
    const up = new THREE.Vector3(0, 1, 0);

    right.applyQuaternion(playerModel.quaternion);
    forward.applyQuaternion(playerModel.quaternion);
    up.applyQuaternion(playerModel.quaternion);

    const gunPos = playerModel.position.clone();
    gunPos.addScaledVector(right, -0.3);
    gunPos.addScaledVector(forward, -0.5);
    gunPos.addScaledVector(up, 0.4);

    gunData.model.position.copy(gunPos);

    // Rotate gun to face forward
    const quat = new THREE.Quaternion();
    quat.setFromEuler(playerModel.rotation);
    gunData.model.quaternion.copy(quat);
  }

  // Update guns: remove expired ones
  updatePlayerGuns(deltaT) {
    const now = performance.now();
    const gunTimeout = 10000; // 10 seconds

    for (const [playerId, gunData] of this.playerGuns) {
      const elapsed = now - gunData.spawnTime;
      if (elapsed > gunTimeout) {
        // Remove expired gun
        this.scene.remove(gunData.model);
        this.playerGuns.delete(playerId);
      }
    }
  }

  // Remove gun for a player
  removePlayerGun(playerId) {
    if (this.playerGuns.has(playerId)) {
      const gunData = this.playerGuns.get(playerId);
      this.scene.remove(gunData.model);
      this.playerGuns.delete(playerId);
    }
  }
  // Handle bullet hit event
  handleBulletHit(bulletData) {
    const { bulletId, targetPlayerId, hitPos } = bulletData;

    // Remove bullet from tracking
    if (this.bullets.has(bulletId)) {
      const bullet = this.bullets.get(bulletId);
      if (bullet.model && bullet.model.parent) {
        this.scene.remove(bullet.model);
      }
      this.bullets.delete(bulletId);
    }

    // Visual effect could be added here (particle effect, etc)
  }

  // Create visual bullet on client (for remote player bullets)
  spawnBullet(bulletId, posX, posY, posZ, velX, velY, velZ, playerId) {
    if (!this.bulletModel) return;

    const bullet = this.bulletModel.clone();
    bullet.scale.set(0.25, 0.25, 0.25);
    bullet.visible = true; // Ensure bullet is visible
    bullet.position.set(posX, posY, posZ);

    // Make bullet face the direction it's traveling
    const velocity = new THREE.Vector3(velX, velY, velZ);
    const targetPos = new THREE.Vector3(posX, posY, posZ).add(
      velocity.clone().normalize(),
    );
    bullet.lookAt(targetPos);

    this.scene.add(bullet);

    this.bullets.set(bulletId, {
      model: bullet,
      position: new THREE.Vector3(posX, posY, posZ),
      velocity: velocity,
      createdAt: performance.now(),
      playerId: playerId, // Track who fired the bullet
    });
  }

  // Update bullet positions
  updateBullets(deltaT) {
    for (const [bulletId, bullet] of this.bullets) {
      if (bullet.model) {
        // Simple linear movement
        bullet.position.addScaledVector(bullet.velocity, deltaT);
        bullet.model.position.copy(bullet.position);

        // Remove bullets that have traveled too far or exist too long
        const age = (performance.now() - bullet.createdAt) / 1000;
        if (age > 10) {
          // 10 second lifespan
          this.scene.remove(bullet.model);
          this.bullets.delete(bulletId);
        }
      }
    }
  }
}
