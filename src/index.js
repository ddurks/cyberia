import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as CANNON from "cannon-es";
import Stats from "stats.js";
import { NetworkClient } from "./network/network.js";
import { MultiplayerManager } from "./network/multiplayer.js";
import { WorldGenerator } from "./world/worldgen.js";
import { getNetworkConfig } from "./core/config.js";
import { MainMenu } from "./ui/mainMenu.js";
import { ChatUI } from "./ui/chatUI.js";
import { ChatBubbleRenderer } from "./effects/chatBubbles.js";
import {
  CharacterControls,
  footBoneNames,
} from "./player/characterControls.js";
import { Level } from "./world/level.js";
import { SnowPuffSystem } from "./effects/snowPuffs.js";
import { FootprintSystem } from "./effects/footprints.js";
import { WindSystem } from "./effects/wind.js";
import {
  W,
  A,
  S,
  D,
  SPACE,
  SHIFT,
  DIRECTIONS,
  JOY_DIRS,
} from "./core/constants.js";

var IS_MOBILE;
if (
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
    navigator.userAgent,
  ) ||
  /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(14|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|14|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|84|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
    navigator.userAgent.substr(0, 4),
  )
) {
  IS_MOBILE = true;
} else {
  IS_MOBILE = false;
}
document.body.classList.add(IS_MOBILE ? "mobile" : "desktop");

// Controls object that can be disabled (e.g., when typing in chat)
const controls = {
  disabled: false,
};

const keysPressed = {};
document.addEventListener(
  "keydown",
  (event) => {
    if (!controls.disabled) {
      keysPressed[event.key.toLowerCase()] = true;
    }
  },
  false,
);
document.addEventListener(
  "keyup",
  (event) => {
    keysPressed[event.key.toLowerCase()] = false;
  },
  false,
);

// Multiplayer globals
let networkClient = null;
let multiplayerManager = null;
let worldGenerator = null;
let mainMenu = null;
const MULTIPLAYER_ENABLED = true; // Set to false to disable

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdedede);

// Server reconciliation target (needs to be accessible in animate loop)
let serverTarget = null;
let lastServerUpdate = 0;
let serverUpdateInterval = 0;

// Generate random coat color early so it's available for network connection
// Colors are 0-255 for network transmission, will be converted to 0-1 for Three.js
let randomCoatColor = {
  r: Math.floor(Math.random() * 256),
  g: Math.floor(Math.random() * 256),
  b: Math.floor(Math.random() * 256),
};

let playerName = "cyberian";

