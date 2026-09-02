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

/**
 * What the company is, sourced from the client's own published copy.
 *
 * This replaced a four-beat TIMELINE that invented a company history —
 * a founding anecdote, "from one truck to a fleet", a dated licensing
 * milestone. None of it came from the client, and a fabricated origin
 * story is the kind of thing a business owner notices immediately.
 *
 * These are deliberately not chronological. Every claim below traces to
 * something the client already says about itself: the franchise
 * description and "relieve the stress associated with relocating" from
 * their footer, the experienced-crews line from their hero, federal
 * interstate licensing and climate-controlled storage from their
 * services copy.
 */
export const PILLARS = [
  {
    label: 'The company',
    title: 'A franchise built for full-service moves',
    body: 'Firehouse Movers is a growing franchise offering a full range of moving services to households and businesses. The whole point is to take the stress out of relocating, rather than to hand you a truck and wish you luck.',
  },
  {
    label: 'The crews',
    title: 'Trained movers, not day labour',
    body: 'The teams are built from people with real experience, working to trusted methods with proper equipment. That is the difference between furniture that arrives and furniture that arrives intact.',
  },
  {
    label: 'The reach',
    title: 'Licensed to cross state lines',
    body: 'Federal licensing for interstate moving means a move does not have to stop at the Texas border. The registrations are public, so you can check them before you book rather than take our word for it.',
  },
  {
    label: 'The extras',
    title: 'Packing, storage, and unpacking on one job',
    body: 'Packing with materials rated for fragile and oversized items, climate-controlled storage for the gap between homes, and unpacking at the other end. One company, one point of contact, one invoice.',
  },
] as const;

/**
 * Service commitments, each tied to something the client publishes:
 * "Licensed & Insured", "Trained Moving Experts", their full-service
 * range, and the commercial promise of minimal downtime. The previous
 * version was written in an invented brand voice that committed the
 * business to promises it had never made.
 */
export const VALUES = [
  {
    title: 'Licensed and insured',
    body: 'Coverage on every move, every crew, and every item on the inventory — and registrations you can look up yourself.',
  },
  {
    title: 'Trained moving experts',
    body: 'Crews who do this for a living, with the equipment and the technique to match. Not whoever was available that morning.',
  },
  {
    title: 'One point of contact',
    body: 'Packing, moving, storage, and unpacking handled by the same company, so nothing gets lost in a handoff between vendors.',
  },
  {
    title: 'Built around your downtime',
    body: 'Office and retail moves planned after hours and over weekends, so the business is open when it needs to be.',
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
