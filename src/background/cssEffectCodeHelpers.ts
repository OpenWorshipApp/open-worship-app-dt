import type {
    CssAnimationNameType,
    CssAnimationType,
} from './animationValueHelpers';
import {
    CSS_CODE_BOXES_COMMENT,
    CSS_CODE_STARTER,
} from './cssCodeAnimationHelpers';

/**
 * Every built-in CSS effect written as CSS for the boxes the app draws
 * (`cssCodeAnimationHelpers`), so its **CSS Code** opens on the effect the
 * person picked -- as a shader's Shader Code opens on its own source --
 * and not on a starter that looks like none of them (2026-11-19, the user,
 * Glory - Light Rays picked and CSS Code showing drifting lights: _css code
 * editor not starting from current selected_).
 *
 * Each is the built-in's own recipe (`cssAnimationLayerHelpers`) told in
 * the code's terms: the same gradients, keyframes, counts by Density and
 * timings; the seeded places and sizes come from each dot's `--x`, `--y`
 * and `--r` instead. Colours are the frame's variables only (an alpha
 * through `color-mix`): `var(--color-N)` for a colour by its place, and
 * the accents -- the colours after the ground in turn, as the built-ins'
 * `genAccents` gives them to their parts -- as each box's `var(--accent)`
 * or `var(--accent-N)`, so three colours go a, b, a, b as the built-in
 * does, not a, b, b. So the text never depends on the animation's
 * colours, speed or density, and the panel can tell a new effect from a
 * new colour. Applied unchanged, it is that effect as **Custom CSS** --
 * but for Light Rays with one accent, which the built-in draws as one
 * sheet of rays and this as two.
 *
 * Only the code panel (lazy) and the assistant's read (a lazy import) load
 * this: the screens never need it.
 */

function genHeader(title: string) {
    return (
        `/* ${title}, written as CSS.\n${CSS_CODE_BOXES_COMMENT}\n` +
        '   Change it and Apply: it becomes Custom CSS. */\n'
    );
}

const RAYS_CODE = `${genHeader('Light Rays')}
/* Rays from a point above the top: fewer and wider at Low Density. */
.scene {
  --period: calc(18deg - var(--density) * 5deg);
}

/* Two sheets of rays, each in its accent, swaying against each other
   and brightening. */
.layer:nth-child(-n + 2) {
  inset: -10% -30% -20% -30%;
  transform-origin: 50% 8%;
  background: repeating-conic-gradient(
    from var(--offset) at 50% 8%,
    transparent 0deg,
    color-mix(in srgb, var(--accent) 32%, transparent) calc(var(--period) * 0.2),
    transparent calc(var(--period) * 0.4),
    transparent var(--period)
  );
  animation:
    sway 17s ease-in-out -3s infinite alternate,
    pulse 17s ease-in-out -3s infinite alternate;
}
.layer:nth-child(1) {
  --offset: 0deg;
  --from: -6deg;
  --to: 6deg;
}
.layer:nth-child(2) {
  --offset: 7deg;
  --from: 5deg;
  --to: -5deg;
  animation-duration: 21s;
  animation-delay: -8s;
}

/* The light fading into the ground below. */
.layer:nth-child(3) {
  background: linear-gradient(180deg, transparent 25%, var(--color-1) 100%);
}
.layer:nth-child(n + 4) {
  display: none;
}

@keyframes sway {
  from {
    transform: rotate(var(--from));
  }
  to {
    transform: rotate(var(--to));
  }
}
@keyframes pulse {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}
`;

const AURORA_CODE = `${genHeader('Aurora')}
/* Large soft lights drifting, turning and growing: 3, 4 or 6 by Density
   (dots 1-3, then 10 from Normal, 17 and 18 at High: each light the next
   accent). */
.layer:nth-child(n + 2),
.dot {
  display: none;
}
.dot:is(:nth-child(-n + 3), :nth-child(10), :nth-child(17), :nth-child(18)) {
  display: block;
  left: calc(var(--x) * 1% - 25%);
  top: calc(var(--y) * 0.9% - 30%);
  width: calc(42cqmax + var(--r) * 26cqmax);
  aspect-ratio: 1;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--accent) 70%, transparent),
    color-mix(in srgb, var(--accent) 25%, transparent) 55%,
    transparent
  );
  animation: float calc(16s + var(--r) * 12s) ease-in-out
    calc(var(--i) * -3.1s) infinite alternate;
}

@keyframes float {
  to {
    transform: translate(calc((var(--y) - 50) * 0.7%), calc((var(--x) - 50) * 0.5%))
      rotate(calc((var(--r) - 0.5) * 80deg)) scale(calc(0.85 + var(--r) * 0.4));
  }
}
`;

