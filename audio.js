/* The Music Studio — sound engine.
   Every instrument is built from oscillators and filters in the browser (no sound files needed),
   so it works offline and renders to MP3 or WAV. */
(function () {
  const A = {};
  let live = null;
  A.ctx = function () {
    if (!live) live = new (window.AudioContext || window.webkitAudioContext)();
    if (live.state === 'suspended') live.resume();
    return live;
  };

  // ---------- instruments ----------
  // family decides the picker group; ens = can be a section; kind = how it's synthesized
  A.INST = {
    'Grand piano': { family: 'Keys', kind: 'piano' },
    'Electric piano': { family: 'Keys', kind: 'epiano' },
    'Organ': { family: 'Keys', kind: 'organ' },
    'Harpsichord': { family: 'Keys', kind: 'harpsi' },
    'Celesta': { family: 'Keys', kind: 'bell', soft: true },
    'Violins': { family: 'Strings', kind: 'strings', ens: true, bright: 1 },
    'Violas': { family: 'Strings', kind: 'strings', ens: true, bright: .8 },
    'Cellos': { family: 'Strings', kind: 'strings', ens: true, bright: .6 },
    'Double bass': { family: 'Strings', kind: 'strings', ens: true, bright: .45 },
    'Harp': { family: 'Strings', kind: 'harp' },
    'Flute': { family: 'Woodwinds', kind: 'flute', ens: true },
    'Oboe': { family: 'Woodwinds', kind: 'oboe', ens: true },
    'Clarinet': { family: 'Woodwinds', kind: 'clarinet', ens: true },
    'Bassoon': { family: 'Woodwinds', kind: 'clarinet', ens: true, dark: true },
    'Trumpet': { family: 'Brass', kind: 'brass', ens: true, bright: 1 },
    'French horn': { family: 'Brass', kind: 'brass', ens: true, bright: .45 },
    'Trombone': { family: 'Brass', kind: 'brass', ens: true, bright: .7 },
    'Tuba': { family: 'Brass', kind: 'brass', ens: true, bright: .4 },
    'Glockenspiel': { family: 'Percussion', kind: 'bell' },
    'Timpani': { family: 'Percussion', kind: 'timpani' },
    'Acoustic guitar': { family: 'Band', kind: 'guitar' },
    'Electric guitar': { family: 'Band', kind: 'eguitar' },
    'Bass guitar': { family: 'Band', kind: 'bass' },
    'Synth': { family: 'Band', kind: 'synth' },
    'Choir': { family: 'Voices', kind: 'choir', ens: true, vowel: 'aah' },
    // World sounds (built-in approximations)
    'Spanish guitar': { family: 'World', region: 'Spanish & Latin', kind: 'guitar', damp: 0.993, bright: 0.38 },
    'Marimba': { family: 'World', region: 'Spanish & Latin', kind: 'mallet', partials: [[1, 1], [4, 0.22], [9.9, 0.05]], decay: 0.32, peak: 0.34 },
    'Sitar': { family: 'World', region: 'Indian', kind: 'sitar' },
    'Tanpura': { family: 'World', region: 'Indian', kind: 'sitar', drone: true },
    'Bansuri': { family: 'World', region: 'Indian', kind: 'flute', breath: 0.32, vib: 9 },
    'Oud': { family: 'World', region: 'Middle Eastern', kind: 'guitar', damp: 0.99, bright: 0.3 },
    'Koto': { family: 'World', region: 'East Asian', kind: 'harp', damp: 0.994, bright: 0.78 },
    'Guzheng': { family: 'World', region: 'East Asian', kind: 'harp', damp: 0.996, bright: 0.65, bend: true },
    'Erhu': { family: 'World', region: 'East Asian', kind: 'strings', bright: 0.95, vib: 24 },
    'Shakuhachi': { family: 'World', region: 'East Asian', kind: 'flute', breath: 0.5, vib: 14 },
    'Kalimba': { family: 'World', region: 'African', kind: 'mallet', partials: [[1, 1], [5.8, 0.14]], decay: 0.5, peak: 0.3 },
    'Steel drums': { family: 'World', region: 'Caribbean', kind: 'mallet', partials: [[1, 1], [2, 0.45], [3, 0.18], [4.1, 0.08]], decay: 0.55, peak: 0.22, attack: 0.012 },
    'Bagpipes': { family: 'World', region: 'Celtic', kind: 'oboe', pipes: true },
    'Tin whistle': { family: 'World', region: 'Celtic', kind: 'flute', breath: 0.22, vib: 8 },
    'Fiddle': { family: 'World', region: 'Celtic', kind: 'strings', bright: 1 },
    'Banjo': { family: 'World', region: 'American roots', kind: 'guitar', damp: 0.982, bright: 0.92 },
    'Harmonica': { family: 'World', region: 'American roots', kind: 'reed', detune: 4, cut: 1900, vib: 10 },
    'Accordion': { family: 'World', region: 'American roots', kind: 'reed', detune: 14, cut: 2600 }
  };
  A.FAMILIES = ['Strings', 'Woodwinds', 'Brass', 'Keys', 'Percussion', 'Band', 'Voices'];
  A.REGIONS = ['Spanish & Latin', 'Indian', 'Middle Eastern', 'East Asian', 'African', 'Caribbean', 'Celtic', 'American roots'];
  // drum-type world instruments live on the Drums card as percussion switches
  A.REGION_PERC = { 'Spanish & Latin': ['congas', 'bongos', 'shaker'], 'Indian': ['tabla'], 'Middle Eastern': ['darbuka'], 'African': ['djembe'], 'Caribbean': ['bongos'], 'Celtic': [], 'East Asian': [], 'American roots': ['tambourine'] };
  A.SIZES = { 'Small (4)': 3, 'Chamber (12)': 5, 'Full orchestra (30)': 8 };

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = (a, b) => a + Math.random() * (b - a);

  function env(g, t, dur, a, d, s, r, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * s, t + a, d / 3);
    const end = t + Math.max(dur, a + 0.01);
    g.gain.setTargetAtTime(0.0001, end, r / 3);
    return end + r * 1.5;
  }
  function osc(ctx, type, f, t, stop, dest, detune) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(stop); return o;
  }
  function vibrato(ctx, o, t, stop, rate, depth, delay) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = rate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + (delay || 0.25));
    l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(stop);
  }
  let noiseBuf = null;
  function noise(ctx) {
    if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  // Karplus-Strong plucked string, cached per context/pitch/brightness
  const ksCache = new Map();
  function pluckBuf(ctx, f, secs, damp, bright) {
    const key = ctx.sampleRate + '|' + f.toFixed(1) + '|' + secs + '|' + damp + '|' + bright;
    if (ksCache.has(key)) return ksCache.get(key);
    const sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    const p = Math.max(2, Math.round(sr / f)), ring = new Float32Array(p);
    let last = 0;
    for (let i = 0; i < p; i++) { const w = Math.random() * 2 - 1; last = last + bright * (w - last); ring[i] = last; }
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const nx = (idx + 1) % p, v = ring[idx];
      d[i] = v; ring[idx] = damp * 0.5 * (v + ring[nx]); idx = nx;
    }
    if (ksCache.size > 400) ksCache.clear();
    ksCache.set(key, b); return b;
  }

  // one note → returns end time
  A.voice = function (ctx, dest, t, dur, midi, name, o) {
    o = o || {};
    const I = A.INST[name] || A.INST['Grand piano'], f = freq(midi), vel = o.vel == null ? 0.7 : o.vel;
    const g = ctx.createGain(); g.connect(dest);
    let end;
    switch (I.kind) {
      case 'piano': {
        end = t + Math.min(dur + 0.6, 4);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * vel, t + 0.005);
        g.gain.setTargetAtTime(0.0001, t + 0.01, 0.35 + 1.2 * Math.exp(-midi / 60));
        g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800 + vel * 3000; lp.connect(g);
        osc(ctx, 'triangle', f, t, end, lp); const h = ctx.createGain(); h.gain.value = 0.35; h.connect(lp);
        osc(ctx, 'sine', f * 2, t, end, h, 3); const h3 = ctx.createGain(); h3.gain.value = 0.12; h3.connect(lp);
        osc(ctx, 'sine', f * 3, t, end, h3, -4);
        break;
      }
      case 'epiano': {
        end = t + Math.min(dur + 0.5, 4);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 * vel, t + 0.01);
        g.gain.setTargetAtTime(0.0001, t + 0.02, 0.9); g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
        osc(ctx, 'sine', f, t, end, g);
        const tg = ctx.createGain(); tg.gain.setValueAtTime(0.25, t); tg.gain.setTargetAtTime(0, t, 0.08); tg.connect(g);
        osc(ctx, 'sine', f * 4, t, end, tg);
        const trem = ctx.createOscillator(), tgn = ctx.createGain(); trem.frequency.value = 4.5; tgn.gain.value = 0.08;
        trem.connect(tgn); tgn.connect(g.gain); trem.start(t); trem.stop(end);
        break;
      }
      case 'organ': {
        end = env(g, t, dur, 0.02, 0.1, 0.9, 0.08, 0.13 * vel);
        [1, 2, 3, 4].forEach((m, i) => { const pg = ctx.createGain(); pg.gain.value = [1, .6, .35, .25][i]; pg.connect(g); osc(ctx, 'sine', f * m, t, end, pg); });
        break;
      }
      case 'harpsi': case 'harp': case 'guitar': case 'eguitar': {
        const harp = I.kind === 'harp', hs = I.kind === 'harpsi', eg = I.kind === 'eguitar';
        const secs = Math.min(4, dur + (harp ? 1.6 : hs ? 0.4 : 1.0));
        const s = ctx.createBufferSource();
        s.buffer = pluckBuf(ctx, f, Math.round(secs * 4) / 4, I.damp || (hs ? 0.985 : harp ? 0.997 : 0.994), I.bright || (hs ? 0.95 : harp ? 0.55 : 0.5));
        if (I.bend) { s.playbackRate.setValueAtTime(0.965, t); s.playbackRate.linearRampToValueAtTime(1, t + 0.09); }
        let node = s;
        if (eg) { const ws = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(2.5 * x); } ws.curve = c; s.connect(ws); node = ws; }
        node.connect(g); g.gain.setValueAtTime((eg ? 0.25 : 0.5) * vel, t);
        g.gain.setTargetAtTime(0.0001, t + dur + (harp ? 0.8 : 0.15), 0.1);
        s.start(t); end = t + secs; s.stop(end);
        break;
      }
      case 'bass': {
        end = t + dur + 0.25;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.45 * vel, t + 0.01);
        g.gain.setTargetAtTime(0.25 * vel, t + 0.02, 0.3); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
        osc(ctx, 'triangle', f, t, end, lp); osc(ctx, 'sine', f, t, end, lp);
        break;
      }
      case 'bell': {
        end = t + Math.min(dur + 1.2, 3.5);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime((I.soft ? 0.14 : 0.2) * vel, t + 0.003);
        g.gain.setTargetAtTime(0.0001, t + 0.01, I.soft ? 0.5 : 0.7);
        osc(ctx, 'sine', f * 2, t, end, g); const p2 = ctx.createGain(); p2.gain.value = 0.3; p2.connect(g); osc(ctx, 'sine', f * 5.4, t, end, p2);
        break;
      }
      case 'mallet': { // marimba, kalimba, steel drums
        end = t + Math.min(dur + 1.2, 3);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime((I.peak || 0.3) * vel, t + (I.attack || 0.003));
        g.gain.setTargetAtTime(0.0001, t + 0.02, I.decay || 0.4);
        (I.partials || [[1, 1]]).forEach(([m, a], i) => { const pg = ctx.createGain(); pg.gain.setValueAtTime(a, t); if (i) pg.gain.setTargetAtTime(0, t, 0.06 * (I.decay || 0.4) * 3); pg.connect(g); osc(ctx, 'sine', f * m, t, end, pg); });
        break;
      }
      case 'sitar': { // plucked string with a buzzy bridge (tanpura rings longer, softer)
        const dr = !!I.drone, secs = Math.min(dr ? 4 : 3.5, dur + (dr ? 2.2 : 1.4));
        const s = ctx.createBufferSource(); s.buffer = pluckBuf(ctx, f, Math.round(secs * 4) / 4, 0.997, dr ? 0.6 : 0.88);
        s.playbackRate.setValueAtTime(dr ? 1 : 0.99, t); s.playbackRate.linearRampToValueAtTime(1, t + 0.06);
        const ws = ctx.createWaveShaper(), c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = x + 0.35 * Math.sin(3 * x) * Math.abs(x); } ws.curve = c;
        const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.Q.value = 3; pk.gain.value = 9; pk.frequency.setValueAtTime(1200, t); pk.frequency.exponentialRampToValueAtTime(3800, t + 0.5);
        s.connect(ws); ws.connect(pk); pk.connect(g);
        const sym = ctx.createBufferSource(); sym.buffer = pluckBuf(ctx, f * 2, Math.round(secs * 4) / 4, 0.998, 0.4); const sg = ctx.createGain(); sg.gain.value = 0.18; sym.connect(sg); sg.connect(g);
        g.gain.setValueAtTime((dr ? 0.3 : 0.42) * vel, t); g.gain.setTargetAtTime(0.0001, t + dur + (dr ? 1.2 : 0.4), 0.15);
        end = t + secs; s.start(t); s.stop(end); sym.start(t + 0.01); sym.stop(end);
        break;
      }
      case 'reed': { // accordion, harmonica
        end = env(g, t, dur, 0.035, 0.1, 0.9, 0.1, 0.11 * vel);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = I.cut || 2200; lp.connect(g);
        [-1, 1].forEach(sg => { const ov = osc(ctx, 'square', f, t, end, lp, sg * (I.detune || 5)); if (I.vib) vibrato(ctx, ov, t, end, 5.5, I.vib, 0.15); });
        const o2 = ctx.createGain(); o2.gain.value = 0.35; o2.connect(lp); osc(ctx, 'sawtooth', f * 2, t, end, o2);
        break;
      }
      case 'timpani': {
        end = t + dur + 1.2;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.005); g.gain.setTargetAtTime(0.0001, t + 0.02, 0.45);
        const ob = ctx.createOscillator(); ob.frequency.setValueAtTime(f * 1.05, t); ob.frequency.exponentialRampToValueAtTime(f, t + 0.15);
        ob.connect(g); ob.start(t); ob.stop(end);
        break;
      }
      default: { // sustained families: strings, winds, brass, synth, choir
        const n = o.solo || !I.ens ? 1 : (o.voices || 5);
        const artic = o.artic || 'legato';
        const kind = I.kind;
        let a = 0.08, r = 0.22, peak = 0.26 * vel / Math.pow(n, 0.4);
        if (kind === 'strings') a = artic === 'pizzicato' ? 0.004 : n > 1 ? 0.14 : 0.07;
        if (kind === 'brass') { a = 0.05; r = 0.12; }
        if (kind === 'flute') { a = 0.06; r = 0.1; }
        if (kind === 'choir') { a = 0.15; r = 0.3; peak *= 1.2; }
        if (kind === 'synth') { a = 0.02; r = 0.2; }
        const pdur = artic === 'pizzicato' ? Math.min(dur, 0.18) : dur;
        if (kind === 'strings' && artic === 'pizzicato') { r = 0.25; }
        end = env(g, t, pdur, a, 0.2, artic === 'pizzicato' ? 0.15 : 0.85, r, peak);
        if (artic === 'tremolo') { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 13; lg.gain.value = peak * 0.6; l.connect(lg); lg.connect(g.gain); l.start(t); l.stop(end); }
        const bright = I.bright == null ? 0.8 : I.bright;
        let filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
        filt.frequency.value = kind === 'strings' ? 1200 + 2600 * bright : kind === 'brass' ? 700 + 2400 * bright : kind === 'clarinet' ? (I.dark ? 900 : 1700) : kind === 'oboe' ? (I.pipes ? 3600 : 2600) : 3200;
        if (I.pipes) { const dg = ctx.createGain(); dg.gain.value = 0.45; dg.connect(filt); osc(ctx, 'sawtooth', f / 2, t, end, dg); }
        filt.Q.value = kind === 'brass' ? 2 : 0.7;
        if (kind === 'brass') { filt.frequency.setValueAtTime(400, t); filt.frequency.linearRampToValueAtTime(700 + 2400 * bright, t + 0.08); }
        filt.connect(g);
        let into = filt;
        if (kind === 'choir') {
          into = ctx.createGain();
          const fm = (o.vowel || I.vowel) === 'ooh' ? [[320, 6, 1], [800, 8, .35]] : [[730, 6, 1], [1090, 8, .5], [2440, 10, .15]];
          fm.forEach(([fr, q, gn]) => { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = q; const bg = ctx.createGain(); bg.gain.value = gn * 3; into.connect(bp); bp.connect(bg); bg.connect(filt); });
        }
        const wave = kind === 'flute' ? 'sine' : kind === 'clarinet' ? 'square' : 'sawtooth';
        for (let i = 0; i < n; i++) {
          const st = t + (n > 1 ? rnd(0, 0.025) : 0);
          const ov = osc(ctx, wave, f, st, end, into, n > 1 ? rnd(-9, 9) : 0);
          if (kind !== 'synth' && kind !== 'brass' && !I.pipes) vibrato(ctx, ov, st, end, rnd(5, 6), I.vib || (kind === 'flute' ? 6 : n > 1 ? 7 : 12), 0.2);
          if (kind === 'synth') osc(ctx, 'sawtooth', f, st, end, into, 12);
        }
        if (kind === 'flute') { const s = ctx.createBufferSource(); s.buffer = noise(ctx); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3; const ng = ctx.createGain(); ng.gain.value = I.breath || 0.15; s.connect(bp); bp.connect(ng); ng.connect(g); s.start(t); s.stop(end); }
      }
    }
    return end;
  };

  // ---------- drums ----------
  function drum(ctx, dest, t, type, vel) {
    const g = ctx.createGain(); g.connect(dest);
    if (type === 'k') {
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.9 * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); o.start(t); o.stop(t + 0.4);
    } else if (type === 's' || type === 'c') {
      const s = ctx.createBufferSource(); s.buffer = noise(ctx); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = type === 'c' ? 1500 : 900;
      s.connect(hp); hp.connect(g); g.gain.setValueAtTime((type === 'c' ? 0.35 : 0.5) * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + (type === 'c' ? 0.12 : 0.2)); s.start(t); s.stop(t + 0.25);
      if (type === 's') { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = 190; og.gain.setValueAtTime(0.3 * vel, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.12); }
    } else { // hats / ride
      const s = ctx.createBufferSource(); s.buffer = noise(ctx); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      s.connect(hp); hp.connect(g); const len = type === 'o' ? 0.25 : type === 'r' ? 0.3 : 0.05;
      g.gain.setValueAtTime((type === 'r' ? 0.12 : 0.18) * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.start(t); s.stop(t + len + 0.02);
    }
  }
  // patterns: 16 steps per 4/4 bar (12 per 3/4); letters k=kick s=snare h=hat o=open hat r=ride c=clap
  A.DRUMS = {
    'None': null,
    'Pop': { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    'Rock': { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    'Soft ballad': { k: 'x.......x.......', s: '........x.......', h: 'x...x...x...x...' },
    'R&B': { k: 'x..x......x.....', s: '....x.......x...', h: 'x.xxx.x.x.xxx.x.', swing: true },
    'Hip-hop': { k: 'x......x..x.....', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', swing: true },
    'Jazz swing': { k: 'x.......x.......', r: 'x...x.xx..x.x.xx', s: '....x.......x...', swing: true, soft: true },
    'Country': { k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
    'Waltz': { k: 'x...........', s: '....x...x...', h: 'x...x...x...' },
    'March': { k: 'x.......x.......', s: 'x.xxx.x.x.xxx.x.' },
    'Latin': { k: 'x..x..x.x..x..x.', r: 'x.x.x.x.x.x.x.x.', c: '...x..x....x..x.', soft: true },
    'Reggae': { k: '........x.......', s: '........x.......', h: '..x...x...x...x.' }
  };
  // extra percussion: switches on the Drums card. Patterns are 16 steps (first 12 used in 3/4). x = hit, h = high, l = low
  A.PERC = {
    tambourine: { name: 'Tambourine', pat: '..x...x...x...x.' },
    shaker: { name: 'Shaker', pat: 'xxxxxxxxxxxxxxxx' },
    cowbell: { name: 'Cowbell', pat: 'x...x...x...x...' },
    claps: { name: 'Hand claps', pat: '....x.......x...' },
    congas: { name: 'Congas', pat: 'l..h..h.l..h.hh.', world: 'Latin' },
    bongos: { name: 'Bongos', pat: 'hlhhhlhhhlhhhlhh', world: 'Latin, Caribbean' },
    tabla: { name: 'Tabla', pat: 'l.h.hlh.l.h.hlh.', world: 'Indian' },
    djembe: { name: 'Djembe', pat: 'l..hh.h.l..hh.h.', world: 'African' },
    darbuka: { name: 'Darbuka', pat: 'l..h.hl.l..h.hl.', world: 'Middle Eastern' }
  };
  function tone(ctx, dest, t, f0, f1, dec, peak, type) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(0.12, dec));
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dec + 0.02);
  }
  function burst(ctx, dest, t, type, fr, q, dec, peak) {
    const s = ctx.createBufferSource(); s.buffer = noise(ctx); const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dec + 0.02);
  }
  function perc(ctx, dest, t, name, hi, vel) {
    const v = vel;
    switch (name) {
      case 'tambourine': burst(ctx, dest, t, 'highpass', 6500, 1, 0.16, 0.3 * v); burst(ctx, dest, t, 'bandpass', 9000, 4, 0.12, 0.25 * v); break;
      case 'shaker': burst(ctx, dest, t, 'bandpass', 5200, 1.4, 0.06, 0.14 * v); break;
      case 'cowbell': { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2; bp.connect(dest); tone(ctx, bp, t, 545, 540, 0.3, 0.35 * v, 'square'); tone(ctx, bp, t, 815, 810, 0.3, 0.25 * v, 'square'); break; }
      case 'claps': [0, 0.012, 0.024].forEach((d, i) => burst(ctx, dest, t + d, 'bandpass', 1200, 1.5, i === 2 ? 0.14 : 0.03, 0.45 * v)); break;
      case 'congas': tone(ctx, dest, t, hi ? 360 : 230, hi ? 320 : 195, 0.28, 0.55 * v); burst(ctx, dest, t, 'bandpass', 2000, 1, 0.02, 0.15 * v); break;
      case 'bongos': tone(ctx, dest, t, hi ? 560 : 420, hi ? 520 : 390, 0.13, 0.42 * v); break;
      case 'tabla': if (hi) { tone(ctx, dest, t, 620, 610, 0.32, 0.32 * v); tone(ctx, dest, t, 1240, 1230, 0.18, 0.12 * v); } else tone(ctx, dest, t, 95, 140, 0.42, 0.6 * v); break;
      case 'djembe': if (hi) { burst(ctx, dest, t, 'bandpass', 1800, 1.2, 0.07, 0.4 * v); tone(ctx, dest, t, 520, 480, 0.08, 0.25 * v); } else tone(ctx, dest, t, 110, 72, 0.32, 0.75 * v); break;
      case 'darbuka': if (hi) burst(ctx, dest, t, 'bandpass', 3200, 2, 0.05, 0.42 * v); else tone(ctx, dest, t, 150, 98, 0.3, 0.65 * v); break;
    }
  }
  A.hearPerc = function (name) { const c = A.ctx(), pat = A.PERC[name].pat, spb = 60 / 100, t0 = c.currentTime + 0.05; for (let i = 0; i < 16; i++) { const ch = pat[i]; if (ch !== '.') perc(c, c.destination, t0 + i * spb / 4, name, ch === 'h', ch === 'x' && name === 'shaker' ? (i % 4 ? 0.6 : 1) : 0.9); } };

  // ---------- music helpers ----------
  const SCALE = [0, 2, 4, 5, 7, 9, 11];
  A.KEYS = { 'C major': 0, 'G major': 7, 'D major': 2, 'F major': 5, 'B♭ major': 10, 'E♭ major': 3, 'A major': 9 };
  A.inKey = (m, key) => SCALE.includes(((m - (A.KEYS[key] || 0)) % 12 + 12) % 12);
  A.snapToKey = (m, key) => { if (A.inKey(m, key)) return m; return A.inKey(m + 1, key) ? m + 1 : m - 1; };
  // move a pitch by n scale steps inside the key
  A.scaleStep = function (m, n, key) {
    const k = A.KEYS[key] || 0; m = A.snapToKey(m, key);
    let rel = m - k, oct = Math.floor(rel / 12), deg = SCALE.indexOf(((rel % 12) + 12) % 12);
    deg += n; oct += Math.floor(deg / 7); deg = ((deg % 7) + 7) % 7;
    return k + oct * 12 + SCALE[deg];
  };
  const CH = { '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'dim': [0, 3, 6], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7] };
  const NOTE = { C: 0, 'C#': 1, 'D♭': 1, Db: 1, D: 2, 'D#': 3, 'E♭': 3, Eb: 3, E: 4, F: 5, 'F#': 6, 'G♭': 6, Gb: 6, G: 7, 'G#': 8, 'A♭': 8, Ab: 8, A: 9, 'A#': 10, 'B♭': 10, Bb: 10, B: 11 };
  A.chordTones = function (name) {
    const m = /^([A-G](?:#|♭|b)?)(maj7|m7|m|7|dim|sus4|sus2)?$/.exec(String(name || '').trim());
    if (!m) return null;
    const root = NOTE[m[1]]; if (root == null) return null;
    return { root, tones: (CH[m[2] || ''] || CH['']).map(x => (root + x) % 12), q: m[2] || '' };
  };
  A.NAMES = ['C', 'C#', 'D', 'E♭', 'E', 'F', 'F#', 'G', 'A♭', 'A', 'B♭', 'B'];
  A.diatonicChords = function (key) {
    const k = A.KEYS[key] || 0, q = ['', 'm', 'm', '', '', 'm', 'dim'];
    return SCALE.map((s, i) => A.NAMES[(k + s) % 12] + q[i]);
  };

  // ---------- song timeline ----------
  A.sectionBeats = (song, sec) => sec.bars * song.ts;
  A.timeline = function (song) {
    let beat = 0; const out = [];
    song.sections.forEach(sec => { const len = A.sectionBeats(song, sec); out.push({ sec, start: beat, len }); beat += len; });
    return { secs: out, total: beat };
  };
  A.bgvPlan = function (song) {
    const v = song.vocals && song.vocals.bgv; if (!v || !v.on) return null;
    return v;
  };

  // schedule song onto ctx; returns {end, startAt, spb}
  A.schedule = function (ctx, song, opts) {
    opts = opts || {};
    const spb = 60 / song.tempo, swingAmt = 0.33;
    // master section (the Control Room): room sound, punch (compression), volume, fades, meters
    const M = song.master || {}, byp = !!M.bypass;
    const ROOMS = { 'Dry': [0.5, 0.35], 'Studio': [1.6, 0.8], 'Concert hall': [2.9, 1], 'Church': [4.6, 1.15], 'Stadium': [3.6, 1.05] };
    const room = ROOMS[byp ? 'Studio' : (M.room || 'Studio')] || ROOMS.Studio, punch = byp ? 0 : (M.punch || 0);
    const master = ctx.createGain(); master.gain.value = M.vol == null ? 0.9 : M.vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14 - 16 * punch; comp.ratio.value = 3 + 5 * punch; comp.attack.value = 0.01; comp.release.value = 0.2;
    const makeup = ctx.createGain(); makeup.gain.value = 1 + 0.7 * punch;
    const fader = ctx.createGain(); fader.gain.value = 1;
    master.connect(comp); comp.connect(makeup); makeup.connect(fader); fader.connect(opts.dest || ctx.destination);
    const meters = {};
    if (opts.meters) { const an = ctx.createAnalyser(); an.fftSize = 512; fader.connect(an); meters.master = an; }
    // shared reverb + echo
    const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, room[0]); const rvOut = ctx.createGain(); rvOut.gain.value = 0.8 * room[1]; conv.connect(rvOut); rvOut.connect(master);
    const dl = ctx.createDelay(2); dl.delayTime.value = spb * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.35; const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 3000;
    dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(master);
    // one mixing-board channel: fader → bass/treble EQ → pan, with echo and reverb sends and a meter
    function channel(p, key) {
      const g = ctx.createGain(); g.gain.value = (p.vol == null ? 0.8 : p.vol) * (p.mute ? 0 : 1);
      const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 220; lo.gain.value = byp ? 0 : (p.bass || 0);
      const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 3200; hi.gain.value = byp ? 0 : (p.treble || 0);
      g.connect(lo); lo.connect(hi);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = p.pan || 0; hi.connect(pan); pan.connect(master); } else hi.connect(master);
      const sr = ctx.createGain(); sr.gain.value = (p.rev == null ? 0.25 : p.rev) * 0.9; hi.connect(sr); sr.connect(conv);
      const se = ctx.createGain(); se.gain.value = (p.echo || 0) * 0.8; hi.connect(se); se.connect(dl);
      if (opts.meters && key) { const an = ctx.createAnalyser(); an.fftSize = 512; hi.connect(an); meters[key] = an; }
      return g;
    }
    const tl = A.timeline(song);
    const from = opts.fromBeat || 0, only = opts.section || null;
    const t0 = (opts.at != null ? opts.at : ctx.currentTime + 0.12) + (opts.countIn ? song.ts * spb : 0);
    let lastEnd = t0;
    const keep = s => !only || s.sec.id === only;
    const startBeatOf = s => only ? s.start - tl.secs.find(x => x.sec.id === only).start : s.start - from;
    const T = b => t0 + b * spb;
    const swing = (b, on) => { if (!on) return b; const fr = b % 1; return Math.abs(fr - 0.5) < 1e-6 ? b + swingAmt * 0.5 : b; };
    const anySolo = song.parts.some(p => p.solo);
    const vocalOn = !!(song.vocals && song.vocals.leadBuffer && !(song.vocals.leadMute));
    if (opts.countIn) for (let i = 0; i < song.ts; i++) drum(ctx, master, t0 - (song.ts - i) * spb, i ? 'h' : 'c', 0.8);
    // parts
    song.parts.forEach(p => {
      if (anySolo && !p.solo) return;
      const ch = channel(p, p.id), dstyle = A.DRUMS[song.drums && song.drums.style];
      tl.secs.forEach(s => {
        if (!keep(s)) return; const sb = startBeatOf(s); if (sb + s.len <= 0) return;
        if (p.off && p.off[s.sec.id]) return;
        const notes = (p.notes && p.notes[s.sec.id]) || [];
        const dyn = (p.dyn && p.dyn[s.sec.id]) || 'mf', vel = dyn === 'p' ? 0.45 : dyn === 'f' ? 1 : 0.72;
        let melGain = 1;
        if (p.role === 'melody' && vocalOn) { const lead = (song.vocals.lead || {})[s.sec.id] || 'voice'; melGain = lead === 'voice' ? 0.18 : lead === 'both' ? 0.7 : 1; }
        let b = 0;
        notes.forEach(n => {
          if (b >= s.len) return;
          const d = Math.min(n.d, s.len - b), at = sb + b;
          if (n.p != null && at >= 0) {
            const tt = T(swing(at, dstyle && dstyle.swing && n.d <= 0.5));
            const e = A.voice(ctx, ch, tt, d * spb * 0.96, n.p, p.inst, { vel: vel * melGain * (n.v || 1), solo: p.ens === 'solo', voices: A.SIZES[p.size] || 5, artic: p.artic });
            if (e > lastEnd) lastEnd = e;
          }
          b += n.d;
        });
      });
    });
    // chords accompaniment
    const cs = song.chordPart;
    if (cs && cs.on && !(anySolo && !cs.solo)) {
      const ch = channel(cs, 'chords'), style = cs.style || 'Block';
      tl.secs.forEach(s => {
        if (!keep(s)) return; const sb = startBeatOf(s);
        if (cs.off && cs.off[s.sec.id]) return;
        const list = (song.chords && song.chords[s.sec.id]) || [];
        for (let bar = 0; bar < s.sec.bars; bar++) {
          const c = A.chordTones(list[bar]); if (!c) continue;
          const base = 48 + c.root, notes = c.tones.map(x => 48 + ((x - c.root + 12) % 12) + c.root).map(m => m >= 60 ? m - 12 : m);
          const barStart = sb + bar * song.ts; if (barStart < 0) continue;
          const play = (beat, dur, ns, v) => ns.forEach(m => { const e = A.voice(ctx, ch, T(barStart + beat), dur * spb, m, cs.inst, { vel: v, solo: cs.ens === 'solo', voices: 4, artic: 'legato' }); if (e > lastEnd) lastEnd = e; });
          if (style === 'Sustained') play(0, song.ts * 0.98, notes, 0.5);
          else if (style === 'Arpeggio') { const arp = notes.concat([notes[0] + 12]); for (let i = 0; i < song.ts * 2; i++) play(i * 0.5, 0.5, [arp[i % arp.length]], 0.55); }
          else if (style === 'Strum') { for (let i = 0; i < song.ts; i++) play(i, 0.9, notes, i ? 0.45 : 0.6); }
          else { play(0, song.ts > 3 ? 1.9 : 0.9, notes, 0.55); if (song.ts > 3) play(2, 1.9, notes, 0.45); else play(1, 0.9, notes, 0.4), play(2, 0.9, notes, 0.4); }
          if (cs.bass) { const e = A.voice(ctx, ch, T(barStart), song.ts * spb * 0.95, 36 + c.root, 'Bass guitar', { vel: 0.7 }); if (e > lastEnd) lastEnd = e; }
        }
      });
    }
    // background layers (the Control Room): pads, arpeggios, strums that follow the chords
    (song.layers || []).forEach(L => {
      if (anySolo && !L.solo) return;
      const ch = channel(L, L.id), oct = (L.octave || 0) * 12;
      tl.secs.forEach(s => {
        if (!keep(s) || (L.off && L.off[s.sec.id])) return; const sb = startBeatOf(s);
        const list = (song.chords && song.chords[s.sec.id]) || [];
        for (let bar = 0; bar < s.sec.bars; bar++) {
          const c = A.chordTones(list[bar]); if (!c) continue;
          const barStart = sb + bar * song.ts; if (barStart < 0) continue;
          const tones = c.tones.map(x => { let m = 60 + oct + ((x - c.root + 12) % 12) + c.root; if (m >= 72 + oct) m -= 12; return m; });
          const root = (() => { let r = 36 + c.root + oct; if (r < 36) r += 12; return r; })();
          const play = (beat, dur, ns, v) => ns.forEach(m => { const e = A.voice(ctx, ch, T(barStart + beat), dur * spb, m, L.inst, { vel: v, solo: L.ens !== 'section', voices: A.SIZES[L.size] || 5, artic: L.artic || 'legato', vowel: L.vowel }); if (e > lastEnd) lastEnd = e; });
          const st = L.style || 'Pad';
          if (st === 'Pad') play(0, song.ts * 0.99, tones, 0.42);
          else if (st === 'Arpeggio') { const arp = tones.concat([tones[0] + 12, tones[1] + 12]); for (let i = 0; i < song.ts * 2; i++) play(i * 0.5, 0.5, [arp[i % arp.length]], 0.5); }
          else if (st === 'Strum') { for (let i = 0; i < song.ts; i++) play(i, 0.9, tones, i ? 0.4 : 0.55); }
          else if (st === 'Pulse') { for (let i = 0; i < song.ts * 2; i++) play(i * 0.5, 0.38, tones, i % 2 ? 0.28 : 0.38); }
          else if (st === 'Drone') play(0, song.ts * 0.99, [root], 0.6);
          else { play(0, song.ts > 3 ? 1.9 : 0.9, tones, 0.5); if (song.ts > 3) play(2, 1.9, tones, 0.42); }
        }
      });
    });
    // drums
    const ds = song.drums && A.DRUMS[song.drums.style];
    if (ds && !anySolo) {
      const dg = ctx.createGain(); dg.gain.value = (song.drums.vol == null ? 0.6 : song.drums.vol) * (song.drums.mute ? 0 : 1);
      const dlo = ctx.createBiquadFilter(); dlo.type = 'lowshelf'; dlo.frequency.value = 120; dlo.gain.value = byp ? 0 : (song.drums.bass || 0);
      const dhi = ctx.createBiquadFilter(); dhi.type = 'highshelf'; dhi.frequency.value = 5000; dhi.gain.value = byp ? 0 : (song.drums.treble || 0);
      dg.connect(dlo); dlo.connect(dhi); dhi.connect(master);
      if (opts.meters) { const an = ctx.createAnalyser(); an.fftSize = 512; dhi.connect(an); meters.drums = an; }
      const dr = ctx.createGain(); dr.gain.value = 0.15; dg.connect(dr); dr.connect(conv);
      const steps = song.ts === 3 ? 12 : 16;
      tl.secs.forEach(s => {
        if (!keep(s)) return; const sb = startBeatOf(s);
        if (song.drums.skip && song.drums.skip[s.sec.id]) return;
        for (let bar = 0; bar < s.sec.bars; bar++) {
          const barStart = sb + bar * song.ts; if (barStart < 0) continue;
          Object.keys(ds).forEach(k => {
            if (k.length !== 1) return; const pat = ds[k];
            for (let i = 0; i < steps; i++) {
              const c = pat[i % pat.length]; if (c !== 'x') continue;
              let beat = i / 4; if (ds.swing && i % 2 === 1) beat += 0.25 * swingAmt;
              const tt = T(barStart + beat);
              drum(ctx, dg, tt, k, (ds.soft ? 0.6 : 0.85) * (i % 4 === 0 ? 1 : 0.8));
              if (tt + 0.4 > lastEnd) lastEnd = tt + 0.4;
            }
          });
          if (bar === s.sec.bars - 1 && s.sec.bars > 1 && song.drums.fills !== false) drum(ctx, dg, T(barStart + song.ts - 0.5), 's', 0.7);
        }
      });
    }
    // extra percussion (tambourine, shaker, congas, tabla ...): plays with or without a drum beat
    const pc = song.perc, pcOn = pc && Object.keys(pc.on || {}).filter(k => pc.on[k] && A.PERC[k]);
    if (pcOn && pcOn.length && !anySolo) {
      const pg = ctx.createGain(); pg.gain.value = (pc.vol == null ? 0.55 : pc.vol) * (pc.mute ? 0 : 1); pg.connect(master);
      if (opts.meters) { const an = ctx.createAnalyser(); an.fftSize = 512; pg.connect(an); meters.perc = an; }
      const pr = ctx.createGain(); pr.gain.value = 0.18; pg.connect(pr); pr.connect(conv);
      const steps = song.ts === 3 ? 12 : 16, sw = ds && ds.swing;
      tl.secs.forEach(s => {
        if (!keep(s)) return; const sb = startBeatOf(s);
        pcOn.forEach(k => {
          if ((pc.off[k] || {})[s.sec.id]) return;
          const pat = A.PERC[k].pat;
          for (let bar = 0; bar < s.sec.bars; bar++) {
            const barStart = sb + bar * song.ts; if (barStart < 0) continue;
            for (let i = 0; i < steps; i++) {
              const c = pat[i]; if (c === '.') continue;
              let beat = i / 4; if (sw && i % 2 === 1) beat += 0.25 * swingAmt;
              const tt = T(barStart + beat); perc(ctx, pg, tt, k, c === 'h', (k === 'shaker' ? (i % 4 ? 0.55 : 1) : i % 4 === 0 ? 1 : 0.8));
              if (tt + 0.45 > lastEnd) lastEnd = tt + 0.45;
            }
          }
        });
      });
    }
    // background singers (synthesized choir following the melody)
    const bg = A.bgvPlan(song), mel = song.parts.find(p => p.role === 'melody');
    if (bg && mel && !anySolo) {
      const bgm = song.vocals.bgvMix || {};
      const ch = channel({ vol: (bg.blend === 'Big and bold' ? 0.9 : bg.blend === 'Even' ? 0.65 : 0.42) * (bgm.vol == null ? 1 : bgm.vol / 0.8), rev: bgm.rev == null ? 0.5 : bgm.rev, echo: bgm.echo == null ? 0.1 : bgm.echo, pan: bgm.pan || 0, bass: bgm.bass, treble: bgm.treble, mute: bgm.mute }, 'bgv');
      const count = bg.count === 'One' ? 1 : bg.count === 'A group' ? 6 : 3;
      const offs = [[2], [2, -2, 4], [2, -2, 4, 2, -2, 4]][count === 1 ? 0 : count === 3 ? 1 : 2];
      const vowel = bg.type === 'Oohs' ? 'ooh' : 'aah';
      tl.secs.forEach(s => {
        if (!keep(s)) return;
        const where = bg.where || 'Chorus only';
        if (where === 'Chorus only' && !/chorus/i.test(s.sec.name)) return;
        if (where === 'Pick sections' && !(bg.picked || []).includes(s.sec.id)) return;
        const sb = startBeatOf(s), notes = (mel.notes && mel.notes[s.sec.id]) || [];
        const sing = (beat, dur, m, i) => { const pan = count > 1 ? (i % 3 - 1) * 0.5 : 0; const e = A.voice(ctx, ch, T(beat), dur * spb, m, 'Choir', { vel: 0.5, voices: count > 3 ? 2 : 1, vowel, solo: count <= 3 }); if (e > lastEnd) lastEnd = e; };
        if (bg.type === 'Oohs' || bg.type === 'Aahs') {
          const list = (song.chords && song.chords[s.sec.id]) || [];
          for (let bar = 0; bar < s.sec.bars; bar++) {
            const c = A.chordTones(list[bar]); const bs = sb + bar * song.ts; if (bs < 0) continue;
            let tones = c ? c.tones.map(x => 60 + x) : null;
            if (!tones) { let b = 0, m = null; for (const n of notes) { if (b >= bar * song.ts && n.p != null) { m = n.p; break; } b += n.d; } if (m == null) continue; tones = [A.scaleStep(m, -2, song.key), A.scaleStep(m, -4, song.key), A.scaleStep(m, -7, song.key)]; }
            tones.slice(0, Math.max(1, Math.min(3, count))).forEach((m, i) => sing(bs, song.ts * 0.95, m > 72 ? m - 12 : m, i));
          }
        } else {
          let b = 0; const delay = bg.type === 'Echo last word' ? 1 : 0;
          notes.forEach((n, idx) => {
            const at = sb + b + delay;
            const isLast = idx === notes.length - 1 || (notes[idx + 1] && notes[idx + 1].p == null);
            const callOk = bg.type !== 'Call and response' || (Math.floor(b / song.ts) % 2 === 1);
            const echoOk = bg.type !== 'Echo last word' || isLast;
            if (n.p != null && at >= 0 && b < s.len && callOk && echoOk) offs.forEach((o, i) => sing(at, Math.min(n.d, 2) * 0.95, A.scaleStep(n.p, o, song.key), i));
            b += n.d;
          });
        }
      });
    }
    // recorded lead vocal
    if (vocalOn && !anySolo) {
      const V = song.vocals, src = ctx.createBufferSource();
      src.buffer = copyBuffer(ctx, V.leadBuffer);
      const ch = channel({ vol: V.vol == null ? 0.9 : V.vol, rev: V.rev == null ? 0.3 : V.rev, echo: V.echo || 0.1, pan: V.pan || 0, bass: V.bass, treble: V.treble }, 'vocal');
      src.connect(ch);
      // sections where the voice is switched off on the build grid
      if (V.off) tl.secs.forEach(x => { if (!V.off[x.sec.id]) return; const a = T(startBeatOf(x)), b = T(startBeatOf(x) + x.len); if (b <= t0) return; ch.gain.setValueAtTime(ch.gain.value, Math.max(t0, a)); ch.gain.setValueAtTime(0, Math.max(t0, a) + 0.005); ch.gain.setValueAtTime(V.vol == null ? 0.9 : V.vol, b); });
      const offsetBeats = only ? tl.secs.find(x => x.sec.id === only).start : from;
      const off = offsetBeats * spb + (V.offset || 0);
      if (off < src.buffer.duration) { src.start(t0, Math.max(0, off)); const e = t0 + src.buffer.duration - off; if (e > lastEnd) lastEnd = e; }
    }
    // fades for whole-song plays and downloads
    if (!only && !byp && (M.fadeIn || M.fadeOut)) {
      const musicEnd = T(tl.total - from) + 0.3;
      if (M.fadeIn) { fader.gain.setValueAtTime(0.0001, t0); fader.gain.linearRampToValueAtTime(1, t0 + M.fadeIn); }
      if (M.fadeOut && musicEnd - M.fadeOut > t0) { fader.gain.setValueAtTime(1, musicEnd - M.fadeOut); fader.gain.linearRampToValueAtTime(0.0001, musicEnd); lastEnd = Math.min(lastEnd, musicEnd + 0.1); }
    }
    return { startAt: t0, end: lastEnd, spb, master, meters };
  };
  function copyBuffer(ctx, b) {
    if (b.sampleRate === ctx.sampleRate || !ctx.createBuffer) return b;
    // resample by linear interpolation for offline renders at other rates
    const ratio = b.sampleRate / ctx.sampleRate, n = Math.floor(b.length / ratio), out = ctx.createBuffer(b.numberOfChannels, n, ctx.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) { const s = b.getChannelData(c), d = out.getChannelData(c); for (let i = 0; i < n; i++) { const x = i * ratio, j = Math.floor(x), f = x - j; d[i] = s[j] * (1 - f) + (s[j + 1] || 0) * f; } }
    return out;
  }
  const irCache = new Map();
  function impulse(ctx, secs) {
    const k = ctx.sampleRate + '|' + secs; if (irCache.has(k) && irCache.get(k).ctx === ctx) return irCache.get(k).b;
    const n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    irCache.set(k, { ctx, b }); return b;
  }

  // ---------- live play ----------
  let current = null;
  A.stop = function () {
    if (current) { try { current.master.disconnect(); } catch (e) { } current = null; }
  };
  A.play = function (song, opts) {
    A.stop(); const ctx = A.ctx();
    const out = ctx.createGain(); out.connect(ctx.destination);
    const r = A.schedule(ctx, song, Object.assign({ meters: true }, opts, { dest: out }));
    current = { master: out, startAt: r.startAt, end: r.end, spb: r.spb, meters: r.meters };
    return current;
  };
  A.meters = () => current && current.meters;
  A.isPlaying = () => !!current && A.ctx().currentTime < current.end;
  A.playhead = function () {
    if (!current) return null; const t = A.ctx().currentTime;
    if (t > current.end) { current = null; return null; }
    return (t - current.startAt) / current.spb;
  };
  A.preview = function (midi, inst, o) {
    const ctx = A.ctx(), g = ctx.createGain(); g.gain.value = 0.8; g.connect(ctx.destination);
    A.voice(ctx, g, ctx.currentTime + 0.01, (o && o.dur) || 0.5, midi, inst || 'Grand piano', o || {});
  };
  A.previewSequence = function (notes, inst, tempo, o) {
    A.stop(); const ctx = A.ctx(), g = ctx.createGain(); g.connect(ctx.destination);
    const spb = 60 / (tempo || 96); let t = ctx.currentTime + 0.08, end = t;
    notes.forEach(n => { if (n.p != null) end = Math.max(end, A.voice(ctx, g, t, n.d * spb * 0.95, n.p, inst, Object.assign({ vel: n.v || 0.75 }, o || {}))); t += n.d * spb; });
    current = { master: g, startAt: ctx.currentTime + 0.08, end: Math.max(end, t), spb };
    return current;
  };
  A.click = function (accent) { const ctx = A.ctx(); drum(ctx, ctx.destination, ctx.currentTime + 0.01, accent ? 'c' : 'h', 0.9); };

  // ---------- render to file ----------
  A.renderOffline = async function (song) {
    const sr = 44100, tl = A.timeline(song), spb = 60 / song.tempo;
    let secs = tl.total * spb + 3.5;
    if (song.vocals && song.vocals.leadBuffer && !song.vocals.leadMute) secs = Math.max(secs, song.vocals.leadBuffer.duration + 1);
    secs = Math.min(secs, 600);
    const off = new OfflineAudioContext(2, Math.ceil(sr * secs), sr);
    noiseBuf = null; // per-context buffers
    A.schedule(off, song, { at: 0.05 });
    const buf = await off.startRendering();
    noiseBuf = null;
    // even out loudness so quiet styles (classical) export as loud as pop
    let peak = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 3) { const v = Math.abs(d[i]); if (v > peak) peak = v; } }
    if (peak > 0.01) { const g = Math.min(4, 0.92 / peak); for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= g; } }
    return buf;
  };
  A.toWav = function (buf) {
    const n = buf.length, ch = buf.numberOfChannels, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return new Blob([out], { type: 'audio/wav' });
  };
  A.toMp3 = async function (buf, onProgress) {
    if (!window.lamejs) throw new Error('mp3 encoder missing');
    const enc = new lamejs.Mp3Encoder(2, buf.sampleRate, 160);
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    const toI16 = (f, s, e) => { const o = new Int16Array(e - s); for (let i = s; i < e; i++) { const v = Math.max(-1, Math.min(1, f[i])); o[i - s] = v < 0 ? v * 0x8000 : v * 0x7fff; } return o; };
    const parts = [], step = 1152 * 50;
    for (let i = 0; i < L.length; i += step) {
      const e = Math.min(L.length, i + step);
      const d = enc.encodeBuffer(toI16(L, i, e), toI16(R, i, e)); if (d.length) parts.push(new Uint8Array(d));
      if (onProgress) onProgress(i / L.length);
      await new Promise(r => setTimeout(r, 0));
    }
    const f = enc.flush(); if (f.length) parts.push(new Uint8Array(f));
    return new Blob(parts, { type: 'audio/mpeg' });
  };

  window.MSA = A;
})();
