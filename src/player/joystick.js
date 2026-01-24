import nipplejs from "nipplejs";

/**
 * Joystick input handler for mobile controls
 * Uses nipplejs library for touch-based movement input
 */
export class Joystick {
  backward = 0;
  forward = 0;
  right = 0;
  left = 0;

  constructor() {
    const options = {
      zone: document.getElementById("joystickWrapper1"),
      size: window.innerWidth / 4,
      multitouch: true,
      maxNumberOfNipples: 2,
      mode: "static",
      color: "transparent",
      restJoystick: true,
      shape: "circle",
      position: { left: "auto", right: "0px", bottom: "0px" },
      dynamicPage: true,
    };

    this.joyManager = nipplejs.create(options);

    this.joyManager["0"].on("move", (evt, data) => {
      this.forward = -data.vector.y;
      this.right = data.vector.x > 0 ? Math.abs(data.vector.x) : 0;
      this.left = data.vector.x < 0 ? Math.abs(data.vector.x) : 0;
    });

    this.joyManager["0"].on("end", (evt) => {
      this.forward = 0;
      this.backward = 0;
      this.left = 0;
      this.right = 0;
    });
  }
}
