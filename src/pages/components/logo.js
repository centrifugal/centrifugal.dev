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

Segment.prototype.drawSegment = function drawSegment(fromAngle, toAngle, rotateAngle) {
    this.ctx.translate(this.x, this.y);
    this.ctx.rotate((rotateAngle * Math.PI) / 180);
    this.ctx.translate(-this.x, -this.y);
    this.ctx.beginPath();

    const res = polarToCartesian(this.x, this.y, this.r, fromAngle);
    const startX = res[0];
    const startY = res[1];
    const toRes = polarToCartesian(this.x, this.y, this.r, toAngle);
    const endX = toRes[0];
    const endY = toRes[1];

    const anotherX = startX - this.w;
    const anotherY = endY - this.w;
    const innerAngleStart = cartesianToPolar(this.x, this.y, anotherX, startY);
    const innerAngleEnd = cartesianToPolar(this.x, this.y, endX, anotherY);
    const toAngleRad = (toAngle * Math.PI) / 180;
    const fromAngleRad = (fromAngle * Math.PI) / 180;
    const innerAngleStartRad = (innerAngleStart * Math.PI) / 180;
    const innerAngleEndRad = (innerAngleEnd * Math.PI) / 180;

    this.ctx.arc(this.x, this.y, this.r, toAngleRad, fromAngleRad, true);
    this.ctx.arc(this.x, this.y, this.r - this.w, innerAngleStartRad, innerAngleEndRad, false);
    this.ctx.closePath();
    this.ctx.fillStyle = this.c;
    this.ctx.fill();
    this.ctx.stroke();
};

Segment.prototype.draw = function draw() {
    this.ctx.save();
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = this.c;
    this.ctx.shadowColor = this.c;
    this.drawSegment(4 + this.angleDiff, 86 - this.angleDiff, this.rotate + this.a);
    this.ctx.restore();
};

Segment.prototype.resize = function resize() {
    this.x = this.X / 2;
    this.y = this.Y / 2;
};

Segment.prototype.updateParams = function updateParams(elapsedTime) {
    this.a += (this.speed * elapsedTime * this.radius) / this.r;
};

Segment.prototype.render = function render(elapsedTime) {
    this.updateParams(elapsedTime);
    this.draw();
};

function Line(ctx, X, Y, x, y, lineColor) {
    this.ctx = ctx;
    this.init(X, Y, x, y, lineColor);
}

Line.prototype.init = function init(X, Y, x, y, lineColor) {
    this.X = X;
    this.Y = Y;
    this.x = x;
    this.y = y;
    this.c = lineColor;
    this.lw = 1;
    this.v = {
        x: Math.random() * 100,
        y: Math.random() * 100,
    };
};

Line.prototype.draw = function draw() {
    this.ctx.save();
    this.ctx.lineWidth = this.lw;
    this.ctx.strokeStyle = this.c;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.y);
    this.ctx.lineTo(this.X, this.y);
    this.ctx.stroke();
    this.ctx.lineWidth = this.lw;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x, 0);
    this.ctx.lineTo(this.x, this.Y);
    this.ctx.stroke();
    this.ctx.restore();
};

Line.prototype.updatePosition = function updatePosition(elapsedTime) {
    this.x += this.v.x * elapsedTime;
    this.y += this.v.y * elapsedTime;
};

Line.prototype.wrapPosition = function wrapPosition() {
    if (this.x < 0) this.x = this.X;
    if (this.x > this.X) this.x = 0;
    if (this.y < 0) this.y = this.Y;
    if (this.y > this.Y) this.y = 0;
};

Line.prototype.render = function render(elapsedTime) {
    this.updatePosition(elapsedTime);
    this.wrapPosition();
    this.draw();
};

