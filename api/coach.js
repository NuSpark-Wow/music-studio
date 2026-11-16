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

const INSTRUMENTS = ["Grand piano", "Electric piano", "Organ", "Harpsichord", "Celesta", "Violins", "Violas", "Cellos", "Double bass", "Harp", "Flute", "Oboe", "Clarinet", "Bassoon", "Trumpet", "French horn", "Trombone", "Tuba", "Glockenspiel", "Timpani", "Acoustic guitar", "Electric guitar", "Bass guitar", "Synth", "Choir"];
const DRUMS = ["None", "Pop", "Rock", "Soft ballad", "R&B", "Hip-hop", "Jazz swing", "Country", "Waltz", "March"];
const STYLES = ["Pop", "R&B", "Rock", "Jazz swing", "Classical", "Full orchestra", "Country", "Hip-hop", "Soft ballad", "March"];

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
  if (block && block.input && check(block.input)) return block.input;
  const txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
  if (s >= 0 && e > s) { const j = JSON.parse(txt.slice(s, e + 1)); if (check(j)) return j; }
  throw new Error("bad_shape");
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
              description: "One of the action types listed in the instructions, with its fields",
              properties: { type: { type: "string" } }, required: ["type"]
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
- {"type":"style","name":one of ${JSON.stringify(STYLES)}}
- {"type":"lyrics"} (opens lyric options for the current section)
- {"type":"go","screen":"vocal"|"studio"|"restyle"|"save"|"room"}
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
    case "go": return ["vocal", "studio", "restyle", "save", "room"].includes(a.screen);
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
  const out = await tryTwice(m => callTool(sys, SUGGEST_TOOL, user, 900, j => Array.isArray(j.ideas) && j.ideas.length > 0, m), FAST, MODEL);
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
  const sys = `You write song lyrics with users inside "The Music Studio". Write ONLY original lyrics. Never quote, paraphrase or imitate lines from existing published songs, and never name real artists or songs. Keep it suitable for a general audience (no explicit content). Write singable lines: natural rhythm, simple words, rhymes that feel easy (lines 2 and 4 rhyme, or couplets). Each option should take a clearly different approach (different images, angle or rhyme). Write in the same language the user writes in.`;
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
      title: { type: "string", description: "A short original song title" }
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

// ---------- handler ----------
module.exports = async (req, res) => {
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
    return res.status(400).json({ error: "unknown_part" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "failed", message: "The AI helper lost its place. Please try again." });
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
