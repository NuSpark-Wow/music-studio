/* The Music Studio — Mr. Paul, the music teacher.
   One bar at the bottom of every room: the NEXT STEP (one clear instruction), Show me (lights up the exact button),
   Do it for me, Help (one place for all help + ask a question), and Ideas (the 3 suggestions).
   Basic = step by step, firm and plain. Moderate = steps plus the why. Advanced = short steps, ideas up front.
   Nothing here is saved: steps are worked out from the song itself every time. */
(function () {
  const MS = window.MS, S = MS.S, esc = MS.esc, C = MS.coach;
  const T = MS.teacher = { ideas: false, heard: {}, skip: {}, dl: {} };
  const sid = () => (S.song && S.song.id) || 'none';
  const lvl = () => S.level || 'Basic';

  // ---------- song checks ----------
  const mel = s => s.parts.find(p => p.role === 'melody');
  const har = s => s.parts.find(p => p.role === 'harmony');
  const bas = s => s.parts.find(p => p.role === 'bass');
  const count = (p, id) => p ? (p.notes[id] || []).filter(n => n.p != null).length : 0;
  const beats = (p, id) => p ? (p.notes[id] || []).reduce((a, n) => a + n.d, 0) : 0;
  const anyNotes = p => p && Object.values(p.notes).some(l => l.some(n => n.p != null));
  const skipped = k => !!(T.skip[sid()] || {})[k];

  // the lessons, in class order (matches The Music Room)
  const LESSONS = [['names', 'Notes on the staff', 3], ['highlow', 'High and low', 2], ['lengths', 'How long does a note last?', 3], ['tempo', 'Tempo and the beat', 2], ['dynamics', 'Loud and soft', 2], ['melody', 'Write a melody', 4], ['chords', 'Chords and “home”', 3], ['harmony', 'Add a harmony', 3], ['structure', 'Intro, verse, chorus, bridge', 3], ['arrange', 'Section or soloist, echo and reverb', 3]];
  const lessonDone = id => { try { return !!(JSON.parse(localStorage.getItem('musicstudio.room') || '{}'))[id]; } catch (e) { return false; } };

  // ---------- the song path: every step a teacher would walk you through ----------
  function songSteps() {
    const s = S.song, L = lvl(), first = s.sections[0], m = mel(s), h = har(s), b = bas(s);
    const chorus = s.sections.find(x => /chorus/i.test(x.name));
    const need = Math.max(4, Math.round(first.bars * s.ts * 0.75));
    const list = [
      {
        id: 'melody', screen: 'studio', done: () => count(m, first.id) >= 4,
        say: { Basic: `Let's write your tune. Tap 4 piano keys, one at a time. Try C, D, E, G.`, Moderate: `Write the melody for ${first.name}: tap the piano keys or the staff.`, Advanced: `Write the ${first.name} melody.` },
        why: `Each tap adds a note to the staff. Higher on the staff = higher sound. Tap a note on the staff to move it.`,
        target: { sel: '.keys.pk' }, before: () => { if (S.sec !== first.id) MS.a.pickSection(first.id); }
      },
      {
        id: 'fill', screen: 'studio', done: () => beats(m, first.id) >= need,
        say: { Basic: `Good start! Now fill ${first.name}: add about ${Math.max(2, Math.ceil((need - beats(m, first.id))))} more notes.`, Moderate: `Fill ${first.name}: about ${Math.ceil(need - beats(m, first.id))} more beats of melody.`, Advanced: `Fill out ${first.name}.` },
        why: `Watch the line under the staff: it counts the beats you've filled.`,
        target: { sel: m ? `.staffbox[data-pid="${m.id}"]` : '.staffbox' }
      },
      {
        id: 'listen', screen: 'studio', done: () => !!T.heard[sid()],
        say: { Basic: `Now listen. Press ▶ Play ${first.name}.`, Moderate: `Play ${first.name} and listen. Fix any note that sounds wrong.`, Advanced: `Play it back.` },
        why: `Tap any note to move it up or down. Undo is always at the bottom.`,
        target: { text: '▶ Play ' }, act: ['Play it for me', () => { MS.a.playSection(); T.heard[sid()] = true; C.render(); }]
      },
      {
        id: 'chords', screen: 'studio', done: () => s.sections.some(x => (s.chords[x.id] || []).some(Boolean)),
        say: { Basic: `Time for chords: the background color of your song. Press "Add chords for me".`, Moderate: `Add chords. Press Suggest chords and I'll pick ones that fit your melody.`, Advanced: `Chords: suggest them or type your own.` },
        why: `Chords tell the bass, the layers and the background singers what to play.`,
        target: L === 'Basic' ? null : { text: 'Suggest chords' },
        act: ['Add chords for me', () => { MS.change(x => { x.sections.forEach(z => { if (!(x.chords[z.id] || []).some(Boolean)) x.chords[z.id] = MS.suggestChords(x, z.id); }); x.chordPart.on = true; }); MS.toast('Chords added to every section. Press ▶ Play to hear them.'); }]
      },
      {
        id: 'chorus', screen: 'studio', done: () => chorus && count(m, chorus.id) >= 4,
        say: { Basic: `Now the chorus: the catchy part that repeats. Tap the Chorus block, then tap 4 piano keys.`, Moderate: `Write the chorus. Make it catchier than the verse: a little higher or a little longer.`, Advanced: `Write the chorus.` },
        why: `Tip: start the chorus a few notes higher than the verse. It lifts the song.`,
        target: { text: 'Chorus' },
        act: chorus ? ['Take me to the Chorus', () => { MS.go('studio'); MS.a.pickSection(chorus.id); }] : ['Add a chorus', () => { MS.change(x => { const id = MS.id('s'); x.sections.push({ id, name: 'Chorus', bars: 4 }); S.sec = id; }); }]
      },
      {
        id: 'drums', screen: 'studio', done: () => s.drums.style !== 'None',
        say: { Basic: `Give it a beat. Press "Add a beat for me", or pick one under Drums.`, Moderate: `Add drums. Pop fits most songs; Soft ballad for slow ones.`, Advanced: `Pick a drum groove.` },
        why: `Drums give your song its pulse and its style.`,
        target: { label: 'Drums' },
        act: ['Add a beat for me', () => { const st = s.tempo < 85 ? 'Soft ballad' : 'Pop'; MS.change(x => { x.drums.style = st; }); MS.toast(st + ' beat added. Press ▶ Play song.'); }]
      }
    ];
    if (L !== 'Basic') list.push(
      {
        id: 'harmony', screen: 'studio', done: () => anyNotes(h) || !h,
        say: { Moderate: `Add a harmony. Press Suggest a harmony: it follows your melody.`, Advanced: `Harmony: suggest one or write your own line.` },
        why: `A third below the melody is the classic, warm choice.`,
        target: { text: 'Suggest a harmony' }, act: h ? ['Show me the choices', () => { MS.go('studio'); MS.a.harmony(h.id); }] : null
      },
      {
        id: 'bass', screen: 'studio', done: () => anyNotes(b) || !b,
        say: { Moderate: `Add a bass line. Press Make a bass line: it's built from your chords.`, Advanced: `Bass line.` },
        why: `The bass holds the song up from underneath.`,
        target: { text: 'Make a bass line' }, act: ['Show me the choices', () => { MS.go('studio'); MS.a.bassLine(); }]
      }
    );
    list.push(
      {
        id: 'layer', screen: 'control', skip: true, done: () => skipped('layer') || (s.layers || []).length > 0,
        say: { Basic: `Make it sound full. In the Control Room, press + Add a layer and pick String pad.`, Moderate: `Add a background layer in the Control Room: a pad or a strum under your chords.`, Advanced: `Layers, build grid and mix.` },
        why: `Layers play your chords automatically. Two is plenty.`,
        target: { text: '+ Add a layer' }, act: ['Take me there', () => { MS.go('control'); setTimeout(() => T.show(), 350); }]
      },
      {
        id: 'save', screen: 'save', done: () => !!T.dl[sid()],
        say: { Basic: `Your song is ready! Go to Save and download, and press Download MP3.`, Moderate: `Download your MP3 and sheet music.`, Advanced: `Export: MP3, WAV, sheet music.` },
        why: `Give it a title first. Your name goes on the file.`,
        target: { text: 'Download MP3' }, act: ['Take me there', () => { MS.go('save'); setTimeout(() => T.show(), 350); }]
      }
    );
    return list;
  }

  // works out the one next step for where you are right now
  T.next = function () {
    const L = lvl();
    if (S.screen === 'room') {
      if (S.arg) {
        const i = LESSONS.findIndex(x => x[0] === S.arg), nx = LESSONS[i + 1];
        return { k: 'NOW', say: `Read the top, then do the "Your turn" part. ${lessonDone(S.arg) ? 'You passed this one ✓.' : 'Get it right to pass.'}`, why: nx ? `When you're done, press Next: ${nx[1]}.` : `That's the last lesson. Next, make a real song.`, act: nx ? [lessonDone(S.arg) ? 'Next lesson ▶' : 'Skip to next lesson', () => MS.go('room', nx[0])] : ['Make a song now', () => MS.a.newSong()] };
      }
      const nx = LESSONS.find(x => !lessonDone(x[0])), n = LESSONS.filter(x => lessonDone(x[0])).length;
      if (!nx) return { k: 'CLASS DONE', say: `You finished every lesson. Now make your own song.`, act: ['Make a song with me', () => MS.a.newSong()] };
      return { k: `LESSON ${n + 1} OF ${LESSONS.length}`, n, total: LESSONS.length, say: n ? `Welcome back. Next up: "${nx[1]}". About ${nx[2]} minutes.` : `Start at the beginning: "${nx[1]}". About ${nx[2]} minutes.`, why: `One lesson at a time. Each one ends with a quick "Your turn".`, target: { text: nx[1] }, act: ['Start the lesson', () => MS.go('room', nx[0])] };
    }
    if (!S.song) return { k: 'START HERE', say: L === 'Basic' ? `New to music? Press "Teach me music". Ready to make a song? Press "Make a song with me".` : `Start a song, or take a quick lesson first.`, target: { sel: '.door.song' }, act: ['Make a song with me', () => MS.a.newSong()] };
    if (S.screen === 'home') return { k: 'WELCOME BACK', say: `Let's keep going on “${S.song.title}”.`, act: ['Continue my song', () => MS.go('studio')] };
    const list = songSteps(), i = list.findIndex(x => !x.done());
    if (i < 0) return { k: 'SONG DONE 🎉', say: `You made a finished song! Want to hear it a new way? Try Restyle: R&B, classical, rock and more.`, act: ['Try Restyle', () => MS.go('restyle')] };
    const st = list[i], away = st.screen !== S.screen && !(st.screen === 'studio' && ['words', 'restyle'].includes(S.screen));
    let act = st.act;
    if (away && (!act || !/Take me|Show me/.test(act[0]))) act = ['Take me there', () => { MS.go(st.screen); setTimeout(() => T.show(), 350); }];
    if (!act && st.target) act = ['Show me', () => T.show()];
    return { k: L === 'Moderate' ? `COACH'S NEXT MOVE · ${i + 1} OF ${list.length}` : `STEP ${i + 1} OF ${list.length}`, n: i, total: list.length, id: st.id, say: st.say[L] || st.say.Moderate, why: L === 'Advanced' ? '' : st.why, target: away ? null : st.target, act, skip: st.skip, before: st.before };
  };

  // ---------- light up the button the step is about ----------
  function find(t) {
    if (!t) return null;
    if (t.sel) return [...document.querySelectorAll(t.sel)].find(vis) || null;
    if (t.label) { const l = [...document.querySelectorAll('#app .label')].find(x => vis(x) && x.textContent.trim().toLowerCase().startsWith(t.label.toLowerCase())); return l ? l.closest('.card') || l : null; }
    if (t.text) return [...document.querySelectorAll('#app button')].find(x => vis(x) && x.innerText.trim().startsWith(t.text)) || null;
    return null;
  }
  const vis = el => el && el.offsetParent !== null;
  function clearSpot() { document.querySelectorAll('.tspot').forEach(x => x.classList.remove('tspot')); }
  T.show = function () {
    const st = T.next(); if (st.before) st.before();
    setTimeout(() => {
      const st2 = T.next(), el = find(st2.target);
      if (!el) { if (st2.act) return st2.act[1](); return MS.toast(st2.say, 5000); }
      clearSpot(); el.classList.add('tspot'); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const off = () => { clearSpot(); document.removeEventListener('pointerdown', off, true); };
      setTimeout(() => document.addEventListener('pointerdown', off, true), 50); setTimeout(off, 8000);
    }, st.before ? 120 : 0);
  };
  function pulse(st) {
    document.querySelectorAll('.tpulse').forEach(x => x.classList.remove('tpulse'));
    if (lvl() !== 'Basic' || C.min) return;
    const el = find(st.target); if (el) el.classList.add('tpulse');
  }
  T.act = function () { const st = T.next(); if (st.act) st.act[1](); };
  T.skipStep = function () { const st = T.next(); if (!st.id) return; (T.skip[sid()] = T.skip[sid()] || {})[st.id] = 1; MS.toast('Skipped. You can come back to it anytime.'); C.render(); };

  // ---------- Mr. Paul (cartoon teacher) ----------
  const FACE = `<svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#2a2433" stroke="#f2b33d" stroke-width="2"/><path d="M14 58c3-11 10-15 18-15s15 4 18 15" fill="#4fc3b8"/><path d="M27 44l5 6 5-6-5 3z" fill="#f2b33d"/><circle cx="32" cy="27" r="13" fill="#e8b98e"/><path d="M19 24c0-9 6-13 13-13s13 4 13 12c-3-4-8-5-13-5s-10 1-13 6z" fill="#5a4a3e"/><circle cx="27" cy="27" r="3.6" fill="none" stroke="#1d1f25" stroke-width="1.6"/><circle cx="37" cy="27" r="3.6" fill="none" stroke="#1d1f25" stroke-width="1.6"/><path d="M30.6 27h2.8" stroke="#1d1f25" stroke-width="1.6"/><circle cx="27" cy="27" r="1.1" fill="#1d1f25"/><circle cx="37" cy="27" r="1.1" fill="#1d1f25"/><path d="M27.5 33c2.5 2.5 6.5 2.5 9 0" stroke="#7a3e1d" stroke-width="1.8" fill="none" stroke-linecap="round"/><g fill="#f2b33d"><ellipse cx="52" cy="16" rx="3.4" ry="2.6" transform="rotate(-20 52 16)"/><rect x="54.6" y="4" width="1.6" height="12"/></g></svg>`;

  // ---------- the bar (replaces the old suggestions bar) ----------
  C.render = function () {
    let el = document.getElementById('sugg');
    if (!el) { el = document.createElement('div'); el.id = 'sugg'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Mr. Paul, your music teacher'); document.body.appendChild(el); }
    const key = S.screen + '|' + (S.sec || '') + '|' + (S.song ? S.song.id : '');
    if (key !== C.key) { C.key = key; C.ideas = []; C.fill(true); }
    if (!C.ideas.length) C.ideas = C.local().slice(0, 3);
    const st = T.next(), L = lvl();
    el.className = 'sugg teach' + (C.min ? ' min' : '') + ' lv-' + L.toLowerCase();
    // Advanced: Mr. Paul stays on call and only walks you through steps when you ask
    if (L === 'Advanced' && !T.guide) {
      el.innerHTML = `${T.ideas && !C.min ? ideasHtml() : ''}<div class="in">
        <button class="tface" onclick="MS.teacher.help()" aria-label="Help from Mr. Paul">${FACE}<span>Mr. Paul</span></button>
        <div class="tmsg"><div class="tk">ON CALL</div><div class="tsay">Need a hand? Ask me anything, or let me suggest your next move.</div></div>
        <div class="tact"><button class="btn primary" onclick="MS.teacher.help()">💬 Ask Mr. Paul</button><button class="btn" onclick="MS.teacher.guide=true;MS.coach.render()">Next move</button></div>
        <div class="ttools"><button class="btn sm thelp" onclick="MS.teacher.help()">❓ Help</button><button class="btn sm tidea ${T.ideas ? 'open' : ''}" onclick="MS.teacher.toggleIdeas()">💡 Ideas</button><button class="btn sm" onclick="MS.undo()">Undo</button><button class="btn sm ghost" onclick="MS.coach.toggle()">${C.min ? 'Show' : 'Hide'}</button></div></div>`;
      return;
    }
    const pct = st.total ? Math.round((st.n || 0) / st.total * 100) : 0;
    const ideas = ideasHtml();
    function _unused(){ return `<div class="tideas"><div class="row" style="justify-content:space-between;gap:8px"><b style="color:var(--violet)">💡 Ideas for “${esc(S.song ? S.song.title : 'your song')}” ${C.loading ? '…' : ''}</b><div class="row" style="gap:6px"><button class="btn sm" onclick="MS.coach.more()">3 more</button><button class="btn sm" onclick="MS.coach.ask()">Ask for an idea</button><button class="btn sm ghost" onclick="MS.teacher.toggleIdeas()">Close</button></div></div>
      <div class="chips row" style="gap:8px">${C.ideas.map((i, k) => `<button class="chip" onclick="MS.coach.apply(${k})">${esc(i.label)}<small>${esc(i.why || '')}</small></button>`).join('')}${C.wordChip()}</div><div class="tiny muted">Tap an idea to try it. Don't like it? Press Undo.</div></div>`; }
    el.innerHTML = `${T.ideas && !C.min ? ideas : ''}<div class="in">
      <button class="tface" onclick="MS.teacher.help()" aria-label="Help from Mr. Paul">${FACE}<span>Mr. Paul</span></button>
      <div class="tmsg"><div class="tk">${esc(st.k)}${st.total ? `<span class="tbar"><i style="width:${pct}%"></i></span>` : ''}</div><div class="tsay">${esc(st.say)}</div>${st.why && L !== 'Advanced' && !C.min ? `<div class="twhy">${esc(st.why)}</div>` : ''}</div>
      <div class="tact">${st.act ? `<button class="btn primary" onclick="MS.teacher.act()">${esc(st.act[0])}</button>` : ''}${st.target && !/Show me/.test(st.act ? st.act[0] : '') ? `<button class="btn" onclick="MS.teacher.show()">👆 Show me</button>` : ''}${st.skip ? `<button class="btn sm ghost" onclick="MS.teacher.skipStep()">Skip</button>` : ''}</div>
      <div class="ttools"><button class="btn sm thelp" onclick="MS.teacher.help()">❓ Help</button><button class="btn sm tidea ${T.ideas ? 'open' : ''}" onclick="MS.teacher.toggleIdeas()">💡 Ideas</button><button class="btn sm" onclick="MS.undo()">Undo</button>${L === 'Advanced' ? `<button class="btn sm ghost" onclick="MS.teacher.guide=false;MS.coach.render()">Quiet</button>` : ''}<button class="btn sm ghost" onclick="MS.coach.toggle()" aria-label="${C.min ? 'Show Mr. Paul' : 'Make Mr. Paul smaller'}">${C.min ? 'Show' : 'Hide'}</button></div></div>`;
    pulse(st);
  };
  function ideasHtml() {
    return `<div class="tideas"><div class="row" style="justify-content:space-between;gap:8px"><b style="color:var(--violet)">💡 Ideas for “${esc(S.song ? S.song.title : 'your song')}” ${C.loading ? '…' : ''}</b><div class="row" style="gap:6px"><button class="btn sm" onclick="MS.coach.more()">3 more</button><button class="btn sm" onclick="MS.coach.ask()">Ask for an idea</button><button class="btn sm ghost" onclick="MS.teacher.toggleIdeas()">Close</button></div></div>
      <div class="chips row" style="gap:8px">${C.ideas.map((i, k) => `<button class="chip" onclick="MS.coach.apply(${k})">${esc(i.label)}<small>${esc(i.why || '')}</small></button>`).join('')}${C.wordChip()}</div><div class="tiny muted">Tap an idea to try it. Don't like it? Press Undo.</div></div>`;
  }
  T.toggleIdeas = function () { T.ideas = !T.ideas; if (T.ideas) { C.min = false; if (!C.ideas.length) C.ideas = C.local().slice(0, 3); } C.render(); };

  // ---------- one place for help ----------
  const ROOM_TOPICS = { home: ['rooms', 'level', 'mysongs'], studio: ['studio', 'songmap', 'addnotes', 'lengths', 'chords', 'harmony', 'bass', 'drums'], vocal: ['vocal', 'lyrics', 'record', 'bgv'], control: ['control', 'layers', 'grid', 'board', 'master'], restyle: ['restyle'], save: ['save'], room: ['room'], words: ['rooms'] };
  T.help = function () {
    const st = T.next(), H = MS.HELP || {}, topics = (ROOM_TOPICS[S.screen] || ['rooms']).filter(k => H[k]);
    MS.modal(`<div class="row" style="justify-content:space-between;align-items:center"><div class="row" style="gap:10px">${FACE}<div><h2 style="margin:0">Help from Mr. Paul</h2><div class="tiny muted">Ask me anything about music or this tool.</div></div></div><button class="btn sm ghost" onclick="MS.closeModal()">Close</button></div>
      <div class="card col" style="margin-top:12px;border-color:var(--amber)"><div class="label">What to do right now</div><div style="font-size:16px;line-height:1.5">${esc(st.say)}</div>${st.why ? `<div class="small" style="color:var(--teal)">${esc(st.why)}</div>` : ''}
        <div class="row">${st.target ? `<button class="btn primary" onclick="MS.closeModal();MS.teacher.show()">👆 Show me where</button>` : ''}${st.act ? `<button class="btn" onclick="MS.closeModal();MS.teacher.act()">${esc(st.act[0])}</button>` : ''}</div></div>
      <div class="card col" style="margin-top:12px"><div class="label">Ask me a question</div><div class="tiny muted">For example: what's a chorus? why does my melody sound sad? how do I make it longer?</div>
        <div class="row" style="flex-wrap:nowrap"><input id="tAsk" maxlength="240" style="flex:1;min-height:44px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);padding:0 12px;font-size:15px"><button class="btn primary" onclick="MS.teacher.askQ()">Ask</button></div>
        <div id="tAns"></div></div>
      ${topics.length ? `<div class="card col" style="margin-top:12px"><div class="label">How this room works</div><div class="row">${topics.map(k => `<button class="pill" onclick="MS.help('${k}')">${esc(H[k].t)}</button>`).join('')}</div></div>` : ''}
      <div class="card col" style="margin-top:12px"><div class="label">Too hard or too easy?</div><div class="row">${['Basic', 'Moderate', 'Advanced'].map(l => `<button class="pill amber ${l === S.level ? 'on' : ''}" onclick="MS.a.level('${l}');MS.teacher.help()">${l}</button>`).join('')}</div><div class="tiny muted">${{ Basic: 'Basic: one step at a time, fewer buttons, note names shown.', Moderate: 'Moderate: chords, harmony, bass, effects and the song map.', Advanced: 'Advanced: everything, including the full mixer, sharps and flats, and loudness marks.' }[S.level]} Changing levels never changes your song.</div></div>
      <div class="row" style="margin-top:12px"><button class="btn" onclick="MS.closeModal();MS.go('words')">📖 Studio Talk: music words explained</button></div>`);
    setTimeout(() => { const i = document.getElementById('tAsk'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter') T.askQ(); }; } }, 30);
  };
  T.askQ = async function () {
    const i = document.getElementById('tAsk'), out = document.getElementById('tAns'); if (!i || !out) return;
    const q = i.value.trim(); if (!q) return;
    out.innerHTML = `<div class="small muted">Mr. Paul is thinking…</div>`;
    try {
      const r = await MS.api({ part: 'teacher', q, level: S.level, screen: S.screen, step: T.next().say, song: S.song ? C.summary() : null });
      out.innerHTML = `<div style="font-size:15px;line-height:1.55;margin-top:6px">${esc(r.answer || '')}</div>${(r.steps || []).length ? `<ol style="margin:6px 0 0;padding-left:20px;line-height:1.6">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}${r.word && MS.WORDS && MS.WORDS[r.word] ? `<button class="pill" style="margin-top:8px" onclick="MS.word(${esc(JSON.stringify(r.word))})">📖 ${esc(r.word)}</button>` : ''}`;
    } catch (e) { out.innerHTML = `<div class="small" style="color:var(--coral)">${esc(e.message)}</div>`; }
  };

  // ---------- notice when things happen ----------
  const wrap = (name, fn) => { const o = MS.a[name]; if (typeof o !== 'function') return; MS.a[name] = function () { const r = o.apply(this, arguments); try { fn(); } catch (e) { } return r; }; };
  wrap('playSection', () => { T.heard[sid()] = true; setTimeout(() => C.render(), 0); });
  wrap('play', () => { T.heard[sid()] = true; setTimeout(() => C.render(), 0); });
  wrap('mp3', () => { T.dl[sid()] = true; setTimeout(() => C.render(), 0); });
  wrap('wav', () => { T.dl[sid()] = true; setTimeout(() => C.render(), 0); });
  // the old floating guided path is replaced by Mr. Paul's steps
  MS.a.firstSong = function () { MS.a.newSong(); C.min = false; C.render(); setTimeout(() => T.show(), 400); };
})();
