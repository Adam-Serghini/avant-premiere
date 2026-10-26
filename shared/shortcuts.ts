export type RequiredAction = 'next' | 'prev' | 'full' | 'trailer' | 'off';
export type PlayerCommand = 'togglePause' | 'back' | 'forward' | 'restart' | 'volumeUp' | 'volumeDown';
export type ShortcutAction = RequiredAction | PlayerCommand;

export interface KeyBinding {
  /** Touche physique (`KeyboardEvent.code`), qui sert à la reconnaître. */
  code: string;
  /** Ce qu'on affiche, pris au moment où la touche a été choisie. */
  label: string;
}

/** `null` n'est permis que pour une commande de bande-annonce. */
export type ShortcutMap = Record<ShortcutAction, KeyBinding | null>;

export const REQUIRED_ACTIONS: readonly RequiredAction[] = ['next', 'prev', 'full', 'trailer', 'off'];
export const PLAYER_COMMANDS: readonly PlayerCommand[] = ['togglePause', 'back', 'forward', 'restart', 'volumeUp', 'volumeDown'];
export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = [...REQUIRED_ACTIONS, ...PLAYER_COMMANDS];

export function isPlayerCommand(action: ShortcutAction): action is PlayerCommand {
  return (PLAYER_COMMANDS as readonly string[]).includes(action);
}

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  next: 'Film suivant',
  prev: 'Film précédent',
  full: 'Fiche',
  trailer: 'Bande-annonce',
  off: 'Masquer',
  togglePause: 'Pause / lecture',
  back: 'Reculer de 5 s',
  forward: 'Avancer de 5 s',
  restart: 'Revenir au début',
  volumeUp: 'Monter le son',
  volumeDown: 'Baisser le son',
};

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  next: { code: 'ArrowRight', label: '→' },
  prev: { code: 'ArrowLeft', label: '←' },
  full: { code: 'Digit1', label: '1' },
  trailer: { code: 'Digit2', label: '2' },
  off: { code: 'Digit3', label: '3' },
  togglePause: { code: 'Space', label: 'Espace' },
  back: { code: 'KeyJ', label: 'J' },
  forward: { code: 'KeyL', label: 'L' },
  restart: { code: 'Digit0', label: '0' },
  volumeUp: { code: 'ArrowUp', label: '↑' },
  volumeDown: { code: 'ArrowDown', label: '↓' },
};

/** Ce qu'on affiche pour une action sans touche. */
export function keyText(b: KeyBinding | null): string {
  return b ? b.label : '—';
}

/** Carte enregistrée par une version précédente : chaque commande absente prend sa touche par défaut si elle est libre, sinon rien. */
export function upgradeShortcuts(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  const used = Object.values(raw).filter(
    (v): v is KeyBinding => typeof v === 'object' && v !== null && typeof (v as KeyBinding).code === 'string',
  );
  for (const command of PLAYER_COMMANDS) {
    if (command in out) continue;
    const def = DEFAULT_SHORTCUTS[command] as KeyBinding;
    out[command] = used.some((b) => sameKey(b.code, def.code)) ? null : def;
    if (out[command]) used.push(def);
  }
  return out;
}

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
    const b = input[action] as Partial<KeyBinding> | null | undefined;
    if (b === null && isPlayerCommand(action)) {
      map[action] = null;
      continue;
    }
    if (!b || typeof b !== 'object') return fail(`Il manque la touche de « ${name} ».`);
    if (typeof b.code !== 'string' || !/^[A-Za-z0-9]{1,32}$/.test(b.code)) return fail(`Touche invalide pour « ${name} ».`);
    if (typeof b.label !== 'string' || b.label.trim() === '' || b.label.length > 16) {
      return fail(`Nom de touche invalide pour « ${name} ».`);
    }
    const reason = forbiddenReason(b.code);
    if (reason) return fail(reason);
    const taken = SHORTCUT_ACTIONS.find((a) => map[a] && sameKey(map[a]!.code, b.code as string));
    if (taken) return fail(`La touche « ${b.label} » sert déjà à « ${SHORTCUT_LABELS[taken]} ».`);
    map[action] = { code: b.code, label: b.label };
  }
  return { ok: true, map: map as ShortcutMap };
}