function Bubble(ctx, canvasWidth, canvasHeight, isDarkTheme) {
    this.ctx = ctx;
    this.isDarkTheme = isDarkTheme;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    // Use the original color passed in.
    this.color = 'rgba(46, 3, 15, 0.35)';
    // Start at a random position.
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;
    // Random radius between 5 and 20.
    this.radius = Math.random() * canvasWidth/60 + 5;
    // Random velocities for a gentle drifting effect.
    this.vx = (Math.random() - 0.5) * 70;
    this.vy = (Math.random() - 0.5) * 70;
    // Base opacity for the bubble (more opaque).
    this.alpha = Math.random() * 0.3 + 0.7;
    // Variables for a pulsating (breathing) effect.
    this.pulse = 0;//Math.random() * Math.PI * 2;
    this.pulseSpeed = 0;// Math.random() * 2 + 1;
    // Burst parameters.
    this.burstInterval = Math.random() * 50 + 3; // seconds until burst.
    this.timeSinceLastBurst = 0;
    this.bursting = false;
    this.burstProgress = 0;
    this.burstDuration = 0.5; // seconds for burst animation.
    // Appear (fade-in) parameters.
    this.appearDuration = Math.random() * 1 + 5; // seconds to fully appear.
    this.appearProgress = 0; // start completely invisible.
    // Splash particles will be generated on burst.
    this.splashParticles = null;
    // Targeting "lock on" effect from orbs
    this.targetingProgress = 0;
    // User-requested priority target (clicked in orb mode)
    this.priorityTargeted = false;
}

Bubble.prototype.reset = function() {
    // Reset bubble after burst.
    this.x = Math.random() * this.canvasWidth;
    this.y = Math.random() * this.canvasHeight;
    this.radius = Math.random() * this.canvasWidth/60 + 5;
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = (Math.random() - 0.5) * 50;
    this.alpha = Math.random() * 0.3 + 0.7;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = Math.random() * 2 + 1;
    this.burstInterval = Math.random() * 50 + 3;
    this.timeSinceLastBurst = 0;
    this.bursting = false;
    this.burstProgress = 0;
    this.appearProgress = 0;
    this.splashParticles = null;
};

Bubble.prototype.update = function(elapsedTime) {
    // Decay targeting lock-on effect
    if (this.targetingProgress > 0) {
        this.targetingProgress = Math.max(0, this.targetingProgress - elapsedTime * 1.6);
    }

    // Always update movement.
    this.x += this.vx * elapsedTime;
    this.y += this.vy * elapsedTime;

    // Bounce off the canvas edges.
    if (this.x < 0) { this.x = 0; this.vx *= -1; }
    if (this.x > this.canvasWidth) { this.x = this.canvasWidth; this.vx *= -1; }
    if (this.y < 0) { this.y = 0; this.vy *= -1; }
    if (this.y > this.canvasHeight) { this.y = this.canvasHeight; this.vy *= -1; }

    if (!this.bursting) {
        // Normal behavior when not bursting.
        this.pulse += this.pulseSpeed * elapsedTime;
        this.appearProgress = Math.min(1, this.appearProgress + elapsedTime / this.appearDuration);
        this.timeSinceLastBurst += elapsedTime;
        if (this.timeSinceLastBurst >= this.burstInterval) {
            this.bursting = true;
            this.burstProgress = 0;
            let numSplashes = Math.floor(Math.random() * 6) + 10;
            this.splashParticles = [];
            for (let i = 0; i < numSplashes; i++) {
                let angle = Math.random() * Math.PI * 2;
                // Speed controls how fast the splash particle moves outward.
                let speed = Math.random() * 50 + 50;
                // Each particle's "length" defines its initial size.
                let length = Math.random() * 10 + 5;
                this.splashParticles.push({angle: angle, speed: speed, length: length});
            }
        }
    } else {
        // Update burst progress while still moving.
        this.burstProgress += elapsedTime / this.burstDuration;
        if (this.burstProgress >= 1) {
            // Reset bubble after burst.
            this.reset();
        }
    }
};

