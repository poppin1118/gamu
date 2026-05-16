export class Canvas {
  constructor(canvasEl, { logicalW = 256, logicalH = 240 } = {}) {
    this.el = canvasEl;
    this.lw = logicalW;
    this.lh = logicalH;
    this.el.width = logicalW;
    this.el.height = logicalH;
    this.ctx = this.el.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 1;

    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this._resize();
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.lw, this.lh);
  }

  _resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const portrait = vh > vw;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('landscape', !portrait);

    const fit = Math.min(vw / this.lw, vh / this.lh);
    const scale = Math.max(1, Math.floor(fit));
    this.scale = scale;
    const cssW = this.lw * scale;
    const cssH = this.lh * scale;
    this.el.style.width = cssW + 'px';
    this.el.style.height = cssH + 'px';
  }
}
