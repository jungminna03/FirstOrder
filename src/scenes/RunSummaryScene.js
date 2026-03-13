import Phaser from 'phaser';

const FONT = "'Orbitron', Arial";

const PERK_LABELS = {
  magnetBar:    '마그넷 바',    expBoost:   '경험치 증폭',
  bigBall:      '큰 볼',        quickSummon:'빠른 소환',
  overdrive:    '오버드라이브', ghostBall:  '고스트 볼',
  heavyMetal:   '헤비 메탈',    shield:     '쉴드',
  splitShot:    '분열 볼',      momentum:   '모멘텀',
  electricBall: '전격 볼',      bombShot:   '폭발탄',
  novaBurst:    '노바 버스트',  inferno:    '인페르노',
  hydraBar:     '히드라 바',    timeStop:   '타임 스탑',
};

export default class RunSummaryScene extends Phaser.Scene {
  constructor() { super({ key: 'RunSummaryScene' }); }

  init(data) {
    this.data_ = data;
  }

  create() {
    const { width, height } = this.scale;
    const d = this.data_;

    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a);

    // Title
    this.add.text(width / 2, height * 0.08, '게임 오버', {
      fontSize: '88px', fontStyle: 'bold', color: '#e53935', fontFamily: FONT,
    }).setOrigin(0.5);

    // Score
    this.add.text(width / 2, height * 0.17, `${d.score}점`, {
      fontSize: '80px', fontStyle: 'bold', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);

    if (d.isNewBest) {
      this.add.text(width / 2, height * 0.24, '★ 신기록!', {
        fontSize: '48px', color: '#fdd835', fontFamily: FONT,
      }).setOrigin(0.5);
    } else {
      this.add.text(width / 2, height * 0.24, `최고: ${d.prevBest}점`, {
        fontSize: '40px', color: '#666688', fontFamily: FONT,
      }).setOrigin(0.5);
    }

    // Divider
    this.add.rectangle(width / 2, height * 0.30, width - 80, 2, 0x333355);

    // Stats
    const statY  = height * 0.34;
    const statGap = 90;
    const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    this._stat(width / 2, statY,           '생존 시간', fmt(d.timeSurvived));
    this._stat(width / 2, statY + statGap, '최종 레벨', `${d.level}`);
    this._stat(width / 2, statY + statGap * 2, '획득 샤드', `+${d.shardsEarned} 💎 (누적: ${d.totalShards})`);

    // Divider
    this.add.rectangle(width / 2, height * 0.58, width - 80, 2, 0x333355);

    // Perks collected
    this.add.text(width / 2, height * 0.61, '이번 런 퍽', {
      fontSize: '34px', color: '#888888', fontFamily: FONT,
    }).setOrigin(0.5);

    if (d.collectedPerks.length === 0) {
      this.add.text(width / 2, height * 0.67, '없음', {
        fontSize: '34px', color: '#444466', fontFamily: FONT,
      }).setOrigin(0.5);
    } else {
      // Deduplicate with counts
      const counts = {};
      d.collectedPerks.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      const entries = Object.entries(counts);
      const cols = 3, rowH = 56, colW = 320;
      const startX = width / 2 - colW * (Math.min(cols, entries.length) - 1) / 2;

      entries.forEach(([id, cnt], i) => {
        const cx = startX + (i % cols) * colW;
        const cy = height * 0.67 + Math.floor(i / cols) * rowH;
        const label = PERK_LABELS[id] || id;
        this.add.text(cx, cy, cnt > 1 ? `${label} ×${cnt}` : label, {
          fontSize: '28px', color: '#aaaacc', fontFamily: FONT,
        }).setOrigin(0.5);
      });
    }

    // Buttons
    this._makeButton(width / 2, height * 0.86, '다시 시작', 0x1565c0, () => {
      this.scene.start('GameScene');
    });
    this._makeButton(width / 2, height * 0.94, '메인 메뉴', 0x333355, () => {
      this.scene.start('MenuScene');
    });
  }

  _stat(x, y, label, value) {
    this.add.text(x - 20, y, label, {
      fontSize: '36px', color: '#666688', fontFamily: FONT,
    }).setOrigin(1, 0.5);
    this.add.text(x + 20, y, value, {
      fontSize: '36px', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0, 0.5);
  }

  _makeButton(x, y, label, color, onClick) {
    const bg = this.add.rectangle(x, y, 500, 96, color, 0.9)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: '46px', color: '#ffffff', fontFamily: FONT,
    }).setOrigin(0.5);
    bg.on('pointerover', () => { bg.setAlpha(1); txt.setColor('#fdd835'); });
    bg.on('pointerout',  () => { bg.setAlpha(0.9); txt.setColor('#ffffff'); });
    bg.on('pointerdown', onClick);
  }
}
