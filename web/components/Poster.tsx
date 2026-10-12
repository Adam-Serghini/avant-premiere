import { useEffect, useState } from 'react';

interface Props {
  url: string | null;
  title: string;
  small?: boolean;
}

export function Poster({ url, title, small = false }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const size = small ? ' poster--small' : '';

  if (url && !failed) {
    return (
      <div className={`poster${size}`}>
        <img src={url} alt={`Affiche de ${title}`} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div className={`poster poster--empty${size}`} role="img" aria-label={`Affiche de ${title} indisponible`}>
      <span className="label">Affiche</span>
      <span className="poster-title">{title}</span>
    </div>
  );
}
