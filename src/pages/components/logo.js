import React from 'react';

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
    const x = centerX + (radius * Math.cos(angleInRadians));
    const y = centerY + (radius * Math.sin(angleInRadians));
    return [x, y];
}

function cartesianToPolar(centerX, centerY, X, Y) {
    const radians = Math.atan2(Y - centerY, X - centerX);
    return (radians * 180) / Math.PI;
}

// Sprite cache shared across all instances. Pre-rendering once avoids
// gradient allocations per frame on software-rendered canvases.
const sprites = {};

function Segment(ctx, X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor) {
    this.ctx = ctx;
    this.init(X, Y, x, y, radius, r, w, rotate, speed, angleDiff, segmentColor);
}

Segment.prototype.init = function init(X, Y, x, y, rad, r, w, rotate, speed, angleDiff, segColor) {
    this.X = X;
    this.Y = Y;
    this.radius = rad;
    this.x = x;
    this.y = y;
    this.r = r;
    this.w = w;
    this.c = segColor;
    this.rotate = rotate;
    this.speed = speed * 60;
    this.angleDiff = angleDiff;
    this.a = 0;
};

function getSegmentSprite(r, w, color, fromAngle, toAngle) {
    const key = `seg:${r | 0}:${w | 0}:${color}:${fromAngle}:${toAngle}`;
    if (sprites[key]) return sprites[key];
    if (typeof document === 'undefined') return null;

    const padding = 6; // room for stroke + antialiasing
    const size = Math.ceil(r * 2 + padding * 2);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const sctx = c.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    const fromRad = (fromAngle * Math.PI) / 180;
    const toRad = (toAngle * Math.PI) / 180;
    const startX = cx + r * Math.cos(fromRad);
    const startY = cy + r * Math.sin(fromRad);
    const endX = cx + r * Math.cos(toRad);
    const endY = cy + r * Math.sin(toRad);
    const anotherX = startX - w;
    const anotherY = endY - w;
    const innerAngleStart = Math.atan2(startY - cy, anotherX - cx);
    const innerAngleEnd = Math.atan2(anotherY - cy, endX - cx);

    sctx.beginPath();
    sctx.arc(cx, cy, r, toRad, fromRad, true);
    sctx.arc(cx, cy, r - w, innerAngleStart, innerAngleEnd, false);
    sctx.closePath();
    sctx.fillStyle = color;
    sctx.strokeStyle = color;
    sctx.lineWidth = 3;
    sctx.fill();
    sctx.stroke();

    sprites[key] = c;
    return c;
}

Segment.prototype.draw = function draw() {
    const ctx = this.ctx;
    const sprite = getSegmentSprite(
        this.r,
        this.w,
        this.c,
        4 + this.angleDiff,
        86 - this.angleDiff,
    );
    if (!sprite) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(((this.rotate + this.a) * Math.PI) / 180);
    const half = sprite.width / 2;
    ctx.drawImage(sprite, -half, -half);
    ctx.restore();
};

Segment.prototype.updateParams = function updateParams(elapsedTime) {
    this.a += (this.speed * elapsedTime * this.radius) / this.r;
};

Segment.prototype.render = function render(elapsedTime) {
    this.updateParams(elapsedTime);
    this.draw();
};

function Bubble(ctx, canvasWidth, canvasHeight, isDarkTheme) {
    this.ctx = ctx;
    this.isDarkTheme = isDarkTheme;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.color = 'rgba(46, 3, 15, 0.35)';
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    this.radius = Math.random() * canvasWidth / 60 + 5;
    this.vx = (Math.random() - 0.5) * 70;
    this.vy = (Math.random() - 0.5) * 70;
    this.alpha = Math.random() * 0.3 + 0.7;
    this.pulse = 0;
    this.pulseSpeed = 0;
    // Burst parameters. Minimum interval must exceed the max appearDuration
    // (~6s) so bubbles finish fading in before they can auto-burst.
    this.burstInterval = Math.random() * 50 + 8;
    this.timeSinceLastBurst = 0;
    this.bursting = false;
    this.burstProgress = 0;
    this.burstDuration = 0.5;
    this.appearDuration = Math.random() * 1 + 5;
    this.appearProgress = 0;
    this.splashParticles = null;
}

Bubble.prototype.reset = function() {
    this.x = Math.random() * this.canvasWidth;
    this.y = Math.random() * this.canvasHeight;
    this.radius = Math.random() * this.canvasWidth / 60 + 5;
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = (Math.random() - 0.5) * 50;
    this.alpha = Math.random() * 0.3 + 0.7;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 2 + 1;
    this.burstInterval = Math.random() * 50 + 8;
    this.timeSinceLastBurst = 0;
    this.bursting = false;
    this.burstProgress = 0;
    this.appearProgress = 0;
    this.splashParticles = null;
};

