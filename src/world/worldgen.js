// Terrain and tree generation for world bootstrap
// Generates heightmap and instance data to send to server

export class WorldGenerator {
  constructor(seed = 12345) {
    this.seed = seed;
    this.rngState = seed;
  }

  // Seeded random number generator (0 to 1)
  _seededRandom() {
    this.rngState = (this.rngState * 1664525 + 1013904223) % 4294967296;
    return this.rngState / 4294967296;
  }

  // Generate world bootstrap payload
  generateBootstrap(width = 256, depth = 256, cellSize = 1.0) {
    // Generating world bootstrap

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

  // Generate tree instances with perlin noise clumping
  generateInstances(heightmap, width, depth, cellSize) {
    const trees = [];
    const numTrees = Math.min(1500, width * depth * 0.03); // 3x more: 3% tree coverage, max 1500
    const treeTypes = ["tree001", "tree002", "tree003", "tree004"]; // Available tree types

    for (let i = 0; i < numTrees; i++) {
      const x = (this._seededRandom() * width - width / 2) * cellSize;
      const z = (this._seededRandom() * depth - depth / 2) * cellSize;

      // Use perlin noise for clumping (scale determines cluster size)
      const clumpNoise = this._perlin(x * 0.05, z * 0.05);

      // Skip if perlin noise is negative (creates natural gaps)
      if (clumpNoise < -0.3) continue;

      const y = this._getHeightAt(heightmap, x, z, cellSize);

      // Skip if underwater or too steep
      if (y < 0) continue;

      // Deterministic tree type based on position (so all clients see same type)
      const typeNoise = this._noise(x * 0.1, z * 0.1);
      const typeIndex =
        Math.floor((typeNoise + 1) * 0.5 * treeTypes.length) % treeTypes.length;

      trees.push({
        x,
        y,
        z,
        yaw: this._seededRandom() * Math.PI * 2, // Use seeded random for yaw
        scale: 1.0 + this._seededRandom(), // Scale between 1.0 and 2.0 with seeded random
        type: treeTypes[typeIndex], // Include tree type in bootstrap
      });
    }

    return [
      {
        kind: "tree",
        positions: trees,
      },
    ];
  }

  // Generate cylinder colliders for trees (matches client Cannon.js cylinders)
  generateColliders(instances) {
    const cylinders = [];
    const aabbs = [];
    const treeGroup = instances.find((g) => g.kind === "tree");

    if (treeGroup) {
      // Generating cylinder colliders

      for (const tree of treeGroup.positions) {
        // Estimate dimensions based on scale (will be refined when actual geometry loads on client)
        // These values roughly match the client's bbox calculation
        const scale = tree.scale || 1.0;
        const estimatedBBoxWidth = 2.0 * scale; // Rough tree width
        const estimatedBBoxDepth = 2.0 * scale;
        const height = 8.0 * scale; // Rough tree height
        const radius = (estimatedBBoxWidth + estimatedBBoxDepth) * 0.15; // Matches client's 0.15 factor

        cylinders.push({
          position: {
            x: tree.x,
            y: tree.y + height / 2, // Cylinder center is at half height
            z: tree.z,
          },
          quaternion: {
            x: 0,
            y: Math.sin(tree.yaw / 2), // Convert yaw to quaternion
            z: 0,
            w: Math.cos(tree.yaw / 2),
          },
          radius,
          height,
        });
      }

      // Cylinder colliders generated
    } else {
      // No tree group found
    }

    // Add invisible boundary walls (3x3 grid = 300x300 world)
    const wallHeight = 50;
    const wallDepth = 50;
    const wallThickness = 10;
    const boundary = 150;

    aabbs.push({
      min: { x: -boundary - wallThickness, y: -wallDepth, z: boundary },
      max: {
        x: boundary + wallThickness,
        y: wallHeight,
        z: boundary + wallThickness,
      },
    });
    aabbs.push({
      min: {
        x: -boundary - wallThickness,
        y: -wallDepth,
        z: -boundary - wallThickness,
      },
      max: { x: boundary + wallThickness, y: wallHeight, z: -boundary },
    });
    aabbs.push({
      min: { x: boundary, y: -wallDepth, z: -boundary },
      max: { x: boundary + wallThickness, y: wallHeight, z: boundary },
    });
    aabbs.push({
      min: { x: -boundary - wallThickness, y: -wallDepth, z: -boundary },
      max: { x: -boundary, y: wallHeight, z: boundary },
    });

    return { cylinders, aabbs };
  }

  // Simple 2D noise function (replace with better noise if available)
  _noise(x, z) {
    const seed = this.seed;
    x = x + seed;
    z = z + seed;

    const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  // Perlin-like noise for smoother clumping
  _perlin(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;

    // Fade curves
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);

    // Hash corner values
    const a = this._noise(xi, zi);
    const b = this._noise(xi + 1, zi);
    const c = this._noise(xi, zi + 1);
    const d = this._noise(xi + 1, zi + 1);

    // Bilinear interpolation
    const x1 = a * (1 - u) + b * u;
    const x2 = c * (1 - u) + d * u;
    return x1 * (1 - v) + x2 * v;
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
