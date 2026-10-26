import { describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS, forbiddenReason, sameKey, upgradeShortcuts, validateShortcuts } from './shortcuts';

const valid = (patch: object) => validateShortcuts({ ...DEFAULT_SHORTCUTS, ...patch });

describe('raccourcis : règles', () => {
  it('traite la rangée du haut et le pavé numérique comme la même touche', () => {
    expect(sameKey('Digit1', 'Numpad1')).toBe(true);
    expect(sameKey('Numpad2', 'Digit2')).toBe(true);
    expect(sameKey('Digit1', 'Digit2')).toBe(false);
    expect(sameKey('KeyA', 'KeyA')).toBe(true);
  });

  it('interdit Échap, Tab et les touches de modification seules', () => {
    expect(forbiddenReason('Escape')).toMatch(/Échap/);
    expect(forbiddenReason('Tab')).toMatch(/Tab/);
    for (const code of ['ShiftLeft', 'ControlRight', 'AltLeft', 'AltGraph', 'MetaLeft', 'CapsLock']) {
      expect(forbiddenReason(code)).not.toBeNull();
    }
    expect(forbiddenReason('KeyN')).toBeNull();
  });

  it('accepte les touches par défaut et une carte personnalisée', () => {
    expect(validateShortcuts(DEFAULT_SHORTCUTS)).toEqual({ ok: true, map: DEFAULT_SHORTCUTS });
    expect(valid({ next: { code: 'KeyN', label: 'N' } }).ok).toBe(true);
  });

  it('refuse une carte incomplète, en double ou mal formée', () => {
    const { off: _off, ...missing } = DEFAULT_SHORTCUTS;
    expect(validateShortcuts(missing)).toMatchObject({ ok: false, message: expect.stringMatching(/Masquer/) });
    expect(valid({ extra: { code: 'KeyX', label: 'X' } })).toMatchObject({ ok: false });
    expect(valid({ full: { code: 'Numpad2', label: '2' } })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/sert déjà à « Fiche »/),
    });
    expect(valid({ next: { code: 'Escape', label: 'Échap' } })).toMatchObject({ ok: false });
    expect(valid({ next: { code: 'Key N', label: 'N' } })).toMatchObject({ ok: false });
    expect(valid({ next: { code: 'KeyN', label: '' } })).toMatchObject({ ok: false });
    expect(valid({ next: { code: 'KeyN', label: 'x'.repeat(17) } })).toMatchObject({ ok: false });
    expect(validateShortcuts(null)).toMatchObject({ ok: false });
    expect(validateShortcuts([])).toMatchObject({ ok: false });
  });

  it('accepte l’absence de touche pour une commande de bande-annonce seulement', () => {
    expect(valid({ back: null }).ok).toBe(true);
    expect(valid({ next: null })).toMatchObject({ ok: false, message: 'Il manque la touche de « Film suivant ».' });
    expect(valid({ back: { code: 'Space', label: 'Espace' } }).ok).toBe(false);
  });

  it('met à niveau une carte de l’ancienne version sans écraser ses touches', () => {
    const old = {
      next: { code: 'KeyJ', label: 'J' },
      prev: DEFAULT_SHORTCUTS.prev,
      full: DEFAULT_SHORTCUTS.full,
      trailer: DEFAULT_SHORTCUTS.trailer,
      off: DEFAULT_SHORTCUTS.off,
    };
    const up = upgradeShortcuts(old);
    expect(up.next).toEqual({ code: 'KeyJ', label: 'J' });
    expect(up.back).toBeNull();
    expect(up.forward).toEqual(DEFAULT_SHORTCUTS.forward);
    expect(validateShortcuts(up).ok).toBe(true);
  });
});
