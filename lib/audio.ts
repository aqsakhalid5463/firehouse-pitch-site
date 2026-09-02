/**
 * Procedural sound for the moving-day set-piece.
 *
 * Every sound is synthesised from oscillators and generated noise —
 * there are no audio files. That is partly the project's no-external-
 * assets rule, and partly practical: a handful of nodes weighs nothing
 * against even one compressed sample, and parameters like engine
 * throttle can be driven continuously from scroll instead of
 * cross-fading clips.
 *
 * Two hard rules shape the API:
 *
 * 1. Nothing is audible until the visitor asks for it. Browsers block
 *    autoplay anyway, but the stronger reason is that this is a sales
 *    pitch — unexpected noise on a stranger's laptop is a liability,
 *    not a delight. The context is not even constructed until `enable()`
 *    is called from a real click.
 * 2. Every entry point is safe to call whether or not audio is on, and
 *    whether or not the browser supports it, so callers never have to
 *    guard.
 */

const STORAGE_KEY = 'firehouse:sound';

/**
 * Idle fundamental. Low enough to sit under everything else on the
 * page, high enough that laptop speakers — which mostly cannot
 * reproduce much below 100Hz — still render its harmonics.
 */
const ENGINE_IDLE_HZ = 38;

type Ctor = typeof AudioContext;

class MoveAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  /** Engine bed, alive only while the truck is on screen. */
  private engine: {
    oscA: OscillatorNode;
    oscB: OscillatorNode;
    rumble: AudioBufferSourceNode;
    chug: OscillatorNode;
    clatter: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  enabled = false;
  private visibilityBound = false;

  /** Whether the last stored preference was "on". Read on mount. */
  static storedPreference(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch {
      // Private browsing and blocked-storage modes throw on access.
      return false;
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off');
    } catch {
      // Preference simply will not survive the session. Not fatal.
    }
  }

  /**
   * Builds the context. Must be called from a user gesture: browsers
   * start a context created outside one in "suspended", and resuming it
   * later silently fails.
   */
  enable(): boolean {
    if (this.ctx) {
      this.enabled = true;
      this.persist();
      void this.ctx.resume();
      this.bindVisibility();
      return true;
    }

    const Ctx: Ctor | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: Ctor })
            .webkitAudioContext;
    if (!Ctx) return false;

    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    // Deliberately conservative. This plays under a 3D scene on someone
    // else's machine at an unknown system volume.
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // One reusable second of white noise backs every percussive and
    // hissing sound; allocating a buffer per hit would garbage-collect
    // mid-scroll.
    const rate = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, rate, rate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.enabled = true;
    this.persist();
    this.bindVisibility();
    return true;
  }

  disable() {
    this.enabled = false;
    this.persist();
    this.stopEngine();
    void this.ctx?.suspend();
  }

  /**
   * True when it is safe to build and connect nodes. Callers follow
   * this with non-null assertions on ctx/master, which this guarantees.
   * (A `this is ...` type predicate cannot narrow private fields, so
   * this stays a plain boolean.)
   */
  private ready(): boolean {
    return (
      this.enabled &&
      this.ctx !== null &&
      this.master !== null &&
      this.noise !== null
    );
  }

  /**
   * Suspends audio while the tab is in the background.
   *
   * A Web Audio context keeps running when its tab is hidden — unlike
   * rAF, which the browser throttles — so without this the engine bed
   * would carry on humming from a tab the visitor has already switched
   * away from, with no visible source. Registered once, from enable().
   */
  private bindVisibility() {
    if (this.visibilityBound) return;
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        void this.ctx.suspend();
      } else if (this.enabled) {
        void this.ctx.resume();
      }
    });
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  /**
   * A diesel bed.
   *
   * The character of a diesel is not its pitch, it is the firing pulse
   * train — the chug of individual cylinders. An earlier version was two
   * detuned sawtooths plus low noise, which produced a smooth drone that
   * could have been any large machine. What makes it read as a truck:
   *
   *  - a low fundamental with an octave above it, both sawtooth, so the
   *    tone has body rather than sitting at one frequency;
   *  - a firing pulse: an LFO whose output is summed into a gain so the
   *    whole bed is amplitude-modulated several times per revolution.
   *    This is the chug, and it is the single most identifying part;
   *  - mechanical clatter, band-passed noise gated by the same LFO, for
   *    the top-end rattle a diesel has and a smooth drone does not;
   *  - a resonant lowpass, so opening it under throttle sounds like load
   *    coming on rather than just getting louder.
   */
  startEngine() {
    if (!this.ready() || this.engine) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 1.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.Q.value = 3.5;

    // Tone: fundamental plus its octave, slightly detuned against each
    // other so they beat instead of sitting perfectly still.
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = ENGINE_IDLE_HZ;
    const oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.value = ENGINE_IDLE_HZ * 2.01;
    const oscBGain = ctx.createGain();
    oscBGain.gain.value = 0.45;

    const rumble = this.noiseSource();
    if (!rumble) return;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.3;

    // The firing pulse. `chugDepth` sets how much of the signal the LFO
    // swings; the constant offset on `chugGain` keeps it from ever
    // reaching silence between pulses.
    // Triangle rather than sawtooth, and shallower than it first was.
    // Measured on an OfflineAudioContext — RMS over a window longer than
    // one carrier period, so the reading isolates this modulation from
    // the 38Hz waveform itself — a sawtooth at depth 0.5 swung the level
    // by 73%, which gates almost to silence between pulses and chugs
    // like a helicopter. These values land near 55%: clearly a firing
    // rhythm, still a continuous idle underneath.
    const chug = ctx.createOscillator();
    chug.type = 'triangle';
    chug.frequency.value = ENGINE_IDLE_HZ * 0.34;
    const chugDepth = ctx.createGain();
    chugDepth.gain.value = 0.26;
    const chugGain = ctx.createGain();
    chugGain.gain.value = 0.71;
    chug.connect(chugDepth).connect(chugGain.gain);

    // Mechanical clatter, gated by the same pulse so the rattle lands
    // with the chug rather than washing over it.
    const clatter = this.noiseSource();
    if (!clatter) return;
    const clatterBp = ctx.createBiquadFilter();
    clatterBp.type = 'bandpass';
    clatterBp.frequency.value = 1450;
    clatterBp.Q.value = 1.1;
    const clatterGain = ctx.createGain();
    clatterGain.gain.value = 0.016;
    const clatterDepth = ctx.createGain();
    clatterDepth.gain.value = 0.012;
    chug.connect(clatterDepth).connect(clatterGain.gain);

    oscA.connect(filter);
    oscB.connect(oscBGain).connect(filter);
    rumble.connect(rumbleGain).connect(filter);
    filter.connect(chugGain).connect(gain).connect(this.master!);
    clatter.connect(clatterBp).connect(clatterGain).connect(gain);

    oscA.start();
    oscB.start();
    rumble.start();
    chug.start();
    clatter.start();
    this.engine = { oscA, oscB, rumble, chug, clatter, filter, gain };
  }

  stopEngine() {
    const e = this.engine;
    if (!e || !this.ctx) return;
    this.engine = null;
    const now = this.ctx.currentTime;
    e.gain.gain.cancelScheduledValues(now);
    e.gain.gain.setValueAtTime(e.gain.gain.value, now);
    e.gain.gain.linearRampToValueAtTime(0, now + 0.5);
    e.oscA.stop(now + 0.6);
    e.oscB.stop(now + 0.6);
    e.rumble.stop(now + 0.6);
    e.chug.stop(now + 0.6);
    e.clatter.stop(now + 0.6);
  }

  /**
   * Opens the engine's filter and lifts its pitch with throttle, so
   * scrolling harder audibly works the truck. `t` is 0..1.
   */
  setThrottle(t: number) {
    const e = this.engine;
    if (!e || !this.ctx) return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, t));
    // Short ramps rather than direct assignment: stepping an audio
    // param per frame produces zipper noise.
    const hz = ENGINE_IDLE_HZ + clamped * 26;
    e.filter.frequency.setTargetAtTime(220 + clamped * 900, now, 0.15);
    e.oscA.frequency.setTargetAtTime(hz, now, 0.2);
    e.oscB.frequency.setTargetAtTime(hz * 2.01, now, 0.2);
    // The chug has to speed up with the engine, or the truck revs
    // without the cylinders firing any faster — which is what gives a
    // synthesised engine away immediately.
    e.chug.frequency.setTargetAtTime(hz * 0.34, now, 0.2);
  }

  /** A box landing: noise transient over a low sine body. */
  thud() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;

    const src = this.noiseSource();
    if (!src) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    src.connect(lp).connect(g).connect(this.master!);
    src.start(now);
    src.stop(now + 0.3);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(88, now);
    body.frequency.exponentialRampToValueAtTime(42, now + 0.18);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.45, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    body.connect(bg).connect(this.master!);
    body.start(now);
    body.stop(now + 0.28);
  }

  /**
   * A roller shutter: a burst of short band-passed clicks whose spacing
   * tightens, which is what reads as slats running up a track.
   */
  rollerDoor() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const start = ctx.currentTime;
    const clicks = 16;

    for (let i = 0; i < clicks; i++) {
      const t = start + Math.pow(i / clicks, 0.7) * 0.55;
      const src = this.noiseSource();
      if (!src) return;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400 + Math.random() * 900;
      bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(bp).connect(g).connect(this.master!);
      src.start(t);
      src.stop(t + 0.06);
    }
  }

  /** Air brakes releasing as the truck pulls away. */
  airBrake() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const src = this.noiseSource();
    if (!src) return;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, now);
    bp.frequency.exponentialRampToValueAtTime(900, now + 0.7);
    bp.Q.value = 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.34, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);

    src.connect(bp).connect(g).connect(this.master!);
    src.start(now);
    src.stop(now + 0.8);
  }

  /** A dry UI click for hover and toggle feedback. */
  tick() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const src = this.noiseSource();
    if (!src) return;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    src.connect(hp).connect(g).connect(this.master!);
    src.start(now);
    src.stop(now + 0.05);
  }
}

export const audio = new MoveAudio();
export const soundPreference = () => MoveAudio.storedPreference();
