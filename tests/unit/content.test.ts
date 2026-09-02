import { describe, it, expect } from 'vitest';
import {
  SERVICES,
  TESTIMONIALS,
  PROCESS,
  SERVICE_AREA,
  FAQ,
  PILLARS,
  VALUES,
  EXTRAS,
  TRUST_MARKS,
  MANIFESTO,
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

describe('extras', () => {
  it('every entry has a real image and a distinct alt', () => {
    const alts = new Set<string>();
    for (const e of EXTRAS) {
      expect(e.image.startsWith('/images/')).toBe(true);
      expect(e.alt.length).toBeGreaterThan(10);
      alts.add(e.alt);
    }
    expect(alts.size).toBe(EXTRAS.length);
  });

  it('does not advertise gift cards', () => {
    // A "Gift cards" entry was inferred from a filename in the client's
    // image directory and removed: their copy never mentions them, and
    // the photograph showed third-party cards. Nothing should
    // reintroduce an offering the business has not published.
    const all = EXTRAS.map((e) => `${e.title} ${e.body}`).join(' ');
    expect(all).not.toMatch(/gift card/i);
  });
});

describe('manifesto and trust marks', () => {
  it('keeps the client\'s own wording', () => {
    expect(MANIFESTO).toContain('trusted moving techniques');
    expect(TRUST_MARKS).toContain('Licensed & Insured');
    expect(TRUST_MARKS).toContain('Trained Moving Experts');
  });
});
