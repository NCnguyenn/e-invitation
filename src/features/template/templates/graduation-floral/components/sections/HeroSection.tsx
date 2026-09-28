import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Heart, ChevronDown, Sparkles, Music } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { PoeticBadge } from '../common/PoeticBadge';
import { PoeticButton } from '../common/PoeticButton';
import { triggerPoeticConfetti } from '../../utils/confetti';

export const HeroSection: React.FC = () => {
  const { config, guestName, toggleAudio, audioPlaying } = useConfig();
  const { event, images } = config;

  const [notes, setNotes] = useState<Array<{ id: number; symbol: string; x: number }>>([]);
  const [spinBoost, setSpinBoost] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInstrumentClick = () => {
    // 1. Trigger audio toggle
    toggleAudio();

    // 2. Trigger sweet petal confetti
    triggerPoeticConfetti();

    // 3. Temporary spin speedup
    setSpinBoost(true);
    setTimeout(() => setSpinBoost(false), 1200);

    // 4. Emit flying musical notes
    const symbols = ['🎵', '🎶', '🎼', '✨', '🌸'];
    const newNote = {
      id: Date.now(),
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      x: (Math.random() - 0.5) * 40,
    };
    setNotes((prev) => [...prev.slice(-4), newNote]);

    setTimeout(() => {
      setNotes((prev) => prev.filter((n) => n.id !== newNote.id));
    }, 1500);
  };

  return (
    <section className="relative min-h-[90vh] md:min-h-screen flex flex-col items-center justify-center pt-20 sm:pt-24 pb-14 sm:pb-16 px-3 sm:px-4 overflow-hidden w-full max-w-full">
      {/* Background Soft Pastel Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[650px] h-[320px] sm:h-[650px] bg-gradient-to-tr from-pink-200/35 via-rose-100/40 to-champagne-light/35 rounded-full blur-[90px] sm:blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[220px] sm:w-[450px] h-[220px] sm:h-[450px] bg-rose-200/25 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-[220px] sm:w-[400px] h-[220px] sm:h-[400px] bg-champagne-gold/20 rounded-full blur-[70px] sm:blur-[90px] pointer-events-none" />

      {/* Top Ceremony Badges */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4"
      >
        <PoeticBadge variant="rosegold" size="sm" icon={<Sparkles className="w-3.5 h-3.5 text-rosegold-dark animate-spin-slow" />}>
          {event.badgeTop}
        </PoeticBadge>
        <PoeticBadge variant="rose" size="sm">
          {event.badgeBottom}
        </PoeticBadge>
      </motion.div>

      {/* Main Poetic Title & Owner Name */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.15 }}
        className="text-center max-w-4xl mx-auto mb-6 sm:mb-8 px-2"
      >
        <div className="font-script text-2xl sm:text-4xl md:text-5xl text-rose-400 mb-1">
          Sweet Memories
        </div>

        <h1 className="font-display text-3xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-poetic-text drop-shadow-[0_4px_20px_rgba(221,167,165,0.35)] leading-tight">
          <span className="bg-gradient-to-r from-poetic-text via-rose-900 to-rosegold-dark bg-clip-text text-transparent">
            {event.ownerName}
          </span>
        </h1>

        <div className="mt-2.5 sm:mt-3 inline-block font-serif italic text-xs sm:text-base md:text-lg tracking-widest text-rosegold-dark bg-white/80 px-4 sm:px-6 py-1 sm:py-1.5 rounded-full border border-rosegold/40 shadow-sm backdrop-blur-sm">
          {event.subName}
        </div>
      </motion.div>

      {/* French Arched Floral Portrait Frame */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.25 }}
        className="relative mb-8 sm:mb-10 group"
      >
        {/* Soft Glowing Wreath Halo */}
        <div className="absolute -inset-3 sm:-inset-6 bg-gradient-to-tr from-rose-200/50 via-pink-100/60 to-champagne-gold/40 rounded-t-full rounded-b-3xl blur-lg sm:blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Outer Arched Frame */}
        <div className="relative w-[250px] h-[340px] sm:w-80 sm:h-[420px] md:w-92 md:h-[460px] bg-white arch-frame p-2 sm:p-3 border-2 border-rosegold/60 shadow-[0_15px_40px_rgba(221,167,165,0.35)] overflow-hidden">
          <div className="w-full h-full arch-frame overflow-hidden relative">
            <img
              src={images.heroPortrait}
              alt={event.ownerName}
              className="w-full h-full object-cover object-center filter brightness-[0.98] contrast-105 group-hover:scale-105 transition-transform duration-700"
            />

            {/* Subtle Gradient Veil */}
            <div className="absolute inset-0 bg-gradient-to-t from-rose-900/30 via-transparent to-transparent opacity-60 pointer-events-none" />

            {/* Delicate Tag in corner */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="font-serif italic text-[11px] sm:text-xs tracking-wider text-white bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-md">
                ❦ Thanh Xuân Ngọt Ngào
              </span>
              <span className="w-2 h-2 rounded-full bg-rose-300 animate-ping" />
            </div>
          </div>
        </div>

        {/* ========================================================
            NÚT CÂY ĐÀN (CỔ CẦM PHA LÊ) - CHO LÊN TRÊN & LỆCH PHẢI
            CÓ KHẢ NĂNG TƯƠNG TÁC CHẠM VÀO PHÁT NHẠC / NỐT NHẠC BAY
            ======================================================== */}
        <div className="absolute bottom-10 sm:bottom-16 -right-5 sm:-right-8 z-30 flex flex-col items-center">
          {/* Flying Musical Notes on interaction */}
          <AnimatePresence>
            {notes.map((note) => (
              <motion.span
                key={note.id}
                initial={{ opacity: 1, y: 0, x: note.x, scale: 0.8 }}
                animate={{ opacity: 0, y: -60, x: note.x * 1.5, scale: 1.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                className="absolute text-lg sm:text-xl pointer-events-none drop-shadow-md"
              >
                {note.symbol}
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Tooltip Badge */}
          <span className="absolute -top-7 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-white/95 border border-rosegold/60 text-[10px] font-serif italic text-rosegold-dark shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {audioPlaying ? '🎶 Đang tấu nhạc...' : '🎶 Chạm phím đàn'}
          </span>

          {/* Interactive Musical Instrument Disc */}
          <motion.button
            type="button"
            onClick={handleInstrumentClick}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            title="Chạm vào cây đàn để bật/tắt nhạc và ngân nga giai điệu!"
            aria-label="Cây đàn tấu nhạc"
            className="relative w-16 h-16 sm:w-24 sm:h-24 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-300 rounded-full flex items-center justify-center p-1"
          >
            {/* Soft Radiant Halo */}
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-300/40 via-pink-200/50 to-champagne-light/50 rounded-full blur-md animate-pulse-soft" />

            {/* Spinning Musical Instrument Image */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: spinBoost ? 3 : 22,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="w-full h-full filter drop-shadow-[0_8px_18px_rgba(221,167,165,0.6)]"
            >
              <img
                src="/inmages2/spin-badge.png"
                alt="Cổ cầm pha lê"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </motion.div>

            {/* Cute Music Pulsing Icon in Center */}
            <div className="absolute inset-0 m-auto w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-white/80 border border-rosegold/50 flex items-center justify-center shadow-sm pointer-events-none">
              <Music className={`w-3 h-3 sm:w-4 sm:h-4 text-rose-500 ${audioPlaying ? 'animate-bounce' : ''}`} />
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* Guest Invitation Letter Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="w-full max-w-xl mx-auto mb-6 sm:mb-8 text-center px-1"
      >
        <div className="relative p-4 sm:p-6 bg-white/85 border border-rosegold/50 rounded-2xl sm:rounded-3xl shadow-[0_10px_35px_rgba(221,167,165,0.25)] backdrop-blur-xl">
          <div className="font-serif italic text-[11px] sm:text-xs uppercase tracking-[0.25em] text-rosegold-dark mb-1">
            {event.inviteGreeting}
          </div>
          <div className="text-lg sm:text-3xl font-display font-bold text-poetic-text tracking-wide">
            {guestName}
          </div>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-serif italic text-poetic-muted leading-relaxed">
            Trân trọng kính mời bạn đến chung vui trong ngày đặc biệt ngập tràn sắc hoa và kỷ niệm ngọt ngào.
          </p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-xs sm:max-w-md"
      >
        <PoeticButton
          variant="primary"
          size="md"
          fullWidth
          icon={<Heart className="w-4 h-4 fill-white" />}
          onClick={() => scrollToSection('rsvp-section')}
        >
          Xác Nhận Tham Dự
        </PoeticButton>

        <PoeticButton
          variant="cream"
          size="md"
          fullWidth
          icon={<MapPin className="w-4 h-4 text-rose-500" />}
          onClick={() => scrollToSection('venue-section')}
        >
          Xem Địa Điểm
        </PoeticButton>
      </motion.div>

      {/* Scroll Down Indicator */}
      <motion.button
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        onClick={() => scrollToSection('invitation-section')}
        className="mt-8 sm:mt-12 text-poetic-muted hover:text-rose-500 flex flex-col items-center gap-1 transition-colors"
      >
        <span className="font-serif italic text-[11px] sm:text-xs tracking-widest">Lướt xuống để dạo bước</span>
        <ChevronDown className="w-4 h-4 text-rose-400" />
      </motion.button>
    </section>
  );
};
