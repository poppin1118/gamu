import { drawText } from '../../engine/PixelFont.js';
import { TOTAL_FLOORS } from './LevelGen.js';

const SCREEN_W = 256;
const SCREEN_H = 240;

export function renderHud(c, { score, floor, state }) {
  c.fillStyle = 'rgba(0, 0, 0, 0.55)';
  c.fillRect(0, 0, SCREEN_W, 12);

  drawText(c, `SCORE ${pad(score, 5)}`, 4, 3, { scale: 1, color: '#ffeeaa' });
  drawText(c, `FLOOR ${floor}/${TOTAL_FLOORS}`, 96, 3, { scale: 1, color: '#aaffee' });
  drawText(c, 'ENTER:EXIT', SCREEN_W - 4, 3, { scale: 1, color: '#a8b0c0', align: 'right' });

  if (state === 'won') {
    overlay(c, '#001a00');
    drawText(c, 'YOU MADE IT!', SCREEN_W / 2, 90, { scale: 2, color: '#ffcc33', align: 'center' });
    drawText(c, `SCORE ${score}`, SCREEN_W / 2, 120, { scale: 1, color: '#ffffff', align: 'center' });
    drawText(c, 'PRESS START', SCREEN_W / 2, 150, { scale: 1, color: '#a8b0c0', align: 'center' });
  } else if (state === 'lost') {
    overlay(c, '#1a0000');
    drawText(c, 'GAME OVER', SCREEN_W / 2, 90, { scale: 2, color: '#ff6666', align: 'center' });
    drawText(c, `SCORE ${score}`, SCREEN_W / 2, 120, { scale: 1, color: '#ffffff', align: 'center' });
    drawText(c, 'PRESS START', SCREEN_W / 2, 150, { scale: 1, color: '#a8b0c0', align: 'center' });
  }
}

function overlay(c) {
  c.fillStyle = 'rgba(0, 0, 0, 0.65)';
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

function pad(n, w) {
  return String(n).padStart(w, '0');
}
