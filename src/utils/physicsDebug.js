import * as THREE from "three";

export class PhysicsDebug {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;
    this.debugSpheres = new Map(); // entityId -> sphere mesh
    this.debugLabels = new Map(); // entityId -> label canvas texture
  }

  enable() {
    this.enabled = true;
    // Show all existing spheres
    for (const sphere of this.debugSpheres.values()) {
      sphere.visible = true;
    }
    console.log('%c🔍 Physics debug enabled', 'color: cyan; font-weight: bold');
  }

  disable() {
    this.enabled = false;
    // Hide all spheres instead of removing
    for (const sphere of this.debugSpheres.values()) {
      sphere.visible = false;
    }
    console.log('%c🔍 Physics debug disabled', 'color: cyan');
  }

  clear() {
    for (const sphere of this.debugSpheres.values()) {
      this.scene.remove(sphere);
    }
    this.debugSpheres.clear();
    this.debugLabels.clear();
  }

  addSphere(id, position, radius, color = 0xff0000) {
    // Always create the sphere, but visibility is controlled by enabled flag
    
    // Remove old sphere if exists
    if (this.debugSpheres.has(id)) {
      const oldSphere = this.debugSpheres.get(id);
      this.scene.remove(oldSphere);
    }

    // Create wireframe sphere
    const geometry = new THREE.SphereGeometry(radius, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    sphere.visible = this.enabled; // Visibility matches enabled state
    this.scene.add(sphere);
    this.debugSpheres.set(id, sphere);
  }

  updateSphere(id, position) {
    if (!this.debugSpheres.has(id)) return;
    this.debugSpheres.get(id).position.copy(position);
  }

  removeSphere(id) {
    if (!this.debugSpheres.has(id)) return;
    const sphere = this.debugSpheres.get(id);
    this.scene.remove(sphere);
    this.debugSpheres.delete(id);
  }

  // Static method to quickly enable/disable from console
  static globalDebugInstance = null;
}

// Export a global instance for console access
if (typeof window !== 'undefined') {
  window.physicsDebug = {
    instance: null,
    enable() {
      if (this.instance) {
        this.instance.enable();
      }
    },
    disable() {
      if (this.instance) {
        this.instance.disable();
      }
    },
    toggle() {
      if (this.instance) {
        if (this.instance.enabled) {
          this.instance.disable();
        } else {
          this.instance.enable();
        }
      }
    },
  };
}
