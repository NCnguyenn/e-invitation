import React from 'react';
import { Film } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

export const MarqueeSection: React.FC = () => {
  const { config, openLightbox } = useConfig();
  const { marqueePhotos } = config.images;

  // Duplicate for seamless infinite loop
  const photos = [...marqueePhotos, ...marqueePhotos];

  return (
    <section className="py-12 bg-cyber-gunmetal/40 border-y border-slate-800 relative overflow-hidden">
      {/* Background Laser Aura */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-cyber-void to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-cyber-void to-transparent z-10 pointer-events-none" />

      {/* Top Badge */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 font-tech font-bold text-xs uppercase tracking-[0.25em] text-neon-crimson bg-red-950/40 px-4 py-1 border border-red-800/50 clip-cyber-badge shadow-[0_0_15px_rgba(255,0,60,0.3)]">
          <Film className="w-3.5 h-3.5 text-neon-crimson" />
          <span>CHRONICLE REEL // KHOẢNH KHẮC THANH XUÂN BÁ KHÍ</span>
        </div>
      </div>

      {/* Infinite Marquee Strip */}
      <div className="w-full overflow-hidden">
        <div className="animate-marquee flex gap-4 sm:gap-6 py-2">
          {photos.map((src, index) => (
            <div
              key={index}
              onClick={() => openLightbox(index % marqueePhotos.length)}
              className="relative flex-shrink-0 w-48 h-64 sm:w-60 sm:h-80 rounded-lg overflow-hidden border border-slate-700 hover:border-neon-crimson transition-all duration-300 group cursor-pointer shadow-lg hover:shadow-[0_0_25px_rgba(255,0,60,0.5)]"
            >
              <img
                src={src}
                alt="Moment"
                loading="lazy"
                className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500 filter brightness-90 contrast-105 group-hover:brightness-100"
              />

              {/* Hover Holographic Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-cyber-void via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

              {/* Corner Sci-Fi Tag */}
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 font-mono text-[10px] text-slate-300 border border-slate-700">
                #0{((index % marqueePhotos.length) + 1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
