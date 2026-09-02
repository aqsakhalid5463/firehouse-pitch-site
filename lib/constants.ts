export const BUSINESS = {
  name: 'Firehouse Movers Inc.',
  address: '2535-B Texas 121 E, State #140, Lewisville, TX 75056',
  city: 'Lewisville',
  phone: '(972) 992-1969',
  phoneHref: 'tel:+19729921969',
  email: 'support@firehousemovers.com',
  // Read off the company's own truck livery in public/images/local-move.jpg.
  // Both are publicly searchable registrations, which is the point of
  // showing them: a visitor can verify the business independently.
  usdot: 'USDOT 1939062',
  txdmv: 'TXDMV 000570404B',
} as const;

export const HERO_HEADLINE =
  'The moving service we needed, so we built it for you';

export const COLORS = {
  darkBg: '#08070A',
  darkFog: '#0D0B12',
  ink: '#1A1917',
  bone: '#F0F0EE',
  fireRed: '#E23D28',
  truckChassis: '#2A2A2F',
  truckWindshield: '#12121A',
  truckBoxBody: '#D8D2C6',
  // Plywood lining inside the cargo bay. The livery belongs on the
  // outer face of each wall only — a box geometry textured on all six
  // faces shows the branding reversed from inside the open bay.
  truckInterior: '#8F7F68',
  headlightWhite: '#F3F4F6',
  cardboardTan: '#C69A6D',
  cardboardTanDark: '#B08654',
  packingTape: '#E8D3AC',
  boxSeam: '#7A5A3A',
  truckGlass: '#0A0C12',
  truckChrome: '#C7CBD1',
  truckTyre: '#0C0C0F',
  truckRim: '#8A8E96',
  truckGrille: '#1D1D22',
  // The trailer's body red, traced from public/images/two_trucks.jpg.
  // Deliberately deeper than fireRed: the brand accent is a bright
  // red-orange that saturates to pink when the scene's key light hits a
  // large panel square-on, whereas the real vehicles are painted a
  // darker crimson that holds its colour under direct light.
  truckBodyRed: '#A81C22',
  tailLightRed: '#C81E1E',
  tailLightGlow: '#FF3B2E',
  // Dark-grey / asphalt palette additions for the road (round 7: real
  // road surface + painted, non-emissive markings, replacing the
  // amber-emissive dash field).
  asphaltDark: '#0F0F12',
  asphaltPanel: '#18181C',
  panelGrey: '#2B2B30',
  // Damp-asphalt sheen tint. Deliberately a cool grey rather than the
  // headlight white this used to reuse, which read as pale paint.
  roadSheen: '#6E7480',
  // The page-length SVG ribbon reads as a road rather than a brand
  // flourish, so it takes asphalt grey with white lane markings. It ran
  // in brand red, which competed with the red the CTAs and section
  // labels use to mean "act here".
  ribbonAsphalt: '#5A5F69',
  ribbonEdge: '#787E89',
  roadMarkingWhite: '#EDEEF0',
  roadMarkingDim: '#B8BABF',
  // Silvery glass tint for translucent frosted-glass UI panels (the hero
  // subhead backing). Mirrors app/globals.css's --color-silver-glass so
  // Tailwind classes (bg-glass-silver/…) and any non-Tailwind consumer
  // resolve to the same value instead of a re-typed hex literal.
  silverGlass: '#C7CBD1',
} as const;

/**
 * World-space Y of the road surface's top face. Exported so the truck
 * (follow-up task) can sit its wheels exactly on the road instead of
 * guessing a matching offset.
 */
export const ROAD_SURFACE_Y = -1.35;

export const SECTIONS = {
  // The merged hero + Move-as-One pinned set-piece: hero copy, truck
  // assembly/load, and truck departure all happen inside this range.
  opening: [0.0, 0.4],
  services: [0.4, 0.6],
  guarantees: [0.6, 0.75],
  testimonials: [0.75, 0.9],
  cta: [0.9, 1.0],
} as const satisfies Record<string, readonly [number, number]>;
