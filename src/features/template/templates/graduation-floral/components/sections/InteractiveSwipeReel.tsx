import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize2, Hand, Sparkles } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

export const InteractiveSwipeReel: React.FC = () => {
  const { config, openLightbox } = useConfig();
  const { marqueePhotos } = config.images;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const total = marqueePhotos.length;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  // Auto-play timer
  useEffect(() => {
    if (!isAutoPlay) return;
    const timer = setInterval(() => {
      handleNext();
    }, 4500);
    return () => clearInterval(timer);
  }, [isAutoPlay, total]);

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsAutoPlay(false);
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 35) {
      handleNext();
    } else if (diff < -35) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  return (
    <section className="py-12 sm:py-16 bg-gradient-to-b from-transparent via-rose-50/50 to-transparent relative overflow-hidden select-none w-full">
      {/* Background Soft Aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[550px] h-[250px] sm:h-[350px] bg-pink-200/25 rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 text-center">
        {/* Header Tag */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 font-serif italic text-[11px] sm:text-xs uppercase tracking-[0.2em] text-rosegold-dark bg-white/80 px-3.5 py-1.5 rounded-full border border-rose-200 shadow-sm mb-2.5 sm:mb-3">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          <span>ALBUM ẢNH NÀNG THƠ // VUỐT TRẢI NGHIỆM</span>
        </div>

        <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-poetic-text mb-2">
          Khoảnh Khắc Thanh Xuân Dịu Ngọt
        </h3>

        <p className="font-serif italic text-xs sm:text-sm text-poetic-muted max-w-lg mx-auto mb-6 sm:mb-8 flex items-center justify-center gap-1.5 px-2">
          <Hand className="w-4 h-4 text-rose-400 animate-bounce flex-shrink-0" />
          <span>Dùng ngón tay vuốt ngang (trên điện thoại) hoặc bấm nút để lướt ảnh</span>
        </p>

        {/* 3D CoverFlow Interactive Slider */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={() => setIsAutoPlay(false)}
          onMouseLeave={() => setIsAutoPlay(true)}
          className="relative w-full max-w-4xl mx-auto min-h-[340px] sm:min-h-[460px] flex items-center justify-center"
        >
          {/* Previous Button */}
          <button
            onClick={handlePrev}
            aria-label="Previous Slide"
            className="absolute left-1 sm:left-6 z-30 w-9 h-9 sm:w-13 sm:h-13 rounded-full bg-white/90 border border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white shadow-md flex items-center justify-center transition-all backdrop-blur-md"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Next Button */}
          <button
            onClick={handleNext}
            aria-label="Next Slide"
            className="absolute right-1 sm:right-6 z-30 w-9 h-9 sm:w-13 sm:h-13 rounded-full bg-white/90 border border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white shadow-md flex items-center justify-center transition-all backdrop-blur-md"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Cards Display with 3D Depth & Romantic Arched / Polaroid Frames */}
          <div className="relative w-full h-[330px] sm:h-[440px] flex items-center justify-center overflow-hidden">
            {marqueePhotos.map((src, index) => {
              let offset = index - currentIndex;
              if (offset < -Math.floor(total / 2)) offset += total;
              if (offset > Math.floor(total / 2)) offset -= total;

              const isCenter = offset === 0;
              const isVisible = Math.abs(offset) <= 2;

              if (!isVisible) return null;

              return (
                <motion.div
                  key={index}
                  onClick={() => {
                    if (isCenter) {
                      openLightbox(index);
                    } else {
                      setCurrentIndex(index);
                    }
                  }}
                  animate={{
                    x: offset * (typeof window !== 'undefined' && window.innerWidth < 640 ? 120 : 210),
                    scale: isCenter ? 1 : Math.abs(offset) === 1 ? 0.82 : 0.65,
                    rotateY: offset * -18,
                    zIndex: 20 - Math.abs(offset) * 5,
                    opacity: isCenter ? 1 : Math.abs(offset) === 1 ? 0.75 : 0.3,
                  }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className={`absolute w-56 h-[310px] sm:w-76 sm:h-[390px] rounded-3xl overflow-hidden cursor-pointer transition-shadow duration-500 bg-white p-2 sm:p-2.5 shadow-lg ${
                    isCenter
                      ? 'border-2 border-rosegold shadow-[0_15px_35px_rgba(221,167,165,0.4)] ring-2 sm:ring-4 ring-rose-100'
                      : 'border border-rose-100'
                  }`}
                >
                  <div className="w-full h-full rounded-2xl overflow-hidden relative group">
                    <img
                      src={src}
                      alt={`Moment ${index + 1}`}
                      className="w-full h-full object-cover object-center filter contrast-105 group-hover:scale-105 transition-transform duration-700"
                    />

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />

                    {isCenter && (
                      <>
                        {/* Zoom Trigger Button on Center Card */}
                        <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/80 border border-rosegold text-rose-500 flex items-center justify-center shadow-md animate-pulse-soft">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </div>

                        {/* Bottom Info Bar */}
                        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-[11px] sm:text-xs font-serif italic text-white">
                          <span className="px-2.5 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/30">
                            #0{index + 1}
                          </span>
                          <span className="text-rose-200 font-semibold bg-rose-900/40 px-2 py-0.5 rounded-full">
                            Chạm xem ảnh
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-5 sm:mt-6">
          {marqueePhotos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === idx
                  ? 'w-7 bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.6)]'
                  : 'w-2 bg-rose-200 hover:bg-rose-300'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
