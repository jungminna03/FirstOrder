import Phaser from 'phaser';

const TIER_STYLE = {
  common:    { bg: 0x1a1a2e, bgHover: 0x2a2a4e, border: 0x666688, titleColor: '#aaaacc' },
  uncommon:  { bg: 0x0f2a0f, bgHover: 0x1a4a1a, border: 0x43a047, titleColor: '#66cc66' },
  rare:      { bg: 0x1a0a2e, bgHover: 0x2e1050, border: 0x9c27b0, titleColor: '#cc88ff' },
  legendary: { bg: 0x2a1f00, bgHover: 0x4a3800, border: 0xffd700, titleColor: '#ffd700' },
};

export default class PerkScene extends Phaser.Scene {
  constructor() { super({ key: 'PerkScene' }); }

  init(data) {
    this.perkOptions = data.perks;
  }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78);
    this.add.text(width / 2, height / 2 - 280, '퍽을 선택하세요', {
      fontSize: '72px', fontStyle: 'bold', color: '#fdd835', fontFamily: 'Arial',
    }).setOrigin(0.5);

    const gap    = 320;
    const startX = width / 2 - gap;
    this.perkOptions.forEach((perk, i) => {
      this._makeCard(startX + i * gap, height / 2, perk);
    });
  }

  _makeCard(x, y, perk) {
    const style = TIER_STYLE[perk.tier] ?? TIER_STYLE.common;

    // Legendary gets a subtle outer glow ring
    if (perk.tier === 'legendary') {
      const glow = this.add.rectangle(x, y, 292, 212, 0xffd700, 0.18)
        .setStrokeStyle(2, 0xffd700, 0.5);
      this.tweens.add({
        targets: glow, alpha: 0.05, duration: 700,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }

    const card = this.add.rectangle(x, y, 280, 200, style.bg)
      .setStrokeStyle(3, style.border)
      .setInteractive({ useHandCursor: true });

    const title = this.add.text(x, y - 40, perk.label, {
      fontSize: '30px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'Arial',
      wordWrap: { width: 260 }, align: 'center',
    }).setOrigin(0.5);

    this.add.text(x, y + 36, perk.desc, {
      fontSize: '24px', color: '#aaaacc', fontFamily: 'Arial',
      align: 'center', wordWrap: { width: 250 },
    }).setOrigin(0.5);

    card.on('pointerover', () => {
      card.setFillColor(style.bgHover);
      title.setStyle({ color: style.titleColor });
    });
    card.on('pointerout', () => {
      card.setFillColor(style.bg);
      title.setStyle({ color: '#ffffff' });
    });
    card.on('pointerdown', () => {
      this.scene.get('GameScene').applyPerk(perk.id);
      this.scene.resume('GameScene');
      this.scene.stop();
    });
  }
}