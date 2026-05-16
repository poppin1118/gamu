export class Camera {
  constructor({ viewH = 240, deadzoneTop = 96 } = {}) {
    this.y = 0;
    this.viewH = viewH;
    this.deadzoneTop = deadzoneTop;
  }

  setInitial(playerY) {
    this.y = playerY - (this.viewH - 64);
  }

  follow(playerY) {
    const newCamY = playerY - this.deadzoneTop;
    if (newCamY < this.y) this.y = newCamY;
  }
}
