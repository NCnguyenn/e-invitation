import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Feather } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { SectionHeader } from '../common/SectionHeader';
import { PoeticCard } from '../common/PoeticCard';

export const StorySection: React.FC = () => {
  const { config } = useConfig();
  const { story, images } = config;

  return (
    <section id="story-section" className="py-12 sm:py-20 px-3 sm:px-4 max-w-5xl mx-auto relative w-full">
      <SectionHeader
        tag="LỜI TỰ TÌNH THANH XUÂN"
        title={story.heading}
        scriptAccent="Whispers of Youth"
        subtitle={story.tagline || 'Ghi lại những ký ức ngọt ngào, những bài học và ngọn lửa ước mơ.'}
        accent="rosegold"
      />

      <PoeticCard variant="glass" className="p-5 sm:p-10 md:p-12 relative overflow-hidden">
        {/* Soft Background Floral / Heart Watermark */}
        <Quote className="absolute -top-6 -right-6 w-36 sm:w-48 h-36 sm:h-48 text-rose-200/20 pointer-events-none rotate-12" />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
          {/* Portrait Column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="md:col-span-5 flex justify-center"
          >
            <div className="relative w-48 h-64 sm:w-64 sm:h-84 arch-frame p-2 sm:p-2.5 bg-white border-2 border-rosegold/50 shadow-[0_15px_35px_rgba(221,167,165,0.3)] overflow-hidden group">
              <div className="w-full h-full arch-frame overflow-hidden relative">
                <img
                  src={images.storyPortrait}
                  alt="Story Portrait"
                  loading="lazy"
                  className="w-full h-full object-cover object-center filter contrast-105 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-rose-950/20 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </motion.div>

          {/* Story Content Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="md:col-span-7 flex flex-col justify-between"
          >
            <div className="space-y-3 sm:space-y-4 text-poetic-text font-serif italic text-xs sm:text-base md:text-lg leading-relaxed">
              {story.paragraphs.map((para, idx) => (
                <p key={idx} className="relative pl-3.5 sm:pl-4 border-l-2 border-rose-300">
                  {para}
                </p>
              ))}
            </div>

            {/* Signature Block */}
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-serif text-poetic-muted">
                <Feather className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                <span>Nàng Thơ của tháng năm</span>
              </div>
              <div className="font-handwriting text-2xl sm:text-4xl text-rose-600 font-bold drop-shadow-sm">
                {story.signature}
              </div>
            </div>
          </motion.div>
        </div>
      </PoeticCard>
    </section>
  );
};
