# 📂 MASTER SPECIFICATION: Chaos-Bar Roguelike (Phaser 3)

## 1. Game Overview
A mobile-first, Roguelike-RPG spin on the Breakout genre. The player doesn't focus on catching a single ball to survive, but on **positioning the Bar to multiply a "flow" of balls** to destroy a continuous stream of descending bricks.

---

## 2. Platform & Display (Mobile First)
- **Orientation:** Portrait Mode (9:16 aspect ratio).
- **Target Resolution:** 1080 x 1920 (scaled to fit).
- **Input:** Touch/Pointer Drag (Paddle follows finger X-position with a vertical offset).

---

## 3. Core Mechanics

### 3.1 The Bar (Multiplier Factory)
- **No Life Loss:** Balls falling below are recycled.
- **Function:** Multiplies balls on impact.

### 3.2 The Bricks & Early Game Balance (CRITICAL)
- **Initial Difficulty (Level 1):** - The game must start with **only 1 or 2 rows** of bricks.
  - **Brick HP:** Level 1 bricks must have exactly **1 or 2 HP**.
  - **Ball Power:** Default Ball Power is **1**.
  - **Goal:** Early bricks should be destroyed in **1-2 hits** to allow fast EXP gain.
- **Continuous Descent:** Bricks move down. Game over if they reach the Bar.
- **Waterfall Spawning:** New bricks spawn at the top algorithmically.

### 3.3 Dynamic Brick Spawning Algorithm (The "Waterfall")
- **Initial State:** The game starts with a **single sparse row** (1–2 bricks). Bricks are not pre-spawned in a full grid.
- **Spawn Location:** New bricks are generated at the top of the screen ($y < 0$), hidden from view until they move into the play area.
- **Spawn Timing:** A new row of bricks is generated every `T` seconds. `T` decreases slightly as the game progresses to increase pressure.
- **Density Ramp:** Each wave's brick count increases gradually.
  - `density = clamp(0.15 + (waveCount - 1) × 0.036, 0.15, 1.0)`
  - Wave 1: ~1–2 bricks | Wave 10: ~4–5 bricks | Wave 25+: up to 10 bricks (full row)
  - At least 1 brick is always guaranteed per wave.
  - This creates a non-linear escalation from easy opener to intense late-game pressure.

---

## 4. The "Golden Rule" of Ball-Paddle Collision (No Default Bounce)

To fix the "Static Bounce Angle" bug, the `onPaddleHit` function must **ABORT** Phaser's default physics calculation and apply this **Manual Velocity Override**:

### A. Step 1: Prevent Tunnelling (Clipping Fix)
- Immediately set `ball.y = paddle.y - (paddle.displayHeight / 2) - (ball.displayHeight / 2) - 2;`
- This ensures the ball is physically ABOVE the paddle before the velocity changes.

### B. Step 2: The Directional Formula (X-Offset Logic)
The ball's horizontal direction MUST be dictated by where it hits the bar.
1. **Calculate Distance:** `let diff = ball.x - paddle.x;`
2. **Normalize:** `let percentage = diff / (paddle.width / 2);` (This gives a value between -1.0 and 1.0)
3. **Set Velocity X:** `ball.setVelocityX(percentage * MaxHorizontalSpeed);`
  - **Center Hit (0):** Bounces straight up (Velocity X ≈ 0).
  - **Far Right Hit (1.0):** Bounces sharply to the right.
  - **Far Left Hit (-1.0):** Bounces sharply to the left.
4. **Set Velocity Y:** `ball.setVelocityY(-Math.abs(ball.body.velocity.y));` (Force upward movement)

### C. Step 3: Anti-Loop Jitter
- Add a tiny random value to the final X velocity: `ball.body.velocity.x += (Math.random() - 0.5) * 20;`
- This prevents the ball from getting stuck in a perfect vertical or horizontal loop.

### D. Critical Implementation Rule
- Do **NOT** rely on `ball.setBounce(1)`.
- In the collision callback, you must explicitly set the velocities. If the ball is still bouncing incorrectly, use `ball.body.stop()` for a millisecond before applying the new velocities to clear the old physics state.

---

## 5. RPG & Perk System

### 5.1 Experience (EXP) & Leveling
- **EXP Gain:** Destroying a brick grants EXP.
- **Level Up:** When EXP is full, the game **PAUSES** and the **Perk Selection UI** appears.

### 5.2 Perk Pool (Choose 1 of 3)
1. **Hydra Bar:** Balls hitting the bar split into 3 (Fan-out pattern).
2. **Heavy Metal:** Ball Power +10, but Ball Speed -15%.
3. **Ghost Ball:** Balls pierce through 1 brick before bouncing.
4. **Magnet Bar:** Increases Bar width by 20%.
5. **Chain Reaction:** Destroyed bricks have a chance to damage adjacent bricks.

---

## 6. Technical Implementation (For Claude)
- **Physics:** Ensure `paddle.body.immovable = true`.
- **Velocity Override:** Call `setVelocityX` *after* the collision event to ensure the custom angle is applied.

---

## 7. Controls Summary (Mobile)

| Input | Action |
|---|---|
| **Pointer Drag (X)** | Move Bar horizontally |
| **UI Buttons** | Select Perks / Resume / Restart |