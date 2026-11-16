/* The Music Studio — the Vocal Room: song talk, lyrics with AI options, who carries the tune, lead vocal, background singers. */
(function () {
  const MS = window.MS, S = MS.S, A = () => window.MSA, esc = MS.esc;
  let lyricOpts = {}, busy = false, recState = null;

  MS.screens.vocal = {
    html() {
      if (!S.song) MS.setSong(MS.blankSong());
      const s = S.song, V = s.vocals, sec = MS.sec(), b = V.brief, opts = lyricOpts[sec.id] || [];
      const lead = V.lead[sec.id] || 'voice', locked = !!V.locked[sec.id];
      return `<div class="row small muted" style="margin-bottom:10px"><a href="#" onclick="MS.go('studio');return false">Studio</a><span>›</span><span style="color:var(--ink)">The Vocal Room</span><span style="margin-left:auto">“${esc(s.title)}” · ${esc(s.key)} · ${s.tempo} BPM</span></div>
      <div class="card col"><div class="row" style="justify-content:space-between"><div class="label">1 · The song talk</div><div class="row">${MS.helpBtn('vocal', '? How the Vocal Room works')}${MS.helpBtn('brief')}</div></div>
        <div class="grid">
          <label class="f">What's it about?<textarea rows="2" onchange="MS.a.brief('about',this.value)">${esc(b.about)}</textarea></label>
          <label class="f">Mood<textarea rows="2" onchange="MS.a.brief('mood',this.value)">${esc(b.mood)}</textarea></label>
          <label class="f">Three words that sum it up<textarea rows="2" onchange="MS.a.brief('words',this.value)">${esc(b.words)}</textarea></label></div>
        <div class="tiny muted">Example: “Leaving a light on for someone who moved away” · “warm, hopeful, a little sad” · “home, waiting, summer”. The AI uses this for every lyric idea.</div>
        <div class="row"><button class="btn sm" ${busy ? 'disabled' : ''} onclick="MS.a.briefIdeas()">Stuck? Give me ideas</button></div></div>
      <div class="card col" style="margin-top:12px"><div class="label">2 · Your song map</div>
        <div class="map">${s.sections.map(x => { const st = V.lyrics[x.id] ? (V.locked[x.id] ? 'Locked' : 'Lyrics done') : /intro|outro|solo/i.test(x.name) ? 'Music only' : 'Empty'; return `<button type="button" class="${x.id === sec.id ? 'sel' : ''}" style="flex-grow:${x.bars};background:${MS.SEC_COLOR(x.name)}" onclick="MS.a.pickSection('${x.id}')">${esc(x.name)}<span>${st}</span></button>`; }).join('')}</div></div>
      <div class="split" style="margin-top:12px"><div class="main">
        <div class="card col"><div class="row" style="justify-content:space-between"><div class="label">3 · Lyrics for ${esc(sec.name)} <span class="muted" style="text-transform:none;letter-spacing:0">(${sec.bars} bars)</span></div>${MS.helpBtn('lyrics')}</div>
          <label class="f">Type a line, or describe what happens here<textarea id="lineIn" rows="2">${esc(MS._lineIn && MS._lineIn[sec.id] || '')}</textarea></label>
          <div class="tiny muted">Example: “she leaves, he stays” or “The light stays on no matter how long it takes”.</div>
          <div class="row"><button class="btn primary" ${busy || locked ? 'disabled' : ''} onclick="MS.a.getLyrics()">${busy ? 'Writing…' : opts.length ? '3 more options' : 'Get 3 options'}</button>${locked ? '<span class="small muted">This section is locked.</span>' : ''}</div>
          ${opts.length ? `<div class="grid">${opts.map((o, i) => `<div class="opt ${V.lyrics[sec.id] === o ? 'on' : ''}"><div class="row" style="justify-content:space-between"><span class="tiny" style="color:var(--amber);font-weight:700">OPTION ${i + 1}</span><button class="btn sm ${V.lyrics[sec.id] === o ? 'primary' : ''}" onclick="MS.a.useLyric(${i})">${V.lyrics[sec.id] === o ? 'Chosen' : 'Use this'}</button></div><div class="lyric">${esc(o)}</div></div>`).join('')}</div>` : ''}
          <label class="f">Your lyrics for ${esc(sec.name)} (edit freely)<textarea rows="4" ${locked ? 'readonly' : ''} onchange="MS.a.setLyric(this.value)">${esc(V.lyrics[sec.id] || '')}</textarea></label>
          <div class="row"><button class="btn sm" onclick="MS.a.lock()">${locked ? 'Unlock section' : 'Lock this section'}</button><span class="tiny muted">Locked sections stay exactly as you wrote them.</span></div></div>
        <div class="card col"><div class="row" style="justify-content:space-between"><div class="label">4 · Who carries the tune in ${esc(sec.name)}?</div>${MS.helpBtn('carry')}</div>
          <div class="grid">${[['voice', 'Voice leads', 'You sing the melody. The instruments step back and support you.'], ['music', 'Music leads', 'An instrument plays the melody. Good for intros, solos and breaks.'], ['both', 'Both', 'Voice and the melody instrument play the tune together for a fuller sound.']].map(([k, t, d]) => `<div class="opt ${lead === k ? 'on' : ''}"><b style="font-size:16px">${t}</b><span class="small" style="color:#ddd8cc">${d}</span><div class="row"><button class="btn sm ${lead === k ? 'primary' : ''}" onclick="MS.a.setLead('${k}')">${lead === k ? 'Chosen' : 'Choose'}</button><button class="btn sm" onclick="MS.a.hearLead('${k}')">▶ Hear it</button></div></div>`).join('')}</div>
          <div class="tiny muted">Before you record, “Hear it” uses a built-in voice to show the idea.</div></div>
      </div><div class="side">
        ${leadCard()}
        ${bgvCard()}
      </div></div>` + MS.footer('Vocal Room notes: AI singing voices don\'t sound natural yet, so your lead vocal is your own recording. Background singers are built-in choir voices that follow your melody. AI lyric options are original; they never copy lyrics from published songs. Lyric requests count toward a daily limit. Your recording stays on this device.');
    }
  };
  MS.a.brief = (k, v) => MS.change(s => { s.vocals.brief[k] = v.slice(0, 300); }, { quiet: true });
  MS.a.setLyric = v => MS.change(s => { s.vocals.lyrics[S.sec] = v.slice(0, 1200); }, { quiet: true });
  MS.a.lock = () => MS.change(s => { s.vocals.locked[S.sec] = !s.vocals.locked[S.sec]; });
  MS.a.setLead = k => MS.change(s => { s.vocals.lead[S.sec] = k; });
  MS.a.useLyric = i => { const o = (lyricOpts[S.sec] || [])[i]; if (o) MS.change(s => { s.vocals.lyrics[S.sec] = o; }); };

  MS.a.getLyrics = async function () {
    const s = S.song, sec = MS.sec(), line = (document.getElementById('lineIn') || {}).value || '';
    MS._lineIn = MS._lineIn || {}; MS._lineIn[sec.id] = line;
    if (!s.vocals.brief.about.trim() && !line.trim()) return MS.toast('Tell me what the song is about first (step 1), or type a line.');
    const mel = s.parts.find(p => p.role === 'melody'), notes = (mel && mel.notes[sec.id]) || [];
    const others = {}; s.sections.forEach(x => { if (x.id !== sec.id && s.vocals.lyrics[x.id]) others[x.name] = s.vocals.lyrics[x.id]; });
    busy = true; MS.render();
    try {
      const r = await MS.api({ part: 'lyrics', brief: s.vocals.brief, title: s.title, section: { name: sec.name, bars: sec.bars }, line, others, tempo: s.tempo, ts: s.ts, style: s.style || '', noteCount: notes.filter(n => n.p != null).length, avoid: lyricOpts[sec.id] || [] });
      if (r.options && r.options.length) lyricOpts[sec.id] = r.options.slice(0, 3); else MS.toast(r.message || 'No options came back. Try again.');
    } catch (e) { MS.toast(e.message || 'Lyric ideas are not available right now.'); }
    busy = false; MS.render();
  };
  MS.a.briefIdeas = async function () {
    const s = S.song; busy = true; MS.render();
    try {
      const r = await MS.api({ part: 'brief', brief: s.vocals.brief, title: s.title, style: s.style || '', tempo: s.tempo });
      if (r.about) MS.change(x => { x.vocals.brief = { about: r.about, mood: r.mood || x.vocals.brief.mood, words: r.words || x.vocals.brief.words }; if (r.title && /^My Song$/i.test(x.title)) x.title = r.title; }, { quiet: true });
    } catch (e) { MS.toast(e.message || 'Ideas are not available right now.'); }
    busy = false; MS.render();
  };
  MS.a.hearLead = function (k) {
    const s = MS.playable(), mel = s.parts.find(p => p.role === 'melody'); if (!mel) return;
    if (MS.vbuf) { const v = JSON.parse(JSON.stringify(S.song.vocals)); v.lead[S.sec] = k; return MS.startPlay({ section: S.sec }, Object.assign({}, s, { vocals: Object.assign(v, { leadBuffer: MS.vbuf }) })); }
    const parts = s.parts.map(p => p === mel ? Object.assign({}, p, { mute: k === 'voice' ? true : p.mute }) : p);
    if (k !== 'music') parts.push(Object.assign({}, mel, { id: 'demo', inst: 'Choir', ens: 'solo', vol: 0.9, mute: false, solo: false }));
    if (k === 'voice') parts.forEach(p => { if (p !== mel && p.id !== 'demo') p.vol = (p.vol || 0.8) * 0.75; });
    MS.startPlay({ section: S.sec }, Object.assign({}, s, { parts }));
  };

  // ---------- lead vocal ----------
  function leadCard() {
    const V = S.song.vocals, sec = MS.sec();
    return `<div class="card col"><div class="row" style="justify-content:space-between"><div class="label">5 · Lead vocal</div>${MS.helpBtn('lead')}</div>
      ${recState ? `<div class="small" style="color:var(--coral)">Recording ${recState.section ? '“' + esc(sec.name) + '”' : 'the whole song'}… sing along. Tap Stop when you're done.</div>` : ''}
      <div class="row" style="justify-content:center"><button class="rec ${recState ? 'live' : ''}" onclick="MS.a.recLead(${recState ? 'null' : "'section'"})" aria-label="${recState ? 'Stop recording' : 'Record this section'}">${recState ? 'Stop' : 'Record<br>' + esc(sec.name)}</button></div>
      ${recState ? '' : `<button class="btn sm" onclick="MS.a.recLead('song')">Record the whole song instead</button>`}
      <label class="row small"><input type="checkbox" ${MS._guide !== false ? 'checked' : ''} onchange="MS._guide=this.checked"> Play the melody softly as a guide</label>
      <div class="tiny muted">Use headphones so the music doesn't leak into your mic. You get one bar of clicks first. Recording a section again replaces only that section.</div>
      ${MS.vbuf ? `<div class="row"><button class="btn sm" onclick="MS.a.playSectionV()">▶ Hear ${esc(sec.name)}</button><button class="btn sm" onclick="MS.a.playSong()">▶ Whole song</button><button class="btn sm" onclick="MSA.stop()">■</button></div>
        <label class="f">Voice volume<input type="range" min="0" max="1.5" step="0.05" value="${V.vol}" onchange="MS.change(x=>x.vocals.vol=+this.value,{quiet:true})"></label>
        <label class="f">Echo<input type="range" min="0" max="0.8" step="0.05" value="${V.echo}" onchange="MS.change(x=>x.vocals.echo=+this.value,{quiet:true})"></label>
        <label class="f">Reverb<input type="range" min="0" max="1" step="0.05" value="${V.rev}" onchange="MS.change(x=>x.vocals.rev=+this.value,{quiet:true})"></label>
        <label class="f">Line up with the music <span class="muted" style="text-transform:none">(${Math.round((V.offset || 0) * 1000)} ms)</span><input type="range" min="-0.3" max="0.3" step="0.01" value="${V.offset || 0}" onchange="MS.change(x=>x.vocals.offset=+this.value)"></label>
        <div class="row"><label class="row small"><input type="checkbox" ${V.leadMute ? 'checked' : ''} onchange="MS.change(x=>x.vocals.leadMute=this.checked,{quiet:true})"> Mute my voice</label><button class="btn sm" onclick="MS.a.delVocal()">Delete recording</button></div>` : ''}
    </div>`;
  }
  MS.a.playSectionV = () => MS.startPlay({ section: S.sec });
  MS.a.recLead = async function (mode) {
    if (recState) { // stop
      const st = recState; recState = null; A().stop(); const rec = MSP.stop(); MS.render(); placeTake(st, rec); return;
    }
    if (!MSP.supported()) return MS.toast('This browser cannot use the microphone.');
    try {
      const s = S.song, ctx = A().ctx();
      const r0 = await MSP.start();
      const song = MS.playable(); song.vocals = Object.assign({}, song.vocals, { leadBuffer: null });
      if (MS._guide === false) song.parts = song.parts.map(p => p.role === 'melody' ? Object.assign({}, p, { mute: true }) : p);
      else song.parts = song.parts.map(p => p.role === 'melody' ? Object.assign({}, p, { vol: (p.vol || .8) * 0.45 }) : p);
      const h = A().play(song, { section: mode === 'section' ? S.sec : null, countIn: true });
      const tl = A().timeline(s), secStart = mode === 'section' ? tl.secs.find(x => x.sec.id === S.sec).start : 0;
      const lenBeats = mode === 'section' ? tl.secs.find(x => x.sec.id === S.sec).len : tl.total;
      recState = { section: mode === 'section', r0, startAt: h.startAt, secStart, lenBeats, spb: 60 / s.tempo, lat: (ctx.outputLatency || 0) + (ctx.baseLatency || 0) + 0.02 };
      MS.render();
      const stopAt = (h.end - ctx.currentTime + 0.4) * 1000;
      setTimeout(() => { if (recState && recState.startAt === h.startAt) MS.a.recLead(null); }, stopAt);
    } catch (e) { console.error(e); MS.toast('Microphone blocked. Allow the mic in your browser settings and try again.'); }
  };
  function placeTake(st, rec) {
    const s = S.song, sr = rec.sampleRate, total = A().timeline(s).total * st.spb + 2;
    let buf = MS.vbuf;
    if (!buf || buf.sampleRate !== sr || buf.duration < total) {
      const nb = A().ctx().createBuffer(1, Math.ceil(total * sr), sr);
      if (buf && buf.sampleRate === sr) nb.getChannelData(0).set(buf.getChannelData(0).subarray(0, Math.min(buf.length, nb.length)));
      buf = nb;
    }
    const from = Math.max(0, Math.round((st.startAt - st.r0 + st.lat) * sr));
    const dst = Math.round(st.secStart * st.spb * sr), n = Math.min(Math.round((st.lenBeats * st.spb + (st.section ? 0.3 : 2)) * sr), rec.data.length - from, buf.length - dst);
    if (n < sr * 0.3) return MS.toast('The recording was too short. Try again.');
    const d = buf.getChannelData(0);
    // short fade in/out so punch-ins don't click
    const fade = Math.min(400, n >> 2);
    for (let i = 0; i < n; i++) { let g = 1; if (i < fade) g = i / fade; else if (i > n - fade) g = (n - i) / fade; d[dst + i] = rec.data[from + i] * g + (i < fade || i > n - fade ? d[dst + i] * (1 - g) : 0); }
    MS.vbuf = buf; saveVocal();
    MS.change(x => { x.vocals.leadMute = false; Object.assign(x.vocals.lead, Object.fromEntries(x.sections.map(z => [z.id, x.vocals.lead[z.id] || 'voice']))); });
    MS.toast('Got it. Press ▶ to hear it with the music.');
  }
  MS.a.delVocal = function () { if (!confirm('Delete your recorded vocal?')) return; MS.vbuf = null; saveVocal(); MS.render(); };

  // keep the recording on this device between visits (IndexedDB)
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open('musicstudio', 1); r.onupgradeneeded = () => r.result.createObjectStore('v'); r.onsuccess = () => res(r.result); r.onerror = rej; }); }
  async function saveVocal() {
    try { const db = await idb(), tx = db.transaction('v', 'readwrite'); const k = 'lead:' + (S.song && S.song.id); if (MS.vbuf) tx.objectStore('v').put({ sr: MS.vbuf.sampleRate, data: MS.vbuf.getChannelData(0).slice() }, k); else tx.objectStore('v').delete(k); } catch (e) { }
  }
  MS.delVocal = async function (id) { try { const db = await idb(); db.transaction('v', 'readwrite').objectStore('v').delete('lead:' + id); } catch (e) { } };
  MS.loadVocal = async function () {
    try {
      const id = S.song && S.song.id; if (!id) return;
      const db = await idb(), st = db.transaction('v', 'readwrite').objectStore('v');
      // one-time move of an older single recording onto the open song
      const old = st.get('lead'); old.onsuccess = () => { if (old.result) { st.put(old.result, 'lead:' + id); st.delete('lead'); } };
      const r = st.get('lead:' + id);
      r.onsuccess = () => { const v = r.result || old.result; if (!v || !S.song || S.song.id !== id) return; const ctx = A().ctx(); const b = ctx.createBuffer(1, v.data.length, v.sr); b.getChannelData(0).set(v.data); MS.vbuf = b; if (S.screen === 'vocal') MS.render(); };
    } catch (e) { }
  };

  // ---------- background singers ----------
  function bgvCard() {
    const g = S.song.vocals.bgv;
    return `<div class="card col"><div class="row" style="justify-content:space-between"><div class="label">6 · Background singers</div>${MS.helpBtn('bgv')}</div>
      <label class="row small"><input type="checkbox" ${g.on ? 'checked' : ''} onchange="MS.a.bgv('on',this.checked)"> Add background singers</label>
      <div class="col" style="${g.on ? '' : 'opacity:.5;pointer-events:none'}">
      <div class="level">How many</div>${MS.seg(['One', 'A trio', 'A group'], g.count, "MS.a.bgv('count',")}
      <div class="level">What they sing</div>${MS.seg(['Oohs', 'Aahs', 'Harmony', 'Echo last word', 'Call and response'], g.type, "MS.a.bgv('type',")}
      <div class="level">Where</div>${MS.seg(['Chorus only', 'Every section', 'Pick sections'], g.where, "MS.a.bgv('where',")}
      ${g.where === 'Pick sections' ? `<div class="row" style="gap:6px">${S.song.sections.map(x => `<button class="pill ${(g.picked || []).includes(x.id) ? 'on' : ''}" onclick="MS.a.bgvPick('${x.id}')">${esc(x.name)}</button>`).join('')}</div>` : ''}
      <div class="level">Blend</div>${MS.seg(['Soft behind', 'Even', 'Big and bold'], g.blend, "MS.a.bgv('blend',")}
      <div class="row"><button class="btn sm" onclick="MS.a.hearBgv()">▶ Hear them in ${esc(MS.sec().name)}</button></div>
      <div class="tiny muted">One singer adds a single harmony. A trio sings three parts. A group doubles the trio for a choir feel. Oohs and Aahs follow your chords; Harmony follows the melody.</div></div></div>`;
  }
  MS.a.bgv = (k, v) => MS.change(s => { s.vocals.bgv[k] = v; if (k !== 'on') s.vocals.bgv.on = true; });
  MS.a.bgvPick = id => MS.change(s => { const p = s.vocals.bgv.picked = s.vocals.bgv.picked || []; const i = p.indexOf(id); i < 0 ? p.push(id) : p.splice(i, 1); });
  MS.a.hearBgv = function () {
    const s = MS.playable(); s.vocals = Object.assign({}, s.vocals, { bgv: Object.assign({}, s.vocals.bgv, { on: true, where: 'Every section' }) });
    MS.startPlay({ section: S.sec }, s);
  };
})();
