/**
 * Footprint system for player movement trails
 * Creates decal-like footprints on terrain that fade over time
 */
import * as THREE from "three";

export class FootprintSystem {
  constructor(scene, groundObjects, snowPuffSystem, raycaster, downVector) {
    this.scene = scene;
    this.groundObjects = groundObjects;
    this.footprints = [];
    this.lastFoot = "right";
    this.snowPuffSystem = snowPuffSystem;
    this.raycaster = raycaster;
    this.downVector = downVector;

    this.footprintTexture = this.createFootprintTexture();
    this.footprintTexture.needsUpdate = true;
    this.footprintTexture.generateMipmaps = false;
    this.footprintTexture.minFilter = THREE.LinearFilter;
    this.footprintTexture.magFilter = THREE.LinearFilter;

    this.footprintPool = [];
    this.maxFootprints = 100;

    for (let i = 0; i < this.maxFootprints; i++) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.6),
        new THREE.MeshBasicMaterial({
          map: this.footprintTexture,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.NormalBlending,
          side: THREE.DoubleSide,
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.footprintPool.push(mesh);
    }
  }

  createFootprintTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.1,
      size / 2,
      size / 2,
      size * 0.5,
    );
    gradient.addColorStop(0, "rgba(10, 20, 60, 0.3)"); // Darker blue center
    gradient.addColorStop(1, "rgba(10, 20, 60, 0)"); // Fade to transparent

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size, size, 0, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  addFootprint(playerPosition, playerDirection) {
    const lateralOffset = 0.15;
    const stepBack = 0.2;

    const perp = new THREE.Vector3(
      -playerDirection.z,
      0,
      playerDirection.x,
    ).normalize();
    const offset = perp
      .clone()
      .multiplyScalar(
        this.lastFoot === "right" ? lateralOffset : -lateralOffset,
      );
    const back = playerDirection.clone().multiplyScalar(-stepBack);

    const footprintPos = playerPosition.clone().add(offset).add(back);

    this.raycaster.set(
      footprintPos.clone().add(new THREE.Vector3(0, 1, 0)),
      this.downVector,
    );
    const intersects = this.raycaster.intersectObjects(
      this.groundObjects,
      true,
    );
    if (intersects.length === 0) return;

    const { point, face, object } = intersects[0];
    const normal = face.normal.clone().transformDirection(object.matrixWorld);

    const footprintMaterial = new THREE.MeshBasicMaterial({
      map: this.footprintTexture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    const mesh = this.footprintPool.pop();
    if (!mesh) return;

    mesh.material.opacity = 1;
    mesh.visible = true;

    // orient the footprint to match the ground normal (lays it flat on the ground)
    const up = new THREE.Vector3(0, 1, 0);
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    mesh.quaternion.copy(alignQuat);

    // rotate around the normal to face the movement direction
    const angle = Math.atan2(playerDirection.x, playerDirection.z);
    const normalAxis = normal.clone().normalize();
    const spinQuat = new THREE.Quaternion().setFromAxisAngle(normalAxis, angle);
    mesh.quaternion.premultiply(spinQuat);

    // small tilt around right axis in ground plane to lie footprint down
    const forwardDir = playerDirection
      .clone()
      .projectOnPlane(normal)
      .normalize();
    const rightDir = new THREE.Vector3()
      .crossVectors(normal, forwardDir)
      .normalize();

    // tilt the footprint by 90 degrees around the "right" axis to lay it flat
    const tiltQuat = new THREE.Quaternion().setFromAxisAngle(
      rightDir,
      Math.PI / 2,
    );

    mesh.quaternion.copy(alignQuat);
    mesh.quaternion.premultiply(spinQuat);
    mesh.quaternion.premultiply(tiltQuat);
    mesh.position.copy(point).add(normal.clone().multiplyScalar(0.1));

    this.footprints.push({ mesh, life: 1.0 });

    if (this.snowPuffSystem) {
      this.snowPuffSystem.spawnPuff(point, playerDirection);
    }

    this.lastFoot = this.lastFoot === "right" ? "left" : "right";
  }

  update(delta = 0.016) {
    // Fade footprints over time (life goes from 1 to 0)
    // With delta ~ 0.016 (60fps) and updateFreq=2, we get ~0.032 between updates
    // Multiplying by 2.0 makes footprints fade in ~4 seconds
    const fadeRate = 2.0;
    
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      const fp = this.footprints[i];
      fp.life -= delta * fadeRate;
      fp.mesh.material.opacity = fp.life;
      fp.mesh.material.needsUpdate = true;

      if (fp.life <= 0) {
        fp.mesh.visible = false;
        this.footprintPool.push(fp.mesh);
        this.footprints.splice(i, 1);
      }
    }
    if (this.snowPuffSystem) {
      this.snowPuffSystem.update(delta);
    }
  }
}
