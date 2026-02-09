import * as THREE from "three";

/**
 * Base class for any item a player can hold (gun, sword, shield, etc.)
 * Handles spawning, positioning, animations, and cleanup
 * 
 * Subclasses should override specific behaviors as needed
 */
export class PlayerItem {
  constructor(itemModel, itemAnimations, scene, positionOffsets = null) {
    this.itemModel = itemModel;
    this.itemAnimations = itemAnimations || [];
    this.scene = scene;
    
    // Position offsets relative to player
    // Can be customized per item type
    this.offsets = positionOffsets || {
      right: -0.3,
      forward: -0.5,
      up: 0.4
    };

    this.model = null;
    this.mixer = null;
    this.spawnTime = null;
    this.animationTimeout = null;
  }

  /**
   * Spawn item for a player at their position/rotation
   */
  spawn(playerModel) {
    if (!this.itemModel || !playerModel) return;

    // Clone item model
    this.model = this.itemModel.clone();
    this.model.scale.set(0.25, 0.25, 0.25);

    // Position item relative to player
    this._positionItem(playerModel);

    // Add to scene before creating mixer
    this.scene.add(this.model);

    // Set up animation mixer
    this.mixer = new THREE.AnimationMixer(this.model);

    // Store animation clips
    this._cacheAnimationClips();

    // Play default animation (usually idle)
    this._playDefaultAnimation();

    // Hook for subclasses to initialize item-specific properties
    this._initializeItem();

    this.spawnTime = performance.now();
  }

  /**
   * Cache animation clips - override in subclasses
   */
  _cacheAnimationClips() {}

  /**
   * Initialize item-specific properties - override in subclasses
   */
  _initializeItem() {}

  /**
   * Play the default/idle animation
   */
  _playDefaultAnimation() {
    this._playAction('idle');
  }

  /**
   * Helper to play animation action with standard setup
   */
  _playAction(clipName) {
    const clip = this.itemAnimations.find(c => c.name === clipName);
    if (!clip || !this.mixer) return;
    const action = this.mixer.clipAction(clip);
    action.clampWhenFinished = true;
    action.loop = THREE.LoopOnce;
    action.reset();
    action.play();
    return action;
  }

  /**
   * Position item relative to player's model
   */
  _positionItem(playerModel) {
    // Calculate position relative to player
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerModel.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerModel.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(playerModel.quaternion);

    this.model.position.copy(playerModel.position)
      .addScaledVector(right, this.offsets.right)
      .addScaledVector(forward, this.offsets.forward)
      .addScaledVector(up, this.offsets.up);

    // Rotate to face forward (flip for right-side positioning)
    const quat = new THREE.Quaternion().setFromEuler(playerModel.rotation);
    if (this.offsets.right > 0) {
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      quat.multiplyQuaternions(quat, flip);
    }
    this.model.quaternion.copy(quat);
  }

  /**
   * Update item position to follow player
   */
  updatePosition(playerModel) {
    if (!this.model) return;
    this._positionItem(playerModel);
  }

  /**
   * Play a named animation with optional auto-return to idle
   */
  playAnimation(animationName, duration = null) {
    if (!this.mixer) return;

    this.mixer.stopAllAction();
    const action = this._playAction(animationName);
    this.mixer.update(0);

    if (duration) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = setTimeout(() => this._playDefaultAnimation(), duration * 1000);
    }

    return action;
  }

  /**
   * Update mixer (for animation playback in render loop)
   */
  update(deltaT) {
    if (this.mixer) {
      this.mixer.update(deltaT);
    }
  }

  /**
   * Remove item from scene and clean up
   */
  destroy() {
    clearTimeout(this.animationTimeout);
    if (this.model) this.scene.remove(this.model);
    this.mixer?.stopAllAction();
    this.model = null;
    this.mixer = null;
  }

  /**
   * Check if item has expired (timeout-based removal)
   */
  isExpired(timeoutSeconds = 10) {
    const elapsed = performance.now() - this.spawnTime;
    return elapsed > timeoutSeconds * 1000;
  }
}
