import { useId } from 'react';

interface Props {
  /** page : écran entier fixe ; card : cartouche de l'overlay ; screen : plein écran de l'overlay. */
  variant: 'page' | 'card' | 'screen';
}

export function Grain({ variant }: Props) {
  const filterId = `grain-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <div className={`grain grain--${variant}`} aria-hidden="true">
      <svg>
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
      <span className="scratch scratch--a" />
      <span className="scratch scratch--b" />
      <span className="scratch scratch--c" />
      <span className="dust dust--a" />
      <span className="dust dust--b" />
      <span className="dust dust--c" />
    </div>
  );
}
