// The Music Studio — AI helper.
// Parts (POST JSON with "part"):
//   suggest { song, ask, avoid }  -> 3 ideas, each with an action the app can apply in one tap
//   lyrics  { brief, title, section, line, others, tempo, ts, style, noteCount, avoid } -> 3 original lyric options
//   brief   { brief, title, style, tempo } -> fills in what the song is about, mood and three words
// Env: ANTHROPIC_API_KEY (required), CLAUDE_MODEL (lyrics, default Sonnet), CLAUDE_FAST_MODEL (suggestions, default Haiku)
// Nothing about users is stored.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const FAST = process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5";
const HOURLY_LIMIT = 120;
const hits = new Map();

const INSTRUMENTS = ["Grand piano", "Electric piano", "Organ", "Harpsichord", "Celesta", "Violins", "Violas", "Cellos", "Double bass", "Harp", "Flute", "Oboe", "Clarinet", "Bassoon", "Trumpet", "French horn", "Trombone", "Tuba", "Glockenspiel", "Timpani", "Acoustic guitar", "Electric guitar", "Bass guitar", "Synth", "Choir", "Spanish guitar", "Marimba", "Sitar", "Tanpura", "Bansuri", "Oud", "Koto", "Guzheng", "Erhu", "Shakuhachi", "Kalimba", "Steel drums", "Bagpipes", "Tin whistle", "Fiddle", "Banjo", "Harmonica", "Accordion"];
const DRUMS = ["None", "Pop", "Rock", "Soft ballad", "R&B", "Hip-hop", "Jazz swing", "Country", "Waltz", "March", "Latin", "Reggae"];
const STYLES = ["Pop", "R&B", "Rock", "Jazz swing", "Classical", "Full orchestra", "Country", "Hip-hop", "Soft ballad", "March", "World"];

async function anthropic(body) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error("api_" + r.status + " " + t.slice(0, 200)); }
  return r.json();
}
async function callTool(system, tool, user, maxTokens, check, model) {
  const m = model || MODEL;
  const data = await anthropic({
    model: m, max_tokens: maxTokens, system,
    ...(/haiku/i.test(m) ? { thinking: { type: "disabled" } } : {}),
    tools: [tool], tool_choice: { type: "auto" },
    messages: [{ role: "user", content: user }]
  });
  const block = (data.content || []).find(b => b.type === "tool_use");
  if (block && block.input) { const inp = unstring(block.input); if (check(inp)) return inp; }
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) { const j = JSON.parse(txt.slice(s, e + 1)); if (check(j)) return j; }
  throw new Error("bad_shape");
}
// some models send nested arrays/objects as JSON text; turn them back into real values
function unstring(o) {
  if (typeof o === "string") { const t = o.trim(); if ((t[0] === "[" && t.endsWith("]")) || (t[0] === "{" && t.endsWith("}"))) { try { return unstring(JSON.parse(t)); } catch (e) { return o; } } return o; }
  if (Array.isArray(o)) return o.map(unstring);
  if (o && typeof o === "object") { const r = {}; for (const k in o) r[k] = unstring(o[k]); return r; }
  return o;
}
async function tryTwice(fn, first, second) {
  try { return await fn(first); } catch (e) { console.error("retry:", e.message); return await fn(second); }
}
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
function limited(req) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
  const now = Date.now(), hr = 3600e3;
  const list = (hits.get(ip) || []).filter(t => now - t < hr);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > HOURLY_LIMIT;
}

