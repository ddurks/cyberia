// Multiplayer integration layer
// Manages network players and syncs state with server

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LerpSystem } from "../utils/lerpSystem.js";
import { NetworkDebug } from "../utils/networkDebug.js";
import { PhysicsDebug } from "../utils/physicsDebug.js";
import { PlayerGun } from "../player/playerGun.js";

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
    this.mobs = new Map(); // mobId -> mob entity
    this.physicsDebug = null; // Physics debug helper
  }

  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
    // Initialize physics debug if not already done
    if (!this.physicsDebug) {
      this.physicsDebug = new PhysicsDebug(this.scene, null);
      window.physicsDebug.instance = this.physicsDebug;
    }
  }

  // Handle snapshot from server
  handleSnapshot(snapshot) {
    if (!snapshot) return;

    // Handle local player state from server (server sends it in 'you' field)
    if (snapshot.you && snapshot.you.id === this.localPlayerId) {
      if (this.onServerState) {
        this.onServerState(snapshot.you);
      }
    }

    // Update other players from server
    if (snapshot.p) {
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

    // Update mobs from server
    if (snapshot.m) {
      const currentMobIds = new Set();

      for (const mobData of snapshot.m) {
        currentMobIds.add(mobData.id);

        const existingMob = this.mobs.get(mobData.id);
        if (existingMob && existingMob.updateFromNetwork) {
          // Update existing mob
          existingMob.updateFromNetwork(mobData);
        }
      }

      // Remove mobs that no longer exist on server
      for (const [mobId, mob] of this.mobs) {
        if (!currentMobIds.has(mobId) && mob.destroy) {
          mob.destroy();
          this.mobs.delete(mobId);
        }
      }
    }
  }

  // Create new network player
  _createNetworkPlayer(playerData) {
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

      // Add physics debug sphere (0.35 radius = collision sphere)
      if (this.physicsDebug && this.physicsDebug.enabled) {
        const pos = new THREE.Vector3(playerData.x, playerData.y, playerData.z);
        this.physicsDebug.addSphere(
          `player_${playerData.id}`,
          pos,
          0.35,
          0xff0000,
        );
      }

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

    // Update physics debug sphere position
    if (this.physicsDebug && this.physicsDebug.enabled) {
      this.physicsDebug.updateSphere(
        `player_${playerData.id}`,
        new THREE.Vector3(playerData.x, playerData.y, playerData.z),
      );
    }

    // Update gun position if player has an active gun
    if (this.playerGuns.has(playerData.id)) {
      this.updatePlayerGunPosition(playerData.id, player.model);
    }
  }

  // Remove network player
  _removeNetworkPlayer(playerId) {
    const player = this.networkPlayers.get(playerId);
    if (player) {
      this.scene.remove(player.model);
      if (player.nameTag) {
        this.scene.remove(player.nameTag);
      }
      if (this.physicsDebug) {
        this.physicsDebug.removeSphere(`player_${playerId}`);
      }
      this.networkPlayers.delete(playerId);
    }
  }

  // Update all network players (call in animation loop)
  update(delta) {
    for (const [playerId, player] of this.networkPlayers) {
      if (!player.model) continue;

      // Skip position updates for frozen players (bullet hit animation)
      if (player.isFrozen) {
        // Still update animations though
        if (player.mixer) {
          player.mixer.update(delta);
        }
        continue;
      }

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
        const lerpFactor = LerpSystem.PRESETS.SMOOTH; // 0.15
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

    // Clean up mobs
    for (const [mobId, mob] of this.mobs) {
      if (mob && mob.destroy) {
        mob.destroy();
      }
    }
    this.mobs.clear();
  }

  // Register cyber mouse entity
  registerCyberMouse(mouseId, mouseEntity) {
    this.mobs.set(mouseId, mouseEntity);
  }

  // Update cyber mouse from network state
  updateCyberMouseFromNetwork(mouseId, data) {
    const mouse = this.mobs.get(mouseId);
    if (mouse?.updateFromNetwork) {
      mouse.updateFromNetwork(data);
    }
  }

  // Get cyber mouse state for network transmission
  getCyberMouseState(mouseId) {
    const mouse = this.mobs.get(mouseId);
    if (mouse?.getState) {
      return mouse.getState();
    }
    return null;
  }

  // Update all mobs
  updateMobs(deltaT) {
    for (const [mobId, mob] of this.mobs) {
      if (mob?.update) {
        mob.update(deltaT);
      }
    }
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
          this.gunAnimations = gltf.animations || [];
          resolve(this.gunModel);
        });
      }
    });
  }

  // Spawn gun for a networked player when they fire
  spawnGunForPlayer(playerId, playerModel) {
    if (!this.gunModel || !playerModel) return;
    if (this.playerGuns.has(playerId)) return; // Don't respawn if exists

    const playerGun = new PlayerGun(
      this.gunModel,
      this.gunAnimations,
      this.scene,
    );
    playerGun.spawn(playerModel);
    this.playerGuns.set(playerId, playerGun);
  }

  // Update gun position for a networked player
  updatePlayerGunPosition(playerId, playerModel) {
    if (!this.playerGuns.has(playerId)) return;
    const gunData = this.playerGuns.get(playerId);
    gunData.updatePosition(playerModel);
  }

  // Update guns: remove expired ones
  updatePlayerGuns(deltaT) {
    for (const [playerId, gunData] of this.playerGuns) {
      if (gunData.isExpired()) {
        gunData.destroy();
        this.playerGuns.delete(playerId);
      } else {
        gunData.update(deltaT);
      }
    }
  }

  // Remove gun for a player
  removePlayerGun(playerId) {
    if (this.playerGuns.has(playerId)) {
      const gunData = this.playerGuns.get(playerId);
      gunData.destroy();
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

    // Play rip animation on hit player
    const player = this.networkPlayers.get(targetPlayerId);
    if (player && player.mixer && player.animationsMap) {
      const ripAction = player.animationsMap.get("rip");
      if (ripAction) {
        // Stop all other animations
        player.animationsMap.forEach((action) => {
          action.stop();
        });

        // Play rip once and clamp on last frame
        ripAction.reset();
        ripAction.clampWhenFinished = true;
        ripAction.loop = THREE.LoopOnce;
        ripAction.play();

        // Mark player as frozen (stop updating their position from server)
        player.isFrozen = true;
        player.frozenUntilTime = Date.now() + 5000;

        // After 5 seconds, unfreeze and return to idle
        setTimeout(() => {
          if (!player.isFrozen) return; // Safety check

          ripAction.stop();
          player.isFrozen = false;

          // Return to idle
          const idleAction = player.animationsMap.get("idle");
          if (idleAction) {
            idleAction.reset();
            idleAction.play();
            player.currentAnimation = "idle";
          }
        }, 5000);
      }
    }
  }

  playDanceAnimation(playerId) {
    const player = this.networkPlayers.get(playerId);
    if (!player || !player.mixer) return;

    const danceAction = player.animationsMap?.get("dance");
    if (!danceAction) return;

    danceAction.reset();
    danceAction.setLoop(THREE.LoopRepeat, 3);
    danceAction.clampWhenFinished = true;

    const onDanceFinish = () => {
      const idleAction = player.animationsMap?.get("idle");
      if (idleAction) {
        idleAction.reset();
        idleAction.play();
      }
      player.mixer.removeEventListener("finished", onDanceFinish);
    };

    player.mixer.addEventListener("finished", onDanceFinish);
    danceAction.play();
  }

  // Trigger shoot animation for networked player's gun
  playGunShootAnimation(playerId) {
    if (!this.playerGuns.has(playerId)) return;
    const gunData = this.playerGuns.get(playerId);
    gunData.playShoot();
  }

  // Create visual bullet on client (for remote player bullets)
  spawnBullet(bulletId, posX, posY, posZ, velX, velY, velZ, playerId) {
    if (!this.bulletModel) return;

    // Trigger shoot animation for the player who fired
    if (playerId) {
      this.playGunShootAnimation(playerId);
    }

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
