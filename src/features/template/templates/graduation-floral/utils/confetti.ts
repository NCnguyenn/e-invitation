import confetti from 'canvas-confetti';

export const triggerPoeticConfetti = () => {
  // Soft pastel petal shower
  confetti({
    particleCount: 65,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#FDA4AF', '#F472B6', '#DDA7A5', '#FFF0F5', '#FDE047'],
    ticks: 250,
    gravity: 0.8,
    scalar: 1.1,
    shapes: ['circle'],
  });

  setTimeout(() => {
    confetti({
      particleCount: 45,
      angle: 60,
      spread: 60,
      origin: { x: 0.1, y: 0.7 },
      colors: ['#FBCFE8', '#FDA4AF', '#FDF2F8', '#DDA7A5'],
      gravity: 0.7,
      scalar: 1.2,
    });
    confetti({
      particleCount: 45,
      angle: 120,
      spread: 60,
      origin: { x: 0.9, y: 0.7 },
      colors: ['#FBCFE8', '#FDA4AF', '#FDF2F8', '#DDA7A5'],
      gravity: 0.7,
      scalar: 1.2,
    });
  }, 250);
};

export const triggerGrandOpeningConfetti = () => {
  // Center radiant gold & rose burst
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#FFD700', '#F59E0B', '#FDA4AF', '#F472B6', '#FFF0F5', '#E3C18D'],
    ticks: 300,
    gravity: 0.75,
    scalar: 1.25,
    shapes: ['circle', 'square'],
  });

  // Left cannon
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 55,
      spread: 70,
      origin: { x: 0, y: 0.75 },
      colors: ['#F43F5E', '#FDA4AF', '#FDE047', '#DDA7A5', '#FFF9ED'],
      ticks: 280,
      gravity: 0.8,
      scalar: 1.15,
    });
  }, 180);

  // Right cannon
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 125,
      spread: 70,
      origin: { x: 1, y: 0.75 },
      colors: ['#F43F5E', '#FDA4AF', '#FDE047', '#DDA7A5', '#FFF9ED'],
      ticks: 280,
      gravity: 0.8,
      scalar: 1.15,
    });
  }, 280);

  // Cascading golden glitter rain
  setTimeout(() => {
    confetti({
      particleCount: 70,
      spread: 120,
      origin: { x: 0.5, y: 0.2 },
      colors: ['#FDE047', '#F59E0B', '#FBCFE8', '#FFE4E8', '#DDA7A5'],
      ticks: 350,
      gravity: 0.6,
      scalar: 1.3,
      shapes: ['circle'],
    });
  }, 500);
};

// Backward compatibility alias
export const triggerCyberConfetti = triggerPoeticConfetti;

