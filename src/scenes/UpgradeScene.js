import Phaser from 'phaser';

const FONT = "'Orbitron', Arial";

const UPGRADES = [
  {
    id:    'fo_upg_speed',
    label: '볼 속도 부스트',
    desc:  '시작 볼 속도 +5% per 레벨',
    costs: [10, 25, 50],
  },
  {
    id:    'fo_upg_paddle',
    label: '패들 너비 강화',
    desc:  '시작 패들 너비 +10% per 레벨',
    costs: [10, 25, 50],
  },
  {
    id:    'fo_upg_spawn',
    label: '+볼 쿨다운 단축',
    desc:  '+볼 쿨다운 -1초 per 레벨',
    costs: [10, 25, 50],
  },
];

export default class UpgradeScene extends Phaser.Scene {
  constructor() { super({ key: 'UpgradeScene' }); }

  create() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a);

    this.add.text(width / 2, height * 0.08, '영구 업그레이드', {
      fontSize: '72px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    this._shards = parseInt(localStorage.getItem('fo_shards') || '0', 10);
    this._shardText = this.add.text(width / 2, height * 0.15, `💎 ${this._shards} 샤드`, {
      fontSize: '48px', color: '#fdd835', fontFamily: FONT,
    }).setOrigin(0.5);

    this.add.rectangle(width / 2, height * 0.20, width - 80, 2, 0x333355);

    UPGRADES.forEach((upg, i) => {
      this._makeUpgradeCard(width / 2, height * 0.30 + i * 240, upg);
    });

    this._makeButton(width / 2, height * 0.92, '← 돌아가기', () => {
      this.scene.start('MenuScene');
    });
  }

  _makeUpgradeCard(x, y, upg) {
    const { width } = this.scale;
    const level = parseInt(localStorage.getItem(upg.id) || '0', 10);
    const maxed = level >= 3;

    // Card background
    this.add.rectangle(x, y, width - 80, 200, 0x1a1a2e)
      .setStrokeStyle(2, maxed ? 0xffd700 : 0x333366);

    // Label
    this.add.text(x, y - 60, upg.label, {
      fontSize: '42px', fontStyle: 'bold',
      color: maxed ? '#ffd700' : '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    // Desc
    this.add.text(x, y - 10, upg.desc, {
      fontSize: '30px', color: '#888888', fontFamily: FONT,
    }).setOrigin(0.5);

    // Level pips
    for (let i = 0; i < 3; i++) {
      this.add.rectangle(x - 60 + i * 60, y + 40, 44, 16, i < level ? 0x43a047 : 0x333355);
    }
    this.add.text(x + 130, y + 40, maxed ? 'MAX' : `Lv.${level}`, {
      fontSize: '30px', color: maxed ? '#ffd700' : '#666688', fontFamily: FONT,
    }).setOrigin(0.5);

    if (maxed) return;

    // Upgrade button
    const cost = upg.costs[level];
    const canAfford = this._shards >= cost;
    const btn = this.add.rectangle(x, y + 85, 320, 60, canAfford ? 0x1565c0 : 0x333333)
      .setInteractive({ useHandCursor: canAfford });
    const btnTxt = this.add.text(x, y + 85, `업그레이드 (💎${cost})`, {
      fontSize: '30px', color: canAfford ? '#ffffff' : '#555577', fontFamily: FONT,
    }).setOrigin(0.5);

    if (canAfford) {
      btn.on('pointerover', () => { btn.setFillStyle(0x1e88e5); btnTxt.setColor('#fdd835'); });
      btn.on('pointerout',  () => { btn.setFillStyle(0x1565c0); btnTxt.setColor('#ffffff'); });
      btn.on('pointerdown', () => {
        const newLevel = level + 1;
        localStorage.setItem(upg.id, String(newLevel));
        this._shards -= cost;
        localStorage.setItem('fo_shards', String(this._shards));
        // Refresh scene
        this.scene.restart();
      });
    }
  }

  _makeButton(x, y, label, onClick) {
    const bg = this.add.rectangle(x, y, 500, 96, 0x333355, 0.9)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '44px', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setAlpha(1); txt.setColor('#fdd835'); });
    bg.on('pointerout',  () => { bg.setAlpha(0.9); txt.setColor('#ffffff'); });
    bg.on('pointerdown', onClick);
  }
}
