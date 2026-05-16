export class SpriteSheet {
  constructor(image, { tileSize = 16, spacing = 0, cols = 1 } = {}) {
    this.image = image;
    this.tileSize = tileSize;
    this.spacing = spacing;
    this.cols = cols;
    this.stride = tileSize + spacing;
  }

  draw(c, frameIdx, dx, dy, dw = this.tileSize, dh = this.tileSize, { flipX = false } = {}) {
    const col = frameIdx % this.cols;
    const row = (frameIdx / this.cols) | 0;
    const sx = col * this.stride;
    const sy = row * this.stride;
    if (!flipX) {
      c.drawImage(this.image, sx, sy, this.tileSize, this.tileSize, dx, dy, dw, dh);
      return;
    }
    c.save();
    c.translate(dx + dw, dy);
    c.scale(-1, 1);
    c.drawImage(this.image, sx, sy, this.tileSize, this.tileSize, 0, 0, dw, dh);
    c.restore();
  }
}