Bubble.prototype.draw = function() {
    const ctx = this.ctx;
    ctx.save();

    if (!this.bursting) {
        // Normal bubble drawing with pulsating and fade-in effect.
        const dynamicAlpha = (this.alpha + 0.3 * Math.sin(this.pulse)) * this.appearProgress;
        ctx.globalAlpha = Math.max(0, Math.min(0.7, dynamicAlpha));

        // Create a radial gradient with a white center highlight,
        // transitioning to a colored rim and then fading out.
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
        // Bursting animation: bubble expands and fades out.
        const burstRadius = this.radius * (1 + 0.1*this.burstProgress);
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

        // Draw splash particles to simulate droplets flying outward.
        if (this.splashParticles) {
            for (let i = 0; i < this.splashParticles.length; i++) {
                let p = this.splashParticles[i];
                // Calculate outward displacement based on burst progress.
                let offset = p.speed * this.burstProgress;
                let splashX = this.x + Math.cos(p.angle) * offset;
                let splashY = this.y + Math.sin(p.angle) * offset;
                // Gradually decrease the size of the splash particle.
                let splashRadius = p.length * (1 - this.burstProgress);
                ctx.globalAlpha = Math.max(0, 1 - this.burstProgress);
                if (this.isDarkTheme) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.71)';
                } else {
                    ctx.fillStyle = 'rgb(174,174,174)';
                }
                ctx.beginPath();
                ctx.arc(splashX, splashY, 0.1*splashRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Targeting "lock on" crosshair (drawn after the bubble itself)
    if (this.targetingProgress > 0 && !this.bursting) {
        const p = this.targetingProgress;
        // Bracket distance: starts wider, settles toward bubble as it locks in
        const r = this.radius * (2.4 - p * 0.8);
        const len = this.radius * 0.55;
        const alpha = Math.min(1, p * 1.3);

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.isDarkTheme ? '#fe5e5e' : '#d56464';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 4;
        ctx.shadowColor = this.isDarkTheme ? 'rgba(254,94,94,0.6)' : 'rgba(213,100,100,0.5)';

        ctx.beginPath();
        // Top-left bracket
        ctx.moveTo(this.x - r, this.y - r + len);
        ctx.lineTo(this.x - r, this.y - r);
        ctx.lineTo(this.x - r + len, this.y - r);
        // Top-right bracket
        ctx.moveTo(this.x + r - len, this.y - r);
        ctx.lineTo(this.x + r, this.y - r);
        ctx.lineTo(this.x + r, this.y - r + len);
        // Bottom-right bracket
        ctx.moveTo(this.x + r, this.y + r - len);
        ctx.lineTo(this.x + r, this.y + r);
        ctx.lineTo(this.x + r - len, this.y + r);
        // Bottom-left bracket
        ctx.moveTo(this.x - r + len, this.y + r);
        ctx.lineTo(this.x - r, this.y + r);
        ctx.lineTo(this.x - r, this.y + r - len);
        ctx.stroke();
    }

    ctx.restore();
};

Bubble.prototype.render = function(elapsedTime) {
    this.update(elapsedTime);
    this.draw();
};

function Orb(ctx, canvasWidth, canvasHeight, isDarkTheme) {
    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.isDarkTheme = isDarkTheme;
    this.radius = Math.max(6, Math.min(canvasWidth, canvasHeight) / 80);
    this.speed = 380; // px/sec
    this.target = null;
    // Initial delay so bubbles get a chance to fade in before orbs start firing
    this.cooldown = 2.5 + Math.random() * 1.5;
    this.spawnAtCenter();
    // Trail of past positions for motion blur
    this.trail = [];
    this.maxTrail = 12;
    // Pulse for glow breathing
    this.pulse = Math.random() * Math.PI * 2;
    // Sparkle state for collision flash
    this.sparkleProgress = 0;
    this.sparkleDuration = 0.6;
    this.sparkles = [];
    this.sparkleX = 0;
    this.sparkleY = 0;
    this.remoteVisible = false;
}

Orb.prototype.spawnAtCenter = function() {
    this.x = this.canvasWidth / 2;
    this.y = this.canvasHeight / 2;
    this.trail = [];
};

Orb.prototype.pickTarget = function(bubbles, claimed) {
    // Prefer user-requested priority targets first (any visibility)
    for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (b.priorityTargeted && !b.bursting && !claimed.has(b)) {
            b.priorityTargeted = false; // claim
            return b;
        }
    }
    // Otherwise pick a random unclaimed bubble that's mostly visible
    const candidates = [];
    for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (!b.bursting && !claimed.has(b) && b.appearProgress > 0.5) {
            candidates.push(b);
        }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
};

Orb.prototype.update = function(elapsedTime, bubbles, claimed, onBurst) {
    // If our target burst before we could reach it, the "subscriber went offline"
    // — the in-flight message is lost. Vanish (respawn at center, no target).
    if (this.target && this.target.bursting) {
        claimed.delete(this.target);
        this.target = null;
        this.spawnAtCenter();
        this.cooldown = 0.4 + Math.random() * 1.0;
    }

    // Cooldown ticking between deliveries
    if (this.cooldown > 0) {
        this.cooldown = Math.max(0, this.cooldown - elapsedTime);
    }

    // Pick a new target if we don't have one (after cooldown)
    if (!this.target && this.cooldown <= 0) {
        this.target = this.pickTarget(bubbles, claimed);
        if (this.target) {
            claimed.add(this.target);
            this.target.targetingProgress = 1;
        }
    }

    if (this.target) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.target.radius + this.radius) {
            // Hit! Trigger dramatic burst
            const t = this.target;
            t.bursting = true;
            t.burstProgress = 0;
            const numSplashes = Math.floor(Math.random() * 8) + 14;
            t.splashParticles = [];
            for (let j = 0; j < numSplashes; j++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 120 + 80;
                const length = Math.random() * 15 + 8;
                t.splashParticles.push({ angle, speed, length });
            }

            // Sparkle flash on orb (anchor at impact point, not future positions)
            this.sparkleX = this.x;
            this.sparkleY = this.y;
            this.sparkleProgress = 1;
            this.sparkles = [];
            const numSparkles = Math.floor(Math.random() * 5) + 6;
            for (let k = 0; k < numSparkles; k++) {
                const sa = Math.random() * Math.PI * 2;
                const ss = Math.random() * 80 + 60;
                this.sparkles.push({ angle: sa, speed: ss, size: Math.random() * 2 + 1 });
            }

            // Notify listeners
            if (onBurst) onBurst();

            // Release target and respawn at center for next message
            claimed.delete(this.target);
            this.target = null;
            this.spawnAtCenter();
            this.cooldown = 0.4 + Math.random() * 1.0;
        } else {
            // Move at constant speed toward target
            const nx = dx / dist;
            const ny = dy / dist;
            this.x += nx * this.speed * elapsedTime;
            this.y += ny * this.speed * elapsedTime;
        }
    }

    // Pulse
    this.pulse += elapsedTime * 4;

    // Update sparkle decay
    if (this.sparkleProgress > 0) {
        this.sparkleProgress = Math.max(0, this.sparkleProgress - elapsedTime / this.sparkleDuration);
    }

    // Trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrail) this.trail.shift();
};

