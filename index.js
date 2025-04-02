import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.139.0/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.117.1/examples/jsm/controls/OrbitControls.js";
import * as CANNON from "cannon";

var IS_MOBILE;
if (
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
    navigator.userAgent
  ) ||
  /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(14|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|14|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|84|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
    navigator.userAgent.substr(0, 4)
  )
) {
  IS_MOBILE = true;
} else {
  IS_MOBILE = false;
}
document.body.classList.add(IS_MOBILE ? "mobile" : "desktop");

export const W = "w";
export const A = "a";
export const S = "s";
export const D = "d";
export const SHIFT = "shift";
export const SPACE = " ";
export const DIRECTIONS = [W, A, S, D];

export const fwd = "forward";
export const back = "back";
export const lft = "left";
export const rt = "right";
export const JOY_DIRS = [fwd, back, lft, rt];

const keysPressed = {};
document.addEventListener(
  "keydown",
  (event) => {
    keysPressed[event.key.toLowerCase()] = true;
  },
  false
);
document.addEventListener(
  "keyup",
  (event) => {
    keysPressed[event.key.toLowerCase()] = false;
  },
  false
);

export class Joystick {
  backward = 0;
  forward = 0;
  right = 0;
  left = 0;

  constructor() {
    const options = {
      zone: document.getElementById("joystickWrapper1"),
      size: window.innerWidth / 3,
      multitouch: true,
      maxNumberOfNipples: 2,
      mode: "static",
      restJoystick: true,
      shape: "circle",
      color: 'red',
      position: { left: "auto", right: "0px", bottom: "0px" },
      dynamicPage: true,
    };

    this.joyManager = nipplejs.create(options);

    this.joyManager["0"].on("move", (evt, data) => {
      const forward = data.vector.y;
      const turn = data.vector.x;

      if (forward > 0) {
        this.backward = Math.abs(forward);
        this.forward = 0;
      } else if (forward < 0) {
        this.backward = 0;
        this.forward = Math.abs(forward);
      }

      if (turn > 0) {
        this.left = 0;
        this.right = Math.abs(turn);
      } else if (turn < 0) {
        this.left = Math.abs(turn);
        this.right = 0;
      }
    });

    this.joyManager["0"].on("end", (evt) => {
      this.forward = 0;
      this.backward = 0;
      this.left = 0;
      this.right = 0;
    });
  }
}

export class CharacterControls {
  walkDirection = new THREE.Vector3();
  rotateAngle = new THREE.Vector3(0, 1, 0);
  rotateQuarternion = new THREE.Quaternion();
  cameraTarget = new THREE.Vector3();
  defaultWalkVelocity = 10;
  walkVelocity = 10;
  fadeDuration = 0.2;
  oldPosition = null;
  walkStart = null;
  level = null;

  constructor(
    model,
    mixer,
    animationsMap,
    orbitControl,
    camera,
    currentAction,
    level
  ) {
    this.model = model;
    this.mixer = mixer;
    this.animationsMap = animationsMap;
    this.currentAction = currentAction;
    this.orbitControl = orbitControl;
    this.camera = camera;
    this.level = level;
  }

  update(delta, keysPressed, joystick, isMobile) {
    const directionPressed = DIRECTIONS.some(
      (key) => keysPressed[key] === true
    );
    const joystickPressed = joystick
      ? JOY_DIRS.some((key) => joystick[key] > 0)
      : false;

    var play = this.currentAction;
    if (keysPressed[SPACE] && !this.isJumping) {
      play = "jump";
      this.isStartingJump = true;
    } else if (this.isStartingJump) {
      play = "jump";
    } else if (directionPressed || joystickPressed) {
      if (!this.isJumping) {
        play = "run";
      }
      this.applyMovement(
        directionPressed,
        joystickPressed,
        keysPressed,
        joystick,
        isMobile
      );
    } else {
      if (this.walkStart !== null) {
        this.walkStart = null;
        this.walkVelocity = this.defaultWalkVelocity;
      }
      play = "idle";
    }

    if (this.level.planeMeshes) {
      this.adjustHeightFromTerrain();
    }

    this.updateAnim(
      play,
      delta,
      keysPressed[SPACE]
        ? () => {
            body.velocity.y = 100;
            this.isStartingJump = false;
            this.isJumping = true;
          }
        : undefined
    );
    this.updateCameraTarget();
  }