type RisingOptionType = {
    title: string;
    comment: string;
    hidden: string;
    size: string;
    seconds: string;
    sway: string;
    stops: string;
    ground: string;
};

/** Bokeh and embers: lights rising from below and fading on the way. */
function genRisingCode(option: RisingOptionType) {
    return `${genHeader(option.title)}${option.ground}
/* ${option.comment} */
${option.hidden} {
  display: none;
}
.dot {
  --sway: ${option.sway};
  left: calc(var(--x) * 1% - 3%);
  top: 0;
  width: ${option.size};
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(
    circle,
${option.stops}
  );
  animation:
    rise ${option.seconds} linear calc(var(--i) * -1.3s - var(--x) * 0.13s) infinite,
    fade ${option.seconds} linear calc(var(--i) * -1.3s - var(--x) * 0.13s) infinite;
}

@keyframes rise {
  from {
    transform: translate3d(0, 105cqh, 0);
  }
  to {
    transform: translate3d(var(--sway), -30cqh, 0);
  }
}
@keyframes fade {
  0%,
  100% {
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
}
`;
}

const BOKEH_CODE = genRisingCode({
    title: 'Bokeh',
    comment:
        'Out-of-focus lights: 12, 18 or 26 by Density (layer 1, and six of layer 2).',
    hidden: '.layer:nth-child(n + 3),\n.layer:nth-child(2) .dot:nth-child(n + 7)',
    size: 'calc(4cqmin + var(--r) * 9cqmin)',
    seconds: 'calc(14s + var(--r) * 12s)',
    sway: 'calc((var(--y) - 50) * 0.16cqmin)',
    stops: [
        '    color-mix(in srgb, var(--accent) 55%, transparent) 0 36%,',
        '    color-mix(in srgb, var(--accent) 22%, transparent) 60%,',
        '    transparent 70%',
    ].join('\n'),
    ground: '',
});

const EMBERS_CODE = genRisingCode({
    title: 'Embers',
    comment:
        'Sparks over a glow: 16, 28 or 44 by Density (layers 1 and 2, and four of layer 3).',
    hidden: '.layer:nth-child(n + 4),\n.layer:nth-child(3) .dot:nth-child(n + 5)',
    size: 'calc(0.7cqmin + var(--r) * 1.5cqmin)',
    seconds: 'calc(7s + var(--r) * 6s)',
    sway: 'calc((var(--y) - 50) * 0.28cqmin)',
    stops: [
        '    var(--accent) 0 27%,',
        '    color-mix(in srgb, var(--accent) 45%, transparent) 45%,',
        '    transparent 70%',
    ].join('\n'),
    ground: `
/* A glow rising from below the bottom edge. */
.scene {
  background:
    radial-gradient(
      ellipse at 50% 120%,
      color-mix(in srgb, var(--color-2) 45%, transparent),
      transparent 60%
    ),
    var(--color-1);
}
`,
});

const SNOW_CODE = `${genHeader('Snowfall')}
/* Flakes falling and drifting: 24, 42 or 66 by Density (layers 1 to 3,
   and six of layer 4). The bigger, nearer flakes fall faster. */
.layer:nth-child(n + 5),
.layer:nth-child(4) .dot:nth-child(n + 7) {
  display: none;
}
.dot {
  --sway: calc((var(--y) - 50) * 0.2cqmin);
  left: calc(var(--x) * 1% - 3%);
  top: 0;
  width: calc(0.6cqmin + var(--r) * 1.3cqmin);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 95%, transparent) 0 30%,
    color-mix(in srgb, var(--accent) 50%, transparent) 50%,
    transparent 70%
  );
  animation: fall calc(22s - var(--r) * 12s) linear
    calc(var(--i) * -1.7s - var(--x) * 0.2s) infinite;
}

@keyframes fall {
  from {
    transform: translate3d(0, -6cqh, 0);
  }
  to {
    transform: translate3d(var(--sway), 101cqh, 0);
  }
}
`;

