/**
 * Level/World management class
 * Handles terrain generation, tree placement, snowfall effects, and camera obstruction
 */
import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Level {
  spawnedPlanes = new Set();
  currentPlayerRoomX = 0;
  currentPlayerRoomZ = 0;
  planeSize = 100;
  planeMeshes = [];
  terrainBodies = new Map(); // Cannon.js ground bodies by tile key
  treeTypes = {};
  treeMeshes = {};
  treeInstanceCounters = {};
  treeCollisionData = [];
  activeTreeBodies = [];
  spawnedTreeGroups = [];
  transparentObstructions = new Set();
  allObstructables = new Set();
  activeObstructables = new Set();
  treeInstancesFromBootstrap = []; // Tree positions from bootstrap
  wallMeshes = [];
  wallBodies = [];
  treeCollisionFrameCounter = 0;
  snowfallUpdateFrameCounter = 0;

  constructor(deps) {
    // Dependencies injection
    this.scene = deps.scene;
    this.world = deps.world;
    this.camera = deps.camera;
    this.raycaster = deps.raycaster;
    this.downVector = deps.downVector;
    this.obstructionRaycaster = deps.obstructionRaycaster;
    this.physicsMaterial = deps.physicsMaterial;
    this.isMobile = deps.isMobile;

    this.light();

    this.checkAndSpawnPlane(0, 0);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i !== 0 || j !== 0) {
          this.checkAndSpawnPlane(i, j);
        }
      }
    }
    this.initSnowfall();
  }

  // Apply bootstrap data from server (tree positions only)
  setBootstrap(bootstrapData) {
    // Applying bootstrap data

    // Extract tree instances for deterministic placement
    const treeGroup = bootstrapData.instances?.find((g) => g.kind === "tree");
    if (treeGroup) {
      this.treeInstancesFromBootstrap = treeGroup.positions;
      // Tree positions loaded from bootstrap

      // Clear existing trees and respawn with bootstrap positions
      this.spawnedTreeGroups.forEach((group) => this.scene.remove(group.mesh));
      this.spawnedTreeGroups = [];
      this.treeCollisionData = [];
      this.activeTreeBodies = [];

      // Respawn trees on existing planes
      this.planeMeshes.forEach((plane) => {
        this.placeTreesOnPlane(plane);
      });
    }

    // Create physics bodies for boundary walls from colliders
    if (bootstrapData.colliders && bootstrapData.colliders.aabbs) {
      this.createWallPhysicsBodies(bootstrapData.colliders.aabbs);
    }
  }

  createWallPhysicsBodies(aabbs) {
    // Remove existing wall bodies if any
    if (this.wallBodies) {
      this.wallBodies.forEach((body) => this.world.removeBody(body));
    }
    this.wallBodies = [];

    aabbs.forEach((aabb, index) => {
      const width = aabb.max.x - aabb.min.x;
      const height = aabb.max.y - aabb.min.y;
      const depth = aabb.max.z - aabb.min.z;

      // Create a static box body
      const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2, height / 2, depth / 2),
      );
      const body = new CANNON.Body({
        mass: 0, // Static body
        shape: shape,
        material: this.physicsMaterial,
        type: CANNON.Body.STATIC, // Explicitly set as static
      });

      // Position at center of AABB
      body.position.set(
        (aabb.min.x + aabb.max.x) / 2,
        (aabb.min.y + aabb.max.y) / 2,
        (aabb.min.z + aabb.max.z) / 2,
      );

      // Prevent the body from sleeping
      body.allowSleep = false;
      body.collisionResponse = true;

      this.world.addBody(body);
      this.wallBodies.push(body);
    });
  }

  light() {
    // warm this.sunLight (Directional Light)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.7); // Soft warm this.sunLight
    this.sunLight.position.set(-60, 100, 100);
    this.sunLight.castShadow = true;

    // shadow adjustments for softer, more natural shadows
    this.sunLight.shadow.camera.top = 50;
    this.sunLight.shadow.camera.bottom = -50;
    this.sunLight.shadow.camera.left = -50;
    this.sunLight.shadow.camera.right = 50;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;

    // softer shadows with more realistic diffusion
    this.sunLight.shadow.radius = 4;
    this.sunLight.shadow.bias = -0.0001;

    this.scene.add(this.sunLight);

    // Cool Ambient Light for Snow Contrast
    const ambientLight = new THREE.AmbientLight(0xe3f2fd, 0.4); // Cold blue tone
    this.scene.add(ambientLight);
  }

  calculateHeight(x, z, localX, localZ, width) {
    // Use bootstrap seed for procedural generation
    if (this.bootstrap && this.bootstrap.seed !== undefined) {
      const config = this.bootstrap.heightmapConfig || {
        scale: 0.005,
        amplitude: 3,
      };
      const seed = this.bootstrap.seed;

      // Helper function for noise (same as worldgen)
      const noise = (nx, nz) => {
        const sx = nx + seed;
        const sz = nz + seed;
        const n = Math.sin(sx * 12.9898 + sz * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1;
      };

      // Multi-octave noise for smooth terrain
      const nx = x * config.scale;
      const nz = z * config.scale;
      const noise1 = noise(nx, nz) * 1.0;
      const noise2 = noise(nx * 2, nz * 2) * 0.5;
      const noise3 = noise(nx * 4, nz * 4) * 0.25;

      return (noise1 + noise2 + noise3) * config.amplitude;
    }

    // Fallback: use simple sine wave (matches server physics)
    const frequency = 0.1;
    const amplitude = 1.5;

    // Simple sine wave - same formula as server
    return amplitude * Math.sin(frequency * x) * Math.sin(frequency * z);
  }

  createPlane(x, y, z) {
    const geometry = new THREE.PlaneGeometry(
      this.planeSize,
      this.planeSize,
      this.isMobile ? 20 : 50,
      this.isMobile ? 20 : 50,
    );
    geometry.rotateX(-Math.PI * 0.5);

    // Access and modify vertex positions
    let positions = geometry.attributes.position.array;
    let width = Math.sqrt(positions.length / 3) - 1;

    for (let i = 0, j = 0; i < positions.length; i += 3, j++) {
      const localX_vertex = positions[i];
      const localZ_vertex = positions[i + 2];
      // Convert to world coordinates for seamless tiling
      const worldX = localX_vertex + x;
      const worldZ = localZ_vertex + z;
      const localX = j % (width + 1);
      const localZ = Math.floor(j / (width + 1));
      const y_height = this.calculateHeight(
        worldX,
        worldZ,
        localX,
        localZ,
        width,
      );
      positions[i + 1] += y_height;
    }

    // Update positions and recompute normals
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    const loader = new THREE.TextureLoader();
    const texPath = "./assets/Snow002_1K-JPG/";

    const albedoMap = loader.load(texPath + "Snow002_1K-JPG_Color.jpg");
    const normalMap = loader.load(texPath + "Snow002_1K-JPG_NormalGL.jpg");
    const roughnessMap = loader.load(texPath + "Snow002_1K-JPG_Roughness.jpg");

    [albedoMap, normalMap, roughnessMap].forEach((map) => {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(1, 1);
    });

    const material = new THREE.MeshStandardMaterial({
      map: albedoMap,
      normalMap,
      roughnessMap,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(x, y, z);
    plane.receiveShadow = true;
    plane.visible = true;
    this.scene.add(plane);

    // Don't create static Cannon bodies - we'll use custom ground collision
    // that matches server's sine wave terrain in the physics loop

    return plane;
  }

  planeKey(x, z) {
    return `${x},${z}`;
  }

  checkAndSpawnPlane(x, z) {
    let key = this.planeKey(x, z);
    if (!this.spawnedPlanes.has(key)) {
      const mesh = this.createPlane(x * this.planeSize, 0, z * this.planeSize);

      const planeData = {
        gridX: x,
        gridZ: z,
        mesh,
        objects: [],
        isVisible: true,
      };

      this.spawnedPlanes.add(key);
      this.planeMeshes.push(mesh);
      const trees = this.placeTreesOnPlane(mesh);
      if (trees) planeData.objects.push(...trees);
    }
  }

  updatePlayerPlane(playerPosition) {
    let newRoomX = Math.floor(playerPosition.x / this.planeSize);
    let newRoomZ = Math.floor(playerPosition.z / this.planeSize);

    // Check if player has entered a new segment
    if (
      newRoomX !== this.currentPlayerRoomX ||
      newRoomZ !== this.currentPlayerRoomZ
    ) {
      this.currentPlayerRoomX = newRoomX;
      this.currentPlayerRoomZ = newRoomZ;
      this.spawnAdjacentPlanes(newRoomX, newRoomZ);
    }
  }

  spawnAdjacentPlanes(x, z) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx !== 0 || dz !== 0) {
          this.checkAndSpawnPlane(x + dx, z + dz);
        }
      }
    }
  }

  placeTreesOnPlane(plane) {
    const placedTrees = [];
    plane.updateMatrixWorld(true);

    const keys = Object.keys(this.treeTypes);
    if (!keys.length) return placedTrees;

    // If we have bootstrap instances, use those instead of random generation
    if (
      this.treeInstancesFromBootstrap &&
      this.treeInstancesFromBootstrap.length > 0
    ) {
      // Placing trees from bootstrap

      for (const treeInstance of this.treeInstancesFromBootstrap) {
        // Check if this tree is on this plane
        const planeWorldPos = new THREE.Vector3();
        plane.getWorldPosition(planeWorldPos);

        const distX = Math.abs(treeInstance.x - planeWorldPos.x);
        const distZ = Math.abs(treeInstance.z - planeWorldPos.z);

        // Only place trees that belong to this plane
        if (distX > this.planeSize / 2 || distZ > this.planeSize / 2) continue;

        // Get ground height at this position
        const worldPosition = new THREE.Vector3(
          treeInstance.x,
          100,
          treeInstance.z,
        );
        this.raycaster.set(worldPosition, this.downVector);
        const intersects = this.raycaster.intersectObject(plane, true);
        if (intersects.length === 0) continue;

        const { point, face } = intersects[0];
        const normal = face.normal.clone().normalize();

        // Use tree type from bootstrap if available, otherwise random
        const treeName =
          treeInstance.type || keys[Math.floor(Math.random() * keys.length)];
        const parts = this.treeTypes[treeName];

        // Skip if this tree type hasn't loaded yet
        if (!parts) continue;

        const treeGroup = new THREE.Group();

        parts.forEach((part) => {
          const mesh = new THREE.Mesh(part.geometry, part.material.clone());
          mesh.castShadow = this.isMobile ? false : true;
          mesh.receiveShadow = this.isMobile ? false : true;
          mesh.userData.isObstructable = true;
          mesh.material.transparent = true;
          treeGroup.add(mesh);
          this.allObstructables.add(mesh);
        });

        // Align to ground normal
        const up = new THREE.Vector3(0, 1, 0);
        const alignQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
        const spinQuat = new THREE.Quaternion().setFromAxisAngle(
          normal,
          treeInstance.yaw || 0,
        );

        treeGroup.quaternion.copy(alignQuat);
        treeGroup.quaternion.premultiply(spinQuat);

        const scale = treeInstance.scale || 1.0;
        treeGroup.scale.setScalar(scale);
        const snowDepth = 0.15;
        treeGroup.position.copy(point).add(new THREE.Vector3(0, -snowDepth, 0));
        this.scene.add(treeGroup);

        this.spawnedTreeGroups.push({
          mesh: treeGroup,
          position: treeGroup.position.clone(),
        });
        placedTrees.push(treeGroup);

        const bbox = new THREE.Box3().setFromObject(treeGroup);
        const height = bbox.max.y - bbox.min.y;
        const radius =
          (bbox.max.x - bbox.min.x + bbox.max.z - bbox.min.z) * 0.15; // Match non-bootstrap tree collision size
        this.treeCollisionData.push({
          position: treeGroup.position.clone(),
          quaternion: treeGroup.quaternion.clone(),
          radius,
          height,
        });
      }

      return placedTrees;
    }

    // Fallback: random tree generation (original code)
    const numTrees = 100 + Math.floor(Math.random() * 100);

    // Generate cluster centers for natural grouping
    const numClusters = this.isMobile ? 8 : 15;
    const clusters = [];
    for (let c = 0; c < numClusters; c++) {
      clusters.push({
        x: (Math.random() - 0.5) * this.planeSize * 0.8,
        z: (Math.random() - 0.5) * this.planeSize * 0.8,
        radius: 8 + Math.random() * 12, // Cluster spread radius
        density: 0.5 + Math.random() * 0.5, // Some clusters denser than others
      });
    }

    for (let i = 0; i < numTrees; i++) {
      let localX, localZ;

      // 70% chance to spawn near a cluster, 30% scattered
      if (Math.random() < 0.7) {
        const cluster = clusters[Math.floor(Math.random() * clusters.length)];
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * cluster.radius * cluster.density;
        localX = cluster.x + Math.cos(angle) * distance;
        localZ = cluster.z + Math.sin(angle) * distance;
      } else {
        localX = (Math.random() - 0.5) * this.planeSize;
        localZ = (Math.random() - 0.5) * this.planeSize;
      }

      const localPosition = new THREE.Vector3(localX, 0, localZ);
      const worldPosition = localPosition.applyMatrix4(plane.matrixWorld);

      this.raycaster.set(
        worldPosition.clone().add(new THREE.Vector3(0, 100, 0)),
        this.downVector,
      );
      const intersects = this.raycaster.intersectObject(plane, true);
      if (intersects.length === 0) continue;

      const { point, face } = intersects[0];
      const normal = face.normal.clone().normalize();

      // Random tree type
      const treeName = keys[Math.floor(Math.random() * keys.length)];
      const parts = this.treeTypes[treeName];

      const treeGroup = new THREE.Group();

      parts.forEach((part) => {
        const mesh = new THREE.Mesh(part.geometry, part.material.clone());
        mesh.castShadow = this.isMobile ? false : true;
        mesh.receiveShadow = this.isMobile ? false : true;
        mesh.userData.isObstructable = true;
        mesh.material.transparent = true;
        treeGroup.add(mesh);
        this.allObstructables.add(mesh);
      });

      // Align to ground normal and spin
      const up = new THREE.Vector3(0, 1, 0);
      const alignQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const rotationY = Math.random() * Math.PI * 2;
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(
        normal,
        rotationY,
      );

      treeGroup.quaternion.copy(alignQuat);
      treeGroup.quaternion.premultiply(spinQuat);

      const scale = 1 + Math.random();
      treeGroup.scale.setScalar(scale);
      const snowDepth = 0.15;
      treeGroup.position.copy(point).add(new THREE.Vector3(0, -snowDepth, 0));
      this.scene.add(treeGroup);

      this.spawnedTreeGroups.push({
        mesh: treeGroup,
        position: treeGroup.position.clone(),
      });
      placedTrees.push(treeGroup);

      const bbox = new THREE.Box3().setFromObject(treeGroup);
      const height = bbox.max.y - bbox.min.y;
      const radius = (bbox.max.x - bbox.min.x + bbox.max.z - bbox.min.z) * 0.15; // Increased from 0.02 for better collision
      this.treeCollisionData.push({
        position: treeGroup.position.clone(),
        quaternion: treeGroup.quaternion.clone(),
        radius,
        height,
      });
    }

    return placedTrees;
  }

  updateTreeCollisions(
    playerPosition,
    activationRadius = 20,
    playerVelocity = null,
  ) {
    // Throttle tree collision updates based on player movement
    // Active players: every 3 frames, idle players: every 10 frames
    const isMoving = playerVelocity && playerVelocity.length() > 0.5;
    const throttleFrames = isMoving ? 3 : 10;

    // TEMPORARILY DISABLED FOR DEBUGGING
    // this.treeCollisionFrameCounter++;
    // if (this.treeCollisionFrameCounter % throttleFrames !== 0) {
    //   return; // Skip this frame
    // }

    this.treeCollisionData.forEach((data) => {
      if (!data || !data.position) return;

      const distance = playerPosition.distanceTo(data.position);
      if (distance < activationRadius && !data.body) {
        const shape = new CANNON.Cylinder(
          data.radius,
          data.radius,
          data.height,
          8,
        );

        // CRITICAL: Assign material to shape for collision detection
        shape.material = this.physicsMaterial;

        const body = new CANNON.Body({
          mass: 0,
          shape: shape,
          material: this.physicsMaterial, // Also assign to body
          position: new CANNON.Vec3(
            data.position.x,
            data.position.y + data.height / 2,
            data.position.z,
          ),
        });
        body.allowSleep = true;
        body.sleepSpeedLimit = 0.1;
        body.sleepTimeLimit = 1.0;
        body.quaternion.set(
          data.quaternion.x,
          data.quaternion.y,
          data.quaternion.z,
          data.quaternion.w,
        );

        data.body = body;
        this.world.addBody(body);

        // Tree collision added
      }
    });
  }

  handleCameraObstruction(camera, characterControls) {
    if (!characterControls) return;

    this.transparentObstructions.forEach((obj) => {
      if (obj.material && obj.userData.originalOpacity !== undefined) {
        obj.material.opacity = obj.userData.originalOpacity;
        obj.material.transparent = obj.userData.originalTransparent;
      }
    });
    this.transparentObstructions.clear();

    const cameraPos = camera.position.clone();
    const playerPos = characterControls.model.position
      .clone()
      .add(new THREE.Vector3(0, 1, 0));

    const direction = playerPos.clone().sub(cameraPos);
    const distance = direction.length();
    direction.normalize();

    this.obstructionRaycaster.set(cameraPos, direction);
    this.obstructionRaycaster.far = distance;

    const intersects = this.obstructionRaycaster.intersectObjects(
      Array.from(this.activeObstructables),
      true,
    );

    for (let i = 0; i < intersects.length; i++) {
      const obj = intersects[i].object;

      if (
        obj === characterControls.model ||
        characterControls.model.children.includes(obj)
      )
        break;
      if (!obj.isMesh || !obj.userData.isObstructable) continue;

      if (obj.userData.originalOpacity === undefined) {
        obj.userData.originalOpacity = obj.material.opacity;
        obj.userData.originalTransparent = obj.material.transparent;
      }

      obj.material.opacity = 0.3;
      obj.material.transparent = true;

      this.transparentObstructions.add(obj);
    }
  }

  updateActiveObstructables(playerPosition, radius = 20) {
    this.activeObstructables.clear();

    const tempVec = new THREE.Vector3();

    for (const obj of this.allObstructables) {
      if (!obj.isMesh) continue;

      obj.getWorldPosition(tempVec);
      const distance = playerPosition.distanceTo(tempVec);

      if (distance < radius) {
        this.activeObstructables.add(obj);
      }
    }
  }

  initSnowfall() {
    // Aggressive particle reduction for low-end devices
    let particleCount = 1000;
    if (this.isMobile) {
      // Check for low-end mobile (estimate via navigator API)
      const isLowEnd = !navigator.deviceMemory || navigator.deviceMemory <= 4;
      particleCount = isLowEnd ? 250 : 500;
    }

    this.snowConfig = {
      particleCount: particleCount,
      boxSize: this.isMobile ? 50 : 80,
      height: 40,
      fallSpeed: 0.1,
      driftSpeed: 0.1,
    };

    this.snowGeometry = new THREE.BufferGeometry();
    this.snowPositions = new Float32Array(this.snowConfig.particleCount * 3);
    this.snowVelocities = new Float32Array(this.snowConfig.particleCount * 3);
    this.windAngle = Math.random() * Math.PI * 2;
    this.windSpeed = 0.1;
    this.windVariation = 0.02;
    this.windSpeedVariation = 0.5;
    this.windSpeedMin = 0.5;
    this.windSpeedMax = 0.1;

    for (let i = 0; i < this.snowConfig.particleCount; i++) {
      this.resetSnowflake(i, true);
    }

    this.snowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.snowPositions, 3),
    );

    this.snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.6, // Slightly smaller for denser look
      transparent: true,
      opacity: 0.85, // Slightly more transparent to prevent visual overload
      depthWrite: false,
      map: this.generateSnowflakeTexture(),
    });
    this.snowParticles = new THREE.Points(this.snowGeometry, this.snowMaterial);
    this.snowParticles.frustumCulled = true;

    this.scene.add(this.snowParticles);
  }

  updateSnowfall(wind) {
    if (!this.snowGeometry || !this.snowGeometry.attributes.position) {
      return;
    }

    // Throttle snowfall updates on mobile: only update every other frame
    if (this.isMobile) {
      this.snowfallUpdateFrameCounter++;
      if (this.snowfallUpdateFrameCounter % 2 !== 0) {
        return; // Skip update this frame
      }
    }

    const positions = this.snowGeometry.attributes.position.array;
    const playerPos = this.camera.position;
    const windForce = this.wind.getWindForce();

    // Boundaries for the snow cube following the player
    const halfBoxSize = this.snowConfig.boxSize / 2;
    const minX = playerPos.x - halfBoxSize;
    const maxX = playerPos.x + halfBoxSize;
    const minZ = playerPos.z - halfBoxSize;
    const maxZ = playerPos.z + halfBoxSize;
    const minY = playerPos.y - 10;
    const maxY = playerPos.y + this.snowConfig.height;

    for (let i = 0; i < this.snowConfig.particleCount; i++) {
      const index = i * 3;

      // Update positions with wind and gravity
      positions[index] += windForce.x;
      positions[index + 1] -= this.snowConfig.fallSpeed;
      positions[index + 2] += windForce.z;

      // Reset if particle falls below player or moves outside the cube
      const outOfBounds =
        positions[index + 1] < minY ||
        positions[index] < minX ||
        positions[index] > maxX ||
        positions[index + 2] < minZ ||
        positions[index + 2] > maxZ;

      if (outOfBounds) {
        this.resetSnowflake(i, false);
      }
    }

    this.snowGeometry.attributes.position.needsUpdate = true;
  }

  resetSnowflake(i, init) {
    const index = i * 3;
    const playerPos = this.camera.position;

    this.snowPositions[index] =
      playerPos.x + (Math.random() - 0.5) * this.snowConfig.boxSize;
    this.snowPositions[index + 1] =
      playerPos.y + Math.random() * this.snowConfig.height;
    this.snowPositions[index + 2] =
      playerPos.z + (Math.random() - 0.5) * this.snowConfig.boxSize;

    if (!init) this.snowGeometry.attributes.position.needsUpdate = true;
  }

  generateSnowflakeTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      1,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)"); // bright white center
    gradient.addColorStop(0.7, "rgba(245, 245, 255, 0.75)"); // softer bluish-white
    gradient.addColorStop(1, "rgba(230, 230, 255, 0.3)"); // faint blue edge

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }
}
