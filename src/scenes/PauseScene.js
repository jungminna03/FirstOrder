import Phaser from 'phaser';

const FONT = "'Orbitron', Arial";

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);

    this.add.text(width / 2, height / 2 - 160, '일시 정지', {
      fontSize: '96px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    this._makeButton(width / 2, height / 2 - 20, '계속하기', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });

    this._makeButton(width / 2, height / 2 + 130, '처음부터', () => {
      this.scene.stop();
      this.scene.stop('GameScene');
      this.scene.start('GameScene');
    });

    this._makeButton(width / 2, height / 2 + 280, '메인 메뉴', () => {
      this.scene.stop('GameScene');
      this.scene.stop();
      this.scene.start('MenuScene');
    });

    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }

  _makeButton(x, y, label, onClick) {
    const btn = this.add.text(x, y, label, {
      fontSize: '52px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
      backgroundColor: '#333355',
      padding: { x: 60, y: 24 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => btn.setStyle({ color: '#fdd835' }));
    btn.on('pointerout',   () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerdown',  onClick);
  }
}
