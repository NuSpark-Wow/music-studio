/* The Music Studio — the suggestions bar that follows you everywhere (3 ideas, tap to apply, Undo always there). */
(function () {
  const MS = window.MS, S = MS.S, A = () => window.MSA, esc = MS.esc;

  MS.api = async function (body) {
    const r = await fetch('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (e) { }
    if (!r.ok) throw new Error((j && j.message) || 'The AI helper is not available right now.');
    return j || {};
  };

  const C = MS.coach = { ideas: [], key: '', last: 0, loading: false, min: false, asking: false, seen: [] };
  try { C.min = localStorage.getItem('musicstudio.sugg') === 'min'; } catch (e) { }

  function where() {
    const s = S.song; if (!s) return { label: 'Knows: nothing yet. Start a song!', key: 'none' };
    const sec = MS.sec(), scr = S.screen;
    const name = scr === 'control' ? 'Control Room' : scr === 'vocal' ? 'Vocal Room' : scr === 'room' ? 'Music Room' : scr === 'restyle' ? 'Restyle' : scr === 'save' ? 'Save' : 'Studio';
    return { label: `${name} · ${sec ? sec.name + ' · ' : ''}${s.key} · ${s.tempo} BPM`, key: scr + '|' + (sec && sec.id) };
  }
  C.summary = function () {
    const s = S.song, sec = MS.sec();
    return {
      screen: S.screen, level: S.level, title: s.title, key: s.key, tempo: s.tempo, ts: s.ts, style: s.style || '', current: sec && sec.name,
      sections: s.sections.map(x => ({ name: x.name, bars: x.bars, chords: (s.chords[x.id] || []).filter(Boolean).length, lyrics: !!s.vocals.lyrics[x.id], parts: s.parts.filter(p => (p.notes[x.id] || []).some(n => n.p != null)).map(p => p.name) })),
      parts: s.parts.map(p => ({ name: p.name, role: p.role, inst: p.inst, ens: p.ens, notes: Object.values(p.notes).reduce((a, l) => a + l.filter(n => n.p != null).length, 0), echo: p.echo, rev: p.rev })),
      drums: s.drums.style, chords: s.chordPart.on ? s.chordPart.inst + ' ' + s.chordPart.style : 'off',
      backgroundSingers: s.vocals.bgv.on ? s.vocals.bgv.count + ' ' + s.vocals.bgv.type + ' ' + s.vocals.bgv.where : 'off',
      leadVocalRecorded: !!MS.vbuf, brief: s.vocals.brief, layers: (s.layers || []).map(l => l.name + ' (' + l.inst + ')'), master: s.master
    };
  };

  // rule-based ideas: always available, no AI needed
  function localIdeas() {
    const s = S.song, out = [];
    if (!s) return [{ label: 'Start a new song', why: 'Write or sing your first notes', action: { type: 'go', screen: 'new' } }, { label: 'Open The Music Room', why: 'Short lessons, 2 to 4 minutes each', action: { type: 'go', screen: 'room' } }, { label: 'Start from Ode to Joy', why: 'A classic anyone can use', action: { type: 'classic', name: 'Ode to Joy (Beethoven)' } }];
    if (S.screen === 'room') return [{ label: 'Try the next lesson', why: 'Each one takes 2 to 4 minutes', action: { type: 'go', screen: 'room' } }, { label: 'Open the studio', why: 'Instruments, drums and vocals', action: { type: 'go', screen: 'studio' } }, { label: 'Start from Twinkle, Twinkle', why: 'Practice on a song you know', action: { type: 'classic', name: 'Twinkle, Twinkle, Little Star' } }].filter(i => !C.seen.includes(i.label));
    const sec = MS.sec(), mel = s.parts.find(p => p.role === 'melody'), har = s.parts.find(p => p.role === 'harmony'), bass = s.parts.find(p => p.role === 'bass');
    const melHere = mel && (mel.notes[sec.id] || []).some(n => n.p != null);
    const any = x => x && Object.values(x.notes).some(l => l.some(n => n.p != null));
    if (S.screen === 'control') {
      const L = s.layers || [];
      if (!L.length) out.push({ label: 'Add a string pad layer', why: 'Strings holding your chords', action: { type: 'layer', preset: 'String pad' } });
      if (L.length && !L.some(x => x.name === 'Organ pad')) out.push({ label: 'Add a soft organ pad', why: 'Warmth under the verse', action: { type: 'layer', preset: 'Organ pad' } });
      if (L.length >= 1) out.push({ label: 'Build it up section by section', why: 'Small start, big last chorus', action: { type: 'buildup' } });
      if (!(s.master || {}).fadeOut) out.push({ label: 'Add a 5-second fade out', why: 'A smooth, finished ending', action: { type: 'master', fadeOut: 5 } });
      if (!(s.master || {}).punch) out.push({ label: 'Add a little punch (30%)', why: 'Fuller, steadier sound', action: { type: 'master', punch: 0.3 } });
      if ((s.master || {}).room !== 'Concert hall') out.push({ label: 'Try the concert hall room', why: 'Big, natural space', action: { type: 'master', room: 'Concert hall' } });
    }
    if (S.screen === 'vocal') {
      if (!s.vocals.brief.about) out.push({ label: 'Fill in what the song is about', why: 'Lyric ideas get much better', action: { type: 'tip', text: 'Type a sentence in “What\'s it about?” at the top, or press “Stuck? Give me ideas”.' } });
      if (!s.vocals.lyrics[sec.id]) out.push({ label: 'Get 3 lyric options for ' + sec.name, why: 'Pick one and make it yours', action: { type: 'lyrics' } });
      if (!s.vocals.bgv.on) out.push({ label: 'Add a trio of background singers', why: 'Harmony in the chorus', action: { type: 'bgv', count: 'A trio', kind: 'Harmony', where: 'Chorus only' } });
      if (s.vocals.bgv.on && s.vocals.bgv.type !== 'Echo last word') out.push({ label: 'Singers echo the last word', why: 'A classic call-back', action: { type: 'bgv', kind: 'Echo last word' } });
      if (!MS.vbuf) out.push({ label: 'Record your voice on ' + sec.name, why: 'Headphones help', action: { type: 'tip', text: 'Press the big Record button in step 5. You get one bar of clicks first.' } });
      out.push({ label: 'Let the music lead the intro', why: 'Voice comes in on the verse', action: { type: 'lead', section: (s.sections.find(x => /intro/i.test(x.name)) || {}).name, mode: 'music' } });
    }
    if (!melHere) out.push({ label: 'Sing a few notes into ' + sec.name, why: 'Tap Sing, la la la, tap Stop', action: { type: 'tip', text: 'Press the round Sing button, sing slowly, then press Stop. You\'ll see what I heard first.' } });
    if (melHere && har && !(har.notes[sec.id] || []).some(n => n.p != null)) out.push({ label: 'Add a harmony a third below', why: 'Follows your melody, sounds warm', action: { type: 'harmony', kind: 'third_below' } });
    if (any(mel) && !(s.chords[sec.id] || []).some(Boolean)) out.push({ label: 'Suggest chords for every section', why: 'Built from your melody', action: { type: 'chords_auto' } });
    if (any(mel) && bass && !any(bass)) out.push({ label: 'Make a steady bass line', why: 'Root and fifth from your chords', action: { type: 'bass_line', style: 'pop' } });
    if (s.drums.style === 'None' && any(mel)) out.push({ label: s.tempo < 85 ? 'Add a soft ballad beat' : 'Add a pop beat', why: 'Drums give it a pulse', action: { type: 'drums', style: s.tempo < 85 ? 'Soft ballad' : 'Pop' } });
    if (s.sections.length < 3) out.push({ label: 'Add a chorus after this', why: 'The catchy part that repeats', action: { type: 'add_section', name: 'Chorus', bars: 4 } });
    if (har && har.inst === 'Violins' && har.ens !== 'section') out.push({ label: 'Make the harmony a violin section', why: 'Rich and full under the melody', action: { type: 'instrument', part: har.name, inst: 'Violins', ens: 'section' } });
    if (mel && mel.rev < 0.3) out.push({ label: 'Add a little reverb to the melody', why: 'Sounds like a bigger room', action: { type: 'effect', part: mel.name, rev: 0.4 } });
    out.push({ label: 'Try it as R&B', why: 'Slow groove, electric piano', action: { type: 'style', name: 'R&B' } });
    out.push({ label: 'Try a classical arrangement', why: 'Solo violin, strings and harp', action: { type: 'style', name: 'Classical' } });
    if (S.screen !== 'control' && any(mel)) out.push({ label: 'Mix it in the Control Room', why: 'Layers, faders, master polish', action: { type: 'go', screen: 'control' } });
    if (S.screen !== 'vocal') out.push({ label: 'Write lyrics in the Vocal Room', why: 'AI gives 3 options per section', action: { type: 'go', screen: 'vocal' } });
    return out.filter(i => !C.seen.includes(i.label));
  }

  C.render = function () {
    let el = document.getElementById('sugg');
    if (!el) { el = document.createElement('div'); el.id = 'sugg'; el.className = 'sugg'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Suggestions'); document.body.appendChild(el); }
    const w = where();
    if (w.key !== C.key) { C.key = w.key; C.ideas = []; wordIdx++; C.fill(true); }
    if (!C.ideas.length) C.ideas = localIdeas().slice(0, 3);
    el.className = 'sugg' + (C.min ? ' min' : '');
    el.innerHTML = `<div class="in"><div style="display:flex;flex-direction:column;margin-right:4px"><span class="tiny" style="letter-spacing:.1em;text-transform:uppercase;color:var(--violet);font-weight:700">Suggestions ${C.loading ? '…' : ''}</span><span class="tiny muted ctx">${esc(w.label)}</span></div>
      <div class="chips row" style="gap:8px;flex:1 1 400px">${C.ideas.map((i, k) => `<button class="chip" onclick="MS.coach.apply(${k})">${esc(i.label)}<small>${esc(i.why || '')}</small></button>`).join('')}${C.wordChip()}</div>
      <div class="row" style="gap:6px;margin-left:auto"><button class="btn sm ask" onclick="MS.coach.more()">3 more</button><button class="btn sm ask" onclick="MS.coach.ask()">Ask</button><button class="btn sm" onclick="MS.undo()">Undo</button>${MS.helpBtn('suggestions', '?')}<button class="btn sm ghost" onclick="MS.coach.toggle()" aria-label="${C.min ? 'Show suggestions' : 'Hide suggestions'}">${C.min ? 'Show' : 'Hide'}</button></div></div>`;
  };
  // one music word per screen, rotating, so people pick up studio vocabulary as they work
  const WORDS_FOR = { home: ['Melody', 'Harmony', 'Chorus', 'Tempo'], studio: ['Bar (measure)', 'Chord progression', 'Bass line', 'Cadence', 'Arpeggio', 'Downbeat', 'Groove', 'Key', 'Dynamics', 'Third', 'Rest', 'Time signature'], vocal: ['Hook', 'Backing vocals', 'Take', 'Punch-in', 'Rhyme scheme', 'Call and response', 'Doubling', 'Lead vocal'], restyle: ['Genre', 'Arrangement', 'Swing', 'Groove'], control: ['EQ', 'Compression', 'Fader', 'Pad', 'Mastering', 'Fade', 'Post-production', 'Meter', 'Headroom', 'Engineer', 'Drop', 'Pan'], save: ['Score', 'MP3', 'Master'], room: ['Staff', 'Clef', 'Beat', 'Interval'], words: ['Producer', 'Production'] };
  let wordIdx = Math.floor(Math.random() * 5);
  C.wordChip = function () {
    if (!MS.WORDS) return '';
    const list = (WORDS_FOR[S.screen] || WORDS_FOR.studio).filter(w => MS.WORDS[w]); if (!list.length) return '';
    const w = list[wordIdx % list.length];
    return `<button class="chip word" onclick="MS.word(${esc(JSON.stringify(w))})" title="${esc(MS.WORDS[w][0])}">📖 ${esc(w)}<small>Studio word · tap to learn</small></button>`;
  };
  C.toggle = () => { C.min = !C.min; try { localStorage.setItem('musicstudio.sugg', C.min ? 'min' : ''); } catch (e) { } C.render(); };
  C.more = function () { wordIdx++; C.seen.push(...C.ideas.map(i => i.label)); if (C.seen.length > 40) C.seen = C.seen.slice(-40); C.ideas = []; C.fill(false); C.render(); };
  // ask the AI (only when a song exists and not too often); local ideas show meanwhile
  C.fill = async function (auto, ask) {
    if (!S.song || S.screen === 'home' || S.screen === 'room') return;
    const now = Date.now(); if (auto && now - C.last < 20000) return;
    C.last = now; C.loading = true;
    try {
      const r = await MS.api({ part: 'suggest', song: C.summary(), ask: ask || '', avoid: C.seen.slice(-12) });
      const ideas = (r.ideas || []).filter(i => i && i.label && i.action);
      if (ideas.length) { C.ideas = ideas.concat(localIdeas()).slice(0, 3); }
    } catch (e) { if (ask) MS.toast(e.message); }
    C.loading = false; C.render();
  };
  C.ask = function () {
    MS.modal(`<h2>Ask for ideas</h2><div class="col" style="margin-top:12px"><label class="f">What would you like?<input id="askIn" maxlength="200"></label><div class="tiny muted">Example: “make the chorus bigger” or “something sadder for the bridge”.</div>
      <div class="row"><button class="btn primary" onclick="MS.coach._ask()">Get 3 ideas</button><button class="btn ghost" onclick="MS.closeModal()">Cancel</button></div></div>`);
    setTimeout(() => { const i = document.getElementById('askIn'); i.focus(); i.onkeydown = e => { if (e.key === 'Enter') MS.coach._ask(); }; }, 30);
  };
  C._ask = function () { const v = document.getElementById('askIn').value.trim(); MS.closeModal(); if (!v) return; C.min = false; C.ideas = []; C.render(); C.fill(false, v); MS.toast('Thinking…', 1200); };

  // apply one idea
  C.apply = function (k) {
    const idea = C.ideas[k]; if (!idea) return; const a = idea.action || {}, s = S.song;
    const findPart = name => s && (s.parts.find(p => p.name.toLowerCase() === String(name || '').toLowerCase()) || s.parts.find(p => p.role === String(name || '').toLowerCase()));
    const done = msg => { C.seen.push(idea.label); C.ideas.splice(k, 1); const more = localIdeas().filter(i => !C.ideas.some(x => x.label === i.label)); if (more[0]) C.ideas.push(more[0]); MS.toast(msg || 'Done. Undo is right there if you don\'t like it.'); C.render(); };
    switch (a.type) {
      case 'go': if (a.screen === 'new') return MS.a.newSong(); MS.go(['vocal', 'room', 'restyle', 'save', 'control'].includes(a.screen) ? a.screen : 'studio'); return;
      case 'classic': return MS.a.classic(a.name);
      case 'tip': return MS.toast(a.text || idea.why, 5000);
      case 'lyrics': if (S.screen !== 'vocal') MS.go('vocal'); return MS.a.getLyrics();
      case 'tempo': MS.change(x => { x.tempo = Math.max(40, Math.min(200, +a.value || x.tempo)); }); return done('Tempo set to ' + S.song.tempo + ' BPM.');
      case 'key': if (A().KEYS[a.value]) MS.a.key(a.value); return done();
      case 'instrument': { const p = a.part === 'chords' ? 'chords' : findPart(a.part); if (!p || !A().INST[a.inst]) return MS.toast('That idea did not fit this song.'); MS.change(x => { const t = p === 'chords' ? x.chordPart : x.parts.find(y => y.id === p.id); t.inst = a.inst; t.ens = A().INST[a.inst].ens ? (a.ens === 'section' ? 'section' : 'solo') : 'solo'; if (a.size && A().SIZES[a.size]) t.size = a.size; if (a.artic) t.artic = a.artic; if (p === 'chords') x.chordPart.on = true; }); return done(); }
      case 'harmony': MS.change(x => { MS.makeHarmony(x, a.kind || 'third_below', a.all ? null : [S.sec]); }); MS.a.playSection && S.screen === 'studio' && MS.a.playSection(); return done();
      case 'bass_line': MS.change(x => { MS.makeBass(x, null, a.style || 'pop'); }); return done();
      case 'chords_auto': MS.change(x => { x.sections.forEach(z => { if (!(x.chords[z.id] || []).some(Boolean)) x.chords[z.id] = MS.suggestChords(x, z.id); }); x.chordPart.on = true; }); return done();
      case 'chord_style': MS.change(x => { x.chordPart.on = true; if (a.style) x.chordPart.style = a.style; if (a.inst && A().INST[a.inst]) x.chordPart.inst = a.inst; }); return done();
      case 'drums': if (!A().DRUMS.hasOwnProperty(a.style)) return MS.toast('That beat is not available.'); MS.change(x => { x.drums.style = a.style; }); return done();
      case 'drums_skip': { const z = s.sections.find(y => y.name === a.section) || MS.sec(); MS.change(x => { x.drums.skip[z.id] = true; }); return done(); }
      case 'effect': { const p = findPart(a.part); if (!p) return MS.toast('That idea did not fit this song.'); MS.change(x => { const t = x.parts.find(y => y.id === p.id); if (a.echo != null) t.echo = Math.max(0, Math.min(0.8, +a.echo)); if (a.rev != null) t.rev = Math.max(0, Math.min(1, +a.rev)); }); return done(); }
      case 'dynamics': { const p = findPart(a.part), z = s.sections.find(y => y.name === a.section) || MS.sec(); if (!p) return; MS.change(x => { x.parts.find(y => y.id === p.id).dyn[z.id] = ['p', 'mf', 'f'].includes(a.level) ? a.level : 'mf'; }); return done(); }
      case 'copy_section': { const z = s.sections.find(y => y.name === a.from) || MS.sec(); S.sec = z.id; MS.a.copySection(); return done(); }
      case 'add_section': MS.change(x => { const id = MS.id('s'), i = x.sections.findIndex(y => y.id === S.sec); x.sections.splice(i + 1, 0, { id, name: String(a.name || 'Chorus').slice(0, 24), bars: [2, 4, 8].includes(+a.bars) ? +a.bars : 4 }); S.sec = id; }); return done();
      case 'bgv': MS.change(x => { const g = x.vocals.bgv; g.on = true; if (a.count) g.count = a.count; if (a.kind) g.type = a.kind; if (a.where) g.where = a.where; }); return done('Background singers set. Press ▶ to hear them.');
      case 'lead': { const z = s.sections.find(y => y.name === a.section); if (!z) return MS.toast('That idea did not fit this song.'); MS.change(x => { x.vocals.lead[z.id] = a.mode; }); return done(); }
      case 'style': if (!MS.STYLES[a.name]) return; if (s.source === 'other' && !S.agreed) return MS.toast('Check the personal-use box first.'); MS.change(x => MS.applyStyle(x, a.name, a.sub && MS.SUBSTYLES[a.name] && MS.SUBSTYLES[a.name][a.sub] ? a.sub : null)); MS.a.playSong(); return done(a.name + ' style applied. Listen!');
      case 'layer': { if (!MS.LAYER_PRESETS[a.preset]) return MS.toast('That layer is not available.'); MS.change(x => { MS.addLayer(x, a.preset); }); return done(a.preset + ' added. It follows your chords.'); }
      case 'buildup': MS.a.buildUp(); return done('Built up. Press Play song.');
      case 'master': MS.change(x => { const m = x.master; if (a.fadeIn != null) m.fadeIn = Math.max(0, Math.min(8, +a.fadeIn)); if (a.fadeOut != null) m.fadeOut = Math.max(0, Math.min(12, +a.fadeOut)); if (a.punch != null) m.punch = Math.max(0, Math.min(1, +a.punch)); if (['Dry', 'Studio', 'Concert hall', 'Church', 'Stadium'].includes(a.room)) m.room = a.room; if (a.vol != null) m.vol = Math.max(0.3, Math.min(1.2, +a.vol)); }); return done();
      default: MS.toast(idea.why || 'Try it!');
    }
  };
})();
