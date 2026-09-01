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
  lightBg: '#F4F0E9',
  lightFog: '#E8E2D6',
  ink: '#1A1917',
  bone: '#F4F0E9',
  fireRed: '#E23D28',
  emberAmber: '#FF8A3D',
  glassTint: '#FFE7D2',
  crateWood: '#8A6B4F',
  truckChassis: '#2A2A2F',
  truckWindshield: '#12121A',
  truckBoxBody: '#D8D2C6',
  truckWheel: '#141418',
  truckCargo: '#9C7B5C',
  headlightWhite: '#FFF1D8',
  cardboardTan: '#C69A6D',
  cardboardTanDark: '#B08654',
  packingTape: '#E8D3AC',
  boxSeam: '#7A5A3A',
} as const;

export const SECTIONS = {
  // The merged hero + Move-as-One pinned set-piece: hero copy, truck
  // assembly/load, and truck departure all happen inside this range.
  opening: [0.0, 0.4],
  services: [0.4, 0.6],
  guarantees: [0.6, 0.75],
  testimonials: [0.75, 0.9],
  cta: [0.9, 1.0],
} as const satisfies Record<string, readonly [number, number]>;
