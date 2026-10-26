import { LOGO_DARK, LOGO_MID, LOGO_LIGHT } from '../components/ui/logo-paths';

/**
 * Hero light particles, modelled on the two stock photos of the old pe-admin.de hero:
 * a far layer of fine light dust in the back, small amber and cyan sparks in front, denser around a warm focal
 * glow (the spot where the puzzle pieces meet). No big bokeh discs (Honza: they look generic). On wide screens
 * part of the sparks glide into the PE logo mark (white P, blue E-bars), breathe there, and drift apart again
 * as the visitor scrolls the hero away.
 *
 * Canvas 2D with pre-rendered glow sprites and additive blending. ~260 sparks desktop / ~110 phone,
 * DPR capped at 1.5, paused when off screen or the tab is hidden, a single still frame for reduced motion.
 * No cursor reaction (Honza: decorative motion stays on its own).
 */

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number; // radius in css px
  sprite: HTMLCanvasElement;
  a: number; // base alpha
  tw: number; // twinkle phase
  ts: number; // twinkle speed
  seed: number;
  hx?: number; // home in the logo formation (relative to focal point)
  hy?: number;
  delay?: number;
  bend?: number;
};
type Dust = { x: number; y: number; r: number; vx: number; vy: number; a: number; tw: number };

const AMBER = ['255,188,125', '255,154,77', '255,214,170'];
/** how long a logo spark takes to glide into place */
const GATHER_MS = 3400;
const CYAN = ['132,209,252', '95,212,232', '73,181,242'];
const WHITE = '232,244,255';
const BLUE = '73,181,242';
const ICE = '150,216,255';

function glowSprite(rgb: string, size = 64, core = 0.18) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(255,255,255,1)`);
  grd.addColorStop(core, `rgba(${rgb},0.95)`);
  grd.addColorStop(0.45, `rgba(${rgb},0.28)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * Points inside the PE logo mark (P + E-bars, mark coordinates 0..400 x 0..349), centred on 0,0, unit width.
 * Each point carries its layer: 0 = P (dark in the logo, white light here), 1 = blue bar, 2 = light-blue bar.
 * Sampled from the same paths as the SVG logo, evenly spread with a little jitter.
 */
function markPoints(count: number) {
  const W = 400,
    H = 349;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const layers = [LOGO_DARK, LOGO_MID, LOGO_LIGHT];
  const pts: [number, number, number][] = [];
  layers.forEach((d, layer) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.fill(new Path2D(d), 'evenodd');
    const data = g.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y += 4)
      for (let x = 0; x < W; x += 4) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y, layer]);
  });
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts
    .slice(0, count)
    .map(([x, y, l]) => [(x + Math.random() * 3 - W / 2) / W, (y + Math.random() * 3 - H / 2) / W, l] as const);
}

export type ParticleOptions = {
  /** gather sparks into the PE logo mark on wide screens (hero only) */
  formation?: boolean;
  /** multiplier for the number of free sparks and dust */
  density?: number;
  /** strength of the warm focal flare (0 = none) */
  flare?: number;
  /** focal point as share of width/height on wide screens */
  focus?: [number, number];
  /** fade with the hero scroll progress (hero only) */
  scrollFade?: boolean;
};

