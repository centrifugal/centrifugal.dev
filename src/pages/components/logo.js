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

    function render(currentTime) {
        const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000

        ctx.clearRect(0, 0, X, Y);

        for (let i = 0; i < lines.length; i += 1) {
            lines[i].render(secondsSinceLastRender);
        }
        for (let i = 0; i < segments.length; i += 1) {
            segments[i].render(secondsSinceLastRender);
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