// ---------- suggestions ----------
const SUGGEST_TOOL = {
  name: "ideas",
  description: "Exactly three short, specific ideas for the song, each with an action the app can apply.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array", minItems: 3, maxItems: 3,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "The idea as a short button label, max 40 characters, starting with a verb. e.g. 'Make the harmony a cello section'" },
            why: { type: "string", description: "Why it helps, max 45 characters, plain words" },
            action: {
              type: "object",
              description: "One of the action types listed in the instructions, with only the fields that type uses",
              properties: {
                type: { type: "string" }, value: { type: "number" }, part: { type: "string" }, inst: { type: "string" }, ens: { type: "string" }, size: { type: "string" }, artic: { type: "string" },
                kind: { type: "string" }, all: { type: "boolean" }, style: { type: "string" }, section: { type: "string" }, from: { type: "string" }, name: { type: "string" }, bars: { type: "number" },
                count: { type: "string" }, where: { type: "string" }, mode: { type: "string" }, screen: { type: "string" }, text: { type: "string" }, echo: { type: "number" }, rev: { type: "number" }, level: { type: "string" },
                preset: { type: "string" }, sub: { type: "string" }, fadeIn: { type: "number" }, fadeOut: { type: "number" }, punch: { type: "number" }, room: { type: "string" }, vol: { type: "number" }
              },
              required: ["type"]
            }
          },
          required: ["label", "why", "action"]
        }
      }
    },
    required: ["ideas"]
  }
};
const ACTIONS = `Allowed actions (use exact values):
- {"type":"tempo","value":40-200}
- {"type":"instrument","part":"<part name, or 'chords'>","inst":one of ${JSON.stringify(INSTRUMENTS)},"ens":"section"|"solo","size":"Small (4)"|"Chamber (12)"|"Full orchestra (30)","artic":"legato"|"pizzicato"|"tremolo" (strings only)}
- {"type":"harmony","kind":"third_below"|"third_above"|"sixth_below","all":true|false}
- {"type":"bass_line","style":"pop"|"whole"|"walk"}
- {"type":"chords_auto"}
- {"type":"chord_style","style":"Block"|"Sustained"|"Arpeggio"|"Strum","inst":<instrument>}
- {"type":"drums","style":one of ${JSON.stringify(DRUMS)}}
- {"type":"drums_skip","section":"<section name>"}
- {"type":"effect","part":"<part name>","echo":0-0.8,"rev":0-1}
- {"type":"dynamics","part":"<part name>","section":"<section name>","level":"p"|"mf"|"f"}
- {"type":"copy_section","from":"<section name>"}
- {"type":"add_section","name":"Intro"|"Verse"|"Chorus"|"Bridge"|"Solo"|"Outro","bars":2|4|8}
- {"type":"bgv","count":"One"|"A trio"|"A group","kind":"Oohs"|"Aahs"|"Harmony"|"Echo last word"|"Call and response","where":"Chorus only"|"Every section"|"Pick sections"}
- {"type":"lead","section":"<section name>","mode":"voice"|"music"|"both"}
- {"type":"style","name":one of ${JSON.stringify(STYLES)},"sub":optional flavor, e.g. "Organ-heavy rock","Guitar wall","Piano rock","Organ soul","Harp and flute","Movie magic"}
- {"type":"lyrics"} (opens lyric options for the current section)
- {"type":"layer","preset":"Organ pad"|"String pad"|"Piano arpeggio"|"Guitar strum"|"Synth pulse"|"Choir ooh"|"Harp arpeggio"|"Brass swells"|"Electric piano"|"Low drone"} (adds a background layer that follows the chords)
- {"type":"buildup"} (arranges layers/drums so the song starts small and builds to the last chorus)
- {"type":"master","fadeIn":0-8,"fadeOut":0-12,"punch":0-1,"room":"Dry"|"Studio"|"Concert hall"|"Church"|"Stadium","vol":0.3-1.2} (Control Room master settings; include only the fields you change)
- {"type":"go","screen":"vocal"|"studio"|"restyle"|"save"|"room"|"control"}
- {"type":"tip","text":"<one short how-to sentence>"} (only when no action fits; at most one tip)`;
function validAction(a, song) {
  if (!a || typeof a !== "object") return false;
  const partNames = (song.parts || []).map(p => String(p.name).toLowerCase());
  const secNames = (song.sections || []).map(s => s.name);
  switch (a.type) {
    case "tempo": return +a.value >= 40 && +a.value <= 200;
    case "instrument": return INSTRUMENTS.includes(a.inst) && (a.part === "chords" || partNames.includes(String(a.part).toLowerCase()));
    case "harmony": return ["third_below", "third_above", "sixth_below"].includes(a.kind || "third_below");
    case "bass_line": case "chords_auto": case "lyrics": return true;
    case "chord_style": return !a.inst || INSTRUMENTS.includes(a.inst);
    case "drums": return DRUMS.includes(a.style);
    case "drums_skip": case "copy_section": return secNames.includes(a.section || a.from);
    case "effect": case "dynamics": return partNames.includes(String(a.part).toLowerCase());
    case "add_section": return true;
    case "bgv": return true;
    case "lead": return secNames.includes(a.section) && ["voice", "music", "both"].includes(a.mode);
    case "style": return STYLES.includes(a.name);
    case "go": return ["vocal", "studio", "restyle", "save", "room", "control"].includes(a.screen);
    case "layer": return ["Organ pad", "String pad", "Piano arpeggio", "Guitar strum", "Synth pulse", "Choir ooh", "Harp arpeggio", "Brass swells", "Electric piano", "Low drone"].includes(a.preset);
    case "buildup": return true;
    case "master": return ["fadeIn", "fadeOut", "punch", "room", "vol"].some(k => a[k] != null) && (a.room == null || ["Dry", "Studio", "Concert hall", "Church", "Stadium"].includes(a.room));
    case "tip": return !!a.text;
    default: return false;
  }
}
async function suggest(body) {
  const song = body.song || {};
  const sys = `You are the friendly producer inside "The Music Studio", a web tool where people write songs on a staff, sing notes in, pick instruments, add lyrics and vocals. You see a summary of their song and the screen they are on. Give exactly 3 ideas that fit THIS song right now and move it forward: what's missing, what would sound better, or a fun creative turn. Match the user's level (${clip(song.level, 20) || "Moderate"}): Basic = plain words, no theory terms; Advanced = theory names are fine. Make each idea different. Never suggest something already done. Never mention copyrighted songs or artists. ${ACTIONS}`;
  const user = `Screen: ${clip(song.screen, 20)}. Current section: ${clip(song.current, 30)}.
Song summary (JSON): ${clip(JSON.stringify(song), 3500)}
${body.ask ? `The user asked: "${clip(body.ask, 200)}". Make all 3 ideas answer this.` : ""}
${(body.avoid || []).length ? `Don't repeat these: ${clip(JSON.stringify(body.avoid), 600)}` : ""}`;
  const out = await tryTwice(m => callTool(sys, SUGGEST_TOOL, user, 1200, j => Array.isArray(j.ideas) && j.ideas.length > 0, m), FAST, MODEL);
  const ideas = out.ideas.filter(i => i && validAction(i.action, song)).slice(0, 3).map(i => ({ label: clip(i.label, 48), why: clip(i.why, 60), action: i.action }));
  return { ideas };
}

