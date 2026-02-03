// Simple loading screen - just show/hide + progress bar
export class LoadingScreen {
  constructor() {
    this.progressBar = null;
    this.progressText = null;
    this.statusText = null;
    this.realProgress = 0; // Real progress from server
    this.tasksInterval = null;
    this.currentTaskIndex = 0;

    // Startup tasks during server provisioning
    this.startupTasks = [
      "Synchronizing Particle Systems",
      "Loading Collective Consciousness",
      "Harmonizing Production Networks",
      "Warming Up Ideological Processing Units",
      "Activating Central Authority Registry",
      "Engaging State Security Protocols",
      "Allocating Server Resources from State Reserves...",
      "Awakening Dormant Production Facilities...",
      "Five-Year Plan Requires Patience, Comrade...",
      "Workers Are Stoking The Digital Boilers...",
      "Central Processing Committee is Convening...",
      "Infrastructure Commissar is Reviewing Protocols...",
      "Nearly Ready, Glory to Digital Proletariat!",
    ];
  }

  show() {
    // Clean up any existing loading elements
    const existing = document.getElementById("loading-progress-container");
    if (existing) existing.remove();
    if (this.statusText && this.statusText.parentNode) {
      this.statusText.parentNode.removeChild(this.statusText);
    }
    if (this.progressText && this.progressText.parentNode) {
      this.progressText.parentNode.removeChild(this.progressText);
    }

    // Create progress bar
    const container = document.createElement("div");
    container.id = "loading-progress-container";
    container.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      height: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 0 15px rgba(0, 255, 0, 0.3);
      z-index: 10002;
      transition: opacity 0.3s ease;
    `;

    this.progressBar = document.createElement("div");
    this.progressBar.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #00ff00, #00ff88);
      width: 0%;
      transition: width 0.2s ease;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.8);
    `;
    container.appendChild(this.progressBar);

    // Status text above progress bar
    this.statusText = document.createElement("div");
    this.statusText.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      color: #00ff88;
      font-size: 12px;
      font-family: monospace;
      font-weight: 500;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
      z-index: 10002;
      transition: opacity 0.3s ease;
      text-align: center;
      white-space: normal;
      max-width: 500px;
    `;
    this.statusText.textContent = this.startupTasks[0];

    // Progress text below progress bar
    this.progressText = document.createElement("div");
    this.progressText.style.cssText = `
      position: fixed;
      bottom: 58px;
      left: 50%;
      transform: translateX(-50%);
      color: #00ff00;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      text-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
      z-index: 10002;
      transition: opacity 0.3s ease;
    `;
    this.progressText.textContent = "0%";

    document.body.appendChild(container);
    document.body.appendChild(this.statusText);
    document.body.appendChild(this.progressText);

    // Start rotating startup tasks
    this.startTaskRotation();
  }

  setStatus(message) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
  }

  startTaskRotation() {
    // Rotate startup tasks every 1.5 seconds during provisioning
    this.tasksInterval = setInterval(() => {
      this.currentTaskIndex =
        (this.currentTaskIndex + 1) % this.startupTasks.length;
      if (this.statusText) {
        this.statusText.style.opacity = "0.4";
        setTimeout(() => {
          if (this.statusText) {
            this.statusText.textContent =
              this.startupTasks[this.currentTaskIndex];
            this.statusText.style.opacity = "1";
          }
        }, 150);
      }
    }, 1500); // Update every 1.5 seconds
  }

  stopTaskRotation() {
    if (this.tasksInterval) {
      clearInterval(this.tasksInterval);
      this.tasksInterval = null;
    }
  }

  setProgress(percent) {
    // Update progress from server (real progress, not simulated)
    if (this.progressBar) {
      this.progressBar.style.width = percent + "%";
    }
    if (this.progressText) {
      this.progressText.textContent = Math.round(percent) + "%";
    }
    this.realProgress = percent;
  }

  _simulateProgress() {
    let progress = 0;
    const intervals = [
      { delay: 500, increment: 5 },
      { delay: 800, increment: 8 },
      { delay: 1200, increment: 12 },
      { delay: 1800, increment: 15 },
      { delay: 2500, increment: 20 },
      { delay: 3200, increment: 25 },
    ];

    let index = 0;
    const updateProgress = () => {
      if (index >= intervals.length) return;

      const interval = intervals[index];
      setTimeout(() => {
        progress = Math.min(progress + interval.increment, 95);
        if (this.progressBar) this.progressBar.style.width = progress + "%";
        if (this.progressText)
          this.progressText.textContent = Math.round(progress) + "%";
        index++;
        updateProgress();
      }, interval.delay);
    };

    updateProgress();
  }

  complete() {
    // Stop task rotation
    this.stopTaskRotation();

    // Jump to 100%
    if (this.progressBar) this.progressBar.style.width = "100%";
    if (this.progressText) this.progressText.textContent = "100%";

    // Fade out progress bar and logo first
    setTimeout(() => {
      const container = document.getElementById("loading-progress-container");
      const logo = document.getElementById("cyberia-logo");
      if (container) container.style.opacity = "0";
      if (this.progressText) this.progressText.style.opacity = "0";
      if (this.statusText) this.statusText.style.opacity = "0";
      if (logo) logo.style.opacity = "0";
    }, 200);

    // Then fade out the rest of the loading screen
    setTimeout(() => this.hide(), 500);
  }

  hide() {
    // Fade out loading screen
    const loadingBg = document.getElementById("loading-bg");
    const loadingImg = document.getElementById("loading");

    if (loadingBg) loadingBg.style.opacity = "0";
    if (loadingImg) loadingImg.style.opacity = "0";

    // Cleanup progress bar and rotate intervals
    this.stopTaskRotation();

    // Cleanup progress bar
    setTimeout(() => {
      const container = document.getElementById("loading-progress-container");
      if (container) container.remove();
      if (this.progressText && this.progressText.parentNode) {
        this.progressText.parentNode.removeChild(this.progressText);
      }
      if (this.statusText && this.statusText.parentNode) {
        this.statusText.parentNode.removeChild(this.statusText);
      }
    }, 500);
  }
}
