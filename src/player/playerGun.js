import * as THREE from "three";
import { PlayerItem } from "./playerItem.js";

/**
 * Gun-specific implementation of PlayerItem
 * Handles gun animations (idle, shoot, flash) and flash mesh effects
 * Shows how to extend PlayerItem for custom item types
 */
export class PlayerGun extends PlayerItem {
  constructor(gunModel, gunAnimations, scene, positionOffsets = null) {
    super(gunModel, gunAnimations, scene, positionOffsets);
    this.shootTimeout = null;
  }

  /**
   * Cache gun-specific animation clips
   */
  _cacheAnimationClips() {
    this.shootClip = this.itemAnimations.find(clip => clip.name === 'shoot');
    this.idleClip = this.itemAnimations.find(clip => clip.name === 'idle');
    this.flashClip = this.itemAnimations.find(clip => clip.name === 'flash');
  }

  /**
   * Find the flash mesh for muzzle flash effects
   */
  _initializeItem() {
    this.flashMesh = null;
    this.model?.traverse((child) => {
      if (child.name.toLowerCase().includes('flash')) {
        this.flashMesh = child;
        this.flashMesh.scale.set(0.01, 0.01, 0.01);
      }
    });
  }

  /**
   * Play shoot animation with synchronized flash effect
   */
  playShoot() {
    if (!this.mixer || !this.shootClip) return;

    this.mixer.stopAllAction();
    this._playAction('shoot');

    // Play flash animation synchronized
    if (this.flashClip && this.flashMesh) {
      this.flashMesh.visible = true;
      this._playAction('flash');
    }

    this.mixer.update(0);

    // Return to idle after shoot
    clearTimeout(this.shootTimeout);
    this.shootTimeout = setTimeout(() => {
      if (this.mixer && this.idleClip) {
        this.mixer.stopAllAction();
        this._playAction('idle');
      }
    }, this.shootClip.duration * 1000);
  }

  /**
   * Override destroy to handle gun-specific cleanup
   */
  destroy() {
    clearTimeout(this.shootTimeout);
    super.destroy();
  }
}