Orb.prototype.draw = function() {
    // The orb is "active" (has a delivery in flight) if either we own its
    // simulation locally (`target` set) or the leader told us so (`remoteVisible`).
    const active = !!this.target || this.remoteVisible === true;
    if (!active && this.sparkleProgress <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    const drawBody = active;

    if (drawBody) {
        // Trail
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const alpha = (i / this.trail.length) * 0.35;
            const r = this.radius * (i / this.trail.length);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.isDarkTheme ? '#fe5e5e' : '#d56464';
            ctx.beginPath();
            ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Outer glow (boosted while sparkling)
        const sparkleBoost = this.sparkleProgress;
        const glowRadius = this.radius * (4 + Math.sin(this.pulse) * 0.5 + sparkleBoost * 4);
        const glowAlphaBoost = 1 + sparkleBoost * 1.5;
        const glowGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowRadius);
        if (this.isDarkTheme) {
            glowGradient.addColorStop(0, `rgba(254, 94, 94, ${Math.min(1, 0.35 * glowAlphaBoost)})`);
            glowGradient.addColorStop(0.5, `rgba(254, 94, 94, ${Math.min(1, 0.08 * glowAlphaBoost)})`);
            glowGradient.addColorStop(1, 'rgba(254, 94, 94, 0)');
        } else {
            glowGradient.addColorStop(0, `rgba(213, 100, 100, ${Math.min(1, 0.32 * glowAlphaBoost)})`);
            glowGradient.addColorStop(0.5, `rgba(213, 100, 100, ${Math.min(1, 0.07 * glowAlphaBoost)})`);
            glowGradient.addColorStop(1, 'rgba(213, 100, 100, 0)');
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Sparkles flying out from orb during collision flash (anchored at impact point)
    if (this.sparkleProgress > 0 && this.sparkles.length) {
        const elapsed = (1 - this.sparkleProgress) * this.sparkleDuration;
        ctx.globalAlpha = this.sparkleProgress;
        for (let i = 0; i < this.sparkles.length; i++) {
            const s = this.sparkles[i];
            const sx = this.sparkleX + Math.cos(s.angle) * s.speed * elapsed;
            const sy = this.sparkleY + Math.sin(s.angle) * s.speed * elapsed;
            const sr = s.size * this.sparkleProgress;
            ctx.fillStyle = this.isDarkTheme ? '#fe5e5e' : '#d56464';
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    if (drawBody) {
        // Core orb with subtle highlight
        const coreGradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        coreGradient.addColorStop(0, '#fe9090');
        coreGradient.addColorStop(0.5, '#d56464');
        coreGradient.addColorStop(1, '#5a1010');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
};

Orb.prototype.render = function(elapsedTime, bubbles, claimed, onBurst) {
    this.update(elapsedTime, bubbles, claimed, onBurst);
    this.draw();
};

function draw(canvas, _X, _Y, isDarkTheme) {
    let orbsActive = orbsEnabled();
    if (orbsActive) setupSimSync();
    // Discard any stale state so follower orbs don't snap to old positions
    simReceivedState = null;
    // Always read current canvas dimensions; React state can be stale right
    // after a theme switch (the browser may have re-laid out the canvas before
    // setScale propagated). Reading directly avoids the "orbs flying in from
    // outside the canvas" glitch.
    canvas.width = canvas.clientWidth || _X || 1;
    canvas.height = canvas.clientHeight || _Y || 1;
    const X = canvas.width;
    const Y = canvas.height;
    const ctx = canvas.getContext("2d");

    const centerX = X / 2;
    const centerY = Y / 2;
    let lineColor, outerSegmentColor, innnerSegmentColor;
    if (isDarkTheme) {
        lineColor = '#8d3838';
        outerSegmentColor = '#6e2b2b';
        innnerSegmentColor = '#6e2b2b';
    } else {
        lineColor = '#ffd4d4';
        outerSegmentColor = '#e6e8eb';
        innnerSegmentColor = '#ffd4d4';
    }

    const linesNum = 3;
    const lines = [];
    const segments = [];
    const radius = Y / 7;
    const lw = radius / 15;

    const requestAnimationFrame = global.requestAnimationFrame || global.mozRequestAnimationFrame
        || global.webkitRequestAnimationFrame || global.msRequestAnimationFrame
        || function requestAnimationFrame(cb) {
            setTimeout(cb, 17);
        };

    const bubbleCount = 32; // Or however many bubbles you prefer.
    const bubbles = [];
    for (let i = 0; i < bubbleCount; i++) {
        // Use the same color as your original line color.
        bubbles.push(new Bubble(ctx, X, Y, isDarkTheme));
    }

    let orbs = null;
    let claimed = null;
    const onBurst = () => {
        try { window.dispatchEvent(new CustomEvent('cf-burst')); } catch (e) {}
    };

    function createOrbs() {
        if (orbs) return;
        orbs = [
            new Orb(ctx, X, Y, isDarkTheme),
            new Orb(ctx, X, Y, isDarkTheme),
            new Orb(ctx, X, Y, isDarkTheme),
        ];
        claimed = new Set();
    }

    function activateOrbs() {
        if (orbsActive) return;
        if (!orbsFeatureSupported()) return;
        orbsActive = true;
        try { localStorage.setItem(ORBS_ENABLED_KEY, 'true'); } catch (e) {}
        setupSimSync();
        createOrbs();
        try { window.dispatchEvent(new CustomEvent('cf-orbs-activated')); } catch (e) {}
    }

    if (orbsActive) createOrbs();

    function deactivateOrbs() {
        if (!orbsActive) return;
        orbsActive = false;
        orbs = null;
        claimed = null;
        activationClicks = [];
    }

    // Listen for activation/deactivation from another tab
    const storageHandler = (e) => {
        if (e.key === ORBS_ENABLED_KEY) {
            if (e.newValue !== 'false' && !orbsActive) {
                orbsActive = true;
                setupSimSync();
                createOrbs();
                try { window.dispatchEvent(new CustomEvent('cf-orbs-activated')); } catch (e2) {}
            } else if (e.newValue === 'false' && orbsActive) {
                deactivateOrbs();
            }
        }
    };
    window.addEventListener('storage', storageHandler);

    // Listen for local deactivation event from the LiveCounter stop button
    const deactivateHandler = () => deactivateOrbs();
    window.addEventListener('cf-orbs-deactivated', deactivateHandler);

    // Helper: burst a bubble in-place with normal splash particles
    function burstBubble(bubble) {
        if (bubble.bursting) return;
        bubble.bursting = true;
        bubble.burstProgress = 0;
        const numSplashes = Math.floor(Math.random() * 6) + 10;
        bubble.splashParticles = [];
        for (let i = 0; i < numSplashes; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 50 + 50;
            const length = Math.random() * 10 + 5;
            bubble.splashParticles.push({ angle, speed, length });
        }
    }

    // Click handler: bursts bubbles AND tracks bubble-clicks for activation
    let activationClicks = [];
    const clickHandler = (event) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        // Collect all bubbles at click position (overlapping bubbles all qualify)
        const clickedBubbles = [];
        for (const bubble of bubbles) {
            const dx = clickX - bubble.x;
            const dy = clickY - bubble.y;
            if (Math.sqrt(dx * dx + dy * dy) <= bubble.radius && !bubble.bursting) {
                clickedBubbles.push(bubble);
            }
        }
        if (clickedBubbles.length === 0) return;

        if (!orbsActive || !isDarkTheme) {
            // Solo mode or light theme: burst every bubble at the click position
            for (const b of clickedBubbles) {
                burstBubble(b);
                if (orbsActive && !simIsLeader) {
                    const idx = bubbles.indexOf(b);
                    if (idx >= 0 && simEventsChannel) {
                        try {
                            simEventsChannel.postMessage({ type: 'burst', bubbleIndex: idx });
                        } catch (e) {}
                    }
                }
            }
        } else if (simIsLeader) {
            // Dark theme + leader: mark only the topmost bubble as a target
            const b = clickedBubbles[0];
            b.priorityTargeted = true;
            b.targetingProgress = 1;
        } else {
            // Dark theme + follower: forward only one click to the leader
            const b = clickedBubbles[0];
            const idx = bubbles.indexOf(b);
            if (idx >= 0 && simEventsChannel) {
                try {
                    simEventsChannel.postMessage({ type: 'click', bubbleIndex: idx });
                } catch (e) {}
                b.targetingProgress = 1;
            }
        }

        // Track for activation: 3 bubble clicks within 3 seconds enables orbs
        if (!orbsActive && orbsFeatureSupported()) {
            const now = Date.now();
            activationClicks.push(now);
            activationClicks = activationClicks.filter(t => now - t <= 3000);
            if (activationClicks.length >= 3) {
                activateOrbs();
            }
        }
    };
    canvas.addEventListener('click', clickHandler);

    for (let i = 0; i < linesNum; i += 1) {
        const line = new Line(ctx, X, Y, rand(0, X), rand(0, Y), lineColor);
        lines.push(line);
    }

    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 0, -1.5, 0, outerSegmentColor,
    ));
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 90, -1.5, 0, outerSegmentColor,
    ));
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 180, -1.5, 0, outerSegmentColor,
    ));
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 2.65, lw * 9, 270, -1.5, 0, outerSegmentColor,
    ));
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 45, 1.5, 2, innnerSegmentColor,
    ));
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 135, 1.5, 2, innnerSegmentColor,
    ));
    segments.push(new Segment(
        ctx, X, Y, centerX, centerY, radius, radius * 1.45, lw * 8, 225, 1.5, 2, innnerSegmentColor,
    ));

    let lastRenderTime = 0;
    let cancelled = false;
    let rafId = null;

    function isCanvasVisible() {
        return !(canvas.offsetParent === null);
    }

    function render(currentTime) {
        if (cancelled || X <= 1) {
            return;
        }

        const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;

        if (isCanvasVisible()) {
            ctx.clearRect(0, 0, X, Y);

            // Uncomment the following if you wish to render lines when not dark.
            // for (let i = 0; i < lines.length; i += 1) {
            //     lines[i].render(secondsSinceLastRender);
            // }

            // Segments are decorative, run independently per tab.
            for (let i = 0; i < segments.length; i += 1) {
                segments[i].render(secondsSinceLastRender);
            }

            if (!orbsActive) {
                // Solo mode: just bubbles, no sync, no orbs
                for (let i = 0; i < bubbles.length; i++) {
                    bubbles[i].render(secondsSinceLastRender);
                }
            } else if (simIsLeader) {
                // Drain pending click events (target requests) from follower tabs
                while (pendingClickEvents.length > 0) {
                    const idx = pendingClickEvents.shift();
                    if (bubbles[idx] && !bubbles[idx].bursting) {
                        bubbles[idx].priorityTargeted = true;
                        bubbles[idx].targetingProgress = 1;
                    }
                }
                // Drain pending burst events (immediate burst from light-theme followers)
                while (pendingBurstEvents.length > 0) {
                    const idx = pendingBurstEvents.shift();
                    if (bubbles[idx]) burstBubble(bubbles[idx]);
                }

                // Leader: run physics + broadcast state
                for (let i = 0; i < bubbles.length; i++) {
                    bubbles[i].render(secondsSinceLastRender);
                }
                if (isDarkTheme && orbs) {
                    for (let i = 0; i < orbs.length; i++) {
                        orbs[i].render(secondsSinceLastRender, bubbles, claimed, onBurst);
                    }
                }
                if (simChannel) {
                    try {
                        simChannel.postMessage(serializeSimState(bubbles, orbs || [], X, Y));
                    } catch (e) {}
                }
            } else {
                // Follower: apply received state, render only
                applySimState(bubbles, orbs || [], simReceivedState, X, Y);
                for (let i = 0; i < bubbles.length; i++) {
                    bubbles[i].draw();
                }
                if (isDarkTheme && orbs) {
                    for (let i = 0; i < orbs.length; i++) {
                        orbs[i].draw();
                    }
                }
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
        window.removeEventListener('storage', storageHandler);
        window.removeEventListener('cf-orbs-deactivated', deactivateHandler);
    };
}

// --- Cross-tab simulation sync ---
const ORBS_ENABLED_KEY = 'cf-orbs-enabled';

function orbsFeatureSupported() {
    if (typeof window === 'undefined') return false;
    if (typeof BroadcastChannel === 'undefined') return false;
    if (typeof navigator === 'undefined' || !navigator.locks) return false;
    return true;
}

function orbsEnabled() {
    if (!orbsFeatureSupported()) return false;
    try {
        // Default to enabled unless the user explicitly stopped it
        return localStorage.getItem(ORBS_ENABLED_KEY) !== 'false';
    } catch (e) {
        return false;
    }
}

let simChannel = null;
let simEventsChannel = null;
let simIsLeader = true; // default true if no lock API
let simReceivedState = null;
let simSetupDone = false;
const pendingClickEvents = [];
const pendingBurstEvents = [];

function setupSimSync() {
    if (simSetupDone) return;
    simSetupDone = true;
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined') {
        try {
            simChannel = new BroadcastChannel('cf-sim-state');
            simChannel.onmessage = (event) => {
                simReceivedState = event.data;
            };
        } catch (e) {}
        try {
            simEventsChannel = new BroadcastChannel('cf-sim-events');
            simEventsChannel.onmessage = (event) => {
                const data = event.data;
                if (data && data.type === 'click' && typeof data.bubbleIndex === 'number') {
                    pendingClickEvents.push(data.bubbleIndex);
                } else if (data && data.type === 'burst' && typeof data.bubbleIndex === 'number') {
                    pendingBurstEvents.push(data.bubbleIndex);
                }
            };
        } catch (e) {}
    }

    if (typeof navigator !== 'undefined' && navigator.locks) {
        simIsLeader = false;
        navigator.locks.request('cf-sim-leader', () => {
            simIsLeader = true;
            // Hold lock until tab closes
            return new Promise(() => {});
        }).catch(() => {
            simIsLeader = true;
        });
    }
}

