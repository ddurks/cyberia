/**
 * Snow puff particle system for visual effect when player moves
 * Creates white particle clouds that fade out
 */
import * as THREE from "three";

export class SnowPuffSystem {
  constructor(scene, groundObjects) {
    this.scene = scene;
    this.groundObjects = groundObjects;
    this.texture = this.createPuffTexture();

    this.pool = [];
    this.active = [];
    this.maxPuffs = 60;

    for (let i = 0; i < this.maxPuffs; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const puff = new THREE.Sprite(mat);
      puff.visible = false;
      scene.add(puff);
      this.pool.push(puff);
    }
  }

  createPuffTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  spawnPuff(position) {
    const puff = this.pool.pop();
    if (!puff) return;

    puff.visible = true;
    puff.position.copy(position);
    puff.scale.setScalar(0.4 + Math.random() * 0.4);
    puff.material.opacity = 1;
    puff.life = 1;
    this.active.push(puff);
  }

  update(delta = 0.016) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const puff = this.active[i];
      puff.life -= delta * 0.5;
      puff.material.opacity = puff.life;
      puff.position.y += delta * 0.2;

      if (puff.life <= 0) {
        puff.visible = false;
        puff.material.opacity = 0;
        this.active.splice(i, 1);
        this.pool.push(puff);
      }
    }
  }
}