  applyMovement(
    directionPressed,
    joystickPressed,
    keysPressed,
    joystick,
    isMobile
  ) {
    if (this.walkStart === null) {
      this.walkStart = Date.now();
    }

    var angleYCameraDirection = Math.atan2(
      this.camera.position.x - this.model.position.x,
      this.camera.position.z - this.model.position.z
    );

    var directionOffset = isMobile
      ? this.joyDirectionOffset(joystick)
      : this.directionOffset(keysPressed);

    this.rotateQuarternion.setFromAxisAngle(
      this.rotateAngle,
      angleYCameraDirection + directionOffset
    );
    this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2);

    this.camera.getWorldDirection(this.walkDirection);
    this.walkDirection.y = 0;
    this.walkDirection.normalize();
    this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset);

    body.velocity.set(
      this.walkDirection.x * this.walkVelocity,
      body.velocity.y,
      this.walkDirection.z * this.walkVelocity
    );
  }

  adjustHeightFromTerrain() {
    if (this.isJumping) {
      if (body.velocity.y < 0) {
        raycaster.set(
          this.model.position.clone().add(new THREE.Vector3(0, 1, 0)),
          downVector
        );
        const intersects = raycaster.intersectObjects(
          this.level.planeMeshes,
          true
        );
        if (intersects.length > 0 && intersects[0].distance < 1.5) {
          this.isJumping = false;
        }
      }
    } else {
      raycaster.set(
        this.model.position.clone().add(new THREE.Vector3(0, 100, 0)),
        downVector
      );
      const intersects = raycaster.intersectObjects(
        this.level.planeMeshes,
        true
      );
      if (intersects.length > 0) {
        const targetY = intersects[0].point.y;
        this.model.position.y += (targetY - this.model.position.y) * 0.25;
        body.position.y = this.model.position.y;
      }
    }
  }

  updateAnim(play, delta, onComplete) {
    const current = this.animationsMap.get(this.currentAction);

    if (this.currentAction !== play) {
      const toPlay = this.animationsMap.get(play);
      current.fadeOut(this.fadeDuration);
      toPlay.reset().fadeIn(this.fadeDuration).play();

      this.currentAction = play;
    }
    var speedMultiplier = 1;
    if (this.walkStart !== null) {
      var deltat = Date.now() - this.walkStart;
      if (deltat > 2000) {
        speedMultiplier = deltat / 2000;
        if (speedMultiplier > 2) {
          speedMultiplier = 2;
        }
      }
      this.walkVelocity = this.defaultWalkVelocity * speedMultiplier;
    }
    this.mixer.update(delta * speedMultiplier);
    if (onComplete) {
      const handleAnimationFinished = (e) => {
        if (e.action === current) {
          this.mixer.removeEventListener("finished", handleAnimationFinished);
          onComplete();
        }
      };
      this.mixer.addEventListener("finished", handleAnimationFinished);
    }
  }

  updateCameraTarget() {
    let moveX =
      (body.velocity.x > 0 ? 1 : -1) *
      Math.abs(body.position.x - body.lastPosition.x);
    let moveZ =
      (body.velocity.z > 0 ? 1 : -1) *
      Math.abs(body.position.z - body.lastPosition.z);
    body.lastPosition = {
      x: body.position.x,
      y: body.position.y,
      z: body.position.z,
    };

    this.camera.position.x += moveX;
    this.camera.position.z += moveZ;

    this.cameraTarget.x = body.position.x;
    this.cameraTarget.y = body.position.y + 1;
    this.cameraTarget.z = body.position.z;
    this.orbitControl.target = this.cameraTarget;
  }

  directionOffset(keysPressed) {
    var directionOffset = 0; // w

    if (keysPressed[W]) {
      if (keysPressed[A]) {
        directionOffset = Math.PI / 4; // w+a
      } else if (keysPressed[D]) {
        directionOffset = -Math.PI / 4; // w+d
      }
    } else if (keysPressed[S]) {
      if (keysPressed[A]) {
        directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
      } else if (keysPressed[D]) {
        directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
      } else {
        directionOffset = Math.PI; // s
      }
    } else if (keysPressed[A]) {
      directionOffset = Math.PI / 2; // a
    } else if (keysPressed[D]) {
      directionOffset = -Math.PI / 2; // d
    }

    return directionOffset;
  }

  joyDirectionOffset(joystick) {
    var directionOffset = 0; // w

    if (joystick.forward > 0) {
      if (joystick.right > 0.25) {
        if (joystick.right > 0.75) {
          directionOffset = -Math.PI / 2; // d
        } else {
          directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
        }
      } else if (joystick.left > 0.25) {
        if (joystick.left > 0.75) {
          directionOffset = Math.PI / 2; // a
        } else {
          directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
        }
      } else {
        directionOffset = Math.PI; // s
      }
    }
    if (joystick.backward > 0) {
      if (joystick.right > 0.25) {
        if (joystick.right > 0.75) {
          directionOffset = -Math.PI / 2; // d
        } else {
          directionOffset = -Math.PI / 4; // w+d
        }
      } else if (joystick.left > 0.25) {
        if (joystick.left > 0.75) {
          directionOffset = Math.PI / 2; // a
        } else {
          directionOffset = Math.PI / 4; // w+a
        }
      }
    }

    return directionOffset;
  }
}