Bubble.prototype.startBurst = function() {
    if (this.bursting) return;
    this.bursting = true;
    this.justStartedBursting = true;
    this.burstProgress = 0;
    const numSplashes = Math.floor(Math.random() * 6) + 10;
    this.splashParticles = [];
    for (let i = 0; i < numSplashes; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 50 + 50;
        const length = Math.random() * 10 + 5;
        this.splashParticles.push({
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            length,
        });
    }
};

Bubble.prototype.update = function(elapsedTime) {
    this.x += this.vx * elapsedTime;
    this.y += this.vy * elapsedTime;

    if (this.x < 0) { this.x = 0; this.vx *= -1; }
    if (this.x > this.canvasWidth) { this.x = this.canvasWidth; this.vx *= -1; }
    if (this.y < 0) { this.y = 0; this.vy *= -1; }
    if (this.y > this.canvasHeight) { this.y = this.canvasHeight; this.vy *= -1; }

    if (!this.bursting) {
        this.pulse += this.pulseSpeed * elapsedTime;
        this.appearProgress = Math.min(1, this.appearProgress + elapsedTime / this.appearDuration);
        this.timeSinceLastBurst += elapsedTime;
        if (this.timeSinceLastBurst >= this.burstInterval) {
            this.startBurst();
        }
    } else {
        this.burstProgress += elapsedTime / this.burstDuration;
        if (this.burstProgress >= 1) {
            this.reset();
        }
    }
};

Bubble.prototype.draw = function() {
    const ctx = this.ctx;
    ctx.save();

    if (!this.bursting) {
        const dynamicAlpha = (this.alpha + 0.3 * Math.sin(this.pulse)) * this.appearProgress;
        ctx.globalAlpha = Math.max(0, Math.min(0.7, dynamicAlpha));

        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        if (this.isDarkTheme) {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
            gradient.addColorStop(0.95, 'rgba(98, 86, 86, 0.04)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.33)');
        } else {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.68)');
            gradient.addColorStop(0.95, 'rgba(139, 131, 148, 0.17)');
            gradient.addColorStop(1, 'rgba(6, 5, 81, 0.23)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const burstRadius = this.radius * (1 + 0.1 * this.burstProgress);
        ctx.globalAlpha = Math.max(0, 1 - this.burstProgress);
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, burstRadius);
        if (this.isDarkTheme) {
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
            gradient.addColorStop(0.6, 'rgba(100, 82, 82, 0.29)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(217, 217, 217, 0.9)');
            gradient.addColorStop(0.6, 'rgba(177,246,255,0.29)');
            gradient.addColorStop(1, 'rgba(204, 204, 204, 0)');
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, burstRadius, 0, Math.PI * 2);
        ctx.fill();

        if (this.splashParticles) {
            const burstAlpha = Math.max(0, 1 - this.burstProgress);
            ctx.fillStyle = this.isDarkTheme ? 'rgba(255, 255, 255, 0.71)' : 'rgb(174,174,174)';
            ctx.globalAlpha = burstAlpha;
            const inv = 1 - this.burstProgress;
            for (let i = 0; i < this.splashParticles.length; i++) {
                const p = this.splashParticles[i];
                const splashX = this.x + p.dx * this.burstProgress;
                const splashY = this.y + p.dy * this.burstProgress;
                const splashRadius = 0.1 * p.length * inv;
                ctx.beginPath();
                ctx.arc(splashX, splashY, splashRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    ctx.restore();
};

Bubble.prototype.render = function(elapsedTime) {
    this.update(elapsedTime);
    this.draw();
};

function draw(canvas, _X, _Y, isDarkTheme) {
    // Always read current canvas dimensions. React state can be stale right
    // after a theme switch (the browser may have re-laid out the canvas
    // before setScale propagated).
    canvas.width = canvas.clientWidth || _X || 1;
    canvas.height = canvas.clientHeight || _Y || 1;
    const X = canvas.width;
    const Y = canvas.height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const centerX = X / 2;
    const centerY = Y / 2;
    let outerSegmentColor, innerSegmentColor;
    if (isDarkTheme) {
        outerSegmentColor = '#6e2b2b';
        innerSegmentColor = '#6e2b2b';
    } else {
        outerSegmentColor = '#e6e8eb';
        innerSegmentColor = '#ffd4d4';
    }

    const radius = Y / 7;
    const lw = radius / 15;

    const requestAnimationFrame = global.requestAnimationFrame || global.mozRequestAnimationFrame
        || global.webkitRequestAnimationFrame || global.msRequestAnimationFrame
        || function requestAnimationFrame(cb) {
            setTimeout(cb, 17);
        };

    const bubbleCount = 32;
    const bubbles = [];
    for (let i = 0; i < bubbleCount; i++) {
        bubbles.push(new Bubble(ctx, X, Y, isDarkTheme));
    }

    // Chain-burst: when a bubble bursts, any bubbles whose circles intersect
    // it ignite too, with a small stagger so the cascade reads as deliberate.
    const pendingChainTimers = [];
    const triggerIntersectionBurst = (source) => {
        for (let i = 0; i < bubbles.length; i++) {
            const other = bubbles[i];
            if (other === source || other.bursting) continue;
            const dx = other.x - source.x;
            const dy = other.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < source.radius + other.radius) {
                const delay = 40 + Math.random() * 80;
                const timerId = setTimeout(() => {
                    if (cancelled) return;
                    if (!other.bursting) other.startBurst();
                }, delay);
                pendingChainTimers.push(timerId);
            }
        }
    };

    const segments = [];
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 0,   -1.5, 0, outerSegmentColor));
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 90,  -1.5, 0, outerSegmentColor));
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 180, -1.5, 0, outerSegmentColor));
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 270, -1.5, 0, outerSegmentColor));
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 45,   1.5, 2, innerSegmentColor));
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 135,  1.5, 2, innerSegmentColor));
    segments.push(new Segment(ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 225,  1.5, 2, innerSegmentColor));

    // Click handler: burst every bubble at the click position.
    const clickHandler = (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        for (const b of bubbles) {
            if (b.bursting) continue;
            const dx = clickX - b.x;
            const dy = clickY - b.y;
            if (Math.sqrt(dx * dx + dy * dy) <= b.radius) {
                b.startBurst();
            }
        }
    };
    canvas.addEventListener('click', clickHandler);

    let lastRenderTime = 0;
    let cancelled = false;
    let rafId = null;

    // IntersectionObserver replaces per-frame offsetParent polling (which
    // forces a synchronous layout reflow).
    let canvasVisible = true;
    let intersectionObserver = null;
    if (typeof IntersectionObserver !== 'undefined') {
        intersectionObserver = new IntersectionObserver(([entry]) => {
            canvasVisible = entry ? entry.isIntersecting : true;
        }, { threshold: 0 });
        intersectionObserver.observe(canvas);
    }

    function render(currentTime) {
        if (cancelled || X <= 1) {
            return;
        }

        // First frame: establish the clock, skip physics. rAF's currentTime is
        // ms-since-page-load, not ms-since-mount, so initializing lastRenderTime
        // to 0 would produce a huge first-frame elapsedTime on every re-mount.
        if (lastRenderTime === 0) {
            lastRenderTime = currentTime;
            rafId = requestAnimationFrame(render);
            return;
        }

        // Cap elapsedTime defensively — covers long backgrounded tabs etc.
        const secondsSinceLastRender = Math.min(0.1, (currentTime - lastRenderTime) / 1000);

        if (canvasVisible) {
            ctx.clearRect(0, 0, X, Y);
            ctx.globalAlpha = 1;

            for (let i = 0; i < segments.length; i += 1) {
                segments[i].render(secondsSinceLastRender);
            }

            for (let i = 0; i < bubbles.length; i++) {
                const b = bubbles[i];
                if (b.justStartedBursting) {
                    b.justStartedBursting = false;
                    triggerIntersectionBurst(b);
                }
                b.render(secondsSinceLastRender);
            }

            ctx.shadowBlur = 0;
        }

        lastRenderTime = currentTime;
        rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);

    return () => {
        cancelled = true;
        if (rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(rafId);
        }
        canvas.removeEventListener('click', clickHandler);
        if (intersectionObserver) intersectionObserver.disconnect();
        for (let i = 0; i < pendingChainTimers.length; i++) {
            clearTimeout(pendingChainTimers[i]);
        }
    };
}

