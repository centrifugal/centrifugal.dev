import React from 'react';

// Launch-week hero theme: a Miami-style sunset with palms, skyline, water
// and the Centrifugo rotating segments as neon tubes. Shown only inside
// VICE_START..VICE_END (local time) or with ?theme=vice in the URL.
const VICE_START = new Date(2026, 10, 18); // Nov 18, 2026
const VICE_END = new Date(2026, 10, 26);   // exclusive: through Nov 25

export function isViceWeek(now = new Date()) {
    if (typeof window !== 'undefined') {
        const t = new URLSearchParams(window.location.search).get('theme');
        if (t === 'vice') return true;
        if (t === 'default') return false;
    }
    return now >= VICE_START && now < VICE_END;
}

const TAU = Math.PI * 2;

// Small seeded RNG so the skyline and stars don't reshuffle on resize.
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const PALETTE = {
    dark: {
        sky: [[0, '#0e0522'], [0.38, '#35104f'], [0.66, '#9c2173'], [0.86, '#ff4a6a'], [1, '#ffaa55']],
        water: [[0, '#3a0d4a'], [0.35, '#1d0733'], [1, '#08020f']],
        silhouette: '#0a0214',
        skyline: '#190628',
        stars: true,
    },
    light: {
        sky: [[0, '#2a1766'], [0.38, '#5b2a92'], [0.66, '#d03c8c'], [0.86, '#ff7660'], [1, '#ffcf78']],
        water: [[0, '#6a2a7e'], [0.35, '#3a1560'], [1, '#160830']],
        silhouette: '#12051f',
        skyline: '#2a0d40',
        stars: false,
    },
};

const NEON = ['#ff3d9a', '#3ee8ff', '#ffd36e', '#ff7a3d', '#c77dff'];

function buildBackground(w, h, dpr, pal, layout) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { horizon, sunX, sunR } = layout;

    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    pal.sky.forEach(([s, col]) => sky.addColorStop(s, col));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon + 1);

    // Haze around the sun.
    const haze = ctx.createRadialGradient(sunX, horizon, sunR * 0.4, sunX, horizon, sunR * 4);
    haze.addColorStop(0, 'rgba(255, 140, 90, 0.55)');
    haze.addColorStop(0.4, 'rgba(255, 70, 130, 0.22)');
    haze.addColorStop(1, 'rgba(255, 70, 130, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, horizon + 1);

    // Sun with retro stripe cutouts on its lower half.
    const sunSize = Math.ceil(sunR * 2 + 4);
    const sc = document.createElement('canvas');
    sc.width = Math.ceil(sunSize * dpr);
    sc.height = Math.ceil(sunSize * dpr);
    const sctx = sc.getContext('2d');
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sg = sctx.createLinearGradient(0, 2, 0, sunSize - 2);
    sg.addColorStop(0, '#fff0a0');
    sg.addColorStop(0.45, '#ffb35c');
    sg.addColorStop(1, '#ff2f7e');
    sctx.fillStyle = sg;
    sctx.beginPath();
    sctx.arc(sunSize / 2, sunSize / 2, sunR, 0, TAU);
    sctx.fill();
    sctx.globalCompositeOperation = 'destination-out';
    const stripes = 7;
    for (let i = 0; i < stripes; i++) {
        const k = i / stripes;
        const y = sunSize / 2 + sunR * (-0.72 + k * 0.6);
        const th = 1 + k * sunR * 0.07;
        sctx.fillRect(0, y, sunSize, th);
    }
    // Setting sun: center sits below the horizon, only the cap is visible.
    const sunTop = horizon + sunR * 0.15 - sunSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, horizon);
    ctx.clip();
    ctx.drawImage(sc, sunX - sunSize / 2, sunTop, sunSize, sunSize);
    ctx.restore();

    // Skyline: two clusters, leaving the sun open over the water.
    const rnd = mulberry32(19112026);
    const drawCluster = (x0, x1, maxH) => {
        let x = x0;
        while (x < x1) {
            const bw = 6 + rnd() * 18;
            const tall = rnd() < 0.18;
            const edge = Math.min(1, Math.min(x - x0, x1 - x) / ((x1 - x0) * 0.3));
            const bh = (tall ? maxH : maxH * 0.45) * (0.35 + rnd() * 0.65) * (0.3 + 0.7 * edge);
            ctx.fillStyle = pal.skyline;
            ctx.fillRect(x, horizon - bh, bw, bh + 1);
            if (tall && rnd() < 0.6) {
                ctx.fillRect(x + bw / 2 - 0.5, horizon - bh - maxH * 0.12, 1, maxH * 0.12);
            }
            // Lit windows.
            for (let wy = horizon - bh + 3; wy < horizon - 2; wy += 4) {
                for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
                    if (rnd() < 0.09) {
                        ctx.fillStyle = rnd() < 0.7 ? 'rgba(255, 207, 122, 0.8)' : 'rgba(255, 110, 216, 0.85)';
                        ctx.fillRect(wx, wy, 1.2, 1.6);
                    }
                }
            }
            x += bw + rnd() * 2;
        }
    };
    const skyH = Math.min(h * 0.16, 90);
    drawCluster(w * 0.03, sunX - sunR * 1.5, skyH);
    drawCluster(sunX + sunR * 1.5, w * 0.97, skyH * 1.15);

    // Water.
    const water = ctx.createLinearGradient(0, horizon, 0, h);
    pal.water.forEach(([s, col]) => water.addColorStop(s, col));
    ctx.fillStyle = water;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Bright horizon line.
    const hl = ctx.createLinearGradient(0, 0, w, 0);
    hl.addColorStop(0, 'rgba(255, 120, 150, 0)');
    hl.addColorStop(0.5, 'rgba(255, 200, 140, 0.9)');
    hl.addColorStop(1, 'rgba(255, 120, 150, 0)');
    ctx.fillStyle = hl;
    ctx.fillRect(0, horizon - 0.5, w, 1.5);

    return c;
}

