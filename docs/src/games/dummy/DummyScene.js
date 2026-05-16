import { Scene } from '../../engine/Scene.js';
import { Btn } from '../../engine/Input.js';

const W = 256;
const H = 240;
const BALL_R = 6;

export class DummyScene {
  async init(ctx) {
    this.ctx = ctx;
    this.x = W / 2;
    this.y = H / 2;
    this.vx = 90;
    this.vy = 70;
    this.hue = 0;
  }

  update(dt) {
    const input = this.ctx.input;

    if (input.wasPressed(Btn.START) || input.wasPressed(Btn.B)) {
      this.ctx.exitToMenu();
      return;
    }

    // Optional: directional nudge with D-pad to demo input wiring
    if (input.isDown(Btn.LEFT))  this.vx -= 60 * dt;
    if (input.isDown(Btn.RIGHT)) this.vx += 60 * dt;
    if (input.isDown(Btn.UP))    this.vy -= 60 * dt;
    if (input.isDown(Btn.DOWN))  this.vy += 60 * dt;
    if (input.wasPressed(Btn.A)) {
      this.vy = -180;
    }

    // Mild gravity to make it feel "alive"
    this.vy += 60 * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Bounce off walls
    if (this.x < BALL_R) { this.x = BALL_R; this.vx = Math.abs(this.vx); }
    if (this.x > W - BALL_R) { this.x = W - BALL_R; this.vx = -Math.abs(this.vx); }
    if (this.y < BALL_R) { this.y = BALL_R; this.vy = Math.abs(this.vy); }
    if (this.y > H - BALL_R) { this.y = H - BALL_R; this.vy = -Math.abs(this.vy) * 0.85; }

    this.hue = (this.hue + dt * 90) % 360;
  }

  render(c) {
    // Sky
    c.fillStyle = '#0e1a2b';
    c.fillRect(0, 0, W, H);

    // Floor stripes
    c.fillStyle = '#1a2747';
    for (let i = 0; i < W; i += 16) {
      c.fillRect(i, H - 24, 8, 24);
    }

    // Ball (pixel circle approximation)
    const r = BALL_R;
    c.fillStyle = `hsl(${this.hue}, 80%, 60%)`;
    const cx = Math.round(this.x);
    const cy = Math.round(this.y);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          c.fillRect(cx + dx, cy + dy, 1, 1);
        }
      }
    }

    // HUD
    drawText(c, 'DUMMY BOUNCER', W / 2, 12, 1, '#ffcc33', 'center');
    drawText(c, 'ENTER  EXIT', W / 2, H - 14, 1, '#6b7388', 'center');
  }

  destroy() {}
}

// Reuse a tiny inline font for HUD lines.
const FONT = {
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  'A': ['01110','10001','10001','11111','10001','10001','10001'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01110','10001','10000','10000','10000','10001','01110'],
  'D': ['11110','10001','10001','10001','10001','10001','11110'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'G': ['01110','10001','10000','10111','10001','10001','01110'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['01110','00100','00100','00100','00100','00100','01110'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10101','10001','10001','10001'],
  'N': ['10001','11001','10101','10011','10001','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'R': ['11110','10001','10001','11110','10100','10010','10001'],
  'S': ['01111','10000','10000','01110','00001','00001','11110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'X': ['10001','10001','01010','00100','01010','10001','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
};

function drawText(c, text, x, y, scale, color, align) {
  const charW = 6 * scale;
  const total = text.length * charW;
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  else if (align === 'right') cx = x - total;
  c.fillStyle = color;
  for (const ch of text) {
    const glyph = FONT[ch.toUpperCase()] || FONT[' '];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < 5; col++) {
        if (glyph[row][col] === '1') {
          c.fillRect(cx + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    cx += charW;
  }
}
