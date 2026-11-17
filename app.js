/* The Music Studio — app core: song data, screens, saving, downloads. */
(function () {
  const MS = window.MS = { screens: {}, a: {} };
  const COLORS = ['#f2b33d', '#4fc3b8', '#b39dfa', '#f08a6b', '#7fb2ff', '#d9d4c8'];
  // note colors on white paper: melody black like printed music, other parts dark colors (never gray: gray is the melody overlay)
  const INK = { '#f2b33d': '#141414', '#4fc3b8': '#1f4fa8', '#b39dfa': '#5b2fa0', '#f08a6b': '#a32020', '#7fb2ff': '#1d6b38', '#d9d4c8': '#8a4b0f' };
  const SEC_COLOR = n => /intro|outro/i.test(n) ? '#8a8f9c' : /chorus/i.test(n) ? '#f2b33d' : /bridge/i.test(n) ? '#b39dfa' : /solo|break/i.test(n) ? '#f08a6b' : '#4fc3b8';
  MS.SEC_COLOR = SEC_COLOR;
  MS.noteColor = p => MS.S.paper === 'dark' ? (p.color === '#f2b33d' ? '#f2ede0' : p.color) : (INK[p.color] || '#141414');
  let uid = Date.now() % 100000;
  MS.id = pfx => (pfx || 'x') + (++uid).toString(36);
  const esc = MS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- song ----------
  function part(name, role, inst, color, extra) {
    return Object.assign({ id: MS.id('p'), name, role, inst, ens: A().INST[inst] && A().INST[inst].ens ? 'section' : 'solo', size: 'Chamber (12)', artic: 'legato', clef: 'treble', color, vol: 0.8, rev: 0.25, echo: 0, pan: 0, mute: false, solo: false, notes: {}, dyn: {} }, extra || {});
  }
  const A = () => window.MSA;
  MS.newPart = part;
  MS.blankSong = function () {
    const s1 = MS.id('s'), s2 = MS.id('s');
    return {
      v: 1, title: 'My Song', composer: '', key: 'C major', ts: 4, tempo: 96, source: 'mine',
      sections: [{ id: s1, name: 'Verse 1', bars: 4 }, { id: s2, name: 'Chorus', bars: 4 }],
      parts: [part('Melody', 'melody', 'Grand piano', COLORS[0], { vol: 0.85 }), part('Harmony', 'harmony', 'Violins', COLORS[1], { vol: 0.6, pan: -0.25, rev: 0.35 }), part('Bass', 'bass', 'Bass guitar', COLORS[3], { clef: 'bass', vol: 0.75, rev: 0.1 })],
      chords: {}, chordPart: { on: false, inst: 'Grand piano', style: 'Block', ens: 'solo', vol: 0.5, rev: 0.3, echo: 0, pan: 0.2, bass: false },
      drums: { style: 'None', vol: 0.6, skip: {} }, perc: { on: {}, off: {}, vol: 0.55 },
      vocals: { brief: { about: '', mood: '', words: '' }, lyrics: {}, locked: {}, lead: {}, bgv: { on: false, count: 'A trio', type: 'Harmony', where: 'Chorus only', blend: 'Soft behind', picked: [] }, vol: 0.9, rev: 0.3, echo: 0.1, offset: 0 }
    };
  };

  // public-domain melodies to start from
  const q = (p, d) => ({ p, d: d || 1 });
  const n = { C3: 48, G3: 55, A3: 57, B3: 59, C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71, C5: 72, D5: 74 };
  MS.CLASSICS = {
    'Ode to Joy (Beethoven)': { tempo: 104, secs: [['Theme', 8, [q(n.E), q(n.E), q(n.F), q(n.G), q(n.G), q(n.F), q(n.E), q(n.D), q(n.C), q(n.C), q(n.D), q(n.E), q(n.E, 1.5), q(n.D, 0.5), q(n.D, 2), q(n.E), q(n.E), q(n.F), q(n.G), q(n.G), q(n.F), q(n.E), q(n.D), q(n.C), q(n.C), q(n.D), q(n.E), q(n.D, 1.5), q(n.C, 0.5), q(n.C, 2)], ['C', 'G', 'C', 'G', 'C', 'G', 'C', 'C']]] },
    'Twinkle, Twinkle, Little Star': { tempo: 96, secs: [['Verse', 4, [q(n.C), q(n.C), q(n.G), q(n.G), q(n.A), q(n.A), q(n.G, 2), q(n.F), q(n.F), q(n.E), q(n.E), q(n.D), q(n.D), q(n.C, 2)], ['C', 'F', 'C', 'G']], ['Middle', 4, [q(n.G), q(n.G), q(n.F), q(n.F), q(n.E), q(n.E), q(n.D, 2), q(n.G), q(n.G), q(n.F), q(n.F), q(n.E), q(n.E), q(n.D, 2)], ['C', 'G', 'C', 'G']], ['Verse', 4, 'copy0']] },
    'Frère Jacques': { tempo: 100, secs: [['Verse', 8, [q(n.C), q(n.D), q(n.E), q(n.C), q(n.C), q(n.D), q(n.E), q(n.C), q(n.E), q(n.F), q(n.G, 2), q(n.E), q(n.F), q(n.G, 2), q(n.G, .5), q(n.A, .5), q(n.G, .5), q(n.F, .5), q(n.E), q(n.C), q(n.G, .5), q(n.A, .5), q(n.G, .5), q(n.F, .5), q(n.E), q(n.C), q(n.C), q(n.G3), q(n.C, 2), q(n.C), q(n.G3), q(n.C, 2)], ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C']]] },
    'Jingle Bells (chorus)': { tempo: 120, secs: [['Chorus', 8, [q(n.E), q(n.E), q(n.E, 2), q(n.E), q(n.E), q(n.E, 2), q(n.E), q(n.G), q(n.C, 1.5), q(n.D, .5), q(n.E, 4), q(n.F), q(n.F), q(n.F, 1.5), q(n.F, .5), q(n.F), q(n.E), q(n.E), q(n.E, .5), q(n.E, .5), q(n.E), q(n.D), q(n.D), q(n.E), q(n.D, 2), q(n.G, 2)], ['C', 'C', 'C', 'C', 'F', 'C', 'D7', 'G']], ['Chorus 2', 8, [q(n.E), q(n.E), q(n.E, 2), q(n.E), q(n.E), q(n.E, 2), q(n.E), q(n.G), q(n.C, 1.5), q(n.D, .5), q(n.E, 4), q(n.F), q(n.F), q(n.F), q(n.F), q(n.F), q(n.E), q(n.E), q(n.E, .5), q(n.E, .5), q(n.G), q(n.G), q(n.F), q(n.D), q(n.C, 4)], ['C', 'C', 'C', 'C', 'F', 'C', 'G', 'C']]] }
  };
  MS.fromClassic = function (name) {
    const c = MS.CLASSICS[name], s = MS.blankSong();
    s.title = name.replace(/ \(.+\)$/, ''); s.composer = /Beethoven/.test(name) ? 'Ludwig van Beethoven (arr.)' : 'Traditional (arr.)';
    s.tempo = c.tempo; s.sections = []; const mel = s.parts[0];
    c.secs.forEach((x, i) => {
      const id = MS.id('s'); s.sections.push({ id, name: x[0], bars: x[1] });
      if (x[2] === 'copy0') { const f = s.sections[0].id; mel.notes[id] = JSON.parse(JSON.stringify(mel.notes[f])); s.chords[id] = s.chords[f].slice(); }
      else { mel.notes[id] = JSON.parse(JSON.stringify(x[2])); s.chords[id] = x[3].slice(); }
    });
    return s;
  };

  // ---------- state ----------
  const S = MS.S = { song: null, level: 'Moderate', paper: 'white', screen: 'home', arg: null, sec: null, part: null, sel: null, len: 1, hist: [], fut: [], agreed: false, view: {} };
  MS.vbuf = null; // recorded lead vocal (AudioBuffer)
  // My Songs: every song is kept on this device in a small library; the open song saves itself on every change
  const LS = 'musicstudio.v1', LIB = 'musicstudio.lib';
  MS.lib = { songs: {}, cur: null };
  function writeLib() { try { localStorage.setItem(LIB, JSON.stringify(MS.lib)); return true; } catch (e) { MS.toast('This device is out of room for songs. Download a song file and delete an old song.'); return false; } }
  function persist() {
    try { localStorage.setItem(LS, JSON.stringify({ level: S.level, paper: S.paper, agreed: S.agreed })); } catch (e) { }
    if (S.song) { if (!S.song.id) S.song.id = MS.id('song'); MS.lib.songs[S.song.id] = { song: S.song, updated: Date.now() }; MS.lib.cur = S.song.id; }
    if (writeLib()) { S.savedAt = Date.now(); const el = document.getElementById('savedNote'); if (el) el.textContent = 'Saved ✓'; }
  }
  let saveT = null;
  MS.save = () => { clearTimeout(saveT); const el = document.getElementById('savedNote'); if (el) el.textContent = 'Saving…'; saveT = setTimeout(persist, 300); };
  MS.load = function () {
    try {
      const d = JSON.parse(localStorage.getItem(LS) || 'null') || {};
      S.level = d.level || S.level; S.paper = d.paper || 'white'; S.agreed = !!d.agreed;
      const lib = JSON.parse(localStorage.getItem(LIB) || 'null'); if (lib && lib.songs) MS.lib = lib;
      if (d.song && d.song.parts) { const old = fixSong(d.song); old.id = old.id || MS.id('song'); MS.lib.songs[old.id] = { song: old, updated: Date.now() }; MS.lib.cur = old.id; delete d.song; localStorage.setItem(LS, JSON.stringify(d)); writeLib(); }
      const c = MS.lib.cur && MS.lib.songs[MS.lib.cur];
      if (c) { S.song = fixSong(c.song); return true; }
    } catch (e) { }
    return false;
  };
  MS.songList = () => Object.values(MS.lib.songs).sort((a, b) => b.updated - a.updated);
  // open a song from My Songs (or a new one); its own recorded vocal comes with it
  MS.openSong = function (s, opts) {
    A().stop(); persist();
    s = fixSong(JSON.parse(JSON.stringify(s))); if (!s.id || (opts && opts.copy)) s.id = MS.id('song');
    S.song = s; S.sec = s.sections[0] && s.sections[0].id; S.part = s.parts[0] && s.parts[0].id; S.sel = null; S.hist = []; S.fut = [];
    MS.vbuf = null; persist(); if (MS.loadVocal) MS.loadVocal();
  };
  function fixSong(s) {
    const b = MS.blankSong();
    for (const k in b) if (s[k] == null) s[k] = b[k];
    s.vocals = Object.assign(b.vocals, s.vocals || {}); s.vocals.bgv = Object.assign(b.vocals.bgv, s.vocals.bgv || {});
    s.chordPart = Object.assign(b.chordPart, s.chordPart || {}); s.drums = Object.assign(b.drums, s.drums || {});
    s.parts.forEach(p => { p.notes = p.notes || {}; p.dyn = p.dyn || {}; });
    s.layers = s.layers || []; s.master = Object.assign({ vol: 0.9, punch: 0, room: 'Studio', fadeIn: 0, fadeOut: 0, bypass: false }, s.master || {});
    s.vocals.bgvMix = s.vocals.bgvMix || { vol: 0.8, rev: 0.5, echo: 0.1, pan: 0 };
    s.perc = Object.assign({ on: {}, off: {}, vol: 0.55 }, s.perc || {});
    return s;
  }
  MS.fixSong = fixSong;
  MS.setSong = function (s) { MS.openSong(s); };
  MS.sec = () => S.song.sections.find(x => x.id === S.sec) || S.song.sections[0];
  MS.part = () => S.song.parts.find(x => x.id === S.part) || S.song.parts[0];
  MS.notesOf = (p, secId) => (p.notes[secId || MS.sec().id] = p.notes[secId || MS.sec().id] || []);
  MS.used = arr => arr.reduce((a, x) => a + x.d, 0);

  // every edit goes through change() so Undo works
  MS.change = function (fn, opts) {
    S.hist.push(JSON.stringify(S.song)); if (S.hist.length > 80) S.hist.shift(); S.fut = [];
    fn(S.song); MS.save();
    if (!(opts && opts.quiet)) MS.render();
  };
  MS.undo = function () {
    if (!S.hist.length) return MS.toast('Nothing to undo');
    S.fut.push(JSON.stringify(S.song)); S.song = fixSong(JSON.parse(S.hist.pop())); MS.save(); MS.render(); MS.toast('Undone');
  };
  MS.redo = function () {
    if (!S.fut.length) return;
    S.hist.push(JSON.stringify(S.song)); S.song = fixSong(JSON.parse(S.fut.pop())); MS.save(); MS.render();
  };
  MS.playable = function (song) {
    song = song || S.song;
    return Object.assign({}, song, { vocals: Object.assign({}, song.vocals, { leadBuffer: MS.vbuf }) });
  };

  // ---------- ui helpers ----------
  MS.toast = function (msg, ms) {
    let t = document.querySelector('.toast'); if (t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2400);
  };
  MS.modal = function (html) {
    MS.closeModal(); const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`;
    m.addEventListener('click', e => { if (e.target === m) MS.closeModal(); }); document.body.appendChild(m); return m;
  };
  MS.closeModal = () => { const m = document.querySelector('.modal'); if (m) m.remove(); if (MS._askDone) { const f = MS._askDone; MS._askDone = null; f(null); } };
  // in-app question box (replaces the browser's pop-up, which shows the web address).
  // buttons: [[label, value, 'primary'|'danger'|''], ...]; resolves to the value, or null if closed
  MS.ask = function (title, text, buttons) {
    buttons = buttons || [['Yes', true, 'primary'], ['Cancel', null, '']];
    return new Promise(res => {
      MS.modal(`<div style="max-width:460px;margin:0 auto"><h2>${esc(title)}</h2>${text ? `<div class="small" style="color:#ddd8cc;margin-top:8px;line-height:1.5">${esc(text)}</div>` : ''}
        <div class="row" style="margin-top:16px;flex-wrap:wrap">${buttons.map((b, i) => `<button class="btn ${b[2] === 'primary' ? 'primary' : ''}" style="${b[2] === 'danger' ? 'background:#7a2a1c;border-color:#a8412c;color:#fff' : ''}" data-ask="${i}">${esc(b[0])}</button>`).join('')}</div></div>`);
      MS._askDone = res;
      document.querySelectorAll('[data-ask]').forEach(el => el.onclick = () => { const v = buttons[+el.dataset.ask][1]; MS._askDone = null; MS.closeModal(); res(v); });
      const first = document.querySelector('[data-ask]'); if (first) first.focus();
    });
  };
  // choices → pill buttons; call is JS source that takes the choice as its last argument, e.g. "MS.a.bgv('count',"
  MS.seg = function (choices, active, call, cls) {
    return `<div class="seg" role="group">${choices.map(c => `<button type="button" class="pill ${cls || ''} ${c === active ? 'on' : ''}" aria-pressed="${c === active}" onclick='${call}${JSON.stringify(c).replace(/'/g, "&#39;")})'>${esc(c)}</button>`).join('')}</div>`;
  };
  MS.go = function (screen, arg) { A().stop(); S.screen = screen; S.arg = arg == null ? null : arg; MS.render(); window.scrollTo(0, 0); };

  MS.header = function () {
    const lv = ['Basic', 'Moderate', 'Advanced'].map(l => `<button type="button" class="pill amber ${l === S.level ? 'on' : ''}" aria-pressed="${l === S.level}" onclick="MS.a.level('${l}')">${l}</button>`).join('');
    const pp = ['White', 'Dark'].map(p => `<button type="button" class="pill ${p.toLowerCase() === S.paper ? 'on' : ''}" style="${p === 'White' && S.paper === 'white' ? 'background:#fbfaf6;color:#111;border-color:#fbfaf6' : ''}" aria-pressed="${p.toLowerCase() === S.paper}" onclick="MS.a.paper('${p.toLowerCase()}')">${p}</button>`).join('');
    return `<div class="header"><div class="row" style="gap:10px"><button type="button" class="brand" onclick="MS.go('home')"><b>The Music Studio</b><span>Sing it. See it. Hear it.</span></button>${S.song && S.screen !== 'home' ? `<button class="btn sm ghost" onclick="MS.go('home')" title="Your songs are saved on this device. Tap for My Songs."><span id="savedNote" style="color:var(--teal)">Saved ✓</span>&nbsp;· My Songs</button>` : ''}</div>
    <div class="row"><span class="level">Paper</span>${pp}${MS.helpBtn('paper', '?')}</div>
    <div class="row" role="group" aria-label="Music knowledge level"><span class="level">Level</span>${lv}${MS.helpBtn('level', '?')}</div>
    <div class="row" style="gap:6px"><button class="btn sm" onclick="MS.go('words')">📖 Studio Talk</button>${MS.helpBtn('rooms', '? Help')}</div></div>`;
  };
  MS.a.level = l => { S.level = l; MS.save(); MS.render(); };
  MS.a.paper = p => { S.paper = p; MS.save(); MS.render(); };
  MS.footer = function (extra) {
    return `<div class="foot">${extra ? extra + '<br>' : ''}Small print: Singing to notes works best with one voice, sung slowly, in a quiet room. Instrument and background-singer sounds are built in and sound good, not studio-grade. AI suggestions and lyric ideas can be wrong; you have the final say. Music you didn't write is for personal use only. Music symbols: Bravura font (SIL Open Font License). MP3 encoding: LAME (LGPL).</div>`;
  };
  MS.banner = function () {
    // generic instruments: piano keys, guitar, violin, drum, microphone, notes
    const keys = Array.from({ length: 22 }, (_, i) => `<rect x="${40 + i * 26}" y="210" width="25" height="90" rx="3" fill="#f5f2ea"/>`).join('') + [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17, 18, 19].map(i => `<rect x="${57 + i * 26}" y="210" width="16" height="56" rx="2" fill="#16171b"/>`).join('');
    return `<div class="hero" aria-hidden="true"><svg viewBox="0 0 1280 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="#1b1d24"/><stop offset=".5" stop-color="#2a2433"/><stop offset="1" stop-color="#1b1d24"/></linearGradient><radialGradient id="sp" cx=".5" cy=".3" r=".6"><stop offset="0" stop-color="#f2b33d" stop-opacity=".35"/><stop offset="1" stop-color="#f2b33d" stop-opacity="0"/></radialGradient></defs>
    <rect width="1280" height="300" fill="url(#bg)"/><rect width="1280" height="300" fill="url(#sp)"/>
    ${Array.from({ length: 5 }, (_, i) => `<path d="M0 ${70 + i * 12} C 320 ${40 + i * 12}, 640 ${110 + i * 12}, 1280 ${60 + i * 12}" stroke="#f3efe6" stroke-opacity=".18" fill="none"/>`).join('')}
    ${[[150, 92, '#f2b33d'], [260, 72, '#4fc3b8'], [420, 104, '#b39dfa'], [880, 70, '#f08a6b'], [1010, 96, '#f2b33d'], [1130, 66, '#4fc3b8']].map(([x, y, c]) => `<g fill="${c}"><ellipse cx="${x}" cy="${y}" rx="11" ry="8" transform="rotate(-20 ${x} ${y})"/><rect x="${x + 9}" y="${y - 44}" width="3" height="44"/></g>`).join('')}
    ${keys}
    <g transform="translate(720 120) rotate(-28)"><rect x="-10" y="-120" width="20" height="150" rx="4" fill="#6b4a2b"/><ellipse cx="0" cy="70" rx="58" ry="62" fill="#c98a3c"/><ellipse cx="0" cy="20" rx="44" ry="42" fill="#c98a3c"/><circle cx="0" cy="40" r="16" fill="#3a2614"/><rect x="-14" y="-140" width="28" height="26" rx="4" fill="#4a3220"/></g>
    <g transform="translate(860 150)"><ellipse cx="0" cy="40" rx="78" ry="22" fill="#b2401f"/><rect x="-78" y="-10" width="156" height="50" fill="#d9583a"/><ellipse cx="0" cy="-10" rx="78" ry="22" fill="#e9e4d8"/><path d="M-60 -50 L-10 -14 M60 -54 L12 -16" stroke="#d9d4c8" stroke-width="6" stroke-linecap="round"/></g>
    <g transform="translate(1060 60)"><rect x="-26" y="0" width="52" height="86" rx="26" fill="#4a4f5c"/><rect x="-22" y="6" width="44" height="70" rx="22" fill="#7d8494"/><path d="M-44 60 a44 44 0 0 0 88 0" stroke="#d9d4c8" stroke-width="7" fill="none"/><rect x="-4" y="104" width="8" height="70" fill="#d9d4c8"/><rect x="-36" y="172" width="72" height="10" rx="5" fill="#d9d4c8"/></g>
    <g transform="translate(1185 140) rotate(18)"><path d="M0 -60 C 34 -60 34 -20 18 -10 C 40 0 40 60 0 64 C -40 60 -40 0 -18 -10 C -34 -20 -34 -60 0 -60Z" fill="#7a3e1d"/><rect x="-5" y="-150" width="10" height="100" fill="#2a1a10"/></g>
    </svg></div>`;
  };

  // ---------- render ----------
  MS.render = function () {
    const app = document.getElementById('app');
    document.body.className = S.level.toLowerCase();
    const scr = MS.screens[S.screen] || MS.screens.home;
    app.innerHTML = MS.header() + scr.html();
    if (scr.after) scr.after();
    if (MS.coach) MS.coach.render();
  };

  // ---------- home ----------
  MS.screens.home = {
    html() {
      const has = !!S.song;
      return MS.banner() + `<div class="split"><div class="main">
      <div class="card col"><h1 style="font-size:32px">Make your own music</h1>
      <p style="margin:0;font-size:16px;color:#ddd8cc;max-width:720px">Write notes on a staff, or sing a few notes and watch them appear. Add harmony, chords, drums and instruments from a solo violin to a full orchestra. Write lyrics with an AI helper, record your voice, add background singers, then download your sheet music and an MP3.</p>
      <div class="row" style="margin-top:4px">${has ? `<button class="btn primary" onclick="MS.go('studio')">Continue “${esc(S.song.title)}”</button>` : ''}<button class="btn ${has ? '' : 'primary'}" onclick="MS.a.newSong()">Start a new song</button><button class="btn" onclick="MS.a.scan()">📷 Scan sheet music</button><button class="btn" onclick="MS.a.openFile()">Open a song file</button></div>
      <div class="tiny muted">Just want to arrange? Scan a page from a fakebook and the melody and chords come in ready to work with.</div></div>
      ${MS.myShelf()}
      ${MS.roomsHtml()}
      <div class="card col"><div class="label">Pick your level</div><div class="small muted">You can change it anytime at the top.</div>
      <div class="grid">${[['Basic', 'New to music. Note names shown, big Sing button, simple choices.'], ['Moderate', 'Know a little. Chords, harmony, effects and the song map.'], ['Advanced', 'Read music. Full mixer, dynamics, sharps and flats, dotted notes.']].map(([l, d]) => `<button class="opt lesson-card ${S.level === l ? 'on' : ''}" onclick="MS.a.level('${l}')"><b style="font-size:17px">${l}</b><span class="small" style="color:#ddd8cc">${d}</span></button>`).join('')}</div></div>
      <div class="card col"><div class="label">Start from a classic</div><div class="small muted">Old songs anyone can use. Change them, restyle them, make them yours.</div>
      <div class="row">${Object.keys(MS.CLASSICS).map(k => `<button class="btn" onclick="MS.a.classic(${esc(JSON.stringify(k))})">${esc(k)}</button>`).join('')}</div></div>
      </div><div class="side">
      <div class="card col" style="border-color:var(--teal)"><div class="label" style="color:var(--teal)">New to music?</div><div style="font-size:15px">Start in <b>The Music Room</b>: short lessons on notes, rhythm, melody, harmony and song parts. Anything you make there goes straight to the studio.</div><button class="btn" onclick="MS.go('room')">Open The Music Room</button></div>
      <div class="card col"><div class="label">Personal use</div><label class="row" style="align-items:flex-start;gap:10px;font-size:14px;cursor:pointer"><input type="checkbox" ${S.agreed ? 'checked' : ''} onchange="MS.a.agree(this.checked)"><span>If I sing or write out music I didn't write (from a fakebook, from memory or from any other source), it's for my own enjoyment. I won't post it on public networks or sell it.</span></label><div class="tiny muted">Needed before you restyle or enter someone else's song.</div></div>
      </div></div>` + MS.footer();
    }
  };
  MS.a.agree = v => { S.agreed = v; MS.save(); };
  MS.a.newSong = function () {
    const s = MS.blankSong(); s.title = 'Song ' + (MS.songList().length + 1);
    MS.openSong(s); MS.go('studio'); MS.toast('New song started. Your other songs are safe in My Songs.');
  };
  MS.a.classic = function (k) { MS.openSong(MS.fromClassic(k)); MS.go('studio'); };
  MS.a.openLib = id => { const e = MS.lib.songs[id]; if (e) { MS.openSong(e.song); MS.go('studio'); MS.toast('Opened “' + e.song.title + '”'); } };
  MS.a.copyLib = id => { const e = MS.lib.songs[id]; if (!e) return; const c = JSON.parse(JSON.stringify(e.song)); c.title = e.song.title + ' (copy)'; delete c.parentId; MS.openSong(c, { copy: true }); MS.render(); MS.toast('Copy made and opened.'); };
  MS.a.delLib = async function (id) {
    const e = MS.lib.songs[id]; if (!e) return;
    if (!(await MS.ask('Delete “' + e.song.title + '”?', 'This removes it from this device. Download its song file first if you want a backup.', [['Delete it', true, 'danger'], ['Keep it', null, '']]))) return;
    delete MS.lib.songs[id]; if (MS.delVocal) MS.delVocal(id);
    if (S.song && S.song.id === id) { const next = MS.songList()[0]; if (next) MS.openSong(next.song); else { S.song = null; MS.lib.cur = null; } }
    writeLib(); MS.render();
  };
  MS.a.dlLib = id => { const e = MS.lib.songs[id]; if (e) download(new Blob([JSON.stringify(e.song, null, 1)], { type: 'application/json' }), (e.song.title || 'song').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.json'); };
  MS.myShelf = function () {
    const list = MS.songList(); if (!list.length) return '';
    const when = t => { const d = (Date.now() - t) / 60000; return d < 1 ? 'just now' : d < 60 ? Math.round(d) + ' min ago' : d < 1440 ? Math.round(d / 60) + ' hr ago' : new Date(t).toLocaleDateString(); };
    return `<div class="card col"><div class="row" style="justify-content:space-between"><div class="label">My Songs <span class="muted" style="text-transform:none;letter-spacing:0">(${list.length} on this device)</span></div><div class="row" style="gap:6px"><button class="btn sm" onclick="MS.a.openFile()">Open a song file</button>${MS.helpBtn('mysongs')}</div></div>
      <div class="col" style="gap:8px">${list.map(e => { const x = e.song, cur = S.song && S.song.id === x.id; return `<div class="row" style="justify-content:space-between;gap:8px;padding:10px;border:1px solid ${cur ? 'var(--amber)' : 'var(--line)'};border-radius:10px;background:var(--panel2)"><div style="min-width:0"><b>${esc(x.title)}</b>${cur ? ' <span class="tiny" style="color:var(--amber)">open now</span>' : ''}<div class="tiny muted">${x.style ? esc(x.style) + ' · ' : ''}${x.sections.length} section${x.sections.length === 1 ? "" : "s"} · ${x.tempo} BPM · saved ${when(e.updated)}${x.parentId ? ' · a restyled version' : ''}</div></div>
        <div class="row" style="gap:6px">${cur ? `<button class="btn sm primary" onclick="MS.go('studio')">Continue</button>` : `<button class="btn sm primary" onclick="MS.a.openLib('${x.id}')">Open</button>`}<button class="btn sm" onclick="MS.a.copyLib('${x.id}')">Copy</button><button class="btn sm" onclick="MS.a.dlLib('${x.id}')" aria-label="Download song file">Download</button><button class="btn sm ghost" onclick="MS.a.delLib('${x.id}')" aria-label="Delete">✕</button></div></div>`; }).join('')}</div>
      <div class="tiny muted">Songs save on this device as you work. To move a song to another device, Download it and use “Open a song file” there.</div></div>`;
  };
  MS.a.openFile = function () {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,.musicstudio,application/json';
    i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { try { const d = JSON.parse(t); if (!d.parts || !d.sections) throw 0; const exists = d.id && MS.lib.songs[d.id]; MS.openSong(d, { copy: !!exists }); MS.go('studio'); MS.toast('Opened “' + d.title + '” and added it to My Songs'); } catch (e) { MS.toast('That file is not a Music Studio song.'); } }); };
    i.click();
  };

  // ---------- music helpers used by several screens ----------
  MS.suggestChords = function (song, secId) {
    const mel = song.parts.find(p => p.role === 'melody'); const sec = song.sections.find(s => s.id === secId);
    const opts = A().diatonicChords(song.key).slice(0, 6);
    const notes = (mel && mel.notes[secId]) || []; const out = [];
    for (let bar = 0; bar < sec.bars; bar++) {
      const w = {}; let b = 0;
      notes.forEach(x => { const s0 = Math.max(b, bar * song.ts), e0 = Math.min(b + x.d, (bar + 1) * song.ts); if (x.p != null && e0 > s0) w[x.p % 12] = (w[x.p % 12] || 0) + (e0 - s0) * (Math.abs(s0 - bar * song.ts) < 1e-6 ? 1.5 : 1); b += x.d; });
      let best = opts[0], score = -1;
      opts.forEach((c, i) => {
        const t = A().chordTones(c).tones; let s = 0; for (const k in w) s += t.includes(+k) ? w[k] : -w[k] * 0.4;
        s += [0.35, 0, 0, 0.25, 0.3, 0.1][i];
        if (bar === 0 && i === 0) s += 0.4; if (bar === sec.bars - 1 && i === 0) s += 0.5; if (bar === sec.bars - 2 && i === 4) s += 0.3;
        if (s > score) { score = s; best = c; }
      });
      out.push(Object.keys(w).length ? best : (out[out.length - 1] || opts[0]));
    }
    return out;
  };
  MS.makeHarmony = function (song, kind, secIds) {
    const mel = song.parts.find(p => p.role === 'melody'); if (!mel) return;
    let h = song.parts.find(p => p.role === 'harmony'); if (!h) { h = part('Harmony', 'harmony', 'Violins', COLORS[1], { vol: 0.6, pan: -0.25 }); song.parts.push(h); }
    const step = kind === 'third_above' ? 2 : kind === 'sixth_below' ? -5 : -2;
    (secIds || song.sections.map(s => s.id)).forEach(id => { h.notes[id] = (mel.notes[id] || []).map(x => ({ p: x.p == null ? null : A().scaleStep(x.p, step, song.key), d: x.d })); });
    return h;
  };
  MS.makeBass = function (song, secIds, style) {
    let b = song.parts.find(p => p.role === 'bass'); if (!b) { b = part('Bass', 'bass', 'Bass guitar', COLORS[3], { clef: 'bass' }); song.parts.push(b); }
    (secIds || song.sections.map(s => s.id)).forEach(id => {
      const sec = song.sections.find(s => s.id === id); let ch = song.chords[id];
      if (!ch || !ch.some(Boolean)) ch = song.chords[id] = MS.suggestChords(song, id);
      const out = [];
      for (let bar = 0; bar < sec.bars; bar++) {
        const c = A().chordTones(ch[bar] || ch[0]) || { root: 0, tones: [0, 4, 7] };
        let r = 36 + c.root; if (r < 40) r += 12;
        const fifth = r + 7 > 57 ? r - 5 : r + 7;
        if (style === 'walk' && song.ts === 4) { const nx = A().chordTones(ch[bar + 1] || ch[0]) || c; let nr = 36 + nx.root; if (nr < 40) nr += 12; out.push({ p: r, d: 1 }, { p: r + (c.tones.includes((c.root + 3) % 12) ? 3 : 4), d: 1 }, { p: fifth, d: 1 }, { p: nr > r ? nr - 1 : nr + 1, d: 1 }); }
        else if (style === 'whole') out.push({ p: r, d: song.ts });
        else if (song.ts === 3) out.push({ p: r, d: 2 }, { p: fifth, d: 1 });
        else out.push({ p: r, d: 2 }, { p: fifth, d: 2 });
      }
      b.notes[id] = out;
    });
    return b;
  };

  // ---------- restyle ----------
  MS.STYLES = {
    'Pop': { tempo: 108, mel: ['Grand piano', 'solo'], har: ['Synth', 'solo'], bass: 'Bass guitar', drums: 'Pop', chords: ['Grand piano', 'Block'], bassStyle: 'pop', echo: 0.15, rev: 0.25, d: 'Bright and catchy, steady beat.' },
    'R&B': { tempo: 76, mel: ['Electric piano', 'solo'], har: ['Choir', 'section'], bass: 'Bass guitar', drums: 'R&B', chords: ['Electric piano', 'Sustained'], bassStyle: 'pop', echo: 0.2, rev: 0.4, d: 'Smooth, slow groove with a soft swing.' },
    'Rock': { tempo: 128, mel: ['Electric guitar', 'solo'], har: ['Electric guitar', 'solo'], bass: 'Bass guitar', drums: 'Rock', chords: ['Electric guitar', 'Strum'], bassStyle: 'pop', echo: 0.1, rev: 0.2, d: 'Guitars up front, driving drums.' },
    'Jazz swing': { tempo: 132, mel: ['Trumpet', 'solo'], har: ['Clarinet', 'solo'], bass: 'Double bass', bassArtic: 'pizzicato', drums: 'Jazz swing', chords: ['Grand piano', 'Block'], bassStyle: 'walk', echo: 0.05, rev: 0.3, d: 'Swinging horns and a walking bass.' },
    'Classical': { tempo: 88, mel: ['Violins', 'solo'], har: ['Violins', 'section'], bass: 'Cellos', drums: 'None', chords: ['Harp', 'Arpeggio'], bassStyle: 'whole', echo: 0, rev: 0.55, d: 'Solo violin, string section, harp. No drums.' },
    'Full orchestra': { tempo: 96, mel: ['French horn', 'section'], har: ['Violins', 'section', 'Full orchestra (30)'], bass: 'Cellos', drums: 'None', chords: ['Violas', 'Sustained'], bassStyle: 'whole', echo: 0, rev: 0.6, d: 'Big and cinematic: horns, strings, everything.' },
    'Country': { tempo: 112, mel: ['Acoustic guitar', 'solo'], har: ['Violins', 'solo'], bass: 'Bass guitar', drums: 'Country', chords: ['Acoustic guitar', 'Strum'], bassStyle: 'pop', echo: 0.05, rev: 0.2, d: 'Acoustic guitar, fiddle and a two-step beat.' },
    'Hip-hop': { tempo: 88, mel: ['Synth', 'solo'], har: ['Electric piano', 'solo'], bass: 'Bass guitar', drums: 'Hip-hop', chords: ['Synth', 'Sustained'], bassStyle: 'pop', echo: 0.2, rev: 0.2, d: 'Laid-back beat, synths and keys.' },
    'Soft ballad': { tempo: 70, mel: ['Grand piano', 'solo'], har: ['Violins', 'section'], bass: 'Bass guitar', drums: 'Soft ballad', chords: ['Grand piano', 'Arpeggio'], bassStyle: 'whole', echo: 0.1, rev: 0.45, d: 'Gentle piano and strings.' },
    'March': { tempo: 116, mel: ['Trumpet', 'section'], har: ['French horn', 'section'], bass: 'Tuba', drums: 'March', chords: ['Trombone', 'Block'], bassStyle: 'pop', echo: 0, rev: 0.3, d: 'Brass band with snare drums.' },
    'World': { tempo: 100, mel: ['Spanish guitar', 'solo'], har: ['Marimba', 'solo'], bass: 'Bass guitar', drums: 'Latin', chords: ['Spanish guitar', 'Strum'], bassStyle: 'pop', echo: 0.05, rev: 0.3, d: 'Sounds from around the world: Latin, Indian, Caribbean.' }
  };
  // three sub-styles under each style: each changes the background layers and a few sounds
  const L = (preset, vol, extra) => Object.assign({ preset, vol: vol || 0.55 }, extra || {});
  MS.SUBSTYLES = {
    'Pop': { 'Bright piano pop': { layers: [L('Piano arpeggio', 0.45)] }, 'Synth pop': { layers: [L('Synth pulse', 0.5)], mel: ['Electric piano', 'solo'], har: ['Synth', 'solo'] }, 'Acoustic pop': { layers: [L('Guitar strum', 0.6)], mel: ['Acoustic guitar', 'solo'], chordsOff: true } },
    'R&B': { 'Smooth keys': { layers: [L('Electric piano', 0.5)] }, 'Organ soul': { layers: [L('Organ pad', 0.75)], chordsOff: true }, 'Silky strings': { layers: [L('String pad', 0.6)] } },
    'Rock': { 'Organ-heavy rock': { layers: [L('Organ pad', 0.85), L('Guitar strum', 0.4)] }, 'Guitar wall': { layers: [L('Guitar strum', 0.7)], chords: ['Electric guitar', 'Strum'] }, 'Piano rock': { layers: [L('Piano arpeggio', 0.55)], mel: ['Grand piano', 'solo'] } },
    'Jazz swing': { 'Big band brass': { layers: [L('Brass swells', 0.6)] }, 'Piano trio': { layers: [], chords: ['Grand piano', 'Block'] }, 'Organ jazz': { layers: [L('Organ pad', 0.65)], chordsOff: true } },
    'Classical': { 'String quartet': { layers: [L('String pad', 0.5, { size: 'Small (4)' })], chordsOff: true }, 'Harp and flute': { layers: [L('Harp arpeggio', 0.55)], mel: ['Flute', 'solo'], chordsOff: true }, 'Choir and organ': { layers: [L('Choir ooh', 0.55), L('Organ pad', 0.5)], chordsOff: true } },
    'Full orchestra': { 'Epic brass': { layers: [L('Brass swells', 0.75), L('Low drone', 0.6)] }, 'Lush strings': { layers: [L('String pad', 0.7, { size: 'Full orchestra (30)' })] }, 'Movie magic': { layers: [L('Harp arpeggio', 0.5), L('Choir ooh', 0.5), L('String pad', 0.55)] } },
    'Country': { 'Fiddle and strum': { layers: [L('Guitar strum', 0.6)], chordsOff: true }, 'Honky-tonk piano': { layers: [L('Piano arpeggio', 0.55)], chords: ['Grand piano', 'Block'] }, 'Country organ': { layers: [L('Organ pad', 0.6), L('Guitar strum', 0.45)], chordsOff: true } },
    'Hip-hop': { 'Lo-fi keys': { layers: [L('Electric piano', 0.55)], tempo: -8 }, 'Synth bounce': { layers: [L('Synth pulse', 0.5)] }, 'Soul sample': { layers: [L('Organ pad', 0.55), L('String pad', 0.45)] } },
    'Soft ballad': { 'Piano and strings': { layers: [L('String pad', 0.55)] }, 'Acoustic': { layers: [L('Guitar strum', 0.55)], mel: ['Acoustic guitar', 'solo'], chordsOff: true }, 'Choir glow': { layers: [L('Choir ooh', 0.55)] } },
    'March': { 'Brass band': { layers: [L('Brass swells', 0.6)] }, 'Fife and drum': { layers: [], mel: ['Flute', 'section'], chordsOff: true }, 'Grand parade': { layers: [L('Brass swells', 0.7), L('Low drone', 0.55)] } },
    'World': { 'Latin': { layers: [L('Spanish strum', 0.5)], perc: { congas: 1, shaker: 1 }, chordsOff: true }, 'Indian': { layers: [L('Tanpura drone', 0.6)], mel: ['Sitar', 'solo'], har: ['Bansuri', 'solo'], drums: 'None', perc: { tabla: 1 }, chordsOff: true, tempo: -12 }, 'Caribbean': { layers: [L('Steel pan pulse', 0.4)], mel: ['Steel drums', 'solo'], har: ['Marimba', 'solo'], drums: 'Reggae', perc: { bongos: 1, shaker: 1 }, chords: ['Acoustic guitar', 'Strum'] } }
  };
  MS.applyStyle = function (song, name, subName) {
    const st = MS.STYLES[name]; if (!st) return;
    const sub = subName && MS.SUBSTYLES[name] && MS.SUBSTYLES[name][subName];
    song.tempo = Math.max(40, st.tempo + ((sub && sub.tempo) || 0));
    const mel = song.parts.find(p => p.role === 'melody'), m = (sub && sub.mel) || st.mel;
    if (mel) Object.assign(mel, { inst: m[0], ens: m[1], echo: st.echo, rev: st.rev });
    let har = song.parts.find(p => p.role === 'harmony'), h = (sub && sub.har) || st.har;
    if (har) Object.assign(har, { inst: h[0], ens: h[1], size: h[2] || 'Chamber (12)', rev: st.rev + 0.05 });
    song.sections.forEach(s => { if (!song.chords[s.id] || !song.chords[s.id].some(Boolean)) song.chords[s.id] = MS.suggestChords(song, s.id); });
    const b = MS.makeBass(song, null, st.bassStyle); Object.assign(b, { inst: st.bass, ens: A().INST[st.bass].ens ? 'section' : 'solo', artic: st.bassArtic || 'legato' });
    const dst = (sub && sub.drums) || st.drums;
    if (song.ts === 3 && /Pop|Rock|Country|Hip|R&B|Latin|Reggae/.test(dst)) song.drums.style = 'Waltz'; else song.drums.style = dst;
    song.perc = { on: Object.assign({}, (sub && sub.perc) || st.perc || {}), off: {}, vol: (song.perc && song.perc.vol) || 0.55 };
    const c = (sub && sub.chords) || st.chords;
    Object.assign(song.chordPart, { on: !(sub && sub.chordsOff), inst: c[0], style: c[1], ens: A().INST[c[0]].ens ? 'section' : 'solo', rev: st.rev });
    song.layers = [];
    if (sub && MS.addLayer) sub.layers.forEach(x => { const ly = MS.addLayer(song, x.preset); if (ly) { ly.vol = x.vol; if (x.size) ly.size = x.size; ly.rev = st.rev; } });
    song.style = name + (subName ? ' · ' + subName : '');
  };
  // Restyle works on a preview copy: the original stays untouched until you save a version
  let pv = null; // { song, style, sub }
  const rootOf = s => s.parentId || s.id;
  MS.screens.restyle = {
    html() {
      const s = S.song; if (!s) return MS.screens.home.html();
      const root = rootOf(s), fam = MS.songList().filter(e => e.song.id === root || e.song.parentId === root);
      const isP = (k, sb) => pv && pv.style === k && pv.sub === sb;
      return `<div class="row small muted" style="margin-bottom:10px"><a href="#" onclick="MS.go('studio');return false">Studio</a><span>›</span><span style="color:var(--ink)">Restyle</span></div>
      <div class="split"><div class="main"><div class="card col"><div class="row" style="justify-content:space-between"><h2>Restyle “${esc(s.title)}”</h2>${MS.helpBtn('restyle')}</div>
      <div class="small" style="color:#ddd8cc">Pick a style, then one of its three flavors. Each flavor changes the background music too: rock heavy on the organ, classical with harp and flute. Listen to as many as you like. Your original never changes unless you save a version.</div>
      <div class="grid">${Object.entries(MS.STYLES).map(([k, v]) => `<div class="opt ${pv && pv.style === k ? 'on' : ''}"><b style="font-size:16px">${k}</b><span class="small" style="color:#ddd8cc">${v.d}</span><span class="tiny muted">${v.tempo} BPM · ${v.mel[0]}${v.mel[1] === 'section' ? ' section' : ''}</span>
        <div class="col" style="gap:6px">${Object.keys(MS.SUBSTYLES[k]).map(sb => `<button class="btn sm ${isP(k, sb) ? 'primary' : ''}" style="flex-direction:column;align-items:flex-start;gap:2px;white-space:normal;text-align:left;padding:8px 12px" onclick="MS.a.preview(${esc(JSON.stringify(k))},${esc(JSON.stringify(sb))})"><span>${isP(k, sb) ? '▶ ' : ''}${esc(sb)}</span><span class="tiny" style="opacity:.75;font-weight:500">${esc(MS.SUBSTYLES[k][sb].layers.map(x => x.preset).join(' + ') || 'no extra layers')}</span></button>`).join('')}</div></div>`).join('')}</div></div></div>
      <div class="side">
      <div class="card col" style="${pv ? 'border-color:var(--amber)' : ''}"><div class="label">${pv ? 'Now hearing' : 'Listen'}</div>
        ${pv ? `<div><b style="font-size:17px">${esc(pv.style)} · ${esc(pv.sub)}</b><div class="tiny muted">${pv.song.tempo} BPM · ${esc(pv.song.parts[0].inst)} melody${pv.song.layers.length ? ' · ' + esc(pv.song.layers.map(x => x.name).join(', ')) : ''}</div></div>
        <div class="row"><button class="btn" onclick="MS.a.playPv()">▶ Play again</button><button class="btn" onclick="MSA.stop()">■ Stop</button></div>
        <button class="btn primary" onclick="MS.a.saveVersion(false)">Save this version</button><button class="btn" onclick="MS.a.saveVersion(true)">Save it and open it in the studio</button><button class="btn ghost" onclick="MS.a.keepOrig()">Keep my original</button>
        <div class="tiny muted">A saved version goes into My Songs next to your original, so you can move either one to any room.</div>`
        : `<div class="row"><button class="btn primary" onclick="MS.a.playSong()">▶ Play the original</button><button class="btn" onclick="MSA.stop()">■</button></div><div class="tiny muted">Tap any flavor to hear it.</div>`}</div>
      ${fam.length > 1 ? `<div class="card col"><div class="label">Versions of this song</div>${fam.map(e => `<div class="row" style="justify-content:space-between;gap:6px"><div style="min-width:0"><b class="small">${esc(e.song.id === root ? 'Original' : (e.song.style || e.song.title))}</b>${e.song.id === s.id ? ' <span class="tiny" style="color:var(--amber)">open now</span>' : ''}</div>${e.song.id === s.id ? '' : `<button class="btn sm" onclick="MS.a.openVersion('${e.song.id}')">Open</button>`}</div>`).join('')}<div class="tiny muted">Open any version to keep working on it in the studio, Vocal Room or Control Room.</div></div>` : ''}
      <div class="card col"><div class="label">Someone else's song?</div><div class="row"><button class="btn sm" onclick="MS.a.scan()">📷 Scan sheet music</button></div><div class="small" style="color:#ddd8cc">Scan a page, or type or sing the melody into the studio, then restyle it here. A modern 1812 Overture or an R&amp;B version of a favorite song is fine for your own enjoyment.</div>
      <label class="row small" style="align-items:flex-start;gap:10px"><input type="checkbox" ${s.source === 'other' ? 'checked' : ''} onchange="MS.a.source(this.checked)"><span>This song was written by someone else.</span></label>
      ${s.source === 'other' && !S.agreed ? `<label class="row small" style="align-items:flex-start;gap:10px"><input type="checkbox" onchange="MS.a.agree(this.checked);MS.render()"><span>It's for my own enjoyment. I won't post it publicly or sell it.</span></label>` : ''}
      ${s.source === 'other' ? '<div class="tiny muted">Downloads will be marked “Personal use only”.</div>' : ''}</div></div></div>` + MS.footer();
    }
  };
  MS.a.preview = function (k, sb) {
    if (S.song.source === 'other' && !S.agreed) return MS.toast('Check the personal-use box first.');
    const c = fixSong(JSON.parse(JSON.stringify(S.song))); MS.applyStyle(c, k, sb);
    pv = { song: c, style: k, sub: sb }; MS.render(); MS.a.playPv();
  };
  MS.a.playPv = () => { if (pv) A().play(Object.assign({}, pv.song, { vocals: Object.assign({}, pv.song.vocals, { leadBuffer: MS.vbuf }) })); };
  MS.a.keepOrig = () => { pv = null; A().stop(); MS.render(); MS.toast('Your original is unchanged.'); };
  MS.a.saveVersion = function (open) {
    if (!pv) return; const orig = S.song, v = JSON.parse(JSON.stringify(pv.song));
    v.id = MS.id('song'); v.parentId = rootOf(orig); v.title = orig.title.replace(/ \([^)]*\)$/, '') + ' (' + pv.sub + ')';
    MS.lib.songs[v.id] = { song: fixSong(v), updated: Date.now() }; writeLib();
    pv = null; A().stop();
    if (open) { MS.openSong(v); MS.go('studio'); MS.toast('Saved and opened “' + v.title + '”. Your original is in My Songs.'); }
    else { MS.render(); MS.toast('Saved “' + v.title + '” to My Songs. Keep exploring.'); }
  };
  MS.a.openVersion = id => { pv = null; const e = MS.lib.songs[id]; if (e) { MS.openSong(e.song); MS.render(); MS.toast('Opened “' + e.song.title + '”'); } };
  MS.a.restyle = function (k, sb) { // used by the suggestions bar: applies straight to the open song (Undo available)
    if (S.song.source === 'other' && !S.agreed) return MS.toast('Check the personal-use box first.');
    MS.change(s => MS.applyStyle(s, k, sb)); MS.toast(k + ' style applied. Press Play.'); MS.a.playSong();
  };
  MS.a.source = v => MS.change(s => { s.source = v ? 'other' : 'mine'; });
  MS.a.playSong = function () { A().play(MS.playable()); };

  // ---------- save & downloads ----------
  MS.screens.save = {
    html() {
      const s = S.song; if (!s) return MS.screens.home.html();
      const other = s.source === 'other';
      return `<div class="row small muted" style="margin-bottom:10px"><a href="#" onclick="MS.go('studio');return false">Studio</a><span>›</span><span style="color:var(--ink)">Save and download</span></div>
      <div class="split"><div class="main">
      <div class="card col"><div class="row" style="justify-content:space-between"><h2>Save and download</h2>${MS.helpBtn('save')}</div>
      <div class="row" style="align-items:flex-end"><label class="f grow">Song title<input value="${esc(s.title)}" onchange="MS.change(x=>x.title=this.value.slice(0,80),{quiet:true})"></label><label class="f grow">Your name (composer)<input value="${esc(s.composer)}" onchange="MS.change(x=>x.composer=this.value.slice(0,80),{quiet:true})"></label></div>
      ${other ? `<div class="small" style="color:var(--coral)">This song was written by someone else, so every download is marked “Personal use only”. ${S.agreed ? '' : 'Check the personal-use box on the home screen first.'}</div>` : ''}</div>
      <div class="grid">
      <div class="opt"><b>Sheet music (PDF)</b><span class="small" style="color:#ddd8cc">Every part on music paper, with your title, your name, chords and lyrics. In the print window, choose “Save as PDF”.</span><button class="btn primary" onclick="MS.a.printSheet()">Download sheet music</button></div>
      <div class="opt"><b>MP3</b><span class="small" style="color:#ddd8cc">The whole song with instruments, drums, background singers and your recorded voice.</span><button class="btn primary" id="mp3btn" onclick="MS.a.mp3()">Download MP3</button><div class="meter" id="mp3m" hidden><i></i></div></div>
      <div class="opt"><b>WAV</b><span class="small" style="color:#ddd8cc">Same as MP3, full quality, bigger file.</span><button class="btn" onclick="MS.a.wav()">Download WAV</button></div>
      <div class="opt"><b>Song file</b><span class="small" style="color:#ddd8cc">A backup of this song you can open on any device with “Open a song file”. (Recorded vocals aren't included; keep the MP3 for those.)</span><div class="row"><button class="btn" onclick="MS.a.saveFile()">Download song file</button><button class="btn" onclick="MS.a.openFile()">Open a song file</button></div></div>
      </div></div>
      <div class="side"><div class="card col"><div class="label">Your song</div><div class="small">${s.sections.length} sections · ${A().timeline(s).total / s.ts} bars · ${s.tempo} BPM · ${esc(s.key)}</div><div class="small muted">About ${Math.round(A().timeline(s).total * 60 / s.tempo)} seconds long.</div><button class="btn" onclick="MS.a.playSong()">Play it</button><button class="btn" onclick="MS.go('studio')">Back to the studio</button></div></div></div>` + MS.footer('MP3 and WAV files are made right on your device. Nothing is uploaded.');
    }
  };
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  MS.download = download;
  const fname = ext => (S.song.title || 'my-song').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + (S.song.source === 'other' ? '-personal-use' : '') + '.' + ext;
  function okToExport() { if (S.song.source === 'other' && !S.agreed) { MS.toast('Check the personal-use box on the home screen first.'); return false; } return true; }
  MS.a.saveFile = function () { download(new Blob([JSON.stringify(S.song, null, 1)], { type: 'application/json' }), fname('json')); };
  MS.a.mp3 = async function () {
    if (!okToExport()) return;
    const b = document.getElementById('mp3btn'), m = document.getElementById('mp3m');
    b.disabled = true; b.textContent = 'Making your MP3…'; m.hidden = false;
    try {
      const buf = await A().renderOffline(MS.playable());
      const blob = await A().toMp3(buf, p => { m.firstChild.style.width = Math.round(p * 100) + '%'; });
      download(blob, fname('mp3')); MS.toast('MP3 ready');
    } catch (e) { console.error(e); MS.toast('Could not make the MP3 on this device. Try WAV.'); }
    b.disabled = false; b.textContent = 'Download MP3'; m.hidden = true;
  };
  MS.a.wav = async function () {
    if (!okToExport()) return;
    MS.toast('Making your WAV…', 1500);
    try { const buf = await A().renderOffline(MS.playable()); download(A().toWav(buf), fname('wav')); } catch (e) { console.error(e); MS.toast('Could not make the WAV on this device.'); }
  };
  MS.a.printSheet = function () {
    if (!okToExport()) return;
    const s = S.song, el = document.getElementById('print');
    let h = `<h1>${esc(s.title)}</h1><div class="by">${s.composer ? (/^Traditional|arr\.|by /i.test(s.composer) ? esc(s.composer) : 'Music by ' + esc(s.composer)) : ''}<br><span style="font-size:12px">${esc(s.key)} · ${s.ts}/4 · ♩ = ${s.tempo}${s.style ? ' · ' + esc(s.style) : ''}</span></div>`;
    s.sections.forEach(sec => {
      h += `<div class="sec">${esc(sec.name)}</div>`;
      s.parts.forEach(p => {
        const ns = p.notes[sec.id] || []; if (!ns.length && p.role !== 'melody') return;
        const r = MSS.render({ notes: ns, clef: p.clef, key: s.key, ts: s.ts, bars: sec.bars, width: 720, chords: p.role === 'melody' ? s.chords[sec.id] : null, paper: 'white', bg: '#ffffff', color: '#000', minBar: 170, dyn: S.level === 'Advanced' ? p.dyn[sec.id] : null });
        h += `<div class="part-sheet"><div class="pname">${esc(p.name)} — ${esc(p.inst)}${p.ens === 'section' ? ' (section)' : ''}</div>${r.svg}</div>`;
      });
      const ly = s.vocals.lyrics[sec.id]; if (ly) h += `<div class="pl">${esc(ly)}</div>`;
    });
    h += `<div class="note">${s.source === 'other' ? '<b>Personal use only.</b> Not for posting, sharing or sale. ' : ''}Made with The Music Studio</div>`;
    el.innerHTML = h;
    setTimeout(() => window.print(), 50);
  };

  // ---------- boot ----------
  MS.boot = function () {
    MS.load();
    if (S.song) { S.sec = S.song.sections[0] && S.song.sections[0].id; S.part = S.song.parts[0] && S.song.parts[0].id; }
    MS.render();
    if (MS.loadVocal) MS.loadVocal();
    document.addEventListener('keydown', e => { if (MS.screens[S.screen] && MS.screens[S.screen].key && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) MS.screens[S.screen].key(e); });
  };
})();
