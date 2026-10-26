// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../shared/shortcuts';
import { ShortcutsDialog } from './ShortcutsDialog';

beforeAll(() => {
  // jsdom n'implémente pas l'ouverture modale des <dialog>.
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(cleanup);

function setup(map = DEFAULT_SHORTCUTS) {
  const onSave = vi.fn(async () => null as string | null);
  const onClose = vi.fn();
  render(<ShortcutsDialog open map={map} onSave={onSave} onClose={onClose} />);
  const modify = (i: number) => fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[i]!);
  return { onSave, onClose, modify };
}

describe('fenêtre des raccourcis', () => {
  it('capture une nouvelle touche et l’enregistre', async () => {
    const { onSave, modify } = setup();
    modify(0);
    expect(screen.getByText(/Appuie sur une touche/)).toBeTruthy();
    fireEvent.keyDown(window, { code: 'KeyN', key: 'n' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...DEFAULT_SHORTCUTS, next: { code: 'KeyN', label: 'N' } }));
  });

  it('propose d’échanger une touche déjà prise', async () => {
    const { onSave, modify } = setup();
    modify(0);
    fireEvent.keyDown(window, { code: 'Digit1', key: '&' });
    expect(screen.getByRole('alert').textContent).toMatch(/La touche « & » sert déjà à Fiche/);
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Échanger' }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ ...DEFAULT_SHORTCUTS, next: DEFAULT_SHORTCUTS.full, full: DEFAULT_SHORTCUTS.next }),
    );
  });

  it('annule la capture avec Échap sans fermer la fenêtre', () => {
    const { onSave, onClose, modify } = setup();
    modify(1);
    const dialog = document.querySelector('dialog')!;
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
    expect(screen.queryByText(/Appuie sur une touche/)).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Échap pendant la question d’échange la ferme sans fermer la fenêtre', () => {
    const { onSave, onClose, modify } = setup();
    modify(0);
    fireEvent.keyDown(window, { code: 'Digit1', key: '&' });
    expect(screen.getByRole('alert')).toBeTruthy();
    const dialog = document.querySelector('dialog')!;
    const cancel = new Event('cancel', { cancelable: true });
    act(() => {
      dialog.dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(dialog.open).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('refuse une touche interdite et reste en capture', () => {
    const { onSave, modify } = setup();
    modify(0);
    fireEvent.keyDown(window, { code: 'Tab', key: 'Tab' });
    expect(screen.getByRole('alert').textContent).toMatch(/Tab/);
    expect(screen.getByText(/Appuie sur une touche/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('remet les touches par défaut et affiche une erreur d’enregistrement', async () => {
    const { onSave } = setup();
    onSave.mockResolvedValueOnce('Le serveur Avant-Première ne répond pas. Est-il bien lancé ?');
    fireEvent.click(screen.getByRole('button', { name: 'Touches par défaut' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(DEFAULT_SHORTCUTS));
    expect((await screen.findByRole('alert')).textContent).toMatch(/ne répond pas/);
  });

  it('liste les 11 actions et signale celles sans touche', () => {
    setup({ ...DEFAULT_SHORTCUTS, back: null });
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(11);
    expect(screen.getByText('Aucune touche, à choisir')).toBeTruthy();
    expect(screen.getByText('Reculer de 5 s')).toBeTruthy();
  });

  it('n’offre pas d’échange qui priverait une action obligatoire de sa touche', () => {
    const { onSave, modify } = setup({ ...DEFAULT_SHORTCUTS, back: null });
    modify(6);
    fireEvent.keyDown(window, { code: 'ArrowRight', key: 'ArrowRight' });
    expect(screen.queryByRole('button', { name: 'Échanger' })).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/choisis une autre touche/);
    expect(onSave).not.toHaveBeenCalled();
  });
});
