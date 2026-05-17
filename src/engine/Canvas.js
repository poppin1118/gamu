export class Canvas {
  /**
   * 建立固定邏輯解析度 canvas，並以整數倍率縮放到可用視窗區域。
   *
   * @param {HTMLCanvasElement} canvas_el - 要管理的 canvas DOM 節點。
   * @param {object} options - 初始化選項。
   * @param {number} [options.logicalW=256] - 邏輯寬度。
   * @param {number} [options.logicalH=240] - 邏輯高度。
   * @returns {Canvas} Canvas 管理器實例。
   * @depends window.resize, window.orientationchange
   */
  constructor(canvas_el, { logicalW = 256, logicalH = 240 } = {}) {
    this.el = canvas_el;
    this.lw = logicalW;
    this.lh = logicalH;
    this.el.width = logicalW;
    this.el.height = logicalH;
    this.ctx = this.el.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 1;

    this._on_resize = this._resize.bind(this);
    window.addEventListener('resize', this._on_resize);
    window.addEventListener('orientationchange', this._on_resize);
    this._resize();
  }

  /**
   * 移除 Canvas 綁定的視窗事件監聽。
   *
   * @returns {void}
   * @depends window.removeEventListener
   */
  destroy() {
    window.removeEventListener('resize', this._on_resize);
    window.removeEventListener('orientationchange', this._on_resize);
  }

  /**
   * 以指定顏色清空整個邏輯畫面。
   *
   * @param {string} [color='#000'] - 填滿背景用的 CSS 色彩。
   * @returns {void}
   * @depends CanvasRenderingContext2D.fillRect
   */
  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.lw, this.lh);
  }

  /**
   * 依目前視窗尺寸與觸控控制帶狀態重算 canvas CSS 尺寸。
   *
   * @returns {void}
   * @depends document.body.classList, window.innerWidth, window.innerHeight
   */
  _resize() {
    const viewport_w = window.innerWidth;
    const viewport_h = window.innerHeight;

    const portrait = viewport_h > viewport_w;
    document.body.classList.toggle('portrait', portrait);
    document.body.classList.toggle('landscape', !portrait);

    const touch_visible = document.body.classList.contains('touch-enabled');
    // 手機豎屏時預留底部控制帶，避免 canvas 被虛擬按鈕遮住。
    const reserved_touch_h = portrait && touch_visible
      ? Math.min(Math.max(180, viewport_h * 0.4), 320)
      : 0;
    const available_h = Math.max(this.lh, viewport_h - reserved_touch_h);

    const fit = Math.min(viewport_w / this.lw, available_h / this.lh);
    const scale = touch_visible ? Math.max(1, fit) : Math.max(1, Math.floor(fit));
    this.scale = scale;
    const css_w = this.lw * scale;
    const css_h = this.lh * scale;
    this.el.style.width = css_w + 'px';
    this.el.style.height = css_h + 'px';
  }
}
