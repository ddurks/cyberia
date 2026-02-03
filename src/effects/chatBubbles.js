/**
 * 3D Chat Bubble Renderer
 * Displays floating chat messages above characters using THREE.js Sprites
 */

import * as THREE from "three";

export class ChatBubbleRenderer {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.bubbles = new Map(); // playerId -> { sprite, text, createdAt, duration }
    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = 1024;
    this.tempCanvas.height = 512;
    this.bubbleDuration = 5000; // ms - how long to display message
    this.fadeOutDuration = 1000; // ms - fade out time before removal
    this.bubbleHeightOffset = 2.25; // units above player - increased for large messages
  }

  addChatBubble(playerId, playerName, text, playerPosition) {
    // Remove old bubble if exists
    if (this.bubbles.has(playerId)) {
      const old = this.bubbles.get(playerId);
      this.scene.remove(old.sprite);
    }

    // Create texture with text (measure dimensions first)
    const { texture, width, height } = this._createTextTexture(text);

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      sizeAttenuation: true,
      transparent: true,
    });

    // Create sprite with dynamic sizing based on text
    const sprite = new THREE.Sprite(material);
    // Use consistent scaling - don't resize based on content
    const scaleX = (width / 512) * 6;
    const scaleY = (height / 256) * 4;
    sprite.scale.set(scaleX, scaleY, 1);
    sprite.position.copy(playerPosition);
    sprite.position.y += this.bubbleHeightOffset;
    sprite.position.x += 0; // Center on player (already centered)

    this.scene.add(sprite);

    // Store bubble info
    const now = Date.now();
    this.bubbles.set(playerId, {
      sprite,
      texture,
      material,
      text,
      createdAt: now,
      playerPosition: playerPosition.clone(),
    });
  }

  _createTextTexture(text) {
    // Measure text first to determine canvas size
    const tempCtx = this.tempCanvas.getContext("2d");

    // Start with max font size, reduce if needed for multiple lines
    let fontSize = 48; // Reduced from 64px
    const maxWidth = 700;
    let lineHeight = fontSize + 12;
    let lines = [];
    let currentLine = "";

    // Text wrapping with initial font size
    tempCtx.font = `bold ${fontSize}px monospace`;
    const words = text.split(" ");
    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      const metrics = tempCtx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // If too many lines, reduce font size
    if (lines.length > 3) {
      fontSize = Math.max(24, 48 - (lines.length - 3) * 6);
      lineHeight = fontSize + 10;

      // Re-wrap with new font size
      lines = [];
      currentLine = "";
      tempCtx.font = `bold ${fontSize}px monospace`;
      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = tempCtx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    // Calculate required canvas size
    const padding = 32;
    const width = Math.min(700 + padding * 2, maxWidth + padding * 2);
    const height = Math.max(150, lines.length * lineHeight + padding * 2);

    // Create appropriately sized canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1024; // Larger canvas for bigger text
    canvas.height = 512; // Larger canvas
    const ctx = canvas.getContext("2d");

    // Clear canvas with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background bubble (only around text) - semi-transparent
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)"; // Much more transparent: 0.3 instead of 0.85
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 3;

    const actualWidth = Math.min(width - padding * 2, maxWidth);
    const actualHeight = lines.length * lineHeight + 20;
    const radius = 12;

    // Center the bubble on the canvas
    const x = (canvas.width - actualWidth) / 2;
    const y = (canvas.height - actualHeight) / 2;

    // Rounded rectangle background
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + actualWidth - radius, y);
    ctx.quadraticCurveTo(x + actualWidth, y, x + actualWidth, y + radius);
    ctx.lineTo(x + actualWidth, y + actualHeight - radius);
    ctx.quadraticCurveTo(
      x + actualWidth,
      y + actualHeight,
      x + actualWidth - radius,
      y + actualHeight,
    );
    ctx.lineTo(x + radius, y + actualHeight);
    ctx.quadraticCurveTo(x, y + actualHeight, x, y + actualHeight - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw chat text (no player name)
    ctx.fillStyle = "#00ff00";
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = "left";

    let currentY = y + (fontSize + 6);
    for (const line of lines) {
      ctx.fillText(line, x + 24, currentY);
      currentY += lineHeight;
    }

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Return fixed dimensions - canvas is always 1024x512
    // This prevents sprite scaling from distorting text
    return { texture, width: 512, height: 256 };
  }

  update(playerPositions) {
    const now = Date.now();
    const idsToRemove = [];

    for (const [playerId, bubble] of this.bubbles) {
      const age = now - bubble.createdAt;
      const totalDuration = this.bubbleDuration + this.fadeOutDuration;

      // Update sprite position to follow player
      if (playerPositions.has(playerId)) {
        const pos = playerPositions.get(playerId);
        bubble.sprite.position.copy(pos);
        bubble.sprite.position.y += this.bubbleHeightOffset; // Offset above player
      }

      // Fade out near end
      if (age > this.bubbleDuration) {
        const fadeProgress = (age - this.bubbleDuration) / this.fadeOutDuration;
        bubble.material.opacity = 1 - fadeProgress;
      }

      // Remove when expired
      if (age > totalDuration) {
        this.scene.remove(bubble.sprite);
        bubble.material.dispose();
        bubble.texture.dispose();
        idsToRemove.push(playerId);
      }
    }

    // Remove expired bubbles
    for (const playerId of idsToRemove) {
      this.bubbles.delete(playerId);
    }
  }

  clear() {
    for (const bubble of this.bubbles.values()) {
      this.scene.remove(bubble.sprite);
      bubble.material.dispose();
      bubble.texture.dispose();
    }
    this.bubbles.clear();
  }

  destroy() {
    this.clear();
    this.canvas = null;
  }
}
