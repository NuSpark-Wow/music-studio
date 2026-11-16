/* The Music Studio — Scan sheet music: a photo of a lead sheet (fakebook page) becomes melody + chords, ready to arrange. */
(function () {
  const MS = window.MS, S = MS.S, A = () => window.MSA, esc = MS.esc;
  let st = null; // { img, busy, result, err }

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nameToMidi(n) {
    const m = /^([A-Ga-g])(#{1,2}|b{1,2}|♯|♭|n)?(-?\d)$/.exec(String(n || '').trim()); if (!m) return null;
    let v = NOTE[m[1].toUpperCase()], acc = m[2] || '';
    v += acc === '#' || acc === '♯' ? 1 : acc === '##' ? 2 : acc === 'b' || acc === '♭' ? -1 : acc === 'bb' ? -2 : 0;
    return (parseInt(m[3], 10) + 1) * 12 + v;
  }
  const KEYMAP = { '0': 'C major', '1#': 'G major', '2#': 'D major', '3#': 'A major', '1b': 'F major', '2b': 'B♭ major', '3b': 'E♭ major' };

  // turn the AI's bar list into a Music Studio song
  function toSong(r, title) {
    const ks = String(r.keySignature || '0').replace(/\s/g, '').replace('♯', '#').replace('♭', 'b');
    const key = KEYMAP[ks] || 'C major';
    const tsRaw = String(r.timeSignature || '4/4');
    const ts = /^3\/4$|^6\/8$|^3\/8$/.test(tsRaw) ? 3 : 4, merge2 = /^2\/4$/.test(tsRaw);
    // bars → list of {notes, chord}, each exactly ts beats
    let bars = r.bars.map(b => ({ chord: (b.chords || [])[0] || '', notes: (b.notes || []).map(n => ({ p: /rest/i.test(n.pitch) ? null : nameToMidi(n.pitch), d: n.beats, tie: n.tie })) }));
    if (merge2) { const mb = []; for (let i = 0; i < bars.length; i += 2) mb.push({ chord: bars[i].chord || (bars[i + 1] || {}).chord || '', notes: bars[i].notes.concat(bars[i + 1] ? bars[i + 1].notes : []) }); bars = mb; }
    if (/^6\/8$|^3\/8$/.test(tsRaw) && /^3\/8$/.test(tsRaw)) bars.forEach(b => b.notes.forEach(n => n.d *= 2));
    const q = d => Math.max(0.25, Math.round(d * 4) / 4);
    const fit = (notes, len, padFront) => {
      let ns = notes.map(n => Object.assign({}, n, { d: q(n.d) })), sum = ns.reduce((a, n) => a + n.d, 0);
      while (sum > len + 1e-6 && ns.length) { const last = ns[ns.length - 1], cut = Math.min(last.d - 0.25, sum - len); if (cut > 0) { last.d -= cut; sum -= cut; } else { sum -= last.d; ns.pop(); } }
      if (sum < len - 1e-6) { const gap = { p: null, d: len - sum }; padFront ? ns.unshift(gap) : ns.push(gap); }
      return ns;
    };
    const flat = [];
    bars.forEach((b, i) => { const pick = i === 0 && r.pickupBeats > 0 && r.pickupBeats < ts; fit(b.notes, ts, pick).forEach(n => flat.push(n)); });
    // join tied notes of the same pitch
    const mel = [];
    flat.forEach(n => { const l = mel[mel.length - 1]; if (l && l.tie && l.p != null && l.p === n.p) { l.d += n.d; l.tie = n.tie; } else mel.push({ p: n.p, d: n.d, tie: n.tie }); });
    mel.forEach(n => delete n.tie);
    // keep the melody in a comfortable treble range
    const ps = mel.filter(n => n.p != null).map(n => n.p), avg = ps.reduce((a, b) => a + b, 0) / (ps.length || 1);
    const shift = avg < 57 ? 12 * Math.ceil((60 - avg) / 12) : avg > 81 ? -12 : 0; if (shift) mel.forEach(n => { if (n.p != null) n.p += shift; });
    // split into sections of 8 bars
    const s = MS.blankSong(); s.title = title || r.title || 'Scanned song'; s.key = key; s.ts = ts; s.tempo = r.tempo || (ts === 3 ? 100 : 96); s.source = 'other';
    s.sections = []; const P = s.parts[0]; const per = 8, nb = bars.length, names = 'ABCDEFG';
    let beat = 0, idx = 0;
    for (let i = 0; i < nb; i += per) {
      const n = Math.min(per, nb - i), id = MS.id('s'); s.sections.push({ id, name: nb <= per ? 'Verse' : 'Part ' + names[Math.floor(i / per)], bars: n });
      const len = n * ts, out = []; let acc = 0;
      while (idx < mel.length && acc < len - 1e-6) { const x = mel[idx]; const take = Math.min(x.d, len - acc); out.push({ p: x.p, d: take }); acc += take; if (take < x.d) { mel[idx] = { p: x.p, d: x.d - take }; } else idx++; }
      P.notes[id] = out; s.chords[id] = bars.slice(i, i + n).map(b => b.chord);
      beat += len;
    }
    if (s.sections.some(x => s.chords[x.id].some(Boolean))) s.chordPart.on = true;
    return s;
  }
  MS.scanToSong = toSong;

  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const max = 1800, sc = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.86);
    } finally { URL.revokeObjectURL(url); }
  }

  MS.a.scan = function () { st = { img: null, busy: false, result: null, err: '' }; draw(); };
  function draw() {
    const m = document.querySelector('.modal'); const html = body();
    if (m && m.dataset.scan) m.querySelector('.box').innerHTML = html; else { const mm = MS.modal(html); mm.dataset.scan = '1'; }
  }
  function body() {
    const agreed = S.agreed;
    let h = `<div class="row" style="justify-content:space-between"><h2>Scan sheet music</h2><div class="row">${MS.helpBtn('scan')}<button class="btn sm ghost" onclick="MS.closeModal()">Close</button></div></div>
      <div class="small muted" style="margin-top:6px">Take a photo of one page of sheet music, like a fakebook lead sheet. The melody and chords come into the studio so you can arrange instead of write.</div>`;
    if (!agreed) return h + `<div class="card col" style="margin-top:12px;border-color:var(--coral)"><div class="label" style="color:var(--coral)">First, personal use</div><label class="row small" style="align-items:flex-start;gap:10px"><input type="checkbox" onchange="MS.a.agree(this.checked);MS.a._scanDraw()"><span>If I scan music I didn't write (from a fakebook, a book, a website or any other source), it's for my own enjoyment. I won't post it on public networks or sell it.</span></label></div>`;
    if (!st.result) {
      h += `<div class="col" style="margin-top:12px">
        <div class="row"><label class="btn primary" style="cursor:pointer">📷 Take or choose a photo<input type="file" accept="image/*" capture="environment" hidden onchange="MS.a._scanFile(this.files[0])"></label>${st.img ? `<button class="btn" ${st.busy ? 'disabled' : ''} onclick="MS.a._scanRead()">${st.busy ? 'Reading the music…' : 'Read the music'}</button>` : ''}</div>
        ${st.img ? `<img src="${st.img}" alt="Your sheet music photo" style="max-width:100%;max-height:360px;object-fit:contain;border-radius:10px;border:1px solid var(--line);background:#fff">` : ''}
        ${st.busy ? '<div class="small" style="color:var(--teal)">Reading clef, key, notes and chords… this takes 15 to 40 seconds.</div>' : ''}
        ${st.err ? `<div class="small" style="color:var(--coral)">${esc(st.err)}</div>` : ''}
        <div class="tiny muted">Best results: one page, printed (not handwritten), held flat, good light, the whole staff in the picture. A screenshot of a PDF works great. Lyrics are not copied.</div></div>`;
      return h;
    }
    const r = st.result, s = st.song;
    h += `<div class="col" style="margin-top:12px"><div class="label">Here's what I read</div>
      <div class="small">${s.sections.reduce((a, x) => a + x.bars, 0)} bars · ${esc(s.key)} · ${s.ts}/4${r.truncated ? ' · the page had more bars than I could read at once; scan the rest as a second photo' : ''}</div>
      ${s.sections.map(x => `<div class="small" style="font-weight:700;margin-top:4px">${esc(x.name)}</div>` + MSS.render({ notes: s.parts[0].notes[x.id], clef: 'treble', key: s.key, ts: s.ts, bars: x.bars, width: 900, chords: s.chords[x.id], names: S.level !== 'Advanced', paper: S.paper, color: S.paper === 'dark' ? '#f2b33d' : '#9a5f00', minBar: 190 }).svg).join('')}
      <div class="row"><button class="btn" onclick="MS.a._scanHear()">▶ Hear it</button><button class="btn ghost" onclick="MSA.stop()">■</button></div>
      <label class="f">Song title<input id="scanTitle" value="${esc(s.title)}" maxlength="80"></label>
      <div class="row"><button class="btn primary" onclick="MS.a._scanKeep('new')">Keep as a new song</button>${S.song ? `<button class="btn" onclick="MS.a._scanKeep('add')">Add to “${esc(S.song.title)}” (next page)</button>` : ''}<button class="btn ghost" onclick="MS.a.scan()">Try another photo</button></div>
      <div class="tiny muted">Not quite right? Keep it, then tap any note in the studio to fix it. Scanned songs are marked “written by someone else”, so downloads say Personal use only.</div></div>`;
    return h;
  }
  MS.a._scanDraw = draw;
  MS.a._scanFile = async function (f) { if (!f) return; st.err = ''; try { st.img = await shrink(f); } catch (e) { st.err = 'That file is not a picture this browser can open. Try a JPG or PNG photo or screenshot.'; } draw(); };
  MS.a._scanRead = async function () {
    if (!st.img || st.busy) return; st.busy = true; st.err = ''; draw();
    try {
      const r = await MS.api({ part: 'scan', image: st.img });
      if (!r.ok) st.err = r.reason || "I couldn't read that page. Try a clearer photo.";
      else { st.result = r; st.song = toSong(r); }
    } catch (e) { st.err = e.message || 'Scanning is not available right now.'; }
    st.busy = false; draw();
  };
  MS.a._scanHear = function () { if (st.song) A().play(MS.fixSong(JSON.parse(JSON.stringify(st.song)))); };
  MS.a._scanKeep = function (mode) {
    const s = st.song; if (!s) return; s.title = (document.getElementById('scanTitle').value || s.title).slice(0, 80);
    MS.closeModal(); A().stop();
    if (mode === 'add' && S.song) {
      MS.change(cur => {
        const mel = cur.parts.find(p => p.role === 'melody'); const nameBase = cur.sections.filter(x => /^Part /.test(x.name)).length;
        s.sections.forEach((x, i) => { const id = MS.id('s'); cur.sections.push({ id, name: 'Page ' + (cur.sections.length + 1), bars: x.bars }); mel.notes[id] = s.parts[0].notes[x.id]; cur.chords[id] = s.chords[x.id]; });
        cur.source = 'other'; if (s.chordPart.on) cur.chordPart.on = true;
      });
      MS.go('studio'); MS.toast('Added the new page to the end of your song.');
    } else { MS.openSong(s); MS.go('studio'); MS.toast('Scanned “' + s.title + '”. Now arrange it: harmony, bass, Restyle, the Control Room.'); }
  };
})();
