import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../shared/shortcuts';
import { makeApp } from '../test/helpers';

const URL = '/api/settings/shortcuts';

describe('API raccourcis', () => {
  it('renvoie les touches par défaut tant que rien n’est enregistré', async () => {
    const { app } = await makeApp();
    expect((await app.inject(URL)).json()).toEqual(DEFAULT_SHORTCUTS);
  });

  it('enregistre une carte valide et la relit', async () => {
    const { app } = await makeApp();
    const map = { ...DEFAULT_SHORTCUTS, next: { code: 'KeyN', label: 'N' } };
    const put = await app.inject({ method: 'PUT', url: URL, payload: map });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual(map);
    expect((await app.inject(URL)).json()).toEqual(map);
  });

  it('refuse une carte invalide avec un message en français', async () => {
    const { app } = await makeApp();
    const map = { ...DEFAULT_SHORTCUTS, off: { code: 'Digit1', label: '1' } };
    const res = await app.inject({ method: 'PUT', url: URL, payload: map });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_shortcuts', message: 'La touche « 1 » sert déjà à « Fiche ».' });
  });

  it('revient aux défauts si la valeur enregistrée est abîmée', async () => {
    const { app, repo } = await makeApp();
    repo.setSetting('shortcuts', '{pas du json');
    expect((await app.inject(URL)).json()).toEqual(DEFAULT_SHORTCUTS);
    repo.setSetting('shortcuts', JSON.stringify({ next: { code: 'KeyN', label: 'N' } }));
    expect((await app.inject(URL)).json()).toEqual(DEFAULT_SHORTCUTS);
  });
});
