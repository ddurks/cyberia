// Terrain and tree generation for world bootstrap
// Generates heightmap and instance data to send to server

export class WorldGenerator {
  constructor(seed = 12345) {
    this.seed = seed;
  }

  // Generate world bootstrap payload
  generateBootstrap(width = 256, depth = 256, cellSize = 1.0) {
    console.log(`🗺️  Generating world bootstrap with seed ${this.seed}`);

    // Generate heightmap for tree placement only
    const heightmap = this.generateHeightmap(width, depth, cellSize);
    const instances = this.generateInstances(heightmap, width, depth, cellSize);
    const colliders = this.generateColliders(instances);

    return {
      seed: this.seed,
      // Send terrain generation parameters for server physics
      terrainConfig: {
        type: "sinewave",
        frequency: 0.1,
        amplitude: 1.5,
        edgeBlendWidth: 3,
        planeSize: 100, // Must match Level.planeSize
      },
      instances,
      colliders,
    };
  }

  // Generate heightmap using sine waves (matches client calculateHeight)
  generateHeightmap(width, depth, cellSize) {
    const heights = [];
    const frequency = 0.1;
    const amplitude = 1.5;
    const edgeBlendWidth = 3;

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        // World coordinates
        const worldX = (x - width / 2) * cellSize;
        const worldZ = (z - depth / 2) * cellSize;

        // Calculate edge blend (simplified, assume center of large area)
        const height =
          amplitude *
          Math.sin(frequency * worldX) *
          Math.sin(frequency * worldZ);
        heights.push(height);
      }
    }

    return {
      width,
      depth,
      cellSize,
      origin: {
        x: -(width * cellSize) / 2,
        z: -(depth * cellSize) / 2,
      },
      heights,
    };
  }

  // Generate tree instances
  generateInstances(heightmap, width, depth, cellSize) {
    const trees = [];
    const numTrees = Math.min(500, width * depth * 0.01); // 1% tree coverage, max 500

    for (let i = 0; i < numTrees; i++) {
      const x = (Math.random() * width - width / 2) * cellSize;
      const z = (Math.random() * depth - depth / 2) * cellSize;
      const y = this._getHeightAt(heightmap, x, z, cellSize);

      // Skip if underwater or too steep
      if (y < 0) continue;

      trees.push({
        x,
        y,
        z,
        yaw: Math.random() * Math.PI * 2,
        scale: 0.8 + Math.random() * 0.4,
      });
    }

    return [
      {
        kind: "tree",
        positions: trees,
      },
    ];
  }

  // Generate AABB colliders for trees
  generateColliders(instances) {
    const aabbs = [];
    const treeGroup = instances.find((g) => g.kind === "tree");

    if (treeGroup) {
      for (const tree of treeGroup.positions) {
        // Limit to 200 colliders
        const radius = 1.5 * (tree.scale || 1);
        aabbs.push({
          min: {
            x: tree.x - radius,
            y: tree.y,
            z: tree.z - radius,
          },
          max: {
            x: tree.x + radius,
            y: tree.y + 5 * (tree.scale || 1),
            z: tree.z + radius,
          },
        });
      }
    }

    return { aabbs };
  }

  // Simple 2D noise function (replace with better noise if available)
  _noise(x, z) {
    const seed = this.seed;
    x = x + seed;
    z = z + seed;

    const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  // Get procedural height at any world position
  getProceduralHeight(worldX, worldZ, scale = 0.01, amplitude = 2) {
    const nx = worldX * scale;
    const nz = worldZ * scale;
    return this._noise(nx, nz) * amplitude;
  }

  // Get height at world position
  _getHeightAt(heightmap, x, z, cellSize) {
    const localX = x - heightmap.origin.x;
    const localZ = z - heightmap.origin.z;

    const gridX = localX / cellSize;
    const gridZ = localZ / cellSize;

    const ix = Math.floor(gridX);
    const iz = Math.floor(gridZ);

    if (
      ix < 0 ||
      iz < 0 ||
      ix >= heightmap.width - 1 ||
      iz >= heightmap.depth - 1
    ) {
      return 0;
    }

    const fx = gridX - ix;
    const fz = gridZ - iz;

    const h00 = heightmap.heights[iz * heightmap.width + ix];
    const h10 = heightmap.heights[iz * heightmap.width + (ix + 1)];
    const h01 = heightmap.heights[(iz + 1) * heightmap.width + ix];
    const h11 = heightmap.heights[(iz + 1) * heightmap.width + (ix + 1)];

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;

    return h0 * (1 - fz) + h1 * fz;
  }
}
