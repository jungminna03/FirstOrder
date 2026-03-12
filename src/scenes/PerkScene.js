import Phaser from 'phaser';

export default class PerkScene extends Phaser.Scene {
  constructor() { super({ key: 'PerkScene' }); }

  init(data) {
    this.perkOptions = data.perks;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78);
    this.add.text(width / 2, height / 2 - 280, 'CHOOSE A PERK', {
      fontSize: '72px', fontStyle: 'bold', color: '#fdd835', fontFamily: 'Arial',
    }).setOrigin(0.5);

    const gap    = 320;
    const startX = width / 2 - gap;
    this.perkOptions.forEach((perk, i) => {
      this._makeCard(startX + i * gap, height / 2, perk);
    });
  }

  _makeCard(x, y, perk) {
    const card = this.add.rectangle(x, y, 280, 200, 0x1a1a3a)
      .setStrokeStyle(3, 0x4444bb)
      .setInteractive({ useHandCursor: true });

    const title = this.add.text(x, y - 40, perk.label, {
      fontSize: '34px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.add.text(x, y + 30, perk.desc, {
      fontSize: '24px', color: '#aaaacc', fontFamily: 'Arial',
      align: 'center', wordWrap: { width: 250 },
    }).setOrigin(0.5);

    card.on('pointerover', () => {
      card.setFillColor(0x2a2a5a);
      title.setStyle({ color: '#fdd835' });
    });
    card.on('pointerout', () => {
      card.setFillColor(0x1a1a3a);
      title.setStyle({ color: '#ffffff' });
    });
    card.on('pointerdown', () => {
      this.scene.get('GameScene').applyPerk(perk.id);
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }
}