function serializeSimState(bubbles, orbs, w, h) {
    return {
        bubbles: bubbles.map(b => ({
            x: b.x / w,
            y: b.y / h,
            radius: b.radius / w,
            alpha: b.alpha,
            pulse: b.pulse,
            appearProgress: b.appearProgress,
            bursting: b.bursting,
            burstProgress: b.burstProgress,
            splashParticles: b.bursting ? b.splashParticles : null,
            targetingProgress: b.targetingProgress,
        })),
        orbs: orbs.map(o => ({
            x: o.x / w,
            y: o.y / h,
            radius: o.radius / w,
            pulse: o.pulse,
            visible: !!o.target,
            sparkleProgress: o.sparkleProgress,
            sparkles: o.sparkleProgress > 0 ? o.sparkles : null,
            sparkleX: o.sparkleX / w,
            sparkleY: o.sparkleY / h,
        })),
    };
}

function applySimState(bubbles, orbs, state, w, h) {
    if (!state) return;
    if (state.bubbles && state.bubbles.length === bubbles.length) {
        for (let i = 0; i < bubbles.length; i++) {
            const s = state.bubbles[i];
            const b = bubbles[i];
            b.x = s.x * w;
            b.y = s.y * h;
            b.radius = s.radius * w;
            b.alpha = s.alpha;
            b.pulse = s.pulse;
            b.appearProgress = s.appearProgress;
            b.bursting = s.bursting;
            b.burstProgress = s.burstProgress;
            if (s.bursting && s.splashParticles) {
                b.splashParticles = s.splashParticles;
            }
            b.targetingProgress = s.targetingProgress || 0;
        }
    }
    if (state.orbs && state.orbs.length === orbs.length) {
        for (let i = 0; i < orbs.length; i++) {
            const s = state.orbs[i];
            const o = orbs[i];
            o.x = s.x * w;
            o.y = s.y * h;
            o.radius = s.radius * w;
            o.pulse = s.pulse;
            o.remoteVisible = !!s.visible;
            o.sparkleProgress = s.sparkleProgress;
            if (s.sparkleProgress > 0 && s.sparkles) {
                o.sparkles = s.sparkles;
            }
            o.sparkleX = (s.sparkleX || 0) * w;
            o.sparkleY = (s.sparkleY || 0) * h;
            // Trail computed locally only when orb is visible
            if (o.remoteVisible) {
                o.trail.push({ x: o.x, y: o.y });
                if (o.trail.length > o.maxTrail) o.trail.shift();
            } else {
                o.trail = [];
            }
        }
    }
}

