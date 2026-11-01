const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ic = (n, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- state
const S = { lang: localStorage.getItem("lang") || "hi-IN", langs: [], docId: null, hist: {}, tab: "home" };
const T = {};   // "lang|English" -> translation
const tr = s => (S.lang === "en-IN" ? s : T[S.lang + "|" + s] || s);

// Ask the server for any translations we do not have yet (it caches them on disk for everyone).
async function need(list) {
  if (S.lang === "en-IN") return;
  const lang = S.lang;
  const miss = [...new Set(list.filter(Boolean))].filter(s => !(lang + "|" + s in T));
  const chunks = [];
  for (let i = 0; i < miss.length; i += 60) chunks.push(miss.slice(i, i + 60));
  await Promise.all(chunks.map(async ch => {
    try {
      const j = await (await post("/api/translate", { lang, strings: ch })).json();
      if (j.strings) ch.forEach((s, i) => { if (j.translated || j.strings[i] !== s) T[lang + "|" + s] = j.strings[i]; });
    } catch (_) { /* English stays visible */ }
  }));
}
const COMMON = ["Listen", "Play", "Pause", "Stop", "Understanding your voice…", "Listening… press the red button when done.",
  "Microphone is blocked. Please allow it, or type instead.", "Reading your paper… please wait.", "Your paper is ready. Ask your question below.",
  "Please add a photo of your paper first.", "Checking…", "Loading…", "Getting your form ready…", "Finding the right page…", "Language detected. Switching…"];
// English first, the chosen language underneath it
const bi = s => { const t = tr(s); return (S.lang === "en-IN" || t === s) ? esc(s) : `${esc(s)}<span class="loc">${esc(t)}</span>`; };
const biText = s => { const t = tr(s); return (S.lang === "en-IN" || t === s) ? s : s + "\n" + t; };

async function localize(root = document) {
  const els = $$("[data-i18n],[data-i18n-ph]", root);
  els.forEach(e => { if (e._en === undefined) e._en = e.hasAttribute("data-i18n-ph") ? e.placeholder : e.textContent.trim(); });
  await need(els.map(e => e._en));
  els.forEach(e => {
    const o = e._en, t = tr(o), same = S.lang === "en-IN" || t === o;
    if (e.hasAttribute("data-i18n-ph")) e.placeholder = same ? o : o + " / " + t;
    else e.innerHTML = bi(o);
  });
}

// ---------------------------------------------------------------- tabs, home tiles, routing
const TABS = [
  ["home", "home", "Home", ""],
  ["scan", "camera", "Scan and Ask", "Take a photo of a paper and ask about it"],
  ["steps", "steps", "Next Steps", "Tell me your problem and I will tell you what to do"],
  ["form", "form", "Fill a Form", "I will guide you through a form, box by box"],
  ["sms", "sms", "Check a Message", "Find out if an SMS is real or a scam"],
  ["schemes", "bank", "Government Schemes", "Pension, insurance, savings and loans"],
  ["words", "book", "Banking Words", "Simple meaning of difficult words"],
  ["safe", "shield", "Stay Safe", "Rules that protect your money"],
  ["help", "help", "How to Use", "Learn how this website works"]
];
$("#tabs").innerHTML = TABS.map(([id, icon, label]) =>
  `<button role="tab" data-tab="${id}" aria-selected="false">${ic(icon)}<span data-i18n>${label}</span></button>`).join("");
$("#tiles").innerHTML = TABS.slice(1).map(([id, icon, label, desc]) =>
  `<button class="tile c-${id}" data-go="${id}"><span class="ic">${ic(icon)}</span><span><b data-i18n>${label}</b><span class="d" data-i18n>${desc}</span></span></button>`).join("");

const RENDER = {};   // per-view async renderers, run when the view opens or the language changes
async function go(id, fromHash) {
  if (!TABS.some(t => t[0] === id)) id = "home";
  stopAudio(); stopRecording();
  S.tab = id;
  $$("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === id));
  $$("section.view").forEach(v => v.classList.toggle("on", v.id === id));
  if (!fromHash && location.hash !== "#" + id) location.hash = id;
  window.scrollTo({ top: 0 });
  const view = $("#" + id);
  if (view.dataset.loc !== S.lang) {
    view.dataset.loc = S.lang;
    await Promise.all([localize(view), RENDER[id] ? RENDER[id]() : null]);
  }
  $(`#tabs button[data-tab="${id}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
}
$("#tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });
$("#tiles").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });
window.addEventListener("hashchange", () => go(location.hash.slice(1) || "home", true));

async function setLang(code) {
  stopAudio(); stopRecording();
  S.lang = code; localStorage.setItem("lang", code);
  $("#lang").value = code; markCur();
  $$("section.view").forEach(v => delete v.dataset.loc);
  await Promise.all([localize($(".top")), localize($("nav")), localize($("footer")), need(COMMON)]);
  barLabels();
  await go(S.tab, true);
}
$("#lang").addEventListener("change", e => setLang(e.target.value));

// letter size
const sizes = ["", "big1", "big2"];
let sz = +(localStorage.getItem("size") || 0);
const applySize = () => { document.documentElement.className = sizes[sz]; localStorage.setItem("size", sz); };
$("#lg").onclick = () => { sz = Math.min(2, sz + 1); applySize(); };
$("#sm").onclick = () => { sz = Math.max(0, sz - 1); applySize(); };
applySize();

// ---------------------------------------------------------------- moving strip of the 22 languages
function markCur() { $$("#rev button").forEach(b => b.classList.toggle("cur", b.dataset.code === S.lang)); }
function tickerLabels() {
  const paused = $("#ticker").classList.contains("paused");
  $("#tpause").innerHTML = paused ? ic("play", "fill") : ic("pause");
  $("#tpause").setAttribute("aria-label", paused ? "Play the moving languages" : "Pause the moving languages");
}
async function startLanguages() {
  S.langs = await (await fetch("/api/languages")).json();
  $("#lang").innerHTML = S.langs.map(l => `<option value="${l.code}">${l.native} — ${l.name}</option>`).join("") + `<option value="en-IN">English</option>`;
  $("#lang").value = S.lang;
  const item = l => `<button data-code="${l.code}" aria-label="${l.name}">${l.native}<small>${l.name}</small></button>`;
  const all = S.langs.map(item).join("");
  $("#rev").innerHTML = `<div class="track">${all}${all}</div>`;   // twice, so the loop has no gap
  markCur(); tickerLabels();
}
$("#rev").addEventListener("click", e => { const b = e.target.closest("[data-code]"); if (b) setLang(b.dataset.code); });
$("#tpause").onclick = () => { $("#ticker").classList.toggle("paused"); tickerLabels(); };

// ---------------------------------------------------------------- audio playback: pause / stop / listen
const player = new Audio();
let aTok = 0, aQueue = [], curBtn = null, curHTML = "";
function barLabels() {
  $("#abpause").innerHTML = (player.paused ? ic("play", "fill") : ic("pause")) + `<span>${bi(player.paused ? "Play" : "Pause")}</span>`;
  $("#abstop").innerHTML = ic("stop", "fill") + `<span>${bi("Stop")}</span>`;
}
function stopAudio() {
  aTok++; aQueue = []; player.onended = null; player.pause(); player.removeAttribute("src");
  $("#audiobar").hidden = true;
  if (curBtn) { curBtn.innerHTML = curHTML; curBtn = null; }
}
player.addEventListener("play", barLabels); player.addEventListener("pause", barLabels);
$("#abpause").onclick = () => { player.paused ? player.play().catch(() => {}) : player.pause(); };
$("#abstop").onclick = stopAudio;

async function speak(text, btn) {
  if (btn && btn === curBtn) { stopAudio(); return; }          // pressing Listen again stops
  stopAudio();
  const tok = aTok;
  if (btn) { curBtn = btn; curHTML = btn.innerHTML; btn.innerHTML = ic("stop", "fill") + `<span>${bi("Stop")}</span>`; }
  try {
    const r = await post("/api/tts", { text, lang: S.lang });
    const j = await r.json();
    if (tok !== aTok) return;                                  // the user moved on while it loaded
    if (!r.ok) throw new Error(j.error);
    aQueue = j.audios.map(a => "data:" + j.mime + ";base64," + a);
    const next = () => {
      if (tok !== aTok) return;
      if (!aQueue.length) { stopAudio(); return; }
      player.src = aQueue.shift(); player.onended = next; player.play().catch(() => {});
    };
    $("#audiobar").hidden = false; barLabels(); next();
  } catch (err) { if (tok === aTok) { stopAudio(); alert(err.message || "Could not play audio."); } }
}
const listenBtn = text => {
  const b = document.createElement("button"); b.className = "listen";
  b.innerHTML = ic("volume") + `<span>${bi("Listen")}</span>`; b.onclick = () => speak(text, b); return b;
};

// ---------------------------------------------------------------- microphone (Sarvam speech to text)
let rec = null, recBtn = null, recChunks = [], recStream = null;
const micIdle = b => { b.classList.remove("rec"); b.innerHTML = ic("mic"); };
const micState = (b, html) => { const el = b.closest(".field")?.nextElementSibling; if (el?.classList.contains("micstate")) el.innerHTML = html; };
function stopRecording() { if (rec && rec.state === "recording") rec.stop(); }

async function transcribe(blob, name, btn) {
  micState(btn, bi("Understanding your voice…"));
  const fd = new FormData(); fd.append("file", blob, name);
  fd.append("lang", btn.dataset.auto === "route" ? "auto" : S.lang);   // the Home prompt lets Sarvam detect the spoken language
  try {
    const r = await fetch("/api/stt", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Error");
    const box = document.getElementById(btn.dataset.for);
    box.value = (box.value ? box.value + " " : "") + j.text; box.focus(); micState(btn, "");
    if (btn.dataset.auto === "route") { await switchTo(j.lang); routeFrom(box.value); }
  } catch (err) { micState(btn, `<span class="notice">${esc(err.message)}</span>`); }
}
async function toggleMic(btn) {
  stopAudio();
  if (rec && rec.state === "recording") { rec.stop(); return; }
  if (!(window.isSecureContext && navigator.mediaDevices && window.MediaRecorder)) {
    recBtn = btn; $("#audin").click(); return;   // no in-page recording available: fall back to the phone's own voice recorder
  }
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (_) { micState(btn, `<span class="notice">${bi("Microphone is blocked. Please allow it, or type instead.")}</span>`); return; }
  recChunks = []; rec = new MediaRecorder(recStream); recBtn = btn;
  rec.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
  rec.onstop = () => {
    recStream.getTracks().forEach(t => t.stop()); micIdle(btn);
    const type = rec.mimeType || "audio/webm";
    transcribe(new Blob(recChunks, { type }), "voice." + (type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"), btn);
  };
  rec.start(); btn.classList.add("rec"); btn.innerHTML = ic("stop", "fill");
  micState(btn, bi("Listening… press the red button when done."));
}
document.addEventListener("click", e => { const b = e.target.closest(".mic"); if (b) toggleMic(b); });
$("#audin").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f && recBtn) transcribe(f, f.name || "voice.m4a", recBtn); });
$$(".mic").forEach(micIdle);

// ---------------------------------------------------------------- voice prompt on Home: say what you want, open that page, hear how it works
// Change the page language to the one that was spoken or typed
async function switchTo(code) {
  if (!code || code === S.lang || (code !== "en-IN" && !S.langs.some(l => l.code === code))) return;
  const l = S.langs.find(x => x.code === code);
  $("#routestate").innerHTML = `${esc(l ? l.native + " (" + l.name + ")" : "English")}: ${bi("Language detected. Switching…")}`;
  await setLang(code);
}
async function routeFrom(text) {
  text = text.trim(); if (!text) { $("#voiceq").focus(); return; }
  const st = $("#routestate");
  st.innerHTML = bi("Finding the right page…");
  try {
    const r = await post("/api/route", { text, lang: S.lang });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Error");
    if (j.tab === "none" || !FEATURE_INTRO[j.tab]) {
      await need([NOT_UNDERSTOOD]);
      st.innerHTML = `<span class="notice">${bi(NOT_UNDERSTOOD)}</span>`; speak(tr(NOT_UNDERSTOOD)); return;
    }
    await need([FEATURE_INTRO[j.tab]]);
    st.innerHTML = "";
    $("#voiceq").value = "";
    await go(j.tab);
    if (j.tab === "steps") $("#issue").value = text;         // carry what they said into the page that needs it
    if (j.tab === "words") $("#wordq").value = text;
    speak(tr(FEATURE_INTRO[j.tab]));                          // short spoken introduction of the page
  } catch (err) { st.innerHTML = `<span class="notice">${esc(err.message)}</span>`; }
}
RENDER.home = async () => {
  await need(VOICE_SAMPLES);
  $("#voicechips").innerHTML = VOICE_SAMPLES.map((q, i) => `<button class="chip" data-voice="${i}">${bi(q)}</button>`).join("");
};
$("#voicechips").addEventListener("click", e => { const c = e.target.closest("[data-voice]"); if (c) routeFrom(VOICE_SAMPLES[+c.dataset.voice]); });
$("#voicego").onclick = async () => {
  const v = $("#voiceq").value.trim();
  if (v.length >= 3) {                                          // typed text: detect its language too
    try { await switchTo((await (await post("/api/detect-lang", { text: v })).json()).lang); } catch (_) { /* keep the current language */ }
  }
  routeFrom(v);
};
$("#voiceq").addEventListener("keydown", e => { if (e.key === "Enter") $("#voicego").click(); });

// ---------------------------------------------------------------- chat
function addMsg(box, role, text) {
  const d = document.createElement("div"); d.className = "msg " + role; d.textContent = text;
  if (role === "bot") d.appendChild(Object.assign(document.createElement("div"), {})).appendChild(listenBtn(text));
  box.appendChild(d); box.scrollTop = box.scrollHeight; return d;
}
let busy = false;
async function ask(question, box, { useDoc = true, autoSpeak = true, payload = null, context = null } = {}) {
  if (busy || !question.trim()) return; busy = true;
  const hist = useDoc && box.id ? (S.hist[box.id] ||= []) : [];
  addMsg(box, "user", question);
  const wait = addMsg(box, "bot", "…"); wait.lastChild.remove();
  const sent = payload || question;
  try {
    const r = await post("/api/chat", { question: sent, lang: S.lang, doc_id: useDoc ? S.docId : null, history: hist, context });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Error");
    wait.remove(); addMsg(box, "bot", j.answer);
    if (hist !== undefined && useDoc && box.id) hist.push({ role: "user", content: sent }, { role: "assistant", content: j.answer });
    if (autoSpeak) speak(j.answer);
  } catch (err) { wait.className = "msg bot"; wait.innerHTML = `<span class="notice">${esc(err.message)}</span>`; }
  finally { busy = false; }
}

// ---------------------------------------------------------------- Scan and Ask: upload + samples (auto-discovered)
async function handleFile(file, which = 1) {
  if (!file) return;
  const state = $({ 1: "#docstate", 2: "#docstate2", 3: "#docstate3" }[which]);
  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    ["#preview", "#preview2", "#preview3"].forEach(s => { $(s).src = url; $(s).style.display = "block"; });
  } else ["#preview", "#preview2", "#preview3"].forEach(s => { $(s).style.display = "none"; });
  state.innerHTML = bi("Reading your paper… please wait.");
  const fd = new FormData(); fd.append("file", file); fd.append("lang", S.lang);
  try {
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Upload failed");
    S.docId = j.doc_id; S.hist = {};
    const ok = ic("check") + " " + bi("Your paper is ready. Ask your question below.");
    ["#docstate", "#docstate2", "#docstate3"].forEach(d => { $(d).innerHTML = ok; });
  } catch (err) { state.innerHTML = `<span class="notice">${esc(err.message)}</span>`; }
}
[["cam", 1], ["up", 1], ["cam2", 2], ["up2", 2], ["cam3", 3], ["up3", 3]].forEach(([id, w]) => $("#" + id).addEventListener("change", e => handleFile(e.target.files[0], w)));
["camlabel", "uplabel", "camlabel2", "uplabel2", "camlabel3", "uplabel3"].forEach(id => $("#" + id).addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }));

async function renderSamples(el) {
  const samples = await (await fetch("/api/samples")).json();   // anything added to static/samples appears here
  await need(samples.map(x => x.label));
  el.innerHTML = samples.map(x =>
    `<button class="sample" data-file="${esc(x.file)}"><img src="/static/samples/${encodeURIComponent(x.file)}" alt="${esc(x.label)}" loading="lazy">${bi(x.label)}</button>`).join("");
}
RENDER.scan = async () => {
  await need(DOC_QUESTIONS);
  await renderSamples($("#samples"));
  $("#docchips").innerHTML = DOC_QUESTIONS.map(w => `<button class="chip" data-q="${esc(w)}">${bi(w)}</button>`).join("");
};
[["#samples", 1], ["#samples3", 3]].forEach(([sel, which]) => $(sel).addEventListener("click", async e => {
  const b = e.target.closest("[data-file]"); if (!b) return;
  const blob = await (await fetch("/static/samples/" + encodeURIComponent(b.dataset.file))).blob();
  handleFile(new File([blob], b.dataset.file, { type: blob.type }), which);
}));
$("#send").onclick = () => { const v = $("#q").value; $("#q").value = ""; ask(v, $("#chat")); };
$("#q").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#send").click(); } });
$("#docchips").addEventListener("click", e => { const c = e.target.closest("[data-q]"); if (c) ask(c.dataset.q, $("#chat")); });

// ---------------------------------------------------------------- Next Steps
$("#issuego").onclick = () => {
  const v = $("#issue").value.trim(); if (!v) { $("#issue").focus(); return; }
  $("#issue").value = "";
  const first = !(S.hist.chat2 || []).length;
  const payload = first
    ? `My problem: ${v}\n\nTell me step by step what to do, which documents to carry and where to go. ` +
      (S.docId ? "Use my document if it is relevant. " : "") + "If you need one more detail from me, ask one short question."
    : null;
  ask(v, $("#chat2"), { payload });
};
$("#issue").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#issuego").click(); } });
RENDER.steps = async () => {
  await need(ISSUE_SAMPLES);
  $("#issuechips").innerHTML = ISSUE_SAMPLES.map((q, i) => `<button class="chip" data-issue="${i}">${bi(q)}</button>`).join("");
};
$("#issuechips").addEventListener("click", e => {
  const c = e.target.closest("[data-issue]"); if (!c) return;
  $("#issue").value = ISSUE_SAMPLES[+c.dataset.issue]; $("#issuego").click();   // the example is sent in English; the answer comes back in your language
});
$$("[data-ask]").forEach(b => b.onclick = () => {
  if (!S.docId) { alert(biText("Please add a photo of your paper first.")); return; }
  ask(b.dataset.ask, $("#chat2"));
});

// ---------------------------------------------------------------- Fill a Form (guided, one box at a time)
const F = { form: null, i: 0, answers: [] };
const FORM_QS = ["List every box in this form and explain it in simple words.", "What should I write in each box? Give an example for each.", "Which papers should I attach or carry with this form?"];
RENDER.form = async () => {
  await need(FORM_QS);
  $("#formchips").innerHTML = FORM_QS.map(q => `<button class="chip" data-fq="${esc(q)}">${bi(q)}</button>`).join("");
  await Promise.all([F.form ? renderStep() : renderFormList(), renderSamples($("#samples3"))]);
};
const askForm = q => {
  if (!S.docId) { alert(biText("Please add a photo of your paper first.")); return; }
  ask(q, $("#chat4"));
};
$("#formchips").addEventListener("click", e => { const c = e.target.closest("[data-fq]"); if (c) askForm(c.dataset.fq); });
$("#send4").onclick = () => { const v = $("#q4").value.trim(); if (!v) return; $("#q4").value = ""; askForm(v); };
$("#q4").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#send4").click(); } });
async function renderFormList() {
  F.form = null;
  await need(FORMS.flatMap(f => [f.title, f.desc]));
  $("#formbody").innerHTML = `<div class="pick">${FORMS.map(f => `<button data-form="${f.id}"><b>${bi(f.title)}</b><span class="hint">${bi(f.desc)}</span></button>`).join("")}</div>`;
}
async function openForm(id) {
  F.form = FORMS.find(f => f.id === id); F.i = 0; F.answers = F.form.fields.map(() => "");
  $("#formbody").innerHTML = `<p class="status">${bi("Getting your form ready…")}</p>`;
  await need([...F.form.fields.flatMap(x => [x[0], x[1]]), "Example", "Your answer", "Back", "Next", "Finish"]);
  await renderStep();
}
async function renderStep() {
  stopAudio();
  const f = F.form, n = f.fields.length;
  if (F.i >= n) return renderSummary();
  const [label, help, eg] = f.fields[F.i];
  await need(["Step", "I do not understand this", "Use the example", "See a sample of this form", "All forms", "Example", "Your answer", "Back", "Next", "Finish"]);
  $("#formbody").innerHTML = `
    <button class="btn ghost small" id="fall">${ic("back")}<span>${bi("All forms")}</span></button>
    <h3 style="margin-top:14px">${bi(f.title)}</h3>
    <div class="hint">${esc(tr("Step"))} ${F.i + 1} / ${n}</div>
    <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${F.i + 1}"><i style="width:${((F.i + 1) / n) * 100}%"></i></div>
    <div class="stepbox">
      <div class="q">${bi(label)}</div>
      <p>${bi(help)}</p>
      <div class="eg"><b>${bi("Example")}</b><div>${esc(eg)}</div></div>
      <div class="row">
        <button class="btn small ghost" id="flisten">${ic("volume")}<span>${bi("Listen")}</span></button>
        <button class="btn small ghost" id="fexplain">${ic("help")}<span>${bi("I do not understand this")}</span></button>
        <button class="btn small ghost" id="fuse">${ic("check")}<span>${bi("Use the example")}</span></button>
      </div>
      <div class="chat" id="fchat"></div>
      <label class="label" for="fans">${bi("Your answer")}</label>
      <div class="field inline"><input type="text" id="fans" value="${esc(F.answers[F.i])}" autocomplete="off"><button class="mic" data-for="fans" aria-label="Speak"></button></div>
      <div class="micstate"></div>
      <div class="row">
        <button class="btn ghost" id="fback" ${F.i === 0 ? "disabled" : ""}>${ic("back")}<span>${bi("Back")}</span></button>
        <button class="btn" id="fnext"><span>${bi(F.i === n - 1 ? "Finish" : "Next")}</span>${ic("chev")}</button>
      </div>
    </div>
    ${f.sample ? `<details style="margin-top:14px"><summary>${bi("See a sample of this form")}</summary><img class="thumb" style="display:block;max-height:none" src="/static/samples/${f.sample}" alt=""></details>` : ""}`;
  $$("#formbody .mic").forEach(micIdle);
  $("#fall").onclick = renderFormList;
  $("#flisten").onclick = e => speak(`${tr(label)}. ${tr(help)}`, e.currentTarget);
  $("#fexplain").onclick = () => ask("Explain this box in more detail, with an easy example, for someone who has never filled a bank form.", $("#fchat"),
    { useDoc: false, context: `Form: ${f.title}. Box: ${label}. Instruction: ${help}. Example answer: ${eg}` });
  $("#fuse").onclick = () => { $("#fans").value = eg; $("#fans").focus(); };
  const keep = () => { F.answers[F.i] = $("#fans").value.trim(); };
  $("#fback").onclick = () => { keep(); F.i--; renderStep(); };
  $("#fnext").onclick = () => { keep(); F.i++; renderStep(); };
  $("#fans").addEventListener("keydown", e => { if (e.key === "Enter") $("#fnext").click(); });
  $("#fans").focus({ preventScroll: true });
}
async function renderSummary() {
  const f = F.form;
  await need(["Your answers are ready", "Copy these answers onto your paper form. You can print this page.", "Print", "Read aloud", "Start again", "All forms", "(not filled)", "Back"]);
  $("#formbody").innerHTML = `
    <h3>${ic("check")} ${bi("Your answers are ready")}</h3>
    <p class="lead">${bi("Copy these answers onto your paper form. You can print this page.")}</p>
    <table class="answers">${f.fields.map((x, k) => `<tr><td>${bi(x[0])}</td><td><b>${esc(F.answers[k]) || `<span class="hint">${esc(tr("(not filled)"))}</span>`}</b></td></tr>`).join("")}</table>
    <div class="row noprint">
      <button class="btn" onclick="window.print()">${ic("print")}<span>${bi("Print")}</span></button>
      <button class="btn ghost" id="fread">${ic("volume")}<span>${bi("Read aloud")}</span></button>
      <button class="btn ghost" id="fback2">${ic("back")}<span>${bi("Back")}</span></button>
      <button class="btn ghost" id="fagain"><span>${bi("Start again")}</span></button>
      <button class="btn ghost" id="fall2"><span>${bi("All forms")}</span></button>
    </div>`;
  $("#fread").onclick = e => speak(f.fields.map((x, k) => `${tr(x[0])}: ${F.answers[k] || tr("(not filled)")}`).join(". "), e.currentTarget);
  $("#fback2").onclick = () => { F.i = f.fields.length - 1; renderStep(); };
  $("#fagain").onclick = () => openForm(f.id);
  $("#fall2").onclick = renderFormList;
}
$("#formbody").addEventListener("click", e => { const b = e.target.closest("[data-form]"); if (b) openForm(b.dataset.form); });

// ---------------------------------------------------------------- Check a Message
RENDER.sms = async () => {
  await need([...SMS_SAMPLES.map(s => s.name), ...Object.values(VERDICT).flatMap(v => [v.title, ...v.steps])]);
  $("#smssamples").innerHTML = SMS_SAMPLES.map((s, i) => `<button class="chip" data-sms="${i}">${bi(s.name)}</button>`).join("");
};
$("#smssamples").addEventListener("click", e => {
  const b = e.target.closest("[data-sms]"); if (!b) return;
  const s = SMS_SAMPLES[+b.dataset.sms];
  $("#smstext").value = s.text; $("#smssender").value = s.sender; $("#smscheck").click();
});
$("#smscheck").onclick = async () => {
  const text = $("#smstext").value.trim(), out = $("#smsresult");
  if (text.length < 8) { $("#smstext").focus(); return; }
  stopAudio();
  out.innerHTML = `<p class="status">${bi("Checking…")}</p>`;
  try {
    const r = await post("/api/check-sms", { text, sender: $("#smssender").value.trim(), lang: S.lang });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Error");
    const v = VERDICT[j.verdict];
    await need([v.title, ...v.steps, ...j.flags.map(f => f.text), "Why I think so", "What to do next", "Never share your OTP, PIN or password with anyone."]);
    const steps = j.answer
      ? `<div class="body">${esc(j.answer)}</div>`
      : `<ol class="flags">${v.steps.map(s => `<li>${bi(s)}</li>`).join("")}</ol>`;
    out.innerHTML = `
      <div class="verdict ${j.verdict}">
        <h3>${ic(v.icon)}<span>${bi(v.title)}</span></h3>
        ${j.flags.length ? `<b>${bi("Why I think so")}</b><ul class="flags">${j.flags.map(f => `<li>${bi(f.text)}</li>`).join("")}</ul>` : ""}
        <b>${bi("What to do next")}</b>${steps}
        ${j.verdict === "suspicious" ? `<p><a class="btn small" href="${GOV.cyber}" target="_blank" rel="noopener noreferrer">${ic("link")}<span>cybercrime.gov.in</span></a></p>` : ""}
        <p class="body"><b>${bi("Never share your OTP, PIN or password with anyone.")}</b></p>
      </div>`;
    const spoken = j.answer || v.steps.map(tr).join(". ");
    out.querySelector(".verdict").appendChild(listenBtn(spoken));
    speak(spoken);
  } catch (err) { out.innerHTML = `<p class="notice">${esc(err.message)}</p>`; }
};

// ---------------------------------------------------------------- Government schemes
let schemeTag = "All";
RENDER.schemes = async () => {
  const tags = ["All", ...new Set(SCHEMES.map(s => s.tag))];
  await need([...tags, ...SCHEMES.flatMap(s => [s.name, s.short])]);
  $("#schemetags").innerHTML = tags.map(t => `<button class="chip" data-tag="${esc(t)}" aria-pressed="${t === schemeTag}">${bi(t)}</button>`).join("");
  $("#schemelist").innerHTML = SCHEMES.filter(s => schemeTag === "All" || s.tag === schemeTag).map(s => `
    <article class="scheme" id="sc-${s.id}">
      <button class="head" data-open="${s.id}" aria-expanded="false">
        <span><span class="tag">${bi(s.tag)}</span><span class="nm" style="display:block">${bi(s.name)}</span><span class="hint" style="display:block">${bi(s.short)}</span></span>
        <span class="chev">${ic("chev")}</span>
      </button>
      <div class="more"></div>
    </article>`).join("");
};
$("#schemetags").addEventListener("click", e => { const b = e.target.closest("[data-tag]"); if (b) { schemeTag = b.dataset.tag; RENDER.schemes(); } });
$("#schemelist").addEventListener("click", async e => {
  const h = e.target.closest("[data-open]"); if (!h) return;
  const card = h.closest(".scheme"), s = SCHEMES.find(x => x.id === h.dataset.open), more = $(".more", card);
  const open = card.classList.toggle("open"); h.setAttribute("aria-expanded", open);
  if (!open || more.dataset.ready === S.lang) return;
  more.innerHTML = `<p class="status">${bi("Loading…")}</p>`;
  const labels = ["Who can join", "What you get", "How to apply", "Papers needed", "Official websites", "Opens the official website. Never type your OTP, PIN or bank password there.", "Ask about this scheme", "Who can join this?", "How much money do I need?", "What papers do I need?", "Explain in simple words", "Ask"];
  await need([s.who, s.benefit, s.how, s.docs, ...labels]);
  const qs = ["Who can join this?", "How much money do I need?", "What papers do I need?", "Explain in simple words"];
  more.dataset.ready = S.lang;
  more.innerHTML = `
    <dl class="facts">
      <dt>${bi("Who can join")}</dt><dd>${bi(s.who)}</dd>
      <dt>${bi("What you get")}</dt><dd>${bi(s.benefit)}</dd>
      <dt>${bi("How to apply")}</dt><dd>${bi(s.how)}</dd>
      <dt>${bi("Papers needed")}</dt><dd>${bi(s.docs)}</dd>
    </dl>
    <h3 class="label">${bi("Official websites")}</h3>
    <div class="row">${(SCHEME_LINKS[s.id] || []).map(u => `<a class="btn ghost small" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic("link")}<span>${esc(new URL(u).hostname.replace(/^www\./, ""))}</span></a>`).join("")}</div>
    <p class="hint">${bi("Opens the official website. Never type your OTP, PIN or bank password there.")}</p>
    <h3 class="label">${bi("Ask about this scheme")}</h3>
    <div class="chips">${qs.map(q => `<button class="chip" data-sq="${esc(q)}">${bi(q)}</button>`).join("")}</div>
    <div class="field"><input type="text" id="sq-${s.id}" aria-label="${esc(s.name)}" autocomplete="off"><button class="mic" data-for="sq-${s.id}" aria-label="Speak"></button><button class="btn" data-sask="${s.id}">${ic("send")}<span>${bi("Ask")}</span></button></div>
    <div class="micstate"></div>
    <div class="chat" id="sch-${s.id}"></div>`;
  $$(".mic", more).forEach(micIdle);
});
document.addEventListener("click", e => {
  const chip = e.target.closest("[data-sq]"), btn = e.target.closest("[data-sask]");
  const card = (chip || btn)?.closest(".scheme"); if (!card) return;
  const s = SCHEMES.find(x => x.id === card.id.slice(3));
  const inp = $("#sq-" + s.id), q = chip ? chip.dataset.sq : inp.value.trim();
  if (!q) { inp.focus(); return; }
  if (!chip) inp.value = "";
  ask(q, $("#sch-" + s.id), {
    useDoc: false,
    context: `Government scheme: ${s.name} (${s.tag}). Summary: ${s.short} Who can join: ${s.who} Benefits: ${s.benefit} How to apply: ${s.how} Papers: ${s.docs} ` +
      "Rates and limits can change, so tell the user to confirm at the bank, post office or official website."
  });
});

// ---------------------------------------------------------------- Banking words, Stay Safe, How to Use
RENDER.words = async () => {
  await need(WORDS);
  $("#wordchips").innerHTML = WORDS.map(w => `<button class="chip" data-word="${esc(w)}">${bi(w)}</button>`).join("");
};
const wordAsk = w => ask(`Explain the banking word "${w}" in very simple words with one small example.`, $("#chat3"), { useDoc: false });
$("#wordchips").addEventListener("click", e => { const c = e.target.closest("[data-word]"); if (c) wordAsk(c.dataset.word); });
$("#wordgo").onclick = () => { const v = $("#wordq").value.trim(); $("#wordq").value = ""; if (v) wordAsk(v); };
$("#wordq").addEventListener("keydown", e => { if (e.key === "Enter") $("#wordgo").click(); });

RENDER.safe = async () => { await need(TIPS); $("#tips").innerHTML = TIPS.map(t => `<div class="tip">${bi(t)}</div>`).join(""); };
$("#readtips").onclick = e => speak(TIPS.map(tr).join(" "), e.currentTarget);

RENDER.help = async () => {
  await need(HOW_TO.flat());
  $("#helplist").innerHTML = HOW_TO.map(([h, d]) => `<li><div><b>${bi(h)}</b>${bi(d)}</div></li>`).join("");
};
$("#readhelp").onclick = e => speak(HOW_TO.map(([h, d]) => tr(h) + ". " + tr(d)).join(" "), e.currentTarget);

// ---------------------------------------------------------------- start
barLabels();
startLanguages().then(async () => {
  await Promise.all([localize($(".top")), localize($("nav")), localize($("footer")), need(COMMON)]);
  barLabels();
  const first = location.hash.slice(1) || "home";
  S.tab = ""; await go(first, true);
});
