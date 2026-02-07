/**
 * Reusable Lerping System for Network Entities
 * 
 * Provides a consistent interpolation strategy for any networked entity
 * (players, mobs, etc.) to smooth movement between server updates.
 */

export class LerpSystem {
  /**
   * Lerp a value toward a target
   * @param {number} current - Current value
   * @param {number} target - Target value
   * @param {number} lerpFactor - Interpolation factor (0-1, higher = faster)
   * @returns {number} Interpolated value
   */
  static lerpValue(current, target, lerpFactor = 0.15) {
    return current + (target - current) * lerpFactor;
  }

  /**
   * Lerp a Vector3 toward a target
   * @param {THREE.Vector3} position - Current position
   * @param {THREE.Vector3} targetPosition - Target position
   * @param {number} lerpFactor - Interpolation factor (0-1)
   * @returns {THREE.Vector3} The position object (modified in place)
   */
  static lerpVector3(position, targetPosition, lerpFactor = 0.15) {
    position.x += (targetPosition.x - position.x) * lerpFactor;
    position.y += (targetPosition.y - position.y) * lerpFactor;
    position.z += (targetPosition.z - position.z) * lerpFactor;
    return position;
  }

  /**
   * Lerp only X and Z (horizontal movement, keep Y for gravity)
   * @param {THREE.Vector3} position - Current position
   * @param {THREE.Vector3} targetPosition - Target position
   * @param {number} lerpFactor - Interpolation factor
   * @returns {THREE.Vector3} The position object (modified in place)
   */
  static lerpVector3Horizontal(position, targetPosition, lerpFactor = 0.15) {
    position.x += (targetPosition.x - position.x) * lerpFactor;
    position.z += (targetPosition.z - position.z) * lerpFactor;
    return position;
  }

  /**
   * Calculate distance to target
   * @param {THREE.Vector3} position - Current position
   * @param {THREE.Vector3} targetPosition - Target position
   * @returns {number} Distance
   */
  static distanceToTarget(position, targetPosition) {
    return position.distanceTo(targetPosition);
  }

  /**
   * Check if entity has reached target (within tolerance)
   * @param {THREE.Vector3} position - Current position
   * @param {THREE.Vector3} targetPosition - Target position
   * @param {number} tolerance - Distance tolerance (default 0.01)
   * @returns {boolean} True if within tolerance
   */
  static isAtTarget(position, targetPosition, tolerance = 0.01) {
    return this.distanceToTarget(position, targetPosition) <= tolerance;
  }

  /**
   * Recommended lerp factors for different scenarios
   */
  static PRESETS = {
    // Fast correction (jumps to target quickly)
    FAST: 0.25,
    // Default smooth movement
    SMOOTH: 0.15,
    // Very smooth, gradual correction
    SLOW: 0.05,
  };
}
