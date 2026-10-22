import { useEffect, useRef, useState } from 'react';

/** Taille de référence de la source Navigateur dans le cadre de la scène React. */
export const OVERLAY_SIZE = { width: 1250, height: 725 } as const;

/** Affiche l'overlay réel en miniature : l'aperçu montre exactement ce que voit le chat. */
export function OverlayPreview() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / OVERLAY_SIZE.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="preview">
      <iframe title="Aperçu de l’antenne" src="/overlay?preview=1" tabIndex={-1}
        style={{ width: OVERLAY_SIZE.width, height: OVERLAY_SIZE.height, transform: `scale(${scale})` }} />
    </div>
  );
}