// ---------- lyrics ----------
const LYRIC_TOOL = {
  name: "lyric_options",
  description: "Three different original lyric options for one section of the user's song.",
  input_schema: {
    type: "object",
    properties: {
      ok: { type: "boolean", description: "false only if the request is hateful, sexual, harassing a real person, or asks to copy existing lyrics" },
      options: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", description: "The lyric lines, separated with \\n" } },
      say: { type: "string", description: "If not ok: one friendly sentence offering a different direction" }
    },
    required: ["ok"]
  }
};
async function lyrics(body) {
  const sec = body.section || {}, bars = Math.max(1, Math.min(16, +sec.bars || 4));
  const lines = bars <= 2 ? 2 : bars <= 4 ? "2 to 4" : "4";
  const notes = +body.noteCount || 0;
  const role = /chorus/i.test(sec.name) ? "This is the CHORUS: a short, catchy hook line that could repeat, the big idea of the song." :
    /verse/i.test(sec.name) ? "This is a VERSE: tell part of the story with specific, concrete images; new details, not the hook." :
    /bridge/i.test(sec.name) ? "This is the BRIDGE: a change of view or a turn in the story before the last chorus." :
    /intro|outro/i.test(sec.name) ? "This is the " + clip(sec.name, 20).toUpperCase() + ": very short, sets or closes the mood." : "Write lyrics that fit this section.";
  const sys = `You write song lyrics with users inside "The Music Studio". Write ONLY original lyrics. Never quote, paraphrase or imitate lines from existing published songs, and never name real artists or songs. Keep it suitable for a general audience (no explicit content). Write singable lines with a steady rhythm and simple, vivid words. Every option MUST rhyme: in 4 lines, lines 2 and 4 rhyme clearly (true rhymes like June/soon, door/before, not near-misses like love/come); in 2 lines, the two lines rhyme. A chorus repeats or returns to one short hook phrase. Each option should take a clearly different approach (different images, angle or rhyme). Write in the same language the user writes in.`;
  const user = `Song title: ${clip(body.title, 80)}
What it's about: ${clip(body.brief && body.brief.about, 300)}
Mood: ${clip(body.brief && body.brief.mood, 120)}
Three words: ${clip(body.brief && body.brief.words, 120)}
Style: ${clip(body.style, 30) || "not chosen"} · ${+body.tempo || 96} BPM
Section: ${clip(sec.name, 30)} (${bars} bars). ${role}
Write ${lines} lines per option.${notes ? ` The melody here has about ${notes} notes, so aim for roughly ${Math.max(4, Math.round(notes / (bars <= 2 ? 2 : 4)))} syllables per line.` : ""}
The user's line or description for this section: "${clip(body.line, 300)}" (use their words or idea if given)
Lyrics already written for other sections (keep the story and voice consistent, don't repeat their lines unless this is a repeated chorus): ${clip(JSON.stringify(body.others || {}), 1500)}
${(body.avoid || []).length ? `Give new options, different from: ${clip(JSON.stringify(body.avoid), 900)}` : ""}`;
  const out = await tryTwice(m => callTool(sys, LYRIC_TOOL, user, 900, j => j.ok === false || (Array.isArray(j.options) && j.options.length >= 2), m), MODEL, FAST);
  if (out.ok === false) return { options: [], message: clip(out.say, 200) || "Let's try a different direction for this one." };
  return { options: out.options.slice(0, 3).map(o => clip(o, 600).trim()) };
}

