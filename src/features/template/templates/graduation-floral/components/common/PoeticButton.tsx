import React from 'react';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

interface PoeticButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: 'primary' | 'rosegold' | 'cream' | 'ghost' | 'softpink';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  asAnchor?: boolean;
  href?: string;
  target?: string;
  rel?: string;
}

export const PoeticButton: React.FC<PoeticButtonProps> = ({
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
    'relative inline-flex items-center justify-center font-serif font-medium tracking-wider select-none overflow-hidden cursor-pointer group transition-all duration-400 ease-out rounded-full';

  const sizeStyles = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm sm:text-base',
    lg: 'px-8 py-4 text-base sm:text-lg',
  }[size];

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-rose-400 via-rose-500 to-rose-400 text-white shadow-[0_8px_20px_rgba(244,63,94,0.25)] hover:shadow-[0_12px_30px_rgba(244,63,94,0.45)] hover:from-rose-500 hover:to-rose-600 border border-rose-300/60',
    rosegold:
      'bg-gradient-to-r from-rosegold-light via-rosegold to-rosegold-medium text-poetic-plum font-semibold shadow-[0_8px_20px_rgba(221,167,165,0.35)] hover:shadow-[0_12px_30px_rgba(183,110,121,0.55)] border border-rosegold/50 hover:from-rosegold hover:to-rosegold-dark hover:text-white',
    cream:
      'bg-poetic-cream/90 text-poetic-text shadow-[0_8px_20px_rgba(221,167,165,0.2)] hover:bg-rose-50 hover:text-rose-700 border border-rosegold/40 hover:shadow-[0_12px_30px_rgba(244,114,182,0.3)]',
    ghost:
      'bg-white/60 hover:bg-rose-100/70 text-poetic-text hover:text-rose-800 border border-rose-200/80 backdrop-blur-md hover:shadow-[0_8px_25px_rgba(244,114,182,0.25)]',
    softpink:
      'bg-rose-100 text-rose-800 hover:bg-rose-200/90 border border-rose-200 shadow-sm hover:shadow-[0_8px_20px_rgba(251,113,133,0.25)]',
  }[variant];

  const content = (
    <>
      {/* Soft light shimmer on hover */}
      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:animate-shimmer-soft pointer-events-none" />

      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {icon && <span className="transition-transform group-hover:scale-110 group-hover:rotate-6">{icon}</span>}
        <span>{children}</span>
      </span>
    </>
  );

  const combinedClass = `${baseStyles} ${sizeStyles} ${variantStyles} ${
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
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={combinedClass}
      {...props}
    >
      {content}
    </motion.button>
  );
};

// Alias for backwards compatibility
export const CyberButton = PoeticButton;
