export const BUSINESS = {
  name: 'Firehouse Movers Inc.',
  address: '2535-B Texas 121 E, State #140, Lewisville, TX 75056',
  phone: '(972) 992-1969',
  phoneHref: 'tel:+19729921969',
  email: 'support@firehousemovers.com',
} as const;

export const HERO_HEADLINE =
  'The moving service we needed, so we built it for you';

export const COLORS = {
  darkBg: '#08070A',
  darkFog: '#0D0B12',
  lightBg: '#F0F0EE',
  lightFog: '#E3E3E0',
  ink: '#1A1917',
  bone: '#F0F0EE',
  fireRed: '#E23D28',
  truckChassis: '#2A2A2F',
  truckWindshield: '#12121A',
  truckBoxBody: '#D8D2C6',
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
  tailLightRed: '#C81E1E',
  tailLightGlow: '#FF3B2E',
  // Dark-grey / asphalt palette additions for the road (round 7: real
  // road surface + painted, non-emissive markings, replacing the
  // amber-emissive dash field).
  asphaltDark: '#0F0F12',
  asphaltPanel: '#18181C',
  panelGrey: '#2B2B30',
  roadMarkingWhite: '#EDEEF0',
  roadMarkingDim: '#B8BABF',
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
