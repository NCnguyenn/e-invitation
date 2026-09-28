import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  User,
  Users,
  MessageSquare,
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';
import { PoeticButton } from '../common/PoeticButton';

export const LinkGeneratorModal: React.FC = () => {
  const { isLinkGenOpen, setIsLinkGenOpen } = useConfig();

  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const [singleName, setSingleName] = useState('');
  const [singleGreeting, setSingleGreeting] = useState('TRÂN TRỌNG KÍNH MỜI');
  const [singleGeneratedUrl, setSingleGeneratedUrl] = useState('');

  const [batchText, setBatchText] = useState('');
  const [batchGreeting, setBatchGreeting] = useState('TRÂN TRỌNG KÍNH MỜI');
  const [batchList, setBatchList] = useState<Array<{ name: string; url: string }>>([]);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);

  if (!isLinkGenOpen) return null;

  const getBaseUrl = () => {
    return window.location.origin + window.location.pathname;
  };

  const handleGenerateSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;

    const base = getBaseUrl();
    const url = `${base}?guest=${encodeURIComponent(
      singleName.trim()
    )}&greeting=${encodeURIComponent(singleGreeting)}`;

    setSingleGeneratedUrl(url);
  };

  const handleCopySingleUrl = () => {
    if (!singleGeneratedUrl) return;
    navigator.clipboard.writeText(singleGeneratedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopySingleMsg = () => {
    if (!singleGeneratedUrl) return;
    const msg = `Thương gửi ${singleName},\nTrân trọng kính mời bạn đến chung vui trong ngày lễ tốt nghiệp ngập tràn sắc hoa của mình nhé!\n👉 Mở thiệp tại đây: ${singleGeneratedUrl}`;
    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const handleGenerateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const base = getBaseUrl();
    const results = lines.map((name) => ({
      name,
      url: `${base}?guest=${encodeURIComponent(name)}&greeting=${encodeURIComponent(
        batchGreeting
      )}`,
    }));

    setBatchList(results);
  };

  const handleCopyBatchItem = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedBatchIndex(index);
    setTimeout(() => setCopiedBatchIndex(null), 2000);
  };

  const handleCopyAllBatch = () => {
    if (batchList.length === 0) return;
    const text = batchList.map((item) => `${item.name}: ${item.url}`).join('\n');
    navigator.clipboard.writeText(text);
    alert('Đã sao chép toàn bộ danh sách link khách mời!');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl border border-rosegold/50 shadow-[0_20px_60px_rgba(221,167,165,0.4)] overflow-hidden flex flex-col"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-rose-100 bg-rose-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 text-rose-500 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-poetic-text">
                  TẠO THIỆP MỜI CHO TỪNG KHÁCH
                </h3>
                <p className="text-xs font-serif italic text-poetic-muted">
                  Tạo link riêng hiển thị đúng tên từng người thân yêu trên thiệp
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsLinkGenOpen(false)}
              className="w-9 h-9 rounded-full bg-white text-stone-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex p-3 gap-2 bg-rose-50/30 border-b border-rose-100">
            <button
              onClick={() => setTab('single')}
              className={`flex-1 py-2.5 px-4 font-serif text-xs sm:text-sm font-semibold rounded-full transition-all flex items-center justify-center gap-2 ${
                tab === 'single'
                  ? 'bg-rose-400 text-white shadow-sm'
                  : 'text-poetic-muted hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              <User className="w-4 h-4" />
              Tạo Cho 1 Khách
            </button>

            <button
              onClick={() => setTab('batch')}
              className={`flex-1 py-2.5 px-4 font-serif text-xs sm:text-sm font-semibold rounded-full transition-all flex items-center justify-center gap-2 ${
                tab === 'batch'
                  ? 'bg-rose-400 text-white shadow-sm'
                  : 'text-poetic-muted hover:text-rose-600 hover:bg-rose-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Tạo Hàng Loạt (Excel)
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {tab === 'single' ? (
              <div>
                <form onSubmit={handleGenerateSingle} className="space-y-4">
                  <div>
                    <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1.5 font-semibold">
                      TÊN KHÁCH MỜI THÂN THƯƠNG <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Hoàng Yến, Minh Thư, Anh Hoàng & Chị Lan..."
                      value={singleName}
                      onChange={(e) => setSingleName(e.target.value)}
                      className="w-full px-4 py-3 bg-rose-50/40 border border-rose-200 rounded-2xl text-poetic-text font-serif text-sm focus:outline-none focus:border-rose-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1.5 font-semibold">
                      LỜI XƯNG HÔ / LỜI MỜI
                    </label>
                    <select
                      value={singleGreeting}
                      onChange={(e) => setSingleGreeting(e.target.value)}
                      className="w-full px-4 py-3 bg-rose-50/40 border border-rose-200 rounded-2xl text-poetic-text font-serif text-sm focus:outline-none focus:border-rose-400 transition-all"
                    >
                      <option value="TRÂN TRỌNG KÍNH MỜI">TRÂN TRỌNG KÍNH MỜI (Mặc định)</option>
                      <option value="THÂN MỜI">THÂN MỜI (Bạn bè thân thiết)</option>
                      <option value="THƯƠNG MỜI">THƯƠNG MỜI (Ấm áp, gần gũi)</option>
                      <option value="KÍNH MỜI">KÍNH MỜI (Thầy cô, bậc trưởng bối)</option>
                    </select>
                  </div>

                  <PoeticButton variant="primary" size="md" fullWidth type="submit">
                    Tạo Link Thiệp Ngay 🌸
                  </PoeticButton>
                </form>

                {singleGeneratedUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-3"
                  >
                    <div className="font-serif text-xs text-rose-600 font-bold uppercase">
                      ĐƯỜNG LINK THIỆP ĐÃ SẴN SÀNG:
                    </div>

                    <div className="p-3 bg-white border border-rose-200 rounded-xl font-mono text-xs text-rose-900 break-all">
                      {singleGeneratedUrl}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <PoeticButton
                        variant="softpink"
                        size="sm"
                        onClick={handleCopySingleUrl}
                        icon={copiedUrl ? <Check className="w-3.5 h-3.5 text-rose-600" /> : <Copy className="w-3.5 h-3.5 text-rose-600" />}
                      >
                        {copiedUrl ? 'ĐÃ COPY LINK' : 'COPY LINK'}
                      </PoeticButton>

                      <PoeticButton
                        variant="rosegold"
                        size="sm"
                        asAnchor
                        href={singleGeneratedUrl}
                        target="_blank"
                        icon={<ExternalLink className="w-3.5 h-3.5" />}
                      >
                        MỞ XEM THỬ
                      </PoeticButton>

                      <PoeticButton
                        variant="cream"
                        size="sm"
                        onClick={handleCopySingleMsg}
                        icon={copiedMsg ? <Check className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5 text-rose-500" />}
                      >
                        {copiedMsg ? 'ĐÃ COPY TIN' : 'COPY TIN NHẮN'}
                      </PoeticButton>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <div>
                <form onSubmit={handleGenerateBatch} className="space-y-4">
                  <div>
                    <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1.5 font-semibold">
                      DANH SÁCH TÊN KHÁCH (MỖI DÒNG 1 TÊN)
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder={"Hoàng Yến\nMinh Thư\nBạn Tuấn NEU\nGia đình Bác Hải"}
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      className="w-full px-4 py-3 bg-rose-50/40 border border-rose-200 rounded-2xl text-poetic-text font-serif text-sm focus:outline-none focus:border-rose-400 transition-all resize-none"
                    />
                    <div className="text-[11px] font-serif italic text-poetic-muted mt-1">
                      💡 Mẹo: Bạn có thể copy trực tiếp 1 cột tên từ bảng tính Excel rồi dán vào đây.
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block font-serif text-xs uppercase tracking-widest text-poetic-text mb-1.5 font-semibold">
                      LỜI XƯNG HÔ CHUNG
                    </label>
                    <select
                      value={batchGreeting}
                      onChange={(e) => setBatchGreeting(e.target.value)}
                      className="w-full px-4 py-3 bg-rose-50/40 border border-rose-200 rounded-2xl text-poetic-text font-serif text-sm focus:outline-none focus:border-rose-400 transition-all"
                    >
                      <option value="TRÂN TRỌNG KÍNH MỜI">TRÂN TRỌNG KÍNH MỜI</option>
                      <option value="THÂN MỜI">THÂN MỜI</option>
                      <option value="THƯƠNG MỜI">THƯƠNG MỜI</option>
                      <option value="KÍNH MỜI">KÍNH MỜI</option>
                    </select>
                  </div>

                  <PoeticButton variant="primary" size="md" fullWidth type="submit">
                    Tạo Toàn Bộ Danh Sách Link 🌸
                  </PoeticButton>
                </form>

                {batchList.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xs text-rose-600 uppercase font-bold">
                        TỔNG CỘNG: {batchList.length} KHÁCH MỜI
                      </span>
                      <button
                        onClick={handleCopyAllBatch}
                        className="px-3.5 py-1 bg-rose-100 hover:bg-rose-200 text-xs font-serif font-bold uppercase rounded-full text-rose-700 transition-colors flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy Tất Cả
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {batchList.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="overflow-hidden">
                            <strong className="block text-poetic-text font-serif truncate">
                              {item.name}
                            </strong>
                            <span className="font-mono text-[11px] text-poetic-muted truncate block">
                              {item.url}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleCopyBatchItem(item.url, idx)}
                              className="p-1.5 bg-white hover:bg-rose-100 rounded-full text-rose-600 transition-colors shadow-sm"
                            >
                              {copiedBatchIndex === idx ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-white hover:bg-rose-100 rounded-full text-rose-600 transition-colors shadow-sm"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
