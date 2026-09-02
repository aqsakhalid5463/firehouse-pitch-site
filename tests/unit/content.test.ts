import { describe, it, expect } from 'vitest';
import {
  SERVICES,
  TESTIMONIALS,
  PROCESS,
  SERVICE_AREA,
  FAQ,
  PILLARS,
  VALUES,
} from '@/lib/content';
import { BUSINESS } from '@/lib/constants';

describe('services', () => {
  it('every service carries an image and a distinct alt', () => {
    const alts = new Set<string>();
    for (const s of SERVICES) {
      expect(s.image.startsWith('/images/')).toBe(true);
      expect(s.alt.length).toBeGreaterThan(10);
      alts.add(s.alt);
    }
    expect(alts.size).toBe(SERVICES.length);
  });
});

describe('testimonials', () => {
  it('carries the real reviews, with no invented attribution detail', () => {
    expect(TESTIMONIALS).toHaveLength(4);
    for (const t of TESTIMONIALS) {
      expect(t.name.length).toBeGreaterThan(0);
      // The fabricated version captioned each quote with a move type and
      // city. Nothing should reintroduce that field.
      expect(t).not.toHaveProperty('detail');
    }
  });

  it('includes reviewers published on the client site', () => {
    const names = TESTIMONIALS.map((t) => t.name);
    expect(names).toContain('Jennifer K');
    expect(names).toContain('Jose Maestas');
  });
});

describe('process', () => {
  it('runs quote through to settle, in order', () => {
    expect(PROCESS.map((p) => p.step)).toEqual([
      'Quote',
      'Survey',
      'Pack',
      'Load',
      'Move',
      'Settle',
    ]);
  });
});

describe('service area', () => {
  it('lists distinct DFW cities and includes the home city', () => {
    expect(new Set(SERVICE_AREA).size).toBe(SERVICE_AREA.length);
    expect(SERVICE_AREA).toContain(BUSINESS.city);
  });

  it('splits evenly enough for two marquee rows', () => {
    expect(SERVICE_AREA.length % 2).toBe(0);
  });
});

describe('faq', () => {
  it('asks real questions and answers them substantively', () => {
    for (const item of FAQ) {
      expect(item.q.endsWith('?')).toBe(true);
      expect(item.a.length).toBeGreaterThan(80);
    }
  });

  it('cites the real registrations rather than a placeholder', () => {
    const licensing = FAQ.find((f) => f.q.includes('licensed'));
    expect(licensing).toBeDefined();
    expect(licensing!.a).toContain(BUSINESS.usdot);
    expect(licensing!.a).toContain(BUSINESS.txdmv);
  });
});

describe('about-page copy', () => {
  it('has four pillars, none of them labelled as a date or era', () => {
    expect(PILLARS).toHaveLength(4);
    // The replaced TIMELINE invented a company history. Nothing here
    // should reintroduce a chronology.
    for (const p of PILLARS) {
      expect(p).not.toHaveProperty('year');
      expect(p.label).not.toMatch(/\d{4}|today|the start|founded/i);
    }
  });

  it('does not repeat the invented founding story', () => {
    const all = [
      ...PILLARS.map((p) => `${p.title} ${p.body}`),
      ...VALUES.map((v) => `${v.title} ${v.body}`),
    ].join(' ');
    expect(all).not.toMatch(/one truck/i);
    expect(all).not.toMatch(/showed up late/i);
  });
});