const CLOUDS_CODE = `${genHeader('Clouds')}
/* A sky lit from above. */
.scene {
  background:
    radial-gradient(
      ellipse at 50% -10%,
      color-mix(in srgb, var(--color-4) 45%, transparent),
      transparent 55%
    ),
    linear-gradient(
      180deg,
      transparent 30%,
      color-mix(in srgb, var(--color-4) 30%, transparent) 100%
    ),
    var(--color-1);
}

/* Clouds drifting across, the big ones slower: 4, 6 or 9 by Density
   (dots 1-4, then 11 and 12 from Normal, 13 to 15 at High: each cloud
   the next accent). */
.layer:nth-child(n + 2),
.dot {
  display: none;
}
.dot:is(:nth-child(-n + 4), :nth-child(n + 11):nth-child(-n + 15)) {
  display: block;
  --puff: color-mix(in srgb, var(--accent) 75%, transparent);
  --edge: color-mix(in srgb, var(--accent) 40%, transparent);
  --wide: calc(32cqw + var(--r) * 20cqw);
  left: calc(-1 * var(--wide));
  top: calc(var(--y) * 0.64% - 6%);
  width: var(--wide);
  height: calc(var(--wide) * 0.42);
  background:
    radial-gradient(ellipse 30% 45% at 30% 58%, var(--puff), var(--edge) 45%, transparent 72%),
    radial-gradient(ellipse 38% 55% at 52% 50%, var(--puff), var(--edge) 45%, transparent 72%),
    radial-gradient(ellipse 26% 40% at 72% 60%, var(--puff), var(--edge) 45%, transparent 72%),
    radial-gradient(ellipse 34% 38% at 45% 64%, var(--puff), var(--edge) 45%, transparent 72%);
  animation: drift calc(70s + var(--r) * 50s) linear calc(var(--x) * -1.2s) infinite;
}

@keyframes drift {
  to {
    transform: translate3d(calc(100cqw + 100%), 0, 0);
  }
}
`;

const CROSS_CODE = `${genHeader('Cross')}
.layer:nth-child(n + 5) {
  display: none;
}

/* 1: rays round the cross, turning slowly; fewer at Low Density. */
.layer:nth-child(1) {
  --period: calc(18deg - var(--density) * 5deg);
  inset: -15% -20% -25% -20%;
  transform-origin: 50% 43%;
  background: repeating-conic-gradient(
    from 0deg at 50% 43%,
    transparent 0deg,
    color-mix(in srgb, var(--color-4) 22%, transparent) calc(var(--period) * 0.2),
    transparent calc(var(--period) * 0.4),
    transparent var(--period)
  );
  animation: sway 24s ease-in-out infinite alternate;
}

/* 2: the glow behind it, breathing. */
.layer:nth-child(2) {
  background: radial-gradient(
    circle at 50% 45%,
    color-mix(in srgb, var(--color-3) 65%, transparent),
    color-mix(in srgb, var(--color-3) 20%, transparent) 22cqmin,
    transparent 48cqmin
  );
  animation: pulse 5s ease-in-out infinite alternate;
}

/* 3 and 4: the two bars of the cross. */
.layer:nth-child(3),
.layer:nth-child(4) {
  inset: auto;
  border-radius: 0.6cqmin;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-2) 85%, transparent),
    var(--color-2) 50%,
    color-mix(in srgb, var(--color-2) 85%, transparent)
  );
  box-shadow: 0 0 3cqmin color-mix(in srgb, var(--color-3) 80%, transparent);
}
.layer:nth-child(3) {
  left: calc(50% - 2.1cqmin);
  top: calc(45% - 20cqmin);
  width: 4.2cqmin;
  height: 58cqmin;
}
.layer:nth-child(4) {
  left: calc(50% - 17cqmin);
  top: calc(45% - 4.7cqmin);
  width: 34cqmin;
  height: 4.2cqmin;
}

@keyframes sway {
  from {
    transform: rotate(-8deg);
  }
  to {
    transform: rotate(8deg);
  }
}
@keyframes pulse {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}
`;

