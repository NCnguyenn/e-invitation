import type { Variants } from 'framer-motion';

export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
  }
};

export const scaleInVariant: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  }
};

export const staggerContainerVariant: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1
    }
  }
};

export const hudCardHover = {
  scale: 1.02,
  boxShadow: '0 0 30px rgba(255, 0, 60, 0.35), inset 0 0 15px rgba(255, 0, 60, 0.15)',
  transition: { duration: 0.25 }
};
