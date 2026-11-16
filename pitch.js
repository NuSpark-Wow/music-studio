/* The Music Studio — microphone: record, find the notes you sang, and keep the take for the Vocal Room. */
(function () {
  const P = {};
  let stream = null, node = null, srcNode = null, chunks = [], recording = false, levelCb = null, sr = 44100;

  P.supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  P.start = async function (onLevel) {
    const ctx = MSA.ctx();
    if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    sr = ctx.sampleRate; chunks = []; levelCb = onLevel || null; recording = true;
    srcNode = ctx.createMediaStreamSource(stream);
    node = ctx.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = e => {
      if (!recording) return;
      const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d));
      if (levelCb) { let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i]; levelCb(Math.sqrt(s / (d.length / 4))); }
    };
    const mute = ctx.createGain(); mute.gain.value = 0;
    srcNode.connect(node); node.connect(mute); mute.connect(ctx.destination);
    return ctx.currentTime;
  };

  P.stop = function () {
    recording = false;
    try { srcNode && srcNode.disconnect(); node && node.disconnect(); } catch (e) { }
    let n = 0; chunks.forEach(c => n += c.length);
    const all = new Float32Array(n); let o = 0; chunks.forEach(c => { all.set(c, o); o += c.length; });
    chunks = [];
    return { data: all, sampleRate: sr };
  };
  P.release = function () { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };

  P.toBuffer = function (rec) {
    const ctx = MSA.ctx(), b = ctx.createBuffer(1, Math.max(1, rec.data.length), rec.sampleRate);
    b.getChannelData(0).set(rec.data); return b;
  };

  // YIN pitch for one frame → Hz or 0
  function yin(buf, rate) {
    const half = buf.length >> 1, d = new Float32Array(half);
    let rms = 0; for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length); if (rms < 0.012) return 0;
    const minT = Math.floor(rate / 1100), maxT = Math.min(half - 1, Math.floor(rate / 70));
    for (let t = 1; t <= maxT; t++) { let s = 0; for (let i = 0; i < half; i++) { const x = buf[i] - buf[i + t]; s += x * x; } d[t] = s; }
    let run = 0; d[0] = 1;
    for (let t = 1; t <= maxT; t++) { run += d[t]; d[t] = d[t] * t / (run || 1); }
    let tau = -1;
    for (let t = Math.max(2, minT); t <= maxT; t++) { if (d[t] < 0.15) { while (t + 1 <= maxT && d[t + 1] < d[t]) t++; tau = t; break; } }
    if (tau < 0) return 0;
    const a = d[tau - 1] || d[tau], b = d[tau], c = d[tau + 1] || d[tau];
    const shift = (a + c - 2 * b) ? (a - c) / (2 * (a + c - 2 * b)) : 0;
    return rate / (tau + shift);
  }

  // Turn a recording into notes. opts: tempo, key, snap (true = keep notes in the key), grid (beats)
  P.transcribe = function (rec, opts) {
    opts = opts || {};
    const rate = rec.sampleRate, data = rec.data, frame = 2048, hop = 512, spb = 60 / (opts.tempo || 96);
    const mids = [];
    for (let i = 0; i + frame < data.length; i += hop) {
      const f = yin(data.subarray(i, i + frame), rate);
      mids.push(f ? 69 + 12 * Math.log2(f / 440) : null);
    }
    // smooth with a 5-frame median
    const med = mids.map((m, i) => {
      const w = mids.slice(Math.max(0, i - 2), i + 3).filter(x => x != null);
      if (m == null || w.length < 3) return null;
      w.sort((a, b) => a - b); return w[w.length >> 1];
    });
    const fsec = hop / rate, segs = [];
    let cur = null;
    med.forEach((m, i) => {
      if (m == null) { if (cur) { segs.push(cur); cur = null; } return; }
      if (cur && Math.abs(m - cur.avg) < 0.7) { cur.sum += m; cur.n++; cur.avg = cur.sum / cur.n; cur.end = i; }
      else { if (cur) segs.push(cur); cur = { start: i, end: i, sum: m, n: 1, avg: m }; }
    });
    if (cur) segs.push(cur);
    const notes = segs.filter(s => (s.end - s.start + 1) * fsec >= 0.09).map(s => {
      let p = Math.round(s.avg);
      if (opts.snap !== false && opts.key) p = MSA.snapToKey(p, opts.key);
      return { p, t0: s.start * fsec, t1: (s.end + 1) * fsec };
    });
    // merge same-pitch neighbours separated by tiny gaps
    const merged = [];
    notes.forEach(n => { const l = merged[merged.length - 1]; if (l && l.p === n.p && n.t0 - l.t1 < 0.08) l.t1 = n.t1; else merged.push(n); });
    if (!merged.length) return [];
    // fit octave into a comfortable staff range
    const g = opts.grid || 0.5, out = [];
    const q = x => Math.max(0, Math.round(x / spb / g) * g);
    let beat = 0; const startOff = merged[0].t0;
    merged.forEach(n => {
      const s = q(n.t0 - startOff), e = Math.max(s + g, q(n.t1 - startOff));
      if (s > beat) out.push({ p: null, d: s - beat });
      if (s < beat) { if (e <= beat) return; }
      out.push({ p: n.p, d: e - Math.max(s, beat) }); beat = e;
    });
    // prefer singable range near middle C for treble (shift whole phrase by octaves)
    const avg = out.filter(n => n.p != null).reduce((a, n, _, arr) => a + n.p / arr.length, 0);
    const target = opts.range === 'bass' ? 50 : 67;
    const shift = Math.round((target - avg) / 12) * 12;
    if (opts.fitRange !== false) out.forEach(n => { if (n.p != null) n.p += shift; });
    return out;
  };

  window.MSP = P;
})();
