import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface CyberButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'gold' | 'cyan' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  asAnchor?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export const CyberButton: React.FC<CyberButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  className = '',
  asAnchor = false,
  href,
  target,
  rel,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-tech font-bold uppercase tracking-widest transition-all duration-300 select-none overflow-hidden cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm md:text-base',
    lg: 'px-8 py-4 text-base md:text-lg',
  }[size];

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-neon-crimson via-red-600 to-neon-crimson text-white border border-red-400/60 shadow-[0_0_20px_rgba(255,0,60,0.4)] hover:shadow-[0_0_35px_rgba(255,0,60,0.8)] hover:border-red-300',
    gold:
      'bg-gradient-to-r from-neon-gold via-amber-500 to-amber-600 text-black border border-amber-300 shadow-[0_0_20px_rgba(255,184,0,0.4)] hover:shadow-[0_0_35px_rgba(255,184,0,0.8)] hover:border-amber-100',
    cyan:
      'bg-gradient-to-r from-neon-cyan via-cyan-500 to-blue-600 text-black border border-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.8)] hover:border-cyan-100',
    ghost:
      'bg-cyber-surface/80 hover:bg-neon-crimson/20 text-slate-200 hover:text-white border border-slate-700 hover:border-neon-crimson/80 backdrop-blur-md',
    danger:
      'bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-600/50 hover:border-red-500',
  }[variant];

  const content = (
    <>
      {/* Laser Light Shimmer on Hover */}
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
      
      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon && <span className="transition-transform group-hover:scale-110">{icon}</span>}
        <span>{children}</span>
      </span>

      {/* Chamfered Cut Corner Dot */}
      <span className="absolute bottom-0 right-0 w-2 h-2 bg-white/40 group-hover:bg-white" />
    </>
  );

  const combinedClass = `clip-cyber-corner ${baseStyles} ${sizeStyles} ${variantStyles} ${
    fullWidth ? 'w-full' : ''
  } ${className}`;

  if (asAnchor && href) {
    return (
      <a href={href} target={target} rel={rel} className={combinedClass}>
        {content}
      </a>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={combinedClass}
      {...props}
    >
      {content}
    </motion.button>
  );
};