let observer;
if (global.window || (process && process.browser)) {
    // Watch the data-theme attribute only - not every attribute change.
    observer = new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
            if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
                window.dispatchEvent(new Event('resized'));
                break;
            }
        }
    });
    const element = document.querySelector('html');
    observer.observe(element, {
        attributes: true,
        attributeFilter: ['data-theme'],
    });
}

const Logo = (props) => {
    const [scale, setScale] = React.useState({ x: 1, y: 1 });
    const canvas = React.useRef(null);

    const resized = () => {
        if (canvas.current === null) {
            return;
        }
        const newW = canvas.current.clientWidth;
        const newH = canvas.current.clientHeight;
        if (canvas.current.width !== newW || canvas.current.height !== newH) {
            canvas.current.width = newW;
            canvas.current.height = newH;
            setScale({ x: newW, y: newH });
        }
    };

    React.useEffect(() => resized(), []);

    if (global.window || (process && process.browser)) {
        React.useEffect(() => {
            window.addEventListener("resize", resized);
            window.addEventListener("resized", resized);
            return () => {
                window.removeEventListener("resize", resized);
                window.removeEventListener("resized", resized);
            };
        }, []);
    }

    React.useEffect(() => {
        const cleanup = draw(canvas.current, scale.x, scale.y, props.isDarkTheme);
        return cleanup;
    }, [scale.x, scale.y, props.isDarkTheme]);

    return <canvas ref={canvas} style={{ width: "100%", height: "100%" }} />;
}

export default Logo;
