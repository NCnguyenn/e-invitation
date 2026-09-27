import type { TemplateCoverProps } from '../types';
import { WeddingFloral01Hero } from './WeddingFloral01Hero';
import '../fonts.css';
import '../template.css';

export function WeddingFloral01Cover({ event }: TemplateCoverProps) {
  return <div className="invitation-template"><div className="invitation-container">
    <WeddingFloral01Hero title={event.title} />
  </div></div>;
}
