import { BUSINESS } from './constants';

export const SERVICES = [
  {
    title: 'Local Moving',
    image: '/images/local-move.jpg',
    alt: 'A Firehouse Movers crew loading a truck on a residential street',
    body: 'Same-day and next-day moves across Lewisville and the greater DFW area, with crews who know the neighborhoods.',
  },
  {
    title: 'Long-Distance',
    image: '/images/long_distance.jpg',
    alt: 'A Firehouse Movers truck on the highway between states',
    body: 'Federally licensed for interstate relocation. One crew, one truck, one point of contact from door to door.',
  },
  {
    title: 'Residential',
    image: '/images/resident.jpg',
    alt: 'Movers carrying wrapped furniture out of a family home',
    body: 'Apartments to estates. We wrap, pad, load, and place every piece exactly where you want it.',
  },
  {
    title: 'Commercial',
    image: '/images/commercial.jpg',
    alt: 'An office being packed down into labelled crates after hours',
    body: 'Office and retail relocations planned around your downtime, executed after hours and over weekends.',
  },
  {
    title: 'Packing',
    image: '/images/packing.jpg',
    alt: 'Fragile items being wrapped and boxed by a packing crew',
    body: 'Full or partial packing with materials rated for fragile, high-value, and oversized items.',
  },
  {
    title: 'Storage',
    image: '/images/storage.jpg',
    alt: 'Inventoried household goods inside a climate-controlled storage bay',
    body: 'Climate-controlled short and long-term storage with full inventory tracking on every item.',
  },
] as const;

export const GUARANTEES = [
  {
    title: 'Fast moves',
    body: 'Crews sized to the job so your move finishes in a day, not a weekend.',
  },
  {
    title: 'Safe handling',
    body: 'Every item padded, inventoried, and inspected before it leaves and after it arrives.',
  },
  {
    title: 'On-time delivery',
    body: 'A delivery window we commit to in writing, and hit.',
  },
] as const;

/**
 * Real reviews, transcribed verbatim from the client's own site.
 *
 * These replaced four invented testimonials. Quotes are reproduced
 * exactly as published, including the emphatic punctuation and the
 * "beyong" typo in Jennifer Leiber's — correcting a customer's own
 * words is not ours to do, and the client can decide whether to fix it
 * at source. There is deliberately no `detail` field: the earlier
 * version captioned each quote with a move type and city that were
 * invented to look specific.
 */
export const TESTIMONIALS = [
  {
    quote:
      'The Firehouse team did an AMAZING job! All 3 guys were friendly, helpful, fit, and actively working throughout the job. I am 125% satisfied with today\u2019s service!!',
    name: 'Jennifer K',
  },
  {
    quote:
      'Amazing!!! Juan\u2019s team is top notch. They were nonstop and total pros. These guys are excellent and I HIGHLY recommend them for your move!!!',
    name: 'Jose Maestas',
  },
  {
    quote:
      'I am forever grateful for Firehouse movers. The team they sent out were top notch! Great work guys! It was beyong anything. The staff was so cooperative and helpful. Thank you!!!',
    name: 'Jennifer Leiber',
  },
  {
    quote:
      'We recently used Firehouse Movers to move my mother into an independent living facility. The team of 3 was amazing! They worked quickly but carefully\u2026very efficient. Highly recommend!',
    name: 'Leslie Gooding',
  },
] as const;

export const TIMELINE = [
  {
    year: 'The start',
    title: 'Built out of frustration',
    body: 'We moved one too many times with crews who showed up late, quoted low, and billed high. So we built the company we kept wishing we could hire.',
  },
  {
    year: 'Growing',
    title: 'From one truck to a fleet',
    body: 'Word travelled through Lewisville faster than any advertising could. We added trucks, crews, and a climate-controlled facility to keep up.',
  },
  {
    year: 'Licensed',
    title: 'Cleared for the long haul',
    body: 'Federal licensing for interstate moving meant we could follow our customers wherever they were headed, not just across town.',
  },
  {
    year: 'Today',
    title: 'A franchise, still local',
    body: 'We have grown into a franchise without giving up the thing that started it — crews who treat your things like their own.',
  },
] as const;

