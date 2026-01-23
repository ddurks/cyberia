/**
 * Character controller for player movement, animation, and interaction
 * Handles both keyboard and mobile joystick input
 * Manages player animations and physics integration
 */
import * as THREE from "three";
import { Joystick } from "./joystick.js";
import { W, A, S, D, SPACE, DIRECTIONS, JOY_DIRS } from "../core/constants.js";

export const footBoneNames = ["footl", "footr"];

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
  joystick = null;
  jumpRequested = false;
  prevJumpRequested = false;

  constructor(
    model,
    mixer,
    animationsMap,
    orbitControl,
    camera,
    currentAction,
    level,
    isMobile,
  ) {
    this.model = model;
    this.mixer = mixer;
    this.animationsMap = animationsMap;
    this.currentAction = currentAction;
    this.orbitControl = orbitControl;
    this.camera = camera;
    this.level = level;
    this.isMobile = isMobile;

    if (isMobile) {
      this.setupMobileControls();
    }

    this.skinnedMesh = this.model.getObjectByProperty("type", "SkinnedMesh");
    this.skeleton = this.skinnedMesh ? this.skinnedMesh.skeleton : null;
  }

  update(delta, keysPressed, body, raycaster, downVector) {
    const directionPressed = DIRECTIONS.some(
      (key) => keysPressed[key] === true,
    );
    const joystickPressed = this.joystick
      ? JOY_DIRS.some((key) => this.joystick[key] > 0)
      : false;

    const jumpRequested = keysPressed[SPACE] || this.aPressed;

    // Check if grounded by checking vertical velocity
    const isGrounded = Math.abs(body.velocity.y) < 1.0 && body.position.y < 50; // Simple ground check

    // Apply jump immediately when requested (not waiting for animation)
    if (
      jumpRequested &&
      !this.prevJumpRequested &&
      isGrounded &&
      !this.isJumping
    ) {
      body.velocity.y = 20; // Jump speed matches config
      this.isStartingJump = true;
      this.isJumping = true;
    }

    let play = this.currentAction;
    if (this.isStartingJump) {
      play = "jump";
    } else if (directionPressed || joystickPressed) {
      if (this.isJumping) {
        play = "float";
      } else {
        play = "run";
      }
      this.applyMovement(directionPressed, joystickPressed, keysPressed, body);
    } else {
      if (this.walkStart !== null) {
        this.walkStart = null;
        this.walkVelocity = this.defaultWalkVelocity;
      }
      play = "idle";
    }

    this.updateAnim(
      play,
      delta,
      this.isStartingJump
        ? () => {
            this.isStartingJump = false;
            // isJumping is already set, will be cleared when landing
          }
        : undefined,
    );
    if (this.level.planeMeshes) {
      this.adjustHeightFromTerrain(body, raycaster, downVector);
    }
    this.updateCameraTarget(body);
    this.prevJumpRequested = jumpRequested;
  }

  applyMovement(directionPressed, joystickPressed, keysPressed, body) {
    if (this.walkStart === null) {
      this.walkStart = Date.now();
    }

    // Get camera direction (flattened to XZ plane)
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    // Get camera right vector (perpendicular to camera direction)
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
    cameraRight.normalize();

    // Blend input direction
    let inputVec = new THREE.Vector3();
    if (this.isMobile && this.joystick) {
      const forward = -this.joystick.forward;
      const right = this.joystick.right - this.joystick.left;

      // Transform joystick input to camera space
      inputVec.copy(cameraDirection).multiplyScalar(forward);
      inputVec.add(cameraRight.clone().multiplyScalar(right));
    } else {
      let forward = 0,
        right = 0;
      if (keysPressed[W]) forward += 1;
      if (keysPressed[S]) forward -= 1;
      if (keysPressed[D]) right += 1;
      if (keysPressed[A]) right -= 1;

      // Transform keyboard input to camera space
      inputVec.copy(cameraDirection).multiplyScalar(forward);
      inputVec.add(cameraRight.clone().multiplyScalar(right));
    }

    if (inputVec.lengthSq() > 0) {
      inputVec.normalize();
      // Smoothly lerp walkDirection to inputVec
      this.walkDirection.lerp(inputVec, 0.2);
      // Face movement direction smoothly
      const targetAngle = Math.atan2(
        -this.walkDirection.x,
        -this.walkDirection.z,
      );
      this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, targetAngle);
      this.model.quaternion.slerp(this.rotateQuarternion, 0.2);

      // Apply velocity directly instead of lerping to avoid oscillation
      const targetVel = this.walkDirection
        .clone()
        .multiplyScalar(this.walkVelocity);
      body.velocity.x = targetVel.x;
      body.velocity.z = targetVel.z;
    } else {
      // Slow down smoothly when no input
      this.walkDirection.lerp(new THREE.Vector3(0, 0, 0), 0.2);
      body.velocity.x *= 0.8;
      body.velocity.z *= 0.8;
    }
  }

  adjustHeightFromTerrain(body, raycaster, downVector) {
    // Clear jumping flag when landing (low vertical velocity and near ground)
    if (this.isJumping) {
      if (Math.abs(body.velocity.y) < 1.0) {
        // Check if we're on ground via raycast
        raycaster.set(
          this.model.position.clone().add(new THREE.Vector3(0, 1, 0)),
          downVector,
        );
        const intersects = raycaster.intersectObjects(
          this.level.planeMeshes,
          true,
        );
        if (intersects.length > 0 && intersects[0].distance < 1.5) {
          this.isJumping = false;
        }
      }
    }

    // Let physics body handle Y position (no raycast override)
    // Stick feet to terrain for visual effect only
    if (!this.isJumping && this.level.planeMeshes) {
      this.stickFeetToTerrain(raycaster, downVector);
    }
  }

  stickFeetToTerrain(raycaster, downVector) {
    const tempVec = new THREE.Vector3();
    const tempQuatParentInv = new THREE.Quaternion();
    const playerForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.model.quaternion)
      .normalize();

    footBoneNames.forEach((boneName) => {
      const bone = this.skeleton.getBoneByName(boneName);
      if (!bone) return;

      bone.getWorldPosition(tempVec);

      raycaster.set(tempVec, downVector);
      const hit = raycaster.intersectObjects(this.level.planeMeshes, true)[0];
      if (!hit) return;

      const groundNormal = hit.face.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize();

      const yAxis = playerForward
        .clone()
        .projectOnPlane(groundNormal)
        .normalize(); // toes
      const xAxis = groundNormal.clone(); // foot bottom
      const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize(); // side of foot

      // Re-orthogonalize forward axis
      yAxis.crossVectors(zAxis, xAxis).normalize();

      // Detect mirrored bone and flip Z if needed
      const isRightFoot = bone.name.toLowerCase().includes("r");
      const xFinal = isRightFoot ? xAxis.clone().negate() : xAxis;
      const zFinal = isRightFoot ? zAxis.clone().negate() : zAxis;
      const mat = new THREE.Matrix4().makeBasis(xFinal, yAxis, zFinal);
      const worldQuat = new THREE.Quaternion().setFromRotationMatrix(mat);

      bone.parent.getWorldQuaternion(tempQuatParentInv).invert();
      const localQuat = worldQuat.clone().premultiply(tempQuatParentInv);

      bone.quaternion.slerp(localQuat, 0.3);
    });
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

  updateCameraTarget(body) {
    let moveX = body.position.x - body.lastPosition.x;
    let moveZ = body.position.z - body.lastPosition.z;
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

  setupMobileControls() {
    this.joystick = new Joystick();

    const buttonsConfig = {
      a: "cyberia_abutton",
      b: "cyberia_bbutton",
    };

    this.buttons = {};
    this.aPressed = false;
    this.bPressed = false;

    Object.entries(buttonsConfig).forEach(([key, baseName]) => {
      const el = document.getElementById(`button-${key}`);
      this.buttons[key] = el;

      el.addEventListener("touchstart", () => {
        el.src = `assets/hud/${baseName}_pressed.png`;
        this[`${key}Pressed`] = true;
      });

      el.addEventListener("touchend", () => {
        el.src = `assets/hud/${baseName}.png`;
        this[`${key}Pressed`] = false;
      });

      el.addEventListener("mousedown", () => {
        el.src = `assets/hud/${baseName}_pressed.png`;
        this[`${key}Pressed`] = true;
      });
      el.addEventListener("mouseup", () => {
        el.src = `assets/hud/${baseName}.png`;
        this[`${key}Pressed`] = false;
      });
    });
  }

  joyDirectionOffset(joystick) {
    var directionOffset = 0; // w

    if (this.joystick.forward > 0) {
      if (this.joystick.right > 0.25) {
        if (this.joystick.right > 0.75) {
          directionOffset = -Math.PI / 2; // d
        } else {
          directionOffset = -Math.PI / 4 - Math.PI / 2; // s+d
        }
      } else if (this.joystick.left > 0.25) {
        if (this.joystick.left > 0.75) {
          directionOffset = Math.PI / 2; // a
        } else {
          directionOffset = Math.PI / 4 + Math.PI / 2; // s+a
        }
      } else {
        directionOffset = Math.PI; // s
      }
    }
    if (this.joystick.backward > 0) {
      if (this.joystick.right > 0.25) {
        if (this.joystick.right > 0.75) {
          directionOffset = -Math.PI / 2; // d
        } else {
          directionOffset = -Math.PI / 4; // w+d
        }
      } else if (this.joystick.left > 0.25) {
        if (this.joystick.left > 0.75) {
          directionOffset = Math.PI / 2; // a
        } else {
          directionOffset = Math.PI / 4; // w+a
        }
      }
    }

    return directionOffset;
  }
}
