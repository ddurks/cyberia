import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PlayerGun } from "../player/playerGun.js";

export class GunSystem {
  constructor(scene, gLoader) {
    this.scene = scene;
    this.gLoader = gLoader;
    this.gunModel = null;
    this.gunAnimations = null;
    this.bulletModel = null;
    this.activeGun = null; // PlayerGun instance
    this.gunSpawned = false;
    this.gunCooldownTimer = 0;
  }

  loadAssets() {
    return new Promise((resolve) => {
      let loaded = 0;
      const checkComplete = () => {
        loaded++;
        if (loaded === 2) resolve();
      };

      // Load gun model
      this.gLoader.load("./assets/gun.glb", (gltf) => {
        this.gunModel = gltf.scene;
        this.gunAnimations = gltf.animations; // Store animations
        checkComplete();
      });

      // Load bullet model
      this.gLoader.load("./assets/bullet.glb", (gltf) => {
        this.bulletModel = gltf.scene;
        checkComplete();
      });
    });
  }

  spawnGun(playerModel, playerPosition, playerRotation) {
    if (this.activeGun) {
      this.activeGun.destroy();
    }

    // Create PlayerGun with custom offsets for local player (right hand side)
    const localPlayerOffsets = { right: 0.3, forward: 0.5, up: 0.4 };
    this.activeGun = new PlayerGun(this.gunModel, this.gunAnimations, this.scene, localPlayerOffsets);
    this.activeGun.spawn(playerModel);
    this.gunSpawned = true;
    this.gunCooldownTimer = 10;
  }

  removeGun() {
    if (this.activeGun) {
      this.activeGun.destroy();
      this.activeGun = null;
    }
    this.gunSpawned = false;
  }

  shootBullet(playerPosition, playerRotation, playerModel) {
    if (!this.bulletModel || !this.activeGun) return null;

    // Play shoot animation
    this.playShoot();

    // Clone bullet model (for data only, don't add to scene - server will broadcast it)
    const bullet = this.bulletModel.clone();
    bullet.scale.set(0.25, 0.25, 0.25);
    bullet.visible = true; // Ensure bullet is visible

    // Start from gun position
    const gunPos = this.activeGun.model.position.clone();
    bullet.position.copy(gunPos);

    // Calculate forward direction from player's quaternion
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(playerModel.quaternion);

    // Make bullet face the direction it's traveling
    bullet.lookAt(bullet.position.clone().add(forward));

    // Velocity: 25 units/second in forward direction (half speed)
    const velocity = forward.multiplyScalar(25);

    // DON'T add to scene here - let server broadcast it back to all clients
    // this.scene.add(bullet);

    return {
      model: bullet,
      position: bullet.position.clone(),
      velocity: velocity,
    };
  }

  playShoot() {
    if (this.activeGun) {
      this.activeGun.playShoot();
    }
  }

  updateGunPosition(playerModel, playerPosition, playerRotation) {
    if (this.activeGun) {
      this.activeGun.updatePosition(playerModel);
    }
  }
  // Update gun cooldown timer and auto-remove if expired
  update(deltaT) {
    if (this.activeGun) {
      this.activeGun.update(deltaT);
    }

    if (this.gunSpawned) {
      this.gunCooldownTimer -= deltaT;
      if (this.gunCooldownTimer <= 0) {
        this.removeGun();
      }
    }
  }

  resetCooldown() {
    this.gunCooldownTimer = 10;
  }

  destroy() {
    this.removeGun();
    this.gunModel = null;
    this.bulletModel = null;
  }
}
