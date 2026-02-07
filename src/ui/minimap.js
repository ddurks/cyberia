import * as THREE from "three";

const MOBILE_REGEX_FULL =
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i;
const MOBILE_REGEX_SHORT =
  /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(14|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|14|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|84|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i;

function isMobileDevice() {
  return MOBILE_REGEX_FULL.test(navigator.userAgent) || MOBILE_REGEX_SHORT.test(navigator.userAgent.substr(0, 4));
}

/**
 * Mini map system - displays top-right corner minimap with player positions
 */
export class MiniMap {
  constructor(containerElement) {
    this.container = containerElement;
    this.mapSize = isMobileDevice() ? 100 : 200;
    this.worldSize = 100; // 100-unit radius (2x zoom)
    this.canvas = null;
    this.ctx = null;
    this.players = new Map();
    this.localPlayerId = null;
    this.worldObjects = { trees: [] };

    this._createCanvas();
  }

  _createCanvas() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.mapSize;
    this.canvas.height = this.mapSize;
    
    Object.assign(this.canvas.style, {
      position: "absolute",
      top: "10px",
      right: "10px",
      border: "2px solid rgba(0, 255, 0, 0.8)",
      backgroundColor: "transparent",
      borderRadius: "10px",
      boxShadow: "0 0 15px rgba(0, 255, 0, 0.6), inset 0 0 15px rgba(0, 255, 0, 0.2)",
    });
    
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
  }

  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }

  updatePlayers(playersData) {
    this.players = playersData;
  }

  updateWorldObjects(trees) {
    this.worldObjects.trees = trees || [];
  }

  setCyberMousePosition(position) {
    this.worldObjects.cyberMouse = position;
  }

  update(localPlayerPos) {
    if (!this.ctx) return;
    this._draw(localPlayerPos);
  }

  _draw(localPlayerPos) {
    this.ctx.clearRect(0, 0, this.mapSize, this.mapSize);
    
    // Background
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    this.ctx.fillRect(0, 0, this.mapSize, this.mapSize);

    // Border
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, this.mapSize, this.mapSize);

    // Center point
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    this.ctx.beginPath();
    this.ctx.arc(this.mapSize / 2, this.mapSize / 2, 2, 0, Math.PI * 2);
    this.ctx.fill();

    this._drawTrees(localPlayerPos);
    
    // Cyber mouse
    if (this.worldObjects.cyberMouse) {
      this._drawCyberMouse(this.worldObjects.cyberMouse, localPlayerPos);
    }
    
    // Other players
    this.players.forEach((player, playerId) => {
      if (playerId !== this.localPlayerId && player.position) {
        this._drawPlayer(player, localPlayerPos, player.color || { r: 255, g: 255, b: 255 }, false);
      }
    });

    // Local player (on top)
    if (this.players.has(this.localPlayerId)) {
      this._drawPlayer(this.players.get(this.localPlayerId), localPlayerPos, { r: 100, g: 200, b: 255 }, true);
    }
  }

  _drawTrees(localPlayerPos) {
    this.worldObjects.trees.forEach((tree) => {
      if (!tree.position) return;

      const pos = this._worldToScreen(tree.position, localPlayerPos);
      if (!this._isOnScreen(pos.x, pos.y)) return;

      this.ctx.fillStyle = "rgba(0, 200, 0, 0.6)";
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  _drawPlayer(player, localPlayerPos, color, isLocal) {
    if (!player.position) return;

    const pos = this._worldToScreen(player.position, localPlayerPos);
    if (!this._isOnScreen(pos.x, pos.y)) return;

    const radius = isLocal ? 10 : 5;
    const alpha = isLocal ? 1 : 0.8;

    this.ctx.fillStyle = this._colorToRGBA(color, alpha);
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  _drawCyberMouse(cyberMousePos, localPlayerPos) {
    if (!cyberMousePos) return;

    const pos = this._worldToScreen(cyberMousePos, localPlayerPos);
    if (!this._isOnScreen(pos.x, pos.y)) return;

    // Draw cyber mouse as a magenta square
    this.ctx.fillStyle = "rgba(255, 0, 255, 0.9)";
    this.ctx.fillRect(pos.x - 4, pos.y - 4, 8, 8);

    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(pos.x - 4, pos.y - 4, 8, 8);
  }

  _worldToScreen(worldPos, localPlayerPos) {
    const rel = new THREE.Vector3().subVectors(worldPos, localPlayerPos);
    const centerX = this.mapSize / 2;
    const centerY = this.mapSize / 2;
    
    return {
      x: (rel.x / this.worldSize) * centerX + centerX,
      y: (rel.z / this.worldSize) * centerY + centerY,
    };
  }

  _isOnScreen(x, y) {
    const center = this.mapSize / 2;
    return Math.abs(x - center) < this.mapSize && Math.abs(y - center) < this.mapSize;
  }

  _colorToRGBA(color, alpha = 1) {
    const r = Math.round(color.r ?? 255);
    const g = Math.round(color.g ?? 255);
    const b = Math.round(color.b ?? 255);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  destroy() {
    this.canvas?.parentNode?.removeChild(this.canvas);
  }
}
