import React from 'react';

// Launch-week hero theme: a Miami-style sunset with palms, a skyline and its
// reflection, a jet, a helicopter, boats, and the Centrifugo rotating segments as neon
// tubes. Shown only inside VICE_START..VICE_END (local time) or with
// ?theme=vice in the URL.
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
const PAR = 24; // extra px on each side of parallax layers

// Small seeded RNG so the scene doesn't reshuffle on resize.
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
        sky: [[0, '#0b041d'], [0.34, '#2e0e4a'], [0.62, '#8e1f6e'], [0.84, '#ff4868'], [1, '#ffa954']],
        water: [[0, '#41104f'], [0.25, '#2c0b42'], [0.55, '#170530'], [1, '#07020e']],
        far: '#4d1a5c',
        near: '#170524',
        silhouette: '#0a0214',
        stars: true,
    },
    light: {
        sky: [[0, '#26166a'], [0.34, '#55298f'], [0.62, '#cc3a8a'], [0.84, '#ff745f'], [1, '#ffcf78']],
        water: [[0, '#70307f'], [0.25, '#521f70'], [0.55, '#2c1050'], [1, '#160830']],
        far: '#7a3780',
        near: '#25093a',
        silhouette: '#12051f',
        stars: false,
    },
};

const NEON = ['#ff3d9a', '#3ee8ff', '#ffd36e', '#ff7a3d', '#c77dff'];

function makeCanvas(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, ctx };
}

// Smooth 1D value noise from a few sines: enough for skyline density.
function wave(x, seed) {
    return 0.5 + 0.25 * Math.sin(x * 0.009 + seed) + 0.15 * Math.sin(x * 0.023 + seed * 2.3) + 0.1 * Math.sin(x * 0.061 + seed * 5.1);
}

function buildSky(w, h, dpr, pal, L) {
    const { c, ctx } = makeCanvas(w, L.horizon + 1, dpr);
    const sky = ctx.createLinearGradient(0, 0, 0, L.horizon);
    pal.sky.forEach(([s, col]) => sky.addColorStop(s, col));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, L.horizon + 1);

    // Wide glow around the sun.
    const haze = ctx.createRadialGradient(L.sunX, L.horizon, L.sunR * 0.3, L.sunX, L.horizon, Math.max(w * 0.45, L.sunR * 5));
    haze.addColorStop(0, 'rgba(255, 150, 90, 0.6)');
    haze.addColorStop(0.3, 'rgba(255, 70, 130, 0.25)');
    haze.addColorStop(1, 'rgba(255, 70, 130, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, L.horizon + 1);

    // Setting sun with retro stripe cutouts.
    const size = Math.ceil(L.sunR * 2 + 4);
    const sun = makeCanvas(size, size, dpr);
    const sg = sun.ctx.createLinearGradient(0, 2, 0, size - 2);
    sg.addColorStop(0, '#fff3a8');
    sg.addColorStop(0.4, '#ffb35c');
    sg.addColorStop(0.8, '#ff2f7e');
    sun.ctx.fillStyle = sg;
    sun.ctx.shadowColor = 'rgba(255, 200, 120, 0.9)';
    sun.ctx.beginPath();
    sun.ctx.arc(size / 2, size / 2, L.sunR, 0, TAU);
    sun.ctx.fill();
    sun.ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
        const k = i / 7;
        sun.ctx.fillRect(0, size / 2 + L.sunR * (-0.72 + k * 0.6), size, 1 + k * L.sunR * 0.07);
    }
    ctx.drawImage(sun.c, L.sunX - size / 2, L.horizon + L.sunR * 0.15 - size / 2, size, size);
    return c;
}

