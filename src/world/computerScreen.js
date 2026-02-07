import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export class ComputerScreen {
  constructor(scene, camera, gLoader, networkClient) {
    this.scene = scene;
    this.camera = camera;
    this.gLoader = gLoader;
    this.networkClient = networkClient;
    this.computerModel = null;
    this.screenMesh = null;
    this.video = null;
    this.videoTexture = null;
    this.audioListener = null;
    this.isPlaying = false;
    this.audioRadius = 15; // Distance at which audio is heard at full volume
    this.maxAudioDistance = 30; // Distance at which audio is completely muted
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Set up click handler for unmuting
    if (typeof window !== 'undefined') {
      window.addEventListener('click', (e) => this._onMouseClick(e), false);
      window.addEventListener('touchend', (e) => this._onTouchClick(e), false);
    }

    // Video sync
    this.videoDuration = 0;
    this.pendingSyncTimestamp = undefined; // Sync timestamp queued if metadata not loaded
  }

  loadAssets() {
    return new Promise((resolve) => {
      this.gLoader.load("./assets/marble_computer.glb", (gltf) => {
        this.computerModel = gltf.scene;

        // Create screen plane
        const planeGeometry = new THREE.PlaneGeometry(7, 5.25);
        this.screenMesh = new THREE.Mesh(planeGeometry);
        this.screenMesh.position.set(0, 4.67, 2.3);
        this.computerModel.add(this.screenMesh);

        this.setupVideoTexture();
        resolve();
      });
    });
  }

  setupVideoTexture() {
    this.video = document.createElement("video");
    this.video.src = "/assets/ragnarok.mp4";
    this.video.loop = true;
    this.video.crossOrigin = "anonymous";
    this.video.muted = true;
    this.video.preload = "auto";
    this.video.playsInline = true; // Prevent fullscreen on iOS
    this.video.setAttribute("webkit-playsinline", "true"); // iOS 9 fallback

    this.video.onerror = () => {
      if (this.screenMesh) {
        this.screenMesh.material = new THREE.MeshBasicMaterial({
          color: 0x1a1a1a,
        });
      }
    };

    this.videoTexture = new THREE.VideoTexture(this.video);
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.videoTexture.wrapT = THREE.ClampToEdgeWrapping;

    const videoMaterial = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      toneMapped: false,
    });

    if (this.screenMesh) {
      this.screenMesh.userData.originalMaterial = this.screenMesh.material;
      this.screenMesh.material = videoMaterial;
    }

    // Store video duration when metadata loads
    this.video.addEventListener("loadedmetadata", () => {
      this.videoDuration = this.video.duration;
      
      // If we have a pending sync timestamp, apply it now that metadata is loaded
      if (this.pendingSyncTimestamp !== undefined) {
        this._seekToTimestamp(this.pendingSyncTimestamp);
        this.pendingSyncTimestamp = undefined;
      }
    });

    // Set up audio listener (for future spatial audio if needed)
    if (!this.audioListener) {
      this.audioListener = new THREE.AudioListener();
      this.camera.add(this.audioListener);
    }

    // Video sync will be requested after network connects (see requestVideoSync method)
  }

  _seekToTimestamp(serverTimestamp) {
    if (!this.video) return;
    
    // If metadata isn't loaded yet, queue for later
    if (this.videoDuration === 0) {
      this.pendingSyncTimestamp = serverTimestamp;
      return;
    }

    // Seek to the timestamp on the server (handle looping)
    const loopedTime = serverTimestamp % (this.videoDuration * 1000); // Convert duration to ms
    const seekTime = loopedTime / 1000; // Convert back to seconds for currentTime
    this.video.currentTime = seekTime;
  }

  syncVideoToServer(serverTimestamp) {
    if (!this.video) return;

    // Seek to the timestamp, or queue if metadata not ready
    this._seekToTimestamp(serverTimestamp);

    // Auto-play the video
    if (!this.isPlaying) {
      this.play();
    }
  }

  requestVideoSync() {
    if (!this.networkClient?.worldWs) return;

    if (this.networkClient.worldWs.readyState === WebSocket.OPEN) {
      this.networkClient.worldWs.send(JSON.stringify({ t: "getVideoSync" }));
    }
  }

  spawn(position) {
    if (!this.computerModel) return;

    this.computerModel.position.copy(position);
    this.computerModel.scale.set(0.5, 0.5, 0.5); // Scale computer model to half size
    this.scene.add(this.computerModel);
  }

  update(deltaT) {
    // Always update video texture to show current frame
    if (this.video && this.videoTexture) {
      // Update texture if video is ready
      if (this.video.readyState >= this.video.HAVE_CURRENT_DATA) {
        this.videoTexture.needsUpdate = true;
      }
    }

    // Update video volume based on proximity to screen
    if (this.video && this.screenMesh && this.isPlaying && !this.video.muted) {
      const screenWorldPos = this.screenMesh.getWorldPosition(
        new THREE.Vector3(),
      );
      const distance = this.camera.position.distanceTo(screenWorldPos);

      if (distance <= this.audioRadius) {
        // Full volume within audio radius
        this.video.volume = 1.0;
      } else if (distance < this.maxAudioDistance) {
        // Linear fade from full to zero between audioRadius and maxAudioDistance
        const fadeRange = this.maxAudioDistance - this.audioRadius;
        const distanceInFade = distance - this.audioRadius;
        const volume = 1.0 * (1 - distanceInFade / fadeRange);
        this.video.volume = Math.max(0, volume);
      } else {
        // Silent beyond max distance
        this.video.volume = 0;
      }
    } else if (!this.isPlaying && this.video) {
      this.video.volume = 0;
    }
  }

  play() {
    if (!this.video) return;

    console.log('%c▶️ Computer screen video playing', 'color: cyan; font-weight: bold');
    
    // On mobile, always start muted to avoid fullscreen behavior
    // On desktop, try unmuted first
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Mobile: always start muted to prevent fullscreen issues
      this.video.muted = true;
    } else {
      // Desktop: try unmuted first
      this.video.muted = false;
    }
    
    this.video.play().catch((error) => {
      // If autoplay is blocked, mute and try again
      console.log('%c⚠️ Autoplay blocked, muting and retrying', 'color: orange');
      this.video.muted = true;
      this.video.play().catch((retryError) => {
        console.error('%c❌ Video play failed:', 'color: red', retryError);
      });
    });
    this.isPlaying = true;
  }

  pause() {
    if (!this.video) return;
    // In cinema mode, don't allow pausing - video loops continuously
    // Instead, just mute the audio
    this.video.muted = true;
    this.isPlaying = false;
  }

  _onMouseClick(event) {
    if (!this.computerModel || !this.screenMesh) return;

    // Convert mouse position to normalized device coordinates
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    this.mouse.y = -(event.clientY - rect.top) / rect.height * 2 + 1;

    // Check if click hit the computer screen
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.computerModel, true);

    if (intersects.length > 0) {
      event.stopPropagation(); // Prevent orbit controls from handling this click
      this._unmute();
    }
  }

  _onTouchClick(event) {
    if (!this.computerModel || !this.screenMesh) return;

    const touch = event.changedTouches[0];
    const rect = event.target.getBoundingClientRect();
    this.mouse.x = (touch.clientX - rect.left) / rect.width * 2 - 1;
    this.mouse.y = -(touch.clientY - rect.top) / rect.height * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.computerModel, true);

    if (intersects.length > 0) {
      event.stopPropagation(); // Prevent orbit controls from handling this touch
      event.preventDefault(); // Prevent click event from also firing
      this._unmute();
    }
  }

  _unmute() {
    if (!this.video) return;

    // Toggle mute state
    if (this.video.muted) {
      console.log('%c🔊 Unmuting video', 'color: cyan; font-weight: bold');
      this.video.muted = false;
      this.video.play().catch((error) => {
        console.error('%c❌ Unmute play failed:', 'color: red', error);
        // Fallback: stay muted but playing
        this.video.muted = true;
        this.video.play();
      });
    } else {
      console.log('%c🔇 Muting video', 'color: cyan; font-weight: bold');
      this.video.muted = true;
    }
  }

  setPosition(position) {
    if (this.computerModel) {
      this.computerModel.position.copy(position);
    }
  }

  setRotation(rotation) {
    if (this.computerModel) {
      this.computerModel.rotation.copy(rotation);
    }
  }

  destroy() {
    if (this.video) {
      this.video.pause();
      this.video.src = "";
    }
    if (this.computerModel) {
      this.scene.remove(this.computerModel);
    }
  }
}
