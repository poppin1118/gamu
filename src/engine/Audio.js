/**
 * WebAudio 包裝。iOS Safari / Chrome autoplay policy 都要求 AudioContext 在
 * user gesture 內 create 或 resume，因此 `init()` 必須在第一次 keydown/pointerdown
 * 之後呼叫。在 init 之前的 load/play 會 silently no-op 並 console.warn 一次。
 *
 * 用法：
 *   const audio = new AudioSystem();
 *   window.addEventListener('keydown', () => audio.init(), { once: true });
 *   await audio.loadAll({ jump: './assets/sfx/jump.wav' });
 *   audio.play('jump', { volume: 0.6 });
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master_gain = null;
    this.buffers = {};
    this.pending_arrays = {};
    this.active_sources = new Map();
    this._master_volume = 1.0;
    this._warned_play_uninit = false;
  }

  /**
   * 在 user gesture handler 內呼叫，建立並 resume AudioContext，
   * 並 decode 任何在 init 前 fetch 但尚未 decode 的 pending buffers。
   * 重複呼叫安全。
   *
   * @returns {Promise<void>}
   */
  async init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master_gain = this.ctx.createGain();
      this.master_gain.gain.value = this._master_volume;
      this.master_gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* ignore */ }
    }
    await this._decodePending();
  }

  /**
   * 載入單一音檔。Fetch 永遠先做；若 AudioContext 尚未 init 則暫存 ArrayBuffer，
   * 等 init() 之後再 decode 成 AudioBuffer。
   *
   * @param {string} name - 音效 key。
   * @param {string} url - 音檔 URL（相對路徑）。
   * @returns {Promise<void>}
   */
  async load(name, url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`音檔載入失敗: ${url} (${res.status})`);
    const arr = await res.arrayBuffer();
    if (this.ctx) {
      this.buffers[name] = await this._decode(arr);
    } else {
      this.pending_arrays[name] = arr;
    }
  }

  /**
   * 將 ArrayBuffer 用 AudioContext decode 成 AudioBuffer。
   * 用 Promise + callback 雙路寫法，相容舊版 Safari（不回傳 Promise）。
   *
   * @param {ArrayBuffer} arr
   * @returns {Promise<AudioBuffer>}
   */
  _decode(arr) {
    return new Promise((resolve, reject) => {
      const p = this.ctx.decodeAudioData(arr, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  /**
   * 在 init 之後 decode 所有 pending ArrayBuffers。
   *
   * @returns {Promise<void>}
   */
  async _decodePending() {
    const entries = Object.entries(this.pending_arrays);
    if (entries.length === 0) return;
    this.pending_arrays = {};
    await Promise.all(entries.map(async ([name, arr]) => {
      try { this.buffers[name] = await this._decode(arr); }
      catch (e) { console.warn(`音檔 decode 失敗: ${name}`, e); }
    }));
  }

  /**
   * 批次載入；類似 AssetLoader.loadAssets。
   *
   * @param {Record<string, string>} manifest - { name: url } 對應表。
   * @returns {Promise<void>}
   */
  async loadAll(manifest = {}) {
    const tasks = Object.entries(manifest).map(([n, u]) => this.load(n, u));
    await Promise.all(tasks);
  }

  /**
   * 播放音效。回傳 source node（可用 stop()），或在未 init / 未載入時回傳 null。
   *
   * @param {string} name - 已 load 的音效 key。
   * @param {{volume?: number, loop?: boolean}} opts
   * @returns {AudioBufferSourceNode|null}
   */
  play(name, { volume = 1, loop = false } = {}) {
    if (!this.ctx) {
      if (!this._warned_play_uninit) {
        this._warned_play_uninit = true;
        console.warn('AudioSystem.play 在 init 前被呼叫，將被略過');
      }
      return null;
    }
    const buf = this.buffers[name];
    if (!buf) return null;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.master_gain);

    let set = this.active_sources.get(name);
    if (!set) { set = new Set(); this.active_sources.set(name, set); }
    set.add(src);
    src.onended = () => set.delete(src);

    src.start(0);
    return src;
  }

  /**
   * 停止指定 key 的所有正在播放的實例（含 loop）。
   *
   * @param {string} name
   * @returns {void}
   */
  stop(name) {
    const set = this.active_sources.get(name);
    if (!set) return;
    for (const src of set) {
      try { src.stop(); } catch (e) { /* already stopped */ }
    }
    set.clear();
  }

  /**
   * 停止所有正在播放的音效。
   *
   * @returns {void}
   */
  stopAll() {
    for (const name of Array.from(this.active_sources.keys())) {
      this.stop(name);
    }
  }

  /**
   * 設定 master volume，會影響後續與正在播放的音效。
   *
   * @param {number} v - 0..1
   */
  setMasterVolume(v) {
    this._master_volume = v;
    if (this.master_gain) this.master_gain.gain.value = v;
  }

}
