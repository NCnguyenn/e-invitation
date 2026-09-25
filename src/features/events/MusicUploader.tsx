'use client';

import { useEffect, useRef, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setError('');
    setMessage('');
    setStatus('idle');

    if (file) {
      if (!file.name.toLowerCase().endsWith('.mp3')) {
        setError('Chỉ chấp nhận tệp có đuôi .mp3.');
        return;
      }
      if (file.type && file.type !== 'audio/mpeg') {
        setError('Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).');
        return;
      }
      if (file.size <= 0 || file.size > 10_485_760) {
        setError('Dung lượng tệp phải lớn hơn 0 và không vượt quá 10 MiB (10.485.760 bytes).');
        return;
      }
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError('Vui lòng chọn một tệp MP3 trước khi tải lên.');
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.mp3')) {
      setError('Chỉ chấp nhận tệp có đuôi .mp3.');
      return;
    }

    if (selectedFile.type && selectedFile.type !== 'audio/mpeg') {
      setError('Chỉ chấp nhận tệp định dạng MP3 (audio/mpeg).');
      return;
    }

    if (selectedFile.size <= 0 || selectedFile.size > 10_485_760) {
      setError('Dung lượng tệp phải lớn hơn 0 và không vượt quá 10 MiB.');
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
      setMessage(hasMusic ? 'Đã thay nhạc thành công!' : 'Đã tải lên và lưu nhạc thành công!');

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
    <section className="editor-card music-uploader-card" aria-labelledby="music-heading">
      <h2 id="music-heading">Nhạc nền thiệp mời</h2>
      <p className="card-description">
        Tải lên bản nhạc MP3 để phát khi khách mở thiệp. Dung lượng tối đa 10 MiB (10.485.760 bytes).
      </p>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setPreviewError('Chưa phát được nhạc nghe thử. Vui lòng thử lại.');
        }}
      />

      <div className="music-status-row">
        <span className="music-status-label">Trạng thái hiện tại:</span>
        <span className={`badge ${hasMusic ? 'badge-accepted' : 'badge-pending'}`}>
          {hasMusic ? 'Đã có nhạc nền' : 'Chưa có nhạc nền'}
        </span>

        {hasMusic && (
          <button
            type="button"
            className="action-btn open-btn preview-play-btn"
            onClick={togglePreview}
            disabled={previewLoading || isBusy}
          >
            {previewLoading
              ? 'Đang chuẩn bị…'
              : isPlaying
              ? '❚❚ Tạm dừng nghe thử'
              : '▶ Nghe thử'}
          </button>
        )}
      </div>

      {previewError && (
        <p className="editor-error" role="alert" style={{ marginTop: '8px' }}>
          {previewError}
        </p>
      )}

      <div className="music-upload-box" style={{ marginTop: '18px' }}>
        <label htmlFor="music-file-input" className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
          {hasMusic ? 'Thay bài hát mới' : 'Chọn tệp nhạc MP3'}
        </label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="music-file-input"
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,.mp3"
            onChange={handleFileChange}
            disabled={isBusy}
            style={{ fontSize: '13px' }}
          />

          {status === 'uploaded_unconfirmed' ? (
            <button
              type="button"
              className="button-primary"
              onClick={runFinalize}
              style={{ minHeight: '40px', padding: '8px 16px' }}
            >
              Thử lại xác nhận
            </button>
          ) : (
            <button
              type="button"
              className="button-secondary"
              onClick={handleUpload}
              disabled={!selectedFile || isBusy}
              style={{ minHeight: '40px', padding: '8px 16px' }}
            >
              {status === 'preparing'
                ? 'Đang chuẩn bị…'
                : status === 'uploading'
                ? 'Đang tải lên…'
                : status === 'finalizing'
                ? 'Đang xác nhận…'
                : hasMusic
                ? 'Thay nhạc'
                : 'Tải lên'}
            </button>
          )}
        </div>
      </div>

      <div className="editor-feedback" style={{ marginTop: '12px' }}>
        {status === 'uploading' && (
          <p role="status" aria-live="polite">
            Đang tải tệp MP3 lên kho lưu trữ…
          </p>
        )}
        {status === 'finalizing' && (
          <p role="status" aria-live="polite">
            Đang xác nhận thông tin nhạc sự kiện…
          </p>
        )}
        {error && (
          <p className="editor-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