class FootprintSystem {
  constructor(scene, groundObjects) {
    this.scene = scene;
    this.groundObjects = groundObjects;
    this.footprints = [];
    this.lastFoot = "right";

    this.footprintTexture = this.createFootprintTexture();
    this.footprintTexture.needsUpdate = true;
    this.footprintTexture.generateMipmaps = false; // ✅ disable if you're not using mipmaps
    this.footprintTexture.minFilter = THREE.LinearFilter;
    this.footprintTexture.magFilter = THREE.LinearFilter;
  }

  createFootprintTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.1,
      size / 2,
      size / 2,
      size * 0.5
    );
    gradient.addColorStop(0, "rgba(10, 20, 60, 0.3)"); // Darker blue center
    gradient.addColorStop(1, "rgba(10, 20, 60, 0)"); // Fade to transparent

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size, size, 0, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  addFootprint(playerPosition, playerDirection) {
    const lateralOffset = 0.15;
    const stepBack = 0.2;

    const perp = new THREE.Vector3(
      -playerDirection.z,
      0,
      playerDirection.x
    ).normalize();
    const offset = perp
      .clone()
      .multiplyScalar(
        this.lastFoot === "right" ? lateralOffset : -lateralOffset
      );
    const back = playerDirection.clone().multiplyScalar(-stepBack);

    const footprintPos = playerPosition.clone().add(offset).add(back);

    raycaster.set(
      footprintPos.clone().add(new THREE.Vector3(0, 1, 0)),
      downVector
    );
    const intersects = raycaster.intersectObjects(this.groundObjects, true);
    if (intersects.length === 0) return;

    const { point, face, object } = intersects[0];
    const normal = face.normal.clone().transformDirection(object.matrixWorld);

    const footprintMaterial = new THREE.MeshBasicMaterial({
      map: this.footprintTexture,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.NormalBlending, // or AdditiveBlending for glow
      side: THREE.DoubleSide,
    });

    const footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.6),
      footprintMaterial
    );

    // Orient the footprint to match the ground normal (lays it flat on the ground)
    const up = new THREE.Vector3(0, 1, 0);
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    footprint.quaternion.copy(alignQuat);

    // Now rotate around the normal to face the movement direction
    const angle = Math.atan2(playerDirection.x, playerDirection.z);
    const normalAxis = normal.clone().normalize();
    const spinQuat = new THREE.Quaternion().setFromAxisAngle(normalAxis, angle);
    footprint.quaternion.premultiply(spinQuat);

    // FINAL: Small tilt around right axis in ground plane to lie footprint down
    const forwardDir = playerDirection
      .clone()
      .projectOnPlane(normal)
      .normalize();
    const rightDir = new THREE.Vector3()
      .crossVectors(normal, forwardDir)
      .normalize();

    // Tilt the footprint by 90 degrees around the "right" axis to lay it flat
    const tiltQuat = new THREE.Quaternion().setFromAxisAngle(
      rightDir,
      Math.PI / 2
    );
    footprint.quaternion.premultiply(tiltQuat);

    footprint.position.copy(point).add(normal.clone().multiplyScalar(0.1));

    this.scene.add(footprint);
    this.footprints.push({ mesh: footprint, life: 1.0 });

    this.lastFoot = this.lastFoot === "right" ? "left" : "right";
  }

  update(delta = 0.016) {
    for (let i = this.footprints.length - 1; i >= 0; i--) {
      const fp = this.footprints[i];
      fp.life -= delta * 0.25;
      fp.mesh.material.opacity = fp.life;
      fp.mesh.material.needsUpdate = true; // 🛠️ Force update for opacity to take effect

      if (fp.life <= 0) {
        this.scene.remove(fp.mesh);
        fp.mesh.geometry.dispose();
        fp.mesh.material.dispose();
        this.footprints.splice(i, 1);
      }
    }
  }
}

