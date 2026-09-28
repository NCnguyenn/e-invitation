import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { triggerPoeticConfetti } from '../../utils/confetti';
import { triggerButterflyFlock } from '../../utils/butterflies';
import { useConfig } from '../../context/ConfigContext';

const POETIC_QUOTES = [
  "🌸 Chạm vào mình để cả đàn bướm cùng tung cánh bay nhé!",
  "✨ Một ngày ngập tràn sắc hoa và những điều kỳ diệu!",
  "🦋 Bầy bướm thơ mộng đã sẵn sàng bay lượn cùng bạn!",
  "📖 Mỗi trang sách là một đóa hoa thơm ngát của thanh xuân.",
  "💌 Sự hiện diện của bạn là món quà vô giá với Nguyên Mai!",
];

export const BouncingMascot: React.FC = () => {
  const { audioPlaying, toggleAudio } = useConfig();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(true);
  const [isJumping, setIsJumping] = useState(false);
  const buttonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % POETIC_QUOTES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsJumping(true);

    // 1. Get exact position of the flower button
    let x = 70;
    let y = window.innerHeight - 70;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    // 2. TRIGGER SWARM OF BUTTERFLIES SWEEPING ACROSS THE SCREEN
    triggerButterflyFlock(x, y);

    // 3. Trigger soft petal confetti
    triggerPoeticConfetti();

    // 4. Update quote and show bubble
    setQuoteIndex((prev) => (prev + 1) % POETIC_QUOTES.length);
    setShowBubble(true);

    // 5. Start music if not playing
    if (!audioPlaying) {
      toggleAudio();
    }

    setTimeout(() => {
      setIsJumping(false);
    }, 800);
  };

  return (
    <div className="fixed bottom-4 left-3 sm:bottom-6 sm:left-6 z-40 flex items-end gap-2 select-none pointer-events-auto">
      {/* Speech Bubble - Desktop & Tablet */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10, x: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative max-w-[210px] sm:max-w-[250px] p-3.5 bg-white/95 border border-rosegold/50 rounded-2xl shadow-[0_10px_25px_rgba(221,167,165,0.35)] backdrop-blur-xl text-left hidden md:block"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-serif uppercase tracking-widest text-rosegold-dark mb-1">
              <Sparkles className="w-3 h-3 text-rose-400 animate-spin-slow" />
              <span>ĐÀN BƯỚM NÀNG THƠ</span>
            </div>
            <p className="font-serif italic text-xs text-poetic-text font-medium leading-relaxed">
              {POETIC_QUOTES[quoteIndex]}
            </p>

            {/* Bubble Tail */}
            <div className="absolute -bottom-2 left-6 w-3 h-3 bg-white border-b border-r border-rosegold/50 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bouncing Mascot Icon */}
      <motion.div
        ref={buttonRef}
        animate={
          isJumping
            ? { y: [-28, 0, -14, 0], rotate: [0, 360, 360, 360], scale: [1.25, 0.9, 1.15, 1] }
            : { y: [0, -12, 0] }
        }
        transition={
          isJumping
            ? { duration: 0.8, ease: 'easeOut' }
            : { duration: 2, repeat: Infinity, ease: 'easeInOut' }
        }
        onClick={handleClick}
        title="Chạm vào bông hoa để đàn bướm bay ngợp trời!"
        className="cursor-pointer group relative flex flex-col items-center"
      >
        {/* Soft Pink Glow Halo */}
        <div className="absolute -inset-2 bg-gradient-to-tr from-rose-300 via-pink-200 to-amber-200 rounded-full blur-md opacity-70 group-hover:opacity-100 transition-opacity animate-pulse-soft" />

        {/* Mascot Avatar Card */}
        <div className="relative w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-white border-2 border-rosegold shadow-[0_8px_25px_rgba(221,167,165,0.55)] flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-110">
          <span className="text-2xl sm:text-3xl select-none group-hover:scale-125 transition-transform duration-300">
            🌸
          </span>
        </div>

        {/* Floating Mini Tag */}
        <motion.div
          animate={{ rotate: [-4, 4, -4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="absolute -top-2 -right-1.5 px-2 py-0.5 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-serif italic text-[9px] sm:text-[10px] rounded-full shadow-md font-semibold"
        >
          Love
        </motion.div>

        {/* Soft Shadow on Floor */}
        <motion.div
          animate={{ scale: isJumping ? [0.6, 1, 0.8, 1] : [0.7, 1.1, 0.7], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-8 sm:w-10 h-1.5 sm:h-2 bg-rose-200/80 rounded-full blur-[2px] mt-1"
        />
      </motion.div>
    </div>
  );
};
