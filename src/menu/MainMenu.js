import { Scene } from '../engine/Scene.js';
import { Btn } from '../engine/Input.js';
import { drawText } from '../engine/PixelFont.js';
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

    const g = c.createLinearGradient(0, 0, 0, lh);
    g.addColorStop(0, '#1a2747');
    g.addColorStop(1, '#0b0f1a');
    c.fillStyle = g;
    c.fillRect(0, 0, lw, lh);

    c.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      const x = (i * 73) % lw;
      const y = (i * 41) % (lh / 2);
      c.fillRect(x, y, 1, 1);
    }

    drawText(c, 'GAMU', lw / 2, 36, { scale: 3, color: '#ffcc33', align: 'center' });
    drawText(c, 'GAME HUB', lw / 2, 64, { scale: 1, color: '#e8e8e8', align: 'center' });

    const baseY = 110;
    const rowH = 16;
    for (let i = 0; i < this.games.length; i++) {
      const g = this.games[i];
      const y = baseY + i * rowH;
      const selected = i === this.cursor;
      const color = selected ? '#ffcc33' : '#a8b0c0';
      if (selected && this.blink < 0.5) {
        drawText(c, '>', 60, y, { scale: 1, color, align: 'left' });
      }
      drawText(c, g.title.toUpperCase(), 76, y, { scale: 1, color, align: 'left' });
    }

    drawText(c, '↑↓ SELECT  Z/ENTER START', lw / 2, lh - 18, { scale: 1, color: '#6b7388', align: 'center' });
  }

  destroy() {}
}