// Neon version of the Centrifugo logo segment.
const sprites = {};
function segmentSprite(r, w, color, fromAngle, toAngle, dpr) {
    const key = `${r | 0}:${w | 0}:${color}:${fromAngle}:${toAngle}:${dpr}`;
    if (sprites[key]) return sprites[key];
    const pad = 28;
    const size = Math.ceil(r * 2 + pad * 2);
    const c = document.createElement('canvas');
    c.width = Math.ceil(size * dpr);
    c.height = Math.ceil(size * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = size / 2;
    const cy = size / 2;
    const fromRad = (fromAngle * Math.PI) / 180;
    const toRad = (toAngle * Math.PI) / 180;
    const startX = cx + r * Math.cos(fromRad);
    const startY = cy + r * Math.sin(fromRad);
    const endX = cx + r * Math.cos(toRad);
    const endY = cy + r * Math.sin(toRad);
    const innerStart = Math.atan2(startY - cy, startX - w - cx);
    const innerEnd = Math.atan2(endY - w - cy, endX - cx);
    const shape = () => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, toRad, fromRad, true);
        ctx.arc(cx, cy, r - w, innerStart, innerEnd, false);
        ctx.closePath();
    };
    // Faint tinted glass fill.
    shape();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = color;
    ctx.fill();
    // Glowing tube.
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    shape();
    ctx.stroke();
    ctx.shadowBlur = 6;
    ctx.stroke();
    // Hot white core.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    shape();
    ctx.stroke();
    sprites[key] = { canvas: c, size };
    return sprites[key];
}