export function startParticles(canvas: HTMLCanvasElement, opts: ParticleOptions = {}) {
  const { formation = true, density = 1, flare: flareStrength = 1, focus = [0.79, 0.47], scrollFade = true } = opts;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = canvas.parentElement as HTMLElement;
  const amber = AMBER.map((c) => glowSprite(c));
  const cyan = CYAN.map((c) => glowSprite(c));
  const flare = glowSprite('255,188,125', 256, 0.06);
  const markSprites = [glowSprite(WHITE), glowSprite(BLUE), glowSprite(ICE)];
  const dustTex = glowSprite('170,210,235', 16, 0.3);

  let W = 0,
    H = 0,
    dpr = 1,
    wide = false,
    fx = 0,
    fy = 0,
    scale = 1;
  let sparks: Spark[] = [];
  let dust: Dust[] = [];
  let running = false;
  let visible = true;
  let t0 = performance.now();
  let raf = 0;

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  function layout() {
    const r = host.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    wide = W >= 900;
    fx = wide ? W * focus[0] : W * 0.62;
    fy = wide ? H * focus[1] : H * 0.3;
    scale = wide ? Math.min(W * 0.24, 360) : 0;
    build();
  }

  function build() {
    const area = (W * H) / (1440 * 900);
    const n = Math.round((wide ? 230 : 110) * density * Math.min(1.4, Math.max(0.5, area)));
    const nForm = wide && formation ? 860 : 0;
    const homes = nForm ? markPoints(nForm) : [];
    sparks = [];
    for (let i = 0; i < n + nForm; i++) {
      const form = i >= n;
      // formation sparks lean to the logo blues, free sparks to the warm amber of the photos
      const warm = form ? Math.random() < 0.22 : Math.random() < 0.68;
      // free sparks: half spread over the hero, half clustered around the focal glow
      const clustered = !form && Math.random() < 0.5;
      const x = clustered ? fx + gauss() * W * 0.22 : rand(0, W);
      const y = clustered ? fy + gauss() * H * 0.3 : rand(0, H);
      const s: Spark = {
        x,
        y,
        vx: rand(-0.06, 0.06),
        vy: rand(-0.16, -0.03),
        r: form ? rand(0.8, 1.5) : Math.random() < 0.12 ? rand(2.4, 4.2) : rand(0.7, 2),
        sprite: form
          ? Math.random() < 0.12
            ? amber[0] // a few warm sparks inside the logo, like the photos
            : markSprites[homes[i - n][2]]
          : (warm ? amber : cyan)[Math.floor(Math.random() * 3)],
        a: form ? rand(0.75, 1) : rand(0.45, 1),
        tw: rand(0, Math.PI * 2),
        ts: rand(0.6, 2.2),
        seed: Math.random() * 1000,
      };
      if (form) {
        const [hx, hy] = homes[i - n];
        s.hx = hx;
        s.hy = hy;
        s.delay = rand(0, 1400);
        s.bend = rand(-50, 50);
        s.x = rand(0, W);
        s.y = rand(0, H);
      }
      sparks.push(s);
    }
    // far layer: fine light dust, slower than the sparks (depth without big discs)
    dust = [];
    const nd = Math.round((wide ? 320 : 140) * density * Math.min(1.4, Math.max(0.5, area)));
    for (let i = 0; i < nd; i++) {
      dust.push({
        x: rand(0, W),
        y: rand(0, H),
        r: rand(0.5, 1.1),
        vx: rand(-0.03, 0.03),
        vy: rand(-0.06, -0.01),
        a: rand(0.12, 0.4),
        tw: Math.random() * 6.3,
      });
    }
  }

  function heroProgress() {
    if (!scrollFade) return 0;
    const r = host.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  }

  function frame(now: number) {
    const t = now - t0;
    const p = heroProgress();
    const formStrength = Math.max(0, 1 - p * 1.8);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // dust
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      d.x += d.vx;
      d.y += d.vy;
      if (d.y < -4) ((d.y = H + 4), (d.x = rand(0, W)));
      if (d.x < -4) d.x = W + 4;
      if (d.x > W + 4) d.x = -4;
      ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 0.0006 + d.tw));
      const s = d.r * 5;
      ctx.drawImage(dustTex, d.x - s / 2, d.y - s / 2 - p * 40, s, s);
    }

    ctx.globalCompositeOperation = 'lighter';
    // focal glow + slow 4-point flare (the light where the puzzle pieces meet)
    const pulse = 0.75 + 0.25 * Math.sin(t / 1800);
    const fr = (wide ? 260 : 180) * pulse;
    ctx.globalAlpha = (wide && formation ? 0.34 : 0.5) * flareStrength * (1 - p);
    ctx.drawImage(flare, fx - fr, fy - fr, fr * 2, fr * 2);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.globalAlpha = 0.22 * flareStrength * pulse * (1 - p);
    ctx.drawImage(flare, -fr * 1.6, -3, fr * 3.2, 6);
    ctx.drawImage(flare, -3, -fr * 0.9, 6, fr * 1.8);
    ctx.restore();

    for (const s of sparks) {
      const home = s.hx !== undefined;
      // free drift (every spark): slow upward float with a gentle swirl
      s.vx += Math.sin(s.y * 0.004 + t * 0.00025 + s.seed) * 0.004;
      s.vy += Math.cos(s.x * 0.003 + t * 0.0002 + s.seed) * 0.003 - 0.0008;
      s.vx = Math.max(-0.35, Math.min(0.35, s.vx * 0.995));
      s.vy = Math.max(-0.4, Math.min(0.25, s.vy * 0.995));
      s.x += s.vx;
      s.y += s.vy;
      if (s.y < -10) {
        s.y = H + 10;
        s.x = Math.random() < 0.5 ? fx + gauss() * W * 0.25 : rand(0, W);
      }
      if (s.y > H + 12) s.y = -10;
      if (s.x < -10) s.x = W + 10;
      if (s.x > W + 10) s.x = -10;
      let dx = s.x,
        dy = s.y;
      if (home && formStrength > 0 && t > s.delay!) {
        // logo sparks glide from their free position into the mark: eased in-out blend, a slight curve, no
        // spring (so no overshoot or wobble). Scrolling blends them back out the same way.
        const k = Math.min(1, (t - s.delay!) / GATHER_MS);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const w = e * formStrength;
        const tx = fx + s.hx! * scale + Math.sin(t / 1400 + s.seed) * 1.6;
        const ty = fy + s.hy! * scale + Math.cos(t / 1700 + s.seed) * 1.6;
        const ox = tx - s.x,
          oy = ty - s.y;
        const len = Math.hypot(ox, oy) || 1;
        const bend = Math.sin(Math.PI * w) * s.bend!;
        dx = s.x + ox * w - (oy / len) * bend;
        dy = s.y + oy * w + (ox / len) * bend;
      }
      const tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.ts + s.tw);
      ctx.globalAlpha = s.a * tw;
      const d = s.r * 6;
      ctx.drawImage(s.sprite, dx - d / 2, dy - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now: number) {
    if (!running) return;
    frame(now);
    raf = requestAnimationFrame(loop);
  }
  const start = () => {
    if (running || reduce) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  layout();
  if (reduce) {
    // one still frame with the formation already in place
    t0 = performance.now() - 10000;
    frame(performance.now());
  } else start();

  let rt = 0;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      const w = host.getBoundingClientRect().width;
      if (Math.abs(w - W) > 40) {
        t0 = performance.now();
        layout();
        if (reduce) frame(performance.now() + 10000);
      }
    }, 200);
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    visible && !document.hidden ? start() : stop();
  }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
}
