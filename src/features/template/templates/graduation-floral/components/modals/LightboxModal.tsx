import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

export const LightboxModal: React.FC = () => {
  const { lightboxState, closeLightbox, openLightbox, config } = useConfig();
  const { galleryPhotos } = config.images;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxState.isOpen) return;

      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowRight') {
        const next = (lightboxState.activeIndex + 1) % galleryPhotos.length;
        openLightbox(next);
      } else if (e.key === 'ArrowLeft') {
        const prev =
          (lightboxState.activeIndex - 1 + galleryPhotos.length) %
          galleryPhotos.length;
        openLightbox(prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxState, galleryPhotos.length, closeLightbox, openLightbox]);

  if (!lightboxState.isOpen) return null;

  const currentPhoto = galleryPhotos[lightboxState.activeIndex];
  if (!currentPhoto) return null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    openLightbox((lightboxState.activeIndex + 1) % galleryPhotos.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    openLightbox(
      (lightboxState.activeIndex - 1 + galleryPhotos.length) % galleryPhotos.length
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeLightbox}
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 select-none"
      >
        {/* Close Button */}
        <button
          onClick={closeLightbox}
          className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/20 border border-white/30 text-white hover:bg-rose-500 hover:border-rose-400 flex items-center justify-center transition-all z-20 shadow-lg"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Prev Button */}
        <button
          onClick={handlePrev}
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 border border-white/30 text-white hover:bg-rose-400 hover:text-white flex items-center justify-center transition-all z-20 shadow-lg"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 border border-white/30 text-white hover:bg-rose-400 hover:text-white flex items-center justify-center transition-all z-20 shadow-lg"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Main Image Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-4xl max-h-[85vh] flex flex-col items-center justify-center"
        >
          <motion.div
            key={lightboxState.activeIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="relative rounded-3xl overflow-hidden border-4 border-white/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] bg-white p-2"
          >
            <img
              src={currentPhoto.src}
              alt={currentPhoto.caption}
              className="max-w-full max-h-[70vh] sm:max-h-[75vh] object-contain rounded-2xl"
            />
          </motion.div>

          {/* Caption */}
          <div className="mt-4 text-center max-w-lg">
            <div className="font-serif italic text-xs text-rose-300 mb-1">
              KHOẢNH KHẮC // [ 0{lightboxState.activeIndex + 1} / 0{galleryPhotos.length} ]
            </div>
            <p className="font-serif text-sm sm:text-base text-rose-100">
              {currentPhoto.caption}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