function buildWater(w, h, dpr, pal, L) {
    const wh = h - L.horizon;
    const { c, ctx } = makeCanvas(w, wh, dpr);
    const g = ctx.createLinearGradient(0, 0, 0, wh);
    pal.water.forEach(([s, col]) => g.addColorStop(s, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, wh);
    // Sunset light sitting on the water near the horizon.
    ctx.save();
    ctx.scale(1, wh / (w * 0.5));
    const glow = ctx.createRadialGradient(L.sunX, 0, 0, L.sunX, 0, w * 0.5);
    glow.addColorStop(0, 'rgba(255, 120, 120, 0.32)');
    glow.addColorStop(0.5, 'rgba(255, 120, 120, 0.1)');
    glow.addColorStop(1, 'rgba(255, 120, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, w * 0.5);
    ctx.restore();
    return c;
}

function buildClouds(w, L, dpr, rnd, count) {
    const clouds = [];
    for (let i = 0; i < count; i++) {
        const cw = 140 + rnd() * 260;
        const ch = 26 + rnd() * 26;
        const { c, ctx } = makeCanvas(cw, ch, dpr);
        // Soft elongated blobs.
        for (let k = 0; k < 14; k++) {
            const bx = cw * (0.12 + rnd() * 0.76);
            const by = ch * (0.4 + rnd() * 0.3);
            const rx = cw * (0.08 + rnd() * 0.14);
            const ry = ch * (0.18 + rnd() * 0.2);
            ctx.save();
            ctx.translate(bx, by);
            ctx.scale(rx / ry, 1);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
            g.addColorStop(0, 'rgba(255,255,255,0.55)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, ry, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        // Lit from below by the sunset.
        ctx.globalCompositeOperation = 'source-atop';
        const lg = ctx.createLinearGradient(0, 0, 0, ch);
        lg.addColorStop(0, '#9b6bd6');
        lg.addColorStop(0.55, '#ff8fb8');
        lg.addColorStop(1, '#ffb27a');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, cw, ch);
        clouds.push({
            c, w: cw, h: ch,
            x: rnd() * (w + cw) - cw,
            y: L.horizon * (0.12 + rnd() * 0.5),
            vx: 3 + rnd() * 5,
            alpha: 0.35 + rnd() * 0.35,
        });
    }
    return clouds;
}

// One skyline layer, wider than the screen by PAR on each side.
function buildSkyline(w, dpr, rnd, o) {
    const cw = w + PAR * 2;
    const ch = Math.ceil(o.maxH * 1.4) + 2;
    const { c, ctx } = makeCanvas(cw, ch, dpr);
    const dyn = [];
    const beacons = [];
    const seed = rnd() * 100;
    let x = 0;
    while (x < cw) {
        const sx = x - PAR; // screen x
        const bw = o.minW + rnd() * o.varW;
        const inGap = sx + bw > o.gapFrom && sx < o.gapTo;
        if (inGap) { x += bw; continue; }
        const edge = Math.min(1, Math.min(Math.abs(sx - o.gapFrom), Math.abs(sx - o.gapTo)) / 120);
        const env = wave(sx, seed) * (0.35 + 0.65 * edge);
        const tower = rnd() < 0.16;
        const bh = Math.max(6, o.maxH * env * (tower ? 1.25 : 0.55 + rnd() * 0.45));
        const top = ch - bh;
        ctx.fillStyle = o.color;
        ctx.fillRect(x, top, bw, bh + 1);

        // Roof shapes.
        const roof = rnd();
        if (roof < 0.25) {
            ctx.fillRect(x + bw * 0.2, top - bh * 0.08, bw * 0.6, bh * 0.08 + 1);
        } else if (roof < 0.35 && tower) {
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x + bw / 2, top - bw * 0.9);
            ctx.lineTo(x + bw, top);
            ctx.fill();
        }
        if (tower && rnd() < 0.7) {
            const ah = o.maxH * (0.1 + rnd() * 0.12);
            ctx.fillRect(x + bw / 2 - 0.6, top - ah, 1.2, ah);
            beacons.push({ x: sx + bw / 2, y: top - ah - (ch - 0), phase: rnd() * TAU, rate: 0.6 + rnd() * 0.5 });
        }

        if (o.windows) {
            for (let wy = top + 3; wy < ch - 3; wy += 4) {
                for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
                    const r = rnd();
                    if (r < 0.1) {
                        ctx.fillStyle = rnd() < 0.75 ? 'rgba(255, 207, 122, 0.85)' : 'rgba(255, 110, 216, 0.9)';
                        ctx.fillRect(wx, wy, 1.3, 1.7);
                    } else if (r < 0.112) {
                        dyn.push({ x: wx - PAR, y: wy - ch, on: rnd() < 0.5, next: rnd() * 8, warm: rnd() < 0.7 });
                    }
                }
            }
        }

        // Neon trim on a few buildings.
        if (o.neon && bh > o.maxH * 0.4 && rnd() < 0.22) {
            const col = rnd() < 0.55 ? '#ff3d9a' : '#3ee8ff';
            ctx.save();
            ctx.shadowColor = col;
            ctx.shadowBlur = 6;
            ctx.fillStyle = col;
            if (rnd() < 0.5) ctx.fillRect(x, top, 1.4, bh);
            else ctx.fillRect(x, top, bw, 1.4);
            ctx.restore();
        }
        x += bw + rnd() * 1.5;
    }

    if (o.haze) {
        ctx.globalCompositeOperation = 'source-atop';
        const g = ctx.createLinearGradient(0, 0, 0, ch);
        g.addColorStop(0, 'rgba(255, 120, 160, 0)');
        g.addColorStop(1, o.haze);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, cw, ch);
    }
    return { c, w: cw, h: ch, dyn, beacons };
}