const WAVES_CODE = `${genHeader('Waves')}
/* Bands of waves, back to front, each lower and quicker and the next
   accent: 2, 3 or 4 by Density (dots 1 and 2, then 7 from Normal, 13 at
   High). */
.layer:nth-child(n + 2),
.dot {
  display: none;
}
.dot:is(:nth-child(-n + 2), :nth-child(7), :nth-child(13)) {
  display: block;
  --wave: color-mix(in srgb, var(--tint) var(--alpha), transparent);
  left: 0;
  bottom: 0;
  width: 200%;
  height: calc(55% - 30% * var(--band) / (2 + var(--density)));
  background:
    radial-gradient(ellipse 50% 100% at 50% 100%, var(--wave) 98%, transparent 100%)
      0 0 / var(--tile) var(--crest) repeat-x,
    linear-gradient(180deg, transparent var(--crest), var(--wave) var(--crest));
  animation: slide var(--seconds) linear infinite;
}
.dot:nth-child(1) {
  --band: 0;
  --tint: var(--accent-1);
  --alpha: 45%;
  --tile: 12.5%;
  --crest: 14%;
  --seconds: 9s;
}
.dot:nth-child(2) {
  --band: 1;
  --tint: var(--accent-2);
  --alpha: 60%;
  --tile: 10%;
  --crest: 12%;
  --seconds: 7.5s;
  animation-delay: -2s;
}
.dot:nth-child(7) {
  --band: 2;
  --tint: var(--accent-3);
  --alpha: 70%;
  --tile: 8.33%;
  --crest: 16%;
  --seconds: 6s;
  animation-delay: -1s;
}
.dot:nth-child(13) {
  --band: 3;
  --tint: var(--accent-4);
  --alpha: 75%;
  --tile: 6.25%;
  --crest: 11%;
  --seconds: 5s;
  animation-delay: -3s;
}

/* One crest along, then round again. */
@keyframes slide {
  to {
    transform: translate3d(calc(-1 * var(--tile)), 0, 0);
  }
}
`;

const STARS_CODE = `${genHeader('Starfield')}
.scene {
  background:
    radial-gradient(
      ellipse at 50% 115%,
      color-mix(in srgb, var(--color-2) 30%, transparent),
      transparent 60%
    ),
    var(--color-1);
  /* Higher Density: smaller tiles, so more stars. */
  --grid: calc(1.29 - var(--density) * 0.25);
}

/* Three tiled sheets of stars, the far ones smaller and slower, each
   moving down one tile and twinkling; the stars take the accents in
   turn, each sheet starting one further on. */
.layer:nth-child(n + 4) {
  display: none;
}
.layer:nth-child(-n + 3) {
  --tile: calc(var(--size) * var(--grid));
  top: calc(-1 * var(--tile));
  background-size: var(--tile) var(--tile);
  animation:
    fall var(--seconds) linear var(--delay) infinite,
    twinkle var(--seconds) linear var(--delay) infinite;
}
.layer:nth-child(1) {
  --size: 18cqmin;
  --seconds: 40s;
  --delay: -7s;
  background-image:
    radial-gradient(circle at 12% 30%, var(--accent-1) 0 0.6cqmin, transparent 1.3cqmin),
    radial-gradient(circle at 58% 12%, var(--accent-2) 0 0.45cqmin, transparent 1cqmin),
    radial-gradient(circle at 81% 64%, var(--accent-3) 0 0.8cqmin, transparent 1.7cqmin),
    radial-gradient(circle at 35% 82%, var(--accent-4) 0 0.4cqmin, transparent 0.9cqmin),
    radial-gradient(circle at 66% 45%, var(--accent-5) 0 0.55cqmin, transparent 1.2cqmin);
}
.layer:nth-child(2) {
  --size: 27cqmin;
  --seconds: 65s;
  --delay: -23s;
  background-image:
    radial-gradient(circle at 22% 18%, var(--accent-2) 0 0.4cqmin, transparent 0.9cqmin),
    radial-gradient(circle at 74% 33%, var(--accent-3) 0 0.3cqmin, transparent 0.65cqmin),
    radial-gradient(circle at 48% 71%, var(--accent-4) 0 0.5cqmin, transparent 1.1cqmin),
    radial-gradient(circle at 9% 88%, var(--accent-5) 0 0.28cqmin, transparent 0.6cqmin),
    radial-gradient(circle at 91% 52%, var(--accent-6) 0 0.36cqmin, transparent 0.8cqmin);
}
.layer:nth-child(3) {
  --size: 41cqmin;
  --seconds: 90s;
  --delay: -31s;
  background-image:
    radial-gradient(circle at 31% 41%, var(--accent-3) 0 0.2cqmin, transparent 0.45cqmin),
    radial-gradient(circle at 86% 9%, var(--accent-4) 0 0.15cqmin, transparent 0.33cqmin),
    radial-gradient(circle at 63% 93%, var(--accent-5) 0 0.25cqmin, transparent 0.55cqmin),
    radial-gradient(circle at 5% 60%, var(--accent-6) 0 0.13cqmin, transparent 0.3cqmin),
    radial-gradient(circle at 52% 24%, var(--accent-1) 0 0.18cqmin, transparent 0.4cqmin);
}

@keyframes fall {
  to {
    transform: translate3d(0, var(--tile), 0);
  }
}
@keyframes twinkle {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.35;
  }
}
`;

