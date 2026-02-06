import * as THREE from "three";

/**
 * Off-screen indicator arrows that point to players outside the viewport
 */
export class OffScreenIndicators {
  constructor(camera, containerElement, localPlayerId = null) {
    this.camera = camera;
    this.container = containerElement;
    this.localPlayerId = localPlayerId;
    this.players = new Map(); // Map of playerId -> player data
    this.arrows = new Map(); // Map of playerId -> arrow DOM element
    this.arrowSize = 40;
    this.padding = 20; // Distance from edge

    // Create container for arrows
    this.arrowContainer = document.createElement('div');
    this.arrowContainer.style.position = 'absolute';
    this.arrowContainer.style.top = '0';
    this.arrowContainer.style.left = '0';
    this.arrowContainer.style.width = '100%';
    this.arrowContainer.style.height = '100%';
    this.arrowContainer.style.pointerEvents = 'none';
    this.arrowContainer.style.overflow = 'hidden';
    this.container.appendChild(this.arrowContainer);
  }

  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }

  updatePlayers(playersData) {
    this.players = playersData;
  }

  update(localPlayerPos) {
    const viewportWidth = this.container.clientWidth;
    const viewportHeight = this.container.clientHeight;

    // Get camera direction
    const cameraDir = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDir);

    // Track which players should have arrows
    const visibleArrows = new Set();

    // Update each player's arrow (except local player)
    this.players.forEach((player, playerId) => {
      // Skip local player - never show arrow for self
      if (playerId === this.localPlayerId) return;
      if (!player.position) return;

      // Direction to player
      const dirToPlayer = new THREE.Vector3()
        .subVectors(player.position, localPlayerPos)
        .normalize();

      // Check if player is behind camera or very close
      const dotProduct = dirToPlayer.dot(cameraDir);
      const distance = localPlayerPos.distanceTo(player.position);

      // Only show arrow if player is behind camera or > 50 units away
      if (dotProduct < 0.8 || distance > 50) {
        this._showArrow(playerId, player, dirToPlayer, viewportWidth, viewportHeight);
        visibleArrows.add(playerId);
      } else {
        this._hideArrow(playerId);
      }
    });

    // Clean up arrows for players that are no longer visible or removed
    for (const playerId of this.arrows.keys()) {
      if (!visibleArrows.has(playerId)) {
        this._hideArrow(playerId);
      }
    }
  }

  _showArrow(playerId, player, direction, viewportWidth, viewportHeight) {
    let arrow = this.arrows.get(playerId);

    if (!arrow) {
      // Create SVG arrow element instead of emoji
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 40 40');
      svg.setAttribute('width', this.arrowSize);
      svg.setAttribute('height', this.arrowSize);
      svg.style.position = 'absolute';
      svg.style.overflow = 'visible';
      
      // Create triangle pointing up
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '20,5 35,35 5,35');
      polygon.setAttribute('fill', this._colorToCSS(player.color || { r: 255, g: 255, b: 255 }));
      polygon.setAttribute('stroke', 'rgba(255, 255, 255, 0.8)');
      polygon.setAttribute('stroke-width', '1');
      svg.appendChild(polygon);
      
      this.arrowContainer.appendChild(svg);
      this.arrows.set(playerId, svg);
      arrow = svg;
    }

    // Update color
    const polygon = arrow.querySelector('polygon');
    if (polygon) {
      polygon.setAttribute('fill', this._colorToCSS(player.color || { r: 255, g: 255, b: 255 }));
    }

    // Calculate angle
    const angle = Math.atan2(direction.z, direction.x) * (180 / Math.PI);

    // Project direction to screen edge
    const screenCenter = { x: viewportWidth / 2, y: viewportHeight / 2 };
    const maxDistance = Math.min(screenCenter.x, screenCenter.y) - this.padding;

    // Calculate screen position
    const screenX = screenCenter.x + Math.cos((angle * Math.PI) / 180) * maxDistance;
    const screenY = screenCenter.y + Math.sin((angle * Math.PI) / 180) * maxDistance;

    // Clamp to viewport edges
    const clampedX = Math.max(this.padding, Math.min(viewportWidth - this.arrowSize - this.padding, screenX - this.arrowSize / 2));
    const clampedY = Math.max(this.padding, Math.min(viewportHeight - this.arrowSize - this.padding, screenY - this.arrowSize / 2));

    arrow.style.left = clampedX + 'px';
    arrow.style.top = clampedY + 'px';
    arrow.style.transform = `rotate(${angle}deg)`;
    arrow.style.opacity = '1';
  }

  _hideArrow(playerId) {
    const arrow = this.arrows.get(playerId);
    if (arrow) {
      arrow.style.opacity = '0';
      // Immediately remove to prevent duplication
      if (arrow.parentNode) {
        arrow.parentNode.removeChild(arrow);
      }
      this.arrows.delete(playerId);
    }
  }

  _colorToCSS(color) {
    const r = Math.round(color.r || 255);
    const g = Math.round(color.g || 255);
    const b = Math.round(color.b || 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  destroy() {
    this.arrows.forEach((arrow) => {
      if (arrow.parentNode) {
        arrow.parentNode.removeChild(arrow);
      }
    });
    this.arrows.clear();
    if (this.arrowContainer.parentNode) {
      this.arrowContainer.parentNode.removeChild(this.arrowContainer);
    }
  }
}