// Initialize multiplayer
if (MULTIPLAYER_ENABLED) {
  // guy and footprintSystem are not defined yet, will be set later
  multiplayerManager = new MultiplayerManager(scene, null, null);
  networkClient = new NetworkClient();
  worldGenerator = new WorldGenerator(Date.now());

  // Status callback for loading screen
  networkClient.onStatus = (message) => {
    if (mainMenu && mainMenu.isLoading) {
      mainMenu.setLoadingStatus(message);
    }
  };

  // Progress callback - real progress from server
  networkClient.onProgress = (percent, elapsed) => {
    if (mainMenu && mainMenu.isLoading) {
      mainMenu.setLoadingProgress(percent);
    }
  };

  // Chat message callback - display chat bubbles above players
  networkClient.onChat = (chatMsg) => {
    // Find the player to display chat above them
    if (chatMsg.playerId === networkClient.playerId) {
      // Local player - use their position
      const playerPos = guy.position.clone();
      chatBubbleRenderer.addChatBubble(
        chatMsg.playerId,
        chatMsg.playerName,
        chatMsg.text,
        playerPos,
      );
    } else if (
      multiplayerManager &&
      multiplayerManager.networkPlayers.has(chatMsg.playerId)
    ) {
      // Remote player
      const networkPlayer = multiplayerManager.networkPlayers.get(
        chatMsg.playerId,
      );
      const playerPos = networkPlayer.model.position.clone();
      chatBubbleRenderer.addChatBubble(
        chatMsg.playerId,
        chatMsg.playerName,
        chatMsg.text,
        playerPos,
      );
    }
  };

  networkClient.onConnected = (playerId) => {
    multiplayerManager.setLocalPlayerId(playerId);
    _playerJustConnected = true;
    const onlineStatusDiv = document.getElementById("online-status");
    if (onlineStatusDiv) onlineStatusDiv.className = "online";
    const statusText = document.getElementById("status-text");
    if (statusText)
      statusText.innerHTML = "online: <span class='count'>1</span>";
  };

  networkClient.onSnapshot = (snapshot) => {
    if (multiplayerManager) {
      multiplayerManager.handleSnapshot(snapshot);
      _msgRecvCount++; // Track received messages

      // Calculate ping from server timestamp
      if (snapshot.t && _pingStart > 0) {
        _pingTime = performance.now() - _pingStart;
      }
      _pingStart = performance.now(); // Start new ping measurement

      // Update online count (snapshot.p contains other players, +1 for self)
      const statusText = document.getElementById("status-text");
      if (statusText && snapshot.p) {
        const count = snapshot.p.length + 1;
        statusText.innerHTML = `online: <span class='count'>${count}</span>`;
      }
    }
  };

  // Server reconciliation for local player
  if (multiplayerManager) {
    multiplayerManager.onServerState = (serverState) => {
      if (!characterControls || !body) return;

      const now = performance.now();
      serverUpdateInterval = now - lastServerUpdate;
      lastServerUpdate = now;

      // Store server state for interpolation
      serverTarget = {
        x: serverState.x,
        y: serverState.y,
        z: serverState.z,
        timestamp: now,
      };
    };
  }

  networkClient.onBootstrapRequired = () => {
    // Uploading world bootstrap
    const bootstrap = worldGenerator.generateBootstrap(128, 128, 1.0);
    networkClient.uploadBootstrap(bootstrap);
  };

  networkClient.onBootstrapData = (payload) => {
    // Received world bootstrap
    if (level) {
      level.setBootstrap(payload);
    }
  };

  // Store connection config - we'll connect AFTER scene is ready
  window._pendingNetworkConnection = async () => {
    // First, show character customizer
    if (!mainMenu) {
      mainMenu = new MainMenu();
      await mainMenu.create();
    }

    // Remove loading elements only AFTER menu is created and about to open
    // This prevents the 3D scene from being visible briefly
    const loadingBg = document.getElementById("loading-bg");
    const loadingImg = document.getElementById("loading");
    if (loadingBg && loadingBg.parentNode)
      loadingBg.parentNode.removeChild(loadingBg);
    if (loadingImg && loadingImg.parentNode)
      loadingImg.parentNode.removeChild(loadingImg);

    mainMenu.onConfirm = async (customization) => {
      // Update player settings from customizer
      randomCoatColor = customization.coatColor;
      playerName = customization.name;
      networkClient.playerName = customization.name;
      networkClient.coatColor = customization.coatColor;

      // Now show loading screen and proceed with network connection
      await _connectToNetwork();
    };

    mainMenu.open();
  };

  async function _connectToNetwork() {
    const config = getNetworkConfig();
    // Customizer already has loading state via transitionToLoading()
    // Just set the initial status
    if (mainMenu && mainMenu.isLoading) {
      mainMenu.setLoadingStatus("Contacting Local Commissariat...");
    }

    if (config.mode === "direct") {
      // Local development: direct connection to world server
      const { LOCAL_DEV_TOKEN } = await import("./core/config.js");
      networkClient
        .connectDirectly(
          config.worldServerUrl,
          LOCAL_DEV_TOKEN,
          randomCoatColor,
        )
        .then(() => {
          networkAttemptComplete = true;
          if (mainMenu && mainMenu.isOpen) {
            mainMenu.close();
          }
          checkAllLoadingComplete();
        })
        .catch((err) => {
          console.error("❌ Network error:", err);
          // Hide character customizer and show offline mode
          if (mainMenu) {
            mainMenu.close();
          }
          // Show offline mode message
          const onlineStatusDiv = document.getElementById("online-status");
          if (onlineStatusDiv) onlineStatusDiv.className = "offline";
          const statusText = document.getElementById("status-text");
          if (statusText) statusText.innerHTML = "offline";
          // Hide loading elements
          const loadingBg = document.getElementById("loading-bg");
          if (loadingBg) loadingBg.style.display = "none";
          const loadingImg = document.getElementById("loading");
          if (loadingImg) loadingImg.style.display = "none";
          // Show HUD for offline mode
          const hudContainer = document.getElementById("hud-container");
          if (hudContainer) hudContainer.classList.add("visible");
          networkAttemptComplete = true;
          checkAllLoadingComplete();
        });
    } else if (config.mode === "matchmaker") {
      // Production: connect through matchmaker
      if (mainMenu && mainMenu.isLoading) {
        mainMenu.setLoadingStatus("Establishing Link to Central Authority...");
      }
      networkClient
        .connectToMatchmaker(config.matchmakerUrl)
        .then(() => {
          if (mainMenu && mainMenu.isLoading) {
            mainMenu.setLoadingStatus(
              "Requesting World Allocation from State Planning Committee...",
            );
          }
          return networkClient.createAndJoinWorld(
            "cyberia",
            null,
            randomCoatColor,
          );
        })
        .then(() => {
          networkAttemptComplete = true;
          if (mainMenu && mainMenu.isOpen) {
            mainMenu.close();
          }
          checkAllLoadingComplete();
        })
        .catch((err) => {
          console.error("❌ Network error:", err);
          // Hide character customizer and show offline mode
          if (mainMenu) {
            mainMenu.close();
          }
          // Show offline mode message
          const onlineStatusDiv = document.getElementById("online-status");
          if (onlineStatusDiv) onlineStatusDiv.className = "offline";
          const statusText = document.getElementById("status-text");
          if (statusText) statusText.innerHTML = "offline";
          // Hide loading elements
          const loadingBg = document.getElementById("loading-bg");
          if (loadingBg) loadingBg.style.display = "none";
          const loadingImg = document.getElementById("loading");
          if (loadingImg) loadingImg.style.display = "none";
          // Show HUD for offline mode
          const hudContainer = document.getElementById("hud-container");
          if (hudContainer) hudContainer.classList.add("visible");
          networkAttemptComplete = true;
          checkAllLoadingComplete();
        });
    }
  }

  networkClient.onDisconnected = () => {
    const onlineStatusDiv = document.getElementById("online-status");
    if (onlineStatusDiv) onlineStatusDiv.className = "offline";
    const statusText = document.getElementById("status-text");
    if (statusText) statusText.innerHTML = "offline";
  };
}

