import React from 'react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  tag?: string;
  title: string;
  subtitle?: string;
  scriptAccent?: string;
  align?: 'center' | 'left';
  accent?: 'crimson' | 'gold' | 'cyan' | 'rose' | 'rosegold';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  tag,
  title,
  subtitle,
  scriptAccent,
  align = 'center',
  className = '',
}) => {
  return (
    <div
      className={`mb-12 md:mb-16 ${
        align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    >
      {/* Script Accent / Floating romantic calligraphy */}
      {scriptAccent && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-script text-3xl sm:text-4xl md:text-5xl text-rose-400 mb-1"
        >
          {scriptAccent}
        </motion.div>
      )}

      {/* Tag */}
      {tag && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 mb-3"
        >
          <span className="font-serif italic text-xs md:text-sm tracking-[0.2em] uppercase px-4 py-1 rounded-full bg-rose-100/70 text-rosegold-dark border border-rose-200 shadow-sm">
            {tag}
          </span>
        </motion.div>
      )}

      {/* Main Title */}
      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-poetic-text"
      >
        <span className="bg-gradient-to-r from-poetic-text via-rose-900 to-rosegold-dark bg-clip-text text-transparent">
          {title}
        </span>
      </motion.h2>

      {/* Subtitle */}
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-3 text-poetic-muted font-serif italic text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>
      )}

      {/* Delicate Floral / Rose Gold Divider */}
      <div
        className={`mt-4 flex items-center gap-3 ${
          align === 'center' ? 'justify-center' : 'justify-start'
        }`}
      >
        <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-rosegold/60" />
        <span className="text-rose-400 text-sm animate-pulse-soft">🌸</span>
        <div className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-rosegold/60" />
      </div>
    </div>
  );
};