export class WindSystem {
  constructor() {
    this.angle = Math.random() * Math.PI * 2; // Wind starts in random direction
    this.speed = 0.05 + Math.random() * 0.05; // Random starting wind speed
    this.gustIntensity = 0.5; // Base fluctuation amount
    this.angleVariation = 0.005; // Small adjustments per frame
    this.speedVariation = 0.005; // How much wind speed oscillates
    this.minSpeed = 0.02;
    this.maxSpeed = 0.5;
  }

  update() {
    // Smoothly vary wind direction
    this.angle += (Math.random() - 0.5) * this.angleVariation;

    // Simulate gusts by making wind speeds oscillate up and down
    this.speed += (Math.random() - 0.5) * this.speedVariation;
    this.speed = Math.max(this.minSpeed, Math.min(this.speed, this.maxSpeed));

    // Calculate final wind vector
    this.windVector = new THREE.Vector3(
      Math.cos(this.angle) * this.speed,
      0, // No vertical wind force
      Math.sin(this.angle) * this.speed
    );
  }

  getWindForce() {
    return this.windVector;
  }
}

export class Level {
  spawnedPlanes = new Set();
  currentPlayerRoomX = 0;
  currentPlayerRoomZ = 0;
  planeSize = 100;
  planeMeshes = [];
  treeTypes = {};     // Holds tree { geometry, material }
  treeMeshes = {};    // Holds InstancedMesh for each tree type
  treeInstanceCounters = {}; // Track current count per type
  treeCollisionData = [];
  activeTreeBodies = [];
  spawnedTreeGroups = [];