const world = new CANNON.World();
world.defaultContactMaterial.contactEquationStiffness = 1e9;
world.defaultContactMaterial.contactEquationRelaxation = 4;

const canvasContainer = document.getElementById("canvas-container");
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Get initial dimensions - critical for mobile
const getContainerSize = () => {
  const width = Math.max(canvasContainer.clientWidth || window.innerWidth, 1);
  const height = Math.max(
    canvasContainer.clientHeight || window.innerHeight,
    1,
  );
  return { width, height };
};

const { width: initialWidth, height: initialHeight } = getContainerSize();

renderer.setSize(initialWidth, initialHeight, false);
renderer.setPixelRatio(IS_MOBILE ? 1 : window.devicePixelRatio);
renderer.shadowMap.enabled = !IS_MOBILE;

const stats = new Stats();
stats.showPanel(1); // 0: fps, 1: ms, 2: mb
stats.dom.id = "stats";
stats.dom.style.display = "block";
stats.dom.style.cssText +=
  ";position:absolute;top:18px;left:18px;z-index:200;opacity:0.9;pointer-events:none;";
document.getElementById("hud-container").appendChild(stats.dom);

// Network performance stats display
const networkStats = document.createElement("div");
networkStats.id = "network-stats";
networkStats.innerHTML = "Ping: -- ms<br>Sent: 0 msg/s<br>Recv: 0 msg/s";
networkStats.style.cssText =
  "position:absolute;top:64px;left:18px;z-index:200;opacity:0.9;pointer-events:none;background:#020;padding:6px;border-radius:4px;color:#0f0;font-family:monospace;font-size:8px;line-height:1.2;";
