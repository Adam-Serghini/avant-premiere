import type { ReactNode } from 'react';

interface Props {
  current: 'prep' | 'regie';
  airDate: string | null;
  children?: ReactNode;
}

const PERFORATIONS = Array.from({ length: 60 }, (_, i) => i);

export function AppHeader({ current, airDate, children }: Props) {
  const query = airDate ? `?date=${airDate}` : '';
  return (
    <header className="app-header">
      <div className="perforations" aria-hidden="true">
        {PERFORATIONS.map((i) => (
          <span key={i} />
        ))}
      </div>
      <div className="header-inner">
        <div className="header-brand">
          <span className="logo">Avant-Première</span>
          {children}
        </div>
        <nav className="nav" aria-label="Sections">
          <a href={`/${query}`} aria-current={current === 'prep' ? 'page' : undefined}>Préparation</a>
          <a href={`/regie${query}`} aria-current={current === 'regie' ? 'page' : undefined}>Régie live</a>
        </nav>
      </div>
    </header>
  );
}
