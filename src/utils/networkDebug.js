/**
 * Network Debugging Utilities
 * Log network traffic for debugging multiplayer and mob synchronization
 */

export const NetworkDebug = {
  enabled: false,
  lastSnapshotMobs: null,
  lastSnapshotPlayers: null,

  enable() {
    this.enabled = true;
    console.log("%c🔧 Network Debug Enabled", "color: blue; font-weight: bold");
  },

  disable() {
    this.enabled = false;
    console.log("%c🔧 Network Debug Disabled", "color: gray; font-weight: bold");
  },

  logSnapshot(snapshot) {
    if (!this.enabled) return;

    const playerCount = snapshot.p?.length || 0;
    const mobCount = snapshot.m?.length || 0;
    
    console.group(`%c📦 Snapshot [Tick ${snapshot.tick}]`, "color: cyan; font-weight: bold");
    console.log(`  Players: ${playerCount}`);
    console.log(`  Mobs: ${mobCount}`);
    
    if (snapshot.m?.length > 0) {
      this.lastSnapshotMobs = snapshot.m;
    }
    
    if (snapshot.p?.length > 0) {
      console.log(`  Other Players:`, snapshot.p.map(p => ({ 
        id: p.id, 
        x: p.x.toFixed(2), 
        z: p.z.toFixed(2),
        moving: Math.sqrt(p.vx*p.vx + p.vz*p.vz) > 0.1
      })));
      this.lastSnapshotPlayers = snapshot.p;
    }
    
    console.groupEnd();
  },

  logMobUpdate(mobId, data) {
    if (!this.enabled) return;
    console.log(`%c🐭 Mob Update [${mobId}]`, "color: magenta", {
      position: { x: data.x?.toFixed(2), y: data.y?.toFixed(2), z: data.z?.toFixed(2) },
      moving: data.isMoving,
      animation: data.animation,
      alive: data.isAlive,
    });
  },

  logPlayerUpdate(playerId) {
    if (!this.enabled) return;
    const player = this.lastSnapshotPlayers?.find(p => p.id === playerId);
    if (player) {
      console.log(`%c👤 Player Update [${playerId}]`, "color: green", {
        position: { x: player.x.toFixed(2), z: player.z.toFixed(2) },
        velocity: Math.sqrt(player.vx*player.vx + player.vz*player.vz).toFixed(2),
      });
    }
  },

  getStatus() {
    return {
      enabled: this.enabled,
      lastMobsReceived: this.lastSnapshotMobs?.length || 0,
      lastPlayersReceived: this.lastSnapshotPlayers?.length || 0,
      mobData: this.lastSnapshotMobs,
      playerData: this.lastSnapshotPlayers,
    };
  },
};
