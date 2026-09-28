import React from 'react';
import { motion } from 'framer-motion';
import { useConfig } from '../../context/ConfigContext';

export const ThankYouSection: React.FC = () => {
  const { config } = useConfig();
  const { thankYou, images, event } = config;

  // Use the banner image or fallback to thank-you-banner
  const bannerImg = images.thankYouBanner || '/images/thank-you-banner.webp';

  return (
    <section className="relative py-8 sm:py-12 px-3 sm:px-4 overflow-hidden text-center w-full">
      {/* Background Banner with Impressive Lighting & Moderate Blur */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={bannerImg}
          alt="Thank You Background"
          className="w-full h-full object-cover object-center filter blur-[2px] brightness-[0.92] contrast-[1.05] scale-105"
        />
        {/* Soft Romantic Veil Overlay - Gentle & Moderate */}
        <div className="absolute inset-0 bg-gradient-to-b from-poetic-bg/90 via-white/30 to-poetic-bg/95" />
      </div>

      {/* Compact & Refined Thank You Card */}
      <div className="relative z-10 max-w-md sm:max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="p-5 sm:p-7 bg-white/85 rounded-3xl border border-rosegold/50 shadow-[0_12px_35px_rgba(221,167,165,0.35)] backdrop-blur-md relative"
        >
          {/* Top Delicate Flower Badge */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-200 via-pink-100 to-white p-0.5 mx-auto mb-3 shadow-sm border border-rosegold/40 flex items-center justify-center">
            <span className="text-xl sm:text-2xl animate-bounce">🌸</span>
          </div>

          <div className="font-serif italic text-[11px] sm:text-xs uppercase tracking-widest text-rosegold-dark mb-1">
            {thankYou.subtitle || '// TRI ÂN TẬN ĐÁY LÒNG'}
          </div>

          <h2 className="font-display text-xl sm:text-2xl font-bold text-poetic-text tracking-tight mb-3">
            {thankYou.title}
          </h2>

          <p className="text-poetic-text font-serif italic text-xs sm:text-sm leading-relaxed whitespace-pre-line max-w-md mx-auto px-1 text-slate-700">
            {thankYou.message}
          </p>

          {/* Signature */}
          <div className="mt-4 pt-3.5 border-t border-rose-100 flex items-center justify-center gap-2 font-handwriting text-2xl sm:text-3xl text-rose-600 font-bold">
            <span>{event.ownerName}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
