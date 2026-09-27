import type { TemplateCoverProps } from '../types';
import { editorialAsset } from '../graduation-editorial-content';
import '../fonts.css';
import '../template.css';
import '../graduation-editorial.css';

export function GraduationEditorial01Cover({ event }: TemplateCoverProps) {
  return <div className="invitation-template graduation-editorial-template"><div className="invitation-container editorial-cover"><div className="editorial-section-label">LỄ TỐT NGHIỆP · 2026</div><h1>THANH<br />XUÂN</h1><img src={editorialAsset('hero-portrait.webp')} alt="" /><p>sang trang.</p><strong>{event.title}</strong></div></div>;
}
