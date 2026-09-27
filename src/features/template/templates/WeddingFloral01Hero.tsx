import { asset, content } from '../content';

// Shared by the saved dashboard cover and the full guest/preview template.
export function WeddingFloral01Hero({ title }: { title: string }) {
  return (
    <section className="hero-section" aria-label={title}>
      <img src={asset('corner-leaf.png')} alt="" className="leaf-decor leaf-top-left" />
      <img src={asset('corner-leaf.png')} alt="" className="leaf-decor leaf-top-right" />
      <img src={asset('cap-icon.png')} alt="" className="hero-cap-icon" />
      <div className="hero-titles">
        <h1 className="hero-badge-title">{content.badge}</h1>
        <div className="hero-script-subtitle">{content.subtitle}</div>
      </div>
      <div className="hero-portrait-wrapper">
        <img src={asset('hero-portrait.webp')} alt={`Chân dung ${content.ownerName}`} className="hero-portrait-img" fetchPriority="high" />
        <img src={asset('flower-decor.png')} alt="" className="hero-flower-decor" />
        <img src={asset('spin-badge.png')} alt="" className="hero-spin-badge" />
        <img src={asset('sparkle.png')} alt="" className="hero-sparkle" />
        <div className="hero-owner-name">{content.ownerName}</div>
      </div>
    </section>
  );
}
