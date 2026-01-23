/**
 * Wind system for environmental effects
 * Simulates varying wind direction and intensity
 */
import * as THREE from "three";

export class WindSystem {
  constructor() {
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 0.05 + Math.random() * 0.05;
    this.gustIntensity = 0.5;
    this.angleVariation = 0.005;
    this.speedVariation = 0.005;
    this.minSpeed = 0.02;
    this.maxSpeed = 0.5;
  }

  update() {
    this.angle += (Math.random() - 0.5) * this.angleVariation;

    this.speed += (Math.random() - 0.5) * this.speedVariation;
    this.speed = Math.max(this.minSpeed, Math.min(this.speed, this.maxSpeed));

    this.windVector = new THREE.Vector3(
      Math.cos(this.angle) * this.speed,
      0,
      Math.sin(this.angle) * this.speed,
    );
  }

  getWindForce() {
    return this.windVector;
  }
}