document.getElementById("hud-container").appendChild(networkStats);

const camera = new THREE.PerspectiveCamera(
  50,
  initialWidth / initialHeight,
  0.1,
  100,
);
camera.position.set(0, 2, 5);

// Ensure aspect ratio is correct on initial load
camera.aspect = initialWidth / initialHeight;
camera.updateProjectionMatrix();

const solver = new CANNON.GSSolver();
solver.iterations = 5;
solver.tolerance = 0.1;
world.solver = new CANNON.SplitSolver(solver);
world.gravity.set(0, -50, 0);
const physicsMaterial = new CANNON.Material("physics");
const physicsContactMaterial = new CANNON.ContactMaterial(
  physicsMaterial,
  physicsMaterial,
  {
    friction: 0.3,
    restitution: 0.0,
  },
);
world.addContactMaterial(physicsContactMaterial);

const fogColor = 0xddeeff; // Soft blueish-grey
scene.fog = new THREE.Fog(fogColor, 20, 70);
scene.background = new THREE.Color(fogColor);

// Store initial fog values for dynamic adjustment
const baseFogNear = 20;
const baseFogFar = 70;
const mapBoundary = 150; // Must match worldgen.js boundary

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.minDistance = 3;
orbitControls.maxDistance = 15;
orbitControls.enablePan = false;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.update();

const gLoader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
raycaster.camera = camera;
const obstructionRaycaster = new THREE.Raycaster();
obstructionRaycaster.camera = camera;
const downVector = new THREE.Vector3(0, -1, 0);

const level = new Level({
  scene,
  world,
  camera,
  raycaster,
  downVector,
  obstructionRaycaster,
  physicsMaterial,
  isMobile: IS_MOBILE,
});
const wind = new WindSystem();
level.wind = wind;
const snowPuffSystem = new SnowPuffSystem(scene, level.planeMeshes);
const footprintSystem = new FootprintSystem(
  scene,
  level.planeMeshes,
  snowPuffSystem,
  raycaster,
  downVector,
);

// Chat UI and bubble renderer
let chatUI = null;
let chatBubbleRenderer = null;

// Set footprint system reference for multiplayer
if (multiplayerManager) {
  multiplayerManager.footprintSystem = footprintSystem;
  // Footprint system reference set
}

var characterControls,
  guy,
  animationsMap = new Map(),
  body;
var hasSpawnedTrees = false;
gLoader.load("./assets/snowytrees.glb", (gltf) => {
  gltf.scene.traverse((child) => {
    if (child.name.startsWith("tree00")) {
      const meshes = [];

      child.traverse((sub) => {
        if (sub.isMesh) {
          meshes.push(sub);
        }
      });

      if (meshes.length === 0) return;

      level.treeTypes[child.name] = meshes.map((mesh) => ({
        geometry: mesh.geometry.clone(),
        material: mesh.material.clone(),
        name: mesh.name,
      }));
    }
  });

  level.planeMeshes.forEach((plane) => level.placeTreesOnPlane(plane));
  hasSpawnedTrees = true;
});

