import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  VolumeX,
  Sparkles,
  Wand2,
  Share2,
  ArrowUp,
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

export const FloatingHUD: React.FC = () => {
  const {
    audioPlaying,
    toggleAudio,
    particlesEnabled,
    toggleParticles,
    setIsCustomizerOpen,
    setIsLinkGenOpen,
    isCustomGuest,
    config,
  } = useConfig();

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-4 right-3 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2 sm:gap-3 pointer-events-auto">
      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={scrollToTop}
            title="Lướt về đầu trang"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/95 border border-rose-200 text-rose-500 shadow-[0_6px_16px_rgba(244,114,182,0.25)] hover:shadow-[0_12px_28px_rgba(244,114,182,0.45)] hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-all backdrop-blur-md"
          >
            <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main Poetic HUD Capsule */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-full bg-white/95 border border-rosegold/40 shadow-[0_8px_30px_rgba(221,167,165,0.35)] backdrop-blur-xl transition-all">
        {/* Audio Player Disc Toggle */}
        <button
          onClick={toggleAudio}
          title={audioPlaying ? 'Tạm dừng nhạc nền' : 'Phát nhạc nền (Công Tử Văn Thơ)'}
          className={`relative w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-400 overflow-hidden flex-shrink-0 ${
            audioPlaying
              ? 'bg-gradient-to-tr from-rose-400 to-rose-500 text-white shadow-[0_0_15px_rgba(251,113,133,0.55)]'
              : 'bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100'
          }`}
        >
          {audioPlaying ? (
            <div className="flex items-end gap-0.5 h-3.5 sm:h-4">
              <span className="eq-bar-poetic !bg-white" />
              <span className="eq-bar-poetic !bg-white" />
              <span className="eq-bar-poetic !bg-white" />
              <span className="eq-bar-poetic !bg-white" />
            </div>
          ) : (
            <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        {/* Mini Song Name Pill (Expandable) */}
        <div
          onClick={() => setIsPlayerOpen(!isPlayerOpen)}
          className="cursor-pointer px-2 py-0.5 hidden lg:flex flex-col text-left select-none"
        >
          <span className="text-[10px] font-serif uppercase tracking-widest text-rosegold-dark">
            {config.music.songTitle}
          </span>
          <span className="text-[11px] font-sans font-semibold text-poetic-text -mt-0.5">
            {config.music.artist}
          </span>
        </div>

        {/* Butterflies & Petals Toggle */}
        <button
          onClick={toggleParticles}
          title={particlesEnabled ? 'Tắt hiệu ứng bướm & cánh hoa' : 'Bật hiệu ứng bướm & cánh hoa'}
          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
            particlesEnabled
              ? 'bg-rose-100 text-rose-500 border border-rose-200 shadow-sm'
              : 'bg-stone-100 text-stone-400 hover:text-stone-600'
          }`}
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Guest Link Generator (Tạo Link Khách) */}
        {!isCustomGuest && (
          <button
            onClick={() => setIsLinkGenOpen(true)}
            title="Tạo đường link mời riêng cho khách"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-rosegold-light/40 text-rosegold-dark border border-rosegold/50 shadow-sm hover:bg-rosegold hover:text-white flex items-center justify-center transition-all duration-300"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}

        {/* Live Customizer (Chỉnh sửa trực quan) */}
        {!isCustomGuest && (
          <button
            onClick={() => setIsCustomizerOpen(true)}
            title="Bảng điều khiển & Tùy biến nhanh"
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-purple-50 text-purple-500 border border-purple-200 shadow-sm hover:bg-purple-100 hover:text-purple-700 flex items-center justify-center transition-all duration-300"
          >
            <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
