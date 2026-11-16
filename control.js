/* The Control Room — the engineer's and producer's room: background layers, build grid, mixing board, master (post-production). */
(function () {
  const MS = window.MS, S = MS.S, A = () => window.MSA, esc = MS.esc;
  const LCOL = ['#9ad17a', '#e88bd0', '#7fd4f0', '#f5d36b', '#c9a7ff', '#ff9f80', '#8ee0c0', '#d0d0d0'];
  const PRESETS = {
    'Organ pad': { inst: 'Organ', style: 'Pad', ens: 'solo', d: 'Warm held chords. Church, gospel, soul.' },
    'String pad': { inst: 'Violins', style: 'Pad', ens: 'section', size: 'Chamber (12)', d: 'A string section holding the chords. Lush and cinematic.' },
    'Piano arpeggio': { inst: 'Grand piano', style: 'Arpeggio', ens: 'solo', d: 'Flowing broken chords. Ballads.' },
    'Guitar strum': { inst: 'Acoustic guitar', style: 'Strum', ens: 'solo', d: 'A strum on every beat. Folk, country, pop.' },
    'Synth pulse': { inst: 'Synth', style: 'Pulse', ens: 'solo', d: 'Driving eighth notes. Pop and dance.' },
    'Choir ooh': { inst: 'Choir', style: 'Pad', ens: 'section', vowel: 'ooh', d: 'Soft voices holding the chords.' },
    'Harp arpeggio': { inst: 'Harp', style: 'Arpeggio', ens: 'solo', d: 'Sparkling rippled chords.' },
    'Brass swells': { inst: 'French horn', style: 'Pad', ens: 'section', size: 'Chamber (12)', d: 'Big, noble held chords.' },
    'Electric piano': { inst: 'Electric piano', style: 'Block', ens: 'solo', d: 'Soft R&B chords on beats 1 and 3.' },
    'Low drone': { inst: 'Cellos', style: 'Drone', ens: 'section', octave: -1, d: 'One deep note per bar under everything.' }
  };
  MS.LAYER_PRESETS = PRESETS;
  let raf = null;

  function ensure(s) {
    s.layers = s.layers || []; s.master = Object.assign({ vol: 0.9, punch: 0, room: 'Studio', fadeIn: 0, fadeOut: 0, bypass: false }, s.master || {});
    s.vocals.bgvMix = s.vocals.bgvMix || { vol: 0.8, rev: 0.5, echo: 0.1, pan: 0 };
    return s;
  }
  MS.addLayer = function (s, name) {
    ensure(s); const p = PRESETS[name]; if (!p) return null;
    s.sections.forEach(x => { if (!(s.chords[x.id] || []).some(Boolean)) s.chords[x.id] = MS.suggestChords(s, x.id); });
    const L = { id: MS.id('L'), name, inst: p.inst, style: p.style, ens: p.ens, size: p.size || 'Chamber (12)', vowel: p.vowel, octave: p.octave || 0, vol: 0.55, pan: 0, echo: 0, rev: 0.4, bass: 0, treble: 0, mute: false, solo: false, off: {}, color: LCOL[s.layers.length % LCOL.length] };
    s.layers.push(L); return L;
  };

  // every channel on the board, in one list
  function channels(s) {
    const out = s.parts.map(p => ({ key: p.id, name: p.name, sub: p.inst + (p.ens === 'section' ? ' section' : ''), color: p.color, obj: p, path: 'p:' + p.id, grid: true }));
    if (s.chordPart.on) out.push({ key: 'chords', name: 'Chords', sub: s.chordPart.inst, color: '#d9d4c8', obj: s.chordPart, path: 'chords', grid: true });
    s.layers.forEach(L => out.push({ key: L.id, name: L.name, sub: L.inst + ' · ' + L.style, color: L.color, obj: L, path: 'L:' + L.id, grid: true, layer: true }));
    if (s.drums.style !== 'None') out.push({ key: 'drums', name: 'Drums', sub: s.drums.style, color: '#9aa0ad', obj: s.drums, path: 'drums', grid: true });
    if (s.vocals.bgv.on) out.push({ key: 'bgv', name: 'Background singers', sub: s.vocals.bgv.count + ' · ' + s.vocals.bgv.type, color: '#b39dfa', obj: s.vocals.bgvMix, path: 'bgv', grid: true });
    if (MS.vbuf) out.push({ key: 'vocal', name: 'Lead vocal', sub: 'Your voice', color: '#f08a6b', obj: s.vocals, path: 'vocal', grid: true });
    return out;
  }
  function objOf(s, path) {
    if (path === 'chords') return s.chordPart; if (path === 'drums') return s.drums; if (path === 'bgv') return s.vocals.bgvMix; if (path === 'vocal') return s.vocals;
    if (path.startsWith('L:')) return s.layers.find(L => 'L:' + L.id === path);
    return s.parts.find(p => 'p:' + p.id === path);
  }
  // is a channel playing in a section? (grid cell)
  function isOn(s, c, secId) {
    if (c.key === 'drums') return !(s.drums.skip || {})[secId];
    if (c.key === 'bgv') { const g = s.vocals.bgv; return g.where === 'Every section' || (g.where === 'Chorus only' ? /chorus/i.test(s.sections.find(x => x.id === secId).name) : (g.picked || []).includes(secId)); }
    if (c.key === 'vocal') return !(s.vocals.off || {})[secId];
    return !(c.obj.off || {})[secId];
  }
  MS.a.cell = function (path, secId) {
    MS.change(s => {
      ensure(s);
      if (path === 'drums') { s.drums.skip[secId] = !s.drums.skip[secId]; return; }
      if (path === 'bgv') { const g = s.vocals.bgv; const cur = s.sections.filter(x => isOn(s, { key: 'bgv' }, x.id)).map(x => x.id); g.where = 'Pick sections'; const i = cur.indexOf(secId); i < 0 ? cur.push(secId) : cur.splice(i, 1); g.picked = cur; return; }
      if (path === 'vocal') { s.vocals.off = s.vocals.off || {}; s.vocals.off[secId] = !s.vocals.off[secId]; return; }
      const o = objOf(s, path); o.off = o.off || {}; o.off[secId] = !o.off[secId];
    });
  };

  MS.screens.control = {
    html() {
      if (!S.song) MS.setSong(MS.blankSong());
      const s = ensure(S.song), M = s.master, ch = channels(s), adv = S.level === 'Advanced', basic = S.level === 'Basic';
      return `<div class="row small muted" style="margin-bottom:10px"><a href="#" onclick="MS.go('studio');return false">Studio</a><span>›</span><span style="color:var(--ink)">The Control Room</span><span style="margin-left:auto">“${esc(s.title)}” · ${esc(s.key)} · ${s.tempo} BPM</span></div>
      <div class="card col" style="border-color:#3d4a5c;background:linear-gradient(180deg,#1b2029,#1d1f25)"><div class="row" style="justify-content:space-between"><div><h1 style="font-size:28px">The Control Room</h1><div class="small muted">Where the engineer and producer work: production and post-production.</div></div><div class="row">${MS.helpBtn('control', '? How the Control Room works')}</div></div>
        <div class="row"><button class="btn primary" onclick="MS.a.crPlay()">▶ Play song</button><select class="btn" onchange="MS.a.crPlay(this.value);this.selectedIndex=0" aria-label="Play one section"><option>▶ Play a section…</option>${s.sections.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select><button class="btn" onclick="MS.a.crStop()">■ Stop</button>
        <div class="grow" style="min-width:180px"><div class="tiny muted">Master level</div><div class="meter" style="height:12px"><i data-meter="master" style="background:linear-gradient(90deg,#4fc3b8,#f2b33d 70%,#f08a6b)"></i></div></div></div></div>

      <div class="card col" style="margin-top:12px"><div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><div class="label">1 · Background layers</div>${MS.helpBtn('layers')}</div><button class="btn sm primary" onclick="MS.a.layerMenu()">+ Add a layer</button></div>
        ${s.layers.length ? `<div class="grid">${s.layers.map(L => `<div class="opt" style="border-left:4px solid ${L.color}"><div class="row" style="justify-content:space-between"><b>${esc(L.name)}</b><button class="btn sm ghost" onclick="MS.a.delLayer('${L.id}')" aria-label="Remove layer">✕</button></div>
          <div class="row" style="gap:6px"><button class="btn sm" onclick="MS.a.pickInst('L:${L.id}')">${esc(L.inst)}${A().INST[L.inst] && A().INST[L.inst].ens ? (L.ens === 'section' ? ' · section' : ' · soloist') : ''} ▾</button>
          <select class="btn sm" aria-label="Pattern" onchange="MS.a.layerSet('${L.id}','style',this.value)">${['Pad', 'Arpeggio', 'Strum', 'Pulse', 'Block', 'Drone'].map(k => `<option ${L.style === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
          <select class="btn sm mod" aria-label="Octave" onchange="MS.a.layerSet('${L.id}','octave',+this.value)">${[[-1, 'Low'], [0, 'Middle'], [1, 'High']].map(([v, t]) => `<option value="${v}" ${(L.octave || 0) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="tiny muted">Follows your chords. Turn it on or off per section in the build grid.</div></div>`).join('')}</div>`
          : `<div class="small" style="color:#ddd8cc">No layers yet. Layers are background music that follows your chords: an organ pad under the verse, a string section in the chorus, a guitar strum all the way through.</div>`}
      </div>

      <div class="card col" style="margin-top:12px"><div class="row" style="gap:6px"><div class="label">2 · Build grid</div>${MS.helpBtn('grid')}</div>
        <div class="small muted">Tap a square to turn that sound on or off in that section. Songs often start small and get bigger.</div>
        <div style="overflow-x:auto"><table style="border-collapse:separate;border-spacing:4px"><thead><tr><th></th>${s.sections.map(x => `<th class="tiny" style="color:#15130d;background:${MS.SEC_COLOR(x.name)};border-radius:6px;padding:6px 8px;white-space:nowrap">${esc(x.name)}</th>`).join('')}</tr></thead>
        <tbody>${ch.filter(c => c.grid).map(c => `<tr><td class="small" style="white-space:nowrap;padding-right:8px"><span class="dot" style="background:${c.color}"></span> ${esc(c.name)}</td>${s.sections.map(x => { const on = isOn(s, c, x.id); return `<td><button class="btn sm" style="width:100%;min-width:56px;${on ? `background:${c.color};color:#15130d;border-color:${c.color}` : ''}" aria-pressed="${on}" aria-label="${esc(c.name)} in ${esc(x.name)}" onclick="MS.a.cell('${c.path}','${x.id}')">${on ? 'On' : '—'}</button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="row"><button class="btn sm" onclick="MS.a.buildUp()">Build it up for me</button><span class="tiny muted">Fewer sounds early, everything in the last chorus.</span></div></div>

      <div class="card col" style="margin-top:12px"><div class="row" style="gap:6px"><div class="label">3 · Mixing board</div>${MS.helpBtn('board')}</div>
        <div class="mixer" style="grid-template-columns:repeat(auto-fill,minmax(${adv ? 190 : 160}px,1fr))">${ch.map(c => strip(c, basic, adv)).join('')}</div>
        <div class="tiny muted">Move the melody or your voice a little above everything else. Solo plays one channel alone; Mute silences it.</div></div>

      <div class="card col" style="margin-top:12px;border-color:#3d4a5c"><div class="row" style="gap:6px"><div class="label">4 · Master (post-production)</div>${MS.helpBtn('master')}</div>
        <div class="grid">
          <label class="f">Master volume<input type="range" min="0.3" max="1.2" step="0.05" value="${M.vol}" onchange="MS.a.mset('vol',+this.value)"></label>
          <label class="f">Punch (compression) <span class="muted" style="text-transform:none">${Math.round(M.punch * 100)}%</span><input type="range" min="0" max="1" step="0.05" value="${M.punch}" onchange="MS.a.mset('punch',+this.value)"></label>
          <label class="f">Fade in <span class="muted" style="text-transform:none">${M.fadeIn}s</span><input type="range" min="0" max="8" step="0.5" value="${M.fadeIn}" onchange="MS.a.mset('fadeIn',+this.value)"></label>
          <label class="f">Fade out <span class="muted" style="text-transform:none">${M.fadeOut}s</span><input type="range" min="0" max="12" step="0.5" value="${M.fadeOut}" onchange="MS.a.mset('fadeOut',+this.value)"></label></div>
        <div class="level">Room sound</div>${MS.seg(['Dry', 'Studio', 'Concert hall', 'Church', 'Stadium'], M.room, "MS.a.mset('room',")}
        <div class="row"><label class="row small"><input type="checkbox" ${M.bypass ? 'checked' : ''} onchange="MS.a.mset('bypass',this.checked)"> Before / after: hear it without the master effects</label></div>
        <div class="tiny muted">Fades play on the whole song and in your downloads. Every download is also evened out in loudness.</div></div>
      ` + MS.footer('Control Room notes: all mixing happens on your device. Sounds are built in, so the mix sounds good but not like a professional studio recording.');
    },
    after() { meterLoop(); }
  };
  function strip(c, basic, adv) {
    const o = c.obj, path = c.path;
    const sl = (k, label, min, max, step, def) => `<label>${label}<input type="range" min="${min}" max="${max}" step="${step}" value="${o[k] == null ? def : o[k]}" onchange="MS.a.chset('${path}','${k}',+this.value)"></label>`;
    return `<div class="strip" style="border-top:3px solid ${c.color}"><div class="row" style="justify-content:space-between;gap:4px"><b style="color:var(--ink)">${esc(c.name)}</b><span class="tiny">${esc(c.sub)}</span></div>
      <div class="meter" style="height:8px"><i data-meter="${c.key}" style="background:${c.color}"></i></div>
      ${sl('vol', 'Fader (volume)', 0, 1.2, 0.05, 0.8)}
      ${basic ? '' : sl('pan', 'Left · Right', -1, 1, 0.1, 0) + (c.key === 'drums' ? '' : sl('echo', 'Echo', 0, 0.8, 0.05, 0) + sl('rev', 'Reverb', 0, 1, 0.05, 0.25))}
      ${adv ? sl('bass', 'Bass (low EQ)', -12, 12, 1, 0) + sl('treble', 'Treble (high EQ)', -12, 12, 1, 0) : ''}
      <div class="row" style="gap:6px">${['vocal', 'bgv', 'drums'].includes(c.key) ? '' : `<button class="btn sm adv" aria-pressed="${!!o.solo}" style="${o.solo ? 'background:var(--amber);color:#1a1405' : ''}" onclick="MS.a.chtog('${path}','solo')">Solo</button>`}${c.key === 'vocal' ? `<button class="btn sm" aria-pressed="${!!o.leadMute}" style="${o.leadMute ? 'background:#5a2a20' : ''}" onclick="MS.a.chtog('${path}','leadMute')">${o.leadMute ? 'Muted' : 'Mute'}</button>` : `<button class="btn sm" aria-pressed="${!!o.mute}" style="${o.mute ? 'background:#5a2a20' : ''}" onclick="MS.a.chtog('${path}','mute')">${o.mute ? 'Muted' : 'Mute'}</button>`}</div></div>`;
  }
  MS.a.chset = (path, k, v) => MS.change(s => { ensure(s); objOf(s, path)[k] = v; }, { quiet: true });
  MS.a.chtog = (path, k) => MS.change(s => { ensure(s); const o = objOf(s, path); o[k] = !o[k]; });
  MS.a.mset = (k, v) => MS.change(s => { ensure(s).master[k] = v; }, { quiet: k === 'vol' });
  MS.a.layerSet = (id, k, v) => MS.change(s => { s.layers.find(L => L.id === id)[k] = v; });
  MS.a.delLayer = id => MS.change(s => { s.layers = s.layers.filter(L => L.id !== id); });
  MS.a.layerMenu = function () {
    MS.modal(`<div class="row" style="justify-content:space-between"><h2>Add a background layer</h2><div class="row">${MS.helpBtn('layers')}<button class="btn sm ghost" onclick="MS.closeModal()">Close</button></div></div>
      <div class="small muted" style="margin-top:6px">Each layer plays your chords in its own way. Hear it first, then add it.</div>
      <div class="grid" style="margin-top:12px">${Object.entries(PRESETS).map(([k, p]) => `<div class="opt"><b>${k}</b><span class="small" style="color:#ddd8cc">${p.d}</span><span class="tiny muted">${p.inst}${p.ens === 'section' ? ' section' : ''} · ${p.style}</span><div class="row"><button class="btn sm" onclick="MS.a.hearLayer(${esc(JSON.stringify(k))})">▶ Hear it</button><button class="btn sm primary" onclick="MS.a.addLayer(${esc(JSON.stringify(k))})">Add</button></div></div>`).join('')}</div>`);
  };
  MS.a.hearLayer = function (k) {
    const s = ensure(JSON.parse(JSON.stringify(S.song))); s.vocals.leadBuffer = null;
    const sec = s.sections.find(x => x.id === S.sec) || s.sections[0];
    s.sections.forEach(x => { if (!(s.chords[x.id] || []).some(Boolean)) s.chords[x.id] = MS.suggestChords(s, x.id); });
    s.layers = []; const L = MS.addLayer(s, k); L.vol = 0.8;
    s.parts.forEach(p => p.vol = (p.vol || 0.8) * 0.5);
    A().play(s, { section: sec.id });
  };
  MS.a.addLayer = function (k) { MS.closeModal(); let L; MS.change(s => { L = MS.addLayer(s, k); }); MS.toast(k + ' added. It follows your chords.'); MS.a.crPlay(S.sec); };
  MS.a.buildUp = function () {
    MS.change(s => {
      ensure(s); const n = s.sections.length, lastChorus = [...s.sections].reverse().find(x => /chorus/i.test(x.name));
      s.sections.forEach((x, i) => {
        const intro = /intro/i.test(x.name), verse = /verse/i.test(x.name), outro = /outro/i.test(x.name), first = i < n / 2;
        s.layers.forEach((L, j) => { L.off = L.off || {}; L.off[x.id] = intro ? j > 0 : verse && first ? j > 0 : outro ? j > 0 : false; if (lastChorus && x.id === lastChorus.id) L.off[x.id] = false; });
        s.drums.skip[x.id] = intro || outro;
        const h = s.parts.find(p => p.role === 'harmony'); if (h) { h.off = h.off || {}; h.off[x.id] = intro || (verse && first); }
      });
    });
    MS.toast('Built up: quieter at the start, everything in the last chorus. Press Play.');
  };
  MS.a.crPlay = function (secId) { cancelAnimationFrame(raf); MS.startPlay(secId ? { section: secId } : {}); meterLoop(); };
  MS.a.crStop = function () { A().stop(); };
  function meterLoop() {
    cancelAnimationFrame(raf);
    const buf = new Float32Array(512);
    const tick = () => {
      if (S.screen !== 'control') return;
      const m = A().meters && A().meters(), playing = A().isPlaying();
      document.querySelectorAll('[data-meter]').forEach(el => {
        const an = playing && m && m[el.dataset.meter]; let v = 0;
        if (an) { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; v = Math.min(1, Math.sqrt(s / buf.length) * 4); }
        const cur = parseFloat(el.dataset.v || 0), nv = v > cur ? v : cur * 0.9; el.dataset.v = nv; el.style.width = Math.round(nv * 100) + '%';
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
})();
