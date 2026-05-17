import { IceClimberScene } from './IceClimberScene.js';

/**
 * 建立 Ice Climber 場景實體。
 *
 * @returns {IceClimberScene} 新的 Ice Climber scene。
 * @depends IceClimberScene
 */
function create_ice_climber_scene() {
  return new IceClimberScene();
}

export default {
  id: 'iceclimber',
  title: 'Ice Climber',
  supports: { singlePlayer: true, twoPlayer: true },
  factory: create_ice_climber_scene,
  assetManifest: {
    images: {},
    json: {},
  },
};