  constructor() {
    this.light();

    this.checkAndSpawnPlane(0, 0);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (i !== 0 || j !== 0) {
          this.checkAndSpawnPlane(i * this.planeSize, j * this.planeSize);
        }
      }
    }
    this.initSnowfall();
  }

  light() {
    // 🌤️ Warm this.sunLight (Directional Light)
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.75); // Soft warm this.sunLight
    this.sunLight.position.set(-60, 100, 100);
    this.sunLight.castShadow = true;

    // Shadow adjustments for softer, more natural shadows
    this.sunLight.shadow.camera.top = 50;
    this.sunLight.shadow.camera.bottom = -50;
    this.sunLight.shadow.camera.left = -50;
    this.sunLight.shadow.camera.right = 50;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;

    // Softer shadows with more realistic diffusion
    this.sunLight.shadow.radius = 4;
    this.sunLight.shadow.bias = -0.0001;

    scene.add(this.sunLight);

    // ❄️ Cool Ambient Light for Snow Contrast
    const ambientLight = new THREE.AmbientLight(0xE3F2FD, 0.4); // Cold blue tone
    scene.add(ambientLight);

    // 🌊 Subtle Bounce Light (Reflects off snow)
    // const bounceLight = new THREE.DirectionalLight(0xb0e0ff, 0.2);
    // bounceLight.position.set(0, -50, 0); // Mimic light bouncing off the snow
    // scene.add(bounceLight);
  }

  // Calculate the adjusted global position for proper edge alignment with blending
  calculateHeight(x, z, localX, localZ, width) {
    // Constants for smooth hills
    const frequency = 0.1;
    const amplitude = 0.75;
    const edgeBlendWidth = 3; // Number of vertices from each edge where blending occurs

    // Calculate distance to nearest edge
    const edgeDistanceX = Math.min(localX, width - localX);
    const edgeDistanceZ = Math.min(localZ, width - localZ);
    const edgeDistance = Math.min(edgeDistanceX, edgeDistanceZ);

    // Determine blend factor (1 at center, 0 at edge)
    const blendFactor = Math.max(
      0,
      (edgeDistance - edgeBlendWidth) / edgeBlendWidth
    );

    // Inner vertices use the sinusoidal function for height, modulated by the blend factor
    return (
      amplitude *
      Math.sin(frequency * x) *
      Math.cos(frequency * z) *
      blendFactor
    );
  }

  createPlane(x, y, z) {
    const geometry = new THREE.PlaneGeometry(
      this.planeSize,
      this.planeSize,
      IS_MOBILE ? 20 : 50,
      IS_MOBILE ? 20 : 50
    );
    geometry.rotateX(-Math.PI * 0.5);

    // Access and modify vertex positions
    let positions = geometry.attributes.position.array;
    let width = Math.sqrt(positions.length / 3) - 1; // Number of vertices on one side of the square

    for (let i = 0, j = 0; i < positions.length; i += 3, j++) {
      const x = positions[i];
      const z = positions[i + 2];
      const localX = j % (width + 1);
      const localZ = Math.floor(j / (width + 1));
      const y = this.calculateHeight(x, z, localX, localZ, width);
      positions[i + 1] += y;
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
      map.repeat.set(1, 1); // Adjust tiling as needed
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
    scene.add(plane);
    return plane;
  }

  planeKey(x, z) {
    return `${x},${z}`;
  }

  checkAndSpawnPlane(x, z) {
    let key = this.planeKey(x, z);
    if (!this.spawnedPlanes.has(key)) {
      const newPlane = this.createPlane(
        x * this.planeSize,
        0,
        z * this.planeSize,
      );
      this.spawnedPlanes.add(key);
      this.planeMeshes.push(newPlane);
      this.placeTreesOnPlane(newPlane);
    }
  }


  updatePlayerPlane(playerPosition) {
    let newRoomX = Math.floor(playerPosition.x / this.planeSize);
    let newRoomZ = Math.floor(playerPosition.z / this.planeSize);

    // Check if player has entered a new room
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
          this.checkAndSpawnPlane(x + dx, z + dz, this.planeSize);
        }
      }
    }
  }

  placeTreesOnPlane(plane) {
    plane.updateMatrixWorld(true); // Make sure transforms are up to date
  
    const keys = Object.keys(this.treeTypes);
    if (!keys.length) return;
  
    const numTrees = 100+ Math.floor(Math.random() * 100);
  
    for (let i = 0; i < numTrees; i++) {
      const localX = (Math.random() - 0.5) * this.planeSize;
      const localZ = (Math.random() - 0.5) * this.planeSize;
  
      const localPosition = new THREE.Vector3(localX, 0, localZ);
      const worldPosition = localPosition.applyMatrix4(plane.matrixWorld);
  
      raycaster.set(worldPosition.clone().add(new THREE.Vector3(0, 100, 0)), downVector);
      const intersects = raycaster.intersectObject(plane, true);
      if (intersects.length === 0) continue;
  
      const { point, face } = intersects[0];
      const normal = face.normal.clone().normalize();
  
      // Random tree type
      const treeName = keys[Math.floor(Math.random() * keys.length)];
      const parts = this.treeTypes[treeName];
  
      const treeGroup = new THREE.Group();
  
      parts.forEach((part) => {
        const mesh = new THREE.Mesh(part.geometry, part.material.clone());
        mesh.castShadow = IS_MOBILE ? false : true;
        mesh.receiveShadow =  IS_MOBILE ? false : true;
        treeGroup.add(mesh);
      });
  
      // Align to ground normal and spin
      const up = new THREE.Vector3(0, 1, 0);
      const alignQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
      const rotationY = Math.random() * Math.PI * 2;
      const spinQuat = new THREE.Quaternion().setFromAxisAngle(normal, rotationY);
  
      treeGroup.quaternion.copy(alignQuat);
      treeGroup.quaternion.premultiply(spinQuat);
  
      const scale = 1 + Math.random();
      treeGroup.scale.setScalar(scale);
      const snowDepth = 0.15;
      treeGroup.position.copy(point).add(new THREE.Vector3(0, -snowDepth, 0));
      scene.add(treeGroup);

      this.spawnedTreeGroups.push({
        mesh: treeGroup,
        position: treeGroup.position.clone()
      });

      const bbox = new THREE.Box3().setFromObject(treeGroup);
      const height = bbox.max.y - bbox.min.y;
      const radius = (bbox.max.x - bbox.min.x + bbox.max.z - bbox.min.z) * 0.02;
      this.treeCollisionData.push({
        position: treeGroup.position.clone(),
        quaternion: treeGroup.quaternion.clone(),
        radius,
        height,
      });
    } 
  }

  updateTreeCollisions(playerPosition, activationRadius = 20) {
    this.treeCollisionData.forEach((data) => {
      if (!data || !data.position) return;
  
      const distance = playerPosition.distanceTo(data.position);
      if (distance < activationRadius && !data.body) {
        const shape = new CANNON.Cylinder(data.radius, data.radius, data.height, 8);
        const body = new CANNON.Body({
          mass: 0,
          shape: shape,
          position: new CANNON.Vec3(
            data.position.x,
            data.position.y + data.height / 2,
            data.position.z
          ),
        });
        body.quaternion.set(
          data.quaternion.x,
          data.quaternion.y,
          data.quaternion.z,
          data.quaternion.w
        );
  
        data.body = body;
        world.addBody(body);
      }
    });
  }

  updateTreeVisibility(playerPosition, viewDistance = 100) {
    this.spawnedTreeGroups.forEach(({ mesh, position }) => {
      const distSq = playerPosition.distanceToSquared(position);
      if (distSq < viewDistance * viewDistance) {
        mesh.visible = true;
      } else if (distSq > (viewDistance * 2) * (viewDistance * 2)) {
        // Too far — remove from scene and memory
        scene.remove(mesh);
        mesh.traverse(child => {
          if (child.isMesh) {
            child.geometry.dispose();
            child.material.dispose();
          }
        });
        // Remove from array
        this.spawnedTreeGroups = this.spawnedTreeGroups.filter(obj => obj.mesh !== mesh);
      } else {
        mesh.visible = false;
      }
      
    });
  }

  initSnowfall() {
    this.snowConfig = {
      particleCount: IS_MOBILE ? 500: 1000,
      boxSize: IS_MOBILE ? 50 : 100, // Area size around player
      height: 50, // How high snow starts above player
      fallSpeed: 0.1, // Base fall speed
      driftSpeed: 0.1, // Sideways drifting
    };

    this.snowGeometry = new THREE.BufferGeometry();
    this.snowPositions = new Float32Array(this.snowConfig.particleCount * 3);
    this.snowVelocities = new Float32Array(this.snowConfig.particleCount * 3);
    this.windAngle = Math.random() * Math.PI * 2; // Set initial wind direction
    this.windSpeed = 0.1; // Base wind strength
    this.windVariation = 0.02;
    this.windSpeedVariation = 0.5; // How much the wind speed fluctuates
    this.windSpeedMin = 0.5; // Minimum wind speed
    this.windSpeedMax = 0.1;

    for (let i = 0; i < this.snowConfig.particleCount; i++) {
      this.resetSnowflake(i, true); // Initialize snowflakes in the air
    }

    this.snowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.snowPositions, 3)
    );

    this.snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.8, // Smaller flakes
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      map: this.generateSnowflakeTexture(),
    });
    this.snowParticles = new THREE.Points(this.snowGeometry, this.snowMaterial);
    this.snowParticles.frustumCulled = false; // Prevents disappearing at angles

    scene.add(this.snowParticles);
  }

  updateSnowfall() {
    if (!this.snowGeometry || !this.snowGeometry.attributes.position) {
      return;
    }

    const positions = this.snowGeometry.attributes.position.array;
    const playerPos = camera.position;

    const windForce = wind.getWindForce();

    for (let i = 0; i < this.snowConfig.particleCount; i++) {
      const index = i * 3;

      positions[index] += windForce.x;
      positions[index + 1] -= this.snowConfig.fallSpeed;
      positions[index + 2] += windForce.z;

      // Reset snowflake if it falls below player view
      if (positions[index + 1] < playerPos.y - 10) {
        this.resetSnowflake(i, false);
      }
    }

    this.snowGeometry.attributes.position.needsUpdate = true;
  }

  resetSnowflake(i, init) {
    const index = i * 3;
    const playerPos = camera.position;

    this.snowPositions[index] =
      playerPos.x + (Math.random() - 0.5) * this.snowConfig.boxSize;
    this.snowPositions[index + 1] =
      playerPos.y + Math.random() * this.snowConfig.height;
    this.snowPositions[index + 2] =
      playerPos.z + (Math.random() - 0.5) * this.snowConfig.boxSize;

    if (!init) this.snowGeometry.attributes.position.needsUpdate = true;
  }

  generateSnowflakeTexture() {
    const size = 64; // Texture resolution
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, size, size);

    // Draw soft circular snowflake
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      1,
      size / 2,
      size / 2,
      size / 2
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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdedede);

