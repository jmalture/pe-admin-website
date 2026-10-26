/**
 * Hero light particles, modelled on the two stock photos of the old pe-admin.de hero:
 * soft blue-grey bokeh in the back, small amber and cyan sparks in front, denser around a warm focal glow
 * (the spot where the puzzle pieces meet). On wide screens part of the sparks gather into the three E-bars
 * of the PE Admin logo, breathe there, and dissolve as the visitor scrolls the hero away.
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
};
type Bokeh = { x: number; y: number; r: number; vx: number; vy: number; a: number; sprite: HTMLCanvasElement };

const AMBER = ['255,188,125', '255,154,77', '255,214,170'];
const CYAN = ['132,209,252', '95,212,232', '73,181,242'];

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
function bokehSprite(rgb: string, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${rgb},0.9)`);
  grd.addColorStop(0.72, `rgba(${rgb},0.75)`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Points inside the three E-bars of the logo (mark coordinates 0..400 x 0..349), centred on 0,0, unit width. */
function barPoints(count: number) {
  const W = 400,
    H = 349;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bar = (x: number, y: number, w: number, h: number) => {
    const r = h * 0.85;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#fff';
  bar(10, 17, 383, 61);
  bar(10, 139, 317, 62);
  bar(10, 268, 382, 60);
  const data = g.getImageData(0, 0, W, H).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  // even spread: shuffle the grid points and take the first `count`, with a little jitter
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts
    .slice(0, count)
    .map(([x, y]) => [(x + Math.random() * 3 - W / 2) / W, (y + Math.random() * 3 - H / 2) / W] as [number, number]);
}

export function startParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const host = canvas.parentElement as HTMLElement;
  const amber = AMBER.map((c) => glowSprite(c));
  const cyan = CYAN.map((c) => glowSprite(c));
  const flare = glowSprite('255,188,125', 256, 0.06);
  const bokehTex = [bokehSprite('90,140,170'), bokehSprite('60,110,150'), bokehSprite('120,160,185')];

  let W = 0,
    H = 0,
    dpr = 1,
    wide = false,
    fx = 0,
    fy = 0,
    scale = 1;
  let sparks: Spark[] = [];
  let bokeh: Bokeh[] = [];
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
    fx = wide ? W * 0.79 : W * 0.62;
    fy = wide ? H * 0.47 : H * 0.3;
    scale = wide ? Math.min(W * 0.24, 360) : 0;
    build();
  }

  function build() {
    const area = (W * H) / (1440 * 900);
    const n = Math.round((wide ? 230 : 110) * Math.min(1.4, Math.max(0.5, area)));
    const nForm = wide ? 460 : 0;
    const homes = nForm ? barPoints(nForm) : [];
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
        sprite: (warm ? amber : cyan)[Math.floor(Math.random() * 3)],
        a: form ? rand(0.75, 1) : rand(0.45, 1),
        tw: rand(0, Math.PI * 2),
        ts: rand(0.6, 2.2),
        seed: Math.random() * 1000,
      };
      if (form) {
        const [hx, hy] = homes[i - n];
        s.hx = hx;
        s.hy = hy;
        s.delay = rand(0, 900);
        s.x = rand(0, W);
        s.y = rand(0, H);
      }
      sparks.push(s);
    }
    bokeh = [];
    const nb = wide ? 22 : 12;
    for (let i = 0; i < nb; i++) {
      bokeh.push({
        x: rand(-0.1, 1.1) * W,
        y: rand(-0.1, 1.1) * H,
        r: rand(28, wide ? 120 : 80),
        vx: rand(-0.05, 0.05),
        vy: rand(-0.04, 0.03),
        a: rand(0.05, 0.16),
        sprite: bokehTex[i % 3],
      });
    }
  }

  function heroProgress() {
    const r = host.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
  }

  function frame(now: number) {
    const t = now - t0;
    const p = heroProgress();
    const formStrength = Math.max(0, 1 - p * 1.8);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // bokeh
    ctx.globalCompositeOperation = 'source-over';
    for (const b of bokeh) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -b.r) b.x = W + b.r;
      if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r;
      if (b.y > H + b.r) b.y = -b.r;
      ctx.globalAlpha = b.a;
      ctx.drawImage(b.sprite, b.x - b.r, b.y - b.r - p * 60, b.r * 2, b.r * 2);
    }

    ctx.globalCompositeOperation = 'lighter';
    // focal glow + slow 4-point flare (the light where the puzzle pieces meet)
    const pulse = 0.75 + 0.25 * Math.sin(t / 1800);
    const fr = (wide ? 260 : 180) * pulse;
    ctx.globalAlpha = 0.5 * (1 - p);
    ctx.drawImage(flare, fx - fr, fy - fr, fr * 2, fr * 2);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.globalAlpha = 0.22 * pulse * (1 - p);
    ctx.drawImage(flare, -fr * 1.6, -3, fr * 3.2, 6);
    ctx.drawImage(flare, -3, -fr * 0.9, 6, fr * 1.8);
    ctx.restore();

    for (const s of sparks) {
      const home = s.hx !== undefined;
      if (home && formStrength > 0 && t > s.delay!) {
        // spring towards its place in the logo bars, with a slow breathing jitter
        const k = Math.min(1, (t - s.delay!) / 2400);
        const ease = 1 - Math.pow(1 - k, 3);
        const tx = fx + s.hx! * scale + Math.sin(t / 900 + s.seed) * 2.2;
        const ty = fy + s.hy! * scale + Math.cos(t / 1100 + s.seed) * 2.2;
        const pull = 0.02 + 0.06 * ease;
        s.vx += (tx - s.x) * pull * formStrength;
        s.vy += (ty - s.y) * pull * formStrength;
        s.vx *= 0.82;
        s.vy *= 0.82;
      } else {
        // free drift: slow upward float with a gentle swirl
        s.vx += Math.sin(s.y * 0.004 + t * 0.00025 + s.seed) * 0.004;
        s.vy += Math.cos(s.x * 0.003 + t * 0.0002 + s.seed) * 0.003 - 0.0008;
        s.vx = Math.max(-0.35, Math.min(0.35, s.vx * 0.995));
        s.vy = Math.max(-0.4, Math.min(0.25, s.vy * 0.995));
      }
      s.x += s.vx;
      s.y += s.vy;
      if (!home || formStrength === 0) {
        if (s.y < -10) {
          s.y = H + 10;
          s.x = Math.random() < 0.5 ? fx + gauss() * W * 0.25 : rand(0, W);
        }
        if (s.y > H + 12) s.y = -10;
        if (s.x < -10) s.x = W + 10;
        if (s.x > W + 10) s.x = -10;
      }
      const tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.ts + s.tw);
      ctx.globalAlpha = s.a * tw;
      const d = s.r * 6;
      ctx.drawImage(s.sprite, s.x - d / 2, s.y - d / 2, d, d);
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
    for (const s of sparks) if (s.hx !== undefined) ((s.x = fx + s.hx * scale), (s.y = fy + s.hy! * scale));
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