// Neon version of the Centrifugo logo segment.
const sprites = {};
function segmentSprite(r, w, color, fromAngle, toAngle, dpr) {
    const key = `${r | 0}:${w | 0}:${color}:${fromAngle}:${toAngle}:${dpr}`;
    if (sprites[key]) return sprites[key];
    const pad = 28;
    const size = Math.ceil(r * 2 + pad * 2);
    const { c, ctx } = makeCanvas(size, size, dpr);
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
    shape();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = color;
    ctx.fill();
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
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1;
    shape();
    ctx.stroke();
    sprites[key] = { canvas: c, size };
    return sprites[key];
}

function glowSprite(color, r, dpr) {
    const { c, ctx } = makeCanvas(r * 2, r * 2, dpr);
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.15, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return { c, r };
}

function makePalms(w, h) {
    const small = w < 700;
    const base = h + 8;
    const fronds = [-3.05, -2.6, -2.15, -1.7, -1.3, -0.85, -0.4, 0.05, 0.45, 2.75];
    const palm = (x, height, lean, phase, depth) => ({
        x, baseY: base, h: height, lean, phase, depth,
        w: Math.max(5, height * 0.035),
        fronds: fronds.map((a, i) => ({
            a: lean > 0 ? a : -Math.PI - a,
            len: 0.3 + ((i * 37) % 10) / 100,
            droop: 0.18 + ((i * 53) % 10) / 60,
        })),
    });
    if (small) {
        return [palm(w * 0.02, h * 0.72, 1, 0.3, 1), palm(w * 0.98, h * 0.66, -1, 1.7, 1)];
    }
    return [
        palm(w * 0.12, h * 0.66, 0.7, 2.1, 0.7),
        palm(w * 0.89, h * 0.58, -0.6, 3.4, 0.7),
        palm(w * 0.035, h * 0.98, 1, 0.2, 1),
        palm(w * 0.965, h * 0.92, -1, 1.1, 1),
    ];
}

function quad(p0, p1, p2, s) {
    const u = 1 - s;
    return u * u * p0 + 2 * u * s * p1 + s * s * p2;
}

function dquad(p0, p1, p2, s) {
    return 2 * (1 - s) * (p1 - p0) + 2 * s * (p2 - p1);
}

function drawPalm(ctx, p, t, color, wind) {
    // Two layered sways plus occasional gusts make the motion less robotic.
    const sway = (Math.sin(t * 0.6 + p.phase) * 0.014 + Math.sin(t * 1.7 + p.phase * 2) * 0.003 + wind * 0.012) * p.h;
    const bx = p.x;
    const by = p.baseY;
    const tx = bx + p.lean * p.h * 0.3 + sway;
    const ty = by - p.h;
    const cx = bx + p.lean * p.h * 0.02 + sway * 0.3;
    const cy = by - p.h * 0.55;

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

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

    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        ctx.moveTo(tx + (i - 1) * p.w * 0.6 + p.w * 0.5, ty + p.w * 0.6);
        ctx.arc(tx + (i - 1) * p.w * 0.6, ty + p.w * 0.6, p.w * 0.5, 0, TAU);
    }
    ctx.fill();

    ctx.lineCap = 'round';
    for (let i = 0; i < p.fronds.length; i++) {
        const f = p.fronds[i];
        // Fronds on the downwind side lift a bit in gusts.
        const a = f.a + Math.sin(t * 1.1 + p.phase + i * 0.7) * 0.05 + Math.sin(t * 2.6 + i) * 0.02 * (1 + wind * 2);
        const len = p.h * f.len;
        const ex = tx + Math.cos(a) * len;
        const ey = ty + Math.sin(a) * len * 0.6 + len * f.droop * (1 - wind * 0.15);
        const kx = tx + Math.cos(a) * len * 0.55;
        const ky = ty + Math.sin(a) * len * 0.55 - len * 0.22;

        ctx.lineWidth = p.w * 0.4;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(kx, ky, ex, ey);
        ctx.stroke();

        // Leaflets as thin tapered blades, filled in one path.
        ctx.beginPath();
        const LN = 24;
        for (let k = 1; k <= LN; k++) {
            const s = k / (LN + 1);
            const x = quad(tx, kx, ex, s);
            const y = quad(ty, ky, ey, s);
            let dx = dquad(tx, kx, ex, s);
            let dy = dquad(ty, ky, ey, s);
            const dl = Math.hypot(dx, dy) || 1;
            dx /= dl; dy /= dl;
            const ll = len * 0.26 * Math.sin(Math.PI * Math.min(1, s * 1.1)) + len * 0.03;
            const bw = Math.max(0.8, p.w * 0.2 * (1 - s * 0.6));
            const flutter = Math.sin(t * 5 + k * 0.9 + i) * 0.08;
            for (const side of [-1, 1]) {
                let lx = dx * 0.7 - dy * side;
                let ly = dy * 0.7 + dx * side + 0.9 + flutter;
                const n = Math.hypot(lx, ly) || 1;
                lx /= n; ly /= n;
                // Blade bends: midpoint pushed down a little more than the tip line.
                const mx = x + lx * ll * 0.5;
                const my = y + ly * ll * 0.5 + ll * 0.08;
                ctx.moveTo(x - dx * bw, y - dy * bw);
                ctx.quadraticCurveTo(mx, my, x + lx * ll, y + ly * ll + ll * 0.1);
                ctx.quadraticCurveTo(mx + dx * bw * 0.6, my + dy * bw * 0.6, x + dx * bw, y + dy * bw);
                ctx.closePath();
            }
        }
        ctx.fill();
    }
}

