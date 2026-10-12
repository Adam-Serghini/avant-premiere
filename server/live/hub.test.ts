import { describe, expect, it, vi } from 'vitest';
import type { LiveSnapshot } from '../../shared/types';
import { LiveHub } from './hub';

function build(overlayConnected: boolean): LiveSnapshot {
  return {
    state: { emissionId: null, airDate: null, position: 0, mode: 'card' },
    total: 0,
    rundown: [],
    current: null,
    overlayConnected,
  };
}

describe('LiveHub', () => {
  it('envoie l’instantané à l’arrivée d’un abonné', () => {
    const hub = new LiveHub(build);
    const send = vi.fn();
    hub.add({ kind: 'other', send });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ overlayConnected: false }));
  });

  it('signale la connexion et la déconnexion d’OBS à tous', () => {
    const hub = new LiveHub(build);
    const regie = vi.fn();
    hub.add({ kind: 'other', send: regie });
    const remove = hub.add({ kind: 'overlay', send: vi.fn() });
    expect(hub.overlayConnected()).toBe(true);
    expect(regie).toHaveBeenLastCalledWith(expect.objectContaining({ overlayConnected: true }));
    remove();
    expect(hub.overlayConnected()).toBe(false);
    expect(regie).toHaveBeenLastCalledWith(expect.objectContaining({ overlayConnected: false }));
  });

  it('écarte un abonné dont l’envoi échoue', () => {
    const hub = new LiveHub(build);
    const broken = vi.fn(() => {
      throw new Error('socket fermée');
    });
    hub.add({ kind: 'overlay', send: broken });
    expect(hub.overlayConnected()).toBe(false);
    hub.broadcast();
    expect(broken).toHaveBeenCalledTimes(1);
  });
});
