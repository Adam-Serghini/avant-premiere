export type ShortcutAction = 'next' | 'prev' | 'full' | 'trailer' | 'off';

export interface KeyBinding {
  /** Touche physique (`KeyboardEvent.code`), qui sert à la reconnaître. */
  code: string;
  /** Ce qu'on affiche, pris au moment où la touche a été choisie. */
  label: string;
}

export type ShortcutMap = Record<ShortcutAction, KeyBinding>;

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = ['next', 'prev', 'full', 'trailer', 'off'];

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  next: 'Film suivant',
  prev: 'Film précédent',
  full: 'Fiche',
  trailer: 'Bande-annonce',
  off: 'Masquer',
};

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  next: { code: 'ArrowRight', label: '→' },
  prev: { code: 'ArrowLeft', label: '←' },
  full: { code: 'Digit1', label: '1' },
  trailer: { code: 'Digit2', label: '2' },
  off: { code: 'Digit3', label: '3' },
};

const normalize = (code: string) => code.replace(/^Numpad(\d)$/, 'Digit$1');

/** Deux codes désignent-ils la même touche ? Le 1 du pavé numérique vaut le 1 de la rangée du haut. */
export function sameKey(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

export function forbiddenReason(code: string): string | null {
  if (code === 'Escape') return 'Échap sert à annuler : choisis une autre touche.';
  if (code === 'Tab') return 'Tab sert à se déplacer dans la page : choisis une autre touche.';
  if (/^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock)(Left|Right)?$/.test(code)) {
    return 'Les touches Maj, Ctrl, Alt et Windows ne peuvent pas servir seules.';
  }
  return null;
}

type Validation = { ok: true; map: ShortcutMap } | { ok: false; message: string };

export function validateShortcuts(value: unknown): Validation {
  const fail = (message: string): Validation => ({ ok: false, message });
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('Les raccourcis envoyés sont illisibles.');
  }
  const input = value as Record<string, unknown>;
  const unknownKey = Object.keys(input).find((k) => !(SHORTCUT_ACTIONS as readonly string[]).includes(k));
  if (unknownKey) return fail(`Action inconnue : « ${unknownKey} ».`);

  const map: Partial<ShortcutMap> = {};
  for (const action of SHORTCUT_ACTIONS) {
    const name = SHORTCUT_LABELS[action];
    const b = input[action] as Partial<KeyBinding> | undefined;
    if (!b || typeof b !== 'object') return fail(`Il manque la touche de « ${name} ».`);
    if (typeof b.code !== 'string' || !/^[A-Za-z0-9]{1,32}$/.test(b.code)) return fail(`Touche invalide pour « ${name} ».`);
    if (typeof b.label !== 'string' || b.label.trim() === '' || b.label.length > 16) {
      return fail(`Nom de touche invalide pour « ${name} ».`);
    }
    const reason = forbiddenReason(b.code);
    if (reason) return fail(reason);
    const taken = SHORTCUT_ACTIONS.find((a) => map[a] && sameKey(map[a].code, b.code as string));
    if (taken) return fail(`La touche « ${b.label} » sert déjà à « ${SHORTCUT_LABELS[taken]} ».`);
    map[action] = { code: b.code, label: b.label };
  }
  return { ok: true, map: map as ShortcutMap };
}
