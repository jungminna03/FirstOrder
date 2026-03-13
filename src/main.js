import Phaser from 'phaser';
import MenuScene       from './scenes/MenuScene.js';
import SettingsScene   from './scenes/SettingsScene.js';
import UpgradeScene    from './scenes/UpgradeScene.js';
import GameScene       from './scenes/GameScene.js';
import PauseScene      from './scenes/PauseScene.js';
import PerkScene       from './scenes/PerkScene.js';
import RunSummaryScene from './scenes/RunSummaryScene.js';

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1080,
    height: 1920,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [MenuScene, SettingsScene, UpgradeScene, GameScene, PauseScene, PerkScene, RunSummaryScene],
};

new Phaser.Game(config);
