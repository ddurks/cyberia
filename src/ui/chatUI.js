/**
 * Chat UI Component
 * Provides chat input interface for players - integrated into HUD
 * Supports both desktop (T key + button) and mobile (button only)
 */

export class ChatUI {
  constructor(networkClient, isMobile = false, controlsObject = null) {
    this.networkClient = networkClient;
    this.isMobile = isMobile;
    this.container = null;
    this.overlay = null;
    this.chatButton = null;
    this.input = null;
    this.visible = false;
    this.onChatSubmitted = null;
    this.controlsObject = controlsObject; // Object to disable/enable controls
  }

  create() {
    if (this.chatButton) {
      return;
    }
    // Create chat button
    this.chatButton = document.createElement("button");
    this.chatButton.id = "chat-button";
    this.chatButton.textContent = "CHAT (T)";
    this.chatButton.style.cssText = `
      position: absolute;
      top: -40px;
      left: 20px;
      width: auto;
      padding: 10px 8px;
      border: 2px solid #00ff00;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: ${this.isMobile ? "12px" : "13px"};
      font-weight: bold;
      cursor: pointer;
      z-index: 1000;
      outline: none;
      text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
      border-radius: 4px;
      transition: all 0.2s ease;
      box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
      pointer-events: auto;
      display: block;
    `;

    // Button hover effect
    this.chatButton.addEventListener("mouseenter", () => {
      this.chatButton.style.boxShadow =
        "0 0 20px rgba(0, 255, 0, 0.6), inset 0 0 10px rgba(0, 255, 0, 0.2)";
      this.chatButton.style.background = "rgba(0, 0, 0, 0.95)";
    });

    this.chatButton.addEventListener("mouseleave", () => {
      this.chatButton.style.boxShadow = "0 0 10px rgba(0, 255, 0, 0.3)";
      this.chatButton.style.background = "rgba(0, 0, 0, 0.85)";
    });

    // Button click to open chat
    this.chatButton.addEventListener("click", () => {
      this.show();
    });

    // Create overlay to darken screen when chat is open
    this.overlay = document.createElement("div");
    this.overlay.id = "chat-overlay";
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: auto;
    `;
    this.overlay.addEventListener("click", () => {
      this.hide();
    });

    // Create input container
    this.container = document.createElement("div");
    this.container.id = "chat-input-container";
    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      display: none;
      z-index: 101;
      font-family: 'Courier New', monospace;
      pointer-events: auto;
      padding: 10px 8px;
      box-sizing: border-box;
      transition: top 0.3s ease;
      opacity: 1;
    `;

    // Create textarea instead of input for multiline support
    this.input = document.createElement("textarea");
    this.input.id = "chat-input";
    this.input.placeholder = "Type message... (max 256 chars)";
    this.input.maxLength = 256;
    this.input.style.cssText = `
      width: 100%;
      max-height: 120px;
      padding: 10px;
      border: 2px solid #00ff00;
      background: rgba(0, 0, 0, 0.25);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      box-sizing: border-box;
      outline: none;
      text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
      border-radius: 4px;
      resize: none;
      line-height: 1.4;
    `;

    // Focus styles
    this.input.addEventListener("focus", () => {
      this.input.style.boxShadow = "0 0 20px rgba(0, 255, 0, 0.6)";
      // Disable player controls while typing
      if (this.controlsObject) {
        this.controlsObject.disabled = true;
      }
    });

    // Enforce character limit on input
    this.input.addEventListener("input", () => {
      if (this.input.value.length > 256) {
        this.input.value = this.input.value.substring(0, 256);
      }
    });

    this.input.addEventListener("blur", () => {
      this.input.style.boxShadow = "none";
      // On mobile, submit chat if there's text when blur fires (iOS Done key)
      if (this.isMobile && this.input.value.trim()) {
        const text = this.input.value.trim();
        this.submitChat(text);
        this.input.value = "";
        this.hide();
        return;
      }
      // Close chat when clicking outside the input (but not immediately, allow click event to process)
      setTimeout(() => {
        if (this.visible && document.activeElement !== this.input) {
          this.hide();
        }
      }, 50);
      // Re-enable player controls when focus lost
      if (this.controlsObject) {
        this.controlsObject.disabled = false;
      }
    });

    // Handle Enter key (Ctrl+Enter for multiline)
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // Allow Shift+Enter for new lines, but Ctrl+Enter or just Enter to send on desktop
        if (!e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          const text = this.input.value.trim();
          if (text) {
            this.submitChat(text);
            this.input.value = "";
          }
          this.hide();
        }
      } else if (e.key === "Escape") {
        this.hide();
      }
    });

    // Handle focus loss on mobile
    if (this.isMobile) {
      this.input.addEventListener("blur", () => {
        this.hide();
      });
    }

    this.container.appendChild(this.input);

    // Append to HUD container
    const hudContainer = document.getElementById("hud-container");
    if (hudContainer) {
      hudContainer.appendChild(this.chatButton);
      hudContainer.appendChild(this.container);
    } else {
      // Fallback to body if HUD doesn't exist
      document.body.appendChild(this.chatButton);
      document.body.appendChild(this.container);
    }

    // Append overlay to body (not HUD, so it covers everything)
    document.body.appendChild(this.overlay);

    // Desktop: Listen for T key to show chat
    if (!this.isMobile) {
      document.addEventListener("keydown", (e) => {
        if (e.key.toLowerCase() === "t" && !this.visible) {
          // Don't open chat if typing elsewhere
          if (
            document.activeElement === document.body ||
            document.activeElement === document.documentElement
          ) {
            e.preventDefault();
            this.show();
          }
        }
      });
    }
  }

  show() {
    this.visible = true;
    this.chatButton.style.display = "none";
    this.container.style.display = "block";
    this.overlay.style.display = "block";
    // Slide from top: 0 (hidden) to top: -69px (visible)
    requestAnimationFrame(() => {
      this.container.style.top = "-69px";
      this.overlay.style.opacity = "1";
    });
    this.input.focus();
    // Disable controls when showing chat
    if (this.controlsObject) {
      this.controlsObject.disabled = true;
    }
  }

  hide() {
    this.visible = false;
    this.chatButton.style.display = "block";
    // Slide back from top: -69px (visible) to top: 0 (hidden)
    this.container.style.top = "0";
    this.overlay.style.opacity = "0";
    // Hide after animation completes
    setTimeout(() => {
      if (!this.visible) {
        this.container.style.display = "none";
        this.overlay.style.display = "none";
      }
    }, 300);
    this.input.blur();
    // Re-enable controls when hiding chat
    if (this.controlsObject) {
      this.controlsObject.disabled = false;
    }
  }

  submitChat(text) {
    if (!this.networkClient || !this.networkClient.worldWs) {
      return;
    }

    try {
      this.networkClient.worldWs.send(
        JSON.stringify({
          t: "chat",
          text: text.substring(0, 256), // Enforce length limit
        }),
      );
    } catch (error) {
      console.error("[ChatUI] Error sending chat:", error);
    }
  }

  destroy() {
    if (this.chatButton && this.chatButton.parentNode) {
      this.chatButton.parentNode.removeChild(this.chatButton);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
