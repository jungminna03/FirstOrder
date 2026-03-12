import Phaser from 'phaser';

const COLS             = 10;
const BRICK_W          = 100;
const BRICK_H          = 26;
const BRICK_GAP        = 4;
const BALL_SPEED       = 900;
const MAX_H_SPEED      = 760;
const MIN_V_SPEED      = 140;
const DESCENT_SPEED    = 80;   // px/s initial
const BASE_HP          = 1;
const EXP_PER_KILL     = 10;
const EXP_TO_PERK      = 100;
const SPAWN_DELAY_INIT  = 2800; // ms
const SPAWN_DELAY_MIN   = 700;
const ADD_BALL_COOLDOWN = 12000; // ms

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

    this.score           = 0;
    this.exp             = 0;
    this.level           = 1;
    this.descentSpeed    = DESCENT_SPEED;
    this.spawnDelay      = SPAWN_DELAY_INIT;
    this.ballDamage      = 1;
    this.hydraBar        = false;
    this.ghostBall       = false;
    this.chainReaction   = false;
    this.gameOver        = false;
    this.pendingBall     = null;   // ball sitting on paddle waiting to launch
    this.colorIndex      = 0;
    this.waveCount       = 0;
    this.summonCooldown  = 0;
    this.overdriveStacks = 0;
    this.ballSpeedMult   = 1.0;

    // No bottom wall — balls recycle instead of dying
    this.physics.world.setBoundsCollision(true, true, true, false);

    // Paddle
    this.paddle = this.physics.add.image(width / 2, height - 100, 'paddle')
      .setImmovable(true)
      .setCollideWorldBounds(true);
    this.paddle.body.allowGravity = false;

    // Object pools
    this.bricks = this.physics.add.group();
    this.balls  = this.physics.add.group();
    this._placeBallOnPaddle();

    // Use overlap (not collider) so Phaser applies ZERO physics response to this pair.
    // Our callback owns 100% of velocity — no Phaser Y-flip to fight against.
    this.physics.add.overlap(this.balls, this.paddle, this.onBallHitPaddle, null, this);
    this.physics.add.collider(
      this.balls, this.bricks,
      (ball, brick) => {
        if (brick.hitTimer > 0) return;
        brick.hitTimer = 150;
        this.damageBrick(brick, this.ballDamage);
      },
      (ball, brick) => {
        if (!brick.active || !ball.active) return false;
        if (ball.ghost && ball.pierces > 0) {
          if (brick.hitTimer <= 0) {
            brick.hitTimer = 150;
            this.damageBrick(brick, this.ballDamage);
            ball.pierces--;
          }
          return false;
        }
        return true;
      },
      this,
    );

    // HUD
    const hudFont = { fontSize: '36px', color: '#ffffff', fontFamily: 'Arial' };
    this.scoreText = this.add.text(30, 24, '점수: 0', hudFont);
    this.levelText = this.add.text(width / 2, 24, '레벨 1', {
      ...hudFont, color: '#fdd835',
    }).setOrigin(0.5, 0);

    // EXP bar
    const barW = width - 60;
    this.expBg   = this.add.rectangle(30, 90, barW, 14, 0x333333).setOrigin(0, 0.5);
    this.expFill = this.add.rectangle(30, 90, 0, 14, 0x00ff88).setOrigin(0, 0.5);
    this.add.text(30, 106, 'EXP', { fontSize: '22px', color: '#888888', fontFamily: 'Arial' });

    const isMobile = !this.sys.game.device.os.desktop;
    this.launchMsg = isMobile ? '탭하여 발사' : '클릭 또는 SPACE로 발사';
    this.promptText = this.add.text(width / 2, height / 2, this.launchMsg, {
      fontSize: '42px', color: '#aaaaaa', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Summon button (bottom-right)
    const btnX = width - 90, btnY = height - 60;
    this._summonBtnBounds = { x: btnX - 80, y: btnY - 35, w: 160, h: 70 };
    this._summonBg = this.add.rectangle(btnX, btnY, 160, 70, 0x1565c0, 0.85).setDepth(10);
    this._summonLabel = this.add.text(btnX, btnY - 8, '+ 볼', {
      fontSize: '30px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);
    this._summonCdText = this.add.text(btnX, btnY + 18, '[X]', {
      fontSize: '22px', color: '#90caf9', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(10);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', this.onLaunch, this);
    this.input.keyboard.on('keydown-ESC',   this.togglePause, this);
    this.input.keyboard.on('keydown-X',     this.onAddBall,  this);
    this.input.on('pointerdown', this.onLaunch, this);
    this.input.on('pointermove', p => { if (!this.gameOver) this.movePaddleTo(p.x); });

    // Seed 1 sparse starting row so the player has something to hit immediately
    this.spawnBrickRow();

    // Waterfall spawner
    this._scheduleSpawn();

    // Pressure ramp every 30s — faster descent + faster spawning
    this.time.addEvent({
      delay: 30000, loop: true,
      callback: () => {
        this.descentSpeed += 8;
        this._syncBrickSpeed();
        this.spawnDelay = Math.max(SPAWN_DELAY_MIN, this.spawnDelay - 150);
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

    // density ramps from ~0.15 (wave 1 ≈ 1–2 bricks) to 1.0 (wave 25+ = full row)
    // Formula: density = clamp(0.15 + (wave-1) * 0.036, 0.15, 1.0)
    const density  = Math.min(1.0, 0.15 + (this.waveCount - 1) * 0.036);
    const hp       = Math.floor(BASE_HP * Math.pow(1.1, this.level - 1));
    const colorIdx = this.colorIndex % ROW_COLORS.length;
    this.colorIndex++;

    const totalW  = COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP;
    const offsetX = (this.scale.width - totalW) / 2 + BRICK_W / 2;

    // Guarantee at least 1 brick, then add more based on density
    const guaranteedCol = Phaser.Math.Between(0, COLS - 1);

    for (let col = 0; col < COLS; col++) {
      if (col !== guaranteedCol && Math.random() >= density) continue;
      const x = offsetX + col * (BRICK_W + BRICK_GAP);
      const brick = this.bricks.create(x, -BRICK_H / 2, `brick${colorIdx}`);
      brick.setImmovable(true);
      brick.body.allowGravity = false;
      brick.body.setVelocityY(this.descentSpeed);
      brick.hp       = hp;
      brick.maxHp    = hp;
      brick.hitTimer = 0;
      brick.col      = col;
    }
  }

  _syncBrickSpeed() {
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
    this.pendingBall    = ball;
    return ball;
  }

  // ─── Collision handlers ───────────────────────────────────────────────────

  onBallHitPaddle(ball) {
    // Cooldown gate — prevents the overlap firing for multiple frames on the same hit.
    // NOTE: we do NOT check vy here. Phaser already reversed vy before calling us
    // (collider behaviour), so that check would always return early. Using overlap
    // means Phaser never touches vy, so the cooldown is the only gate we need.
    if (ball.paddleCooldown > 0) return;
    ball.paddleCooldown = 300;

    // ── Position snap (anti-clip) ───────────────────────────────────────────
    // Force ball to sit exactly on the paddle top so it never clips through.
    ball.y = this.paddle.y - this.paddle.displayHeight / 2 - ball.displayHeight / 2 - 1;

    // relativeImpact: -1 (far left) … 0 (center) … +1 (far right)
    const relativeImpact = Phaser.Math.Clamp(
      (ball.x - this.paddle.x) / (this.paddle.displayWidth / 2),
      -1, 1,
    );

    // Spec formula: Vx = relativeImpact × MaxHorizontalSpeed
    // Vy derived from Pythagorean theorem so total speed = effectiveSpeed.
    // Center hit (relativeImpact = 0) → vx = 0 → ball goes straight up.
    const effectiveSpeed = BALL_SPEED * this.ballSpeedMult;
    let vx = relativeImpact * MAX_H_SPEED;
    let vy = -Math.sqrt(Math.max(0, effectiveSpeed * effectiveSpeed - vx * vx));

    // ±8° jitter as a rotation of the full velocity vector
    const jitter = Phaser.Math.FloatBetween(-8, 8) * (Math.PI / 180);
    const cosJ = Math.cos(jitter), sinJ = Math.sin(jitter);
    const rvx = vx * cosJ - vy * sinJ;
    const rvy = vx * sinJ + vy * cosJ;
    vx = rvx; vy = rvy;

    // Anti-horizontal lock
    if (Math.abs(vy) < MIN_V_SPEED) vy = -MIN_V_SPEED;

    ball.body.setVelocity(vx, vy);

    // Reset ghost pierce on each paddle hit
    if (this.ghostBall) { ball.ghost = true; ball.pierces = 1; }

    this._burst(ball.x, ball.y);

    // Hydra Bar: split into 3 (fan-out ±30°)
    if (this.hydraBar) {
      for (const offsetDeg of [-30, 30]) {
        const rad  = offsetDeg * (Math.PI / 180);
        const cosR = Math.cos(rad), sinR = Math.sin(rad);
        let bvx = vx * cosR - vy * sinR;
        let bvy = vx * sinR + vy * cosR;
        // Normalize to effectiveSpeed
        const len = Math.sqrt(bvx * bvx + bvy * bvy) || 1;
        const nb = this.balls.create(ball.x, ball.y, 'ball');
        nb.setCollideWorldBounds(true).setBounce(1);
        nb.body.allowGravity = false;
        nb.ghost          = this.ghostBall;
        nb.pierces        = this.ghostBall ? 1 : 0;
        nb.paddleCooldown = 250;
        nb.body.setVelocity(bvx / len * effectiveSpeed, bvy / len * effectiveSpeed);
      }
    }
  }

  damageBrick(brick, dmg) {
    brick.hp -= dmg;
    brick.setAlpha(0.3 + (brick.hp / brick.maxHp) * 0.7);
    if (brick.hp <= 0) {
      const bx = brick.x, by = brick.y, bcol = brick.col;
      brick.destroy();
      this.score += 10;
      this.scoreText.setText(`점수: ${this.score}`);
      this._burst(bx, by);
      this.addExp(EXP_PER_KILL);
      // Chain Reaction: 30% chance to damage adjacent bricks
      if (this.chainReaction && Math.random() < 0.3) {
        this._chainDamage(bx, by);
      }
    }
  }

  _chainDamage(x, y) {
    const hRange = BRICK_W + BRICK_GAP + 4;
    const vRange = BRICK_H + BRICK_GAP + 4;
    this.bricks.getChildren().forEach(brick => {
      if (!brick.active) return;
      const dx = Math.abs(brick.x - x);
      const dy = Math.abs(brick.y - y);
      const adjacent = (dx < hRange && dy < 4) || (dy < vRange && dx < 4);
      if (adjacent && brick.hitTimer <= 0) {
        brick.hitTimer = 150;
        this.damageBrick(brick, 1);
      }
    });
  }

  // ─── EXP & Perks ─────────────────────────────────────────────────────────

  addExp(amount) {
    this.exp += amount;
    const barW = this.expBg.width;
    this.expFill.width = Math.min(this.exp / EXP_TO_PERK, 1) * barW;
    if (this.exp >= EXP_TO_PERK) {
      this.exp = 0;
      this.expFill.width = 0;
      this.level++;
      this.levelText.setText(`레벨 ${this.level}`);
      this.scene.pause();
      this.scene.launch('PerkScene', { perks: this._getPerkOptions() });
    }
  }

  _getPerkOptions() {
    const stackLabel = (cur, max) => cur >= max ? ` (최대)` : ` (${cur}/${max})`;
    const all = [
      { id: 'hydraBar',      label: '히드라 바',    desc: '바에 맞은 볼이\n3개로 분열' },
      { id: 'heavyMetal',    label: '헤비 메탈',    desc: '볼 파워 +1\n볼 속도 -15%' },
      { id: 'ghostBall',     label: '고스트 볼',    desc: '볼이 브릭 1개\n관통 후 튕김' },
      { id: 'magnetBar',     label: '마그넷 바',    desc: '바 너비 +20%' },
      { id: 'chainReaction', label: '연쇄 반응',    desc: '30% 확률로\n인접 브릭 추가 피해' },
      {
        id: 'overdrive',
        label: '오버드라이브' + stackLabel(this.overdriveStacks, 3),
        desc: `볼 속도 +20%\n(현재: x${this.ballSpeedMult.toFixed(2)})`,
      },
    ].filter(p => !(p.id === 'overdrive' && this.overdriveStacks >= 3));
    return Phaser.Utils.Array.Shuffle(all).slice(0, 3);
  }

  applyPerk(id) {
    if (id === 'hydraBar')      { this.hydraBar = true; }
    if (id === 'ghostBall')     { this.ghostBall = true; }
    if (id === 'chainReaction') { this.chainReaction = true; }
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
    if (id === 'overdrive') {
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
    if (id === 'magnetBar') {
      const newW = this.paddle.displayWidth * 1.2;
      this.paddle.setDisplaySize(newW, this.paddle.displayHeight);
      this.paddle.body.setSize(newW, this.paddle.displayHeight);
    }
  }

  // ─── Pause ────────────────────────────────────────────────────────────────

  onAddBall() {
    if (this.gameOver) return;
    if (this.pendingBall) return;   // already one waiting on paddle
    if (this.summonCooldown > 0) return;

    // Spawn a new ball on the paddle — other balls keep flying
    this._placeBallOnPaddle();
    this.promptText.setText(this.launchMsg).setVisible(true);

    this.summonCooldown = ADD_BALL_COOLDOWN;
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
    // Route button taps to add-ball
    if (pointer && pointer.x !== undefined) {
      const b = this._summonBtnBounds;
      if (pointer.x >= b.x && pointer.x <= b.x + b.w &&
          pointer.y >= b.y && pointer.y <= b.y + b.h) {
        this.onAddBall();
        return;
      }
    }
    if (this.gameOver) { this.scene.restart(); return; }
    if (!this.pendingBall) return;

    const ball = this.pendingBall;
    this.pendingBall = null;
    this.promptText.setVisible(false);
    ball.body.setVelocity(Phaser.Math.Between(-200, 200), -(BALL_SPEED * this.ballSpeedMult));
    // Resume brick descent (only matters after auto-respawn freeze)
    this._syncBrickSpeed();
    this._updateSummonBtn();
  }

  movePaddleTo(x) {
    const half = this.paddle.displayWidth / 2;
    const cx   = Phaser.Math.Clamp(x, half, this.scale.width - half);
    this.paddle.x = cx;
    if (this.pendingBall) this.pendingBall.x = cx;
  }

  // ─── Particles ────────────────────────────────────────────────────────────

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
    // Lock paddle to fixed Y
    this.paddle.y = this.scale.height - 100;
    this.paddle.body.setVelocityY(0);
    if (this.pendingBall) this.pendingBall.x = this.paddle.x;

    // Summon cooldown tick
    if (this.summonCooldown > 0) {
      this.summonCooldown = Math.max(0, this.summonCooldown - delta);
      this._updateSummonBtn();
    }

    // Tick hit cooldowns
    this.bricks.getChildren().forEach(brick => {
      if (brick.active && brick.hitTimer > 0) brick.hitTimer -= delta;
    });
    this.balls.getChildren().forEach(ball => {
      if (ball.active && ball.paddleCooldown > 0) ball.paddleCooldown -= delta;
    });

    // Manual tunnel-check: catches fast balls that skip past Phaser's discrete
    // overlap detection in a single frame. Fires onBallHitPaddle directly.
    const paddleTop  = this.paddle.y - this.paddle.displayHeight / 2;
    const paddleLeft = this.paddle.x - this.paddle.displayWidth / 2;
    const paddleRight= this.paddle.x + this.paddle.displayWidth / 2;
    this.balls.getChildren().forEach(ball => {
      if (!ball.active || ball === this.pendingBall || ball.paddleCooldown > 0) return;
      if (ball.body.velocity.y <= 0) return;
      const ballBottom = ball.y + ball.displayHeight / 2;
      if (ballBottom >= paddleTop && ball.y < this.paddle.y &&
          ball.x >= paddleLeft && ball.x <= paddleRight) {
        this.onBallHitPaddle(ball);
      }
    });

    // Loss condition: any brick reaches the Bar
    for (const brick of this.bricks.getChildren()) {
      if (brick.active && brick.y >= this.paddle.y) {
        this.endGame();
        return;
      }
    }

    // Recycle balls that fall below screen (skip pending ball on paddle)
    this.balls.getChildren().forEach(ball => {
      if (ball === this.pendingBall) return;
      if (ball.active && ball.y > this.scale.height + 30) {
        ball.setActive(false).setVisible(false);
        ball.body.setVelocity(0, 0);
      }
    });

    // Anti-horizontal lock (skip pending ball)
    this.balls.getChildren().forEach(ball => {
      if (!ball.active || ball === this.pendingBall) return;
      if (Math.abs(ball.body.velocity.y) < MIN_V_SPEED) {
        ball.body.setVelocityY(ball.body.velocity.y >= 0 ? MIN_V_SPEED : -MIN_V_SPEED);
      }
    });

    // All flying balls gone → auto-respawn on paddle and freeze bricks
    const flyingBalls = this.balls.getChildren().filter(b => b.active && b !== this.pendingBall);
    if (flyingBalls.length === 0 && !this.pendingBall) {
      this._placeBallOnPaddle();
      this.promptText.setText(this.launchMsg).setVisible(true);
      this.bricks.getChildren().forEach(b => {
        if (b.active) b.body.setVelocityY(0);
      });
      this._updateSummonBtn();
    }

    // Destroy bricks that slip past the bottom (memory cleanup after game over check)
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
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.add.text(width / 2, height / 2 - 140, '게임 오버', {
      fontSize: '108px', fontStyle: 'bold', color: '#e53935', fontFamily: 'Arial',
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2, `점수: ${this.score}`, {
      fontSize: '64px', color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 140, this.launchMsg.replace('발사', '다시 시작'), {
      fontSize: '40px', color: '#aaaaaa', fontFamily: 'Arial',
    }).setOrigin(0.5);
  }
}
