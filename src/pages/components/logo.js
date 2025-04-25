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
            gradient.addColorStop(0.6, 'rgba(255, 199, 199, 0.29)');
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
                    ctx.fillStyle = 'rgb(247, 76, 76)';
                }
                ctx.beginPath();
                ctx.arc(splashX, splashY, 0.1*splashRadius, 0, Math.PI * 2);
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

function drawBranch(ctx, startX, startY, endX, endY, thickness) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = '#F6CFC7';
    ctx.stroke();

    // Create a gradient for the glow effect.
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, '#F60809');
    gradient.addColorStop(1, '#F6B9BD');
    
    // Draw the glow.
    ctx.strokeStyle = gradient;
    ctx.lineWidth = thickness;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'red';
    ctx.stroke();
}

function drawLightning(ctx, X, Y) {
    const startX = X / 2 + (0.5 - Math.random()) * 30;
    const startY = Y / 2 + (0.5 - Math.random()) * 30;
    const numSegments = Math.floor(Math.random() * 10) + 2;
    let currentX = startX;
    let currentY = startY;

    const initialAngle = Math.random() * Math.PI * 2;  // Random initial angle

    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < numSegments; i++) {
        const segmentLength = Math.random() * 10;
        const angle = initialAngle + (Math.random() - 0.5) * Math.PI / 3;
        const endX = currentX + Math.cos(angle) * segmentLength;
        const endY = currentY + Math.sin(angle) * segmentLength;

        drawBranch(ctx, currentX, currentY, endX, endY, 3);

        // Branching.
        if (Math.random() > 0.7) {
            drawBranch(ctx, currentX, currentY, currentX + Math.cos(angle + Math.PI / 4) * segmentLength, currentY + Math.sin(angle + Math.PI / 4) * segmentLength, 3);
        }
        if (Math.random() > 0.7) {
            drawBranch(ctx, currentX, currentY, currentX + Math.cos(angle - Math.PI / 4) * segmentLength, currentY + Math.sin(angle - Math.PI / 4) * segmentLength, 3);
        }
        if (Math.random() > 0.7) {
            drawBranch(ctx, currentX, currentY, currentX + Math.cos(angle - Math.PI / 4) * segmentLength, currentY + Math.sin(angle - Math.PI / 4) * segmentLength, 3);
        }

        currentX = endX;
        currentY = endY;
    }

    ctx.globalCompositeOperation = 'source-over';
}

function draw(canvas, X, Y, isDarkTheme) {
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
    
    // --- New: Burst only the bubble clicked ---
    canvas.addEventListener('click', (event) => {
        console.log(1)
        // Get the click coordinates relative to the canvas.
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        bubbles.forEach(bubble => {
            // Check if the click is inside the bubble.
            const dx = clickX - bubble.x;
            const dy = clickY - bubble.y;
            if (Math.sqrt(dx * dx + dy * dy) <= bubble.radius) {
                if (!bubble.bursting) {
                    bubble.bursting = true;
                    bubble.burstProgress = 0;
                    let numSplashes = Math.floor(Math.random() * 6) + 10;
                    bubble.splashParticles = [];
                    for (let i = 0; i < numSplashes; i++) {
                        let angle = Math.random() * Math.PI * 2;
                        let speed = Math.random() * 50 + 50;
                        let length = Math.random() * 10 + 5;
                        bubble.splashParticles.push({ angle, speed, length });
                    }
                }
            }
        });
    });
    // --- End new code ---

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
    const useLightnings = localStorage.getItem("lights") == "up";

    function isCanvasVisible() {
        return !(canvas.offsetParent === null);
    }

    function render(currentTime) {
        if (X <= 1) {
            return;
        }

        const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;

        if (isCanvasVisible()) {
            ctx.clearRect(0, 0, X, Y);

            // Uncomment the following if you wish to render lines when not dark.
            // for (let i = 0; i < lines.length; i += 1) {
            //     lines[i].render(secondsSinceLastRender);
            // }

            for (let i = 0; i < segments.length; i += 1) {
                segments[i].render(secondsSinceLastRender);
            }

            // Render bubbles.
            for (let i = 0; i < bubbles.length; i++) {
                bubbles[i].render(secondsSinceLastRender);
            }

            if (isDarkTheme && useLightnings && X > 1280) {
                if (Math.random() > 0.95) {
                    drawLightning(ctx, X, Y);
                }
                ctx.shadowBlur = 100;
            } else {
                ctx.shadowBlur = 0;
            }
        }

        lastRenderTime = currentTime;
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
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
        canvas.current.width = canvas.current.clientWidth;
        canvas.current.height = canvas.current.clientHeight;
        setScale({ x: calculateScaleX(), y: calculateScaleY() });
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
        draw(canvas.current, scale.x, scale.y, props.isDarkTheme);
    }, [scale]);

    return <canvas ref={canvas} style={{ width: "100%", height: "100%" }} />;
}

export default Logo;