// ---------- song idea helper ----------
const BRIEF_TOOL = {
  name: "song_brief",
  description: "A short song idea.",
  input_schema: {
    type: "object",
    properties: {
      about: { type: "string", description: "What the song is about, one sentence, max 120 characters" },
      mood: { type: "string", description: "2 to 4 mood words" },
      words: { type: "string", description: "Three words, comma separated" },
      title: { type: "string", description: "A short, NEW original song title that fits the idea (never 'My Song')" }
    },
    required: ["about", "mood", "words"]
  }
};
async function brief(body) {
  const b = body.brief || {};
  const sys = `You help people find a song idea inside "The Music Studio". Keep it original, warm, specific and suitable for everyone. Build on anything the user already typed. Never reference real songs or artists.`;
  const user = `Already typed: about="${clip(b.about, 300)}", mood="${clip(b.mood, 120)}", words="${clip(b.words, 120)}". Style: ${clip(body.style, 30) || "any"}, ${+body.tempo || 96} BPM. Song title so far: "${clip(body.title, 80)}". Give one fresh idea.`;
  const out = await tryTwice(m => callTool(sys, BRIEF_TOOL, user, 400, j => !!j.about, m), FAST, MODEL);
  return { about: clip(out.about, 200), mood: clip(out.mood, 80), words: clip(out.words, 80), title: clip(out.title, 60) };
}

