import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Main Menu Screen
 * Character customization and loading screen for Cyberia
 */
export class MainMenu {
  constructor() {
    this.container = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.model = null;
    this.mixer = null;
    this.clock = new THREE.Clock();
    this.coatColor = { r: 0, g: 0, b: 0 };
    this.playerName = "cyberian";
    this.isOpen = false;
    this.isLoading = false;
    this.onConfirm = null;
    this.animationFrameId = null;
    this.contentWrapper = null;
    this.quipIndex = 0;
    this.quipRotationInterval = null;
    this.realProgress = 0; // Real progress from server
    this.displayedProgress = 0; // Displayed progress (smoothed)
    this.progressAnimationId = null;
    this.quips = [
      "Synchronizing Particle Systems...",
      "Loading Collective Consciousness...",
      "Harmonizing Production Networks...",
      "Warming Up Ideological Processing Units...",
      "Activating Central Authority Registry...",
      "Engaging State Security Protocols...",
      "Allocating Server Resources from State Reserves...",
      "Awakening Dormant Production Facilities...",
      "Five-Year Plan Requires Patience, Comrade...",
      "Workers Are Stoking The Digital Boilers...",
      "Central Processing Committee is Convening...",
      "Infrastructure Commissar is Reviewing Protocols...",
      "Nearly Ready, Glory to Digital Proletariat!",
      "Defrosting Mainframe From Cold Storage...",
      "Consulting With Ministry of Digital Affairs...",
      "Rewinding Magnetic Tape Spools...",
      "Requesting Clearance From Central Bureau...",
      "Calibrating Dialectical Computation Engine...",
      "Restoring Central Network Protocols...",
      "Invoking Spirit of Digital Revolution...",
      "Loading Data From State Archives...",
      "Authenticating Worker's Password Database...",
      "Synchronizing With International Server Collective...",
      "Centrally Analyzing Network Traffic...",
      "Preparing Gulag Resources for Computational Tasks...",
      "Decoding Secret Computer Transmissions...",
      "Activating Emergency Backup Computing Cells...",
      "Transmitting Encrypted Party Directives...",
      "Commissioning New Digital Collective Farm...",
      "Initializing Distributed Thought Processors...",
      "Verifying Loyalty of System Components...",
      "Deploying Extra Bandwidth To Eastern Sector...",
      "Coordinating With Cyberspace Command...",
      "Installing Patriotic Encryption Standards...",
      "Running Mandatory Worker Efficiency Audit...",
      "Flushing Counter-Revolutionary Cache...",
      "Queuing Tasks For Central Processing Authority...",
      "Synchronizing Clocks Across Server Collective...",
      "Defragmenting Communist Data Structures...",
      "Invoking Ancient Soviet Computing Spirits...",
      "Reorganizing Proletariat Database Indexes...",
      "Warming Up Superconducting Logic Circuits...",
      "Transmitting Patriotic System Signals...",
      "Awaiting Approval From Council of Ministers...",
      "Sanitizing Network For State Inspection...",
      "Preparing The People's Cooling Unit...",
    ];
    this.quipIndex = 0;
    this.quipRotationInterval = null;
    this._setupStyles();
  }

