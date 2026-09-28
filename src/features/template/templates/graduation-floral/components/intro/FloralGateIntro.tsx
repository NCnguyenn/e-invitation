import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Music, Heart, Calendar, MapPin, ChevronRight, Volume2 } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { triggerGrandOpeningConfetti, triggerPoeticConfetti } from '../../utils/confetti';
import { triggerButterflyFlock } from '../../utils/butterflies';

// Reusable Gold Filigree Corner Ornament
const FiligreeCorner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-8 h-8 sm:w-10 sm:h-10 text-amber-300/80 pointer-events-none drop-shadow-[0_1px_3px_rgba(217,119,6,0.3)] ${className}`}
  >
    <path
      d="M2 2C14 2 24 12 24 24M2 2C2 14 12 24 24 24M2 2L16 16M2 8C8 8 14 14 14 20M8 2C8 8 14 14 20 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="6" cy="6" r="2" fill="currentColor" opacity="0.9" />
    <circle cx="18" cy="18" r="1.5" fill="currentColor" opacity="0.7" />
    <path
      d="M2 20C4 28 10 36 20 40M20 2C28 4 36 10 40 20"
      stroke="currentColor"
      strokeWidth="1"
      strokeDasharray="2 2"
      opacity="0.6"
    />
  </svg>
);

// Reusable Royal Wax Seal Component with Detailed 3D Relief & Ribbon
const RoyalWaxSeal: React.FC<{
  isBreaking: boolean;
  onClick: () => void;
}> = ({ isBreaking, onClick }) => {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="relative cursor-pointer group select-none"
    >
      {/* Radiant Glowing Pulsing Rings */}
      <div className="absolute -inset-6 sm:-inset-8 bg-gradient-to-r from-amber-400/50 via-rose-500/50 to-pink-400/50 rounded-full blur-2xl animate-pulse-soft pointer-events-none" />
      <div className="absolute -inset-3 rounded-full border-2 border-amber-300/70 animate-ping opacity-40 pointer-events-none" />

      {/* Ribbon tails hanging below seal */}
      <div className="absolute -bottom-5 sm:-bottom-7 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 pointer-events-none z-0">
        <div className="w-2.5 sm:w-3.5 h-6 sm:h-8 bg-gradient-to-b from-[#B82E45] to-[#781424] -rotate-12 rounded-b-xs shadow-md border-r border-amber-300/40" />
        <div className="w-2.5 sm:w-3.5 h-6 sm:h-8 bg-gradient-to-b from-[#B82E45] to-[#781424] rotate-12 rounded-b-xs shadow-md border-l border-amber-300/40" />
      </div>

      {/* Main 3D Wax Seal Body */}
      <motion.div
        animate={isBreaking ? { scale: 1.3, opacity: 0, filter: 'brightness(2)' } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#C5304B] via-[#941C32] to-[#590C1A] border-2 border-amber-200/90 shadow-[0_12px_28px_rgba(89,12,26,0.65),inset_0_2px_4px_rgba(255,255,255,0.45),inset_0_-4px_8px_rgba(0,0,0,0.6)] flex items-center justify-center p-1.5 transition-shadow duration-300 group-hover:shadow-[0_16px_36px_rgba(225,29,72,0.7),inset_0_3px_6px_rgba(255,255,255,0.6)]"
      >
        {/* Irregular Wax Rim Border Details */}
        <div className="absolute inset-1 rounded-full border border-amber-300/50 opacity-80" />
        <div className="absolute inset-1.5 rounded-full border border-dashed border-amber-200/60 opacity-70" />

        {/* Inner Golden Monogram Crest */}
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#781424] to-[#A32238] border border-amber-300/80 shadow-inner flex flex-col items-center justify-center text-center">
          <span className="text-xl sm:text-2xl filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] animate-bounce">
            🌸
          </span>
          <span className="font-serif italic font-bold text-[9px] sm:text-[10px] tracking-widest text-amber-200 uppercase drop-shadow">
            MỞ THIỆP
          </span>
        </div>

        {/* Shimmer Light Flash Sweep */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
      </motion.div>
    </motion.div>
  );
};

// Canvas with Both Twinkling Stars AND Falling Rose Petals
const DreamyAtmosphereCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Stardust Particles
    const stars: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      alpha: number;
      alphaSpeed: number;
      color: string;
    }> = [];

    const starColors = ['#FDE047', '#FDA4AF', '#FBCFE8', '#FFF9ED', '#E3C18D'];
    const starCount = width < 768 ? 45 : 85;

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.6 + 0.8,
        speedY: -(Math.random() * 0.35 + 0.1),
        speedX: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.8 + 0.2,
        alphaSpeed: (Math.random() * 0.018 + 0.006) * (Math.random() > 0.5 ? 1 : -1),
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }

    // Drifting Rose Petals in Slow Motion
    const petals: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      rotation: number;
      rotSpeed: number;
      wobble: number;
      wobbleSpeed: number;
      color: string;
      alpha: number;
    }> = [];

    const petalColors = [
      'rgba(254, 205, 211, 0.85)',
      'rgba(253, 164, 175, 0.75)',
      'rgba(251, 113, 133, 0.7)',
      'rgba(244, 114, 182, 0.65)',
      'rgba(225, 29, 72, 0.55)',
    ];
    const petalCount = width < 768 ? 16 : 28;

    for (let i = 0; i < petalCount; i++) {
      petals.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 7 + 6,
        speedY: Math.random() * 0.65 + 0.35,
        speedX: (Math.random() - 0.5) * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.018 + 0.008,
        color: petalColors[Math.floor(Math.random() * petalColors.length)],
        alpha: Math.random() * 0.4 + 0.5,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Render Floating Stars
      stars.forEach((s) => {
        s.y += s.speedY;
        s.x += s.speedX;
        s.alpha += s.alphaSpeed;

        if (s.alpha <= 0.15 || s.alpha >= 0.95) {
          s.alphaSpeed = -s.alphaSpeed;
        }

        if (s.y < -10) {
          s.y = height + 10;
          s.x = Math.random() * width;
        }
        if (s.x < -10) s.x = width + 10;
        if (s.x > width + 10) s.x = -10;

        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha));
        ctx.shadowBlur = s.size * 3.5;
        ctx.shadowColor = s.color;
        ctx.fill();
        ctx.restore();
      });

      // Render Floating Petals
      petals.forEach((p) => {
        p.wobble += p.wobbleSpeed;
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.wobble) * 0.7;
        p.rotation += p.rotSpeed;

        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-p.size / 2, -p.size, -p.size, -p.size * 1.4, 0, -p.size * 2);
        ctx.bezierCurveTo(p.size, -p.size * 1.4, p.size / 2, -p.size, 0, 0);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10 opacity-80" />;
};

export const FloralGateIntro: React.FC = () => {
  const { isGateOpen, openGate, config, guestName } = useConfig();
  
  // Cinematic Flow Phases:
  // 'sealed' -> 'breaking' -> 'opening_flap' -> 'revealing_card' -> 'unfolded' -> 'entering'
  const [phase, setPhase] = useState<
    'sealed' | 'breaking' | 'opening_flap' | 'revealing_card' | 'unfolded' | 'entering'
  >('sealed');
  const [isDone, setIsDone] = useState(false);

  // If already open, unmount
  if (isDone || isGateOpen) return null;

  // Cinematic Slow & Graceful Opening Sequence
  const handleStartOpening = () => {
    if (phase !== 'sealed') return;

    // Phase 1: Breaking Wax Seal & Starting Audio
    setPhase('breaking');
    openGate(); // Starts audio playback on direct user gesture
    triggerPoeticConfetti();

    // Phase 2: Slow 3D Top Flap Rotation (after 500ms)
    setTimeout(() => {
      setPhase('opening_flap');
    }, 550);

    // Phase 3: Card begins slow, majestic ascent (after 1500ms)
    setTimeout(() => {
      setPhase('revealing_card');
      triggerButterflyFlock(window.innerWidth / 2, window.innerHeight * 0.65);
    }, 1500);

    // Phase 4: Card fully unfolded & settled in center (after 3000ms)
    setTimeout(() => {
      setPhase('unfolded');
      triggerGrandOpeningConfetti();
    }, 3000);
  };

  // Graceful Transition into Website
  const handleEnterMainSpace = () => {
    if (phase === 'entering') return;
    setPhase('entering');
    triggerPoeticConfetti();
    triggerButterflyFlock(window.innerWidth / 2, window.innerHeight * 0.75);

    setTimeout(() => {
      setIsDone(true);
    }, 850);
  };

  const isFlapOpen =
    phase === 'opening_flap' ||
    phase === 'revealing_card' ||
    phase === 'unfolded' ||
    phase === 'entering';

  const isCardRevealed =
    phase === 'revealing_card' || phase === 'unfolded' || phase === 'entering';

  return (
    <AnimatePresence>
      <motion.div
        key="luxury-invitation-intro"
        initial={{ opacity: 1 }}
        animate={phase === 'entering' ? { opacity: 0, scale: 1.1, filter: 'blur(12px)' } : { opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.12, filter: 'blur(16px)' }}
        transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden select-none bg-[radial-gradient(ellipse_at_center,_#2D101E_0%,_#1C0712_55%,_#0A0207_100%)] p-3 sm:p-6"
      >
        {/* Floating Twinkling Golden Stardust & Slow Falling Petals */}
        <DreamyAtmosphereCanvas />

        {/* Ambient Dreamy Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[720px] h-[340px] sm:h-[720px] bg-gradient-to-tr from-rose-500/25 via-amber-400/30 to-pink-500/25 rounded-full blur-[110px] sm:blur-[150px] pointer-events-none" />
        <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-pink-500/18 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-amber-300/18 rounded-full blur-[110px] pointer-events-none" />

        {/* Soft Radial Grid Wallpaper Texture */}
        <div className="absolute inset-0 opacity-12 bg-[radial-gradient(#FDE047_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none" />

        {/* Quick Skip Button */}
        <button
          type="button"
          onClick={handleEnterMainSpace}
          className="fixed top-4 right-4 z-50 text-amber-200/80 hover:text-amber-100 text-[11px] sm:text-xs font-serif italic py-1.5 px-3.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-amber-300/30 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
        >
          <span>Khám phá ngay</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* =========================================================================
            3D LUXURY INVITATION CARD & ENVELOPE STAGE
            ========================================================================= */}
        <div className="relative z-20 w-full max-w-lg mx-auto flex flex-col items-center justify-center my-auto py-4 sm:py-8">
          
          {/* Top Floating Poetic Title Banner */}
          <motion.div
            initial={{ opacity: 0, y: -25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-4 sm:mb-6 px-2"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-amber-300/35 text-amber-200 text-[11px] sm:text-xs font-serif italic tracking-widest backdrop-blur-md shadow-sm mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-300 animate-spin-slow" />
              <span>THIỆP MỜI TRÂN QUÝ // POETIC INVITATION</span>
              <Sparkles className="w-3 h-3 text-amber-300 animate-spin-slow" />
            </div>
            <h1 className="font-script text-3xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-pink-200 drop-shadow-[0_2px_14px_rgba(244,114,182,0.45)]">
              {config.event.ownerName}
            </h1>
          </motion.div>

          {/* 3D Envelope & Card Scene Wrapper */}
          <div
            className="relative w-full max-w-[340px] min-[400px]:max-w-[380px] sm:max-w-[450px] md:max-w-[470px] flex items-center justify-center"
            style={{ perspective: 1400 }}
          >
            {/* =====================================================================
                ENVELOPE BACK PANEL (THE BASE CONTAINER)
                ===================================================================== */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 30 }}
              animate={{
                scale: isCardRevealed ? 0.96 : 1,
                opacity: 1,
                y: isCardRevealed ? 55 : 0,
              }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full aspect-[1.44/1] rounded-2xl sm:rounded-3xl shadow-[0_30px_70px_-15px_rgba(221,167,165,0.45),0_0_45px_rgba(253,164,175,0.3)] border-2 border-amber-200/70 bg-gradient-to-br from-[#FFF9F6] via-[#FFF2F4] to-[#FAF0EB] overflow-visible select-none"
            >
              {/* Gold Filigree Corners on Envelope Shell */}
              <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
                <FiligreeCorner />
              </div>
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 rotate-90">
                <FiligreeCorner />
              </div>
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-10 -rotate-90">
                <FiligreeCorner />
              </div>
              <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 rotate-180">
                <FiligreeCorner />
              </div>

              {/* Envelope Inside Lining Pattern (Visible inside when open) */}
              <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-[radial-gradient(#F472B6_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

              {/* Radiant Light Cone Rising from Inside Opened Envelope */}
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={isFlapOpen ? { opacity: 0.7, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{ transformOrigin: 'bottom center' }}
                className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-56 bg-gradient-to-t from-amber-300/40 via-rose-300/25 to-transparent blur-2xl pointer-events-none rounded-t-full z-15"
              />

              {/* =================================================================
                  STAGE B: INNER INVITATION CARD (SLIDES OUT SLOWLY & MAJESTICALLY)
                  ================================================================= */}
              <motion.div
                initial={{ y: 25, scale: 0.92, opacity: 0 }}
                animate={
                  !isCardRevealed
                    ? { y: 25, scale: 0.92, opacity: 0, zIndex: 12 }
                    : phase === 'revealing_card'
                    ? {
                        y: window.innerWidth < 640 ? -90 : -125,
                        scale: 1.01,
                        opacity: 1,
                        zIndex: 45,
                        rotateZ: -1,
                      }
                    : {
                        y: window.innerWidth < 640 ? -110 : -140,
                        scale: 1.03,
                        opacity: 1,
                        zIndex: 50,
                        rotateZ: 0,
                      }
                }
                transition={{
                  duration: 1.6,
                  ease: [0.16, 1, 0.3, 1], // Buttery smooth deceleration
                }}
                className="absolute left-1/2 -translate-x-1/2 top-4 w-[92%] sm:w-[94%] bg-gradient-to-b from-[#FFFDFB] via-[#FFF9F6] to-[#FFF3F5] rounded-2xl sm:rounded-3xl border-2 border-amber-200/90 shadow-[0_25px_60px_rgba(221,167,165,0.5),0_0_40px_rgba(253,164,175,0.35)] p-4 sm:p-7 flex flex-col items-center text-center overflow-hidden"
              >
                {/* Metallic Shimmer Sweep Light Beam */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-shimmer-soft" />
                </div>

                {/* Filigree Corners inside Card */}
                <div className="absolute top-2 left-2">
                  <FiligreeCorner className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="absolute top-2 right-2 rotate-90">
                  <FiligreeCorner className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="absolute bottom-2 left-2 -rotate-90">
                  <FiligreeCorner className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="absolute bottom-2 right-2 rotate-180">
                  <FiligreeCorner className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                {/* Double Inset Gold Border Line */}
                <div className="absolute inset-2 sm:inset-3 rounded-xl sm:rounded-2xl border border-rosegold/40 pointer-events-none" />

                {/* Top Badge Crest */}
                <div className="relative z-10 flex items-center gap-1.5 text-rosegold-dark mb-0.5">
                  <span className="w-6 sm:w-8 h-[1px] bg-rosegold/50" />
                  <span className="font-serif italic text-[10px] sm:text-xs tracking-[0.25em] uppercase font-semibold text-rosegold-dark">
                    LỜI MỜI THÂN THƯƠNG
                  </span>
                  <span className="w-6 sm:w-8 h-[1px] bg-rosegold/50" />
                </div>

                {/* Owner Portrait Arched Frame with Glowing Halo */}
                <div className="relative z-10 my-1.5 sm:my-2.5 group">
                  <div className="absolute -inset-2 bg-gradient-to-tr from-amber-300/50 via-rose-300/60 to-pink-300/50 rounded-full blur-md animate-pulse-soft" />
                  <div className="relative w-18 h-22 sm:w-24 sm:h-28 rounded-t-full rounded-b-2xl p-1 bg-white border-2 border-rosegold shadow-md overflow-hidden">
                    <img
                      src={config.images.heroPortrait}
                      alt={config.event.ownerName}
                      className="w-full h-full object-cover rounded-t-full rounded-b-xl"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-md border border-white">
                    ❦
                  </div>
                </div>

                {/* Main Name & Subtitle */}
                <h2 className="relative z-10 font-script text-2xl sm:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-rose-900 via-rosegold-dark to-rose-800 leading-tight">
                  {config.event.ownerName}
                </h2>
                <div className="relative z-10 font-serif italic text-[10px] sm:text-xs text-rosegold-dark/90 tracking-widest mb-1.5">
                  {config.event.subName}
                </div>

                {/* Personalized Greeting Text */}
                <div className="relative z-10 max-w-sm px-2 mb-2.5 sm:mb-3.5">
                  <p className="font-serif text-xs sm:text-sm text-poetic-text italic leading-relaxed">
                    "Trân trọng kính mời <strong className="font-bold text-rose-900 font-sans">{guestName}</strong> đến cùng dạo bước trong ngày kỷ niệm thanh xuân rực rỡ và ngập tràn sắc hoa."
                  </p>
                </div>

                {/* Ceremony Time & Venue Info Badges */}
                <div className="relative z-10 w-full flex flex-col gap-1.5 mb-3.5 sm:mb-4 px-1">
                  <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs font-serif text-rosegold-dark bg-white/85 py-1.5 px-3 rounded-full border border-rosegold/30 shadow-xs">
                    <Calendar className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                    <span>
                      {config.event.timeString} • Ngày {config.event.day} {config.event.month} {config.event.year}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-serif text-poetic-muted bg-white/75 py-1 px-3 rounded-full border border-rosegold/20">
                    <MapPin className="w-3 h-3 text-rose-500 flex-shrink-0" />
                    <span className="truncate max-w-[260px] sm:max-w-[320px]">
                      {config.event.venue.name} — {config.event.venue.subVenue}
                    </span>
                  </div>
                </div>

                {/* Prominent CTA Enter Button */}
                <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-1.5">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEnterMainSpace}
                    className="group relative w-full py-2.5 sm:py-3 px-6 rounded-full bg-gradient-to-r from-rosegold-dark via-rose-500 to-amber-500 text-white font-serif font-bold text-xs sm:text-sm tracking-widest shadow-[0_8px_25px_rgba(225,29,72,0.45)] hover:shadow-[0_12px_35px_rgba(225,29,72,0.6)] transition-all flex items-center justify-center gap-2 overflow-hidden cursor-pointer"
                  >
                    {/* Shimmer sweep */}
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                    <Heart className="w-3.5 h-3.5 fill-white text-white animate-pulse" />
                    <span className="relative z-10 uppercase tracking-widest">
                      Bước Vào Không Gian Tiệc
                    </span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </motion.button>

                  {/* Audio Status Pill */}
                  <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-serif italic text-rosegold-dark/80">
                    <Volume2 className="w-3 h-3 text-rose-500 animate-pulse" />
                    <span>
                      Đang tấu nhạc: {config.music.songTitle} - {config.music.artist}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* =================================================================
                  ENVELOPE FRONT POCKET (REALISTIC TRIANGULAR FOLDS OVER THE CARD)
                  ================================================================= */}
              <div
                className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden pointer-events-none"
                style={{ zIndex: isCardRevealed ? 20 : 25 }}
              >
                {/* Left Triangular Fold */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-[#FFF5F1] to-[#FCE6EB] border-r border-amber-200/50 shadow-md"
                  style={{
                    clipPath: 'polygon(0% 0%, 54% 50%, 0% 100%)',
                  }}
                />

                {/* Right Triangular Fold */}
                <div
                  className="absolute inset-0 bg-gradient-to-l from-[#FFF5F1] to-[#FCE6EB] border-l border-amber-200/50 shadow-md"
                  style={{
                    clipPath: 'polygon(100% 0%, 46% 50%, 100% 100%)',
                  }}
                />

                {/* Bottom Triangular Fold */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[#FAF0EB] to-[#FFF8F5] border-t-2 border-amber-200/60 shadow-[0_-5px_15px_rgba(221,167,165,0.25)]"
                  style={{
                    clipPath: 'polygon(0% 100%, 50% 38%, 100% 100%)',
                  }}
                />

                {/* Front Envelope Details (Visible when sealed) */}
                {!isCardRevealed && (
                  <div className="absolute inset-x-0 bottom-4 sm:bottom-6 flex flex-col items-center justify-center text-center px-4 z-10">
                    <div className="w-full max-w-[80%] border-t border-b border-rosegold/35 py-1.5 sm:py-2">
                      <div className="font-serif italic text-[10px] sm:text-xs text-rosegold-dark tracking-[0.25em] uppercase mb-0.5">
                        {config.event.inviteGreeting || 'TRÂN TRỌNG KÍNH MỜI'}
                      </div>
                      <div className="font-display font-bold text-lg sm:text-2xl text-poetic-text tracking-wide drop-shadow-sm">
                        {guestName}
                      </div>
                      <div className="font-serif italic text-[9px] sm:text-[11px] text-poetic-muted tracking-wider mt-0.5">
                        {config.event.badgeBottom || 'Ngày Chung Đôi Rạng Rỡ'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Golden Silk Ribbon Tied Across the Envelope */}
              <motion.div
                initial={{ opacity: 1, scaleX: 1 }}
                animate={
                  phase === 'sealed'
                    ? { opacity: 1, scaleX: 1 }
                    : { opacity: 0, scaleX: 1.2, filter: 'blur(4px)' }
                }
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ zIndex: 28 }}
                className="absolute top-[48%] -translate-y-1/2 left-0 right-0 h-8 sm:h-9 bg-gradient-to-r from-amber-400/90 via-amber-200 to-amber-400/90 border-t border-b border-amber-500/50 shadow-sm flex items-center justify-between px-3 pointer-events-none"
              >
                <div className="w-full border-t border-dashed border-amber-600/30" />
              </motion.div>

              {/* Vintage Postal Stamp at Top Right (Outside Pocket) */}
              <div
                style={{ zIndex: 26 }}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col items-center justify-center p-1.5 sm:p-2 border-2 border-dashed border-amber-400/70 rounded-lg bg-amber-50/85 shadow-sm rotate-2 pointer-events-none"
              >
                <span className="text-sm sm:text-base">💐</span>
                <span className="text-[8px] sm:text-[9px] font-serif font-bold text-rosegold-dark tracking-tighter">
                  POST 2026
                </span>
              </div>

              {/* =================================================================
                  3D TOP TRIANGULAR FLAP WITH WAX SEAL (SLOW 3D ROTATION)
                  ================================================================= */}
              <motion.div
                initial={{ rotateX: 0 }}
                animate={{
                  rotateX: isFlapOpen ? -180 : 0,
                  zIndex: isFlapOpen ? 8 : 32,
                }}
                transition={{
                  duration: 1.35, // Deliberate, graceful 3D unfolding
                  ease: [0.22, 1, 0.36, 1], // Silky smooth deceleration curve
                }}
                style={{
                  transformOrigin: 'top center',
                  transformStyle: 'preserve-3d',
                }}
                className="absolute top-0 left-0 right-0 h-[62%] rounded-t-2xl sm:rounded-t-3xl overflow-visible pointer-events-none"
              >
                {/* Front Side of the Flap */}
                <div
                  className="w-full h-full bg-gradient-to-b from-[#FFF5F1] via-[#FFEBEF] to-[#FCE2E6] border-b-2 border-amber-200/80 shadow-[0_8px_20px_rgba(221,167,165,0.35)] flex flex-col items-center justify-end pb-1"
                  style={{
                    clipPath: 'polygon(0% 0%, 50% 100%, 100% 0%)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="w-full h-full opacity-20 bg-[radial-gradient(#F472B6_1px,transparent_1px)] [background-size:12px_12px]" />
                </div>

                {/* Back Side of the Flap (Visible when flipped open) */}
                <div
                  className="absolute inset-0 w-full h-full bg-gradient-to-t from-[#FAF0EB] to-[#FFF8F5] border-t-2 border-amber-300/80 shadow-inner"
                  style={{
                    clipPath: 'polygon(0% 0%, 50% 100%, 100% 0%)',
                    transform: 'rotateY(180deg) rotateZ(180deg)',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {/* Ornate Gold Damask Texture on Inside Flap */}
                  <div className="w-full h-full opacity-35 bg-[radial-gradient(#E3C18D_1.5px,transparent_1.5px)] [background-size:14px_14px]" />
                </div>

                {/* Wax Seal Positioned at the Flap Vertex */}
                {(phase === 'sealed' || phase === 'breaking') && (
                  <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 z-40 flex flex-col items-center pointer-events-auto">
                    <RoyalWaxSeal
                      isBreaking={phase === 'breaking'}
                      onClick={handleStartOpening}
                    />

                    {/* Interactive Prompt Tooltip Badge */}
                    {phase === 'sealed' && (
                      <motion.div
                        animate={{ y: [0, 6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        onClick={handleStartOpening}
                        className="mt-4 cursor-pointer whitespace-nowrap px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-pink-300 text-rose-950 font-serif font-bold text-xs sm:text-sm tracking-wider shadow-[0_6px_22px_rgba(244,114,182,0.55)] border border-white/80 hover:scale-105 transition-transform flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-rose-900 animate-spin-slow" />
                        <span>Chạm Vào Dấu Sáp Để Mở Thiệp</span>
                        <Sparkles className="w-3.5 h-3.5 text-rose-900 animate-spin-slow" />
                      </motion.div>
                    )}

                    {/* Audio Hint Badge */}
                    {phase === 'sealed' && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] sm:text-[11px] font-serif italic text-amber-200/90 drop-shadow">
                        <Music className="w-3 h-3 text-amber-300 animate-pulse" />
                        <span>Âm nhạc giao hưởng sẽ tự động tấu khúc</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