gLoader.load("./assets/cyberian.glb", (gltf) => {
  gltf.scene.traverse(function (object) {
    if (object.isMesh) {
      object.castShadow = true;
      // Apply random color to snowsuit material
      if (object.material && object.material.name === "snowsuit") {
        object.material.color.setRGB(
          randomCoatColor.r / 255,
          randomCoatColor.g / 255,
          randomCoatColor.b / 255,
        );
      }
    }
  });
  guy = gltf.scene.children[0];
  guy.userData.coatColor = randomCoatColor; // Store for later
  guy.position.set(0, 1, 0);
  guy.scale.set(0.25, 0.25, 0.25);
  scene.add(guy);
  camera.position.add(guy.position);

  const slipperyMaterial = new CANNON.Material("slippery");
  slipperyMaterial.friction = 0;

  // Use sphere to match server capsule radius (0.35)
  const shape = new CANNON.Sphere(0.35);
  body = new CANNON.Body({
    mass: 1,
    material: slipperyMaterial,
  });
  body.addShape(shape);
  body.position.set(0, 1, 0);
  guy.position.copy(body.position);
  body.lastPosition = {
    x: body.position.x,
    y: body.position.y,
    z: body.position.z,
  };
  body.linearDamping = 0.999;
  world.addBody(body);

  gltf.animations.forEach((clip) => {
    clip.tracks = clip.tracks.filter((track) => {
      // Only keep tracks that are not rotating foot/toe bones
      return !footBoneNames.some((name) =>
        track.name.endsWith(`${name}.quaternion`),
      );
    });
  });

  const mixer = new THREE.AnimationMixer(guy);
  gltf.animations.forEach((a) => {
    const action = mixer.clipAction(a);
    // Speed up jump animation 3x
    if (a.name === "jump") {
      action.timeScale = 3.0;
    }
    animationsMap.set(a.name, action);
  });
  animationsMap.get("jump").setLoop(THREE.LoopOnce);
  animationsMap.get("idle").fadeIn(5).play();

  characterControls = new CharacterControls(
    guy,
    mixer,
    animationsMap,
    orbitControls,
    camera,
    "idle",
    level,
    IS_MOBILE,
  );

  // Set reference for multiplayer after guy is loaded
  if (multiplayerManager) {
    multiplayerManager.localCharacter = guy;
    // Local character reference set
  }

  // Initialize chat UI and bubbles now that scene is fully ready
  if (!chatUI && networkClient) {
    chatUI = new ChatUI(networkClient, IS_MOBILE, controls);
    chatUI.create();
  }
  if (!chatBubbleRenderer) {
    chatBubbleRenderer = new ChatBubbleRenderer(scene, camera);
  }
});

// Initialize chat UI after all assets are loaded
THREE.DefaultLoadingManager.onLoad = () => {
  console.log("[Assets] All assets loaded");
  assetsLoaded = true;
  checkAndStartGame();

  // Connect to network AFTER assets are loaded and scene is ready
  // This prevents main thread blocking during WebSocket handshake on iOS
  if (window._pendingNetworkConnection && !networkConnectionInitiated) {
    networkConnectionInitiated = true;
    // Use setTimeout to ensure we're not blocking
    setTimeout(() => {
      window._pendingNetworkConnection();
    }, 100);
  }
};

const clock = new THREE.Clock();
let frameCount = 0;

// Reusable vectors for game loop (avoid allocations)
const _cameraDirection = new THREE.Vector3();
const _cameraRight = new THREE.Vector3();
const _worldDir = new THREE.Vector3();
const _upVector = new THREE.Vector3(0, 1, 0);

// Input change detection (optimize network traffic)
let _lastSentInput = { mx: 0, mz: 0, yaw: 0, jump: false };
let _lastInputSendFrame = 0;

// Network performance tracking
let _msgSentCount = 0;
let _msgRecvCount = 0;
let _lastNetStatsUpdate = 0;
let _pingTime = 0;
let _pingStart = 0;
let _playerJustConnected = false;

