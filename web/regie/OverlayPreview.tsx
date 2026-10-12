import { useEffect, useRef, useState } from 'react';

const WIDTH = 1920;

/** Affiche l'overlay réel en miniature : l'aperçu montre exactement ce que voit le chat. */
export function OverlayPreview() {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={box} className="preview">
      <iframe title="Aperçu de l’antenne" src="/overlay?preview=1" tabIndex={-1}
        style={{ transform: `scale(${scale})` }} />
    </div>
  );
}
