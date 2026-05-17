import { Btn } from './Input.js';

const BUTTON_DEFINITIONS = [
  { btn: Btn.UP, label: '▲', title: 'Up', area: 'dpad', slot: 'up' },
  { btn: Btn.LEFT, label: '◀', title: 'Left', area: 'dpad', slot: 'left' },
  { btn: Btn.RIGHT, label: '▶', title: 'Right', area: 'dpad', slot: 'right' },
  { btn: Btn.DOWN, label: '▼', title: 'Down', area: 'dpad', slot: 'down' },
  { btn: Btn.A, label: 'A', title: 'Jump', area: 'actions', slot: 'a' },
  { btn: Btn.B, label: 'B', title: 'Hammer', area: 'actions', slot: 'b' },
  { btn: Btn.START, label: 'START', title: 'Start', area: 'system', slot: 'start' },
];

/**
 * DOM 觸控覆蓋層，將多點 pointer 事件轉成 InputState 按鍵狀態。
 */
export class TouchOverlay {
  /**
   * 建立觸控覆蓋層控制器。
   *
   * @param {object} options - 初始化選項。
   * @param {HTMLElement} options.root - 承載觸控按鈕的根 DOM 節點。
   * @param {import('./Input.js').InputState} options.input_state - 要寫入的輸入狀態。
   * @param {MediaQueryList} [options.media_query] - coarse pointer 偵測來源。
   * @returns {TouchOverlay} 觸控覆蓋層實例。
   * @depends Btn, InputState.set, window.matchMedia
   */
  constructor({ root, input_state, media_query = window.matchMedia('(pointer: coarse)') }) {
    this.root = root;
    this.input_state = input_state;
    this.media_query = media_query;
    this.active_pointers = new Map();
    this.button_counts = new Map();
    this.buttons = new Map();
    this.force_mode = new URLSearchParams(window.location.search).get('touch');

    this._on_pointer_down = this._on_pointer_down.bind(this);
    this._on_pointer_up = this._on_pointer_up.bind(this);
    this._on_context_menu = this._on_context_menu.bind(this);
    this._on_visibility_change = this._on_visibility_change.bind(this);
    this._on_window_blur = this._on_window_blur.bind(this);
  }

  /**
   * 建立 DOM、綁定事件並依裝置能力切換顯示狀態。
   *
   * @returns {void}
   * @depends HTMLElement.addEventListener, MediaQueryList
   */
  attach() {
    if (!this.root) return;
    this._build_controls();
    this.root.addEventListener('contextmenu', this._on_context_menu);
    window.addEventListener('resize', this._on_visibility_change);
    window.addEventListener('orientationchange', this._on_visibility_change);
    window.addEventListener('blur', this._on_window_blur);
    document.addEventListener('visibilitychange', this._on_visibility_change);

    if (typeof this.media_query.addEventListener === 'function') {
      this.media_query.addEventListener('change', this._on_visibility_change);
    } else if (typeof this.media_query.addListener === 'function') {
      this.media_query.addListener(this._on_visibility_change);
    }

    this._sync_visibility();
  }

  /**
   * 解除事件監聽並清掉所有觸控按鍵狀態。
   *
   * @returns {void}
   * @depends HTMLElement.removeEventListener, InputState.set
   */
  destroy() {
    if (!this.root) return;
    this._release_all_buttons();
    this.root.removeEventListener('contextmenu', this._on_context_menu);
    window.removeEventListener('resize', this._on_visibility_change);
    window.removeEventListener('orientationchange', this._on_visibility_change);
    window.removeEventListener('blur', this._on_window_blur);
    document.removeEventListener('visibilitychange', this._on_visibility_change);

    if (typeof this.media_query.removeEventListener === 'function') {
      this.media_query.removeEventListener('change', this._on_visibility_change);
    } else if (typeof this.media_query.removeListener === 'function') {
      this.media_query.removeListener(this._on_visibility_change);
    }
  }

  /**
   * 依按鍵定義建立方向鍵、動作鍵與 START 鍵。
   *
   * @returns {void}
   * @depends document.createElement, BUTTON_DEFINITIONS
   */
  _build_controls() {
    this.root.textContent = '';
    this.root.className = 'touch-overlay';
    this.root.setAttribute('aria-label', 'Touch controls');

    const dpad = this._create_cluster('touch-overlay__dpad', 'Directional pad');
    const actions = this._create_cluster('touch-overlay__actions', 'Action buttons');
    const system = this._create_cluster('touch-overlay__system', 'System buttons');

    const spacer = document.createElement('div');
    spacer.className = 'touch-overlay__spacer';
    dpad.appendChild(spacer);

    for (const button_definition of BUTTON_DEFINITIONS) {
      const button = this._create_button(button_definition);
      this.buttons.set(button_definition.btn, button);
      if (button_definition.area === 'dpad') dpad.appendChild(button);
      if (button_definition.area === 'actions') actions.appendChild(button);
      if (button_definition.area === 'system') system.appendChild(button);
    }

    this.root.append(dpad, actions, system);
  }