function makePalms(w, h) {
    const small = w < 700;
    const base = h + 8;
    const fronds = [-3.05, -2.6, -2.15, -1.7, -1.3, -0.85, -0.4, 0.05, 0.45, 2.75];
    const palm = (x, height, lean, phase) => ({
        x, baseY: base, h: height, lean, phase,
        w: Math.max(5, height * 0.035),
        fronds: fronds.map((a, i) => ({
            a: lean > 0 ? a : -Math.PI - a,
            len: 0.3 + ((i * 37) % 10) / 100,
            droop: 0.18 + ((i * 53) % 10) / 60,
        })),
    });
    if (small) {
        return [
            palm(w * 0.02, h * 0.72, 1, 0.3),
            palm(w * 0.98, h * 0.66, -1, 1.7),
        ];
    }
    return [
        palm(w * 0.035, h * 0.98, 1, 0.2),
        palm(w * 0.12, h * 0.66, 0.7, 2.1),
        palm(w * 0.965, h * 0.92, -1, 1.1),
        palm(w * 0.89, h * 0.58, -0.6, 3.4),
    ];
}

function quad(p0, p1, p2, s) {
    const u = 1 - s;
    return u * u * p0 + 2 * u * s * p1 + s * s * p2;
}

function dquad(p0, p1, p2, s) {
    return 2 * (1 - s) * (p1 - p0) + 2 * s * (p2 - p1);
}

