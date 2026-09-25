'use client';
import { useRef, useState } from 'react';
export function Gallery({ photos }: { photos: { src: string; caption: string }[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const move = (step: number) => setIndex(current => (current + step + photos.length) % photos.length);
  if (!photos.length) return null;
  return <section className="gallery-section" aria-labelledby="gallery-heading">
    <h2 className="gallery-title" id="gallery-heading">Lưu Giữ Kỉ Niệm</h2>
    <div className="gallery-grid">
      {photos.map((photo, i) => <button type="button" className="gallery-item" key={photo.src} aria-label={`Xem ảnh ${i + 1}`}
        onClick={event => { opener.current = event.currentTarget; setIndex(i); dialog.current?.showModal(); }}>
        <img src={photo.src} alt={photo.caption} loading="lazy" />
      </button>)}
    </div>
    <dialog className="photo-dialog" ref={dialog} aria-label="Album kỷ niệm"
      onClose={() => opener.current?.focus()}
      onKeyDown={event => {
        if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      }}>
      <button type="button" className="photo-close" aria-label="Đóng ảnh" onClick={() => dialog.current?.close()}>×</button>
      <figure><img src={photos[index].src} alt={photos[index].caption} />
        <figcaption aria-live="polite">{index + 1}/{photos.length} · {photos[index].caption}</figcaption>
      </figure>
      <div className="photo-navigation">
        <button type="button" onClick={() => move(-1)} aria-label="Ảnh trước">←</button>
        <button type="button" onClick={() => move(1)} aria-label="Ảnh tiếp theo">→</button>
      </div>
    </dialog>
  </section>;
}
