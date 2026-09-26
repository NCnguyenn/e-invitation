'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';
import { EditorIcon } from './EditorIcon';
import editor from './event-editor.module.css';
import styles from './music-upload.module.css';

type UploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'finalizing'
  | 'uploaded_unconfirmed'
  | 'success'
  | 'error';

export function MusicUploader({
  hasMusic,
  onMusicUpdated,
}: {
  hasMusic: boolean;
  onMusicUpdated: (hasMusic: boolean) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const cachedPreviewUrlRef = useRef<{ url: string; expiresAtMs: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const audio = audioRef.current;
    return () => {
      isMountedRef.current = false;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, []);

  function validateFile(file: File): string | null {
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      return 'Chỉ chấp nhận tệp có đuôi .mp3.';
    }
    if (file.type && file.type !== 'audio/mpeg') {
      return 'Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).';
    }
    if (file.size <= 0 || file.size > 10_485_760) {
      return 'Dung lượng tệp phải lớn hơn 0 và không vượt quá 10 MiB (10.485.760 bytes).';
    }
    return null;
  }

  function handleFileSelected(file: File | null) {
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setError('');
    setMessage('');
    setStatus('idle');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    handleFileSelected(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (isBusy) return;
    const file = e.dataTransfer.files?.[0] || null;
    handleFileSelected(file);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError('Vui lòng chọn một tệp MP3 trước khi tải lên.');
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setMessage('');
    setStatus('preparing');

    let prepareData: { bucket: string; path: string };
    try {
      const prepRes = await fetch('/api/host/audio/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: selectedFile.type || 'audio/mpeg', fileSize: selectedFile.size }),
      });
      const prepBody = await prepRes.json();
      if (!prepRes.ok) {
        setError(prepBody.message || 'Không thể chuẩn bị tải nhạc. Vui lòng thử lại.');
        setStatus('error');
        return;
      }
      prepareData = prepBody;
    } catch {
      setError('Không thể kết nối máy chủ để chuẩn bị tải nhạc.');
      setStatus('error');
      return;
    }

    // Direct upload to Supabase Storage using browser client
    setStatus('uploading');
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(prepareData.bucket)
        .upload(prepareData.path, selectedFile, {
          contentType: 'audio/mpeg',
          upsert: true,
          cacheControl: '0',
        });

      if (uploadError) {
        setError('Tải tệp lên kho lưu trữ thất bại. Vui lòng thử lại.');
        setStatus('error');
        return;
      }
    } catch {
      setError('Lỗi khi tải tệp lên kho lưu trữ.');
      setStatus('error');
      return;
    }

    // Finalize
    await runFinalize();
  }

  async function runFinalize() {
    setStatus('finalizing');
    setError('');

    try {
      const finRes = await fetch('/api/host/audio/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const finBody = await finRes.json();
      if (!finRes.ok) {
        setStatus('uploaded_unconfirmed');
        setError('Đã tải lên, chưa xác nhận. Vui lòng bấm “Thử lại xác nhận”.');
        return;
      }

      setStatus('success');
      setMessage(hasMusic ? 'Đã thay bài hát thành công!' : 'Đã tải lên và lưu nhạc nền thành công!');

      // Reset old audio element preview
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
      cachedPreviewUrlRef.current = null;
      setIsPlaying(false);

      // Reset file input
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      onMusicUpdated(true);
    } catch {
      setStatus('uploaded_unconfirmed');
      setError('Đã tải lên, chưa xác nhận. Vui lòng bấm “Thử lại xác nhận”.');
    }
  }

  async function togglePreview() {
    const audio = audioRef.current;
    if (!audio || !hasMusic) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError('');

    try {
      const now = Date.now();
      const cached = cachedPreviewUrlRef.current;
      const isCachedValid = cached && cached.expiresAtMs - now > 60_000;

      if (!audio.getAttribute('src') || !isCachedValid) {
        const res = await fetch('/api/host/audio/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.message || 'Không thể tạo liên kết nghe thử.');
        }
        if (!body.signedUrl) {
          throw new Error('Không nhận được liên kết nghe thử từ máy chủ.');
        }

        cachedPreviewUrlRef.current = {
          url: body.signedUrl,
          expiresAtMs: now + (body.expiresIn || 3600) * 1000,
        };
        audio.src = body.signedUrl;
      }

      await audio.play();
      setIsPlaying(true);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      audio.removeAttribute('src');
      audio.load();
      cachedPreviewUrlRef.current = null;
      setIsPlaying(false);
      setPreviewError(err instanceof Error ? err.message : 'Không thể phát nhạc nghe thử.');
    } finally {
      if (isMountedRef.current) {
        setPreviewLoading(false);
      }
    }
  }

  const isBusy = status === 'preparing' || status === 'uploading' || status === 'finalizing';

  return (
    <section className={editor.card} aria-labelledby="music-heading">
      <audio ref={audioRef} preload="none" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onError={() => {
        setIsPlaying(false);
        setPreviewError('Chưa phát được nhạc nghe thử. Vui lòng thử lại.');
      }} />
      <div className={styles.header}>
        <span className={editor.iconBadge}><EditorIcon name="music" /></span>
        <div className={styles.headingContent}>
          <div className={styles.titleRow}>
            <h2 id="music-heading" className={editor.cardTitle}>Nhạc nền thiệp mời</h2>
            <span className={editor.badge}>{hasMusic ? 'Đã có nhạc' : 'Chưa có nhạc'}</span>
          </div>
          <p className={editor.cardDescription}>Nhạc phát sau khi khách mở thiệp.</p>
        </div>
      </div>
      {hasMusic && <div className={styles.player}>
        <button type="button" onClick={togglePreview} disabled={previewLoading || isBusy}>
          {previewLoading ? 'Đang tải nhạc…' : isPlaying ? 'Tạm dừng nghe thử' : 'Nghe thử nhạc'}
        </button>
      </div>}
      {previewError && <p className={styles.error} role="alert">{previewError}</p>}
      <input id="music-file-input" ref={fileInputRef} type="file" accept="audio/mpeg,.mp3" onChange={handleFileChange} disabled={isBusy} hidden aria-label="Chọn tệp nhạc MP3" />
      <div className={[styles.dropzone, isDragOver ? styles.dragOver : ''].join(' ')}
        onDragOver={(e) => { e.preventDefault(); if (!isBusy) setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}
        onClick={() => { if (!isBusy) fileInputRef.current?.click(); }}
        role="button" tabIndex={isBusy ? -1 : 0} aria-disabled={isBusy}
        aria-label={hasMusic ? 'Chọn tệp nhạc thay thế' : 'Chọn tệp nhạc'}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isBusy) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}>
        <div className={styles.dropContent}>
          <EditorIcon name="upload" />
          <div className={styles.dropText}>
            {selectedFile ? <><strong>{selectedFile.name}</strong><small>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MiB · Sẵn sàng tải lên</small></> : <><strong>{hasMusic ? 'Kéo thả hoặc chọn nhạc thay thế' : 'Kéo thả hoặc chọn tệp nhạc'}</strong><small>Định dạng MP3 · Tối đa 10 MiB</small></>}
          </div>
        </div>
      </div>
      {(selectedFile || status === 'uploaded_unconfirmed') && <div className={styles.actions}>
        {selectedFile && <button type="button" className={styles.cancel} onClick={() => {
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }} disabled={isBusy}>Hủy chọn</button>}
        {status === 'uploaded_unconfirmed'
          ? <button type="button" className={editor.primary} onClick={runFinalize}>Thử lại xác nhận</button>
          : <button type="button" className={editor.primary} onClick={handleUpload} disabled={isBusy}>
              {status === 'preparing' ? 'Đang chuẩn bị…' : status === 'uploading' ? 'Đang tải nhạc…' : status === 'finalizing' ? 'Đang xác nhận…' : hasMusic ? 'Thay nhạc nền' : 'Tải nhạc lên thiệp'}
            </button>}
      </div>}
      <div className={styles.feedback}>
        {status === 'uploading' && <p className={styles.status} role="status">Đang tải tệp MP3 lên kho lưu trữ…</p>}
        {status === 'finalizing' && <p className={styles.status} role="status">Đang liên kết nhạc với thiệp mời…</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        {message && <p className={styles.success} role="status">{message}</p>}
      </div>
    </section>
  );
}
