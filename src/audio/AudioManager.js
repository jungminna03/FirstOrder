import { zzfx } from 'zzfx';

// ZzFX parameter format:
// zzfx(volume, randomness, frequency, attack, sustain, release,
//      shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime,
//      repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo)

const SOUNDS = {
  paddle_hit:     [1,   .05, 440,  0,   .02, .04, 0, 3,  0,    0, 0,   0, 0, 0, 0,  0,   0, .7, .01],
  brick_hit:      [.6,  .05, 280,  0,   .01, .03, 0, 2,  0,    0, 0,   0, 0, 0, 0,  0,   0, .5, .01],
  brick_break:    [1,   .1,  220,  0,   .02, .12, 3, 1.5,-1,   0, 0,   0, 0, 0, 0, .1,   0, .8, .04],
  level_up:       [1,   0,   330,  0,   .04, .3,  0, 3,  1.5,  0, 165, .08,0, 0, 0,  0,   0, .9, .08],
  game_over:      [1,   0,   260,  .05, .2,  .6,  0, 1, -1.5,  0, 0,   0, 0, 0, 0,  0,   0, .85,.25],
  perk_select:    [1,   0,   520,  0,   .04, .18, 0, 3,  .8,   0, 130, .04,0, 0, 0,  0,   0, .8, .04],
  shield_reflect: [1,   0,   700,  0,   .02, .08, 0, 2,  2.5,  0, 0,   0, 0, 0, 0,  0,   0, .7, .02],
  nova_burst:     [1.2, 0,   80,   0,   .04, .35, 1, 1, -3,   0, 0,   0, 0, 0, 0,  0,   0, 1,  .08],
  bomb:           [1.2, .6,  55,   0,   .04, .5,  3, 1, -.5,   0, 0,   0, 0, 6, 0, .4,   0, 1,  .15],
  electric:       [.8,  .3,  650,  0,   .01, .12, 2, 2,  4,    0, 0,   0, 0, 6, 0,  0,   0, .7, .04],
  inferno:        [.7,  .5,  130,  0,   .08, .28, 3, 1,  .3,   0, 0,   0, 0, 9, 0,  0,   0, .8, .08],
  time_freeze:    [1,   0,   900,  0,   .03, .25, 0, 2, -2,    0, 0,   0, 0, 0, 0,  0,   0, .8, .06],
};

export function playSound(id) {
  if (localStorage.getItem('fo_sfx') === 'off') return;
  const p = SOUNDS[id];
  if (p) zzfx(...p);
}
