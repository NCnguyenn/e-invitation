import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import { CyberCorners } from './CyberCorners';

interface CyberCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  glow?: 'crimson' | 'gold' | 'cyan' | 'none';
  className?: string;
  hasCorners?: boolean;
  chamfered?: boolean;
}

export const CyberCard: React.FC<CyberCardProps> = ({
  children,
  glow = 'crimson',
  className = '',
  hasCorners = true,
  chamfered = true,
  ...props
}) => {
  const glowBorder = {
    crimson: 'border-neon-crimson/30 hover:border-neon-crimson/80 hover:shadow-[0_0_30px_rgba(255,0,60,0.25)]',
    gold: 'border-neon-gold/30 hover:border-neon-gold/80 hover:shadow-[0_0_30px_rgba(255,184,0,0.25)]',
    cyan: 'border-neon-cyan/30 hover:border-neon-cyan/80 hover:shadow-[0_0_30px_rgba(0,240,255,0.25)]',
    none: 'border-slate-800',
  }[glow];

  return (
    <motion.div
      className={`relative bg-cyber-dark/80 backdrop-blur-xl border ${glowBorder} transition-all duration-300 ${
        chamfered ? 'clip-cyber-card' : 'rounded-lg'
      } ${className}`}
      {...props}
    >
      {/* Background Cyber Grid Accent */}
      <div className="absolute inset-0 bg-cyber-grid bg-[length:24px_24px] opacity-10 pointer-events-none" />

      {/* Decorative Corners */}
      {hasCorners && (
        <CyberCorners
          color={glow === 'none' ? 'crimson' : glow}
          className="p-1"
          size="md"
        />
      )}

      {/* Card Body */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