function animate() {
  stats.begin();
  let deltaT = clock.getDelta();

  if (characterControls) {
    // Apply movement BEFORE physics step (matches server)
    characterControls.update(deltaT, keysPressed, body, raycaster, downVector);

    // Update tree collisions BEFORE physics step so bodies exist during collision detection
    level.updateTreeCollisions(
      characterControls.model.position,
      20,
      body.velocity,
    );
  }

  // Use variable timestep for smooth physics at any framerate
  world.step(deltaT);

  // Apply custom terrain collision (matches server physics)
  // Only constrains Y, preserves XZ collision responses from tree bodies
  if (body) {
    const frequency = 0.1;
    const amplitude = 1.5;
    const terrainY =
      amplitude *
      Math.sin(frequency * body.position.x) *
      Math.sin(frequency * body.position.z);
    const groundY = terrainY; // Add capsule radius

    if (body.position.y <= groundY) {
      body.position.y = groundY;
      body.velocity.y = Math.max(0, body.velocity.y);
    }
  }

  if (characterControls) {
    // Server reconciliation happens AFTER physics step to not be overwritten
    // But apply it BEFORE updating visual position to avoid feedback loops
    if (serverTarget && networkClient && networkClient.connected) {
      const timeSinceUpdate = performance.now() - serverTarget.timestamp;

      // Only use server reconciliation if updates are recent (< 500ms)
      // Otherwise fall back to pure client prediction
      if (timeSinceUpdate < 500) {
        const targetX = serverTarget.x;
        const targetY = serverTarget.y;
        const targetZ = serverTarget.z;

        // Calculate errors
        const xzError = Math.sqrt(
          Math.pow(targetX - body.position.x, 2) +
            Math.pow(targetZ - body.position.z, 2),
        );
        const yError = Math.abs(targetY - body.position.y);

        // Don't reconcile if player is actively moving - trust client prediction
        // Only reconcile when idle or when error is huge (>2 units = major desync)
        const isActivelyMoving =
          Math.sqrt(
            body.velocity.x * body.velocity.x +
              body.velocity.z * body.velocity.z,
          ) > 1.0;
        const isMajorDesync = xzError > 2.0;

        if (!isActivelyMoving || isMajorDesync) {
          // Use a blend factor based on how recent the update is
          // Decay over 100ms since snapshots arrive every ~33ms at 30Hz
          const updateFreshness = Math.max(0, 1 - timeSinceUpdate / 100);
          const blendFactor = 0.1 * updateFreshness; // Reduced from 0.2 to avoid fighting

          // Only reconcile XZ if error is significant enough to avoid micro-jitter
          // Dead zone: ignore errors under 0.05 units
          if (xzError > 0.05) {
            body.position.x += (targetX - body.position.x) * blendFactor;
            body.position.z += (targetZ - body.position.z) * blendFactor;
          }

          // Only blend Y when actually jumping/falling - never when grounded
          // This prevents ground jitter from terrain collision differences
          const isActuallyAirborne =
            characterControls.isJumping && Math.abs(body.velocity.y) > 1.0;

          if (isActuallyAirborne && yError > 0.5) {
            body.position.y += (targetY - body.position.y) * blendFactor * 0.3; // Very gentle Y blend
          }
        }
      }
      // else: Server updates too old, trust client physics completely
    }
    // else: No server connection, trust client physics completely

    // Update visual position from physics body
    guy.position.copy(body.position);
    body.quaternion.copy(guy.quaternion);

    level.updatePlayerPlane(characterControls.model.position);
    level.handleCameraObstruction(camera, characterControls);
    updateShadowPosition();
    updatePlayerFootsteps();
    updateDistanceBasedFog(characterControls.model.position);

    // Send input to server (every other frame = 30fps to avoid rate limits)
    if (networkClient && networkClient.connected && frameCount % 2 === 0) {
      // Get camera direction (same as CharacterControls uses)
      camera.getWorldDirection(_cameraDirection);
      _cameraDirection.y = 0;
      _cameraDirection.normalize();

      _cameraRight.crossVectors(_cameraDirection, _upVector);
      _cameraRight.normalize();

      // Get input from WASD or joystick
      let inputForward = 0,
        inputRight = 0;

      if (IS_MOBILE && characterControls.joystick) {
        inputRight =
          characterControls.joystick.right - characterControls.joystick.left;
        inputForward = -characterControls.joystick.forward;
      } else {
        if (keysPressed[W]) inputForward += 1;
        if (keysPressed[S]) inputForward -= 1;
        if (keysPressed[D]) inputRight += 1;
        if (keysPressed[A]) inputRight -= 1;
      }

      // Transform to world space (same as CharacterControls)
      _worldDir.copy(_cameraDirection).multiplyScalar(inputForward);
      _worldDir.addScaledVector(_cameraRight, inputRight);

      // Normalize
      const len = _worldDir.length();
      if (len > 1) _worldDir.divideScalar(len);

      // Transform world direction to character-local space for server
      // Character forward is -Z at rotation 0
      const yaw = characterControls.model.rotation.y;
      const cosYaw = Math.cos(-yaw); // Negate because rotation is opposite
      const sinYaw = Math.sin(-yaw);

      const localMx = _worldDir.x * cosYaw - _worldDir.z * sinYaw;
      const localMz = _worldDir.x * sinYaw + _worldDir.z * cosYaw;

      const jumpPressed =
        keysPressed[SPACE] || characterControls.aPressed || false;

      // Send input every other frame (30Hz) to match server tick rate
      if (frameCount % 2 === 0) {
        networkClient.sendInput(localMx, localMz, yaw, jumpPressed);
        _msgSentCount++;
      }
    }

    if (frameCount % 10 === 0) {
      level.updateActiveObstructables(characterControls.model.position);
    }
  }

  // Update network players
  if (multiplayerManager) {
    multiplayerManager.update(deltaT);
  }

  orbitControls.update();
  wind.update();
  footprintSystem.update(deltaT);

  // Update chat bubbles with player positions
  if (chatBubbleRenderer) {
    const playerPositions = new Map();

    // Add local player position
    if (guy && networkClient && networkClient.playerId) {
      playerPositions.set(networkClient.playerId, guy.position);
    }

    // Add remote player positions
    if (multiplayerManager) {
      for (const [playerId, player] of multiplayerManager.networkPlayers) {
        playerPositions.set(playerId, player.model.position);
      }
    }

    chatBubbleRenderer.update(playerPositions);
  }

  level.updateSnowfall();
  renderer.render(scene, camera);
  frameCount++;
  stats.end();

  // Update network stats display (once per second)
  const now = performance.now();
  if (now - _lastNetStatsUpdate > 1000) {
    networkStats.innerHTML =
      `Ping: ${_pingTime.toFixed(0)} ms<br>` +
      `Sent: ${_msgSentCount} msg/s<br>Recv: ${_msgRecvCount} msg/s`;
    _msgSentCount = 0;
    _msgRecvCount = 0;
    _lastNetStatsUpdate = now;
  }

  requestAnimationFrame(animate);
}