  _setupStyles() {
    // Add responsive styles via a style tag
    if (!document.getElementById("character-customizer-styles")) {
      const style = document.createElement("style");
      style.id = "main-menu-styles";
      style.textContent = `
        #main-menu {
          display: none;
          background: #3a3a3a;
        }
        
        #main-menu.open {
          display: flex !important;
          z-index: 99999;
          position: fixed;
          background: #3a3a3a;
          justify-content: center;
          align-items: flex-start;
          padding-top: 20px;
        }

        #main-menu-content {
          display: flex;
          flex-direction: column;
          gap: 5px;
          width: 33.333%;
          max-width: 350px;
          align-items: center;
          justify-content: flex-start;
          overflow: visible;
          max-height: none;
          padding: 10px 0 0 0;
          flex-shrink: 1;
          min-height: 0;
        }
        
        #main-menu-content > div:not(:first-child) {
          flex-shrink: 1;
          min-height: 0;
        }

        #model-preview {
          width: 100%;
          max-width: 280px;
          aspect-ratio: 280/251;
          flex-shrink: 1;
          background: white;
          position: relative;
          overflow: hidden;
        }

        #model-preview::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('./assets/antique_frame.png');
          background-size: 100% 100%;
          background-repeat: no-repeat;
          pointer-events: none;
          z-index: 10;
        }

        #model-preview canvas {
          display: block;
          margin: 0;
          padding: 0;
        }

        @media (max-width: 768px) {
          #main-menu {
            padding: 10px;
            justify-content: flex-start;
          }

          #main-menu-content {
            gap: 5px;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            width: 100%;
            overflow: visible;
            padding-bottom: 10px;
          }

          #model-preview {
            width: 90vw;
            max-width: 350px;
            aspect-ratio: 280/251;
            flex-shrink: 1;
          }

          #color-picker-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 480px) {
          #main-menu {
            padding: 8px;
            justify-content: flex-start;
          }

          #main-menu-content {
            width: 100% !important;
          }

          #model-preview {
            width: 100%;
            max-width: 100vw;
            height: 233px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Initialize the customizer UI
  async create() {
    // Create main container
    this.container = document.createElement("div");
    this.container.id = "main-menu";
    this.container.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #3a3a3a;
      z-index: 9999;
      font-family: 'Courier New', monospace;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    // Main content wrapper - single vertical column
    const contentWrapper = document.createElement("div");
    contentWrapper.id = "main-menu-content";
    contentWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: center;
      justify-content: flex-start;
      width: 100%;
      max-width: 350px;
      min-width: 0;
    `;
    this.contentWrapper = contentWrapper;

    // Create 3D preview container (match frame aspect ratio 530:475 ≈ 1.116:1)
    const previewContainer = document.createElement("div");
    previewContainer.id = "model-preview";
    previewContainer.style.cssText = `
      width: 100%;
      max-width: 280px;
      aspect-ratio: 280/251;
      background: white;
      flex-shrink: 1;
      position: relative;
      overflow: visible;
    `;
    contentWrapper.appendChild(previewContainer);

    // Logo overlay on preview (positioned relative to frame)
    const logoImg = document.createElement("img");
    logoImg.src = "./assets/cyberia.png";
    logoImg.style.cssText = `
      max-width: 120px;
      height: auto;
      filter: drop-shadow(0 0 10px rgba(0, 255, 0, 0.3));
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: 48px;
      pointer-events: none;
      z-index: 5;
    `;
    previewContainer.appendChild(logoImg);

    // Username label
    const nameLabel = document.createElement("label");
    nameLabel.id = "customizer-label-username";
    nameLabel.innerHTML =
      '<span style="color: #ff3333;">Имя</span><span style="color: #ffffff;">(username)</span><span style="color: #ff3333;">:</span>';
    nameLabel.style.cssText = `
      display: block;
      font-size: 14px;
      margin-bottom: 4px;
      letter-spacing: 1px;
      font-family: 'Courier New', monospace;
      width: 100%;
      box-sizing: border-box;
      padding: 0 10px;
    `;
    contentWrapper.appendChild(nameLabel);

    // Golden nameplate as username input
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "character-nameplate";
    nameInput.value = "cyberian";
    nameInput.maxLength = 32;
    nameInput.style.cssText = `
      width: 280px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #FFD700, #DAA520, #B8860B);
      color: #1a1a1a;
      font-family: 'Arial Black', sans-serif;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 1px;
      text-align: center;
      text-transform: uppercase;
      border: 2px solid #8B7500;
      border-radius: 4px;
      box-shadow: 
        inset 0 1px 0 rgba(255, 255, 255, 0.3),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3),
        0 4px 6px rgba(0, 0, 0, 0.4);
      text-shadow: 
        0 1px 1px rgba(255, 255, 255, 0.4),
        0 -1px 1px rgba(0, 0, 0, 0.3);
      outline: none;
      cursor: text;
      box-sizing: border-box;
    `;
    nameInput.addEventListener("focus", () => {
      nameInput.style.boxShadow =
        "inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 0 15px rgba(255, 215, 0, 0.8)";
    });
    nameInput.addEventListener("blur", () => {
      nameInput.style.boxShadow =
        "inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.4)";
    });
    nameInput.addEventListener("input", (e) => {
      this.playerName = e.target.value || "cyberian";
    });
    contentWrapper.appendChild(nameInput);

    // Color picker label
    const colorLabel = document.createElement("label");
    colorLabel.id = "customizer-label-color";
    colorLabel.innerHTML =
      '<span style="color: #ff3333;">Цвет</span><span style="color: #ffffff;">(color)</span><span style="color: #ff3333;">:</span>';
    colorLabel.style.cssText = `
      display: block;
      font-size: 14px;
      margin-bottom: 4px;
      letter-spacing: 1px;
      font-family: 'Courier New', monospace;
      width: 100%;
      box-sizing: border-box;
      padding: 0 10px;
      margin-top: 10px;
    `;
    contentWrapper.appendChild(colorLabel);

    // Native HTML5 color input for precise color selection
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.id = "color-picker-input";

    // Generate random color
    const randomColor = this._getRandomColor();
    colorInput.value = randomColor;
    colorInput.style.cssText = `
      width: 280px;
      height: 50px;
      border: 1px solid #999;
      cursor: pointer;
      margin-bottom: 15px;
      background: ${randomColor};
      box-sizing: border-box;
    `;

    // Set default coat color from random color
    const rgbValues = this._hexToRgb(randomColor);
    this.coatColor = rgbValues;

    colorInput.addEventListener("change", (e) => {
      const rgb = this._hexToRgb(e.target.value);
      this.coatColor = rgb;
      this.updateModelColor();
    });

    colorInput.addEventListener("input", (e) => {
      const rgb = this._hexToRgb(e.target.value);
      this.coatColor = rgb;
      this.updateModelColor();
    });

    contentWrapper.appendChild(colorInput);

    // Confirm button
    const confirmButton = document.createElement("button");
    confirmButton.innerHTML =
      '<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;"><span style="color: #cc2222;">ВОЙТИ В КИБЕРИЮ</span><span style="color: #ffffff; font-size: 12px;">(enter cyberia)</span></div>';
    confirmButton.style.cssText = `
      width: 280px;
      padding: 12px;
      border: 3px solid #1a1a1a;
      background: linear-gradient(135deg, #a8a8a8, #c0c0c0, #a8a8a8);
      color: #cc2222;
      font-family: 'Arial Black', sans-serif;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 2px;
      text-shadow: 
        -1px -1px 0 #1a1a1a,
        1px -1px 0 #1a1a1a,
        -1px 1px 0 #1a1a1a,
        1px 1px 0 #1a1a1a;
      box-sizing: border-box;
    `;

    confirmButton.addEventListener("mouseenter", () => {
      confirmButton.style.background =
        "linear-gradient(135deg, #c0c0c0, #d8d8d8, #c0c0c0)";
      confirmButton.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
    });

    confirmButton.addEventListener("mouseleave", () => {
      confirmButton.style.background =
        "linear-gradient(135deg, #a8a8a8, #c0c0c0, #a8a8a8)";
      confirmButton.style.boxShadow = "none";
    });

    confirmButton.addEventListener("click", () => {
      this.transitionToLoading();
      if (this.onConfirm) {
        this.onConfirm({
          name: this.playerName,
          coatColor: this.coatColor,
        });
      }
    });

    contentWrapper.appendChild(confirmButton);
    this.container.appendChild(contentWrapper);

    // Add to DOM
    document.body.appendChild(this.container);

    // Initialize 3D preview
    await this._initializPreview(previewContainer);
  }

  // Initialize 3D preview with character model
  async _initializPreview(container) {
    // Create scene for preview
    this.scene = new THREE.Scene();
    // Light white background
    this.scene.background = new THREE.Color(0xe8f0f8);

    // Use frame aspect ratio dimensions (530:475 ≈ 1.116:1)
    const width = 280;
    const height = 251;

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    // Position camera further back to accommodate logo overlay, bumped down
    this.camera.position.set(0, 0.4, 4.2);
    this.camera.lookAt(0, 0.1, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(280, 251);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Add snowy ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 4);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xc8c8c8 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    this.scene.add(ground);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Load character model
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync("./assets/cyberian.glb");
      this.model = gltf.scene;
      this.model.scale.set(0.25, 0.25, 0.25);
      // Center vertically better - position lower to fill viewport
      this.model.position.set(0, -0.3, 0);

      // Set up animation mixer
      this.mixer = new THREE.AnimationMixer(this.model);
      if (gltf.animations && gltf.animations.length > 0) {
        // Find idle animation or use first animation
        const idleAnim =
          gltf.animations.find(
            (anim) =>
              anim.name.toLowerCase().includes("idle") ||
              anim.name.toLowerCase().includes("stand"),
          ) || gltf.animations[0];

        if (idleAnim) {
          this.mixer.clipAction(idleAnim).play();
        }
      }

      // Set initial coat color
      this.model.traverse((object) => {
        if (
          object.isMesh &&
          object.material &&
          object.material.name === "snowsuit"
        ) {
          object.material.color.setRGB(
            this.coatColor.r / 255,
            this.coatColor.g / 255,
            this.coatColor.b / 255,
          );
        }
      });

      this.scene.add(this.model);

      // Start animation loop
      this._animatePreview();
    } catch (error) {
      console.error("Failed to load character model:", error);
    }
  }

