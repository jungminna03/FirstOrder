import Phaser from 'phaser';

const FONT = "'Orbitron', Arial";

export default class MenuScene extends Phaser.Scene {
  constructor() { super({ key: 'MenuScene' }); }

  preload() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff);
    g.fillCircle(6, 6, 6);
    g.generateTexture('menu_dot', 12, 12);
    g.destroy();
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // Background particles
    this.add.particles(0, height, 'menu_dot', {
      speedY: { min: -120, max: -280 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.2, end: 0 },
      lifespan: { min: 3500, max: 6000 },
      quantity: 1,
      frequency: 180,
      tint: [0x4fc3f7, 0x8e24aa, 0xe53935, 0xfdd835, 0x43a047],
      x: { min: 0, max: width },
    });

    // Title
    this.add.text(width / 2, height * 0.20, 'FIRST', {
      fontSize: '130px', fontStyle: 'bold', color: '#4fc3f7', fontFamily: FONT,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.30, 'ORDER', {
      fontSize: '130px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.40, 'BRICK CHAOS ROGUELITE', {
      fontSize: '34px', color: '#555577', fontFamily: FONT,
    }).setOrigin(0.5);

    // Best score
    const best = parseInt(localStorage.getItem('fo_best')  || '0', 10);
    const gems = parseInt(localStorage.getItem('fo_gems') || '0', 10);
    this.add.text(width / 2, height * 0.48, `최고 점수: ${best}`, {
      fontSize: '44px', color: '#fdd835', fontFamily: FONT,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.54, `💎 ${gems} 잼`, {
      fontSize: '36px', color: '#8888aa', fontFamily: FONT,
    }).setOrigin(0.5);

    // Buttons
    this._makeButton(width / 2, height * 0.64, '게임 시작', 0x1565c0, () => {
      this.scene.start('GameScene');
    });
    this._makeButton(width / 2, height * 0.74, '업그레이드', 0x4a3800, () => {
      this.scene.start('UpgradeScene');
    });
    this._makeButton(width / 2, height * 0.84, '설정', 0x333355, () => {
      this.scene.start('SettingsScene');
    });

    this.add.text(width / 2, height - 48, 'v0.1.0', {
      fontSize: '28px', color: '#333355', fontFamily: FONT,
    }).setOrigin(0.5);
  }

  _makeButton(x, y, label, color, onClick) {
    const bg = this.add.rectangle(x, y, 500, 110, color, 0.9)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '50px', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setAlpha(1); txt.setColor('#fdd835'); });
    bg.on('pointerout',  () => { bg.setAlpha(0.9); txt.setColor('#ffffff'); });
    bg.on('pointerdown', onClick);
  }
}