// ---------- scan sheet music (photo → melody + chords) ----------
const SCAN_TOOL = {
  name: "lead_sheet",
  description: "The melody and chord symbols read from a photo of sheet music.",
  input_schema: {
    type: "object",
    properties: {
      ok: { type: "boolean", description: "false if the image is not readable sheet music" },
      reason: { type: "string", description: "If not ok: one friendly sentence on what to fix (e.g. 'The photo is blurry. Try again in better light, holding the phone flat.')" },
      title: { type: "string", description: "Song title if printed on the page, else empty" },
      keySignature: { type: "string", description: "Number of sharps or flats, e.g. '0', '1#', '2#', '3#', '1b', '2b', '3b', '4b'" },
      timeSignature: { type: "string", description: "e.g. '4/4', '3/4', '2/4', '6/8', 'C' (common time), '2/2'" },
      clef: { type: "string", description: "'treble' or 'bass' (the melody staff)" },
      tempo: { type: "number", description: "Beats per minute if a metronome mark is printed, else 0" },
      pickupBeats: { type: "number", description: "If the first bar is a pickup (anacrusis), how many beats long it is; else 0" },
      bars: {
        type: "array", maxItems: 48,
        items: {
          type: "object",
          properties: {
            chords: { type: "array", items: { type: "string" }, description: "Chord symbols written over this bar, in order (e.g. ['C', 'G7']). Empty if none." },
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pitch: { type: "string", description: "Scientific pitch with accidental as actually sounded, using # or b (e.g. 'E4', 'F#4', 'Bb3'), or 'rest'" },
                  beats: { type: "number", description: "Length in quarter-note beats: whole 4, dotted half 3, half 2, dotted quarter 1.5, quarter 1, dotted eighth 0.75, eighth 0.5, sixteenth 0.25; triplet eighth 0.333" },
                  tie: { type: "boolean", description: "true if tied to the next note" }
                },
                required: ["pitch", "beats"]
              }
            }
          },
          required: ["notes"]
        }
      },
      truncated: { type: "boolean", description: "true if the page had more bars than you returned" }
    },
    required: ["ok"]
  }
};
const SCAN_LIMIT = 25; const scanHits = new Map();
function scanLimited(req) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x", now = Date.now();
  const list = (scanHits.get(ip) || []).filter(t => now - t < 3600e3); list.push(now); scanHits.set(ip, list);
  if (scanHits.size > 5000) scanHits.clear();
  return list.length > SCAN_LIMIT;
}
function normChord(c) {
  const m = /^\s*([A-Ga-g])([#b♯♭]?)(.*)$/.exec(String(c || "")); if (!m) return "";
  const root = m[1].toUpperCase() + (m[2] === "♯" ? "#" : m[2] === "♭" ? "b" : m[2]);
  let q = m[3].replace(/\(.*?\)/g, "").replace(/\/.*$/, "").trim().toLowerCase();
  let out = "";
  if (/^(maj7|ma7|maj9|ma9|Δ|△|maj13)/i.test(q)) out = "maj7";
  else if (/^(m7b5|ø|min7b5|-7b5)/.test(q) || /^(dim|o|°)/.test(q)) out = "dim";
  else if (/^(m7|min7|-7|m9|min9|m11)/.test(q)) out = "m7";
  else if (/^(m|min|-)/.test(q)) out = "m";
  else if (/^(sus2)/.test(q)) out = "sus2";
  else if (/^(sus|7sus|sus4)/.test(q)) out = /^7/.test(q) ? "7" : "sus4";
  else if (/^(7|9|11|13|dom)/.test(q)) out = "7";
  const flatName = { Db: "D♭", Eb: "E♭", Gb: "G♭", Ab: "A♭", Bb: "B♭", "D#": "E♭", "A#": "B♭", "G#": "A♭", "C#": "C#", "F#": "F#", Cb: "B", Fb: "E", "E#": "F", "B#": "C" };
  return (flatName[root] || root) + out;
}
async function scan(body) {
  const img = String(body.image || "");
  const mm = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(img);
  if (!mm) return { ok: false, reason: "That picture didn't come through. Please try another photo." };
  if (mm[3].length > 6e6) return { ok: false, reason: "That picture is too big. Try a smaller photo or a screenshot." };
  const sys = `You read sheet music from photos for "The Music Studio". Transcribe ONLY the melody (the top line of the main staff) and the chord symbols written above it. Ignore lyrics completely, never output any words from the page except the title. Read carefully bar by bar: clef, key signature, time signature, each note's pitch (apply the key signature and any accidentals in the bar) and its length. Each full bar's beats must add up to the time signature. Return up to 48 bars. If the image is not sheet music or is too unclear to read, set ok to false and say what to fix.`;
  const data = await anthropic({
    model: MODEL, max_tokens: 8000, system: sys,
    tools: [SCAN_TOOL], tool_choice: { type: "tool", name: "lead_sheet" },
    messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mm[1], data: mm[3] } }, { type: "text", text: "Read the melody and chord symbols from this sheet music." }] }]
  });
  const block = (data.content || []).find(b => b.type === "tool_use");
  const out = block && unstring(block.input);
  if (!out) throw new Error("bad_shape");
  if (out.ok === false || !Array.isArray(out.bars) || !out.bars.length) return { ok: false, reason: clip(out.reason, 200) || "I couldn't read music in that picture. Try a clearer, flatter photo of one page." };
  const bars = out.bars.slice(0, 48).map(b => ({
    chords: (Array.isArray(b.chords) ? b.chords : []).map(normChord).filter(Boolean).slice(0, 4),
    notes: (Array.isArray(b.notes) ? b.notes : []).slice(0, 32).map(n => ({ pitch: clip(n.pitch, 6), beats: Math.max(0.125, Math.min(8, +n.beats || 1)), tie: !!n.tie }))
  }));
  return { ok: true, title: clip(out.title, 80), keySignature: clip(out.keySignature, 4), timeSignature: clip(out.timeSignature, 6), clef: out.clef === "bass" ? "bass" : "treble", tempo: Math.max(0, Math.min(240, +out.tempo || 0)), pickupBeats: Math.max(0, +out.pickupBeats || 0), bars, truncated: !!out.truncated };
}


