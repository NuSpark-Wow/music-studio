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
    'Low drone': { inst: 'Cellos', style: 'Drone', ens: 'section', octave: -1, d: 'One deep note per bar under everything.' },
    'Spanish strum': { inst: 'Spanish guitar', style: 'Strum', ens: 'solo', world: 1, d: 'Nylon-string guitar strumming your chords. Latin and flamenco.' },
    'Tanpura drone': { inst: 'Tanpura', style: 'Drone', ens: 'solo', octave: 1, world: 1, d: 'The humming drone under Indian music.' },
    'Koto ripple': { inst: 'Koto', style: 'Arpeggio', ens: 'solo', world: 1, d: 'Plucked Japanese strings rippling through the chords.' },
    'Steel pan pulse': { inst: 'Steel drums', style: 'Pulse', ens: 'solo', world: 1, d: 'Bright Caribbean steel drums bouncing on the beat.' },
    'Accordion pad': { inst: 'Accordion', style: 'Pad', ens: 'solo', world: 1, d: 'Squeezebox chords. Folk, polka, French café.' },
    'Kalimba sparkle': { inst: 'Kalimba', style: 'Arpeggio', ens: 'solo', octave: 1, world: 1, d: 'African thumb piano twinkling on top.' }
  };
  MS.LAYER_PRESETS = PRESETS;
  // One-click sound presets for the whole mix (master + every channel's reverb, echo and tone).
  const SOUND = {
    '🎙 Motown': { m: { room: 'Studio', punch: 0.5 }, rev: 0.35, echo: 0.05, treble: 2, d: 'Warm, tight 1960s studio sound.' },
    '🏟 \'80s Arena': { m: { room: 'Stadium', punch: 0.7 }, rev: 0.7, echo: 0.25, treble: 3, d: 'Big, roomy, larger-than-life.' },
    '📻 Lo-Fi': { m: { room: 'Dry', punch: 0.25, vol: 0.85 }, rev: 0.15, echo: 0, treble: -7, d: 'Soft, mellow, a little muffled, like an old radio.' },
    '🎻 Concert Hall': { m: { room: 'Concert hall', punch: 0.1 }, rev: 0.6, echo: 0, treble: 0, d: 'Natural and open, like a live orchestra.' },
    '⛪ Gospel Church': { m: { room: 'Church', punch: 0.35 }, rev: 0.75, echo: 0.1, treble: 1, d: 'Rich, ringing and uplifting.' },
    '🔊 Modern Pop': { m: { room: 'Studio', punch: 0.85 }, rev: 0.25, echo: 0.15, treble: 4, d: 'Loud, bright and punchy.' }
  };
  MS.a.soundPreset = function (name) {
    const P = SOUND[name]; if (!P) return;
    MS.change(s => {
      ensure(s); Object.assign(s.master, P.m);
      channels(s).forEach(c => { if (['drums', 'perc'].includes(c.key) || String(c.key).startsWith('perc:')) return; const o = objOf(s, c.path); if (!o) return; o.rev = P.rev; o.echo = P.echo; o.treble = P.treble; });
    });
    MS.toast(name.replace(/^\S+\s/, '') + ' sound set. Press Play to hear it.');
    if (MS.firstSongStep === 4) MS.a.firstSongNext();
  };
  let raf = null;

  function ensure(s) {
    s.layers = s.layers || []; s.master = Object.assign({ vol: 0.9, punch: 0, room: 'Studio', fadeIn: 0, fadeOut: 0, bypass: false }, s.master || {});
    s.vocals.bgvMix = s.vocals.bgvMix || { vol: 0.8, rev: 0.5, echo: 0.1, pan: 0 };
    s.perc = Object.assign({ on: {}, off: {}, vol: 0.55 }, s.perc || {});
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
    const pc = Object.keys(s.perc.on).filter(k => s.perc.on[k] && A().PERC[k]);
    pc.forEach(k => out.push({ key: 'perc:' + k, name: A().PERC[k].name, sub: 'Percussion', color: '#c8b48a', obj: s.perc, path: 'perc:' + k, grid: true, gridOnly: true }));
    if (pc.length) out.push({ key: 'perc', name: 'Percussion', sub: pc.map(k => A().PERC[k].name).join(', '), color: '#c8b48a', obj: s.perc, path: 'perc', grid: false });
    if (s.vocals.bgv.on) out.push({ key: 'bgv', name: 'Background singers', sub: s.vocals.bgv.count + ' · ' + s.vocals.bgv.type, color: '#b39dfa', obj: s.vocals.bgvMix, path: 'bgv', grid: true });
    if (MS.vbuf) out.push({ key: 'vocal', name: 'Lead vocal', sub: 'Your voice', color: '#f08a6b', obj: s.vocals, path: 'vocal', grid: true });
    return out;
  }
  function objOf(s, path) {
    if (path === 'chords') return s.chordPart; if (path === 'drums') return s.drums; if (path === 'perc') return s.perc; if (path === 'bgv') return s.vocals.bgvMix; if (path === 'vocal') return s.vocals;
    if (path.startsWith('L:')) return s.layers.find(L => 'L:' + L.id === path);
    return s.parts.find(p => 'p:' + p.id === path);
  }
  // is a channel playing in a section? (grid cell)
  function isOn(s, c, secId) {
    if (c.key === 'drums') return !(s.drums.skip || {})[secId];
    if (c.key.startsWith('perc:')) return !(s.perc.off[c.key.slice(5)] || {})[secId];
    if (c.key === 'bgv') { const g = s.vocals.bgv; return g.where === 'Every section' || (g.where === 'Chorus only' ? /chorus/i.test(s.sections.find(x => x.id === secId).name) : (g.picked || []).includes(secId)); }
    if (c.key === 'vocal') return !(s.vocals.off || {})[secId];
    return !(c.obj.off || {})[secId];
  }
  MS.a.cell = function (path, secId) {
    MS.change(s => {
      ensure(s);
      if (path === 'drums') { s.drums.skip[secId] = !s.drums.skip[secId]; return; }
      if (path.startsWith('perc:')) { const k = path.slice(5), o = s.perc.off[k] = s.perc.off[k] || {}; o[secId] = !o[secId]; return; }
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
        <div class="mixer" style="grid-template-columns:repeat(auto-fill,minmax(${adv ? 190 : 160}px,1fr))">${ch.filter(c => !c.gridOnly).map(c => strip(c, basic, adv)).join('')}</div>
        <div class="tiny muted">Move the melody or your voice a little above everything else. Solo plays one channel alone; Mute silences it.</div></div>

      <div class="card col" style="margin-top:12px;border-color:#3d4a5c"><div class="row" style="gap:6px"><div class="label">4 · Master (post-production)</div>${MS.helpBtn('master')}</div>
        <div class="grid">
          <label class="f">Master volume<input type="range" min="0.3" max="1.2" step="0.05" value="${M.vol}" onchange="MS.a.mset('vol',+this.value)"></label>
          <label class="f">Punch (compression) <span class="muted" style="text-transform:none">${Math.round(M.punch * 100)}%</span><input type="range" min="0" max="1" step="0.05" value="${M.punch}" onchange="MS.a.mset('punch',+this.value)"></label>
          <label class="f">Fade in <span class="muted" style="text-transform:none">${M.fadeIn}s</span><input type="range" min="0" max="8" step="0.5" value="${M.fadeIn}" onchange="MS.a.mset('fadeIn',+this.value)"></label>
          <label class="f">Fade out <span class="muted" style="text-transform:none">${M.fadeOut}s</span><input type="range" min="0" max="12" step="0.5" value="${M.fadeOut}" onchange="MS.a.mset('fadeOut',+this.value)"></label></div>
        <div class="level">One-click sound presets</div><div class="row" style="gap:6px;flex-wrap:wrap">${Object.entries(SOUND).map(([k, p]) => `<button class="btn sm" title="${esc(p.d)}" onclick="MS.a.soundPreset(${esc(JSON.stringify(k))})">${esc(k)}</button>`).join('')}</div><div class="tiny muted">Sets the room, punch, reverb and echo for the whole mix. Fine-tune anything after.</div>
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
      ${basic || c.key === 'perc' ? '' : sl('pan', 'Left · Right', -1, 1, 0.1, 0) + (c.key === 'drums' ? '' : sl('echo', 'Echo', 0, 0.8, 0.05, 0) + sl('rev', 'Reverb', 0, 1, 0.05, 0.25))}
      ${adv && c.key !== 'perc' ? sl('bass', 'Bass (low EQ)', -12, 12, 1, 0) + sl('treble', 'Treble (high EQ)', -12, 12, 1, 0) : ''}
      <div class="row" style="gap:6px">${['vocal', 'bgv', 'drums', 'perc'].includes(c.key) ? '' : `<button class="btn sm adv" aria-pressed="${!!o.solo}" style="${o.solo ? 'background:var(--amber);color:#1a1405' : ''}" onclick="MS.a.chtog('${path}','solo')">Solo</button>`}${c.key === 'vocal' ? `<button class="btn sm" aria-pressed="${!!o.leadMute}" style="${o.leadMute ? 'background:#5a2a20' : ''}" onclick="MS.a.chtog('${path}','leadMute')">${o.leadMute ? 'Muted' : 'Mute'}</button>` : `<button class="btn sm" aria-pressed="${!!o.mute}" style="${o.mute ? 'background:#5a2a20' : ''}" onclick="MS.a.chtog('${path}','mute')">${o.mute ? 'Muted' : 'Mute'}</button>`}</div></div>`;
  }
  MS.a.chset = (path, k, v) => MS.change(s => { ensure(s); objOf(s, path)[k] = v; }, { quiet: true });
  MS.a.chtog = (path, k) => MS.change(s => { ensure(s); const o = objOf(s, path); o[k] = !o[k]; });
  MS.a.mset = (k, v) => MS.change(s => { ensure(s).master[k] = v; }, { quiet: k === 'vol' });
  MS.a.layerSet = (id, k, v) => MS.change(s => { s.layers.find(L => L.id === id)[k] = v; });
  MS.a.delLayer = id => MS.change(s => { s.layers = s.layers.filter(L => L.id !== id); });
  MS.a.layerMenu = function () {
    MS.modal(`<div class="row" style="justify-content:space-between"><h2>Add a background layer</h2><div class="row">${MS.helpBtn('layers')}<button class="btn sm ghost" onclick="MS.closeModal()">Close</button></div></div>
      <div class="small muted" style="margin-top:6px">Each layer plays your chords in its own way. Hear it first, then add it.</div>
      ${[['', e => !e[1].world], ['🌍 World layers', e => e[1].world]].map(([title, f]) => `${title ? `<div class="label" style="margin-top:16px">${title}</div><div class="tiny muted">Built-in approximations of instruments from around the world.</div>` : ''}<div class="grid" style="margin-top:12px">${Object.entries(PRESETS).filter(f).map(([k, p]) => `<div class="opt"><b>${k}</b><span class="small" style="color:#ddd8cc">${p.d}</span><span class="tiny muted">${p.inst}${p.ens === 'section' ? ' section' : ''} · ${p.style}</span><div class="row"><button class="btn sm" onclick="MS.a.hearLayer(${esc(JSON.stringify(k))})">▶ Hear it</button><button class="btn sm primary" onclick="MS.a.addLayer(${esc(JSON.stringify(k))})">Add</button></div></div>`).join('')}</div>`).join('')}
      <div class="small muted" style="margin-top:14px">Want a tambourine, shaker, congas or tabla? Turn them on in the Drums card in the studio, then pick which sections they play in on the build grid.</div>`);
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
        Object.keys(s.perc.on).forEach(k => { const o = s.perc.off[k] = s.perc.off[k] || {}; o[x.id] = intro || outro || (verse && first); });
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

/* Your First Song in 10 Minutes: a guided path that floats over every room, one step at a time (nothing is saved). */
(function () {
  const MS = window.MS, S = MS.S;
  const STEPS = [
    { t: 'Start a new song', d: 'We start fresh so nothing gets mixed up. Tap "Do it for me" or press "Start a new song" on the home page.', go: () => MS.a.newSong(), b: 'Do it for me' },
    { t: 'Make a melody', d: 'In the studio, tap the staff (or press the big Sing button) and add about 8 notes. Short and simple is perfect. Tap Play to hear it.', go: () => MS.go('studio'), b: 'Take me to the studio' },
    { t: 'Add a background layer', d: 'In the Control Room, tap "Add a layer" and pick one, like String pad or Guitar strum. It plays chords under your melody automatically.', go: () => MS.go('control'), b: 'Take me to the Control Room' },
    { t: 'Add words (optional)', d: 'In the Vocal Room, tell Mr. Paul what your song is about and pick lyrics, or skip this step if you want an instrumental.', go: () => MS.go('vocal'), b: 'Take me to the Vocal Room' },
    { t: 'Pick a sound', d: 'Back in the Control Room, scroll to Master and tap a one-click sound preset like Motown or Lo-Fi. Then press Play.', go: () => MS.go('control'), b: 'Take me there' },
    { t: 'Save and download', d: 'Name your song and download it as an MP3. That\'s it: you made a song!', go: () => MS.go('save'), b: 'Take me there' }
  ];
  MS.firstSongStep = -1;
  function panel() {
    let el = document.getElementById('firstSongPanel');
    if (MS.firstSongStep < 0) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'firstSongPanel'; el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:60;max-width:330px;background:#1c2230;color:#f3efe6;border:2px solid #f5b942;border-radius:14px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.45);font:14px/1.45 Inter,system-ui,sans-serif'; document.body.appendChild(el); }
    const i = MS.firstSongStep, st = STEPS[i];
    el.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="color:#f5b942">🎵 First Song · Step ' + (i + 1) + ' of ' + STEPS.length + '</b><button type="button" aria-label="Close the guided path" style="background:none;border:0;color:#f3efe6;font-size:18px;cursor:pointer" onclick="MS.a.firstSongEnd()">✕</button></div>' +
      '<div style="height:5px;background:#333b4d;border-radius:4px;margin:6px 0 8px"><div style="height:5px;width:' + Math.round((i + 1) / STEPS.length * 100) + '%;background:#f5b942;border-radius:4px"></div></div>' +
      '<div style="font-weight:700;font-size:15px">' + st.t + '</div><div style="margin:4px 0 10px">' + st.d + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn sm" onclick="MS.a.firstSongGo()">' + st.b + '</button><button type="button" class="btn sm primary" onclick="MS.a.firstSongNext()">' + (i === STEPS.length - 1 ? 'Finish 🎉' : 'Done, next step ▶') + '</button>' + (i > 0 ? '<button type="button" class="btn sm ghost" onclick="MS.a.firstSongBack()">◀ Back</button>' : '') + '</div>';
  }
  MS.a.firstSong = function () { MS.firstSongStep = 0; panel(); };
  MS.a.firstSongGo = function () { const st = STEPS[MS.firstSongStep]; if (st) st.go(); if (MS.firstSongStep === 0) MS.a.firstSongNext(); else panel(); };
  MS.a.firstSongNext = function () { if (MS.firstSongStep >= STEPS.length - 1) { MS.a.firstSongEnd(); MS.toast('You made your first song! 🎉 Try another style next.'); return; } MS.firstSongStep++; panel(); };
  MS.a.firstSongBack = function () { if (MS.firstSongStep > 0) MS.firstSongStep--; panel(); };
  MS.a.firstSongEnd = function () { MS.firstSongStep = -1; panel(); };
})();
