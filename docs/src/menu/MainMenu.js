import { Scene } from '../engine/Scene.js';
import { Btn } from '../engine/Input.js';
import { listGames } from './GameRegistry.js';

export class MainMenu extends Scene {
  async init(ctx) {
    this.ctx = ctx;
    this.games = listGames();
    this.cursor = 0;
    this.blink = 0;
  }

  update(dt) {
    const input = this.ctx.input;
    this.blink = (this.blink + dt) % 1.0;

    if (input.wasPressed(Btn.UP))   this.cursor = (this.cursor - 1 + this.games.length) % this.games.length;
    if (input.wasPressed(Btn.DOWN)) this.cursor = (this.cursor + 1) % this.games.length;

    if (input.wasPressed(Btn.A) || input.wasPressed(Btn.START)) {
      const game = this.games[this.cursor];
      if (game) this.ctx.launchGame(game.id);
    }
  }

  render(c) {
    const { lw, lh } = this.ctx.canvas;

    // Background gradient sky
    const g = c.createLinearGradient(0, 0, 0, lh);
    g.addColorStop(0, '#1a2747');
    g.addColorStop(1, '#0b0f1a');
    c.fillStyle = g;
    c.fillRect(0, 0, lw, lh);

    // Pixel stars
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      const x = (i * 73) % lw;
      const y = (i * 41) % (lh / 2);
      c.fillRect(x, y, 1, 1);
    }

    // Title
    this._drawText(c, 'GAMU', lw / 2, 36, 3, '#ffcc33', 'center');
    this._drawText(c, 'GAME HUB', lw / 2, 64, 1, '#e8e8e8', 'center');

    // Game list
    const baseY = 110;
    const rowH = 16;
    for (let i = 0; i < this.games.length; i++) {
      const g = this.games[i];
      const y = baseY + i * rowH;
      const selected = i === this.cursor;
      const color = selected ? '#ffcc33' : '#a8b0c0';
      if (selected && this.blink < 0.5) {
        this._drawText(c, '>', 60, y, 1, color, 'left');
      }
      this._drawText(c, g.title.toUpperCase(), 76, y, 1, color, 'left');
    }

    // Footer hint
    this._drawText(c, '↑↓ SELECT  Z/ENTER START', lw / 2, lh - 18, 1, '#6b7388', 'center');
  }

  destroy() {}

  // Minimal vector "font" so M1 has no asset dependency.
  // Renders ASCII letters/digits with 5x7 grid of filled rects.
  _drawText(c, text, x, y, scale, color, align) {
    const charW = 5 * scale + scale;
    const total = text.length * charW;
    let cx = x;
    if (align === 'center') cx = x - total / 2;
    else if (align === 'right') cx = x - total;
    c.fillStyle = color;
    for (const ch of text) {
      drawChar(c, ch, cx, y, scale);
      cx += charW;
    }
  }
}

// --- minimal 5x7 bitmap font (uppercase, digits, arrows, basic punct) ---
const FONT = {
  ' ': [],
  'A': ['01110','10001','10001','11111','10001','10001','10001'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01110','10001','10000','10000','10000','10001','01110'],
  'D': ['11110','10001','10001','10001','10001','10001','11110'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'G': ['01110','10001','10000','10111','10001','10001','01110'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['01110','00100','00100','00100','00100','00100','01110'],
  'J': ['00001','00001','00001','00001','00001','10001','01110'],
  'K': ['10001','10010','10100','11000','10100','10010','10001'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10101','10001','10001','10001'],
  'N': ['10001','11001','10101','10011','10001','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'Q': ['01110','10001','10001','10001','10101','10010','01101'],
  'R': ['11110','10001','10001','11110','10100','10010','10001'],
  'S': ['01111','10000','10000','01110','00001','00001','11110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'V': ['10001','10001','10001','10001','10001','01010','00100'],
  'W': ['10001','10001','10001','10101','10101','11011','10001'],
  'X': ['10001','10001','01010','00100','01010','10001','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
  'Z': ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','11110','00001','00001','10001','01110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  '>': ['10000','01000','00100','00010','00100','01000','10000'],
  '↑': ['00100','01110','10101','00100','00100','00100','00100'],
  '↓': ['00100','00100','00100','00100','10101','01110','00100'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  ':': ['00000','00100','00100','00000','00100','00100','00000'],
  '.': ['00000','00000','00000','00000','00000','00100','00100'],
  '!': ['00100','00100','00100','00100','00100','00000','00100'],
  '?': ['01110','10001','00001','00010','00100','00000','00100'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

function drawChar(c, ch, x, y, scale) {
  const glyph = FONT[ch.toUpperCase()] || FONT[ch] || FONT[' '];
  for (let row = 0; row < glyph.length; row++) {
    for (let col = 0; col < 5; col++) {
      if (glyph[row][col] === '1') {
        c.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}
