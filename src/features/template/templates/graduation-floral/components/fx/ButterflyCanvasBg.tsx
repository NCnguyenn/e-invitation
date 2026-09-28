import React, { useEffect, useRef } from 'react';
import { useConfig } from '../../context/ConfigContext';

interface Petal {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  color: string;
  wobble: number;
  wobbleSpeed: number;
}

interface Butterfly {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  angle: number;
  flapPhase: number;
  flapSpeed: number;
  color: string;
  wingColor: string;
}

interface SwarmButterfly {
  x: number;
  y: number;
  size: number;
  speed: number;
  baseAngle: number;
  currentAngle: number;
  flapPhase: number;
  flapSpeed: number;
  bodyColor: string;
  wingColor: string;
  accentColor: string;
  curveOffset: number;
  curveSpeed: number;
  age: number;
  maxAge: number;
  alpha: number;
}

interface FairyDust {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
}

export const ButterflyCanvasBg: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { particlesEnabled } = useConfig();

  useEffect(() => {
    if (!particlesEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Rose & Cherry Blossom Petal palette
    const petalColors = [
      'rgba(253, 164, 175, 0.75)',
      'rgba(251, 113, 133, 0.65)',
      'rgba(244, 114, 182, 0.6)',
      'rgba(221, 167, 165, 0.7)',
      'rgba(255, 228, 230, 0.85)',
    ];

    const petalCount = width < 768 ? 18 : 32;
    const petals: Petal[] = [];

    for (let i = 0; i < petalCount; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 8 + 6,
        speedX: Math.random() * 0.8 + 0.2,
        speedY: Math.random() * 0.9 + 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        opacity: Math.random() * 0.4 + 0.5,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.01,
      });
    }

    // Ambient Butterflies
    const ambientCount = width < 768 ? 3 : 5;
    const ambientButterflies: Butterfly[] = [];

    const butterflyTints = [
      { body: '#8E5D67', wing: 'rgba(253, 164, 175, 0.85)' },
      { body: '#6B4F55', wing: 'rgba(221, 167, 165, 0.85)' },
      { body: '#7D5260', wing: 'rgba(244, 114, 182, 0.8)' },
      { body: '#8C6D73', wing: 'rgba(254, 205, 211, 0.9)' },
    ];

    for (let i = 0; i < ambientCount; i++) {
      const tint = butterflyTints[Math.floor(Math.random() * butterflyTints.length)];
      ambientButterflies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 6 + 10,
        speedX: Math.random() * 1.2 + 0.5,
        speedY: (Math.random() - 0.5) * 0.8,
        angle: 0,
        flapPhase: Math.random() * Math.PI,
        flapSpeed: Math.random() * 0.15 + 0.12,
        color: tint.body,
        wingColor: tint.wing,
      });
    }

    // Interactive Swarm Butterflies & Fairy Dust
    const swarmButterflies: SwarmButterfly[] = [];
    const fairyDust: FairyDust[] = [];

    const swarmPalettes = [
      { body: '#5C2D38', wing: 'rgba(255, 140, 165, 0.95)', accent: 'rgba(255, 230, 240, 0.9)' },
      { body: '#6B3A45', wing: 'rgba(244, 114, 182, 0.95)', accent: 'rgba(254, 205, 211, 0.95)' },
      { body: '#7C3AED', wing: 'rgba(216, 180, 254, 0.95)', accent: 'rgba(255, 255, 255, 0.9)' },
      { body: '#B45309', wing: 'rgba(253, 186, 116, 0.95)', accent: 'rgba(254, 240, 138, 0.95)' },
      { body: '#831843', wing: 'rgba(251, 113, 133, 0.95)', accent: 'rgba(255, 228, 230, 0.95)' },
      { body: '#5B21B6', wing: 'rgba(196, 181, 253, 0.95)', accent: 'rgba(255, 255, 255, 0.9)' },
    ];

    const handleFlockEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ originX?: number; originY?: number; count?: number }>;
      const originX = customEvent.detail?.originX ?? 70;
      const originY = customEvent.detail?.originY ?? height - 70;
      const count = customEvent.detail?.count ?? 26;

      for (let i = 0; i < count; i++) {
        const palette = swarmPalettes[Math.floor(Math.random() * swarmPalettes.length)];
        // Upward & rightward diagonal arc trajectories
        const baseAngle = -Math.PI / 4 + (Math.random() - 0.4) * 0.9;
        const speed = Math.random() * 3 + 3.2;

        swarmButterflies.push({
          x: originX + (Math.random() - 0.5) * 30,
          y: originY + (Math.random() - 0.5) * 30,
          size: Math.random() * 8 + 12,
          speed,
          baseAngle,
          currentAngle: baseAngle,
          flapPhase: Math.random() * Math.PI,
          flapSpeed: Math.random() * 0.18 + 0.22,
          bodyColor: palette.body,
          wingColor: palette.wing,
          accentColor: palette.accent,
          curveOffset: Math.random() * Math.PI * 2,
          curveSpeed: Math.random() * 0.05 + 0.03,
          age: 0,
          maxAge: Math.random() * 200 + 260,
          alpha: 1,
        });
      }
    };

    window.addEventListener('burst-butterflies', handleFlockEvent);

    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-p.size / 2, -p.size, -p.size, -p.size * 1.5, 0, -p.size * 2);
      ctx.bezierCurveTo(p.size, -p.size * 1.5, p.size / 2, -p.size, 0, 0);

      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.restore();
    };

    const drawSwarmButterfly = (b: SwarmButterfly) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.currentAngle);

      const flapScale = Math.sin(b.flapPhase);

      ctx.globalAlpha = b.alpha;

      // Glow halo around magical butterflies
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.wingColor;

      // Left Wings
      ctx.save();
      ctx.scale(flapScale, 1);

      // Upper Left Wing
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-b.size * 1.8, -b.size * 1.6, -b.size * 1.8, b.size * 0.2, 0, b.size * 0.3);
      ctx.fillStyle = b.wingColor;
      ctx.fill();

      // Wing Pattern Decor
      ctx.beginPath();
      ctx.arc(-b.size * 0.8, -b.size * 0.7, b.size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = b.accentColor;
      ctx.fill();

      // Lower Left Wing
      ctx.beginPath();
      ctx.moveTo(0, b.size * 0.1);
      ctx.bezierCurveTo(-b.size * 1.3, b.size * 0.3, -b.size * 1.1, b.size * 1.1, 0, b.size * 0.8);
      ctx.fillStyle = b.wingColor;
      ctx.fill();
      ctx.restore();

      // Right Wings
      ctx.save();
      ctx.scale(-flapScale, 1);

      // Upper Right Wing
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-b.size * 1.8, -b.size * 1.6, -b.size * 1.8, b.size * 0.2, 0, b.size * 0.3);
      ctx.fillStyle = b.wingColor;
      ctx.fill();

      // Wing Pattern Decor
      ctx.beginPath();
      ctx.arc(-b.size * 0.8, -b.size * 0.7, b.size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = b.accentColor;
      ctx.fill();

      // Lower Right Wing
      ctx.beginPath();
      ctx.moveTo(0, b.size * 0.1);
      ctx.bezierCurveTo(-b.size * 1.3, b.size * 0.3, -b.size * 1.1, b.size * 1.1, 0, b.size * 0.8);
      ctx.fillStyle = b.wingColor;
      ctx.fill();
      ctx.restore();

      // Body
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(0, b.size * 0.2, 1.8, b.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.bodyColor;
      ctx.fill();

      // Antennae
      ctx.strokeStyle = b.bodyColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-1, -b.size * 0.2);
      ctx.quadraticCurveTo(-b.size * 0.4, -b.size * 0.6, -b.size * 0.5, -b.size * 0.7);
      ctx.moveTo(1, -b.size * 0.2);
      ctx.quadraticCurveTo(b.size * 0.4, -b.size * 0.6, b.size * 0.5, -b.size * 0.7);
      ctx.stroke();

      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Render Petals
      petals.forEach((p) => {
        p.wobble += p.wobbleSpeed;
        p.x += p.speedX + Math.sin(p.wobble) * 0.6;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        if (p.x > width + 20) p.x = -20;

        drawPetal(p);
      });

      // 2. Render Fairy Dust Sparkles
      for (let i = fairyDust.length - 1; i >= 0; i--) {
        const d = fairyDust[i];
        d.x += d.speedX;
        d.y += d.speedY;
        d.opacity -= 0.015;

        if (d.opacity <= 0) {
          fairyDust.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = d.opacity;
        ctx.shadowBlur = 6;
        ctx.shadowColor = d.color;
        ctx.fill();
        ctx.restore();
      }

      // 3. Render Ambient Butterflies
      ambientButterflies.forEach((b) => {
        b.flapPhase += b.flapSpeed;
        b.x += b.speedX;
        b.y += b.speedY + Math.sin(b.flapPhase * 0.5) * 0.7;
        b.angle = Math.atan2(b.speedY + Math.sin(b.flapPhase * 0.5) * 0.7, b.speedX);

        if (b.x > width + 40) {
          b.x = -40;
          b.y = Math.random() * (height * 0.8);
        }
        if (b.y < -20) b.y = height + 10;
        if (b.y > height + 20) b.y = -10;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        const flapScale = Math.sin(b.flapPhase);
        ctx.globalAlpha = 0.8;

        ctx.save();
        ctx.scale(flapScale, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-b.size * 1.5, -b.size * 1.2, -b.size * 1.8, b.size * 0.2, -b.size * 0.2, b.size * 0.8);
        ctx.fillStyle = b.wingColor;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.scale(-flapScale, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-b.size * 1.5, -b.size * 1.2, -b.size * 1.8, b.size * 0.2, -b.size * 0.2, b.size * 0.8);
        ctx.fillStyle = b.wingColor;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.ellipse(0, 0, 1.5, b.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.restore();
      });

      // 4. Render Swarm Butterflies (Flock Triggered by Blossom Button)
      for (let i = swarmButterflies.length - 1; i >= 0; i--) {
        const sb = swarmButterflies[i];
        sb.age++;
        sb.curveOffset += sb.curveSpeed;
        sb.flapPhase += sb.flapSpeed;

        // Wave trajectory
        const sway = Math.sin(sb.curveOffset) * 1.8;
        const vx = Math.cos(sb.baseAngle) * sb.speed + Math.cos(sb.curveOffset) * 0.8;
        const vy = Math.sin(sb.baseAngle) * sb.speed + sway;

        sb.x += vx;
        sb.y += vy;
        sb.currentAngle = Math.atan2(vy, vx);

        // Spawn magical fairy dust
        if (Math.random() < 0.35) {
          fairyDust.push({
            x: sb.x,
            y: sb.y,
            size: Math.random() * 2 + 1,
            speedX: (Math.random() - 0.5) * 0.8,
            speedY: Math.random() * 0.8 + 0.4,
            opacity: 0.9,
            color: Math.random() > 0.5 ? '#FBCFE8' : '#FDE047',
          });
        }

        // Fade out as it nears end of flight or off screen
        if (sb.age > sb.maxAge - 60) {
          sb.alpha = Math.max(0, (sb.maxAge - sb.age) / 60);
        }

        if (sb.age >= sb.maxAge || sb.x > width + 80 || sb.y < -80) {
          swarmButterflies.splice(i, 1);
          continue;
        }

        drawSwarmButterfly(sb);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('burst-butterflies', handleFlockEvent);
      cancelAnimationFrame(animationFrameId);
    };
  }, [particlesEnabled]);

  if (!particlesEnabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10 opacity-90"
    />
  );
};
