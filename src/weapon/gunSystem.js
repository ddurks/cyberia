import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class GunSystem {
  constructor(scene, gLoader) {
    this.scene = scene;
    this.gLoader = gLoader;
    this.gunModel = null;
    this.bulletModel = null;
    this.activeGun = null;
    this.flashMesh = null;
    this.gunMixer = null;
    this.flashMixer = null;
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
      this.scene.remove(this.activeGun);
      if (this.gunMixer) this.gunMixer.stopAllAction();
    }
    if (this.flashMesh) {
      this.scene.remove(this.flashMesh);
      if (this.flashMixer) this.flashMixer.stopAllAction();
    }

    // Clone gun model
    this.activeGun = this.gunModel.clone();
    this.activeGun.scale.set(0.25, 0.25, 0.25); // Scale to match player

    // Set up gun animation mixer
    this.gunMixer = new THREE.AnimationMixer(this.activeGun);

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
    
    // Play idle animation if available
    const idleAction = this.gunAnimations.find(a => a.name === 'idle');
    if (idleAction && this.gunMixer) {
      this.gunMixer.clipAction(idleAction).play();
    }

    // Find and extract flash mesh from gun
    this.flashMesh = null;
    this.activeGun.traverse((child) => {
      if (child.name.toLowerCase().includes('flash')) {
        this.flashMesh = child;
      }
    });

    // Set up flash mixer if flash mesh exists
    if (this.flashMesh) {
      this.flashMixer = new THREE.AnimationMixer(this.flashMesh);
      this.flashMesh.scale.set(0.01, 0.01, 0.01); // Small by default
    }

    this.gunSpawned = true;
    this.gunCooldownTimer = 10; // Reset 10 second timer
  }

  removeGun() {
    if (this.gunMixer) {
      this.gunMixer.stopAllAction();
      this.gunMixer = null;
    }
    if (this.flashMixer) {
      this.flashMixer.stopAllAction();
      this.flashMixer = null;
    }
    if (this.activeGun) {
      this.scene.remove(this.activeGun);
      this.activeGun = null;
    }
    this.flashMesh = null;
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

  playShoot() {
    if (!this.gunMixer || !this.gunAnimations || this.gunAnimations.length === 0) return;

    // Stop idle animation and play shoot animation
    this.gunMixer.stopAllAction();
    const shootClip = this.gunAnimations.find(a => a.name === 'shoot');
    if (shootClip) {
      const shootAction = this.gunMixer.clipAction(shootClip);
      shootAction.clampWhenFinished = true; // Keep animation at last frame
      shootAction.loop = THREE.LoopOnce; // Play once
      shootAction.play();
    }

    // Play flash animation synchronized with shoot
    if (this.flashMixer && this.flashMesh) {
      this.flashMesh.visible = true;
      this.flashMixer.stopAllAction();
      const flashClip = this.gunAnimations.find(a => a.name === 'flash');
      if (flashClip) {
        const flashAction = this.flashMixer.clipAction(flashClip);
        flashAction.clampWhenFinished = true;
        flashAction.loop = THREE.LoopOnce;
        flashAction.play();
      }
    }

    // Reset to idle after shoot animation completes
    if (shootClip) {
      const shootDuration = shootClip.duration;
      setTimeout(() => {
        if (this.gunMixer && this.activeGun) {
          this.gunMixer.stopAllAction();
          const idleClip = this.gunAnimations.find(a => a.name === 'idle');
          if (idleClip) {
            this.gunMixer.clipAction(idleClip).play();
          }
        }
        if (this.flashMesh) {
          this.flashMesh.visible = false;
        }
      }, shootDuration * 1000); // Convert to milliseconds
    }
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
    // Update animation mixers
    if (this.gunMixer) {
      this.gunMixer.update(deltaT);
    }
    if (this.flashMixer) {
      this.flashMixer.update(deltaT);
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