export const VALUES = [
  {
    title: 'Show up',
    body: 'On the day we said, at the hour we said. The whole business rests on this one.',
  },
  {
    title: 'Quote it straight',
    body: 'The number we give you is the number you pay. No day-of surprises.',
  },
  {
    title: 'Handle it like ours',
    body: 'Padded, wrapped, inventoried. If it matters to you, it gets handled like it matters.',
  },
  {
    title: 'Finish the job',
    body: 'We are not done when the truck is empty. We are done when your home works.',
  },
] as const;

/**
 * The six steps of an actual move, in order.
 *
 * The home page previously jumped from "here are our services" straight
 * to "call us", which never told a visitor what hiring this company
 * looks like. Wording follows the client's own site: they describe an
 * on-site inspection, full or partial packing, and placement rather
 * than drop-off.
 */
export const PROCESS = [
  {
    step: 'Quote',
    body: 'Tell us what is moving and where. You get a written number, not a range that moves on the day.',
  },
  {
    step: 'Survey',
    body: 'For bigger moves we walk the property first, so the crew and truck are sized to the job before anyone shows up.',
  },
  {
    step: 'Pack',
    body: 'Full or partial packing with materials rated for fragile, high-value, and oversized items. Everything is logged.',
  },
  {
    step: 'Load',
    body: 'Padded, wrapped, and loaded tight so nothing shifts between your old door and your new one.',
  },
  {
    step: 'Move',
    body: 'One crew and one point of contact from door to door, whether that is across Lewisville or across the country.',
  },
  {
    step: 'Settle',
    body: 'Unloaded and placed where you want it, not stacked inside the door. We finish when your home works.',
  },
] as const;

/**
 * Cities across the Dallas-Fort Worth metroplex. Local movers are
 * chosen on coverage as much as on price, and the client's site never
 * says where they actually go beyond "across the state".
 */
export const SERVICE_AREA = [
  'Lewisville',
  'Plano',
  'Frisco',
  'Dallas',
  'Denton',
  'Carrollton',
  'The Colony',
  'Flower Mound',
  'Coppell',
  'Irving',
  'McKinney',
  'Allen',
  'Richardson',
  'Grapevine',
  'Highland Village',
  'Little Elm',
] as const;

/**
 * The questions movers actually get asked before booking. Answers are
 * written from the client's own published service descriptions —
 * federal licensing, climate-controlled storage, packing materials —
 * so none of them commit the business to a claim it has not made.
 */
export const FAQ = [
  {
    q: 'How far in advance should I book?',
    a: 'Two to three weeks is comfortable for most moves. Month-end and summer weekends fill first, so if your date is fixed it is worth calling as soon as you know it. We do take same-day and next-day local jobs when we have a crew free.',
  },
  {
    q: 'Do you move out of state?',
    a: 'Yes. We are federally licensed for interstate relocation, so we can follow you out of Texas rather than handing you off at the state line. One crew and one point of contact from door to door.',
  },
  {
    q: 'Can you pack for me?',
    a: 'Full or partial, whichever you want. We bring materials rated for fragile, high-value, and oversized items, and we can unpack at the other end too. If you would rather pack yourself, we can just supply the materials.',
  },
  {
    q: 'What if my new place is not ready yet?',
    a: 'We hold your things in our own climate-controlled storage, short or long term, with inventory tracking on every item that goes in. It stays on the same paperwork as your move.',
  },
  {
    q: 'How do you price a move?',
    a: 'On what is actually moving and how far it is going. For larger homes and offices we survey on site first so the quote reflects the real job. The number you are given in writing is the number you pay.',
  },
  {
    q: 'Are you licensed and insured?',
    a: `Both. We carry insurance on every move and every crew, and our registrations (${BUSINESS.usdot}, ${BUSINESS.txdmv}) are public — you can look them up before you book.`,
  },
] as const;
