import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface PoeticCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  variant?: 'cream' | 'glass' | 'rose' | 'arch';
  className?: string;
  hasFloralBorder?: boolean;
}

export const PoeticCard: React.FC<PoeticCardProps> = ({
  children,
  variant = 'glass',
  className = '',
  hasFloralBorder = true,
  ...props
}) => {
  const variantStyles = {
    glass:
      'bg-white/80 backdrop-blur-xl border border-rose-200/60 shadow-[0_12px_35px_-8px_rgba(221,167,165,0.25)] hover:shadow-[0_20px_45px_-8px_rgba(244,114,182,0.28)] hover:border-rose-300',
    cream:
      'bg-[#FFFDFB]/95 border border-rosegold/40 shadow-[0_10px_30px_rgba(221,167,165,0.2)] hover:shadow-[0_18px_40px_rgba(221,167,165,0.3)]',
    rose:
      'bg-gradient-to-br from-rose-50/90 to-pink-100/60 border border-rose-200 shadow-[0_12px_30px_rgba(251,113,133,0.18)] hover:shadow-[0_18px_40px_rgba(251,113,133,0.3)]',
    arch:
      'bg-white/85 backdrop-blur-xl border border-rose-200/70 arch-frame shadow-[0_15px_40px_-10px_rgba(221,167,165,0.3)]',
  }[variant];

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`relative rounded-3xl transition-all duration-400 ${variantStyles} ${className}`}
      {...props}
    >
      {/* Delicate Floral Vignette Accent on top corner */}
      {hasFloralBorder && (
        <div className="absolute top-3 right-3 text-rosegold/40 text-sm select-none pointer-events-none">
          ❦
        </div>
      )}

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

// Alias for backwards compatibility
export const CyberCard = PoeticCard;
