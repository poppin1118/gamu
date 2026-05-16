export class Scene {
  async init(_ctx) {}
  update(_dt) {}
  render(_ctx2d, _alpha) {}
  destroy() {}
  pause() {}
  resume() {}

  serializeSnapshot() { return null; }
  applySnapshot(_snap) {}
  onRemoteInput(_p2Input) {}
}
