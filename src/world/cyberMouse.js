import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import { LerpSystem } from "../utils/lerpSystem.js";

export class CyberMouse {
  constructor(scene, gLoader, world, raycaster = null, terrainPlanes = null) {
    this.scene = scene;
    this.gLoader = gLoader;
    this.world = world;
    this.raycaster = raycaster;
    this.terrainPlanes = terrainPlanes || [];
    this.downVector = new THREE.Vector3(0, -1, 0);

    this.model = null;
    this.body = null;
    this.mixer = null;
    this.animations = {};
    this.position = new THREE.Vector3(0, 0, 0);
    this.isAlive = true;
    this.health = 100;

    // Animation state
    this.currentAnimation = "idle";
    this.isMoving = false;
    this.isDying = false;

    // AI/Movement
    this.moveTimer = 0;
    this.moveDuration = 0;
    this.moveDirection = new THREE.Vector3(0, 0, 0);
    this.moveSpeed = 1.5;
    this.updateAIInterval = 3000;
    this.lastAIUpdate = 0;

    // Interpolation for network movement
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.interpolationLerpFactor = 0.15;
  }

  async loadAssets() {
    return new Promise((resolve) => {
      this.gLoader.load("./assets/cybermouse.glb", (gltf) => {
        this.model = gltf.scene;

        // Extract animations
        const animationMap = {};
        if (gltf.animations?.length > 0) {
          for (const clip of gltf.animations) {
            animationMap[clip.name] = clip;
          }
        }
        this.animations = animationMap;

        // Setup mixer and initial animation
        this.mixer = new THREE.AnimationMixer(this.model);

        // Configure model
        this.model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        if (this.animations["idle"]) {
          this.mixer.clipAction(this.animations["idle"]).play();
        }

        resolve();
      });
    });
  }

  spawn(position) {
    if (!this.model) return;

    this.position.copy(position);
    this.targetPosition.copy(position);
    this.model.position.copy(position);
    this.model.scale.set(0.35, 0.35, 0.35);
    this.model.visible = true;
    this.scene.add(this.model);

    this.lastAIUpdate = Date.now();
    this._updateAI();
  }

  update(deltaT) {
    if (!this.model || !this.mixer) return;

    this.mixer.update(deltaT);

    // Position comes from network updates, not physics
    // Just interpolate toward the target position from server

    if (!this.isDying) {
      // Update AI periodically
      const now = Date.now();
      if (now - this.lastAIUpdate > this.updateAIInterval) {
        this.lastAIUpdate = now;
        this._updateAI();
      }

      // Movement is handled by server, just update move timer for animation state
      if (this.isMoving) {
        this.moveTimer += deltaT;
        if (this.moveTimer >= this.moveDuration) {
          this.isMoving = false;
          this.moveTimer = 0;
        }
      }
    }

    // Interpolation toward server position
    if (this.isMoving || this.isDying) {
      // While moving: move toward server position (use shorter lerp for responsiveness)
      if (!LerpSystem.isAtTarget(this.position, this.targetPosition)) {
        LerpSystem.lerpVector3(this.position, this.targetPosition, 0.3);
      }
    } else {
      // While idle: smooth interpolation toward server position for correction
      if (!LerpSystem.isAtTarget(this.position, this.targetPosition)) {
        LerpSystem.lerpVector3Horizontal(
          this.position,
          this.targetPosition,
          this.interpolationLerpFactor,
        );
      }
    }

    // Clamp to terrain height
    if (this.raycaster && this.terrainPlanes?.length) {
      const rayOrigin = this.position.clone();
      rayOrigin.y = 100;
      this.raycaster.set(rayOrigin, this.downVector);

      for (const plane of this.terrainPlanes) {
        const intersects = this.raycaster.intersectObject(plane, true);
        if (intersects.length > 0) {
          this.position.y = Math.max(this.position.y, intersects[0].point.y);
          break;
        }
      }
    }

    this.model.position.copy(this.position);

    if (this.isMoving && this.moveDirection.length() > 0) {
      const angle = Math.atan2(this.moveDirection.x, this.moveDirection.z);
      this.model.quaternion.slerp(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          angle,
        ),
        0.15,
      );
    }

    this._updateAnimationState();
  }

  _updateAI() {
    if (!this.isAlive) return;

    // 70% move, 30% idle
    if (Math.random() < 0.7) {
      const angle = Math.random() * Math.PI * 2;
      this.moveDirection.set(Math.cos(angle), 0, Math.sin(angle));
      this.moveDuration = 1 + Math.random() * 2;
      this.moveTimer = 0;
      this.isMoving = true;
    } else {
      this.isMoving = false;
    }
  }

  _updateAnimationState() {
    const targetAnimation = this.isMoving ? "hop" : "idle";
    if (targetAnimation !== this.currentAnimation) {
      this._playAnimation(targetAnimation);
    }
  }

  _playAnimation(animationName) {
    if (
      !this.animations[animationName] ||
      animationName === this.currentAnimation
    )
      return;

    this.mixer.stopAllAction();
    this.mixer.clipAction(this.animations[animationName]).play();
    this.currentAnimation = animationName;
  }

  die() {
    if (!this.isAlive || this.isDying) return;

    this.isAlive = false;
    this.isDying = true;
    this.isMoving = false;

    if (this.animations["squish"]) {
      this._playAnimation("squish");
    }

    setTimeout(() => {
      if (this.model?.parent) {
        this.scene.remove(this.model);
      }
    }, 1500);
  }

  updateFromNetwork(data) {
    this.targetPosition.set(data.x, data.y, data.z);
    this.isMoving = data.isMoving || false;

    if (data.isAlive === false && this.isAlive) {
      this.die();
    }

    if (data.animation && data.animation !== this.currentAnimation) {
      this._playAnimation(data.animation);
    }
  }

  getState() {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      isMoving: this.isMoving,
      isAlive: this.isAlive,
      health: this.health,
      animation: this.currentAnimation,
    };
  }

  destroy() {
    if (this.model?.parent) {
      this.scene.remove(this.model);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }
}
