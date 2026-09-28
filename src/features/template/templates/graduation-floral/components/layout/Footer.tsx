import React from 'react';
import { Heart } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

export const Footer: React.FC = () => {
  const { config } = useConfig();

  return (
    <footer className="py-8 px-4 border-t border-rose-200/60 bg-poetic-bg text-center relative z-20">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-serif text-poetic-muted">
        <div className="flex items-center gap-2">
          <span>🌸</span>
          <span>BẢN GIAO HƯỞNG NÀNG THƠ // {config.event.ownerName}</span>
        </div>

        <div className="flex items-center gap-1.5 text-rose-500">
          <span>Made with</span>
          <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400 inline animate-pulse" />
          <span>for a wonderful day</span>
        </div>

        <div>
          <span>&copy; {config.event.year} &bull; ALL RIGHTS RESERVED</span>
        </div>
      </div>
    </footer>
  );
};
