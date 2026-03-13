import Phaser from 'phaser';
import { playSound } from '../audio/AudioManager.js';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

const FONT = "'Orbitron', Arial";

const COLS             = 10;
const BRICK_W          = 100;
const BRICK_H          = 26;
const BRICK_GAP        = 4;
const BALL_SPEED       = 750;
const MAX_H_SPEED      = 760;
const MIN_V_SPEED      = 140;
const DESCENT_SPEED    = 50;   // px/s initial
const EXP_PER_KILL     = 10;
const EXP_BASE         = 70;    // 레벨업 기준 EXP (×1.4^(level-1) 로 증가)
const HYDRA_MAX_BALLS  = 8;     // 히드라 증식으로 만들 수 있는 최대 공 수
const SPAWN_DELAY_INIT  = 2800; // ms
const SPAWN_DELAY_MIN   = 700;
const ADD_BALL_COOLDOWN = 12000; // ms (base)

const ROW_COLORS = [0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa];

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ─── Asset generation ────────────────────────────────────────────────────

  preload() {
    const pg = this.make.graphics({ add: false });
    pg.fillStyle(0x4fc3f7);
    pg.fillRoundedRect(0, 0, 180, 26, 13);
    pg.generateTexture('paddle', 180, 26);
    pg.destroy();

    const bg = this.make.graphics({ add: false });
    bg.fillStyle(0xffffff);
    bg.fillCircle(12, 12, 12);
    bg.generateTexture('ball', 24, 24);
    bg.destroy();

    ROW_COLORS.forEach((color, i) => {
      const g = this.make.graphics({ add: false });
      g.fillStyle(color);
      g.fillRoundedRect(0, 0, BRICK_W, BRICK_H, 4);
      g.lineStyle(1, 0xffffff, 0.15);
      g.strokeRoundedRect(0, 0, BRICK_W, BRICK_H, 4);
      g.generateTexture(`brick${i}`, BRICK_W, BRICK_H);
      g.destroy();
    });
  }

  // ─── Scene setup ─────────────────────────────────────────────────────────

  create() {
    const { width, height } = this.scale;

    // ── Core state ───────────────────────────────────────────────────────
    this.score           = 0;
    this.exp             = 0;
    this.level           = 1;
    this.startTime       = this.time.now;
    this.collectedPerks  = [];
    this.descentSpeed    = DESCENT_SPEED;
    this.spawnDelay      = SPAWN_DELAY_INIT;
    this.ballDamage      = 1;
    this.gameOver        = false;
    this.pendingBall     = null;
    this.colorIndex      = 0;
    this.waveCount       = 0;
    this.summonCooldown  = 0;
    this.ballSpeedMult   = 1.0;
    this.extraBalls      = 0;
    this.pressureTick    = 0;
    this.brickHp         = 1;
    this.hpIncrement     = 0;

    // ── Common perks ─────────────────────────────────────────────────────
    this.magnetBarStacks   = 0;
    this.expBoostStacks    = 0;
    this.expMult           = 1.0;
    this.bigBallStacks     = 0;
    this.ballScale         = 1.0;
    this.quickSummonStacks = 0;
    this.overdriveStacks   = 0;

    // ── Uncommon perks ───────────────────────────────────────────────────
    this.ghostBall     = false;
    this.shieldStacks  = 0;
    this.shieldCharged = false;
    this.shieldTimer   = 0;
    this.splitShot     = false;
    this.momentum      = false;

    // ── Rare perks ───────────────────────────────────────────────────────
    this.electricBall = false;
    this.bombShot     = false;
    this.novaBurst    = false;
    this.inferno      = false;

    // ── Legendary perks ──────────────────────────────────────────────────
    this.hydraBar = false;
    this.timeStop = false;

    // ── Freeze state (timeStop) ──────────────────────────────────────────
    this.isFrozen    = false;
    this.freezeTimer = 0;

    // No bottom wall — balls recycle instead of dying
    this.physics.world.setBoundsCollision(true, true, true, false);

    // ── Apply meta upgrades ───────────────────────────────────────────────
    const upgSpeed  = parseInt(localStorage.getItem('fo_upg_speed')  || '0', 10);
    const upgPaddle = parseInt(localStorage.getItem('fo_upg_paddle') || '0', 10);
    const upgSpawn  = parseInt(localStorage.getItem('fo_upg_spawn')  || '0', 10);
    if (upgSpeed  > 0) this.ballSpeedMult = 1.0 + upgSpeed  * 0.05;
    this._addBallCooldownBase = ADD_BALL_COOLDOWN - upgSpawn * 1000;

    // Paddle
    this.paddle = this.physics.add.image(width / 2, height - 100, 'paddle')
      .setImmovable(true)
      .setCollideWorldBounds(true);
    this.paddle.body.allowGravity = false;
    if (upgPaddle > 0) {
      const newW = 180 * (1 + upgPaddle * 0.1);
      this.paddle.setDisplaySize(newW, this.paddle.displayHeight);
      this.paddle.body.setSize(newW, this.paddle.displayHeight);
    }

    // Object pools
    this.bricks = this.physics.add.group();
    this.balls  = this.physics.add.group();
    this._placeBallOnPaddle();

    // Overlap for paddle — our callback owns 100% of velocity
    this.physics.add.overlap(this.balls, this.paddle, this.onBallHitPaddle, null, this);

    // Brick collider — process callback handles ghost-ball piercing
    this.physics.add.collider(
      this.balls, this.bricks,
      (ball, brick) => {
        if (brick.hitTimer > 0) return;
        brick.hitTimer = 150;
        this._hitBrick(ball, brick);
      },
      (ball, brick) => {
        if (!brick.active || !ball.active) return false;
        if (ball.ghost && ball.pierces > 0) {
          if (brick.hitTimer <= 0) {
            brick.hitTimer = 150;
            this._hitBrick(ball, brick);
            ball.pierces--;
          }
          return false;
        }
        return true;
      },
      this,
    );

    // HUD
    const hudFont = { fontSize: '36px', color: '#ffffff', fontFamily: FONT };
    this.scoreText = this.add.text(30, 24, '점수: 0', hudFont);
    this.levelText = this.add.text(width / 2, 24, '레벨 1', {
      ...hudFont, color: '#fdd835',
    }).setOrigin(0.5, 0);

    // EXP bar
    const barW = width - 60;
    this.expBg   = this.add.rectangle(30, 90, barW, 14, 0x333333).setOrigin(0, 0.5);
    this.expFill = this.add.rectangle(30, 90, 0, 14, 0x00ff88).setOrigin(0, 0.5);
    this.add.text(30, 106, 'EXP', { fontSize: '22px', color: '#888888', fontFamily: FONT });

    // Shield indicator
    this.shieldText = this.add.text(width - 30, 60, '', {
      fontSize: '28px', color: '#00ffff', fontFamily: FONT,
    }).setOrigin(1, 0).setVisible(false);

    const isMobile = !this.sys.game.device.os.desktop;
    this.launchMsg = isMobile ? '탭하여 발사' : '클릭 또는 SPACE로 발사';
    this.promptText = this.add.text(width / 2, height / 2, this.launchMsg, {
      fontSize: '42px', color: '#aaaaaa', fontFamily: FONT,
    }).setOrigin(0.5);

    // Summon button (bottom-right)
    const btnX = width - 90, btnY = height - 60;
    this._summonBtnBounds = { x: btnX - 80, y: btnY - 35, w: 160, h: 70 };
    this._summonBg = this.add.rectangle(btnX, btnY, 160, 70, 0x1565c0, 0.85).setDepth(10);
    this._summonLabel = this.add.text(btnX, btnY - 8, '+ 볼', {
      fontSize: '30px', color: '#ffffff', fontFamily: FONT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
    this._summonCdText = this.add.text(btnX, btnY + 18, '[X]', {
      fontSize: '22px', color: '#90caf9', fontFamily: FONT,
    }).setOrigin(0.5).setDepth(10);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', this.onLaunch, this);
    this.input.keyboard.on('keydown-ESC',   this.togglePause, this);
    this.input.keyboard.on('keydown-X',     this.onAddBall,  this);
    this.input.on('pointerdown', this.onLaunch, this);
    this.input.on('pointermove', p => { if (!this.gameOver) this.movePaddleTo(p.x); });

    // ── Capacitor native integrations ────────────────────────────────────
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.hide().catch(() => {});

    this._backBtnListener = App.addListener('backButton', () => {
      if (!this.gameOver) this.togglePause();
    });

    this._appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && !this.gameOver) this.togglePause();
    });

    // Seed 1 sparse starting row
    this.spawnBrickRow();
    this._scheduleSpawn();

    // Pressure ramp every 30s
    this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => {
        this.pressureTick++;
        if (this.pressureTick <= 6) {
          this.descentSpeed += 10;
          this._syncBrickSpeed();
          this.spawnDelay = Math.max(SPAWN_DELAY_MIN, this.spawnDelay - 150);
        }
        if (this.pressureTick >= 3) {
          this.hpIncrement += 2;
          this.brickHp += this.hpIncrement;
        }
      },
    });
  }

  // ─── Waterfall spawning ───────────────────────────────────────────────────

  _scheduleSpawn() {
    this.time.delayedCall(this.spawnDelay, () => {
      if (!this.gameOver) {
        this.spawnBrickRow();
        this._scheduleSpawn();
      }
    });
  }

  spawnBrickRow() {
    this.waveCount++;
    const density  = Math.min(1.0, 0.08 + (this.waveCount - 1) * 0.012);
    const hp       = this.brickHp;
    const colorIdx = this.colorIndex % ROW_COLORS.length;
    this.colorIndex++;

    const totalW  = COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP;
    const offsetX = (this.scale.width - totalW) / 2 + BRICK_W / 2;
    const guaranteedCol = Phaser.Math.Between(0, COLS - 1);

    for (let col = 0; col < COLS; col++) {
      if (col !== guaranteedCol && Math.random() >= density) continue;
      const x = offsetX + col * (BRICK_W + BRICK_GAP);
      const brick = this.bricks.create(x, -BRICK_H / 2, `brick${colorIdx}`);
      brick.setImmovable(true);
      brick.body.allowGravity = false;
      brick.body.setVelocityY(this.isFrozen ? 0 : this.descentSpeed);
      brick.hp       = hp;
      brick.maxHp    = hp;
      brick.hitTimer = 0;
      brick.col      = col;
    }
  }

  _syncBrickSpeed() {
    if (this.isFrozen) return;
    this.bricks.getChildren().forEach(b => {
      if (b.active) b.body.setVelocityY(this.descentSpeed);
    });
  }

  // ─── Ball placement ───────────────────────────────────────────────────────

  _placeBallOnPaddle() {
    const ball = this.balls.create(this.paddle.x, this.paddle.y - 28, 'ball');
    ball.setCollideWorldBounds(true).setBounce(1);
    ball.body.allowGravity = false;
    ball.body.setVelocity(0, 0);
    ball.ghost          = this.ghostBall;
    ball.pierces        = this.ghostBall ? 1 : 0;
    ball.paddleCooldown = 0;
    ball.combo          = 0;
    this._applyBallScale(ball);
    this.pendingBall    = ball;
    return ball;
  }

  _applyBallScale(ball) {
    if (this.ballScale === 1.0) return;
    const size = 24 * this.ballScale;
    ball.setDisplaySize(size, size);
    ball.body.setSize(size, size);
  }

  // ─── Collision handlers ───────────────────────────────────────────────────

  onBallHitPaddle(ball) {
    if (ball.paddleCooldown > 0) return;
    ball.paddleCooldown = 300;

    ball.y = this.paddle.y - this.paddle.displayHeight / 2 - ball.displayHeight / 2 - 1;

    const relativeImpact = Phaser.Math.Clamp(
      (ball.x - this.paddle.x) / (this.paddle.displayWidth / 2),
      -1, 1,
    );

    const effectiveSpeed = BALL_SPEED * this.ballSpeedMult;
    let vx = relativeImpact * MAX_H_SPEED;
    let vy = -Math.sqrt(Math.max(0, effectiveSpeed * effectiveSpeed - vx * vx));

    const jitter = Phaser.Math.FloatBetween(-8, 8) * (Math.PI / 180);
    const cosJ = Math.cos(jitter), sinJ = Math.sin(jitter);
    vx = vx * cosJ - vy * sinJ;
    vy = vx * sinJ + vy * cosJ;

    if (Math.abs(vy) < MIN_V_SPEED) vy = -MIN_V_SPEED;

    ball.body.setVelocity(vx, vy);

    // Reset ghost pierce
    if (this.ghostBall) { ball.ghost = true; ball.pierces = 1; }

    // Reset momentum combo
    if (this.momentum) { ball.combo = 0; ball.clearTint(); }

    playSound('paddle_hit');
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    this._burst(ball.x, ball.y);

    // Nova Burst: expanding shockwave hitting nearby bricks
    if (this.novaBurst) this._novaBurstEffect(ball.x, ball.y);

    // Time Stop: freeze all bricks briefly
    if (this.timeStop) this._freezeBricks();

    // Hydra Bar: split into 3 (fan-out ±30°)
    if (this.hydraBar) {
      const maxBalls = HYDRA_MAX_BALLS + this.extraBalls;
      for (const offsetDeg of [-30, 30]) {
        const flyingNow = this.balls.getChildren().filter(b => b.active && b !== this.pendingBall).length;
        if (flyingNow >= maxBalls) break;
        const rad  = offsetDeg * (Math.PI / 180);
        const cosR = Math.cos(rad), sinR = Math.sin(rad);
        const bvx = vx * cosR - vy * sinR;
        const bvy = vx * sinR + vy * cosR;
        const len = Math.sqrt(bvx * bvx + bvy * bvy) || 1;
        const nb = this.balls.create(ball.x, ball.y, 'ball');
        nb.setCollideWorldBounds(true).setBounce(1);
        nb.body.allowGravity = false;
        nb.ghost          = this.ghostBall;
        nb.pierces        = this.ghostBall ? 1 : 0;
        nb.paddleCooldown = 250;
        nb.combo          = 0;
        this._applyBallScale(nb);
        nb.body.setVelocity(bvx / len * effectiveSpeed, bvy / len * effectiveSpeed);
      }
    }
  }

  // Central hit handler — called from both collider branches
  _hitBrick(ball, brick) {
    if (this.momentum) {
      ball.combo = (ball.combo || 0) + 1;
      const tints = [0xffffff, 0xffcc44, 0xff8800, 0xff3300];
      ball.setTint(tints[Math.min(ball.combo, 3)]);
    }
    const bonus = this.momentum ? Math.min((ball.combo || 0) - 1, 3) : 0;
    const dmg   = this.ballDamage + Math.max(0, bonus);
    this.damageBrick(brick, dmg);
    if (this.electricBall) this._electricArc(brick);
  }

  damageBrick(brick, dmg) {
    brick.hp -= dmg;
    playSound('brick_hit');
    brick.setAlpha(0.3 + Math.max(0, brick.hp / brick.maxHp) * 0.7);
    if (brick.hp <= 0) {
      const bx = brick.x, by = brick.y;
      brick.destroy();
      this.score += 10;
      this.scoreText.setText(`점수: ${this.score}`);
      playSound('brick_break');
      this._burst(bx, by);
      this.addExp(EXP_PER_KILL);

      if (this.bombShot && Math.random() < 0.2) this._bombExplosion(bx, by);
      if (this.inferno)                          this._infernoEffect(bx, by);
      if (this.splitShot && Math.random() < 0.15) this._spawnSplitBall(bx, by);
    }
  }

  // ─── EXP & Perks ─────────────────────────────────────────────────────────

  _expToNext(level) {
    return Math.floor(EXP_BASE * Math.pow(1.4, level - 1));
  }

  addExp(amount) {
    this.exp += Math.floor(amount * this.expMult);
    const needed = this._expToNext(this.level);
    const barW   = this.expBg.width;
    this.expFill.width = Math.min(this.exp / needed, 1) * barW;
    if (this.exp >= needed) {
      this.exp = 0;
      this.expFill.width = 0;
      this.level++;
      this.levelText.setText(`레벨 ${this.level}`);
      playSound('level_up');
      this.scene.pause();
      this.scene.launch('PerkScene', { perks: this._getPerkOptions() });
    }
  }

  _getPerkOptions() {
    const sl = (cur, max) => cur >= max ? ' (최대)' : ` (${cur}/${max})`;

    // ★ Common
    const COMMON = [
      {
        id: 'magnetBar', tier: 'common',
        label: `★ 마그넷 바${sl(this.magnetBarStacks, 3)}`,
        desc: `바 너비 +20%\n(현재 ×${(this.paddle.displayWidth / 180).toFixed(2)})`,
      },
      {
        id: 'expBoost', tier: 'common',
        label: `★ 경험치 증폭${sl(this.expBoostStacks, 3)}`,
        desc: `EXP 획득 +30%\n(현재 ×${this.expMult.toFixed(1)})`,
      },
      {
        id: 'bigBall', tier: 'common',
        label: `★ 큰 볼${sl(this.bigBallStacks, 2)}`,
        desc: '볼 크기 ×1.3\n(히트박스 포함)',
      },
      {
        id: 'quickSummon', tier: 'common',
        label: `★ 빠른 소환${sl(this.quickSummonStacks, 3)}`,
        desc: `+볼 쿨타임 -3초\n(현재 ${Math.max(3, 12 - this.quickSummonStacks * 3)}초)`,
      },
      {
        id: 'overdrive', tier: 'common',
        label: `★ 오버드라이브${sl(this.overdriveStacks, 3)}`,
        desc: `볼 속도 ×1.2\n(현재 ×${this.ballSpeedMult.toFixed(2)})`,
      },
    ].filter(p => {
      if (p.id === 'magnetBar'   && this.magnetBarStacks   >= 3) return false;
      if (p.id === 'expBoost'    && this.expBoostStacks    >= 3) return false;
      if (p.id === 'bigBall'     && this.bigBallStacks     >= 2) return false;
      if (p.id === 'quickSummon' && this.quickSummonStacks >= 3) return false;
      if (p.id === 'overdrive'   && this.overdriveStacks   >= 3) return false;
      return true;
    });

    // ★★ Uncommon (레벨 3~)
    const UNCOMMON = [
      {
        id: 'ghostBall', tier: 'uncommon',
        label: '★★ 고스트 볼',
        desc: '볼이 브릭 1개 관통\n패들 반사 시 충전',
      },
      {
        id: 'heavyMetal', tier: 'uncommon',
        label: '★★ 헤비 메탈',
        desc: `볼 파워 +1 (현재 ${this.ballDamage})\n볼 속도 -15%`,
      },
      {
        id: 'shield', tier: 'uncommon',
        label: `★★ 쉴드${sl(this.shieldStacks, 3)}`,
        desc: `볼 이탈 시 자동 반사\n충전: ${[20, 13, 8][this.shieldStacks] ?? 20}초마다`,
      },
      {
        id: 'splitShot', tier: 'uncommon',
        label: '★★ 분열 볼',
        desc: '브릭 파괴 시 15% 확률\n파괴 위치에서 볼 생성',
      },
      {
        id: 'momentum', tier: 'uncommon',
        label: '★★ 모멘텀',
        desc: '연속 브릭 타격마다\n데미지 +1 (최대 +3)',
      },
    ].filter(p => {
      if (p.id === 'ghostBall' && this.ghostBall)          return false;
      if (p.id === 'shield'    && this.shieldStacks >= 3)  return false;
      if (p.id === 'splitShot' && this.splitShot)          return false;
      if (p.id === 'momentum'  && this.momentum)           return false;
      return true;
    });

    // ★★★ Rare (레벨 5~)
    const RARE = [
      {
        id: 'electricBall', tier: 'rare',
        label: '★★★ 전격 볼',
        desc: '브릭 명중 시 같은 열\n랜덤 브릭에 추가 피해',
      },
      {
        id: 'bombShot', tier: 'rare',
        label: '★★★ 폭발탄',
        desc: '파괴 시 20% 확률\n3×3 범위 폭발 (ballDmg)',
      },
      {
        id: 'novaBurst', tier: 'rare',
        label: '★★★ 노바 버스트',
        desc: '패들 반사 시 충격파\n200px 내 브릭 1 피해',
      },
      {
        id: 'inferno', tier: 'rare',
        label: '★★★ 인페르노',
        desc: '브릭 파괴 시\n같은 행 전체에 화염 전파',
      },
    ].filter(p => {
      if (p.id === 'electricBall' && this.electricBall) return false;
      if (p.id === 'bombShot'     && this.bombShot)     return false;
      if (p.id === 'novaBurst'    && this.novaBurst)    return false;
      if (p.id === 'inferno'      && this.inferno)      return false;
      return true;
    });

    // ★★★★ Legendary (레벨 8~)
    const LEGENDARY = [
      {
        id: 'hydraBar', tier: 'legendary',
        label: '★★★★ 히드라 바',
        desc: `패들 반사 시 볼 3분열\n(최대 ${HYDRA_MAX_BALLS}+추가볼)`,
      },
      {
        id: 'timeStop', tier: 'legendary',
        label: '★★★★ 타임 스탑',
        desc: '패들 반사 시마다\n브릭 0.8초 동결',
      },
    ].filter(p => {
      if (p.id === 'hydraBar' && this.hydraBar) return false;
      if (p.id === 'timeStop' && this.timeStop) return false;
      return true;
    });

    const pool = [...COMMON];
    if (this.level >= 3) pool.push(...UNCOMMON);
    if (this.level >= 5) pool.push(...RARE);
    if (this.level >= 8) pool.push(...LEGENDARY);

    const weights = { common: 50, uncommon: 35, rare: 15, legendary: 5 };

    const result    = [];
    const remaining = [...pool];
    while (result.length < 3 && remaining.length > 0) {
      const total = remaining.reduce((s, p) => s + weights[p.tier], 0);
      let rand   = Math.random() * total;
      let picked = remaining.length - 1;
      for (let i = 0; i < remaining.length; i++) {
        rand -= weights[remaining[i].tier];
        if (rand <= 0) { picked = i; break; }
      }
      result.push(remaining[picked]);
      remaining.splice(picked, 1);
    }
    return result;
  }

  applyPerk(id) {
    this.collectedPerks.push(id);

    // Common
    if (id === 'magnetBar' && this.magnetBarStacks < 3) {
      this.magnetBarStacks++;
      const newW = this.paddle.displayWidth * 1.2;
      this.paddle.setDisplaySize(newW, this.paddle.displayHeight);
      this.paddle.body.setSize(newW, this.paddle.displayHeight);
    }
    if (id === 'expBoost' && this.expBoostStacks < 3) {
      this.expBoostStacks++;
      this.expMult = 1 + this.expBoostStacks * 0.3;
    }
    if (id === 'bigBall' && this.bigBallStacks < 2) {
      this.bigBallStacks++;
      this.ballScale *= 1.3;
      const size = 24 * this.ballScale;
      this.balls.getChildren().forEach(b => {
        if (!b.active) return;
        b.setDisplaySize(size, size);
        b.body.setSize(size, size);
      });
    }
    if (id === 'quickSummon' && this.quickSummonStacks < 3) {
      this.quickSummonStacks++;
    }
    if (id === 'overdrive' && this.overdriveStacks < 3) {
      this.overdriveStacks++;
      this.ballSpeedMult = Math.min(2.0, this.ballSpeedMult * 1.2);
      const spd = BALL_SPEED * this.ballSpeedMult;
      this.balls.getChildren().forEach(b => {
        if (!b.active) return;
        const vel = b.body.velocity;
        const len = Math.sqrt(vel.x * vel.x + vel.y * vel.y) || 1;
        b.body.setVelocity(vel.x / len * spd, vel.y / len * spd);
      });
    }

    // Uncommon
    if (id === 'ghostBall') { this.ghostBall = true; }
    if (id === 'heavyMetal') {
      this.ballDamage++;
      this.ballSpeedMult *= 0.85;
      const spd = BALL_SPEED * this.ballSpeedMult;
      this.balls.getChildren().forEach(b => {
        if (!b.active) return;
        const vel = b.body.velocity;
        const len = Math.sqrt(vel.x * vel.x + vel.y * vel.y) || 1;
        b.body.setVelocity(vel.x / len * spd, vel.y / len * spd);
      });
    }
    if (id === 'shield' && this.shieldStacks < 3) {
      this.shieldStacks++;
      if (!this.shieldCharged) {
        this.shieldTimer = this._shieldRechargeTime();
      }
    }
    if (id === 'splitShot') { this.splitShot = true; }
    if (id === 'momentum')  { this.momentum  = true; }

    // Rare
    if (id === 'electricBall') { this.electricBall = true; }
    if (id === 'bombShot')     { this.bombShot     = true; }
    if (id === 'novaBurst')    { this.novaBurst    = true; }
    if (id === 'inferno')      { this.inferno      = true; }

    // Legendary
    if (id === 'hydraBar') { this.hydraBar = true; }
    if (id === 'timeStop') { this.timeStop = true; }
  }

  // ─── Pause / Add ball ─────────────────────────────────────────────────────

  onAddBall() {
    if (this.gameOver) return;
    if (this.pendingBall) return;
    if (this.summonCooldown > 0) return;

    this.extraBalls++;
    this._placeBallOnPaddle();
    this.promptText.setText(this.launchMsg).setVisible(true);

    const cooldown = Math.max(3000, this._addBallCooldownBase - this.quickSummonStacks * 3000);
    this.summonCooldown = cooldown;
    this._updateSummonBtn();
  }

  _updateSummonBtn() {
    const onCd = this.summonCooldown > 0 || !!this.pendingBall;
    this._summonBg.setFillStyle(onCd ? 0x424242 : 0x1565c0, 0.85);
    this._summonLabel.setColor(onCd ? '#888888' : '#ffffff');
    if (this.pendingBall) {
      this._summonCdText.setText('대기 중');
    } else {
      this._summonCdText.setText(onCd ? `${Math.ceil(this.summonCooldown / 1000)}s` : '[X]');
    }
  }

  togglePause() {
    if (this.gameOver) return;
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  onLaunch(pointer) {
    if (pointer && pointer.x !== undefined) {
      const b = this._summonBtnBounds;
      if (pointer.x >= b.x && pointer.x <= b.x + b.w &&
          pointer.y >= b.y && pointer.y <= b.y + b.h) {
        this.onAddBall();
        return;
      }
    }
    if (this.gameOver) return;
    if (!this.pendingBall) return;

    const ball = this.pendingBall;
    this.pendingBall = null;
    this.promptText.setVisible(false);
    ball.body.setVelocity(Phaser.Math.Between(-200, 200), -(BALL_SPEED * this.ballSpeedMult));
    this._syncBrickSpeed();
    this._updateSummonBtn();
  }

  movePaddleTo(x) {
    const half = this.paddle.displayWidth / 2;
    const cx   = Phaser.Math.Clamp(x, half, this.scale.width - half);
    this.paddle.x = cx;
    if (this.pendingBall) this.pendingBall.x = cx;
  }

  // ─── Visual effects ───────────────────────────────────────────────────────

  _burst(x, y) {
    const emitter = this.add.particles(x, y, 'ball', {
      speed: { min: 60, max: 180 },
      scale: { start: 0.3, end: 0 },
      lifespan: 300,
      quantity: 6,
      tint: 0x4fc3f7,
      emitting: false,
    });
    emitter.explode(6);
    this.time.delayedCall(400, () => emitter.destroy());
  }

  _electricArc(sourceBrick) {
    const col     = sourceBrick.col;
    const targets = this.bricks.getChildren().filter(
      b => b.active && b.col === col && b !== sourceBrick,
    );
    if (targets.length === 0) return;

    const target = targets[Phaser.Math.Between(0, targets.length - 1)];

    // Lightning line with mid-jitter
    const g = this.add.graphics();
    g.lineStyle(3, 0xffff00, 1);
    g.beginPath();
    g.moveTo(sourceBrick.x, sourceBrick.y);
    g.lineTo(
      sourceBrick.x + Phaser.Math.Between(-30, 30),
      (sourceBrick.y + target.y) / 2,
    );
    g.lineTo(target.x, target.y);
    g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });

    // Small spark at target
    const spark = this.add.particles(target.x, target.y, 'ball', {
      speed: { min: 40, max: 100 },
      scale: { start: 0.2, end: 0 },
      lifespan: 200,
      quantity: 4,
      tint: 0xffff00,
      emitting: false,
    });
    spark.explode(4);
    this.time.delayedCall(300, () => spark.destroy());

    if (target.hitTimer <= 0) {
      target.hitTimer = 150;
      this.damageBrick(target, 1);
    }
  }

  _bombExplosion(x, y) {
    const rangeX = (BRICK_W + BRICK_GAP) * 1.5;
    const rangeY = (BRICK_H + BRICK_GAP) * 1.5;
    this.bricks.getChildren().forEach(brick => {
      if (!brick.active) return;
      if (Math.abs(brick.x - x) <= rangeX && Math.abs(brick.y - y) <= rangeY) {
        if (brick.hitTimer <= 0) {
          brick.hitTimer = 150;
          this.damageBrick(brick, this.ballDamage);
        }
      }
    });

    playSound('bomb');

    // Orange blast
    const emitter = this.add.particles(x, y, 'ball', {
      speed: { min: 80, max: 300 },
      scale: { start: 0.55, end: 0 },
      lifespan: 420,
      quantity: 22,
      tint: [0xff6600, 0xff3300, 0xffaa00],
      emitting: false,
    });
    emitter.explode(22);
    this.time.delayedCall(520, () => emitter.destroy());
  }

  _novaBurstEffect(x, y) {
    const RADIUS = 200;

    this.bricks.getChildren().forEach(brick => {
      if (!brick.active) return;
      const dx = brick.x - x, dy = brick.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= RADIUS && brick.hitTimer <= 0) {
        brick.hitTimer = 150;
        this.damageBrick(brick, 1);
      }
    });

    playSound('nova_burst');

    // Expanding ring
    const ring = this.add.circle(x, y, 10, 0x00ffff, 0);
    ring.setStrokeStyle(4, 0x00ffff, 1);
    this.tweens.add({
      targets: ring,
      scaleX: RADIUS / 10,
      scaleY: RADIUS / 10,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  _infernoEffect(bx, by) {
    this.bricks.getChildren().forEach(brick => {
      if (!brick.active) return;
      if (Math.abs(brick.y - by) < BRICK_H && brick.hitTimer <= 0) {
        brick.hitTimer = 150;
        this.damageBrick(brick, 1);
      }
    });

    // Fire particles spreading left and right
    for (const dir of [170, 10]) {
      const em = this.add.particles(bx, by, 'ball', {
        speed: { min: 120, max: 380 },
        angle: { min: dir - 15, max: dir + 15 },
        scale: { start: 0.45, end: 0 },
        lifespan: 360,
        quantity: 14,
        tint: [0xff4400, 0xff8800, 0xffcc00],
        emitting: false,
      });
      em.explode(14);
      this.time.delayedCall(460, () => em.destroy());
    }
  }

  _freezeBricks() {
    playSound('time_freeze');
    this.isFrozen    = true;
    this.freezeTimer = 800;

    this.bricks.getChildren().forEach(b => {
      if (b.active) b.body.setVelocityY(0);
    });

    // Blue freeze wave from paddle
    const { width, height } = this.scale;
    const wave = this.add.circle(width / 2, height - 100, 20, 0x0088ff, 0.35);
    this.tweens.add({
      targets: wave,
      scaleX: width / 20,
      scaleY: (height / 20),
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => wave.destroy(),
    });
  }

  _shieldRechargeTime() {
    return [20000, 13000, 8000][this.shieldStacks - 1] ?? 20000;
  }

  _shieldReadyFlash() {
    this.tweens.add({
      targets: this.paddle,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.paddle.setAlpha(1),
    });
  }

  _spawnSplitBall(x, y) {
    const maxBalls   = HYDRA_MAX_BALLS + this.extraBalls;
    const activeCnt  = this.balls.getChildren().filter(b => b.active && b !== this.pendingBall).length;
    if (activeCnt >= maxBalls) return;

    const ball = this.balls.create(x, y - 10, 'ball');
    ball.setCollideWorldBounds(true).setBounce(1);
    ball.body.allowGravity = false;
    ball.ghost          = this.ghostBall;
    ball.pierces        = this.ghostBall ? 1 : 0;
    ball.paddleCooldown = 0;
    ball.combo          = 0;
    this._applyBallScale(ball);

    const spd = BALL_SPEED * this.ballSpeedMult;
    const rad = Phaser.Math.Between(-45, 45) * (Math.PI / 180);
    ball.body.setVelocity(Math.sin(rad) * spd, -Math.cos(rad) * spd);

    // Star sparkle
    const em = this.add.particles(x, y, 'ball', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.25, end: 0 },
      lifespan: 260,
      quantity: 7,
      tint: 0xffff00,
      emitting: false,
    });
    em.explode(7);
    this.time.delayedCall(360, () => em.destroy());
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.gameOver) return;

    // Paddle keyboard
    const kspeed = 1000;
    if (this.cursors.left.isDown) {
      this.paddle.body.setVelocityX(-kspeed);
    } else if (this.cursors.right.isDown) {
      this.paddle.body.setVelocityX(kspeed);
    } else {
      this.paddle.body.setVelocityX(0);
    }
    this.paddle.y = this.scale.height - 100;
    this.paddle.body.setVelocityY(0);
    if (this.pendingBall) this.pendingBall.x = this.paddle.x;

    // Summon cooldown tick
    if (this.summonCooldown > 0) {
      this.summonCooldown = Math.max(0, this.summonCooldown - delta);
      this._updateSummonBtn();
    }

    // Freeze timer
    if (this.isFrozen) {
      this.freezeTimer -= delta;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
        this._syncBrickSpeed();
      }
    }

    // Shield recharge timer
    if (this.shieldStacks > 0 && !this.shieldCharged) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.shieldCharged = true;
        this._shieldReadyFlash();
      }
    }

    // Shield HUD indicator
    if (this.shieldStacks > 0) {
      if (this.shieldCharged) {
        this.shieldText.setText('쉴드 준비').setColor('#00ffff').setVisible(true);
      } else {
        this.shieldText.setText(`쉴드 ${Math.ceil(this.shieldTimer / 1000)}s`).setColor('#556655').setVisible(true);
      }
    }

    // Tick hit cooldowns
    this.bricks.getChildren().forEach(brick => {
      if (brick.active && brick.hitTimer > 0) brick.hitTimer -= delta;
    });
    this.balls.getChildren().forEach(ball => {
      if (ball.active && ball.paddleCooldown > 0) ball.paddleCooldown -= delta;
    });

    // Manual tunnel-check
    const paddleTop   = this.paddle.y - this.paddle.displayHeight / 2;
    const paddleLeft  = this.paddle.x - this.paddle.displayWidth / 2;
    const paddleRight = this.paddle.x + this.paddle.displayWidth / 2;
    this.balls.getChildren().forEach(ball => {
      if (!ball.active || ball === this.pendingBall || ball.paddleCooldown > 0) return;
      if (ball.body.velocity.y <= 0) return;
      const ballBottom = ball.y + ball.displayHeight / 2;
      if (ballBottom >= paddleTop && ball.y < this.paddle.y &&
          ball.x >= paddleLeft && ball.x <= paddleRight) {
        this.onBallHitPaddle(ball);
      }
    });

    // Loss condition: any brick reaches the paddle
    for (const brick of this.bricks.getChildren()) {
      if (brick.active && brick.y >= this.paddle.y) {
        this.endGame();
        return;
      }
    }

    // Recycle / shield-reflect balls below screen
    this.balls.getChildren().forEach(ball => {
      if (ball === this.pendingBall) return;
      if (ball.active && ball.y > this.scale.height + 30) {
        if (this.shieldCharged) {
          this.shieldCharged = false;
          this.shieldTimer   = this._shieldRechargeTime();
          playSound('shield_reflect');
          ball.y = this.scale.height - 80;
          const spd = BALL_SPEED * this.ballSpeedMult;
          ball.body.setVelocity(Phaser.Math.Between(-200, 200), -spd);
          ball.paddleCooldown = 200;
          // Small cyan flash at reflect point
          const em = this.add.particles(ball.x, ball.y, 'ball', {
            speed: { min: 60, max: 160 }, scale: { start: 0.3, end: 0 },
            lifespan: 280, quantity: 8, tint: 0x00ffff, emitting: false,
          });
          em.explode(8);
          this.time.delayedCall(380, () => em.destroy());
        } else {
          ball.setActive(false).setVisible(false);
          ball.body.setVelocity(0, 0);
        }
      }
    });

    // Anti-horizontal lock
    this.balls.getChildren().forEach(ball => {
      if (!ball.active || ball === this.pendingBall) return;
      if (Math.abs(ball.body.velocity.y) < MIN_V_SPEED) {
        ball.body.setVelocityY(ball.body.velocity.y >= 0 ? MIN_V_SPEED : -MIN_V_SPEED);
      }
    });

    // All flying balls gone → auto-respawn
    const flyingBalls = this.balls.getChildren().filter(b => b.active && b !== this.pendingBall);
    if (flyingBalls.length === 0 && !this.pendingBall) {
      this._placeBallOnPaddle();
      this.promptText.setText(this.launchMsg).setVisible(true);
      if (!this.isFrozen) {
        this.bricks.getChildren().forEach(b => {
          if (b.active) b.body.setVelocityY(0);
        });
      }
      this._updateSummonBtn();
    }

    // Destroy bricks that slip past bottom
    this.bricks.getChildren().forEach(b => {
      if (b.active && b.y > this.scale.height + BRICK_H) b.destroy();
    });
  }

  // ─── End state ────────────────────────────────────────────────────────────

  endGame() {
    this.gameOver = true;
    this.pendingBall = null;
    this.balls.getChildren().forEach(b => {
      if (b.active) { b.body.setVelocity(0, 0); b.setVisible(false); }
    });

    const { width, height } = this.scale;

    // Clean up Capacitor listeners
    this._backBtnListener?.remove();
    this._appStateListener?.remove();

    playSound('game_over');

    // Best score persistence
    const prev = parseInt(localStorage.getItem('fo_best') || '0', 10);
    const isNewBest = this.score > prev;
    if (isNewBest) localStorage.setItem('fo_best', String(this.score));

    // Shards earned
    const shardsEarned = Math.floor(this.score / 100);
    const totalShards  = parseInt(localStorage.getItem('fo_shards') || '0', 10) + shardsEarned;
    localStorage.setItem('fo_shards', String(totalShards));

    const timeSurvived = Math.floor((this.time.now - this.startTime) / 1000);

    this.scene.start('RunSummaryScene', {
      score:          this.score,
      level:          this.level,
      timeSurvived,
      collectedPerks: [...this.collectedPerks],
      isNewBest,
      prevBest:       prev,
      shardsEarned,
      totalShards,
    });
  }
}