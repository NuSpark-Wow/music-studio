/* The Music Room — short school-style lessons. Work made here can be sent to the studio. */
(function () {
  const MS = window.MS, S = MS.S, A = () => window.MSA, esc = MS.esc;
  const KEY = 'musicstudio.room';
  let prog = {}; try { prog = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { }
  const done = id => !!prog[id];
  function markDone(id) { if (!prog[id]) { prog[id] = 1; try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { } MS.toast('Lesson complete ✓'); } }
  const L = {}; // lesson working state

  const GROUPS = [
    ['Reading music', [['names', 'Notes on the staff', 3], ['highlow', 'High and low', 2]]],
    ['Rhythm and time', [['lengths', 'How long does a note last?', 3], ['tempo', 'Tempo and the beat', 2]]],
    ['How it sounds', [['dynamics', 'Loud and soft', 2]]],
    ['Melody', [['melody', 'Write a melody', 4]]],
    ['Harmony and chords', [['chords', 'Chords and “home”', 3], ['harmony', 'Add a harmony', 3]]],
    ['Song structure', [['structure', 'Intro, verse, chorus, bridge', 3]]],
    ['Arranging and producing', [['arrange', 'Section or soloist, echo and reverb', 3]]]
  ];
  const ALL = GROUPS.flatMap(g => g[1].map(l => ({ group: g[0], id: l[0], title: l[1], mins: l[2] })));

  MS.screens.room = {
    html() {
      if (S.arg) return lessonHtml(S.arg);
      const n = ALL.filter(l => done(l.id)).length;
      return MS.banner() + `<div class="card col"><div class="row" style="justify-content:space-between"><h1 style="font-size:30px">The Music Room</h1><button class="btn" onclick="MS.go(MS.S.song?'studio':'home')">${S.song ? 'Go to the studio' : 'Back'}</button></div>
        <p style="margin:0;color:#ddd8cc;font-size:16px">Like music class, one short lesson at a time. Tap, listen and try. When you make something you like, send it to the studio and keep going there with instruments, drums and vocals.</p>
        <div class="row small"><span>${n} of ${ALL.length} lessons done</span><div class="meter grow" style="max-width:300px"><i style="width:${n / ALL.length * 100}%;background:var(--teal)"></i></div></div></div>
        <div class="grid" style="margin-top:12px">${GROUPS.map((g, gi) => `<div class="card col"><div class="label">${gi + 1} · ${g[0]}</div>${g[1].map(l => `<button class="btn" style="justify-content:space-between" onclick="MS.go('room','${l[0]}')"><span>${l[1]}</span><span class="tiny ${done(l[0]) ? 'done' : 'muted'}">${done(l[0]) ? '✓ Done' : 'about ' + l[2] + ' min'}</span></button>`).join('')}</div>`).join('')}</div>` + MS.footer();
    },
    after() { const f = S.arg && LESSONS[S.arg] && LESSONS[S.arg].after; if (f) f(); }
  };
  function shell(id, inner, side) {
    const l = ALL.find(x => x.id === id), i = ALL.indexOf(l), next = ALL[i + 1];
    return `<div class="row small muted" style="margin-bottom:10px"><a href="#" onclick="MS.go('room');return false">The Music Room</a><span>›</span><span>${esc(l.group)}</span><span>›</span><span style="color:var(--ink)">${esc(l.title)}</span><span style="margin-left:auto">${done(id) ? '<span class="done">✓ Done</span>' : 'about ' + l.mins + ' minutes'}</span></div>
      <div class="split"><div class="main">${inner}</div><div class="side">${side || ''}<div class="card col"><div class="label">Next</div>${next ? `<button class="btn" onclick="MS.go('room','${next.id}')">${esc(next.title)} ›</button>` : '<div class="small">That was the last lesson. The studio is all yours.</div>'}<button class="btn ghost" onclick="MS.go('room')">All lessons</button></div></div></div>` + MS.footer();
  }
  function lessonHtml(id) { const x = LESSONS[id]; return x ? shell(id, x.html(), x.side ? x.side() : '') : ''; }
  const rer = () => MS.render();
  const staff = (notes, o) => MSS.render(Object.assign({ notes, clef: 'treble', key: 'C major', ts: 4, bars: 1, width: 640, paper: S.paper, color: S.paper === 'dark' ? '#f2b33d' : '#9a5f00' }, o || {})).svg;
  const card = (t, body) => `<div class="card col"><h1 style="font-size:26px">${t}</h1>${body}</div>`;
  const p = t => `<p style="margin:0;font-size:16px;line-height:1.6;color:#ddd8cc">${t}</p>`;
  const keyboard = (low, n, fn) => {
    const whites = []; for (let m = low; whites.length < n; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
    return `<div class="keys">${whites.map(m => `<div class="w" role="button" onpointerdown="${fn}(${m})">${MSS.name(m, 'C major')}</div>`).join('')}</div>`;
  };
  // send lesson work to the studio as a new section
  MS.sendToStudio = function (o) {
    if (!S.song) MS.setSong(MS.blankSong());
    MS.change(s => {
      let target;
      const empty = s.sections.find(x => !s.parts.some(pp => (pp.notes[x.id] || []).length));
      if (o.sections) {
        s.sections = o.sections.map(nm => ({ id: MS.id('s'), name: nm, bars: /Intro|Outro|Bridge/.test(nm) ? 4 : 8 }));
        target = s.sections.find(x => /Verse/.test(x.name)) || s.sections[0];
      } else if (empty) target = empty;
      else { target = { id: MS.id('s'), name: 'Verse ' + (s.sections.filter(x => /Verse/.test(x.name)).length + 1), bars: 4 }; s.sections.push(target); }
      if (o.melody) { target.bars = Math.max(target.bars, Math.ceil(MS.used(o.melody) / s.ts)); s.parts.find(pp => pp.role === 'melody').notes[target.id] = JSON.parse(JSON.stringify(o.melody)); }
      if (o.harmony) { const h = s.parts.find(pp => pp.role === 'harmony'); if (h) h.notes[target.id] = JSON.parse(JSON.stringify(o.harmony)); }
      S.sec = target.id;
    }, { quiet: true });
    MS.go('studio'); MS.toast('Sent to the studio. Pick instruments, add drums and keep going.');
  };

  const LESSONS = {};
  // 1 — note names quiz
  const QN = [64, 65, 67, 69, 71, 72, 74, 76, 77, 62, 60];
  LESSONS.names = {
    html() {
      L.names = L.names || { q: QN[Math.floor(Math.random() * QN.length)], score: 0, msg: '' };
      const st = L.names;
      return card('Notes on the staff', p('Music is written on five lines called a <b>staff</b>. Each line and each space is a note. Notes are named with letters: <b>A B C D E F G</b>, then they start over.') +
        p('In the treble clef (the curly sign), the lines from the bottom are <b>E G B D F</b> (“Every Good Boy Does Fine”) and the spaces spell <b>F A C E</b>. Middle C sits on its own little line below the staff.') +
        staff([{ p: 64, d: 1 }, { p: 67, d: 1 }, { p: 71, d: 1 }, { p: 74, d: 1 }], { names: true }) +
        `<div class="label" style="margin-top:6px">Your turn: what note is this?</div>${staff([{ p: st.q, d: 4 }], { width: 320 })}
        <div class="row">${'CDEFGAB'.split('').map(c => `<button class="btn" style="min-width:52px;font-size:18px" onclick="MS.a.rNames('${c}')">${c}</button>`).join('')}<button class="btn sm ghost" onclick="MSA.preview(${st.q})">▶ Hear it</button></div>
        <div class="small">${st.msg} Score: <b>${st.score}</b> of 5 in a row</div>`);
    }
  };
  MS.a.rNames = function (c) {
    const st = L.names, right = MSS.name(st.q, 'C major')[0];
    A().preview(st.q);
    if (c === right) { st.score++; st.msg = '✓ Yes, that\'s ' + right + '!'; if (st.score >= 5) { markDone('names'); st.score = 0; st.msg = '🎉 Five in a row!'; } }
    else { st.score = 0; st.msg = 'Not quite: that was ' + right + '.'; }
    let q; do { q = QN[Math.floor(Math.random() * QN.length)]; } while (q === st.q); st.q = q; rer();
  };
  // 1b — high and low
  LESSONS.highlow = {
    html() {
      L.hl = L.hl || { a: 0, b: 0, score: 0, msg: '' };
      return card('High and low', p('Notes higher on the staff sound <b>higher</b>, like a bird. Notes lower on the staff sound <b>lower</b>, like a big drum. Listen to two notes and pick the higher one.') +
        `<div class="row"><button class="btn primary" onclick="MS.a.hlPlay()">▶ Play two notes</button><button class="btn" onclick="MS.a.hlAns(1)">First was higher</button><button class="btn" onclick="MS.a.hlAns(2)">Second was higher</button></div><div class="small">${L.hl.msg} Score: <b>${L.hl.score}</b> of 5</div>`);
    }
  };
  MS.a.hlPlay = function () { const st = L.hl; if (!st.a) { st.a = 55 + Math.floor(Math.random() * 20); do { st.b = 55 + Math.floor(Math.random() * 20); } while (Math.abs(st.b - st.a) < 2); } A().previewSequence([{ p: st.a, d: 1 }, { p: st.b, d: 1 }], 'Grand piano', 80); };
  MS.a.hlAns = function (w) {
    const st = L.hl; if (!st.a) return MS.toast('Play the two notes first.');
    const ok = (w === 1) === (st.a > st.b); st.score = ok ? st.score + 1 : 0; st.msg = ok ? '✓ Right!' : 'Not this time. Listen again.';
    if (ok && st.score >= 5) { markDone('highlow'); st.msg = '🎉 Great ears!'; st.score = 0; }
    st.a = 0; rer();
  };
  // 2 — note lengths
  LESSONS.lengths = {
    html() {
      L.len = L.len || { notes: [], step: 0 };
      const st = L.len, used = MS.used(st.notes), goal = st.step === 0 ? 'Fill the measure with exactly <b>4 beats</b>. Use any notes.' : 'Now use at least one <b>half note</b> and two <b>eighth notes</b>, still exactly 4 beats.';
      const ok = Math.abs(used - 4) < 1e-6 && (st.step === 0 || (st.notes.some(n => n.d === 2) && st.notes.filter(n => n.d === 0.5).length >= 2));
      const tray = [[4, '𝅝', 'Whole · 4 beats'], [2, '𝅗𝅥', 'Half · 2 beats'], [1, '♩', 'Quarter · 1 beat'], [0.5, '♪', 'Eighth · ½ beat']].map(([d, g, t]) => `<button class="btn" style="flex-direction:column;min-height:72px;min-width:96px;gap:0" onclick="MS.a.lenAdd(${d})">${MSS.icon(d)}<span class="tiny">${t}</span></button>`).join('');
      return card('How long does a note last?', p('Music has a steady <b>beat</b>, like a heartbeat. In <b>4/4 time</b> every measure holds four beats. A <b>quarter note</b> lasts one beat, a <b>half note</b> two, a <b>whole note</b> all four. Two <b>eighth notes</b> share one beat.') +
        `<div class="label">Your turn ${st.step ? '(part 2)' : ''}</div><div class="small">${goal}</div>${staff(st.notes.length ? st.notes : [], { width: 640, names: false })}
        <div class="row">${tray}</div>
        <div class="row" style="gap:6px">${[0, 1, 2, 3].map(i => `<div style="width:56px;height:48px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px;background:${used > i + 1e-6 ? 'var(--amber)' : 'var(--panel2)'};color:#1a1405">${i + 1}</div>`).join('')}<span class="small muted">beats filled: ${used}</span></div>
        ${used > 4 ? '<div class="small" style="color:var(--coral)">Too many beats! Press Clear and try again.</div>' : ''}
        ${ok ? `<div class="small" style="color:var(--teal)">✓ Exactly 4 beats. ${st.step === 0 ? 'Nice! Try part 2.' : 'You got it!'}</div>` : ''}
        <div class="row"><button class="btn" onclick="MS.a.lenPlay()">▶ Play it</button><button class="btn" onclick="MS.a.lenClear()">Clear</button>${ok && st.step === 0 ? '<button class="btn primary" onclick="MS.a.lenNext()">Part 2</button>' : ''}${ok && st.step === 1 ? '<button class="btn primary" onclick="MS.sendToStudio({melody:MS._lenNotes()})">Send to the studio</button>' : ''}</div>`);
    }
  };
  const lenPitches = [67, 69, 71, 72, 74, 72, 71, 69];
  MS.a.lenAdd = d => { const st = L.len; if (MS.used(st.notes) >= 4) return MS.toast('The measure is full. Press Clear to start over.'); st.notes.push({ p: lenPitches[st.notes.length % 8], d }); A().preview(st.notes[st.notes.length - 1].p, 'Grand piano', { dur: d * 0.6 }); const used = MS.used(st.notes); if (Math.abs(used - 4) < 1e-6 && L.len.step === 1 && st.notes.some(n => n.d === 2) && st.notes.filter(n => n.d === 0.5).length >= 2) markDone('lengths'); rer(); };
  MS.a.lenClear = () => { L.len.notes = []; rer(); };
  MS.a.lenNext = () => { L.len = { notes: [], step: 1 }; rer(); };
  MS.a.lenPlay = () => A().previewSequence(L.len.notes, 'Grand piano', 90);
  MS._lenNotes = () => L.len.notes;
  // 2b — tempo
  LESSONS.tempo = {
    html() {
      L.tempo = L.tempo || { bpm: 90, taps: [], msg: '' };
      const t = L.tempo;
      return card('Tempo and the beat', p('<b>Tempo</b> is how fast the beat goes, counted in <b>BPM</b> (beats per minute). About 60 is a slow walk, 120 is a brisk march, 160 is running.') +
        `<label class="f">Tempo: <b style="color:var(--ink)">${t.bpm} BPM</b><input type="range" min="50" max="180" value="${t.bpm}" onchange="L_tempo(+this.value)"></label>
        <div class="row"><button class="btn primary" onclick="MS.a.metro()">▶ Play 8 beats</button><button class="btn" style="min-width:160px;min-height:64px;font-size:18px" onpointerdown="MS.a.tapBeat()">Tap along</button></div>
        <div class="small">${t.msg || 'Press Play, then tap along with the clicks.'}</div>`);
    }
  };
  window.L_tempo = v => { L.tempo.bpm = v; rer(); };
  let metroStart = 0;
  MS.a.metro = function () { const t = L.tempo, spb = 60 / t.bpm; t.taps = []; metroStart = performance.now() + 100; for (let i = 0; i < 8; i++) setTimeout(() => A().click(i % 4 === 0), 100 + i * spb * 1000); setTimeout(() => { scoreTaps(); }, 100 + 8.5 * spb * 1000); };
  MS.a.tapBeat = () => { L.tempo.taps.push(performance.now()); A().click(false); };
  function scoreTaps() {
    const t = L.tempo, spb = 60000 / t.bpm; if (t.taps.length < 4) { t.msg = 'Tap along with the clicks next time (at least 4 taps).'; return rer(); }
    const errs = t.taps.map(x => { const k = Math.round((x - metroStart) / spb); return Math.abs(x - metroStart - k * spb); });
    const avg = errs.reduce((a, b) => a + b, 0) / errs.length;
    t.msg = avg < 60 ? '🎉 Right on the beat! (' + Math.round(avg) + ' ms off on average)' : avg < 120 ? '✓ Close! About ' + Math.round(avg) + ' ms off. Try again.' : 'Keep practicing: listen first, then tap.';
    if (avg < 120) markDone('tempo'); rer();
  }
  // 3 — dynamics
  LESSONS.dynamics = {
    html() {
      L.dyn = L.dyn || { ans: null, score: 0, msg: '' };
      return card('Loud and soft', p('<b>Dynamics</b> tell you how loud to play. They use Italian words: <b><i>p</i></b> (piano) means soft, <b><i>mf</i></b> (mezzo forte) means medium loud, <b><i>f</i></b> (forte) means loud. A long < sign means get louder (crescendo).') +
        `<div class="row">${['p', 'mf', 'f'].map(d => `<button class="btn" onclick="MS.a.dynDemo('${d}')">▶ Hear <i>${d}</i></button>`).join('')}</div>
        <div class="label">Quiz</div><div class="row"><button class="btn primary" onclick="MS.a.dynQ()">▶ Play a mystery phrase</button>${['p', 'mf', 'f'].map(d => `<button class="btn" style="font-family:Georgia,serif;font-style:italic;font-weight:700;font-size:20px;min-width:60px" onclick="MS.a.dynA('${d}')">${d}</button>`).join('')}</div>
        <div class="small">${L.dyn.msg} Score: <b>${L.dyn.score}</b> of 4</div>`);
    }
  };
  const phrase = v => [60, 64, 67, 72].map(m => ({ p: m, d: 0.5, v }));
  const VEL = { p: 0.28, mf: 0.65, f: 1.25 };
  MS.a.dynDemo = d => A().previewSequence(phrase(VEL[d]), 'Grand piano', 100);
  MS.a.dynQ = () => { L.dyn.ans = ['p', 'mf', 'f'][Math.floor(Math.random() * 3)]; MS.a.dynDemo(L.dyn.ans); };
  MS.a.dynA = function (d) { const st = L.dyn; if (!st.ans) return MS.toast('Play the mystery phrase first.'); const ok = d === st.ans; st.score = ok ? st.score + 1 : 0; st.msg = ok ? '✓ Yes!' : 'That one was ' + st.ans + '.'; if (ok && st.score >= 4) { markDone('dynamics'); st.msg = '🎉 You can hear dynamics!'; st.score = 0; } st.ans = null; rer(); };
  // 4 — write a melody
  LESSONS.melody = {
    html() {
      L.mel = L.mel || { notes: [], len: 1 };
      const st = L.mel, used = MS.used(st.notes);
      return card('Write a melody', p('A <b>melody</b> is the tune you hum. Good melodies mix <b>steps</b> (next-door notes) with a few <b>leaps</b> (jumps). Ending on <b>C</b> sounds like coming home.') +
        `<div class="label">Your turn: write two measures (8 beats)</div>${staff(st.notes, { bars: 2, names: true })}
        <div class="row" style="gap:6px">${[[2, 'Half'], [1, 'Quarter'], [0.5, 'Eighth']].map(([d, t]) => `<button class="btn sm ${st.len === d ? 'on' : ''}" onclick="MS.a.melLen(${d})">${t}</button>`).join('')}<button class="btn sm" onclick="MS.a.melUndo()">Undo last</button><button class="btn sm" onclick="L.mel.notes=[];MS.render()">Clear</button></div>
        ${keyboard(60, 9, 'MS.a.melKey')}
        <div class="small muted">${used} of 8 beats. ${used >= 8 ? (st.notes[st.notes.length - 1].p % 12 === 0 ? '✓ Ends on C. Home!' : 'Tip: try ending on C.') : 'Tap piano keys to add notes.'}</div>
        <div class="row"><button class="btn" onclick="MSA.previewSequence(L.mel.notes,'Grand piano',96)">▶ Play my melody</button>${used >= 8 ? '<button class="btn primary" onclick="MS.a.melSend()">Send to the studio</button>' : ''}</div>`);
    }
  };
  window.L = L;
  MS.a.melLen = d => { L.mel.len = d; rer(); };
  MS.a.melUndo = () => { L.mel.notes.pop(); rer(); };
  MS.a.melKey = m => { const st = L.mel, room = 8 - MS.used(st.notes); A().preview(m); if (room <= 0) return MS.toast('Two measures are full.'); st.notes.push({ p: m, d: Math.min(st.len, room) }); if (MS.used(st.notes) >= 8) markDone('melody'); rer(); };
  MS.a.melSend = () => MS.sendToStudio({ melody: L.mel.notes });
  // 5 — chords
  LESSONS.chords = {
    html() {
      L.ch = L.ch || { msg: '' };
      return card('Chords and “home”', p('A <b>chord</b> is three or more notes played together. In the key of C, three chords do most of the work: <b>C</b> (home), <b>F</b> (moving away) and <b>G</b> (wanting to go home). <b>Am</b> adds a sad color.') +
        `<div class="row">${['C', 'F', 'G', 'Am'].map(c => `<button class="btn" style="min-width:70px;font-size:18px" onclick="MS.a.chordHear('${c}')">▶ ${c}</button>`).join('')}</div>
        ${p('Now listen to this progression. It stops before the end. Which chord sounds like it should come next to feel finished?')}
        <div class="row"><button class="btn primary" onclick="MS.a.chordProg()">▶ C – F – G – ?</button>${['C', 'F', 'Am'].map(c => `<button class="btn" onclick="MS.a.chordAns('${c}')">${c}</button>`).join('')}</div><div class="small">${L.ch.msg}</div>`);
    }
  };
  const chordNotes = c => { const t = A().chordTones(c); return t.tones.map(x => 60 + ((x - t.root + 12) % 12) + t.root - (t.root > 5 ? 12 : 0)); };
  MS.a.chordHear = c => chordNotes(c).forEach(m => A().preview(m, 'Grand piano', { dur: 1.2, vel: 0.55 }));
  MS.a.chordProg = () => ['C', 'F', 'G'].forEach((c, i) => setTimeout(() => MS.a.chordHear(c), i * 900));
  MS.a.chordAns = c => { MS.a.chordHear(c); L.ch.msg = c === 'C' ? '✓ Yes! G wants to go home to C. That pull is called a cadence.' : 'Listen again. That one still sounds unfinished. Try C.'; if (c === 'C') markDone('chords'); rer(); };
  // 5b — harmony
  LESSONS.harmony = {
    html() {
      const mel = (L.mel && MS.used(L.mel.notes) >= 4) ? L.mel.notes : [{ p: 64, d: 1 }, { p: 65, d: 1 }, { p: 67, d: 2 }, { p: 69, d: 1 }, { p: 67, d: 1 }, { p: 64, d: 2 }];
      L.har = L.har || { on: false };
      const har = mel.map(n => ({ p: n.p == null ? null : A().scaleStep(n.p, -2, 'C major'), d: n.d }));
      L.har.mel = mel; L.har.har = har;
      return card('Add a harmony', p('A <b>harmony</b> is a second tune that fits with the melody. The easiest one moves along with it, a <b>third below</b>: skip one letter down (E → C, G → E).') +
        `<div class="label">Melody ${L.mel && MS.used(L.mel.notes) >= 4 ? '(yours, from the melody lesson)' : ''}</div>${staff(mel, { bars: 2, names: true })}
        ${L.har.on ? `<div class="label" style="color:var(--teal)">Harmony, a third below</div>${staff(har, { bars: 2, names: true, color: S.paper === 'dark' ? '#4fc3b8' : '#0b6f67' })}` : ''}
        <div class="row"><button class="btn" onclick="MSA.previewSequence(L.har.mel,'Grand piano',96)">▶ Melody alone</button>${L.har.on ? `<button class="btn primary" onclick="MS.a.harBoth()">▶ Both together</button><button class="btn" onclick="MS.sendToStudio({melody:L.har.mel,harmony:L.har.har})">Send to the studio</button>` : `<button class="btn primary" onclick="L.har.on=true;MS.render()">Add the harmony</button>`}</div>`);
    }
  };
  MS.a.harBoth = function () {
    const song = MS.blankSong(), id = song.sections[0].id; song.sections = [{ id, name: 'x', bars: 2 }]; song.tempo = 96;
    song.parts[0].notes[id] = L.har.mel; song.parts[1].notes[id] = L.har.har; song.parts[1].ens = 'solo'; song.parts.length = 2;
    A().play(song); markDone('harmony');
  };
  // 6 — song structure
  LESSONS.structure = {
    html() {
      L.st = L.st || { map: [] };
      const blocks = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Outro'];
      return card('Intro, verse, chorus, bridge', p('Most songs are built from parts. The <b>intro</b> opens. A <b>verse</b> tells the story (new words each time). The <b>chorus</b> is the catchy part that repeats. The <b>bridge</b> is a change of scenery near the end. The <b>outro</b> closes.') +
        `<div class="label">Build a song map. Tap a part to add it.</div><div class="row">${blocks.map(b => `<button class="btn" style="background:${MS.SEC_COLOR(b)};color:#15130d;border:0" onclick="MS.a.stAdd('${b}')">+ ${b}</button>`).join('')}</div>
        <div class="blocks">${L.st.map.length ? L.st.map.map((b, i) => `<button style="background:${MS.SEC_COLOR(b)}" onclick="MS.a.stDel(${i})" aria-label="Remove ${b}">${b} ✕</button>`).join('') : '<span class="small muted" style="align-self:center">Your song map will show here.</span>'}</div>
        <div class="row"><button class="btn sm" onclick="L.st.map=['Intro','Verse','Chorus','Verse','Chorus','Bridge','Chorus','Outro'];MS.render()">Show me a common pattern</button><button class="btn sm" onclick="L.st.map=[];MS.render()">Clear</button>
        ${L.st.map.length >= 3 ? '<button class="btn primary" onclick="MS.a.stSend()">Send to the studio</button>' : ''}</div>
        <div class="small muted">${L.st.map.filter(b => b === 'Chorus').length >= 2 ? '✓ Your chorus repeats. That is what makes it stick.' : 'Tip: use the chorus at least twice.'}</div>`);
    }
  };
  MS.a.stAdd = b => { if (L.st.map.length < 12) L.st.map.push(b); if (L.st.map.length >= 4 && L.st.map.filter(x => x === 'Chorus').length >= 2) markDone('structure'); rer(); };
  MS.a.stDel = i => { L.st.map.splice(i, 1); rer(); };
  MS.a.stSend = function () {
    if (S.song && S.song.parts.some(pp => Object.values(pp.notes).some(a => a.length)) && !confirm('This replaces the sections in your current song with your new song map. Continue?')) return;
    let v = 0; const names = L.st.map.map(b => b === 'Verse' ? 'Verse ' + (++v) : b);
    MS.sendToStudio({ sections: names });
  };
  // 7 — arranging
  LESSONS.arrange = {
    html() {
      L.ar = L.ar || { echo: 0, rev: 0.2 };
      return card('Section or soloist, echo and reverb', p('<b>Arranging</b> means choosing who plays what. A <b>soloist</b> is one player out front, clear and personal. A <b>section</b> is many players together, rich and full. A classic mix: soloist on the melody, a section on the harmony.') +
        `<div class="row"><button class="btn" onclick="MS.a.arDemo('solo')">▶ One violin</button><button class="btn" onclick="MS.a.arDemo('section')">▶ Violin section</button><button class="btn" onclick="MS.a.arDemo('both')">▶ Soloist + section</button></div>
        ${p('<b>Producing</b> is shaping the sound. <b>Echo</b> repeats the sound a moment later. <b>Reverb</b> makes it sound like a bigger room.')}
        <label class="f">Echo<input type="range" min="0" max="0.8" step="0.05" value="${L.ar.echo}" onchange="L.ar.echo=+this.value"></label>
        <label class="f">Reverb<input type="range" min="0" max="1" step="0.05" value="${L.ar.rev}" onchange="L.ar.rev=+this.value"></label>
        <div class="row"><button class="btn primary" onclick="MS.a.arFx()">▶ Hear it with my settings</button></div>`);
    }
  };
  const arMel = [{ p: 67, d: 1 }, { p: 72, d: 1 }, { p: 71, d: 0.5 }, { p: 69, d: 0.5 }, { p: 67, d: 1 }, { p: 64, d: 2 }, { p: 65, d: 1 }, { p: 67, d: 1 }];
  MS.a.arDemo = function (k) {
    const song = MS.blankSong(), id = song.sections[0].id; song.sections = [{ id, name: 'x', bars: 2 }]; song.tempo = 84;
    song.parts[0] = Object.assign(song.parts[0], { inst: 'Violins', ens: k === 'section' ? 'section' : 'solo', notes: { [id]: arMel }, rev: 0.4 });
    if (k === 'both') song.parts[1] = Object.assign(song.parts[1], { inst: 'Violins', ens: 'section', notes: { [id]: arMel.map(n => ({ p: A().scaleStep(n.p, -2, 'C major'), d: n.d })) } }); else song.parts.length = 1;
    song.parts.length = k === 'both' ? 2 : 1;
    A().play(song);
  };
  MS.a.arFx = function () {
    const song = MS.blankSong(), id = song.sections[0].id; song.sections = [{ id, name: 'x', bars: 2 }]; song.tempo = 90;
    song.parts = [Object.assign(song.parts[0], { inst: 'Electric piano', notes: { [id]: arMel }, echo: L.ar.echo, rev: L.ar.rev })];
    A().play(song); markDone('arrange');
  };
})();
