import { NOTE_SECTIONS } from '../../shared/notes';
import type { EmissionFilm } from '../../shared/types';

export function PrivateNotes({ ef }: { ef: EmissionFilm }) {
  const filled = NOTE_SECTIONS.filter(({ field }) => ef[field].trim() !== '');
  return (
    <div className="private-notes">
      <span className="label">Mes notes · pas à l’antenne{ef.score !== null ? ` · ${ef.score}/10` : ''}</span>
      {filled.length === 0 ? (
        <p>Aucune note pour ce film.</p>
      ) : (
        filled.map(({ field, label }) => (
          <section key={field} className="private-note">
            <h2 className="label">{label}</h2>
            <p>{ef[field]}</p>
          </section>
        ))
      )}
    </div>
  );
}
