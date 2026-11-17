/* The Music Studio — draws music on a staff (white music paper or dark) and turns taps back into notes. */
(function () {
  const S = 10; // one staff space in px
  const G = () => window.MSG;
  const LETTERS = 'CDEFGAB', NAT = [0, 2, 4, 5, 7, 9, 11];
  const KEYSIG = { 'C major': 0, 'G major': 1, 'D major': 2, 'A major': 3, 'F major': -1, 'B♭ major': -2, 'E♭ major': -3 };
  const SHARP_ORDER = 'FCGDAEB', FLAT_ORDER = 'BEADGCF';
  // staff steps for key signature glyph placement (treble / bass)
  const SHARP_STEPS = { treble: [38, 35, 39, 36, 33, 37, 34], bass: [24, 21, 25, 22, 19, 23, 20] };
  const FLAT_STEPS = { treble: [34, 37, 33, 36, 32, 35, 31], bass: [20, 23, 19, 22, 18, 21, 17] };
  const BOTTOM = { treble: 30, bass: 18 }; // E4, G2
  const M = {};

  function keyAcc(key) {
    const n = KEYSIG[key] || 0, acc = {};
    if (n > 0) for (let i = 0; i < n; i++) acc[SHARP_ORDER[i]] = 1;
    if (n < 0) for (let i = 0; i < -n; i++) acc[FLAT_ORDER[i]] = -1;
    return acc;
  }
  M.keyAcc = keyAcc;
  // midi → { step, letter, acc } spelled for the key
  function spell(m, key) {
    const n = KEYSIG[key] || 0, ka = keyAcc(key), pc = ((m % 12) + 12) % 12, oct = Math.floor(m / 12) - 1;
    for (let i = 0; i < 7; i++) { const L = LETTERS[i], a = ka[L] || 0; if ((NAT[i] + a + 12) % 12 === pc) return { step: (oct + (NAT[i] + a < 0 ? 1 : NAT[i] + a > 11 ? -1 : 0)) * 7 + i, letter: L, acc: a }; }
    const ni = NAT.indexOf(pc); if (ni >= 0) return { step: oct * 7 + ni, letter: LETTERS[ni], acc: 0 };
    const useFlat = n < 0 || pc === 10 || pc === 3 && n <= 0;
    if (useFlat) { const i = NAT.indexOf(pc + 1); return { step: oct * 7 + i, letter: LETTERS[i], acc: -1 }; }
    const i = NAT.indexOf(pc - 1); return { step: oct * 7 + i, letter: LETTERS[i], acc: 1 };
  }
  M.spell = spell;
  M.stepToMidi = function (step, key) {
    const oct = Math.floor(step / 7), i = ((step % 7) + 7) % 7, L = LETTERS[i];
    return (oct + 1) * 12 + NAT[i] + (keyAcc(key)[L] || 0);
  };
  M.name = function (m, key) { const s = spell(m, key); return s.letter + (s.acc > 0 ? '♯' : s.acc < 0 ? '♭' : ''); };

  const DUR = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
  function pieces(len, startInBar) {
    const out = []; let left = len, pos = startInBar;
    while (left > 1e-6) {
      const off = pos % 1; let d = DUR.find(x => x <= left + 1e-6 && (off < 1e-6 ? (x < 1 || x === 1 || x >= 1) && (x <= 1 || Math.abs(pos % 2) < 1e-6 || x <= 2 - (pos % 2) + 1e-6) : x <= 1 - off + 1e-6)) || 0.25;
      if (d > left) d = left;
      out.push(d); left -= d; pos += d;
    }
    return out;
  }
  function glyph(name, x, y, color, scale) {
    const g = G()[name]; if (!g) return '';
    const s = (scale || 1) * S / 250;
    return `<path d="${g.d}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})" fill="${color}"/>`;
  }
  M.glyph = glyph;

  /* opts: notes, clef, key, ts, bars, width, chords, names, sel, color, play (beat), paper, lyrics, dyn, showClef */
  M.render = function (o) {
    const paper0 = o.paper === 'dark' ? { bg: '#1d1f25', ink: '#e8e3d8', line: '#6b7080', name: '#b3b0a8', sel: 'rgba(242,179,61,.25)' } : { bg: '#fbfaf6', ink: '#141414', line: '#2a2a2a', name: '#555', sel: 'rgba(242,179,61,.35)' };
    const paper = Object.assign({}, paper0, o.bg ? { bg: o.bg } : {});
    const color = o.color || paper.ink, clef = o.clef || 'treble', ts = o.ts || 4, bars = Math.max(1, o.bars || 4), key = o.key || 'C major';
    const width = Math.max(300, o.width || 800), ksN = Math.abs(KEYSIG[key] || 0);
    const head = 14 + 34 + ksN * 11 + (o.showTS !== false ? 30 : 6);
    const mpl = Math.max(1, Math.min(bars, Math.floor((width - head) / (o.minBar || 150)) || 1));
    const lines = Math.ceil(bars / mpl);
    const top = o.chords ? 40 : 30, sysH = top + 4 * S + (o.names ? 44 : 34);
    const H = lines * sysH + 6;
    const bottom = BOTTOM[clef], mid = bottom + 4;
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="100%" height="${H}" style="display:block;background:${paper.bg};border-radius:8px;touch-action:manipulation" role="img" aria-label="${o.label || clef + ' staff'}">`];
    const map = { lines: [], width, H, clef, key, ts, bars };
    const ka = keyAcc(key);
    for (let L = 0; L < lines; L++) {
      const y0 = L * sysH + top, firstBar = L * mpl, nb = Math.min(mpl, bars - firstBar);
      const x0 = 8, xh = x0 + (L === 0 || true ? head : 30), x1 = width - 10, mw = (x1 - xh) / mpl;
      for (let i = 0; i < 5; i++) out.push(`<line x1="${x0}" x2="${(xh + mw * nb).toFixed(1)}" y1="${y0 + i * S}" y2="${y0 + i * S}" stroke="${paper.line}" stroke-width="1"/>`);
      out.push(clef === 'treble' ? glyph('gClef', x0 + 4, y0 + 3 * S, paper.ink) : glyph('fClef', x0 + 4, y0 + S, paper.ink));
      // key signature
      const steps = (KEYSIG[key] || 0) > 0 ? SHARP_STEPS[clef] : FLAT_STEPS[clef];
      for (let i = 0; i < ksN; i++) {
        const st = steps[i], y = y0 + 4 * S - (st - bottom) * S / 2;
        out.push(glyph((KEYSIG[key] || 0) > 0 ? 'accidentalSharp' : 'accidentalFlat', x0 + 38 + i * 11, y, paper.ink));
      }
      if (L === 0 && o.showTS !== false) {
        const tx = x0 + 42 + ksN * 11 + (ksN ? 4 : 0);
        out.push(glyph('timeSig' + ts, tx, y0 + S, paper.ink), glyph('timeSig4', tx, y0 + 3 * S, paper.ink));
      }
      const lineMap = { y0, top: y0 - top, bottom: y0 - top + sysH, measures: [] };
      for (let b = 0; b < nb; b++) {
        const bx = xh + b * mw;
        out.push(`<line x1="${(bx + mw).toFixed(1)}" x2="${(bx + mw).toFixed(1)}" y1="${y0}" y2="${y0 + 4 * S}" stroke="${paper.line}" stroke-width="${firstBar + b === bars - 1 ? 2.5 : 1.2}"/>`);
        lineMap.measures.push({ x: bx, w: mw, bar: firstBar + b });
        if (o.chords && o.chords[firstBar + b]) out.push(`<text x="${(bx + 10).toFixed(1)}" y="${y0 - 16}" fill="${paper.ink}" style="font:700 14px Inter,system-ui,sans-serif">${esc(o.chords[firstBar + b])}</text>`);
      }
      if (o.dyn && L === 0) out.push(dynGlyph(o.dyn, x0 + 36, y0 + 4 * S + 24, paper.ink));
      map.lines.push(lineMap);
    }
    // spacing: each onset gets room by its length (short notes need less, but never collide)
    const ons = {}; { let bt = 0; (o.notes || []).forEach(n => { let left = n.d, pos = bt; while (left > 1e-6 && pos < bars * ts - 1e-6) { const bar = Math.floor(pos / ts + 1e-9), inBar = pos - bar * ts, seg = Math.min(left, ts - inBar); let p = inBar; pieces(seg, inBar).forEach(d => { (ons[bar] = ons[bar] || {})[p.toFixed(3)] = Math.min(((ons[bar] || {})[p.toFixed(3)] || 99), d); p += d; }); left -= seg; pos += seg; } bt += n.d; }); }
    const layout = {};
    const barLayout = (bar, mw) => {
      if (layout[bar]) return layout[bar];
      const o2 = ons[bar] || {}; const pts = Object.keys(o2).map(Number).sort((a, b) => a - b);
      // fill empty stretches with virtual quarter onsets so taps map evenly
      for (let q = 0; q < ts; q++) if (!pts.some(p => p <= q + 1e-6 && p + (o2[p.toFixed(3)] || 1) > q + 1e-6)) pts.push(q);
      pts.sort((a, b) => a - b);
      const w = pts.map((p, i) => { const nx = i < pts.length - 1 ? pts[i + 1] : ts; return 16 + 30 * Math.pow(nx - p, 0.6); });
      const tot = w.reduce((a, b) => a + b, 0), scale = (mw - 22) / tot;
      let x = 14; const xs = pts.map((p, i) => { const r = x; x += w[i] * scale; return r; });
      return (layout[bar] = { pts, xs, end: mw - 8 });
    };
    const barX = (bar, beatInBar) => {
      const L = Math.floor(bar / mpl), lm = map.lines[L]; if (!lm) return null;
      const m = lm.measures[bar - L * mpl]; const ly = barLayout(bar, m.w);
      let i = ly.pts.length - 1; while (i > 0 && ly.pts[i] > beatInBar + 1e-6) i--;
      const p0 = ly.pts[i], x0p = ly.xs[i], p1 = i < ly.pts.length - 1 ? ly.pts[i + 1] : ts, x1p = i < ly.pts.length - 1 ? ly.xs[i + 1] : ly.end;
      const x = x0p + (p1 > p0 ? (beatInBar - p0) / (p1 - p0) : 0) * (x1p - x0p);
      return { x: m.x + x, L, y0: lm.y0 };
    };
    map.beatAtX = (bar, px) => { const L = Math.floor(bar / mpl), m = map.lines[L].measures[bar - L * mpl], ly = barLayout(bar, m.w), x = px - m.x;
      let i = ly.xs.length - 1; while (i > 0 && ly.xs[i] > x) i--;
      const p0 = ly.pts[i], x0p = ly.xs[i], p1 = i < ly.pts.length - 1 ? ly.pts[i + 1] : ts, x1p = i < ly.pts.length - 1 ? ly.xs[i + 1] : ly.end;
      return Math.max(0, Math.min(ts, p0 + (x1p > x0p ? (x - x0p) / (x1p - x0p) : 0) * (p1 - p0))); };
    map.barX = barX;
    // ghost notes: the melody drawn faintly behind a harmony or bass part (not tappable as your notes)
    const ghosts = [];
    if (o.ghost && o.ghost.length) {
      const gc = o.ghostColor || (o.paper === 'dark' ? 'rgba(232,227,216,.28)' : 'rgba(20,20,20,.22)');
      let gb = 0;
      o.ghost.forEach((n, gi) => {
        if (n.p != null && gb < bars * ts - 1e-6) {
          const bar = Math.floor(gb / ts + 1e-9), inBar = gb - bar * ts, d0 = Math.min(n.d, ts - inBar), d = pieces(d0, inBar)[0];
          const pt = barX(bar, inBar);
          if (pt) { const sp = spell(n.p, key), y = pt.y0 + 4 * S - (sp.step - bottom) * S / 2;
            out.push(`<g opacity="1">${noteSvg(d, pt.x, y, pt.y0, sp.step, mid, bottom, gc, gc)}</g>`);
            ghosts.push({ gi, x: pt.x, y, L: pt.L, p: n.p, beat: gb, d: n.d }); }
        }
        gb += n.d;
      });
    }
    map.ghosts = ghosts;
    const notes = o.notes || []; let beat = 0; const heads = [];
    const accState = {}; let accBar = -1;
    notes.forEach((n, idx) => {
      let left = n.d, pos = beat;
      while (left > 1e-6 && pos < bars * ts - 1e-6) {
        const bar = Math.floor(pos / ts + 1e-9), inBar = pos - bar * ts, room = ts - inBar;
        const segLen = Math.min(left, room);
        const ps = pieces(segLen, inBar);
        let p = inBar;
        ps.forEach((d, k) => {
          const pt = barX(bar, p); if (!pt) return;
          const isLastPiece = left - segLen < 1e-6 && k === ps.length - 1;
          const isSel = o.sel === idx;
          if (isSel) out.push(`<rect x="${(pt.x - 9).toFixed(1)}" y="${pt.y0 - 26}" width="22" height="${4 * S + 52}" rx="6" fill="${paper.sel}"/>`);
          if (n.p == null) out.push(rest(d, pt.x, pt.y0, color));
          else {
            if (bar !== accBar) { for (const k2 in accState) delete accState[k2]; accBar = bar; }
            const sp = spell(n.p, key), y = pt.y0 + 4 * S - (sp.step - bottom) * S / 2;
            const kk = sp.letter + Math.floor(sp.step / 7), expect = accState[kk] != null ? accState[kk] : (ka[sp.letter] || 0);
            if (sp.acc !== expect && p === inBar && k === 0 && pos === beat) { out.push(glyph(sp.acc > 0 ? 'accidentalSharp' : sp.acc < 0 ? 'accidentalFlat' : 'accidentalNatural', pt.x - 16, y, color)); accState[kk] = sp.acc; }
            out.push(noteSvg(d, pt.x, y, pt.y0, sp.step, mid, bottom, color, paper.line));
            if (!isLastPiece || (k < ps.length - 1)) { const nx = barX(bar, p + d); if (nx && nx.L === pt.L) out.push(`<path d="M${pt.x + 4} ${y + 7} Q ${(pt.x + nx.x) / 2} ${y + 13} ${nx.x - 4} ${y + 7}" fill="none" stroke="${color}" stroke-width="1.3"/>`); }
            if (o.names && k === 0 && pos === beat) out.push(`<text x="${pt.x}" y="${pt.y0 + 4 * S + 34}" text-anchor="middle" fill="${color}" style="font:700 11px Inter,system-ui,sans-serif">${M.name(n.p, key)}</text>`);
            heads.push({ idx, x: pt.x, y, L: pt.L });
          }
          if (n.p == null) heads.push({ idx, x: pt.x, y: pt.y0 + 2 * S, L: pt.L, rest: true });
          p += d;
        });
        left -= segLen; pos += segLen;
      }
      beat += n.d;
    });
    map.heads = heads; map.used = beat;
    // playhead
    if (o.play != null && o.play >= 0 && o.play < bars * ts) {
      const bar = Math.floor(o.play / ts), pt = barX(bar, o.play - bar * ts);
      if (pt) out.push(`<line x1="${pt.x}" x2="${pt.x}" y1="${pt.y0 - 18}" y2="${pt.y0 + 4 * S + 18}" stroke="#f2b33d" stroke-width="3" stroke-linecap="round"/>`);
    }
    // lyrics line under the staff (one line of text per system 1)
    if (o.lyrics) out.push(`<text x="${head}" y="${map.lines[0].y0 + 4 * S + (o.names ? 46 : 30)}" fill="${paper.name}" style="font:italic 13px Georgia,serif">${esc(o.lyrics).slice(0, 140)}</text>`);
    out.push('</svg>');
    return { svg: out.join(''), map };
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function dynGlyph(d, x, y, c) {
    const parts = d === 'p' ? ['dynamicPiano'] : d === 'f' ? ['dynamicForte'] : ['dynamicMezzo', 'dynamicForte'];
    let s = '', xx = x; parts.forEach(g => { s += glyph(g, xx, y, c, 1.2); xx += (G()[g].w * S / 250) * 1.2 + 1; }); return s;
  }
  const baseOf = d => [4, 2, 1, 0.5, 0.25].find(b => b <= d + 1e-6) || 0.25;
  // a single note (or rest) as a small icon for buttons
  M.icon = function (d, color, rest) {
    const c = color || 'currentColor', base = baseOf(d), dotted = Math.abs(d - base * 1.5) < 1e-6;
    // every icon sits on the same baseline and is centered left-to-right, so a row of buttons lines up
    const x = 12 - (base <= 0.5 ? 3 : 0) - (dotted ? 3 : 0), y = base === 4 ? 36 : 50;
    const inner = rest ? restSvg(d, 14, 14, c) : noteSvg(d, x, y, 12, 30, 34, 30, c, 'transparent');
    return `<svg width="18" height="34" viewBox="0 6 28 54" aria-hidden="true" style="vertical-align:middle;flex:0 0 auto;display:inline-block">${inner}</svg>`;
  };
  function noteSvg(d, x, y, y0, step, mid, bottom, c, lc) {
    let s = '';
    // ledger lines
    const lo = bottom, hi = bottom + 8;
    for (let st = lo - 2; st >= step; st -= 2) { const ly = y0 + 4 * S - (st - bottom) * S / 2; s += `<line x1="${x - 9}" x2="${x + 9}" y1="${ly}" y2="${ly}" stroke="${lc}" stroke-width="1.2"/>`; }
    for (let st = hi + 2; st <= step; st += 2) { const ly = y0 + 4 * S - (st - bottom) * S / 2; s += `<line x1="${x - 9}" x2="${x + 9}" y1="${ly}" y2="${ly}" stroke="${lc}" stroke-width="1.2"/>`; }
    const base = baseOf(d), dotted = Math.abs(d - base * 1.5) < 1e-6;
    const hw = 295 * S / 250, hx = x - hw / 2;
    s += glyph(base === 4 ? 'noteheadWhole' : base === 2 ? 'noteheadHalf' : 'noteheadBlack', hx, y, c);
    if (base < 4) {
      const up = step < mid, sx = up ? hx + hw - 0.6 : hx + 0.6, sy2 = up ? y - 3.5 * S : y + 3.5 * S;
      s += `<line x1="${sx}" x2="${sx}" y1="${y}" y2="${sy2}" stroke="${c}" stroke-width="1.3"/>`;
      if (base <= 0.5) s += glyph(base === 0.5 ? (up ? 'flag8thUp' : 'flag8thDown') : (up ? 'flag16thUp' : 'flag16thDown'), sx - 0.6, sy2, c);
    }
    if (dotted) s += `<circle cx="${hx + hw + 8}" cy="${(step % 2 === 0) ? y - S / 2 : y}" r="2.2" fill="${c}"/>`;
    return s;
  }
  function restSvg(d, x, y0, c) { return rest(d, x, y0, c); }
  function rest(d, x, y0, c) {
    const base = baseOf(d);
    const name = base === 4 ? 'restWhole' : base === 2 ? 'restHalf' : base === 1 ? 'restQuarter' : base === 0.5 ? 'rest8th' : 'rest16th';
    const y = base === 4 ? y0 + S : base === 2 ? y0 + 2 * S : y0 + 2 * S;
    const w = G()[name].w * S / 250;
    let s = glyph(name, x - w / 2, y, c);
    if (Math.abs(d - base * 1.5) < 1e-6) s += `<circle cx="${x + w / 2 + 4}" cy="${y0 + 1.5 * S}" r="1.8" fill="${c}"/>`;
    return s;
  }

  // tap → { beat, midi, noteIndex }
  M.pick = function (map, x, y) {
    let L = map.lines.findIndex(l => y >= l.top && y < l.bottom); if (L < 0) L = y < map.lines[0].top ? 0 : map.lines.length - 1;
    const lm = map.lines[L];
    let near = null, best = 16;
    map.heads.forEach(h => { if (h.L !== L) return; const dx = Math.abs(h.x - x); if (dx < best) { best = dx; near = h; } });
    const bottom = BOTTOM[map.clef];
    const step = Math.round((lm.y0 + 4 * S - y) / (S / 2)) + bottom;
    let m = lm.measures.find(mm => x >= mm.x && x < mm.x + mm.w) || (x < lm.measures[0].x ? lm.measures[0] : lm.measures[lm.measures.length - 1]);
    const beat = m.bar * map.ts + Math.round(map.beatAtX(m.bar, x) * 2) / 2;
    let ghost = null, gb = 14;
    (map.ghosts || []).forEach(g => { if (g.L !== L) return; const dd = Math.abs(g.x - x) + Math.abs(g.y - y) * 0.6; if (Math.abs(g.x - x) < 12 && Math.abs(g.y - y) < 12 && dd < gb) { gb = dd; ghost = g; } });
    const ownNear = near && Math.abs(near.y - y) < 14;
    return { beat, step, midi: M.stepToMidi(Math.max(bottom - 8, Math.min(bottom + 16, step)), map.key), noteIndex: near ? near.idx : null, onHead: !!ownNear, ghost: ownNear ? null : ghost };
  };

  M.stepAtY = function (map, L, y) { const lm = map.lines[L] || map.lines[0], bottom = BOTTOM[map.clef]; return Math.max(bottom - 8, Math.min(bottom + 16, Math.round((lm.y0 + 4 * S - y) / (S / 2)) + bottom)); };
  M.lineAtY = function (map, y) { let L = map.lines.findIndex(l => y >= l.top && y < l.bottom); if (L < 0) L = y < map.lines[0].top ? 0 : map.lines.length - 1; return L; };
  window.MSS = M;
})();