  /**
   * 建立一組觸控按鈕容器。
   *
   * @param {string} class_name - CSS class 名稱。
   * @param {string} label - aria label 文字。
   * @returns {HTMLDivElement} 建好的容器節點。
   * @depends document.createElement
   */
  _create_cluster(class_name, label) {
    const cluster = document.createElement('div');
    cluster.className = class_name;
    cluster.setAttribute('aria-label', label);
    return cluster;
  }

  /**
   * 建立單顆觸控按鈕並綁定 pointer 事件。
   *
   * @param {{btn: string, label: string, title: string, slot: string}} button_definition - 按鈕描述。
   * @returns {HTMLButtonElement} 建好的按鈕節點。
   * @depends HTMLElement.setPointerCapture, InputState.set
   */
  _create_button(button_definition) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `touch-overlay__button touch-overlay__button--${button_definition.slot}`;
    button.dataset.btn = button_definition.btn;
    button.textContent = button_definition.label;
    button.setAttribute('aria-label', button_definition.title);
    button.addEventListener('pointerdown', this._on_pointer_down);
    button.addEventListener('pointerup', this._on_pointer_up);
    button.addEventListener('pointercancel', this._on_pointer_up);
    button.addEventListener('lostpointercapture', this._on_pointer_up);
    return button;
  }

  /**
   * 處理按下觸控按鈕，支援同時按方向鍵與動作鍵。
   *
   * @param {PointerEvent} event - pointerdown 事件。
   * @returns {void}
   * @depends InputState.set, HTMLElement.setPointerCapture
   */
  _on_pointer_down(event) {
    const button = event.currentTarget;
    const btn = button.dataset.btn;
    if (!btn) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    this.active_pointers.set(event.pointerId, { btn, button });
    this._press_button(btn);
    button.classList.add('is-active');
  }

  /**
   * 處理放開或取消觸控按鈕，並釋放對應按鍵狀態。
   *
   * @param {PointerEvent} event - pointerup、pointercancel 或 lostpointercapture 事件。
   * @returns {void}
   * @depends InputState.set
   */
  _on_pointer_up(event) {
    const active_pointer = this.active_pointers.get(event.pointerId);
    if (!active_pointer) return;
    event.preventDefault();
    this.active_pointers.delete(event.pointerId);
    this._release_button(active_pointer.btn);
    active_pointer.button.classList.remove('is-active');
  }

  /**
   * 阻止長按觸控按鈕時跳出系統選單。
   *
   * @param {Event} event - contextmenu 事件。
   * @returns {void}
   * @depends Event.preventDefault
   */
  _on_context_menu(event) {
    event.preventDefault();
  }

  /**
   * 視窗尺寸、方向或 pointer 能力改變時同步顯示狀態。
   *
   * @returns {void}
   * @depends TouchOverlay._sync_visibility
   */
  _on_visibility_change() {
    this._sync_visibility();
  }

  /**
   * 視窗失焦時清除所有觸控按鍵，避免按鍵卡住。
   *
   * @returns {void}
   * @depends TouchOverlay._release_all_buttons
   */
  _on_window_blur() {
    this._release_all_buttons();
  }

  /**
   * 判斷目前是否應顯示觸控覆蓋層。
   *
   * @returns {boolean} true 表示應顯示觸控按鈕。
   * @depends URLSearchParams, MediaQueryList.matches
   */
  _should_show() {
    if (this.force_mode === '1' || this.force_mode === 'true') return true;
    if (this.force_mode === '0' || this.force_mode === 'false') return false;
    return this.media_query.matches;
  }

  /**
   * 套用觸控覆蓋層顯示狀態，並通知 Canvas 重新計算可用區域。
   *
   * @returns {void}
   * @depends TouchOverlay._should_show, window.dispatchEvent
   */
  _sync_visibility() {
    const should_show = this._should_show();
    const changed = this.root.hidden === should_show;
    this.root.hidden = !should_show;
    document.body.classList.toggle('touch-enabled', should_show);

    if (!should_show) this._release_all_buttons();
    if (changed) window.dispatchEvent(new Event('resize'));
  }

  /**
   * 增加某個按鍵的觸控引用計數。
   *
   * @param {string} btn - Btn 常數值。
   * @returns {void}
   * @depends InputState.set
   */
  _press_button(btn) {
    const count = this.button_counts.get(btn) || 0;
    this.button_counts.set(btn, count + 1);
    if (count === 0) this.input_state.set(btn, true);
  }

  /**
   * 減少某個按鍵的觸控引用計數。
   *
   * @param {string} btn - Btn 常數值。
   * @returns {void}
   * @depends InputState.set
   */
  _release_button(btn) {
    const count = this.button_counts.get(btn) || 0;
    if (count <= 1) {
      this.button_counts.delete(btn);
      this.input_state.set(btn, false);
      return;
    }
    this.button_counts.set(btn, count - 1);
  }

  /**
   * 清除所有 active pointer 與按鍵狀態。
   *
   * @returns {void}
   * @depends InputState.set
   */
  _release_all_buttons() {
    for (const button of this.buttons.values()) {
      button.classList.remove('is-active');
    }
    for (const btn of this.button_counts.keys()) {
      this.input_state.set(btn, false);
    }
    this.active_pointers.clear();
    this.button_counts.clear();
  }
}