const BREATHE_CODE = `${genHeader('Breathe')}
/* Soft glows swelling and fading in turn, each the next accent: 2, 3 or
   4 by Density (dots 1 and 2, then 7 from Normal, 13 at High). */
.layer:nth-child(n + 2),
.dot {
  display: none;
}
.dot:is(:nth-child(-n + 2), :nth-child(7), :nth-child(13)) {
  display: block;
  inset: 0;
  background: radial-gradient(
    ellipse at var(--at),
    color-mix(in srgb, var(--glow) 80%, transparent),
    transparent 65%
  );
  animation: glow 12s ease-in-out infinite;
  animation-delay: calc(-12s * var(--band) / (2 + var(--density)));
}
.dot:nth-child(1) {
  --band: 0;
  --glow: var(--accent-1);
  --at: 30% 35%;
}
.dot:nth-child(2) {
  --band: 1;
  --glow: var(--accent-2);
  --at: 70% 60%;
}
.dot:nth-child(7) {
  --band: 2;
  --glow: var(--accent-3);
  --at: 45% 78%;
}
.dot:nth-child(13) {
  --band: 3;
  --glow: var(--accent-4);
  --at: 80% 22%;
}

@keyframes glow {
  0% {
    opacity: 0;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
  }
}
`;

type FallingOptionType = {
    title: string;
    comment: string;
    hidden: string;
    look: string;
    seconds: string;
    sway: string;
    turn: string;
    turnKeyframes: string;
};

/**
 * Leaves, petals and confetti: shapes falling and turning on the way, the
 * fall and the turn two animations of their own (`translate` and
 * `rotate`), so neither stops the other.
 */
function genFallingCode(option: FallingOptionType) {
    return `${genHeader(option.title)}
/* ${option.comment} */
${option.hidden} {
  display: none;
}
.dot {
  --sway: ${option.sway};
  left: calc(var(--x) * 1% - 3%);
  top: 0;
${option.look}
  animation:
    fall ${option.seconds} linear calc(var(--i) * -1.7s - var(--x) * 0.2s) infinite,
    ${option.turn};
}

@keyframes fall {
  from {
    translate: 0 -6cqh;
  }
  to {
    translate: var(--sway) 101cqh;
  }
}
${option.turnKeyframes}`;
}

const TUMBLE_KEYFRAMES = `@keyframes tumble {
  from {
    rotate: var(--tx) var(--ty) 0 0deg;
  }
  to {
    rotate: var(--tx) var(--ty) 0 360deg;
  }
}
`;

const SWING_KEYFRAMES = `@keyframes swing {
  from {
    rotate: calc(-1 * var(--swing));
  }
  to {
    rotate: var(--swing);
  }
}
`;