function updateDistanceBasedFog(playerPos) {
  // Calculate distance from player to nearest map edge
  const distToEdgeX = Math.min(
    Math.abs(playerPos.x - mapBoundary),
    Math.abs(playerPos.x + mapBoundary),
  );
  const distToEdgeZ = Math.min(
    Math.abs(playerPos.z - mapBoundary),
    Math.abs(playerPos.z + mapBoundary),
  );
  const distToNearestEdge = Math.min(distToEdgeX, distToEdgeZ);

  // Define fog zones:
  // - Inner safe zone (> 100 units from edge): normal fog
  // - Transition zone (50-100 units from edge): progressive fog thickening
  // - Heavy fog zone (< 50 units from edge): very thick fog, player nearly invisible at edge
  const innerZone = 100;
  const transitionZone = 50;

  let fogMultiplier = 1.0;

  if (distToNearestEdge < innerZone) {
    if (distToNearestEdge < transitionZone) {
      // Heavy fog zone: 0-50 units from edge
      // At edge (0), fog is 10x thicker; at 50 units, fog is 2x thicker
      const edgeProximity = 1 - distToNearestEdge / transitionZone;
      fogMultiplier = 2.0 + edgeProximity * 8.0; // Ranges from 2.0 to 10.0
    } else {
      // Transition zone: 50-100 units from edge
      // Gradually increase fog from 1x to 2x
      const transitionFactor =
        1 - (distToNearestEdge - transitionZone) / (innerZone - transitionZone);
      fogMultiplier = 1.0 + transitionFactor; // Ranges from 1.0 to 2.0
    }
  }

  // Apply fog adjustment (reduce fog distance = thicker fog)
  scene.fog.near = baseFogNear / fogMultiplier;
  scene.fog.far = baseFogFar / fogMultiplier;
}

function updateShadowPosition() {
  const playerPos = guy.position;

  level.sunLight.position.set(
    playerPos.x - 60,
    playerPos.y + 100,
    playerPos.z - 10,
  );
  level.sunLight.target.position.set(playerPos.x, playerPos.y, playerPos.z);
  level.sunLight.target.updateMatrixWorld();
}

function updatePlayerFootsteps() {
  if (!characterControls) return;

  const playerPos = characterControls.model.position.clone();
  const playerDir = characterControls.walkDirection.clone().normalize();

  if (
    !characterControls.isJumping &&
    (!updatePlayerFootsteps.lastFootprint ||
      playerPos.distanceTo(updatePlayerFootsteps.lastFootprint) > 1.2)
  ) {
    footprintSystem.addFootprint(playerPos, playerDir);
    updatePlayerFootsteps.lastFootprint = playerPos.clone();
  }
}

