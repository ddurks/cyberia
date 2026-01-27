// Simple loading screen - just show/hide + progress bar
export class LoadingScreen {
  constructor() {
    this.progressBar = null;
    this.progressText = null;
  }

  show() {
    // Create progress bar
    const existing = document.getElementById("loading-progress-container");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "loading-progress-container";
    container.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: 300px;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 0 15px rgba(100, 200, 255, 0.3);
      z-index: 10002;
    `;

    this.progressBar = document.createElement("div");
    this.progressBar.style.cssText = `
      height: 100%;
      background: linear-gradient(90deg, #4db8ff, #00ff88);
      width: 0%;
      transition: width 0.2s ease;
      box-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
    `;
    container.appendChild(this.progressBar);

    this.progressText = document.createElement("div");
    this.progressText.style.cssText = `
      position: fixed;
      bottom: 62px;
      left: 50%;
      transform: translateX(-50%);
      color: #4db8ff;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 500;
      z-index: 10002;
    `;
    this.progressText.textContent = "0%";

    document.body.appendChild(container);
    document.body.appendChild(this.progressText);

    this._simulateProgress();
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
    // Jump to 100%
    if (this.progressBar) this.progressBar.style.width = "100%";
    if (this.progressText) this.progressText.textContent = "100%";

    // Fade out after a moment
    setTimeout(() => this.hide(), 300);
  }

  hide() {
    // Fade out loading screen
    const loadingBg = document.getElementById("loading-bg");
    const loadingImg = document.getElementById("loading");

    if (loadingBg) loadingBg.style.opacity = "0";
    if (loadingImg) loadingImg.style.opacity = "0";

    // Cleanup progress bar
    setTimeout(() => {
      const container = document.getElementById("loading-progress-container");
      if (container) container.remove();
      if (this.progressText && this.progressText.parentNode) {
        this.progressText.parentNode.removeChild(this.progressText);
      }
    }, 500);
  }
}