const LEAVES_CODE = genFallingCode({
    title: 'Falling Leaves',
    comment:
        'Leaves falling and swinging back and forth: 10, 16 or 24 by ' +
        'Density (layer 1, and four of layer 2).',
    hidden: '.layer:nth-child(n + 3),\n.layer:nth-child(2) .dot:nth-child(n + 5)',
    look: [
        '  --swing: calc(25deg + var(--r) * 35deg);',
        '  width: calc(2.2cqmin + var(--r) * 2.4cqmin);',
        '  aspect-ratio: 1;',
        '  border-radius: 0 80% 0 80%;',
        '  background: linear-gradient(',
        '    135deg,',
        '    color-mix(in srgb, var(--accent) 95%, transparent) 0 47%,',
        '    color-mix(in srgb, var(--accent) 55%, transparent) 50%,',
        '    color-mix(in srgb, var(--accent) 80%, transparent) 53% 100%',
        '  );',
    ].join('\n'),
    seconds: 'calc(12s + var(--r) * 9s)',
    sway: 'calc((var(--y) - 50) * 0.32cqmin)',
    turn:
        'swing calc(2.4s + var(--r) * 2.2s) ease-in-out calc(var(--x) * -0.05s)' +
        ' infinite alternate',
    turnKeyframes: SWING_KEYFRAMES,
});

const PETALS_CODE = genFallingCode({
    title: 'Petals',
    comment:
        'Soft petals drifting down and turning over: 12, 24 or 40 by ' +
        'Density (layers 1 and 2).',
    hidden: '.layer:nth-child(n + 3)',
    look: [
        '  --tx: calc(0.4 + var(--r) * 0.6);',
        '  --ty: calc((var(--y) - 50) * 0.012);',
        '  width: calc(1.2cqmin + var(--r) * 1.4cqmin);',
        '  aspect-ratio: 0.75;',
        '  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;',
        '  background: radial-gradient(',
        '    ellipse at 40% 30%,',
        '    color-mix(in srgb, var(--accent) 95%, transparent),',
        '    color-mix(in srgb, var(--accent) 70%, transparent) 70%',
        '  );',
    ].join('\n'),
    seconds: 'calc(14s + var(--r) * 10s)',
    sway: 'calc((var(--y) - 50) * 0.44cqmin)',
    turn: 'tumble calc(3s + var(--r) * 3s) linear calc(var(--x) * -0.06s) infinite',
    turnKeyframes: TUMBLE_KEYFRAMES,
});

const CONFETTI_CODE = genFallingCode({
    title: 'Confetti',
    comment:
        'Ribbons of every colour tumbling down: 18, 36 or 60 by Density ' +
        '(layers 1 to 3).',
    hidden: '.layer:nth-child(n + 4)',
    look: [
        '  --tx: calc(0.2 + var(--r) * 0.8);',
        '  --ty: calc((var(--y) - 50) * 0.02);',
        '  width: calc(0.7cqmin + var(--r) * 0.7cqmin);',
        '  aspect-ratio: 0.45;',
        '  border-radius: 0.15cqmin;',
        '  background: color-mix(in srgb, var(--accent) 95%, transparent);',
    ].join('\n'),
    seconds: 'calc(7s + var(--r) * 6s)',
    sway: 'calc((var(--y) - 50) * 0.16cqmin)',
    turn: 'tumble calc(1.4s + var(--r) * 1.6s) linear calc(var(--x) * -0.03s) infinite',
    turnKeyframes: TUMBLE_KEYFRAMES,
});

const HEARTS_CODE = `${genHeader('Hearts')}
/* Hearts rising, swaying and fading: 8, 14 or 22 by Density (layer 1,
   and two of layer 2). */
.layer:nth-child(n + 3),
.layer:nth-child(2) .dot:nth-child(n + 3) {
  display: none;
}
.dot {
  --sway: calc((var(--y) - 50) * 0.2cqmin);
  --swing: calc(8deg + var(--r) * 8deg);
  left: calc(var(--x) * 1% - 3%);
  top: 0;
  width: calc(2cqmin + var(--r) * 3cqmin);
  aspect-ratio: 1.08;
  clip-path: polygon(
    50% 100%, 14% 64%, 3% 44%, 2% 26%, 10% 11%, 24% 3%, 38% 4%,
    50% 16%, 62% 4%, 76% 3%, 90% 11%, 98% 26%, 97% 44%, 86% 64%
  );
  background: radial-gradient(
    circle at 32% 30%,
    color-mix(in srgb, var(--accent) 95%, transparent),
    color-mix(in srgb, var(--accent) 65%, transparent) 75%
  );
  animation:
    rise calc(12s + var(--r) * 8s) linear calc(var(--i) * -1.9s - var(--x) * 0.13s) infinite,
    fade calc(12s + var(--r) * 8s) linear calc(var(--i) * -1.9s - var(--x) * 0.13s) infinite,
    swing calc(2.6s + var(--r) * 1.8s) ease-in-out calc(var(--x) * -0.04s) infinite alternate;
}

@keyframes rise {
  from {
    translate: 0 105cqh;
  }
  to {
    translate: var(--sway) -30cqh;
  }
}
@keyframes fade {
  0%,
  100% {
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
}
${SWING_KEYFRAMES}`;

