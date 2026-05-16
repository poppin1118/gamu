import { DummyScene } from './DummyScene.js';

export default {
  id: 'dummy',
  title: 'Dummy Bouncer',
  supports: { singlePlayer: true, twoPlayer: false },
  factory: () => new DummyScene(),
  assetManifest: { images: {}, json: {} },
};
