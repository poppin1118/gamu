import { IceClimberScene } from './IceClimberScene.js';

export default {
  id: 'iceclimber',
  title: 'Ice Climber',
  supports: { singlePlayer: true, twoPlayer: false },
  factory: () => new IceClimberScene(),
  assetManifest: { images: {}, json: {} },
};