const FIREWORKS_CODE = `${genHeader('Fireworks')}
/* A glow rising from below the bottom edge. */
.scene {
  background:
    radial-gradient(
      ellipse at 50% 115%,
      color-mix(in srgb, var(--color-2) 30%, transparent),
      transparent 60%
    ),
    var(--color-1);
}

/* Bursts of sparks opening and fading, then dark a while before the
   next, sinking a little as they go: 3, 5 or 8 by Density (dots 1-3,
   then 7 and 8 from Normal, 13 to 15 at High: each burst the next
   accent). The sparks are thin rays of one gradient, the mask keeping
   their outer ends and a small glow in the middle. */
.layer:nth-child(n + 2),
.dot {
  display: none;
}
.dot:is(:nth-child(-n + 3), :nth-child(n + 7):nth-child(-n + 8), :nth-child(n + 13):nth-child(-n + 15)) {
  display: block;
  --size: calc(22cqmin + var(--r) * 16cqmin);
  left: calc(var(--x) * 0.84% + 8% - var(--size) / 2);
  top: calc(var(--y) * 0.46% + 12% - var(--size) / 2);
  width: var(--size);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(
      circle,
      color-mix(in srgb, var(--accent) 45%, transparent),
      transparent 30%
    ),
    repeating-conic-gradient(
      from calc(var(--r) * 30deg),
      var(--accent) 0 1.6deg,
      transparent 2.4deg 30deg
    );
  mask: radial-gradient(
    circle,
    black 0 10%,
    transparent 22%,
    black 42%,
    transparent 50%
  );
  animation:
    burst calc(3.2s + var(--r) * 2.2s) ease-out calc(var(--i) * -1.1s - var(--x) * 0.04s) infinite,
    sink calc(3.2s + var(--r) * 2.2s) linear calc(var(--i) * -1.1s - var(--x) * 0.04s) infinite;
}

@keyframes burst {
  0% {
    opacity: 0;
    transform: scale(0.1);
  }
  8%,
  40% {
    opacity: 1;
  }
  62%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
}
@keyframes sink {
  to {
    translate: 0 5cqmin;
  }
}
`;