let assetsLoaded = false;
let loadStartTime = Date.now();
let networkConnectionInitiated = false;
let networkAttemptComplete = false;
let sceneReady = false;

function checkAllLoadingComplete() {
  // Only hide loading screen when BOTH scene is ready AND network attempt is complete (success or failure)
  if (sceneReady && networkAttemptComplete) {
    // Hide customizer if in loading state
    if (mainMenu && mainMenu.isOpen) {
      mainMenu.close();
    }
    // Show HUD - force visible immediately
    const hudContainer = document.getElementById("hud-container");
    if (hudContainer) {
      hudContainer.classList.add("visible");
      // Force immediate visibility with inline style as fallback
      hudContainer.style.opacity = "1";
    }
  }
}

THREE.DefaultLoadingManager.onLoad = () => {
  assetsLoaded = true;
  checkAndStartGame();

  // Connect to network AFTER assets are loaded and scene is ready
  // This prevents main thread blocking during WebSocket handshake on iOS
  if (window._pendingNetworkConnection && !networkConnectionInitiated) {
    networkConnectionInitiated = true;
    // Use setTimeout to ensure we're not blocking
    setTimeout(() => {
      window._pendingNetworkConnection();
    }, 100);
  }
};

function checkAndStartGame() {
  const loading = document.getElementById("loading");
  const loadingBG = document.getElementById("loading-bg");

  if (!loading || !loadingBG) {
    animate();
    sceneReady = true;
    checkAllLoadingComplete();
    return;
  }

  const elapsed = Date.now() - loadStartTime;
  const minimumLoadTime = 1000; // 1 second minimum before starting animation

  if (elapsed < minimumLoadTime) {
    // Wait until 1 second has passed
    setTimeout(checkAndStartGame, minimumLoadTime - elapsed);
    return;
  }

  // Start animation
  animate();
  sceneReady = true;
  checkAllLoadingComplete();
}

function onWindowResize() {
  let width, height;
  if (IS_MOBILE) {
    width = window.innerWidth;
    // Find the top of the HUD controller image
    const hudBase = document.getElementById("hud-base");
    let hudTop = window.innerHeight;
    if (hudBase) {
      const rect = hudBase.getBoundingClientRect();
      // rect.top is relative to viewport top
      hudTop = rect.top;
    }
    height = Math.max(1, Math.floor(hudTop));
    // Set container and canvas height to this value
    if (canvasContainer) {
      canvasContainer.style.height = height + "px";
    }
    if (canvas) {
      canvas.style.height = height + "px";
    }
  } else {
    width = canvasContainer.clientWidth;
    height = canvasContainer.clientHeight;
  }

  // Ensure we have valid dimensions
  if (width <= 0 || height <= 0) {
    console.warn("[Resize] Invalid dimensions:", width, "x", height);
    return;
  }

  // Set canvas pixel size attributes to match display size
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

// Handle window resize
window.addEventListener("resize", onWindowResize);

// --- Robust mobile resize/orientation handling ---
function robustMobileResize() {
  let lastW = window.innerWidth,
    lastH = window.innerHeight;
  let count = 0;
  function pollResize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    if (w !== lastW || h !== lastH) {
      lastW = w;
      lastH = h;
      onWindowResize();
    }
    if (++count < 10) setTimeout(pollResize, 100); // poll for 1s
  }
  setTimeout(() => {
    onWindowResize();
    pollResize();
  }, 300); // initial delay to let UI settle
}

if (IS_MOBILE) {
  window.addEventListener("orientationchange", () => {
    robustMobileResize();
  });
  // Also run after load
  window.addEventListener("load", robustMobileResize);
}

// Cleanup on disconnect
window.addEventListener("beforeunload", () => {
  if (networkClient) {
    if (networkClient.voiceManager) {
      networkClient.voiceManager.disconnect();
    }
    networkClient.disconnect();
  }
});
