import Phaser from 'phaser';

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Dim overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55);

    this.add.text(width / 2, height / 2 - 90, 'PAUSED', {
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this._makeButton(width / 2, height / 2 + 10, 'RESUME', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });

    this._makeButton(width / 2, height / 2 + 90, 'RESTART', () => {
      this.scene.stop();
      this.scene.stop('GameScene');
      this.scene.start('GameScene');
    });

    // ESC also resumes
    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }

  _makeButton(x, y, label, onClick) {
    const btn = this.add.text(x, y, label, {
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: '#333355',
      padding: { x: 32, y: 14 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => btn.setStyle({ color: '#fdd835' }));
    btn.on('pointerout',   () => btn.setStyle({ color: '#ffffff' }));
    btn.on('pointerdown',  onClick);
  }
}