function drawBird(ctx, b, t, color) {
    // Flap in bursts, then glide.
    const gliding = Math.sin(t * 0.35 + b.phase) > 0.35;
    const flap = gliding ? 0.25 + 0.05 * Math.sin(t * 2 + b.phase) : Math.sin(t * b.flapSpeed + b.phase);
    const s = b.size;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(b.x - s, b.y - flap * s * 0.55);
    ctx.quadraticCurveTo(b.x - s * 0.45, b.y - s * 0.35 - flap * s * 0.25, b.x, b.y);
    ctx.quadraticCurveTo(b.x + s * 0.45, b.y - s * 0.35 - flap * s * 0.25, b.x + s, b.y - flap * s * 0.55);
    ctx.stroke();
}

function drawJet(ctx, j, t) {
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.scale(j.dir, 1);
    ctx.fillStyle = 'rgba(255, 214, 230, 0.9)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1, 0); ctx.lineTo(-2.5, 3.2); ctx.lineTo(-3.5, 3.2); ctx.lineTo(-1.5, 0);
    ctx.moveTo(-5, 0); ctx.lineTo(-7, -2.6); ctx.lineTo(-7.6, -2.6); ctx.lineTo(-6.6, 0);
    ctx.fill();
    ctx.restore();
    const blink = (t * 1.1 + j.phase) % 1;
    if (blink < 0.08) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(j.x - 0.8, j.y - 0.8, 1.8, 1.8);
    } else if (blink > 0.5 && blink < 0.58) {
        ctx.fillStyle = '#ff4060';
        ctx.fillRect(j.x - j.dir * 5, j.y - 0.8, 1.8, 1.8);
    }
}