let observer;
if (global.window || (process && process.browser)) {
    // Need to handle theme switch.
    observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type == "attributes") {
                window.dispatchEvent(new Event('resized'));
            }
        });
    });
    const element = document.querySelector('html');
    observer.observe(element, {
        attributes: true
    });
}

const Logo = (props) => {
    const [scale, setScale] = React.useState({ x: 1, y: 1 });
    const canvas = React.useRef(null);

    const calculateScaleX = () => (!canvas.current ? 0 : canvas.current.clientWidth);
    const calculateScaleY = () => (!canvas.current ? 0 : canvas.current.clientHeight);

    const resized = () => {
        if (canvas.current === null) {
            return;
        }
        const newW = canvas.current.clientWidth;
        const newH = canvas.current.clientHeight;
        canvas.current.width = newW;
        canvas.current.height = newH;
        setScale(prev => (prev.x === newW && prev.y === newH) ? prev : { x: newW, y: newH });
    };

    React.useEffect(() => resized(), []);

    if (global.window || (process && process.browser)) {
        React.useEffect(() => {
            window.addEventListener("resize", resized);
            return () => window.removeEventListener("resize", resized);
        });
        React.useEffect(() => {
            window.addEventListener("resized", resized);
            return () => window.removeEventListener("resized", resized);
        });
    }

    React.useEffect(() => {
        const cleanup = draw(canvas.current, scale.x, scale.y, props.isDarkTheme);
        return cleanup;
    }, [scale.x, scale.y, props.isDarkTheme]);

    return <canvas ref={canvas} style={{ width: "100%", height: "100%" }} />;
}

export default Logo;