const world = new CANNON.World();
world.defaultContactMaterial.contactEquationStiffness = 1e9;
world.defaultContactMaterial.contactEquationRelaxation = 4;

const canvasContainer = document.getElementById("canvas-container");
const canvas = document.getElementById("three-canvas");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight, false);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

const stats = new Stats();
stats.showPanel(0); // 0 = FPS, 1 = ms, 2 = memory
document.body.appendChild(stats.dom);

const camera = new THREE.PerspectiveCamera(
  75,
  canvas.clientWidth / canvas.clientHeight,
  0.1,
  100
);
camera.position.set(0, 50, 100);

const solver = new CANNON.GSSolver();
solver.iterations = 7;
solver.tolerance = 0.1;
world.solver = new CANNON.SplitSolver(solver);
world.gravity.set(0, -100, 0);
const physicsMaterial = new CANNON.Material("physics");
const physicsContactMaterial = new CANNON.ContactMaterial(
  physicsMaterial,
  physicsMaterial,
  {
    friction: 0.3,
    restitution: 0.0,
  }
);
world.addContactMaterial(physicsContactMaterial);

const fogColor = 0xddeeff; // Soft blueish-grey
scene.fog = new THREE.Fog(fogColor, 20, 70);
scene.background = new THREE.Color(fogColor);

