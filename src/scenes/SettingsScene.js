import Phaser from 'phaser';

const FONT = "'Orbitron', Arial";

export default class SettingsScene extends Phaser.Scene {
  constructor() { super({ key: 'SettingsScene' }); }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    this.add.text(width / 2, height * 0.14, '설정', {
      fontSize: '90px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    this._makeToggle(width / 2, height * 0.36, 'BGM', 'fo_bgm');
    this._makeToggle(width / 2, height * 0.50, '효과음 (SFX)', 'fo_sfx');

    this._makeButton(width / 2, height * 0.70, '← 돌아가기', () => {
      this.scene.start('MenuScene');
    });
  }

  _makeToggle(x, y, label, storageKey) {
    let state = localStorage.getItem(storageKey) !== 'off';

    this.add.text(x - 50, y, label, {
      fontSize: '48px', color: '#aaaaaa', fontFamily: FONT,
    }).setOrigin(1, 0.5);

    const btn = this.add.rectangle(x + 100, y, 180, 72, state ? 0x43a047 : 0x555555)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x + 100, y, state ? 'ON' : 'OFF', {
      fontSize: '44px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      state = !state;
      btn.setFillStyle(state ? 0x43a047 : 0x555555);
      txt.setText(state ? 'ON' : 'OFF');
      localStorage.setItem(storageKey, state ? 'on' : 'off');
    });
  }

  _makeButton(x, y, label, onClick) {
    const bg = this.add.rectangle(x, y, 500, 110, 0x1565c0, 0.9)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '46px', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setAlpha(1); txt.setColor('#fdd835'); });
    bg.on('pointerout',  () => { bg.setAlpha(0.9); txt.setColor('#ffffff'); });
    bg.on('pointerdown', onClick);
  }
}