  // Update model color based on picker selection
  // Get random color in hex format
  _getRandomColor() {
    const randomInt = Math.floor(Math.random() * 0xffffff);
    return "#" + randomInt.toString(16).padStart(6, "0");
  }

  // Convert hex color to RGB object
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 255, b: 255 }; // Default cyan
  }

  updateModelColor() {
    if (this.model) {
      this.model.traverse((object) => {
        if (
          object.isMesh &&
          object.material &&
          object.material.name === "snowsuit"
        ) {
          object.material.color.setRGB(
            this.coatColor.r / 255,
            this.coatColor.g / 255,
            this.coatColor.b / 255,
          );
        }
      });
    }
  }

  // Animation loop for preview
  _animatePreview() {
    this.animationFrameId = requestAnimationFrame(() => {
      this._animatePreview();
    });

    if (this.mixer && this.isOpen) {
      this.mixer.update(this.clock.getDelta());
    }

    if (this.renderer && this.camera && this.scene) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Show customizer
  open() {
    this.isOpen = true;
    this.container.classList.add("open");

    // Hide loading elements from HTML
    const loadingBg = document.getElementById("loading-bg");
    const loadingImg = document.getElementById("loading");
    if (loadingBg) loadingBg.style.display = "none";
    if (loadingImg) loadingImg.style.display = "none";

    // Force layout recalculation
    void this.container.offsetWidth;
    // Handle resize of preview canvas on show - use frame aspect ratio dimensions
    if (this.renderer) {
      this.renderer.setSize(280, 251);
      this.camera.aspect = 280 / 251;
      this.camera.updateProjectionMatrix();
    }
  }

  // Transition form to loading state with GIF and progress bar
  transitionToLoading() {
    if (this.isLoading || !this.contentWrapper) return;
    this.isLoading = true;

    // Remove the nameplate, username label, color label, color picker, and button from THIS menu only
    const elementsToRemove = document.querySelectorAll(
      "#character-nameplate, #customizer-label-username, #customizer-label-color, #color-picker-input, #main-menu button",
    );
    elementsToRemove.forEach((el) => {
      el.remove();
    });

    // Add loading GIF
    const gifContainer = document.createElement("div");
    gifContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    `;

    const loadingGif = document.createElement("img");
    loadingGif.src = "./assets/cyberia_loading.gif";
    loadingGif.style.cssText = `
      width: 220px;
      height: 220px;
      object-fit: contain;
    `;
    gifContainer.appendChild(loadingGif);

    // Add stage name and description (above progress bar)
    const stageInfo = document.createElement("div");
    stageInfo.id = "customizer-stage-info";
    stageInfo.style.cssText = `
      width: 280px;
      text-align: center;
      color: #00ff88;
      font-size: 14px;
      font-family: monospace;
      font-weight: bold;
      min-height: 40px;
      line-height: 1.4;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.6);
    `;
    stageInfo.textContent = "Initializing...";
    gifContainer.appendChild(stageInfo);

    // Add progress bar
    const progressContainer = document.createElement("div");
    progressContainer.style.cssText = `
      width: 280px;
      height: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 0 15px rgba(0, 255, 0, 0.3);
    `;

    const progressBar = document.createElement("div");
    progressBar.id = "customizer-progress-bar";
    progressBar.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #00ff00, #00ff88);
      width: 0%;
      transition: width 0.3s ease;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.8);
    `;
    progressContainer.appendChild(progressBar);
    gifContainer.appendChild(progressContainer);

    // Add status text (below progress bar)
    const statusText = document.createElement("div");
    statusText.id = "customizer-status-text";
    statusText.style.cssText = `
      color: #00ff88;
      font-size: 12px;
      font-family: monospace;
      font-weight: 500;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
      text-align: center;
      white-space: normal;
      max-width: 280px;
      min-height: 36px;
    `;
    statusText.textContent = this.quips[0];
    gifContainer.appendChild(statusText);

    // Start rotating quips every 3 seconds
    this.quipIndex = 0;
    this.quipRotationInterval = setInterval(() => {
      this.quipIndex = (this.quipIndex + 1) % this.quips.length;
      const statusElement = document.getElementById("customizer-status-text");
      if (statusElement) {
        statusElement.textContent = this.quips[this.quipIndex];
      } else {
        // Stop the interval if status element is removed
        clearInterval(this.quipRotationInterval);
      }
    }, 3000);

    // Append to content wrapper
    this.contentWrapper.appendChild(gifContainer);
  }

  // Update loading progress and status
  setLoadingProgress(percent) {
    if (!this.isLoading) return;

    // Clamp progress to 0-100%
    const newProgress = Math.max(0, Math.min(percent, 100));

    // Don't go backwards - only increase progress
    if (newProgress < this.realProgress) {
      return;
    }

    this.realProgress = newProgress;

    // If progress jump is large (>15%), smoothly interpolate
    if (Math.abs(newProgress - this.displayedProgress) > 5) {
      // Animate the progress bar smoothly
      this._animateProgress(this.displayedProgress, newProgress);
    } else {
      // Small jumps, update immediately
      this._updateDisplayedProgress(newProgress);
    }
  }

  _animateProgress(from, to) {
    // Cancel any existing animation
    if (this.progressAnimationId) {
      cancelAnimationFrame(this.progressAnimationId);
    }

    const startTime = Date.now();
    const duration = 800; // 800ms to animate
    const startProgress = from;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function: ease-out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentProgress =
        startProgress + (to - startProgress) * easeProgress;

      this._updateDisplayedProgress(currentProgress);

      if (progress < 1) {
        this.progressAnimationId = requestAnimationFrame(animate);
      } else {
        this._updateDisplayedProgress(to);
      }
    };

    this.progressAnimationId = requestAnimationFrame(animate);
  }

  _updateDisplayedProgress(percent) {
    this.displayedProgress = percent;

    // Update progress bar
    const progressBar = document.getElementById("customizer-progress-bar");
    if (progressBar) {
      progressBar.style.width = percent + "%";
    }
  }

  setLoadingStatus(message) {
    if (!this.isLoading) return;
    // Stop current quip rotation
    if (this.quipRotationInterval) {
      clearInterval(this.quipRotationInterval);
      this.quipRotationInterval = null;
    }
    const statusText = document.getElementById("customizer-status-text");
    if (statusText) {
      statusText.textContent = message;
    }
    // Resume quip rotation after 1 second to show message, then cycle through quips again
    setTimeout(() => {
      if (!this.isLoading) return;
      this.quipRotationInterval = setInterval(() => {
        this.quipIndex = (this.quipIndex + 1) % this.quips.length;
        const statusElement = document.getElementById("customizer-status-text");
        if (statusElement) {
          statusElement.textContent = this.quips[this.quipIndex];
        } else {
          clearInterval(this.quipRotationInterval);
        }
      }, 3000);
    }, 1000);
  }

  // Set detailed progress with stage information
  setDetailedProgress(progressData) {
    if (!this.isLoading) return;

    // Update stage info
    const stageInfo = document.getElementById("customizer-stage-info");
    if (stageInfo) {
      stageInfo.innerHTML = `
        <div style="font-size: 15px; margin-bottom: 2px;">${progressData.stageName}</div>
        <div style="font-size: 11px; color: #00dd77; font-weight: normal; text-shadow: 0 0 8px rgba(0, 221, 119, 0.5);">${progressData.stageDescription}</div>
      `;
    }

    // Update progress bar
    this.setLoadingProgress(progressData.progress);
  }

  // Hide customizer
  close() {
    this.isOpen = false;
    this.container.classList.remove("open");
  }

  // Cleanup
  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.progressAnimationId) {
      cancelAnimationFrame(this.progressAnimationId);
    }
    if (this.quipRotationInterval) {
      clearInterval(this.quipRotationInterval);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
