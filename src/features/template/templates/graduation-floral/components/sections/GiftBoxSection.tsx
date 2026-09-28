import React, { useState } from 'react';
import { Gift, Copy, Check } from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { SectionHeader } from '../common/SectionHeader';
import { PoeticCard } from '../common/PoeticCard';
import { PoeticButton } from '../common/PoeticButton';

export const GiftBoxSection: React.FC = () => {
  const { config } = useConfig();
  const { giftBox } = config;

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!giftBox.enabled || !giftBox.accounts || giftBox.accounts.length === 0) {
    return null;
  }

  const handleCopy = (accountNumber: string, index: number) => {
    navigator.clipboard.writeText(accountNumber);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <section id="gift-section" className="py-12 sm:py-20 px-3 sm:px-4 max-w-4xl mx-auto relative w-full">
      <SectionHeader
        tag="MÓN QUÀ TRI ÂN"
        title={giftBox.title}
        scriptAccent="Sweet Gift"
        subtitle={giftBox.description}
        accent="rosegold"
      />

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6 sm:gap-8 justify-center max-w-lg mx-auto">
        {giftBox.accounts.map((acc, index) => (
          <PoeticCard key={index} variant="glass" className="p-5 sm:p-10 text-center relative">
            <div className="inline-flex items-center gap-1.5 font-serif italic text-xs text-rosegold-dark uppercase tracking-widest mb-3 sm:mb-4">
              <Gift className="w-4 h-4 text-rose-400" />
              MỪNG TỐT NGHIỆP CÙNG NGUYÊN MAI
            </div>

            {/* QR Code Container */}
            <div className="relative inline-block p-3 sm:p-4 bg-white rounded-3xl shadow-[0_10px_30px_rgba(221,167,165,0.3)] mb-5 sm:mb-6 border border-rose-100">
              <img
                src={acc.qrImage}
                alt="QR Code"
                className="w-40 h-40 sm:w-56 sm:h-56 object-contain rounded-xl"
              />
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-rose-400 to-rose-500 text-white font-serif text-[10px] sm:text-[11px] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-md">
                VietQR 24/7 🌸
              </div>
            </div>

            {/* Account Specs */}
            <div className="space-y-2 sm:space-y-2.5 max-w-xs mx-auto text-left font-serif mb-5 sm:mb-6 bg-rose-50/60 p-3.5 sm:p-4 rounded-2xl border border-rose-200">
              <div className="flex justify-between text-xs text-poetic-muted">
                <span>NGÂN HÀNG:</span>
                <strong className="text-poetic-text">{acc.bankName}</strong>
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-poetic-text">
                <span>SỐ TÀI KHOẢN:</span>
                <strong className="font-mono text-rose-600 text-sm sm:text-base tracking-wider">{acc.accountNumber}</strong>
              </div>
              <div className="flex justify-between text-xs text-poetic-muted">
                <span>CHỦ TÀI KHOẢN:</span>
                <strong className="text-poetic-text uppercase">{acc.accountHolder}</strong>
              </div>
            </div>

            {/* Copy Action Button */}
            <PoeticButton
              variant={copiedIndex === index ? 'softpink' : 'rosegold'}
              size="md"
              fullWidth
              onClick={() => handleCopy(acc.accountNumber, index)}
              icon={copiedIndex === index ? <Check className="w-4 h-4 text-rose-600" /> : <Copy className="w-4 h-4 text-poetic-plum" />}
              className="text-xs sm:text-sm"
            >
              {copiedIndex === index ? 'ĐÃ SAO CHÉP SỐ TÀI KHOẢN!' : 'SAO CHÉP SỐ TÀI KHOẢN'}
            </PoeticButton>
          </PoeticCard>
        ))}
      </div>
    </section>
  );
};
