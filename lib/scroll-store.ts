'use client';

import { create } from 'zustand';

type ScrollState = {
  progress: number;
  velocity: number;
  setScroll: (progress: number, velocity: number) => void;
};

export const useScrollStore = create<ScrollState>((set) => ({
  progress: 0,
  velocity: 0,
  setScroll: (progress, velocity) => set({ progress, velocity }),
}));

/**
 * Non-reactive read. Use inside useFrame and other rAF loops so they read
 * the live value without subscribing the component to re-renders.
 */
export function getScrollProgress(): number {
  return useScrollStore.getState().progress;
}

export function getScrollVelocity(): number {
  return useScrollStore.getState().velocity;
}
