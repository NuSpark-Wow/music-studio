/* The Music Studio — the studio screen: song map, staffs, notes, chords, drums, mixer, instruments. */
(function () {
  const MS = window.MS, S = MS.S, A = () => window.MSA, esc = MS.esc;
  const LENS = [[4, 'Whole', '𝅝'], [2, 'Half', '𝅗𝅥'], [1, 'Quarter', '♩'], [0.5, 'Eighth', '♪'], [0.25, '16th', '𝅘𝅥𝅯'], [3, 'Dotted half', '𝅗𝅥.'], [1.5, 'Dotted quarter', '♩.']];
  const lensFor = () => S.level === 'Basic' ? LENS.slice(0, 4) : S.level === 'Moderate' ? LENS.slice(0, 4).concat([LENS[6]]) : LENS;
  let loop = false, countIn = false, follow = true, raf = null, lastDrawn = -1;

  MS.screens.studio = {
    html() {
      if (!S.song) MS.setSong(MS.blankSong());
      const s = S.song, sec = MS.sec(), p = MS.part(); S.sec = sec.id; S.part = p.id;
      const keyOpts = Object.keys(A().KEYS).map(k => `<option ${k === s.key ? 'selected' : ''}>${k}</option>`).join('');
      return `
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <div class="row"><label class="f" style="min-width:220px">Song title<input value="${esc(s.title)}" onchange="MS.change(x=>x.title=this.value.slice(0,80),{quiet:true})"></label>
        <label class="f mod">Key<select onchange="MS.a.key(this.value)">${keyOpts}</select></label>
        <label class="f adv">Time<select onchange="MS.a.ts(+this.value)"><option value="4" ${s.ts === 4 ? 'selected' : ''}>4/4</option><option value="3" ${s.ts === 3 ? 'selected' : ''}>3/4</option></select></label>
        <label class="f" style="min-width:180px">Tempo <b style="color:var(--ink)" id="tempoV">${s.tempo} BPM</b><input type="range" min="40" max="200" value="${s.tempo}" oninput="document.getElementById('tempoV').textContent=this.value+' BPM'" onchange="MS.change(x=>x.tempo=+this.value,{quiet:true})"></label>
        <button class="btn sm mod" onclick="MS.a.tapTempo()" title="Tap 4 times at the speed you want">Tap tempo</button>${MS.helpBtn('keytempo')}${MS.helpBtn('studio', '? How the studio works')}</div>
        <div class="row"><button class="btn" style="border-color:#4a6a8a;background:#1a2433" onclick="MS.go('control')">🎚 Control Room</button><button class="btn mod" onclick="MS.a.scan()">📷 Scan sheet music</button><button class="btn mod" onclick="MS.go('restyle')">Restyle</button><button class="btn primary" onclick="MS.go('save')">Save and download</button></div>
      </div>
      ${songMap()}
      <div class="split" style="margin-top:12px"><div class="main">
        ${s.parts.map(x => partCard(x) + (x.id === S.part ? `<div class="mobile-only pinwrap"><div class="pinstaff"><div class="tiny" style="color:var(--amber);margin-bottom:4px">${esc(x.name)} · ${esc(sec.name)} <span class="muted">(stays here while you pick notes)</span></div><div class="staffbox" data-pid="${x.id}" onclick="event.stopPropagation();MS.a.staffTap(event,'${x.id}')"></div><div class="pinbar"></div></div>${notesCard()}</div>` : '')).join('')}
        <div class="row"><button class="btn sm" onclick="MS.a.addPart()">+ Add a part</button>${s.parts.some(x => x.role !== 'melody') ? `<label class="row small mod"><input type="checkbox" ${ghostGlobal() ? 'checked' : ''} onchange="MS.a.ghostAll(this.checked)"> Show the melody faintly behind the other parts</label>${MS.helpBtn('ghost', '?')}` : ''}</div>
        ${chordsCard()}
        ${transport()}
        <div class="card adv">${mixer()}</div>
      </div><div class="side">
        <div class="desktop-only">${notesCard()}</div>
        ${soundCard()}
        ${drumsCard()}
      </div></div>` + MS.footer();
    },
    after() { drawStaffs(); drawKeys(); document.querySelectorAll('.staffbox').forEach(bindDrag); },
    key(e) {
      const k = e.key;
      if (k === ' ') { e.preventDefault(); A().isPlaying() ? stop() : MS.a.play(false); return; }
      if (S.sel == null) { if (k === 'ArrowRight' || k === 'ArrowLeft') { const ns = MS.notesOf(MS.part()); if (ns.length) { S.sel = k === 'ArrowLeft' ? ns.length - 1 : 0; MS.render(); } } return; }
      if (k === 'ArrowUp') { e.preventDefault(); MS.a.step(e.shiftKey ? 'semi+' : 1); }
      else if (k === 'ArrowDown') { e.preventDefault(); MS.a.step(e.shiftKey ? 'semi-' : -1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); MS.a.selMove(-1); }
      else if (k === 'ArrowRight') { e.preventDefault(); MS.a.selMove(1); }
      else if (k === 'Backspace' || k === 'Delete') { e.preventDefault(); MS.a.del(); }
      else if (k === 'Escape') { S.sel = null; MS.render(); }
      else if (k === 'r' || k === 'R') MS.a.toggleRest();
      else if ('1234'.includes(k)) MS.a.len([4, 2, 1, 0.5][+k - 1]);
    }
  };

  // ---------- song map ----------
  function songMap() {
    const s = S.song, sec = MS.sec();
    return `<div class="card col"><div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><div class="label">Song map</div>${MS.helpBtn('songmap')}</div>
      <div class="row"><button class="btn sm" onclick="MS.a.addSection()">+ Section</button><button class="btn sm mod" onclick="MS.a.copySection()">Copy</button><button class="btn sm mod" onclick="MS.a.renameSection()">Rename</button>
      <button class="btn sm adv" onclick="MS.a.moveSection(-1)" aria-label="Move section left">◀</button><button class="btn sm adv" onclick="MS.a.moveSection(1)" aria-label="Move section right">▶</button>
      <button class="btn sm mod" onclick="MS.a.bars(-1)" aria-label="Fewer bars">− bar</button><button class="btn sm mod" onclick="MS.a.bars(1)" aria-label="More bars">+ bar</button><button class="btn sm" onclick="MS.a.delSection()">Delete</button></div></div>
      <div class="map">${s.sections.map(x => `<button type="button" class="${x.id === sec.id ? 'sel' : ''}" style="flex-grow:${x.bars};background:${MS.SEC_COLOR(x.name)}" onclick="MS.a.pickSection('${x.id}')" aria-pressed="${x.id === sec.id}">${esc(x.name)}<span>${x.bars} bars${s.vocals.lyrics[x.id] ? ' · lyrics' : ''}</span></button>`).join('')}</div>
      <div class="tiny muted">Editing <b style="color:var(--ink)">${esc(sec.name)}</b>. Tap a block to edit it. Play song plays every block in order.</div></div>`;
  }
  MS.a.pickSection = id => { S.sec = id; S.sel = null; MS.render(); };
  MS.a.addSection = function () {
    const names = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Outro'];
    MS.modal(`<h2>Add a section</h2><div class="col" style="margin-top:12px"><div class="label">What part of the song?</div>
      <div class="seg">${names.map(n => `<button class="pill" onclick="MS.a._newSec('${n}')">${n}</button>`).join('')}</div>
      <div class="label">How long?</div><div class="seg" id="barsSeg">${[2, 4, 8].map(b => `<button class="pill ${b === 4 ? 'on' : ''}" onclick="document.querySelectorAll('#barsSeg .pill').forEach(x=>x.classList.remove('on'));this.classList.add('on');MS._bars=${b}">${b} bars</button>`).join('')}</div>
      <label class="row small"><input type="checkbox" id="copyNotes"> Copy the notes from “${esc(MS.sec().name)}”</label>
      <div class="tiny muted">Tap a name to add it after the section you're on.</div><div class="row"><button class="btn" onclick="MS.closeModal()">Cancel</button></div></div>`);
    MS._bars = 4;
  };
  MS.a._newSec = function (name) {
    const copy = document.getElementById('copyNotes').checked, from = MS.sec();
    MS.closeModal();
    MS.change(s => {
      const count = s.sections.filter(x => x.name.startsWith(name)).length;
      const nm = /Verse/.test(name) ? 'Verse ' + (count + 1) : name;
      const id = MS.id('s'), i = s.sections.findIndex(x => x.id === from.id);
      s.sections.splice(i + 1, 0, { id, name: nm, bars: copy ? from.bars : MS._bars });
      if (copy) { s.parts.forEach(p => { if (p.notes[from.id]) p.notes[id] = JSON.parse(JSON.stringify(p.notes[from.id])); }); if (s.chords[from.id]) s.chords[id] = s.chords[from.id].slice(); }
      S.sec = id;
    });
  };
  MS.a.copySection = function () {
    const from = MS.sec();
    MS.change(s => {
      const id = MS.id('s'), i = s.sections.findIndex(x => x.id === from.id);
      s.sections.splice(i + 1, 0, { id, name: from.name.replace(/ \d+$/, '') + (/Verse/.test(from.name) ? ' ' + (s.sections.filter(x => /Verse/.test(x.name)).length + 1) : ''), bars: from.bars });
      s.parts.forEach(p => { if (p.notes[from.id]) p.notes[id] = JSON.parse(JSON.stringify(p.notes[from.id])); });
      if (s.chords[from.id]) s.chords[id] = s.chords[from.id].slice();
      if (s.vocals.lyrics[from.id] && /chorus/i.test(from.name)) s.vocals.lyrics[id] = s.vocals.lyrics[from.id];
      S.sec = id;
    });
    MS.toast('Copied. You are now editing the copy.');
  };
  MS.a.renameSection = function () {
    const sec = MS.sec();
    MS.modal(`<h2>Rename section</h2><div class="col" style="margin-top:12px"><label class="f">New name<input id="rn" value="${esc(sec.name)}" maxlength="24"></label><div class="row"><button class="btn primary" onclick="MS.a._rename()">Save</button><button class="btn" onclick="MS.closeModal()">Cancel</button></div></div>`);
    setTimeout(() => document.getElementById('rn').select(), 30);
  };
  MS.a._rename = function () { const v = document.getElementById('rn').value.trim().slice(0, 24); MS.closeModal(); if (v) MS.change(s => { s.sections.find(x => x.id === S.sec).name = v; }); };
  MS.a.moveSection = d => MS.change(s => { const i = s.sections.findIndex(x => x.id === S.sec), j = i + d; if (j < 0 || j >= s.sections.length) return; const [x] = s.sections.splice(i, 1); s.sections.splice(j, 0, x); });
  MS.a.bars = d => MS.change(s => { const x = s.sections.find(y => y.id === S.sec); x.bars = Math.max(1, Math.min(16, x.bars + d)); });
  MS.a.delSection = async function () {
    if (S.song.sections.length < 2) return MS.toast('A song needs at least one section.');
    if (!(await MS.ask('Delete “' + MS.sec().name + '”?', 'This removes the section and every note in it. You can press Undo right after if you change your mind.', [['Delete section', true, 'danger'], ['Keep it', null, '']]))) return;
    MS.change(s => { const i = s.sections.findIndex(x => x.id === S.sec); s.sections.splice(i, 1); S.sec = s.sections[Math.max(0, i - 1)].id; });
  };

  // ---------- parts ----------
  function partCard(p) {
    const active = p.id === S.part, s = S.song, ns = (p.notes[S.sec] || []), full = MS.used(ns), len = MS.sec().bars * s.ts;
    const I = A().INST[p.inst] || {};
    const role = p.role === 'harmony' ? `<button class="btn sm" onclick="event.stopPropagation();MS.a.harmony('${p.id}')">Suggest a harmony</button>${MS.helpBtn('harmony', '?')}` : p.role === 'bass' ? `<button class="btn sm mod" onclick="event.stopPropagation();MS.a.bassLine()">Make a bass line</button>${MS.helpBtn('bass', '?')}` : '';
    const gh = p.role !== 'melody' && ghostGlobal() ? `<button class="btn sm ghost" aria-pressed="${p.ghost !== false}" onclick="event.stopPropagation();MS.a.ghostPart('${p.id}')" title="Show the melody faintly on this staff">${p.ghost !== false ? 'Melody: shown' : 'Melody: hidden'}</button>` : '';
    const bh = p.role !== 'melody' && !Object.values(p.notes).some(l => l.some(n => n.p != null)) ? 'bhide' : '';
    return `<div class="card part tight ${active ? 'active' : ''} ${bh}" onclick="MS.a.activate('${p.id}')">
      <div class="row" style="justify-content:space-between"><div class="row" style="gap:8px"><span class="dot" style="background:${p.color}"></span><b style="font-family:var(--H);font-size:17px">${esc(p.name)}</b>
      <button class="btn sm ghost" onclick="event.stopPropagation();MS.a.pickInst('${p.id}')" title="Change instrument">${esc(p.inst)}${I.ens ? (p.ens === 'section' ? ' · section' : ' · soloist') : ''} ▾</button>
      ${active ? '<span class="tiny" style="color:var(--amber)">Adding notes here</span>' : '<span class="tiny muted">Tap to add notes here</span>'}</div>
      <div class="row" style="gap:6px">${gh}${role}<button class="btn sm adv" aria-pressed="${!!p.solo}" style="${p.solo ? 'background:var(--amber);color:#1a1405' : ''}" onclick="event.stopPropagation();MS.a.solo('${p.id}')">Solo</button><button class="btn sm" aria-pressed="${!!p.mute}" style="${p.mute ? 'background:#5a2a20' : ''}" onclick="event.stopPropagation();MS.a.mute('${p.id}')">${p.mute ? 'Muted' : 'Mute'}</button>
      <button class="btn sm" onclick="event.stopPropagation();MS.a.playPart('${p.id}')" aria-label="Play this part">▶</button><button class="btn sm mod" onclick="event.stopPropagation();MS.a.clearPart('${p.id}')">Clear</button>${s.parts.length > 1 && !['melody'].includes(p.role) ? `<button class="btn sm adv" onclick="event.stopPropagation();MS.a.removePart('${p.id}')" aria-label="Remove part">✕</button>` : ''}</div></div>
      <div class="staffbox ${active ? 'desktop-only' : ''}" data-pid="${p.id}" onclick="event.stopPropagation();MS.a.staffTap(event,'${p.id}')"></div>
      <div class="tiny muted">${full ? `${fmtBeats(full)} of ${len} beats filled` : (p.role === 'melody' ? 'Empty. Tap the piano keys or the staff to add notes.' : p.role === 'harmony' ? 'Empty. Press “Suggest a harmony”, or tap your own.' : 'Empty. Tap the staff or make a bass line.')}${full > len ? ' · extra notes past the end are not played' : ''}</div></div>`;
  }
  const fmtBeats = b => (Math.round(b * 4) / 4).toString();
  MS.a.activate = id => { if (S.part !== id) { S.part = id; S.sel = null; MS.render(); } };
  MS.a.solo = id => MS.change(s => { const p = s.parts.find(x => x.id === id); p.solo = !p.solo; });
  MS.a.mute = id => MS.change(s => { const p = s.parts.find(x => x.id === id); p.mute = !p.mute; });
  MS.a.clearPart = async id => { const p = S.song.parts.find(x => x.id === id); if (await MS.ask('Clear ' + p.name + ' in “' + MS.sec().name + '”?', 'Only this part in this section is erased. Undo brings it back.', [['Clear it', true, 'danger'], ['Cancel', null, '']])) MS.change(s => { s.parts.find(x => x.id === id).notes[S.sec] = []; S.sel = null; }); };
  MS.a.removePart = async id => { const p = S.song.parts.find(x => x.id === id); if (await MS.ask('Remove ' + p.name + '?', 'This takes the part out of the whole song, in every section.', [['Remove part', true, 'danger'], ['Keep it', null, '']])) MS.change(s => { s.parts = s.parts.filter(x => x.id !== id); S.part = s.parts[0].id; }); };
  MS.a.addPart = function () {
    MS.change(s => {
      const used = s.parts.map(p => p.color), col = ['#b39dfa', '#7fb2ff', '#d9d4c8', '#4fc3b8', '#f08a6b'].find(c => !used.includes(c)) || '#d9d4c8';
      const n = s.parts.filter(p => p.role === 'harmony').length + 1;
      const p = MS.newPart('Harmony ' + n, 'harmony', 'Flute', col, { vol: 0.55, pan: 0.3 }); s.parts.push(p); S.part = p.id;
    });
    MS.a.pickInst(S.part);
  };
  MS.a.harmony = function (id) {
    const p = S.song.parts.find(x => x.id === id);
    MS.modal(`<h2>Suggest a harmony</h2><div class="col" style="margin-top:12px"><div class="small" style="color:#ddd8cc">A harmony follows your melody a few notes higher or lower. Pick one and hear it.</div>
      <div class="grid">${[['third_below', 'A third below', 'Warm and close. The most common harmony.'], ['third_above', 'A third above', 'Brighter, sits on top of the melody.'], ['sixth_below', 'A sixth below', 'Fuller and lower, good for strings.']].map(([k, t, d]) => `<button class="opt lesson-card" onclick="MS.a._harm('${id}','${k}')"><b>${t}</b><span class="small" style="color:#ddd8cc">${d}</span></button>`).join('')}</div>
      <label class="row small"><input type="checkbox" id="harmAll"> Do it for every section, not just “${esc(MS.sec().name)}”</label><div class="row"><button class="btn" onclick="MS.closeModal()">Cancel</button></div></div>`);
  };
  MS.a._harm = function (id, kind) {
    const all = document.getElementById('harmAll').checked; MS.closeModal();
    MS.change(s => {
      const mel = s.parts.find(p => p.role === 'melody'), h = s.parts.find(p => p.id === id), step = kind === 'third_above' ? 2 : kind === 'sixth_below' ? -5 : -2;
      (all ? s.sections.map(x => x.id) : [S.sec]).forEach(sid => { h.notes[sid] = (mel.notes[sid] || []).map(x => ({ p: x.p == null ? null : A().scaleStep(x.p, step, s.key), d: x.d })); });
      S.part = id;
    });
    if (!(MS.part().notes[S.sec] || []).length) MS.toast('Your melody is empty here, so there is nothing to harmonize yet.'); else MS.a.playSection();
  };
  MS.a.bassLine = function () {
    MS.modal(`<h2>Make a bass line</h2><div class="col" style="margin-top:12px"><div class="small" style="color:#ddd8cc">Built from your chords. No chords yet? They get suggested from your melody first.</div>
    <div class="grid">${[['pop', 'Steady', 'Root and fifth, two per bar.'], ['whole', 'Long notes', 'One long note per bar. Calm.'], ['walk', 'Walking', 'Four notes per bar, jazzy.']].map(([k, t, d]) => `<button class="opt lesson-card" onclick="MS.a._bass('${k}')"><b>${t}</b><span class="small" style="color:#ddd8cc">${d}</span></button>`).join('')}</div>
    <label class="row small"><input type="checkbox" id="bassAll" checked> Every section</label><div class="row"><button class="btn" onclick="MS.closeModal()">Cancel</button></div></div>`);
  };
  MS.a._bass = function (style) {
    const all = document.getElementById('bassAll').checked; MS.closeModal();
    MS.change(s => { const b = MS.makeBass(s, all ? null : [S.sec], style); S.part = b.id; });
    MS.a.playSection();
  };

  // ---------- staff tapping & editing ----------
  const maps = {};
  // the melody, shifted into this part's range, drawn faintly behind harmony and bass
  function ghostGlobal() { return S.view.ghost != null ? S.view.ghost : S.level !== 'Advanced'; }
  function ghostFor(p, secId) {
    if (p.role === 'melody' || p.ghost === false || !ghostGlobal()) return null;
    const mel = S.song.parts.find(x => x.role === 'melody'); if (!mel || mel === p) return null;
    const ns = (mel.notes[secId] || []), ps = ns.filter(n => n.p != null).map(n => n.p); if (!ps.length) return null;
    const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
    const sh = p.clef === 'bass' ? -12 * Math.max(1, Math.round((avg - 50) / 12)) : (avg > 79 ? -12 : avg < 57 ? 12 : 0);
    return ns.map(n => ({ p: n.p == null ? null : n.p + sh, d: n.d }));
  }
  MS.a.ghostAll = v => { S.view.ghost = v; MS.render(); };
  MS.a.ghostPart = id => MS.change(s => { const p = s.parts.find(x => x.id === id); p.ghost = p.ghost === false ? true : false; });
  // parts you're not editing are drawn a little lighter, so the active staff stands out
  function soften(hex) {
    const bg = S.paper === 'dark' ? [29, 31, 37] : [251, 250, 246], c = hex.replace('#', ''), v = [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16));
    return '#' + v.map((x, i) => Math.round(x * 0.55 + bg[i] * 0.45).toString(16).padStart(2, '0')).join('');
  }
  function drawStaffs(playBeat) {
    const s = S.song, sec = MS.sec();
    document.querySelectorAll('.staffbox').forEach(el => {
      const p = s.parts.find(x => x.id === el.dataset.pid); if (!p) return;
      if (!el.offsetParent) { el.innerHTML = ''; el._map = null; return; } // hidden copy (phone vs desktop)
      const r = MSS.render({ notes: p.notes[sec.id] || [], ghost: ghostFor(p, sec.id), clef: p.clef, key: s.key, ts: s.ts, bars: sec.bars, width: el.clientWidth || 800, minBar: (el.clientWidth || 800) < 600 ? 120 : 150, chords: p.role === 'melody' ? s.chords[sec.id] : null, names: S.level === 'Basic' || S.view.names !== false && S.level === 'Moderate', sel: p.id === S.part ? S.sel : null, color: p.id === S.part || s.parts.length < 2 ? MS.noteColor(p) : soften(MS.noteColor(p)), paper: S.paper, play: playBeat, dyn: S.level === 'Advanced' ? p.dyn[sec.id] : null, lyrics: p.role === 'melody' ? s.vocals.lyrics[sec.id] : null, label: p.name + ' staff' });
      // keep a fixed touch layer so a finger stays "on" the staff while the drawing underneath changes
      if (!el.querySelector('.sv')) el.innerHTML = '<div class="sv"><div class="svgh"></div><div class="hit"></div></div><div class="tbw"></div>';
      el.querySelector('.svgh').innerHTML = r.svg; el._map = r.map; maps[p.id] = r.map;
      const pinned = el.closest('.pinstaff'), tb = playBeat == null ? toolbar(el, p, r.map) : null;
      if (pinned) { const bar = pinned.querySelector('.pinbar'); if (bar && tb != null) bar.innerHTML = tb; }
      else if (tb != null) el.querySelector('.tbw').innerHTML = tb;
      if (pinned && playBeat == null) { // scroll the pinned staff to the line you're working on
        const h = (r.map.heads || []).find(x => x.idx === S.sel) || (r.map.heads || []).slice(-1)[0], k = (el.clientWidth || r.map.width) / r.map.width;
        if (h) { const lm = r.map.lines[h.L]; el.scrollTop = Math.max(0, lm.top * k - 4); }
      }
    });
  }
  // a small toolbar that pops up right above the selected note (or a "copy" chip over a tapped melody ghost note)
  function toolbar(el, p, map) {
    const svgW = el.clientWidth || map.width, k = svgW / map.width;
    const g = S.ghostPick && S.ghostPick.pid === p.id ? S.ghostPick.g : null;
    if (g) {
      const lm = map.lines[g.L]; if (!lm) return '';
      const pin = !!el.closest('.pinstaff');
      return `<div class="ntb ${pin ? 'inbar' : ''}" style="${pin ? '' : `left:${Math.max(4, Math.min(svgW - 210, g.x * k - 100))}px;top:${g.L === 0 ? lm.bottom * k - 4 : lm.top * k}px;${g.L === 0 ? 'transform:none' : ''}`}" onclick="event.stopPropagation()"><button class="btn sm primary" onclick="MS.a.copyGhost()">＋ Copy this note (${MSS.name(g.p, S.song.key)})</button><button class="btn sm ghost" onclick="MS.a.noGhost()" aria-label="Close">✕</button></div>`;
    }
    if (p.id !== S.part || S.sel == null) return '';
    const h = (map.heads || []).find(x => x.idx === S.sel); if (!h) return '';
    const n = (p.notes[S.sec] || [])[S.sel]; if (!n) return '';
    const lm = map.lines[h.L], lens = [4, 2, 1, 0.5].concat(S.level === 'Basic' ? [] : [1.5]);
    const w = 44 * (lens.length + 5), pinned = !!el.closest('.pinstaff');
    return `<div class="ntb ${pinned ? 'inbar' : ''}" style="${pinned ? '' : `left:${Math.max(4, Math.min(svgW - w - 4, h.x * k - w / 2))}px;top:${h.L === 0 ? lm.bottom * k - 4 : lm.top * k}px;${h.L === 0 ? 'transform:none' : ''}`}" onclick="event.stopPropagation()" role="toolbar" aria-label="Change this note">
      ${n.p != null ? `<button class="btn sm" onclick="MS.a.step(1)" aria-label="Higher">▲</button><button class="btn sm" onclick="MS.a.step(-1)" aria-label="Lower">▼</button>` : ''}
      ${lens.map(d => `<button class="btn sm ${Math.abs(n.d - d) < 1e-6 ? 'on' : ''}" onclick="MS.a.len(${d})" aria-label="${(LENS.find(l => l[0] === d) || [0, ''])[1]} note">${MSS.icon(d, null, n.p == null)}</button>`).join('')}
      <button class="btn sm" onclick="MS.a.toggleRest()" aria-label="${n.p == null ? 'Make it a note' : 'Make it a rest'}">${n.p == null ? '♪' : MSS.icon(1, null, true)}</button>
      <button class="btn sm" onclick="MS.a.del()" aria-label="Delete note">🗑</button><button class="btn sm ghost" onclick="MS.a.deselect()" aria-label="Done">✕</button></div>`;
  }
  MS.a.noGhost = () => { S.ghostPick = null; drawStaffs(); };
  MS.a.copyGhost = function () {
    const gp = S.ghostPick; if (!gp) return; S.ghostPick = null;
    const g = gp.g, p = S.song.parts.find(x => x.id === gp.pid), len = MS.sec().bars * S.song.ts;
    MS.change(() => {
      const ns = MS.notesOf(p), used = MS.used(ns);
      if (g.beat >= used - 1e-6) {
        if (g.beat - used > 1e-6) ns.push({ p: null, d: g.beat - used });
        ns.push({ p: g.p, d: Math.min(g.d, len - g.beat) }); S.sel = ns.length - 1; return;
      }
      let b = 0, i = 0; for (; i < ns.length; i++) { if (b + ns[i].d > g.beat + 1e-6) break; b += ns[i].d; }
      const n = ns[i]; if (!n) return;
      if (Math.abs(b - g.beat) < 1e-6) { n.p = g.p; S.sel = i; return; }
      if (n.p == null) { // split the rest around the copied note
        const before = g.beat - b, dd = Math.min(g.d, n.d - before), after = n.d - before - dd;
        const add = [{ p: null, d: before }, { p: g.p, d: dd }].concat(after > 1e-6 ? [{ p: null, d: after }] : []);
        ns.splice(i, 1, ...add); S.sel = i + 1; return;
      }
      n.p = g.p; S.sel = i;
    });
    S.part = p.id; A().preview(g.p, p.inst);
    MS.toast('Copied. Drag it up or down to a harmony note, or use ▲ ▼.');
  };
  // drag a note up or down: mouse = press and drag; touch = press and hold, then slide
  let suppressClick = 0;
  function bindDrag(el) {
    if (el._drag) return; el._drag = true;
    const pid = el.dataset.pid; let st = null, hold = null, t0 = null, dragging = false;
    const toSvg = (cx, cy) => { const svg = el.querySelector('svg'), map = el._map; if (!svg || !map) return null; const r = svg.getBoundingClientRect(); return { x: (cx - r.left) * (map.width / r.width), y: (cy - r.top) * (map.H / r.height), map }; };
    const begin = (cx, cy) => {
      if (S.part !== pid) return false; const c = toSvg(cx, cy); if (!c) return false;
      const hit = MSS.pick(c.map, c.x, c.y); if (hit.noteIndex == null || !hit.onHead) return false;
      const n = MS.notesOf(MS.part())[hit.noteIndex]; if (!n || n.p == null) return false;
      st = { idx: hit.noteIndex, orig: n.p, cur: n.p, L: MSS.lineAtY(c.map, c.y), moved: false }; return true;
    };
    const move = (cx, cy) => {
      if (!st) return; const c = toSvg(cx, cy); if (!c) return;
      const m = MSS.stepToMidi(MSS.stepAtY(c.map, st.L, c.y), S.song.key);
      if (m !== st.cur) { st.cur = m; st.moved = true; const n = MS.notesOf(MS.part())[st.idx]; if (n) n.p = m; S.sel = st.idx; drawStaffs(); A().preview(m, partInst(), { dur: 0.25 }); }
    };
    const end = () => {
      if (!st) return; const s0 = st; st = null;
      const n = MS.notesOf(MS.part())[s0.idx];
      if (s0.moved && n) { n.p = s0.orig; MS.change(() => { n.p = s0.cur; S.sel = s0.idx; }); suppressClick = Date.now(); return true; }
      return false;
    };
    el.addEventListener('mousedown', e => {
      if (e.button !== 0 || e.target.closest('.ntb') || !begin(e.clientX, e.clientY)) return; e.preventDefault();
      const mm = ev => move(ev.clientX, ev.clientY), mu = () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); end(); };
      window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    });
    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || e.target.closest('.ntb')) return; const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY }; clearTimeout(hold);
      hold = setTimeout(() => { if (t0 && begin(t0.x, t0.y)) { dragging = true; el.classList.add('dragging'); if (navigator.vibrate) navigator.vibrate(12); S.sel = st.idx; drawStaffs(); A().preview(st.orig, partInst(), { dur: 0.25 }); } }, 280);
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (dragging) { e.preventDefault(); move(t.clientX, t.clientY); }
      else if (t0 && Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 8) { clearTimeout(hold); t0 = null; }
    }, { passive: false });
    const tend = e => {
      clearTimeout(hold); t0 = null;
      if (dragging) { dragging = false; el.classList.remove('dragging'); const idx = st && st.idx; if (!end() && idx != null) { S.sel = idx; MS.render(); } suppressClick = Date.now(); if (e.cancelable) e.preventDefault(); }
    };
    el.addEventListener('touchend', tend); el.addEventListener('touchcancel', tend);
    el.addEventListener('contextmenu', e => { if (dragging || S.part === pid) e.preventDefault(); });
  }
  MS.drawStaffs = drawStaffs;
  window.addEventListener('resize', () => { if (S.screen === 'studio') drawStaffs(); });
  MS.a.staffTap = function (ev, pid) {
    if (Date.now() - suppressClick < 450 || ev.target.closest('.ntb') || !ev.target.closest('.staffbox')) return;
    const el = ev.currentTarget, svg = el.querySelector('svg'); if (!svg) return;
    const rect = svg.getBoundingClientRect(), map = el._map || maps[pid]; if (!map) return;
    const x = (ev.clientX - rect.left) * (map.width / rect.width), y = (ev.clientY - rect.top) * (map.H / rect.height);
    const hit = MSS.pick(map, x, y), s = S.song, ns = MS.notesOf(s.parts.find(p => p.id === pid)), used = MS.used(ns), len = MS.sec().bars * s.ts;
    const wasActive = S.part === pid; S.part = pid;
    if (S.ghostPick) S.ghostPick = null;
    if (hit.ghost && !hit.onHead) { S.ghostPick = { pid, g: hit.ghost }; S.sel = null; A().preview(hit.ghost.p, s.parts.find(p => p.id === pid).inst); if (wasActive) drawStaffs(); else MS.render(); return; }
    if (hit.noteIndex != null && wasActive) {
      const n = ns[hit.noteIndex];
      if (S.sel === hit.noteIndex && n.p != null && hit.midi !== n.p) { MS.change(() => { n.p = hit.midi; }); A().preview(hit.midi, partInst()); return; }
      S.sel = hit.noteIndex; if (n.p != null) A().preview(n.p, partInst()); MS.render(); return;
    }
    if (hit.beat >= used - 1e-6 && used < len) {
      MS.change(() => {
        // a tap far past the end (a later bar) leaves a rest; nearby taps add right after the last note
        const gapBar = Math.floor(hit.beat / s.ts) - Math.floor(used / s.ts);
        if (gapBar >= 2) ns.push({ p: null, d: Math.min(Math.floor(hit.beat / s.ts) * s.ts - used, len - used) });
        const room = len - MS.used(ns); if (room <= 0) return;
        ns.push({ p: hit.midi, d: Math.min(S.len, room) }); S.sel = ns.length - 1;
      });
      A().preview(hit.midi, partInst());
      return;
    }
    if (used >= len - 1e-6 && hit.beat >= used - 1e-6) { MS.toast('This section is full. Add bars, or select a note to change it.'); return; }
    // tapped inside existing music: select the note at that beat
    let b = 0, idx = 0; for (; idx < ns.length; idx++) { if (b + ns[idx].d > hit.beat + 1e-6) break; b += ns[idx].d; }
    S.sel = Math.min(idx, ns.length - 1); MS.render();
  };
  const partInst = () => MS.part().inst;
  function selNote() { const ns = MS.notesOf(MS.part()); return S.sel != null && ns[S.sel] ? ns[S.sel] : null; }
  MS.a.step = function (d) {
    const n = selNote(); if (!n || n.p == null) return;
    MS.change(s => { n.p = d === 'semi+' ? n.p + 1 : d === 'semi-' ? n.p - 1 : A().scaleStep(n.p, d, s.key); n.p = Math.max(28, Math.min(96, n.p)); });
    A().preview(n.p, partInst());
  };
  MS.a.len = function (d) {
    S.len = d; const n = selNote();
    if (n) MS.change(() => { n.d = d; }); else MS.render();
  };
  MS.a.toggleRest = function () {
    const n = selNote();
    if (n) MS.change(() => { if (n.p == null) n.p = MS.part().clef === 'bass' ? 48 : 67; else n.p = null; });
    else MS.a.addRest();
  };
  MS.a.addRest = function () {
    const ns = MS.notesOf(MS.part()), room = MS.sec().bars * S.song.ts - MS.used(ns);
    if (room <= 0) return MS.toast('This section is full.');
    MS.change(() => { ns.push({ p: null, d: Math.min(S.len, room) }); S.sel = null; });
  };
  MS.a.del = function () {
    const ns = MS.notesOf(MS.part()); if (S.sel == null || !ns[S.sel]) return;
    MS.change(() => { ns.splice(S.sel, 1); S.sel = ns.length ? Math.min(S.sel, ns.length - 1) : null; });
  };
  MS.a.insertBefore = function () {
    const ns = MS.notesOf(MS.part()), n = selNote(); if (!n) return;
    MS.change(() => { ns.splice(S.sel, 0, { p: n.p == null ? (MS.part().clef === 'bass' ? 48 : 67) : n.p, d: S.len }); });
  };
  MS.a.selMove = function (d) {
    const ns = MS.notesOf(MS.part()); if (!ns.length) return;
    S.sel = Math.max(0, Math.min(ns.length - 1, (S.sel == null ? 0 : S.sel + d))); const n = ns[S.sel]; if (n.p != null) A().preview(n.p, partInst());
    MS.render();
  };
  MS.a.deselect = () => { S.sel = null; MS.render(); };
  MS.a.keyNote = function (m) {
    const p = MS.part(); A().preview(m, p.inst, { dur: 0.4 });
    const n = selNote();
    if (n) { MS.change(() => { n.p = m; }); return; }
    const ns = MS.notesOf(p), room = MS.sec().bars * S.song.ts - MS.used(ns);
    if (room <= 0) return MS.toast('This section is full. Select a note to change it, or add bars.');
    MS.change(() => { ns.push({ p: m, d: Math.min(S.len, room) }); });
  };
  MS.a.names = v => { S.view.names = v; drawStaffs(); };

  // ---------- notes side card ----------
  function notesCard() {
    const n = selNote(), p = MS.part();
    const lens = lensFor().map(([d, name, g]) => `<button class="btn sm ${S.len === d ? 'on' : ''}" aria-pressed="${S.len === d}" onclick="MS.a.len(${d})" title="${name}">${MSS.icon(d)} ${name}</button>`).join('');
    return `<div class="card col"><div class="row" style="justify-content:space-between"><div class="label">Add notes to ${esc(p.name)}</div>${MS.helpBtn('addnotes')}</div>
      <div class="small" style="color:#ddd8cc">Tap a piano key, or tap the white staff, to add a note. Higher on the staff = higher sound.</div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><div class="label">Note length</div>${MS.helpBtn('lengths', '?')}</div><div class="row" style="gap:6px">${lens}</div>
      <div class="row" style="gap:6px"><button class="btn sm" onclick="MS.a.addRest()">Add a rest</button>${S.level !== 'Basic' ? `<label class="row tiny mod"><input type="checkbox" ${S.view.names !== false ? 'checked' : ''} onchange="MS.a.names(this.checked)"> Show note names</label>` : ''}</div>
      <div class="keys pk" aria-label="Piano keyboard"></div>
      <div class="tiny muted">Tap a key or the staff to add a note${n ? ', or to change the selected note' : ''}. To move a note, drag it up or down${'ontouchstart' in window ? ' (press and hold it first)' : ''}.</div>
      ${n ? `<div class="card tight col" style="background:var(--panel2)"><div class="row" style="justify-content:space-between"><b>Selected: ${n.p == null ? 'rest' : MSS.name(n.p, S.song.key)} · ${(LENS.find(l => l[0] === n.d) || [0, fmtBeats(n.d) + ' beats'])[1]}</b><button class="btn sm ghost" onclick="MS.a.deselect()">Done</button></div>
        <div class="row" style="gap:6px"><button class="btn sm" onclick="MS.a.step(1)" aria-label="Higher">▲ Higher</button><button class="btn sm" onclick="MS.a.step(-1)" aria-label="Lower">▼ Lower</button><button class="btn sm adv" onclick="MS.a.step('semi+')">♯</button><button class="btn sm adv" onclick="MS.a.step('semi-')">♭</button>
        <button class="btn sm" onclick="MS.a.selMove(-1)" aria-label="Previous note">◀</button><button class="btn sm" onclick="MS.a.selMove(1)" aria-label="Next note">▶</button></div>
        <div class="row" style="gap:6px"><button class="btn sm" onclick="MS.a.toggleRest()">${n.p == null ? 'Make it a note' : 'Make it a rest'}</button><button class="btn sm mod" onclick="MS.a.insertBefore()">Insert before</button><button class="btn sm" onclick="MS.a.del()">Delete</button></div>
        <div class="tiny muted">Tap a length above to change this note. Keyboard: arrows, Delete, R for rest.</div></div>` : ''}
    </div>`;
  }
  function drawKeys() { document.querySelectorAll('.keys.pk').forEach(drawKeysIn); }
  function drawKeysIn(el) {
    const p = MS.part(), low = p.clef === 'bass' ? 36 : 60, whites = [], blacks = [];
    for (let m = low; m < low + 25; m++) { const pc = m % 12; if ([1, 3, 6, 8, 10].includes(pc)) blacks.push(m); else whites.push(m); }
    const w = 100 / whites.length;
    el.innerHTML = whites.map(m => `<div class="w" data-m="${m}" role="button" aria-label="${MSS.name(m, 'C major')}${Math.floor(m / 12) - 1}">${S.level === 'Basic' ? MSS.name(m, 'C major') : (m % 12 === 0 ? 'C' + (Math.floor(m / 12) - 1) : '')}</div>`).join('') +
      blacks.map(m => { const i = whites.filter(x => x < m).length; return `<div class="b" data-m="${m}" role="button" aria-label="${MSS.name(m, S.song.key)}" style="left:calc(${i * w}% - ${w * 0.3}%);width:${w * 0.6}%"></div>`; }).join('');
    el.onpointerdown = e => { const k = e.target.closest('[data-m]'); if (!k) return; e.preventDefault(); k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 180); MS.a.keyNote(+k.dataset.m); };
  }

  // ---------- singing ----------
  let clickT = null;
  MS.a.sing = async function () {
    if (!MSP.supported()) return MS.toast('This browser cannot use the microphone.');
    if (MS._recording) {
      MS._recording = false; clearInterval(clickT);
      const rec = MSP.stop();
      MS.render();
      if (rec.data.length < rec.sampleRate * 0.3) return MS.toast('That was very short. Try again and sing a little longer.');
      const p = MS.part();
      const notes = MSP.transcribe(rec, { tempo: S.song.tempo, key: S.song.key, snap: true, range: p.clef === 'bass' ? 'bass' : 'treble', grid: S.level === 'Advanced' ? 0.25 : 0.5 });
      MS._heard = { notes, raw: rec };
      return showHeard();
    }
    try {
      A().stop();
      await MSP.start(lv => { document.querySelectorAll('.lvl i').forEach(i => { i.style.width = Math.min(100, lv * 400) + '%'; }); });
      MS._recording = true; MS.render();
      if (MS._click) { let n = 0; A().click(true); clickT = setInterval(() => { n++; A().click(n % S.song.ts === 0); }, 60000 / S.song.tempo); }
    } catch (e) { MS.toast('Microphone blocked. Allow the mic in your browser settings and try again.'); }
  };
  function showHeard() {
    const h = MS._heard, p = MS.part(), s = S.song;
    if (!h.notes.length) { MS.toast("I couldn't hear clear notes. Sing louder and slower, one note at a time, in a quiet room."); return; }
    const bars = Math.max(1, Math.ceil(MS.used(h.notes) / s.ts));
    const r = MSS.render({ notes: h.notes, clef: p.clef, key: s.key, ts: s.ts, bars: Math.min(bars, 8), width: 900, names: true, paper: S.paper, color: MS.noteColor(p) });
    MS.modal(`<h2>Here's what I heard</h2><div class="col" style="margin-top:12px">${r.svg}
      <div class="small muted">${h.notes.filter(n => n.p != null).length} notes. Notes were moved into the key of ${esc(s.key)} and lined up to the beat.</div>
      <div class="row"><button class="btn" onclick="MSA.previewSequence(MS._heard.notes,MS.part().inst,MS.S.song.tempo)">▶ Hear it</button>
      <button class="btn primary" onclick="MS.a.keepHeard()">Keep (add to ${esc(p.name)})</button><button class="btn" onclick="MS.closeModal();MS.a.sing()">Redo</button><button class="btn ghost" onclick="MS.closeModal()">Cancel</button></div>
      <div class="tiny muted">Not quite right? Keep it, then tap any note to fix it.</div></div>`);
  }
  MS.a.keepHeard = function () {
    const h = MS._heard; MS.closeModal();
    MS.change(s => {
      const p = MS.part(), ns = MS.notesOf(p), len = MS.sec().bars * s.ts;
      let room = len - MS.used(ns); let added = 0;
      for (const n of h.notes) { if (room <= 0) break; const d = Math.min(n.d, room); ns.push({ p: n.p, d }); room -= d; added++; }
      if (added < h.notes.length) { MS.toast('The section filled up, so some notes were left off. Add bars or a new section.'); }
      // trim leading rest if section was empty
      if (ns.length && ns[0].p == null && ns.length === added) ns.shift();
    });
  };

  // ---------- chords ----------
  function chordsCard() {
    const s = S.song, sec = MS.sec(), list = s.chords[sec.id] || [], cp = s.chordPart;
    const bars = Array.from({ length: sec.bars }, (_, i) => `<button class="btn sm" style="min-width:64px" onclick="MS.a.pickChord(${i})">${esc(list[i] || '—')}</button>`).join('');
    return `<div class="card col mod"><div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><div class="label">Chords · ${esc(sec.name)}</div>${MS.helpBtn('chords')}</div><div class="row"><button class="btn sm" onclick="MS.a.autoChords()">Suggest chords</button><button class="btn sm" onclick="MS.a.autoChords(true)">For every section</button></div></div>
      <div class="row" style="gap:6px">${bars}</div>
      <div class="row"><label class="row small"><input type="checkbox" ${cp.on ? 'checked' : ''} onchange="MS.change(x=>x.chordPart.on=this.checked)"> Play the chords</label>
      ${cp.on ? `<button class="btn sm ghost" onclick="MS.a.pickInst('chords')">${esc(cp.inst)}${A().INST[cp.inst] && A().INST[cp.inst].ens ? (cp.ens === 'section' ? ' · section' : ' · soloist') : ''} ▾</button>
      <label class="f" style="min-width:140px">Style<select onchange="MS.change(x=>x.chordPart.style=this.value)">${['Block', 'Sustained', 'Arpeggio', 'Strum'].map(k => `<option ${cp.style === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="row small adv"><input type="checkbox" ${cp.bass ? 'checked' : ''} onchange="MS.change(x=>x.chordPart.bass=this.checked)"> Add root bass</label>` : ''}</div>
      <div class="tiny muted">One chord per bar. Chords show above the melody and on your sheet music.</div></div>`;
  }
  MS.a.pickChord = function (bar) {
    const s = S.song, dia = A().diatonicChords(s.key), k = A().KEYS[s.key];
    const extra = [A().NAMES[(k + 7) % 12] + '7', A().NAMES[(k + 2) % 12] + '7', A().NAMES[(k + 5) % 12] + 'maj7', A().NAMES[(k + 9) % 12] + 'm7', A().NAMES[(k + 2) % 12] + 'm7', A().NAMES[(k + 10) % 12], A().NAMES[(k + 7) % 12] + 'sus4'];
    MS.modal(`<h2>Chord for bar ${bar + 1}</h2><div class="col" style="margin-top:12px"><div class="label">In the key of ${esc(s.key)}</div>
      <div class="row">${dia.slice(0, 6).map(c => `<button class="btn" onclick="MS.a._setChord(${bar},'${c}')" onmouseenter="MS.a._hearChord('${c}')">${c}</button>`).join('')}</div>
      <div class="label mod">More color</div><div class="row mod">${extra.map(c => `<button class="btn" onclick="MS.a._setChord(${bar},'${c}')">${c}</button>`).join('')}</div>
      <div class="row"><button class="btn" onclick="MS.a._setChord(${bar},'')">No chord</button><button class="btn ghost" onclick="MS.closeModal()">Cancel</button></div></div>`);
  };
  MS.a._hearChord = c => { const t = A().chordTones(c); if (!t) return; t.tones.forEach(x => A().preview(60 + x, 'Grand piano', { dur: 0.6, vel: 0.5 })); };
  MS.a._setChord = function (bar, c) { MS.closeModal(); MS.change(s => { const l = s.chords[S.sec] = s.chords[S.sec] || []; l[bar] = c; }); if (c) MS.a._hearChord(c); };
  MS.a.autoChords = function (all) {
    MS.change(s => { (all ? s.sections : [MS.sec()]).forEach(x => { s.chords[x.id] = MS.suggestChords(s, x.id); }); s.chordPart.on = true; });
    MS.toast('Chords suggested from your melody. Tap any chord to change it.');
  };

  // ---------- transport ----------
  function transport() {
    return `<div class="card tight row" style="justify-content:space-between"><div class="row" style="gap:6px">
      <button class="btn primary" onclick="MS.a.playSection()">▶ Play ${esc(MS.sec().name)}</button><button class="btn" onclick="MS.a.play(false)">▶ Play song</button><button class="btn" onclick="MS.a.stop()">■ Stop</button>
      <button class="btn sm mod" aria-pressed="${loop}" style="${loop ? 'background:var(--teal);color:#06201d' : ''}" onclick="MS.a.loop()">Loop</button><button class="btn sm adv" aria-pressed="${countIn}" style="${countIn ? 'background:var(--teal);color:#06201d' : ''}" onclick="MS.a.countIn()">Count-in</button></div>
      <div class="row" style="gap:6px">${MS.helpBtn('transport', '?')}<button class="btn sm" onclick="MS.undo()">Undo</button><button class="btn sm" onclick="MS.redo()">Redo</button></div></div>`;
  }
  MS.a.loop = () => { loop = !loop; MS.render(); };
  MS.a.countIn = () => { countIn = !countIn; MS.render(); };
  MS.a.playSection = function () { startPlay({ section: S.sec, countIn }); };
  MS.a.play = function () { startPlay({ countIn }); };
  MS.a.playPart = function (id) {
    const p = S.song.parts.find(x => x.id === id);
    const song = Object.assign({}, MS.playable(), { parts: [Object.assign({}, p, { mute: false, solo: false })], drums: { style: 'None' }, chordPart: { on: false }, vocals: Object.assign({}, S.song.vocals, { leadBuffer: null, bgv: { on: false } }) });
    startPlay({ section: S.sec }, song);
  };
  MS.a.stop = stop;
  function stop() { A().stop(); cancelAnimationFrame(raf); raf = null; if (S.screen === 'studio') drawStaffs(); }
  function startPlay(opts, song) {
    const sng = song || MS.playable();
    const h = A().play(sng, opts); const secId = opts.section;
    cancelAnimationFrame(raf); lastDrawn = -1;
    const tl = A().timeline(S.song);
    const tick = () => {
      const b = A().playhead();
      if (b == null) {
        if (loop && secId) { startPlay(opts, song); return; }
        raf = null; if (S.screen === 'studio') drawStaffs(); return;
      }
      if (S.screen === 'studio') {
        let local = b, sid = secId;
        if (!secId) { const x = tl.secs.find(z => b >= z.start && b < z.start + z.len) || tl.secs[tl.secs.length - 1]; sid = x.sec.id; local = b - x.start; if (follow && sid !== S.sec && b >= 0) { S.sec = sid; S.sel = null; MS.render(); } }
        const q = Math.floor(local * 4) / 4;
        if (q !== lastDrawn && sid === S.sec) { lastDrawn = q; drawStaffs(local >= 0 ? local : null); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  MS.startPlay = startPlay;
  let taps = [];
  MS.a.tapTempo = function () {
    const t = performance.now(); taps = taps.filter(x => t - x < 3000); taps.push(t); A().click(taps.length === 1);
    if (taps.length >= 4) { const gaps = taps.slice(1).map((x, i) => x - taps[i]); const bpm = Math.round(60000 / (gaps.reduce((a, b) => a + b) / gaps.length)); taps = []; MS.change(s => { s.tempo = Math.max(40, Math.min(200, bpm)); }); MS.toast('Tempo set to ' + S.song.tempo + ' BPM'); }
    else MS.toast('Keep tapping… ' + (4 - taps.length) + ' more', 900);
  };
  MS.a.key = async function (k) {
    const old = S.song.key; if (k === old) return;
    const shift = ((A().KEYS[k] - A().KEYS[old]) + 18) % 12 - 6;
    const ans = await MS.ask('Change the key to ' + k + '?', 'Moving your notes keeps the song sounding the same, just higher or lower. Or keep every note where it is and only change the key signature.', [['Move my notes and chords', 'move', 'primary'], ['Only change the key signature', 'sig', ''], ['Cancel', null, '']]);
    if (!ans) { MS.render(); return; }
    const move = ans === 'move';
    MS.change(s => {
      s.key = k;
      if (move) {
        s.parts.forEach(p => Object.values(p.notes).forEach(a => a.forEach(n => { if (n.p != null) n.p += shift; })));
        Object.keys(s.chords).forEach(id => { s.chords[id] = (s.chords[id] || []).map(c => { const t = A().chordTones(c); return t ? A().NAMES[(t.root + shift + 12) % 12] + t.q : c; }); });
      }
    });
  };
  MS.a.ts = function (ts) { MS.change(s => { s.ts = ts; if (ts === 3 && !['None', 'Waltz', 'Jazz swing'].includes(s.drums.style)) s.drums.style = 'Waltz'; }); };

  // ---------- sound, drums, mixer ----------
  function soundCard() {
    const p = MS.part(), d = S.song.drums;
    const sl = (label, key, val, min, max, step) => `<label class="f">${label}<input type="range" min="${min}" max="${max}" step="${step}" value="${val}" onchange="MS.a.partSet('${p.id}','${key}',+this.value)"></label>`;
    return `<div class="card col mod"><div class="row" style="justify-content:space-between"><div class="label">Sound · ${esc(p.name)}</div>${MS.helpBtn('sound')}</div>
      ${sl('Volume', 'vol', p.vol, 0, 1, 0.05)}${sl('Echo', 'echo', p.echo, 0, 0.8, 0.05)}${sl('Reverb (room size)', 'rev', p.rev, 0, 1, 0.05)}
      <div class="adv">${sl('Left · Right', 'pan', p.pan, -1, 1, 0.1)}</div>
      <div class="adv col"><div class="label">Loudness in ${esc(MS.sec().name)}</div>${MS.seg(['p', 'mf', 'f'], p.dyn[S.sec] || 'mf', `MS.a.dyn('${p.id}',`)}<div class="tiny muted">p = soft, mf = medium, f = loud</div></div></div>`;
  }
  MS.a.partSet = (id, k, v) => MS.change(s => { s.parts.find(x => x.id === id)[k] = v; }, { quiet: true });
  MS.a.dyn = (id, v) => MS.change(s => { s.parts.find(x => x.id === id).dyn[S.sec] = v; });
  function drumsCard() {
    const d = S.song.drums, pc = S.song.perc, any = Object.keys(pc.on).some(k => pc.on[k]);
    return `<div class="card col"><div class="row" style="justify-content:space-between"><div class="label">Drums</div>${MS.helpBtn('drums')}</div>
      <label class="f">Beat<select onchange="MS.change(x=>x.drums.style=this.value)">${Object.keys(A().DRUMS).map(k => `<option ${d.style === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      ${d.style !== 'None' ? `<label class="f">Drum volume<input type="range" min="0" max="1" step="0.05" value="${d.vol}" onchange="MS.change(x=>x.drums.vol=+this.value,{quiet:true})"></label>
      <label class="row small mod"><input type="checkbox" ${d.skip[S.sec] ? 'checked' : ''} onchange="MS.change(x=>{x.drums.skip[MS.S.sec]=this.checked})"> No drums in ${esc(MS.sec().name)}</label>` : '<div class="tiny muted">Pick a beat to add drums under your song.</div>'}
      <div class="mod col" style="gap:8px"><div class="row" style="justify-content:space-between;margin-top:6px"><div class="label">Extra percussion</div>${MS.helpBtn('perc', '?')}</div>
      <div class="seg">${Object.entries(A().PERC).map(([k, v]) => `<button type="button" class="pill ${pc.on[k] ? 'on' : ''}" aria-pressed="${!!pc.on[k]}" onclick="MS.a.perc('${k}')">${esc(v.name)}</button>`).join('')}</div>
      ${any ? `<label class="f">Percussion volume<input type="range" min="0" max="1" step="0.05" value="${pc.vol}" onchange="MS.change(x=>x.perc.vol=+this.value,{quiet:true})"></label><div class="tiny muted">They play all the way through. Pick sections on the build grid in the 🎚 Control Room.</div>` : '<div class="tiny muted">Tap one to hear it and add it. Works with or without a drum beat.</div>'}</div></div>`;
  }
  MS.a.perc = function (k) { const was = !!S.song.perc.on[k]; MS.change(s => { s.perc.on[k] = !was; }); if (!was) A().hearPerc(k); if (MS._pick && document.querySelector('.modal')) renderPicker(); };
  function mixer() {
    const s = S.song;
    const strip = (name, color, obj, path) => `<div class="strip" style="border-top:3px solid ${color}"><b style="color:var(--ink)">${esc(name)}</b>
      ${['vol', 'echo', 'rev', 'pan'].map(k => `<label>${{ vol: 'Volume', echo: 'Echo', rev: 'Reverb', pan: 'Left · Right' }[k]}<input type="range" min="${k === 'pan' ? -1 : 0}" max="1" step="0.05" value="${obj[k] || 0}" onchange="MS.a.mix('${path}','${k}',+this.value)"></label>`).join('')}</div>`;
    return `<div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="label">Mixer</div>${MS.helpBtn('mixer')}</div><div class="mixer">${s.parts.map(p => strip(p.name + ' · ' + p.inst, p.color, p, 'p:' + p.id)).join('')}
      ${s.chordPart.on ? strip('Chords · ' + s.chordPart.inst, '#d9d4c8', s.chordPart, 'chords') : ''}
      ${MS.vbuf ? strip('Lead vocal', '#f08a6b', s.vocals, 'vocal') : ''}
      ${s.drums.style !== 'None' ? `<div class="strip" style="border-top:3px solid #888"><b style="color:var(--ink)">Drums · ${esc(s.drums.style)}</b><label>Volume<input type="range" min="0" max="1" step="0.05" value="${s.drums.vol}" onchange="MS.change(x=>x.drums.vol=+this.value,{quiet:true})"></label></div>` : ''}</div>
      <div class="tiny muted" style="margin-top:8px">Background singers are set in the Vocal Room.</div>`;
  }
  MS.a.mix = function (path, k, v) {
    MS.change(s => { const o = path === 'chords' ? s.chordPart : path === 'vocal' ? s.vocals : s.parts.find(p => 'p:' + p.id === path); o[k] = v; }, { quiet: true });
  };

  // ---------- instrument picker ----------
  // a short list that fits the song's style first; everything else is one tap away
  const FOCUS = {
    '': ['Grand piano', 'Acoustic guitar', 'Electric guitar', 'Violins', 'Cellos', 'Flute', 'Trumpet', 'Synth', 'Choir', 'Bass guitar'],
    'Pop': ['Grand piano', 'Electric piano', 'Synth', 'Acoustic guitar', 'Electric guitar', 'Violins', 'Choir', 'Bass guitar'],
    'R&B': ['Electric piano', 'Grand piano', 'Organ', 'Synth', 'Choir', 'Violins', 'Trumpet', 'Bass guitar'],
    'Rock': ['Electric guitar', 'Organ', 'Grand piano', 'Synth', 'Acoustic guitar', 'Bass guitar'],
    'Jazz swing': ['Grand piano', 'Trumpet', 'Trombone', 'Clarinet', 'Electric piano', 'Organ', 'Acoustic guitar', 'Double bass'],
    'Classical': ['Violins', 'Violas', 'Cellos', 'Harp', 'Flute', 'Oboe', 'Clarinet', 'French horn', 'Grand piano', 'Double bass'],
    'Full orchestra': ['Violins', 'Violas', 'Cellos', 'French horn', 'Trumpet', 'Trombone', 'Flute', 'Oboe', 'Harp', 'Timpani', 'Choir', 'Tuba'],
    'Country': ['Acoustic guitar', 'Fiddle', 'Banjo', 'Harmonica', 'Grand piano', 'Electric guitar', 'Bass guitar'],
    'Hip-hop': ['Synth', 'Electric piano', 'Grand piano', 'Organ', 'Choir', 'Bass guitar'],
    'Soft ballad': ['Grand piano', 'Violins', 'Cellos', 'Acoustic guitar', 'Flute', 'Harp', 'Choir'],
    'March': ['Trumpet', 'French horn', 'Trombone', 'Flute', 'Clarinet', 'Glockenspiel', 'Tuba', 'Timpani'],
    'World': ['Spanish guitar', 'Marimba', 'Sitar', 'Bansuri', 'Steel drums', 'Koto', 'Kalimba', 'Accordion']
  };
  const BASSY = ['Bass guitar', 'Double bass', 'Cellos', 'Tuba', 'Bassoon', 'Synth', 'Grand piano', 'Timpani'];
  function focusList(k) {
    const style = (S.song.style || '').split(' · ')[0], tp = S.song.parts.find(p => p.id === k.pid);
    let list = tp && tp.role === 'bass' ? BASSY : (FOCUS[style] || FOCUS['']);
    if (!list.includes(k.inst)) list = [k.inst].concat(list);
    return { list, label: tp && tp.role === 'bass' ? 'Good for a bass part' : style ? 'Suggested for ' + style : 'Suggested sounds' };
  }
  MS.a.pickInst = function (pid) {
    const target = pid === 'chords' ? S.song.chordPart : pid.startsWith('L:') ? S.song.layers.find(L => 'L:' + L.id === pid) : S.song.parts.find(p => p.id === pid);
    MS._pick = { pid, inst: target.inst, ens: target.ens || 'solo', size: target.size || 'Chamber (12)', artic: target.artic || 'legato', view: (A().INST[target.inst] || {}).family === 'World' ? 'world' : 'focus' };
    renderPicker();
  };
  MS.a._piView = v => { MS._pick.view = v; renderPicker(); };
  const instBtn = (n, k) => `<button class="btn sm" style="${n === k.inst ? 'border-color:var(--amber);background:#2a2210' : ''}" onclick="MS.a._pi('inst',${esc(JSON.stringify(n))})">${esc(n)}</button>`;
  function renderPicker() {
    const k = MS._pick, I = A().INST[k.inst] || {}, f0 = focusList(k), pc = S.song.perc.on;
    const tabs = `<div class="seg" role="tablist" style="margin-top:10px">${[['focus', f0.label], ['all', 'More sounds'], ['world', '🌍 World sounds']].map(([v, t]) => `<button type="button" class="pill ${k.view === v ? 'on' : ''}" aria-pressed="${k.view === v}" onclick="MS.a._piView('${v}')">${esc(t)}</button>`).join('')}</div>`;
    const fam = k.view === 'focus' ? `<div class="card tight col"><b>${esc(f0.label)}</b><div class="row" style="gap:6px">${f0.list.map(n => instBtn(n, k)).join('')}</div><div class="tiny muted">Looking for something else? Tap More sounds or 🌍 World sounds.</div></div>`
      : k.view === 'world' ? A().REGIONS.map(r => { const ins = Object.entries(A().INST).filter(([, v]) => v.region === r).map(([n]) => n), pr = A().REGION_PERC[r] || [];
          return `<div class="card tight col"><b>${esc(r)}</b><div class="row" style="gap:6px">${ins.map(n => instBtn(n, k)).join('')}</div>${pr.length ? `<div class="row tiny muted" style="gap:6px">Drums from here: ${pr.map(x => `<button class="btn sm ghost" aria-pressed="${!!pc[x]}" onclick="MS.a.perc('${x}')">${pc[x] ? '✓ ' : '+ '}${esc(A().PERC[x].name)}</button>`).join('')}</div>` : ''}</div>`; }).join('') + '<div class="tiny muted">World sounds are built-in approximations, not recordings of the real instruments.</div>'
      : A().FAMILIES.map(f => `<div class="card tight col"><b>${f}</b><div class="row" style="gap:6px">${Object.entries(A().INST).filter(([, v]) => v.family === f).map(([n]) => instBtn(n, k)).join('')}</div></div>`).join('');
    const target = k.pid === 'chords' ? 'Chords' : k.pid.startsWith('L:') ? (S.song.layers.find(L => 'L:' + L.id === k.pid) || {}).name : (S.song.parts.find(p => p.id === k.pid) || {}).name;
    MS.modal(`<div class="row" style="justify-content:space-between"><h2>Pick an instrument for ${esc(target)}</h2><div class="row">${MS.helpBtn('instruments')}<button class="btn sm ghost" onclick="MS.closeModal()">Close</button></div></div>
      ${tabs}<div class="split" style="margin-top:12px"><div class="main"><div class="grid">${fam}</div></div>
      <div class="side"><div class="card col"><div class="label">${esc(k.inst)}</div>
      ${I.ens ? `<div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">
        <button class="opt lesson-card ${k.ens === 'section' ? 'on' : ''}" onclick="MS.a._pi('ens','section')"><b>Section</b><span class="tiny" style="color:#ddd8cc">Many playing together. Rich and full.</span></button>
        <button class="opt lesson-card ${k.ens === 'solo' ? 'on' : ''}" onclick="MS.a._pi('ens','solo')"><b>Soloist</b><span class="tiny" style="color:#ddd8cc">One player out front. Clear and personal.</span></button></div>
        ${k.ens === 'section' ? `<div class="label">Section size</div>${MS.seg(Object.keys(A().SIZES), k.size, "MS.a._pi('size',")}` : ''}` : '<div class="small muted">This instrument plays on its own.</div>'}
      ${I.kind === 'strings' ? `<div class="label">How they play</div>${MS.seg(['legato', 'pizzicato', 'tremolo'], k.artic, "MS.a._pi('artic',")}<div class="tiny muted">legato = smooth, pizzicato = plucked, tremolo = shimmering</div>` : ''}
      <div class="row"><button class="btn" onclick="MS.a._hearInst()">▶ Hear it</button></div>
      <button class="btn primary" onclick="MS.a._useInst()">Use ${esc(k.inst)}${I.ens ? (k.ens === 'section' ? ' section' : ' soloist') : ''}</button></div>
      <div class="card col"><div class="label">Tip</div><div class="small" style="color:#ddd8cc">A classic mix: a <b>soloist</b> plays the melody while a <b>section</b> plays the harmony underneath.</div></div></div></div>
      <div class="tiny muted" style="margin-top:10px">Instrument sounds are built in. They sound good, not like a real recorded orchestra.</div>`);
  }
  MS.a._pi = function (k, v) { MS._pick[k] = v; if (k === 'inst') { const I = A().INST[v]; MS._pick.ens = I.ens ? (/Violins|Violas|Cellos|Choir/.test(v) ? 'section' : 'solo') : 'solo'; } renderPicker(); if (k !== 'size') MS.a._hearInst(); };
  MS.a._hearInst = function () {
    const k = MS._pick, bass = /Double bass|Cellos|Tuba|Bass guitar|Bassoon|Trombone|Timpani/.test(k.inst), b = bass ? 43 : /Tanpura/.test(k.inst) ? 48 : 60;
    A().previewSequence([{ p: b, d: 1 }, { p: b + 4, d: 1 }, { p: b + 7, d: 1 }, { p: b + 12, d: 2 }], k.inst, 100, { solo: k.ens !== 'section', voices: A().SIZES[k.size] || 5, artic: k.artic });
  };
  MS.a._useInst = function () {
    const k = MS._pick; MS._pick = null; MS.closeModal();
    MS.change(s => { const t = k.pid === 'chords' ? s.chordPart : k.pid.startsWith('L:') ? s.layers.find(L => 'L:' + L.id === k.pid) : s.parts.find(p => p.id === k.pid); Object.assign(t, { inst: k.inst, ens: k.ens, size: k.size, artic: k.artic }); });
  };
})();
