import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2 } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { SectionHeader } from '../common/SectionHeader';

export const GallerySection: React.FC = () => {
  const { config, openLightbox } = useConfig();
  const { galleryPhotos } = config.images;

  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const categories = [
    'ALL',
    ...Array.from(
      new Set(galleryPhotos.map((p) => p.category).filter(Boolean) as string[])
    ),
  ];

  const filteredPhotos =
    activeCategory === 'ALL'
      ? galleryPhotos
      : galleryPhotos.filter((p) => p.category === activeCategory);

  return (
    <section id="gallery-section" className="py-12 sm:py-20 px-3 sm:px-4 max-w-6xl mx-auto relative w-full">
      <SectionHeader
        tag="KHO LƯU TRỮ KỶ NIỆM"
        title="Khu Vườn Ký Ức"
        scriptAccent="Blossom Moments"
        subtitle="Mỗi khoảnh khắc là một cánh hoa ngọt ngào được lưu giữ trọn vẹn theo thời gian."
        accent="rosegold"
      />

      {/* Category Tabs */}
      {categories.length > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 mb-8 sm:mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 font-serif text-[11px] sm:text-sm tracking-wider uppercase rounded-full transition-all duration-300 ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-rose-400 to-rose-500 text-white shadow-[0_6px_20px_rgba(244,63,94,0.35)]'
                  : 'bg-white/80 text-poetic-muted border border-rose-200 hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              {cat === 'ALL' ? 'TẤT CẢ KỶ NIỆM' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Photo Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6"
      >
        <AnimatePresence>
          {filteredPhotos.map((photo, index) => {
            const originalIndex = galleryPhotos.findIndex((p) => p.id === photo.id);
            return (
              <motion.div
                key={photo.id || index}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                onClick={() => openLightbox(originalIndex >= 0 ? originalIndex : index)}
                className="group relative h-72 sm:h-92 bg-white rounded-3xl p-2.5 sm:p-3 border border-rosegold/30 hover:border-rose-300 transition-all duration-400 overflow-hidden cursor-pointer shadow-[0_10px_30px_rgba(221,167,165,0.2)] hover:shadow-[0_20px_45px_rgba(244,114,182,0.25)] hover:-translate-y-1.5"
              >
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  <img
                    src={photo.src}
                    alt={photo.caption}
                    loading="lazy"
                    className="w-full h-full object-cover object-center group-hover:scale-108 filter brightness-[0.98] contrast-105 group-hover:contrast-110 transition-transform duration-700"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                  {/* Hover Trigger Icon */}
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/85 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 shadow-md">
                    <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>

                  {/* Caption & Category Tag */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 pointer-events-none">
                    {photo.category && (
                      <span className="inline-block px-2.5 py-0.5 mb-1 sm:mb-1.5 font-serif italic text-[10px] sm:text-[11px] uppercase tracking-wider text-rose-200 bg-black/40 backdrop-blur-md rounded-full border border-white/20">
                        {photo.category}
                      </span>
                    )}
                    <p className="font-serif italic text-xs sm:text-sm text-white font-medium line-clamp-2 leading-relaxed">
                      {photo.caption}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </section>
  );
};