function drawHeli(ctx, hl, t, color, skylineTop) {
    // Searchlight cone sweeping over the skyline.
    const ang = Math.PI / 2 + Math.sin(t * 0.45) * 0.45;
    const reach = Math.max(40, skylineTop - hl.y + 30);
    const spread = 0.13;
    const ex1 = hl.x + Math.cos(ang - spread) * reach;
    const ey1 = hl.y + Math.sin(ang - spread) * reach;
    const ex2 = hl.x + Math.cos(ang + spread) * reach;
    const ey2 = hl.y + Math.sin(ang + spread) * reach;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(hl.x, hl.y, hl.x + Math.cos(ang) * reach, hl.y + Math.sin(ang) * reach);
    g.addColorStop(0, 'rgba(255, 240, 210, 0.35)');
    g.addColorStop(1, 'rgba(255, 240, 210, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hl.x, hl.y + 2);
    ctx.lineTo(ex1, ey1);
    ctx.lineTo(ex2, ey2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(hl.x, hl.y);
    ctx.rotate(Math.sin(t * 0.5) * 0.06);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.5, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-14, -1, 10, 1.6);
    ctx.fillRect(-15, -3.5, 1.4, 4);
    ctx.fillRect(-3, 3, 7, 0.8);
    ctx.fillRect(-0.5, -4.6, 1, 1.6);
    const rw = 11 * Math.abs(Math.cos(t * 30));
    ctx.fillRect(-rw, -4.8, rw * 2, 0.9);
    ctx.restore();
    if ((t * 1.2) % 1 < 0.12) {
        ctx.fillStyle = '#ff3050';
        ctx.fillRect(hl.x - 1, hl.y + 2.5, 2, 2);
    }
}

function drawSpeedboat(ctx, b, color) {
    // Wake: foam behind, then a widening V.
    for (const f of b.foam) {
        const k = f.age / 2.6;
        if (k >= 1) continue;
        ctx.globalAlpha = (1 - k) * 0.55;
        ctx.fillStyle = '#ffe3f0';
        const spread = 1 + f.age * 7;
        ctx.fillRect(f.x - 1.5, f.y - spread * 0.25, 3, 0.9);
        ctx.fillRect(f.x - 1.5, f.y + spread * 0.25, 3, 0.9);
        ctx.globalAlpha = (1 - k) * 0.3;
        ctx.fillRect(f.x - 2, f.y - 0.4, 4, 0.8);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(b.bob) * 0.6);
    ctx.scale(b.dir, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-9, -1.5); ctx.lineTo(9, -1.5); ctx.lineTo(5, 1.6); ctx.lineTo(-8, 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-4, -3.8, 5, 2.4);
    ctx.shadowColor = '#3ee8ff';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#3ee8ff';
    ctx.fillRect(-8, 1.4, 13, 0.8);
    ctx.restore();
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

    const small = W < 700;
    const wide = W >= 900;
    const pal = isDarkTheme ? PALETTE.dark : PALETTE.light;
    const horizon = Math.round(H * 0.76);
    const sunR = Math.min(W * 0.12, H * 0.24);
    const sunX = W / 2;
    const L = { horizon, sunX, sunR };
    const rnd = mulberry32(19112026);

    const sky = buildSky(W, H, dpr, pal, L);
    const water = buildWater(W, H, dpr, pal, L);
    const clouds = buildClouds(W, L, dpr, rnd, small ? 3 : 6);
    const skyMax = Math.min(H * 0.17, 95);
    const far = buildSkyline(W, dpr, rnd, {
        maxH: skyMax * 0.8, color: pal.far, minW: 5, varW: 12,
        gapFrom: sunX - sunR * 0.8, gapTo: sunX + sunR * 0.8,
        haze: 'rgba(255, 110, 140, 0.55)',
    });
    const near = buildSkyline(W, dpr, rnd, {
        maxH: skyMax, color: pal.near, minW: 7, varW: 20,
        gapFrom: sunX - sunR * 1.7, gapTo: sunX + sunR * 1.7,
        windows: true, neon: true,
    });
    const palms = makePalms(W, H);
    const beaconGlow = glowSprite('rgba(255, 50, 80, 0.8)', 7, dpr);

    const stars = [];
    if (pal.stars) {
        for (let i = 0; i < 90; i++) {
            stars.push({ x: rnd() * W, y: rnd() * horizon * 0.5, r: rnd() * 1 + 0.3, p: rnd() * TAU, s: rnd() * 2 + 0.5 });
        }
    }
    const glints = [];
    for (let i = 0; i < (small ? 50 : 100); i++) {
        const d = rnd();
        glints.push({ x: rnd() * W, y: horizon + 3 + d * d * (H - horizon), len: 4 + rnd() * 20 * (0.3 + d), p: rnd() * TAU, s: 0.6 + rnd() * 1.6 });
    }
    const birds = [];
    for (let i = 0; i < (small ? 3 : 7); i++) {
        birds.push({
            x: rnd() * W, y: H * (0.12 + rnd() * 0.3), size: 3.5 + rnd() * 4.5,
            vx: 12 + rnd() * 14, flapSpeed: 6 + rnd() * 3, phase: rnd() * TAU, bob: rnd() * TAU,
        });
    }
    const sails = [
        { x: W * 0.36, vx: 1.6, s: 1 },
        { x: W * 0.7, vx: -1.1, s: 0.75 },
    ];

    const radius = H / 7;
    const lw = radius / 15;
    const segs = [];
    for (const rot of [0, 90, 180, 270]) segs.push({ r: radius * 2.65, w: lw * 9, rot, speed: -90, diff: 0, color: '#ff3d9a', a: 0 });
    for (const rot of [45, 135, 225]) segs.push({ r: radius * 1.45, w: lw * 8, rot, speed: 90, diff: 2, color: '#3ee8ff', a: 0 });

    // Moving actors. Each one waits off-screen for a while, then crosses.
    const jet = { active: true, x: W * 0.7, y: H * 0.09, dir: -1, speed: 42, wait: 0, trail: [], trailT: 0, phase: 0.3 };
    const heli = wide ? { x: W * 0.78, y: horizon - skyMax * 2.1, baseX: W * 0.78, baseY: horizon - skyMax * 2.1 } : null;
    const boat = { active: true, x: W * 0.25, y: horizon + (H - horizon) * 0.32, dir: 1, speed: 70, wait: 0, foam: [], foamT: 0, bob: 0 };
    let shooting = null;
    let nextShooting = 3 + Math.random() * 5;

    let particles = [];
    const burst = (x, y) => {
        const color = NEON[Math.floor(Math.random() * NEON.length)];
        const color2 = NEON[Math.floor(Math.random() * NEON.length)];
        const n = 54;
        for (let i = 0; i < n; i++) {
            const ang = (i / n) * TAU + Math.random() * 0.15;
            const sp = 70 + Math.random() * 80;
            particles.push({ x, y, px: x, py: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, max: 1.2 + Math.random() * 0.8, c: i % 3 === 0 ? color2 : color });
        }
    };

    // Parallax target from the pointer, eased each frame.
    let px = 0;
    let targetPx = 0;
    const onMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (e.clientY < rect.top || e.clientY > rect.bottom) return;
        targetPx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const clickHandler = (e) => {
        const rect = canvas.getBoundingClientRect();
        burst(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener('click', clickHandler);

    let t = 0;
    let nextAutoBurst = 4 + Math.random() * 4;

    function respawn(a, yMin, yMax, wait) {
        a.active = false;
        a.wait = wait;
        a.dir = Math.random() < 0.5 ? 1 : -1;
        a.x = a.dir > 0 ? -220 : W + 220;
        a.y = H * (yMin + Math.random() * (yMax - yMin));
    }

    function frame(dt) {
        t += dt;
        px += (targetPx - px) * Math.min(1, dt * 2.5);
        // Gusts: slow noise that sometimes pushes palms harder.
        const wind = Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1)) * 1.4;

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(sky, 0, 0, W, horizon + 1);

        for (const s of stars) {
            ctx.globalAlpha = 0.3 + 0.5 * Math.sin(t * s.s + s.p) ** 2;
            ctx.fillStyle = '#fff';
            ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;

        if (pal.stars && !reduceMotion) {
            nextShooting -= dt;
            if (!shooting && nextShooting <= 0) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                shooting = { x: W * (0.15 + Math.random() * 0.7), y: H * (0.03 + Math.random() * 0.12), vx: dir * (260 + Math.random() * 120), vy: 90 + Math.random() * 40, life: 0 };
                nextShooting = 7 + Math.random() * 9;
            }
            if (shooting) {
                shooting.life += dt;
                shooting.x += shooting.vx * dt;
                shooting.y += shooting.vy * dt;
                const k = shooting.life / 0.9;
                if (k >= 1) shooting = null;
                else {
                    const tl = 0.12;
                    const g = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * tl, shooting.y - shooting.vy * tl);
                    g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`);
                    g.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.strokeStyle = g;
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(shooting.x, shooting.y);
                    ctx.lineTo(shooting.x - shooting.vx * tl, shooting.y - shooting.vy * tl);
                    ctx.stroke();
                }
            }
        }

        for (const c of clouds) {
            c.x += c.vx * dt;
            if (c.x > W + 10) c.x = -c.w - 10;
            ctx.globalAlpha = c.alpha;
            ctx.drawImage(c.c, c.x + px * 3, c.y, c.w, c.h);
        }
        ctx.globalAlpha = 1;

        // Jet with a contrail that spreads and fades.
        if (jet.active) {
            jet.x += jet.dir * jet.speed * dt;
            jet.trailT += dt;
            if (jet.trailT > 0.06) {
                jet.trailT = 0;
                jet.trail.push({ x: jet.x - jet.dir * 7, y: jet.y, age: 0 });
            }
            if ((jet.dir > 0 && jet.x > W + 40) || (jet.dir < 0 && jet.x < -40)) {
                respawn(jet, 0.05, 0.12, 12 + Math.random() * 10);
                jet.x = jet.dir > 0 ? -20 : W + 20;
            }
        } else if (!reduceMotion) {
            jet.wait -= dt;
            if (jet.wait <= 0) jet.active = true;
        }
        if (jet.trail.length) {
            ctx.lineCap = 'round';
            for (let i = 1; i < jet.trail.length; i++) {
                const a = jet.trail[i - 1];
                const b = jet.trail[i];
                const k = b.age / 7;
                if (k >= 1) continue;
                ctx.strokeStyle = `rgba(255, 220, 236, ${0.4 * (1 - k)})`;
                ctx.lineWidth = 0.8 + b.age * 0.9;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y + a.age * 0.6);
                ctx.lineTo(b.x, b.y + b.age * 0.6);
                ctx.stroke();
            }
            for (const p of jet.trail) p.age += dt;
            while (jet.trail.length && jet.trail[0].age > 7) jet.trail.shift();
        }
        if (jet.active) drawJet(ctx, jet, t);

        // Skyline layers with parallax.
        const farX = -PAR + px * 4;
        const nearX = -PAR + px * 9;
        ctx.drawImage(far.c, farX, horizon - far.h, far.w, far.h);

        if (heli) {
            heli.x = heli.baseX + Math.sin(t * 0.23) * 40 + px * 6;
            heli.y = heli.baseY + Math.sin(t * 0.7) * 3;
            drawHeli(ctx, heli, t, pal.silhouette, horizon - skyMax * 0.6);
        }

        ctx.drawImage(near.c, nearX, horizon - near.h, near.w, near.h);
        for (const d of near.dyn) {
            d.next -= dt;
            if (d.next <= 0) { d.on = !d.on; d.next = 2 + Math.random() * 10; }
            if (!d.on) continue;
            ctx.fillStyle = d.warm ? 'rgba(255, 214, 140, 0.95)' : 'rgba(120, 240, 255, 0.95)';
            ctx.fillRect(d.x + nearX + PAR, horizon + d.y, 1.3, 1.7);
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const b of near.beacons) {
            const on = 0.5 + 0.5 * Math.sin(t * TAU * b.rate * 0.5 + b.phase);
            ctx.globalAlpha = on * on;
            ctx.drawImage(beaconGlow.c, b.x + nearX + PAR - beaconGlow.r, horizon + b.y - beaconGlow.r, beaconGlow.r * 2, beaconGlow.r * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // Water and reflections.
        ctx.drawImage(water, 0, horizon, W, H - horizon);
        const refH = Math.min(near.h, H - horizon);
        const strip = 2;
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < refH; r += strip) {
            const k = r / refH;
            const dx = Math.sin(t * 1.6 + r * 0.35) * (0.6 + 2.2 * k);
            const sy = (near.h - r - strip) * dpr;
            if (sy < 0) break;
            ctx.globalAlpha = 0.32 * (1 - k);
            ctx.drawImage(near.c, 0, sy, near.c.width, strip * dpr, nearX + dx, horizon + r, near.w, strip);
        }
        ctx.globalCompositeOperation = 'source-over';
        for (let y = horizon + 2, row = 0; y < H; y += 3, row++) {
            const d = (y - horizon) / (H - horizon);
            const half = sunR * (0.45 + 0.8 * d) * (0.6 + 0.4 * Math.sin(t * 1.7 + row * 1.37) * Math.sin(t * 0.6 + row * 0.5));
            const off = Math.sin(t * 0.9 + row * 0.6) * sunR * 0.08;
            ctx.globalAlpha = (1 - d) * 0.65;
            ctx.fillStyle = d < 0.3 ? '#ffc27a' : '#ff5a9a';
            ctx.fillRect(sunX - half + off, y, half * 2, 1.4);
        }
        for (const g of glints) {
            ctx.globalAlpha = 0.5 * Math.max(0, Math.sin(t * g.s + g.p));
            ctx.fillStyle = '#ff9ccf';
            ctx.fillRect(g.x + Math.sin(t * 0.5 + g.p) * 6, g.y, g.len, 1);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255, 210, 160, 0.8)';
        ctx.fillRect(0, horizon - 0.5, W, 1);

        // Sailboats on the horizon.
        ctx.fillStyle = pal.silhouette;
        for (const s of sails) {
            s.x += s.vx * dt;
            if (s.x > W + 10) s.x = -10;
            if (s.x < -10) s.x = W + 10;
            const bob = Math.sin(t * 1.3 + s.x) * 0.4;
            const sc = s.s;
            ctx.beginPath();
            ctx.moveTo(s.x - 6 * sc, horizon + 0.5 + bob);
            ctx.lineTo(s.x + 6 * sc, horizon + 0.5 + bob);
            ctx.lineTo(s.x + 4 * sc, horizon + 2.5 * sc + bob);
            ctx.lineTo(s.x - 4 * sc, horizon + 2.5 * sc + bob);
            ctx.moveTo(s.x, horizon - 12 * sc + bob);
            ctx.lineTo(s.x + 5 * sc, horizon - 0.5 + bob);
            ctx.lineTo(s.x, horizon - 0.5 + bob);
            ctx.moveTo(s.x - 0.8, horizon - 10 * sc + bob);
            ctx.lineTo(s.x - 4.5 * sc, horizon - 0.5 + bob);
            ctx.lineTo(s.x - 0.8, horizon - 0.5 + bob);
            ctx.fill();
        }

        // Speedboat.
        if (boat.active) {
            boat.x += boat.dir * boat.speed * dt;
            boat.bob += dt * 9;
            boat.foamT += dt;
            if (boat.foamT > 0.03) {
                boat.foamT = 0;
                boat.foam.push({ x: boat.x - boat.dir * 8, y: boat.y + 1, age: 0 });
            }
            if ((boat.dir > 0 && boat.x > W + 60) || (boat.dir < 0 && boat.x < -60)) {
                respawn(boat, 0, 0, 6 + Math.random() * 8);
                boat.x = boat.dir > 0 ? -30 : W + 30;
                boat.y = horizon + (H - horizon) * (0.22 + Math.random() * 0.2);
            }
        } else if (!reduceMotion) {
            boat.wait -= dt;
            if (boat.wait <= 0) boat.active = true;
        }
        for (const f of boat.foam) f.age += dt;
        while (boat.foam.length && boat.foam[0].age > 2.6) boat.foam.shift();
        if (boat.active || boat.foam.length) drawSpeedboat(ctx, boat, pal.silhouette);

        // Soft scrim behind the hero text so it stays readable.
        const scrim = ctx.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, Math.max(W * 0.32, 260));
        scrim.addColorStop(0, 'rgba(18, 4, 34, 0.42)');
        scrim.addColorStop(0.6, 'rgba(18, 4, 34, 0.22)');
        scrim.addColorStop(1, 'rgba(18, 4, 34, 0)');
        ctx.fillStyle = scrim;
        ctx.fillRect(0, 0, W, H);

        // Neon logo segments.
        for (const s of segs) {
            s.a += (s.speed * dt * radius) / s.r;
            ctx.globalAlpha = 0.6;
            const sp = segmentSprite(s.r, s.w, s.color, 4 + s.diff, 86 - s.diff, dpr);
            ctx.save();
            ctx.translate(W / 2, H / 2);
            ctx.rotate(((s.rot + s.a) * Math.PI) / 180);
            ctx.drawImage(sp.canvas, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        for (const b of birds) {
            b.x += b.vx * dt;
            if (b.x > W + 20) { b.x = -20; b.y = H * (0.12 + Math.random() * 0.3); }
            drawBird(ctx, { ...b, x: b.x + px * 5, y: b.y + Math.sin(t * 0.8 + b.bob) * 4 }, t, 'rgba(20, 4, 32, 0.75)');
        }

        for (const p of palms) {
            ctx.save();
            ctx.translate(px * 16 * p.depth, 0);
            drawPalm(ctx, p, t, pal.silhouette, wind);
            ctx.restore();
        }

        // Fireworks with short trails.
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
            ctx.lineCap = 'round';
            for (const p of particles) {
                p.life += dt;
                p.px = p.x;
                p.py = p.y;
                p.vx *= Math.pow(0.4, dt);
                p.vy = p.vy * Math.pow(0.4, dt) + 45 * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                const k = 1 - p.life / p.max;
                if (k <= 0) continue;
                // Twinkle near the end of life.
                const tw = k < 0.35 ? (Math.random() < 0.5 ? 1 : 0.2) : 1;
                ctx.globalAlpha = k * tw;
                ctx.strokeStyle = p.c;
                ctx.lineWidth = 1.2 + k * 1.2;
                ctx.beginPath();
                ctx.moveTo(p.px - (p.x - p.px) * 3, p.py - (p.y - p.py) * 3);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
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
        window.removeEventListener('pointermove', onMove);
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