// ---------- Mr. Paul answers a question ----------
const TEACH_TOOL = {
  name: "teacher_answer",
  description: "Mr. Paul's short answer to the user's question.",
  input_schema: {
    type: "object",
    properties: {
      answer: { type: "string", description: "2 to 4 short sentences, warm and direct, like a good music teacher" },
      steps: { type: "array", maxItems: 4, items: { type: "string" }, description: "Optional: up to 4 short steps naming the exact buttons in The Music Studio" },
      word: { type: "string", description: "Optional: one music term the answer is about, e.g. Chorus, Harmony, Tempo" }
    },
    required: ["answer"]
  }
};
async function teacher(body) {
  const level = clip(body.level, 20) || "Basic";
  const sys = `You are Mr. Paul, the music teacher inside "The Music Studio", a web tool where people write songs on a staff, sing notes in, pick instruments, add chords, drums, lyrics and vocals, mix in the Control Room and download an MP3. Rooms: The Music Room (lessons), The Studio (notes, harmony, chords, bass, drums), The Vocal Room (lyrics, recording, background singers), Restyle, The Control Room (layers, build grid, mixing board, master), Save and download, Studio Talk (music words). Every screen has Undo at the bottom. Answer the user's question in plain words for their level (${level}): Basic = no theory words without explaining them; Advanced = theory terms are fine. Be direct and encouraging, like a confident teacher: tell them exactly what to do. If the question is not about music or this tool, say kindly that you only help with music and the studio. Never reproduce lyrics of existing songs or name copyrighted songs to copy.`;
  const user = `Screen: ${clip(body.screen, 20)}. Their current next step: ${clip(body.step, 200)}
Song summary (JSON): ${clip(JSON.stringify(body.song || {}), 2500)}
Question: "${clip(body.q, 240)}"`;
  const out = await tryTwice(m => callTool(sys, TEACH_TOOL, user, 700, j => typeof j.answer === "string" && j.answer.length > 0, m), FAST, MODEL);
  return { answer: clip(out.answer, 700), steps: (Array.isArray(out.steps) ? out.steps : []).slice(0, 4).map(x => clip(x, 140)), word: clip(out.word, 30) };
}

// ---------- handler ----------
module.exports = async (req, res) => {
  if (!(await require("./_lwgate")(req, res, "music-studio"))) return;
  if (!allowedRequest(req)) return blockRequest(res);
  if (req.method === "GET") return res.json({ ok: true, anthropic_key_set: !!process.env.ANTHROPIC_API_KEY, model: MODEL, fast_model: FAST });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "missing_key", message: "The AI helper isn't set up yet." });
  if (limited(req)) return res.status(429).json({ error: "slow_down", message: "That's a lot of ideas for one hour! Take a short break and come back soon." });
  const body = req.body || {};
  try {
    if (body.part === "suggest") return res.json(await suggest(body));
    if (body.part === "lyrics") return res.json(await lyrics(body));
    if (body.part === "brief") return res.json(await brief(body));
    if (body.part === "teacher") return res.json(await teacher(body));
    if (body.part === "scan") { if (scanLimited(req)) return res.status(429).json({ error: "slow_down", message: "That's a lot of scans for one hour. Take a short break and try again soon." }); return res.json(await scan(body)); }
    return res.status(400).json({ error: "unknown_part" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "failed", detail: String(e && e.message || e).slice(0, 160), message: "The AI helper lost its place. Please try again." });
  }
};

// ---------- website lock ----------
// Only answer this tool's own pages and Paul's websites, so nobody else can run it on his credits.
// Add more sites in Vercel with an ALLOWED_SITES setting (comma separated); set LOCK_OFF to 1 to switch the lock off.
function allowedRequest(req) {
  if (String(process.env.LOCK_OFF || "") === "1") return true;
  const sites = ["nusparkpublishing.com", "nusparkmarketing.com", "nusparklearnwow.com"]
    .concat(String(process.env.ALLOWED_SITES || "").split(",").map(s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean));
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase().split(":")[0];
  const ok = u => {
    try {
      const h = new URL(u).hostname.toLowerCase();
      return h === host || h === "localhost" || h === "127.0.0.1" || sites.some(d => h === d || h.endsWith("." + d));
    } catch (e) { return false; }
  };
  const origin = req.headers.origin, ref = req.headers.referer || req.headers.referrer;
  if (origin && origin !== "null") return ok(origin);
  if (ref) return ok(ref);
  return req.method === "GET";
}
function blockRequest(res) {
  res.statusCode = 403;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: "not_allowed", message: "This tool only works on NuSpark websites." }));
}
