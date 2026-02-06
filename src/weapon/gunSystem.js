import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class GunSystem {
  constructor(scene, gLoader) {
    this.scene = scene;
    this.gLoader = gLoader;
    this.gunModel = null;
    this.bulletModel = null;
    this.activeGun = null;
    this.isAiming = false;
    this.gunSpawned = false;
    this.gunCooldownTimer = 0; // Timer for gun auto-disappear after 10 seconds of inactivity
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
      this.scene.remove(this.activeGun);
    }

    // Clone gun model
    this.activeGun = this.gunModel.clone();
    this.activeGun.scale.set(0.25, 0.25, 0.25); // Scale to match player

    // Calculate gun position in world space using player's local axes
    // Player's local forward is -Z, right is +X, up is +Y
    const right = new THREE.Vector3(1, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1);
    const up = new THREE.Vector3(0, 1, 0);

    // Apply player rotation to local axes
    right.applyQuaternion(playerModel.quaternion);
    forward.applyQuaternion(playerModel.quaternion);
    up.applyQuaternion(playerModel.quaternion);

    // Position: right hand, slightly forward, raised up
    const gunPos = playerPosition.clone();
    gunPos.addScaledVector(right, 0.3);
    gunPos.addScaledVector(forward, 0.5);
    gunPos.addScaledVector(up, 0.4);

    this.activeGun.position.copy(gunPos);

    // Create a quaternion from the player's rotation and then rotate 180 degrees around local Y
    const quat = new THREE.Quaternion();
    quat.setFromEuler(playerModel.rotation);
    const yaw180 = new THREE.Quaternion();
    yaw180.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    quat.multiplyQuaternions(quat, yaw180);
    this.activeGun.quaternion.copy(quat);

    this.scene.add(this.activeGun);
    this.gunSpawned = true;
    this.gunCooldownTimer = 10; // Reset 10 second timer
  }

  removeGun() {
    if (this.activeGun) {
      this.scene.remove(this.activeGun);
      this.activeGun = null;
    }
    this.gunSpawned = false;
  }

  shootBullet(playerPosition, playerRotation, playerModel) {
    if (!this.bulletModel || !this.activeGun) return null;

    // Clone bullet model (for data only, don't add to scene - server will broadcast it)
    const bullet = this.bulletModel.clone();
    bullet.scale.set(0.25, 0.25, 0.25);
    bullet.visible = true; // Ensure bullet is visible

    // Start from gun position
    const gunPos = this.activeGun.position.clone();
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

  updateGunPosition(playerModel, playerPosition, playerRotation) {
    if (this.activeGun) {
      // Calculate gun position in world space using player's local axes
      // Player's local forward is -Z, right is +X, up is +Y
      const right = new THREE.Vector3(1, 0, 0);
      const forward = new THREE.Vector3(0, 0, -1);
      const up = new THREE.Vector3(0, 1, 0);

      // Apply player rotation to local axes
      right.applyQuaternion(playerModel.quaternion);
      forward.applyQuaternion(playerModel.quaternion);
      up.applyQuaternion(playerModel.quaternion);

      // Position: right hand, slightly forward, raised up
      const gunPos = playerPosition.clone();
      gunPos.addScaledVector(right, 0.3);
      gunPos.addScaledVector(forward, 0.5);
      gunPos.addScaledVector(up, 0.4);

      this.activeGun.position.copy(gunPos);

      // Create a quaternion from the player's rotation and then rotate 180 degrees around local Y
      const quat = new THREE.Quaternion();
      quat.setFromEuler(playerModel.rotation);
      const yaw180 = new THREE.Quaternion();
      yaw180.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      quat.multiplyQuaternions(quat, yaw180);
      this.activeGun.quaternion.copy(quat);
    }
  }

  // Update gun cooldown timer and auto-remove if expired
  update(deltaT) {
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
