'use client';

import { create } from 'zustand';

/**
 * Where the bay door is during a route change.
 *
 *  - `idle`    — no navigation in flight; the overlay renders nothing.
 *  - `closing` — the truck is running for the edge and the door is
 *                coming down behind it.
 *  - `covered` — the door is shut. This is the only phase in which it is
 *                safe to swap the route and reset the scroll position,
 *                because it is the only phase in which nothing on the
 *                page is visible.
 *  - `opening` — the door rolls back up on the new page.
 */
export type TransitionPhase = 'idle' | 'closing' | 'covered' | 'opening';

type TransitionState = {
  phase: TransitionPhase;
  /** Stencilled on the door while it is shut — the destination, so the
   *  cover is a signpost rather than a blank pause. */
  label: string;
  begin: (label: string) => void;
  setPhase: (phase: TransitionPhase) => void;
};

export const useTransitionStore = create<TransitionState>((set) => ({
  phase: 'idle',
  label: '',
  begin: (label) => set({ phase: 'closing', label }),
  setPhase: (phase) => set({ phase }),
}));

/** Non-reactive read, for click handlers that must not start a second
 *  navigation while one is already running. */
export function transitionInFlight(): boolean {
  return useTransitionStore.getState().phase !== 'idle';
}