const CANDLES_CODE = `${genHeader('Candlelight')}
/* A warm glow along the bottom. */
.scene {
  background:
    radial-gradient(
      ellipse at 50% 100%,
      color-mix(in srgb, var(--color-4) 22%, transparent),
      transparent 65%
    ),
    var(--color-1);
}

/* Candles, the far ones smaller and higher: 5, 8 or 12 by Density (dots
   1-5 of layer 1, then 7 to 9 from Normal, 13 to 16 at High). Each dot
   is a candle's body in the second colour, its halo (::before) and its
   flame (::after) in the third and the last. */
.layer:nth-child(n + 3),
.layer .dot {
  display: none;
}
.layer:nth-child(1) .dot:is(:nth-child(-n + 5), :nth-child(n + 7):nth-child(-n + 9), :nth-child(n + 13):nth-child(-n + 16)) {
  display: block;
  --size: calc(2.2cqmin + var(--r) * 2.6cqmin);
  left: calc(var(--x) * 0.9% + 5%);
  top: calc(52% + var(--r) * 26%);
  width: var(--size);
  height: calc(var(--size) * 3);
  border-radius: 0.5cqmin 0.5cqmin 0.3cqmin 0.3cqmin;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--color-2) 60%, transparent),
    color-mix(in srgb, var(--color-2) 92%, transparent) 45%,
    color-mix(in srgb, var(--color-2) 70%, transparent)
  );
}
.layer:nth-child(1) .dot::before,
.layer:nth-child(1) .dot::after {
  content: '';
  position: absolute;
}
.layer:nth-child(1) .dot::before {
  left: calc(var(--size) * -2.5);
  top: calc(var(--size) * -3.8);
  width: calc(var(--size) * 6);
  aspect-ratio: 1;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-3) 42%, transparent),
    color-mix(in srgb, var(--color-3) 12%, transparent) 40%,
    transparent 70%
  );
  animation: pulse calc(2.4s + var(--r) * 1.6s) ease-in-out calc(var(--x) * -0.04s) infinite alternate;
}
.layer:nth-child(1) .dot::after {
  left: calc(var(--size) * 0.22);
  top: calc(var(--size) * -1.55);
  width: calc(var(--size) * 0.56);
  height: calc(var(--size) * 1.6);
  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%;
  transform-origin: 50% 90%;
  background: radial-gradient(
    ellipse at 50% 72%,
    var(--color-4) 0 22%,
    color-mix(in srgb, var(--color-3) 95%, transparent) 46%,
    transparent 74%
  );
  animation: flicker calc(1.6s + var(--r) * 1s) ease-in-out calc(var(--x) * -0.05s) infinite;
}

/* A few sparks rising from them: 4, 8 or 12 by Density (layer 2). */
.layer:nth-child(2) .dot:is(:nth-child(-n + 4), :nth-child(n + 7):nth-child(-n + 10), :nth-child(n + 13):nth-child(-n + 16)) {
  display: block;
  --sway: calc((var(--y) - 50) * 0.16cqmin);
  left: calc(var(--x) * 1% - 3%);
  top: 0;
  width: calc(0.4cqmin + var(--r) * 0.5cqmin);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--accent) 80%, transparent) 0 27%,
    color-mix(in srgb, var(--accent) 30%, transparent) 45%,
    transparent 70%
  );
  animation:
    rise calc(9s + var(--r) * 6s) linear calc(var(--i) * -1.3s - var(--x) * 0.13s) infinite,
    fade calc(9s + var(--r) * 6s) linear calc(var(--i) * -1.3s - var(--x) * 0.13s) infinite;
}

@keyframes pulse {
  from {
    opacity: 0.55;
  }
  to {
    opacity: 1;
  }
}
@keyframes flicker {
  0%,
  100% {
    opacity: 0.9;
    transform: scale(1, 1) rotate(-1.5deg);
  }
  20% {
    opacity: 1;
    transform: scale(0.95, 1.06) rotate(1.5deg);
  }
  45% {
    opacity: 0.82;
    transform: scale(1.04, 0.95) rotate(-1deg);
  }
  70% {
    opacity: 1;
    transform: scale(0.97, 1.04) rotate(2deg);
  }
}
@keyframes rise {
  from {
    translate: 0 105cqh;
  }
  to {
    translate: var(--sway) -30cqh;
  }
}
@keyframes fade {
  0%,
  100% {
    opacity: 0;
  }
  15%,
  85% {
    opacity: 1;
  }
}
`;

export const CSS_EFFECT_CODE_MAP: Record<CssAnimationNameType, string> = {
    aurora: AURORA_CODE,
    bokeh: BOKEH_CODE,
    rays: RAYS_CODE,
    waves: WAVES_CODE,
    stars: STARS_CODE,
    breathe: BREATHE_CODE,
    snow: SNOW_CODE,
    clouds: CLOUDS_CODE,
    cross: CROSS_CODE,
    embers: EMBERS_CODE,
    leaves: LEAVES_CODE,
    fireworks: FIREWORKS_CODE,
    petals: PETALS_CODE,
    candles: CANDLES_CODE,
    confetti: CONFETTI_CODE,
    hearts: HEARTS_CODE,
};

/**
 * The code a CSS animation's CSS Code opens on: its own, the effect
 * written as CSS, or -- for a custom one that lost its code -- the starter.
 */
export function genCssEffectCode(animation: CssAnimationType): string {
    if (animation.name === 'custom') {
        return animation.code ?? CSS_CODE_STARTER;
    }
    return CSS_EFFECT_CODE_MAP[animation.name];
}
