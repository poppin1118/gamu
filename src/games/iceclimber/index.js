import { IceClimberScene } from './IceClimberScene.js';

export default {
  id: 'iceclimber',
  title: 'Ice Climber',
  supports: { singlePlayer: true, twoPlayer: false },
  factory: () => new IceClimberScene(),
  assetManifest: {
    images: {
      tiles: './src/games/iceclimber/assets/Tilemap/tilemap_packed.png',
      chars: './src/games/iceclimber/assets/Tilemap/tilemap-characters_packed.png',
      backgrounds: './src/games/iceclimber/assets/Tilemap/tilemap-backgrounds_packed.png',
    },
    json: {},
  },
};
