import Phaser from 'phaser';

const BRICK_W   = 68;
const BRICK_H   = 20;
const BRICK_GAP = 4;
const COLS      = 10;
const ROWS      = 6;
const BALL_SPEED = 320;

const ROW_COLORS = [0xe53935, 0xfb8c00, 0xfdd835, 0x43a047, 0x1e88e5, 0x8e24aa];
const ROW_POINTS = [7, 5, 4, 3, 2, 1];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── Asset generation ────────────────────────────────────────────────────

  preload() {
    // Paddle
    const pg = this.make.graphics({ add: false });
    pg.fillStyle(0x4fc3f7);
    pg.fillRoundedRect(0, 0, 104, 18, 9);
    pg.generateTexture('paddle', 104, 18);
    pg.destroy();

    // Ball
    const bg = this.make.graphics({ add: false });
    bg.fillStyle(0xffffff);
    bg.fillCircle(8, 8, 8);
    bg.generateTexture('ball', 16, 16);
    bg.destroy();

    // Bricks (one texture per row color)
    ROW_COLORS.forEach((color, i) => {
      const g = this.make.graphics({ add: false });
      g.fillStyle(color);
      g.fillRoundedRect(0, 0, BRICK_W, BRICK_H, 3);
      g.lineStyle(1, 0xffffff, 0.15);
      g.strokeRoundedRect(0, 0, BRICK_W, BRICK_H, 3);
      g.generateTexture(`brick${i}`, BRICK_W, BRICK_H);
      g.destroy();
    });
  }

  // ─── Scene setup ─────────────────────────────────────────────────────────

  create() {
    const { width, height } = this.scale;

    this.score       = 0;
    this.lives       = 3;
    this.ballOnPaddle = true;
    this.gameOver    = false;

    this.physics.world.setBoundsCollision(true, true, true, false);

    // Bricks
    this.bricks = this.physics.add.staticGroup();
    this.buildBricks();

    // Paddle
    this.paddle = this.physics.add.image(width / 2, height - 36, 'paddle')
      .setImmovable(true)
      .setCollideWorldBounds(true);

    // Ball
    this.ball = this.physics.add.image(width / 2, height - 58, 'ball')
      .setCollideWorldBounds(true)
      .setBounce(1);

    // Colliders
    this.physics.add.collider(this.ball, this.paddle, this.onHitPaddle, null, this);
    this.physics.add.collider(this.ball, this.bricks,  this.onHitBrick,  null, this);

    // HUD
    this.scoreText = this.add.text(16, 12, 'Score: 0',  { fontSize: '20px', color: '#ffffff' });
    this.livesText = this.add.text(width - 16, 12, '❤ ❤ ❤', { fontSize: '18px', color: '#ff6b6b' })
      .setOrigin(1, 0);

    // Launch prompt
    const isMobile = !this.sys.game.device.os.desktop;
    this.launchMsg = isMobile ? 'Tap to launch' : 'SPACE or click to launch';
    this.promptText = this.add.text(width / 2, height / 2 + 60, this.launchMsg, {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', this.launchOrRestart, this);
    this.input.keyboard.on('keydown-ESC', this.togglePause, this);
    this.input.on('pointerdown', this.launchOrRestart, this);
    this.input.on('pointermove', (p) => {
      if (!this.gameOver) this.movePaddleTo(p.x);
    });
  }

  // ─── Brick grid ──────────────────────────────────────────────────────────

  buildBricks() {
    const totalW  = COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP;
    const offsetX = (this.scale.width - totalW) / 2 + BRICK_W / 2;
    const offsetY = 60;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = offsetX + col * (BRICK_W + BRICK_GAP);
        const y = offsetY + row * (BRICK_H + BRICK_GAP);
        const brick = this.bricks.create(x, y, `brick${row}`);
        brick.points = ROW_POINTS[row];
        brick.refreshBody();
      }
    }
  }

  // ─── Collision handlers ───────────────────────────────────────────────────

  onHitPaddle() {
    // Steer ball based on hit position relative to paddle center
    const diff    = this.ball.x - this.paddle.x;
    const normDiff = diff / (this.paddle.width / 2); // -1 .. 1
    const angle   = normDiff * 60;                   // -60° .. 60°
    const rad     = Phaser.Math.DegToRad(angle - 90);
    this.ball.body.setVelocity(
      BALL_SPEED * Math.cos(rad),
      BALL_SPEED * Math.sin(rad),
    );
  }

  onHitBrick(ball, brick) {
    brick.destroy();
    this.score += brick.points;
    this.scoreText.setText(`Score: ${this.score}`);

    if (this.bricks.countActive() === 0) {
      this.endGame(true);
    }
  }

  // ─── Pause ────────────────────────────────────────────────────────────────

  togglePause() {
    if (this.gameOver) return;
    this.scene.pause();
    this.scene.launch('PauseScene');
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  launchOrRestart() {
    if (this.gameOver) {
      this.scene.restart();
      return;
    }
    if (this.ballOnPaddle) {
      this.ballOnPaddle = false;
      this.promptText.setVisible(false);
      this.ball.body.setVelocity(
        Phaser.Math.Between(-80, 80),
        -BALL_SPEED,
      );
    }
  }

  movePaddleTo(x) {
    const half  = this.paddle.width / 2;
    const clamp = Phaser.Math.Clamp(x, half, this.scale.width - half);
    this.paddle.x = clamp;
    if (this.ballOnPaddle) this.ball.x = clamp;
  }

  // ─── Game loop ────────────────────────────────────────────────────────────

  update() {
    if (this.gameOver) return;

    const speed = 500;

    if (this.cursors.left.isDown) {
      this.paddle.body.setVelocityX(-speed);
      if (this.ballOnPaddle) this.ball.x = this.paddle.x;
    } else if (this.cursors.right.isDown) {
      this.paddle.body.setVelocityX(speed);
      if (this.ballOnPaddle) this.ball.x = this.paddle.x;
    } else {
      this.paddle.body.setVelocityX(0);
    }

    // Enforce minimum vertical speed (prevents near-horizontal loops)
    if (!this.ballOnPaddle && Math.abs(this.ball.body.velocity.y) < 80) {
      const sign = this.ball.body.velocity.y >= 0 ? 1 : -1;
      this.ball.body.setVelocityY(sign * 80);
    }

    // Ball fell below paddle → lose a life
    if (this.ball.y > this.scale.height + 20) {
      this.loseLife();
    }
  }

  // ─── Lives & end state ────────────────────────────────────────────────────

  loseLife() {
    this.lives--;
    this.updateLivesHUD();

    if (this.lives <= 0) {
      this.endGame(false);
    } else {
      this.resetBall();
    }
  }

  resetBall() {
    this.ballOnPaddle = true;
    this.ball.body.setVelocity(0, 0);
    this.ball.x = this.paddle.x;
    this.ball.y = this.paddle.y - 22;
    this.promptText.setText(this.launchMsg).setVisible(true);
  }

  updateLivesHUD() {
    this.livesText.setText('❤ '.repeat(this.lives).trim());
  }

  endGame(won) {
    this.gameOver = true;
    this.ball.body.setVelocity(0, 0);
    this.ball.setVisible(false);

    const { width, height } = this.scale;

    // Dim overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);

    this.add.text(width / 2, height / 2 - 60, won ? 'YOU WIN!' : 'GAME OVER', {
      fontSize: '56px',
      fontStyle: 'bold',
      color: won ? '#fdd835' : '#e53935',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 10, `Final Score: ${this.score}`, {
      fontSize: '28px', color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 70, this.launchMsg.replace('launch', 'play again'), {
      fontSize: '18px', color: '#aaaaaa',
    }).setOrigin(0.5);
  }
}