function drawPalm(ctx, p, t, color) {
    const sway = Math.sin(t * 0.6 + p.phase) * p.h * 0.014 + Math.sin(t * 1.7 + p.phase * 2) * p.h * 0.003;
    const bx = p.x;
    const by = p.baseY;
    const tx = bx + p.lean * p.h * 0.3 + sway;
    const ty = by - p.h;
    const cx = bx + p.lean * p.h * 0.02;
    const cy = by - p.h * 0.55;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Trunk as a tapered polygon along a quadratic curve.
    const N = 18;
    const left = [];
    const right = [];
    for (let i = 0; i <= N; i++) {
        const s = i / N;
        const x = quad(bx, cx, tx, s);
        const y = quad(by, cy, ty, s);
        let dx = dquad(bx, cx, tx, s);
        let dy = dquad(by, cy, ty, s);
        const len = Math.hypot(dx, dy) || 1;
        dx /= len; dy /= len;
        // Slight ring bumps along the trunk.
        const bw = p.w * (1 - 0.5 * s) * (1 + 0.08 * Math.sin(i * 2.1));
        left.push([x - dy * bw, y + dx * bw]);
        right.push([x + dy * bw, y - dx * bw]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();

    // Coconuts.
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        ctx.moveTo(tx + (i - 1) * p.w * 0.6 + p.w * 0.5, ty + p.w * 0.6);
        ctx.arc(tx + (i - 1) * p.w * 0.6, ty + p.w * 0.6, p.w * 0.5, 0, TAU);
    }
    ctx.fill();

    // Fronds: a spine plus drooping leaflets, stroked in one path.
    ctx.lineCap = 'round';
    for (let i = 0; i < p.fronds.length; i++) {
        const f = p.fronds[i];
        const a = f.a + Math.sin(t * 1.1 + p.phase + i * 0.7) * 0.05;
        const len = p.h * f.len;
        const ex = tx + Math.cos(a) * len;
        const ey = ty + Math.sin(a) * len * 0.6 + len * f.droop;
        const kx = tx + Math.cos(a) * len * 0.55;
        const ky = ty + Math.sin(a) * len * 0.55 - len * 0.22;

        ctx.lineWidth = p.w * 0.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(kx, ky, ex, ey);
        ctx.stroke();

        ctx.lineWidth = Math.max(1, p.w * 0.16);
        ctx.beginPath();
        const L = 16;
        for (let k = 1; k <= L; k++) {
            const s = k / (L + 1);
            const x = quad(tx, kx, ex, s);
            const y = quad(ty, ky, ey, s);
            let dx = dquad(tx, kx, ex, s);
            let dy = dquad(ty, ky, ey, s);
            const dl = Math.hypot(dx, dy) || 1;
            dx /= dl; dy /= dl;
            const ll = len * 0.2 * Math.sin(Math.PI * Math.min(1, s * 1.15));
            for (const side of [-1, 1]) {
                // Leaflet points forward along the spine, out to the side, and down.
                let lx = dx * 0.55 - dy * side;
                let ly = dy * 0.55 + dx * side + 0.7;
                const n = Math.hypot(lx, ly) || 1;
                lx /= n; ly /= n;
                ctx.moveTo(x, y);
                ctx.lineTo(x + lx * ll, y + ly * ll);
            }
        }
        ctx.stroke();
    }
}

function drawBird(ctx, b, t, color) {
    const flap = Math.sin(t * b.flapSpeed + b.phase);
    const s = b.size;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(b.x - s, b.y - flap * s * 0.5);
    ctx.quadraticCurveTo(b.x - s * 0.45, b.y - s * 0.35 - flap * s * 0.2, b.x, b.y);
    ctx.quadraticCurveTo(b.x + s * 0.45, b.y - s * 0.35 - flap * s * 0.2, b.x + s, b.y - flap * s * 0.5);
    ctx.stroke();
}

function draw(canvas, isDarkTheme) {
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 1;
    const H = canvas.clientHeight || 1;
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pal = isDarkTheme ? PALETTE.dark : PALETTE.light;
    const horizon = Math.round(H * 0.76);
    const sunR = Math.min(W * 0.12, H * 0.24);
    const sunX = W / 2;
    const layout = { horizon, sunX, sunR };
    const bg = buildBackground(W, H, dpr, pal, layout);
    const palms = makePalms(W, H);

    const rnd = mulberry32(1119);
    const stars = [];
    if (pal.stars) {
        for (let i = 0; i < 70; i++) {
            stars.push({ x: rnd() * W, y: rnd() * horizon * 0.45, r: rnd() * 0.9 + 0.3, p: rnd() * TAU, s: rnd() * 2 + 0.5 });
        }
    }

    const glints = [];
    for (let i = 0; i < 60; i++) {
        const d = rnd();
        glints.push({ x: rnd() * W, y: horizon + 3 + d * d * (H - horizon), len: 4 + rnd() * 18 * (0.3 + d), p: rnd() * TAU, s: 0.6 + rnd() * 1.6 });
    }

    const birds = [];
    for (let i = 0; i < (W < 700 ? 3 : 6); i++) {
        birds.push({
            x: rnd() * W, y: H * (0.1 + rnd() * 0.32), size: 4 + rnd() * 5,
            vx: 10 + rnd() * 14, flapSpeed: 5 + rnd() * 3, phase: rnd() * TAU, bob: rnd() * TAU,
        });
    }

    const radius = H / 7;
    const lw = radius / 15;
    const segs = [];
    for (const rot of [0, 90, 180, 270]) segs.push({ r: radius * 2.65, w: lw * 9, rot, speed: -1.5 * 60, diff: 0, color: '#ff3d9a', a: 0 });
    for (const rot of [45, 135, 225]) segs.push({ r: radius * 1.45, w: lw * 8, rot, speed: 1.5 * 60, diff: 2, color: '#3ee8ff', a: 0 });

    let particles = [];
    const burst = (x, y) => {
        const color = NEON[Math.floor(Math.random() * NEON.length)];
        const color2 = NEON[Math.floor(Math.random() * NEON.length)];
        const n = 46;
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * TAU + Math.random() * 0.2;
            const sp = 60 + Math.random() * 90;
            particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: 1.1 + Math.random() * 0.7, c: i % 3 === 0 ? color2 : color });
        }
    };

    const clickHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        burst(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener('click', clickHandler);

    let t = 0;
    let nextAutoBurst = 4 + Math.random() * 4;

    function frame(dt) {
        t += dt;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(bg, 0, 0, W, H);

        for (const s of stars) {
            ctx.globalAlpha = 0.35 + 0.45 * Math.sin(t * s.s + s.p) ** 2;
            ctx.fillStyle = '#fff';
            ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;

        // Sun reflection on the water: wobbling dashes in a widening column.
        for (let y = horizon + 2, row = 0; y < H; y += 4, row++) {
            const d = (y - horizon) / (H - horizon);
            const half = sunR * (0.45 + 0.7 * d) * (0.65 + 0.35 * Math.sin(t * 1.6 + row * 1.37));
            const off = Math.sin(t * 0.9 + row * 0.6) * sunR * 0.08;
            ctx.globalAlpha = (1 - d) * 0.7;
            ctx.fillStyle = d < 0.35 ? '#ffc27a' : '#ff5a9a';
            ctx.fillRect(sunX - half + off, y, half * 2, 1.6);
        }
        for (const g of glints) {
            ctx.globalAlpha = 0.5 * Math.max(0, Math.sin(t * g.s + g.p));
            ctx.fillStyle = '#ff9ccf';
            ctx.fillRect(g.x + Math.sin(t * 0.5 + g.p) * 6, g.y, g.len, 1);
        }
        ctx.globalAlpha = 1;

        for (const b of birds) {
            b.x += b.vx * dt;
            if (b.x > W + 20) b.x = -20;
            drawBird(ctx, { ...b, y: b.y + Math.sin(t * 0.8 + b.bob) * 4 }, t, 'rgba(20, 4, 32, 0.75)');
        }

        // Soft scrim behind the hero text so it stays readable.
        const scrim = ctx.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, Math.max(W * 0.32, 260));
        scrim.addColorStop(0, 'rgba(18, 4, 34, 0.42)');
        scrim.addColorStop(0.6, 'rgba(18, 4, 34, 0.22)');
        scrim.addColorStop(1, 'rgba(18, 4, 34, 0)');
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, W, H);

        // Neon logo segments.
        ctx.globalAlpha = 0.6;
        for (const s of segs) {
            s.a += (s.speed * dt * radius) / s.r;
            const sp = segmentSprite(s.r, s.w, s.color, 4 + s.diff, 86 - s.diff, dpr);
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.rotate(((s.rot + s.a) * Math.PI) / 180);
            ctx.drawImage(sp.canvas, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        for (const p of palms) drawPalm(ctx, p, t, pal.silhouette);

        // Fireworks.
        if (!reduceMotion) {
            nextAutoBurst -= dt;
            if (nextAutoBurst <= 0) {
                const side = Math.random() < 0.5 ? 0.22 : 0.78;
                burst(W * (side + (Math.random() - 0.5) * 0.12), H * (0.12 + Math.random() * 0.2));
                nextAutoBurst = 7 + Math.random() * 6;
            }
        }
        if (particles.length) {
            ctx.globalCompositeOperation = 'lighter';
            for (const p of particles) {
                p.life += dt;
                p.vx *= 0.985;
                p.vy = p.vy * 0.985 + 40 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                const k = 1 - p.life / p.max;
                if (k <= 0) continue;
                ctx.globalAlpha = k;
                ctx.fillStyle = p.c;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.6 + k, 0, TAU);
                ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            particles = particles.filter((p) => p.life < p.max);
        }
    }

    let cancelled = false;
    let rafId = null;
    let last = 0;
    let visible = true;
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(([entry]) => { visible = entry ? entry.isIntersecting : true; });
        io.observe(canvas);
    }

    frame(0);
    const loop = (now) => {
        if (cancelled) return;
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        if (visible) frame(reduceMotion && !particles.length ? 0 : dt);
        rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
        cancelled = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
        canvas.removeEventListener('click', clickHandler);
        if (io) io.disconnect();
    };
}

export default function ViceSunset({ isDarkTheme }) {
    const ref = React.useRef(null);
    const [size, setSize] = React.useState({ w: 0, h: 0 });

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
        update();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    React.useEffect(() => {
        if (!ref.current || size.w === 0) return undefined;
        return draw(ref.current, isDarkTheme);
    }, [size.w, size.h, isDarkTheme]);

    return <canvas ref={ref} aria-hidden="true" style={{ width: '100%', height: '100%' }} />;
}
