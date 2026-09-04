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
    // The client's own photographs, matched to the promise each one
    // actually shows. Nothing here is stock: a promise illustrated by
    // someone else's crew would be the same problem as an invented
    // testimonial.
    image: '/images/two_trucks.jpg',
    alt: 'Two Firehouse Movers trucks loaded and ready on a job.',
  },
  {
    title: 'Safe handling',
    body: 'Every item padded, inventoried, and inspected before it leaves and after it arrives.',
    image: '/images/packing.jpg',
    alt: 'A Firehouse Movers crew member wrapping and boxing household items.',
  },
  {
    title: 'On-time delivery',
    body: 'A delivery window we commit to in writing, and hit.',
    image: '/images/local-move.jpg',
    alt: 'A Firehouse Movers truck and trailer parked outside a home on moving day.',
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
/**
 * Removed from the About page at the client's request, along with the
 * credentials grid that sat below it — both said what any mover's site
 * says. The data is kept because it is drawn from the client's own
 * published copy and the content-integrity tests below still guard it,
 * so the section can be restored without re-deriving any of it. Same
 * arrangement as EXTRAS.
 */
/*
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

/**
 * The company's own description of itself, from the paragraph under the
 * headline on their site. Reproduced closely because it is the one place
 * they say in their own words what they think they are selling.
 */
export const MANIFESTO =
  'Built by a dedicated team with years of experience, Firehouse Movers gives you access to trusted moving techniques, reliable crews, and modern tools that make relocating simple.';

/**
 * Things they offer beyond the move itself: an on-site inspection
 * before quoting, packing materials, and uniformed trained crews. All
 * three are on the client's own site, but only the inspection had made
 * it into this build, buried as one step of the process. They are the
 * details that separate a franchise from a van and two people, so they
 * get their own section.
 */
/**
 * The "Beyond the move" section was removed from the home page at the
 * client's request; this data is kept because it is their own published
 * copy and the content-integrity tests below still guard it, so the
 * section can be restored without re-deriving any of it.
 */
export const EXTRAS = [
  {
    title: 'On-site inspection',
    body: 'For larger homes and offices we walk the property before quoting, so the crew, the truck, and the number are all sized to the actual job.',
    image: '/images/onsite_inspection.jpg',
    alt: 'A mover surveying a property room by room before a move',
  },
  {
    title: 'Packing supplies',
    body: 'Boxes, wrap, and materials rated for fragile, high-value, and oversized items — whether we pack for you or you would rather do it yourself.',
    image: '/images/supplies.jpg',
    alt: 'Stacked moving boxes and packing materials ready for collection',
  },
  {
    title: 'Uniformed crews',
    body: 'The people who turn up are trained movers in company uniform, not whoever was free that morning. You will know who is in your house.',
    image: '/images/uniform.jpg',
    alt: 'A Firehouse Movers crew member in company uniform',
  },
] as const;

/*
 * A fourth entry, "Gift cards", was removed rather than shipped.
 *
 * It came from spotting gift_cards.jpg in the client's image directory
 * and inferring an offering from the filename — their published copy
 * never mentions gift cards. The photograph turned out to show someone
 * holding Uber and Starbucks cards, which is almost certainly a staff
 * reward and not a product, so the section would have advertised a
 * service the business may not sell, illustrated by a competitor's
 * branding. Three well-supported items beat four with one invented.
 */

/**
 * The three claims the client puts in their own footer, verbatim. Short
 * enough to run as a marquee band rather than a list.
 */
export const TRUST_MARKS = [
  'Licensed & Insured',
  '5-Star Rated Service',
  'Trained Moving Experts',
  'Climate-Controlled Storage',
  'Federally Licensed Interstate',
] as const;

/**
 * The crew shown on the About page.
 *
 * ⚠️ Placeholder, and deliberately so. These names and roles come from
 * the reference build in the repo root, not from anything verified
 * against the live site, and the silhouettes are generic figures rather
 * than likenesses — nobody here has approved their own figure, role
 * title, or appearing at all. This is fine for a demo and is not fine
 * the moment the site is shown externally: every person needs to sign
 * off their own entry first. Swapping in a confirmed roster is an edit
 * to this array and nothing else.
 */
export const CREW = [
  {
    name: 'Brian Kaoma',
    role: 'Co-founder',
    figure: 'cap',
    // A real photograph, sampled into the particle field rather than
    // shown as a picture. Where a portrait exists the generated figure
    // is never used — see components/ui/ParticlePortrait.tsx — and the
    // `figure` above only survives as the fallback if the image fails
    // to load.
    photo: '/images/crew/brian.jpg',
  },
  { name: 'Nikki Ingram', role: 'Co-founder', figure: 'plain' },
  { name: 'Julian Hernandez', role: 'Dispatch Manager', figure: 'headset' },
  { name: 'Peter Taylor', role: 'Operations Supervisor', figure: 'hat' },
  { name: 'Leon Kaoma', role: 'Operations Manager', figure: 'crew' },
] as const;

export type CrewFigure = (typeof CREW)[number]['figure'];
export type CrewMember = (typeof CREW)[number];

/**
 * The About page, in the client's own words.
 *
 * Taken verbatim from the reference build in the repo root rather than
 * written here. That file is the client's own copy deck, and the whole
 * point of a pitch site is that the words are theirs — the previous
 * About headline was a tagline lifted off their home page, which is not
 * the same thing as a statement about who they are.
 */
export const ABOUT = {
  eyebrow: 'Founded in Lewisville. Franchising across Texas.',
  headline: 'The crew is the whole product.',
  intro:
    "Anyone can rent a truck. What you're paying for is who gets out of it — and whether they've been trained, backed and held to a standard.",
  model: {
    eyebrow: 'The model',
    headline: 'Why the firehouse model works.',
    lead: "Drilled routine, clear roles, equipment checked before it's needed.",
    body: "A firehouse doesn't find out its ladder is broken during the call. We built the company on the same three things: crews that train together and stay together, trucks serviced on a schedule rather than on a hunch, and one lead who owns each job from the walkthrough to the last signature.",
  },
} as const;

/**
 * The two organisations named as standing behind a Firehouse move.
 *
 * Removed from the About page at the client's request; kept here the
 * same way EXTRAS and VALUES are, so the section can be restored
 * without re-deriving the copy.
 *
 * ⚠️ These are claims about third parties — a named commercial
 * programme and a named sister company — and they carry more weight
 * than anything else that was on the page: naming Ford Pro asserts a
 * relationship with Ford. The copy comes from the client's own
 * reference build, so it is theirs rather than invented here, but it
 * has not been verified against anything, and nothing should put it
 * back on a public page until it has been.
 */
export const PARTNERS = [
  {
    label: 'Fleet partner',
    title: 'Fleet maintained with Ford Pro',
    body: "Every truck in the fleet runs on Ford Pro's maintenance and telematics program — scheduled service, real diagnostics, and no surprises on moving day.",
  },
  {
    label: 'Sister company',
    title: '4 Alarm Restoration',
    body: 'Our sister company handles what comes after the boxes: TV mounting, duct cleaning and restoration work, held to the same standard you already hired us for.',
  },
] as const;

/** Names run as a marquee band above the partners, the way the
 *  reference build does. */
export const NETWORK_MARQUEE = [
  { name: 'Firehouse Movers', role: 'Full-service relocation' },
  { name: 'Ford Pro', role: 'Fleet maintenance & telematics' },
  { name: '4 Alarm Restoration', role: 'Mounting, ducts, restoration' },
] as const;