const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.minDistance = 5;
orbitControls.maxDistance = 15;
orbitControls.enablePan = false;
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
orbitControls.update();

const level = new Level();
const wind = new WindSystem();
const footprintSystem = new FootprintSystem(scene, level.planeMeshes);

const gLoader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

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
    if (object.isMesh) object.castShadow = true;
  });
  guy = gltf.scene.children[0];
  guy.position.set(0, 1, 0);
  guy.scale.set(0.25, 0.25, 0.25);
  scene.add(guy);
  camera.position.add(guy.position);

  const slipperyMaterial = new CANNON.Material("slippery");
  slipperyMaterial.friction = 0;

  const shape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
  body = new CANNON.Body({
    mass: 1,
    material: slipperyMaterial,
  });
  body.addShape(shape);
  body.position.copy(guy.position);
  body.lastPosition = {
    x: body.position.x,
    y: body.position.y,
    z: body.position.z,
  };
  body.linearDamping = 0.999;
  world.addBody(body);

  const mixer = new THREE.AnimationMixer(guy);
  gltf.animations.forEach((a) => {
    animationsMap.set(a.name, mixer.clipAction(a));
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
    level
  );
});

const clock = new THREE.Clock();
const timeStep = 1 / 60;
function animate() {
  stats.begin()
  let deltaT = clock.getDelta();
  world.step(timeStep, deltaT);
  if (characterControls) {
    characterControls.update(deltaT, keysPressed, joystick, IS_MOBILE);
    guy.position.copy(body.position);
    body.quaternion.copy(guy.quaternion);
    level.updatePlayerPlane(characterControls.model.position);
    level.updateTreeCollisions(characterControls.model.position);
    // level.updateTreeVisibility(characterControls.model.position);
    updateShadowPosition();
    updatePlayerFootsteps();
  }
  orbitControls.update();
  wind.update();
  footprintSystem.update(deltaT);
  level.updateSnowfall();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(animate);
}

function updateShadowPosition() {
  const playerPos = guy.position; // Or use the player's actual position

  level.sunLight.position.set(
    playerPos.x - 60,
    playerPos.y + 100,
    playerPos.z - 10
  );
  level.sunLight.target.position.set(playerPos.x, playerPos.y, playerPos.z);
  level.sunLight.target.updateMatrixWorld();
}

function updatePlayerFootsteps() {
  if (!characterControls) return;

  const playerPos = characterControls.model.position.clone();
  const playerDir = characterControls.walkDirection.clone().normalize();

  // Add footprints at movement intervals
  if (
    !characterControls.isJumping &&
    (!updatePlayerFootsteps.lastFootprint ||
      playerPos.distanceTo(updatePlayerFootsteps.lastFootprint) > 1.2)
  ) {
    footprintSystem.addFootprint(playerPos, playerDir);
    updatePlayerFootsteps.lastFootprint = playerPos.clone();
  }
}

var joystick;
THREE.DefaultLoadingManager.onLoad = () => {
  document.getElementById("loading").outerHTML = "";
  if (IS_MOBILE) {
    joystick = new Joystick();
    document.body.classList.add("mobile");
  } else {
    document.body.classList.add("desktop");
  }
  animate();
};

function onWindowResize() {
  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false); // ⬅ prevents the canvas squish
}

window.addEventListener("resize", onWindowResize);
