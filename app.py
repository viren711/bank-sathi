import base64
import io
import json
import os
import re
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import zipfile

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from sarvamai import SarvamAI

load_dotenv()

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE, "translation_cache.json")
ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".pdf"}

# name, BCP-47 code, native name, language code accepted by TTS (None = no voice)
LANGUAGES = [
    ("Assamese", "as-IN", "অসমীয়া"),
    ("Bengali", "bn-IN", "বাংলা"),
    ("Bodo", "brx-IN", "बड़ो"),
    ("Dogri", "doi-IN", "डोगरी"),
    ("Gujarati", "gu-IN", "ગુજરાતી"),
    ("Hindi", "hi-IN", "हिन्दी"),
    ("Kannada", "kn-IN", "ಕನ್ನಡ"),
    ("Kashmiri", "ks-IN", "كٲشُر"),
    ("Konkani", "kok-IN", "कोंकणी"),
    ("Maithili", "mai-IN", "मैथिली"),
    ("Malayalam", "ml-IN", "മലയാളം"),
    ("Manipuri", "mni-IN", "মৈতৈলোন্"),
    ("Marathi", "mr-IN", "मराठी"),
    ("Nepali", "ne-IN", "नेपाली"),
    ("Odia", "od-IN", "ଓଡ଼ିଆ"),
    ("Punjabi", "pa-IN", "ਪੰਜਾਬੀ"),
    ("Sanskrit", "sa-IN", "संस्कृतम्"),
    ("Santali", "sat-IN", "ᱥᱟᱱᱛᱟᱲᱤ"),
    ("Sindhi", "sd-IN", "سنڌي"),
    ("Tamil", "ta-IN", "தமிழ்"),
    ("Telugu", "te-IN", "తెలుగు"),
    ("Urdu", "ur-IN", "اردو"),
]
LANG_NAME = {code: name for name, code, _ in LANGUAGES}
LANG_NAME["en-IN"] = "English"
TTS_CODES = {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN"}
# Languages without their own voice are read by the Hindi voice (same Devanagari script family where possible).
TTS_FALLBACK = "hi-IN"

app = Flask(__name__, static_folder=os.path.join(BASE, "static"), static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0   # edits to static files show up on the next reload

_hits = {}
RATE_LIMIT = int(os.environ.get("RATE_LIMIT", 60))   # API calls per visitor per minute, protects your Sarvam credits


@app.before_request
def throttle():
    if not request.path.startswith("/api/") or request.path in ("/api/languages", "/api/samples"):
        return None
    ip = request.headers.get("CF-Connecting-IP") or request.remote_addr   # real visitor IP behind a Cloudflare tunnel
    now = time.time()
    recent = [t for t in _hits.get(ip, []) if now - t < 60]
    if len(recent) >= RATE_LIMIT:
        return jsonify(error="Too many requests. Please wait a minute and try again."), 429
    recent.append(now)
    _hits[ip] = recent
    return None

_client = None
_docs = {}  # doc_id -> extracted text (in memory only)
_cache_lock = threading.Lock()


def client():
    global _client
    if _client is None:
        key = os.environ.get("SARVAM_API_KEY")
        if not key:
            raise RuntimeError("SARVAM_API_KEY is not set in .env")
        _client = SarvamAI(api_subscription_key=key)
    return _client


def load_cache():
    try:
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def api_error(e):
    status = getattr(e, "status_code", None)
    if status == 402:
        msg = "Sarvam account has no credits. Add credits on the Sarvam dashboard."
    elif status == 429:
        msg = "Too many requests. Please wait a moment and try again."
    elif status in (401, 403):
        msg = "The Sarvam API key was rejected."
    else:
        msg = "Something went wrong talking to Sarvam."
    return jsonify(error=msg, status=status or 500), (status if status in (402, 429, 403) else 502)


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/languages")
def languages():
    return jsonify([{"name": n, "code": c, "native": nat, "voice": c in TTS_CODES} for n, c, nat in LANGUAGES])


def _translate_one(text, target):
    for attempt in range(4):
        try:
            r = client().text.translate(
                input=text[:1000], source_language_code="en-IN", target_language_code=target, model="sarvam-translate:v1"
            )
            return r.translated_text
        except Exception as e:
            if getattr(e, "status_code", None) == 429 and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            return None
    return None


@app.post("/api/translate")
def translate():
    """Translate English UI strings into the chosen language. Results are cached on disk and shared by all users."""
    data = request.get_json(force=True)
    target = data.get("lang", "hi-IN")
    strings = [str(x) for x in data.get("strings", [])[:80]]
    if target == "en-IN":
        return jsonify(strings=strings, translated=True)
    cache = load_cache()
    todo = [x for x in dict.fromkeys(strings) if f"{target}|{x}" not in cache]
    new = {}
    if todo:
        with ThreadPoolExecutor(max_workers=5) as pool:
            for text, out in zip(todo, pool.map(lambda t: _translate_one(t, target), todo)):
                if out:
                    new[f"{target}|{text}"] = out
        if new:
            with _cache_lock:
                merged = load_cache()
                merged.update(new)
                with open(CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(merged, f, ensure_ascii=False)
            cache.update(new)
    out = [cache.get(f"{target}|{x}", x) for x in strings]
    return jsonify(strings=out, translated=all(f"{target}|{x}" in cache for x in strings))


@app.get("/api/samples")
def samples():
    """Every image dropped into static/samples shows up automatically."""
    folder = os.path.join(BASE, "static", "samples")
    files = sorted(n for n in os.listdir(folder) if os.path.splitext(n)[1].lower() in {".png", ".jpg", ".jpeg", ".webp"})
    return jsonify([{"file": n, "label": os.path.splitext(n)[0].replace("_", " ").replace("-", " ").title()} for n in files])


@app.post("/api/upload")
def upload():
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify(error="No file received."), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        return jsonify(error="Please upload a photo (JPG, PNG) or a PDF."), 400
    lang = request.form.get("lang", "hi-IN")
    doc_lang = {"od-IN": "or-IN", "brx-IN": "bodo-IN"}.get(lang, lang)
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, f"document{ext}")
        f.save(path)
        try:
            job = client().document_intelligence.create_job(language=doc_lang, output_format="md")
            job.upload_file(path)
            job.start()
            status = job.wait_until_complete(poll_interval=2.0, timeout=180)
            state = str(getattr(status, "job_state", "")).lower()
            if "fail" in state:
                return jsonify(error="Could not read this document. Try a clearer photo."), 422
            out = os.path.join(tmp, "out")
            job.download_output(out)
            text = _read_output(out)
        except Exception as e:
            return api_error(e)
    if not text.strip():
        return jsonify(error="No text was found in this picture. Try a clearer, well-lit photo."), 422
    doc_id = uuid.uuid4().hex
    _docs[doc_id] = text[:30000]
    return jsonify(doc_id=doc_id, preview=text[:600])


def _read_output(path):
    with open(path, "rb") as fh:
        raw = fh.read()
    if zipfile.is_zipfile(io.BytesIO(raw)):
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            parts = [z.read(n).decode("utf-8", "ignore") for n in sorted(z.namelist()) if n.endswith((".md", ".txt", ".html"))]
        return "\n\n".join(parts)
    return raw.decode("utf-8", "ignore")


SYSTEM_PROMPT = (
    "You are Bank Sathi, a patient, friendly helper for elderly people and people who do not know English, "
    "who need help with banking and money matters in India. Rules: "
    "1) Reply ONLY in {lang}, in very simple, short sentences, as if talking to a grandparent. "
    "2) Use at most 6 short sentences, or a numbered list of short steps when the user asks what to do. "
    "3) When a document is provided, base your answer on it and say clearly if the document does not contain the answer. "
    "4) Never ask for or repeat OTPs, PINs, passwords or full card numbers, and remind the user never to share them. "
    "5) Do not give investment advice; for big decisions suggest visiting the bank branch with a trusted family member. "
    "6) Do not use markdown symbols like ** or #. Write plain text only."
)


@app.post("/api/chat")
def chat():
    data = request.get_json(force=True)
    question = (data.get("question") or "").strip()[:2000]
    if not question:
        return jsonify(error="Please type your question."), 400
    lang = data.get("lang", "hi-IN")
    system = SYSTEM_PROMPT.format(lang=LANG_NAME.get(lang, "Hindi"))
    context = (data.get("context") or "").strip()[:4000]
    if context:
        system += "\n\nBackground facts for this question. Use ONLY these facts. Do not state any amount, age, rate or date that is not written here. If the facts do not answer the question, say so and tell the user to ask at the bank or post office:\n---\n" + context + "\n---"
    doc_text = _docs.get(data.get("doc_id"))
    if doc_text:
        system += "\n\nThe user's document (text extracted from a photo or PDF):\n---\n" + doc_text + "\n---"
    history = [
        {"role": m["role"], "content": str(m["content"])[:2000]}
        for m in (data.get("history") or [])[-8:]
        if m.get("role") in ("user", "assistant")
    ]
    messages = [{"role": "system", "content": system}, *history, {"role": "user", "content": question}]
    try:
        r = client().chat.completions(model="sarvam-105b", messages=messages, temperature=0.3, max_tokens=1800, reasoning_effort=None)
    except Exception as e:
        return api_error(e)
    answer = (r.choices[0].message.content or "").strip()
    answer = re.sub(r"[*#`]+", "", answer)
    return jsonify(answer=answer or "Sorry, I could not answer that. Please try asking in another way.")


@app.post("/api/tts")
def tts():
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify(error="Nothing to read."), 400
    lang = data.get("lang", "hi-IN")
    code = lang if lang in TTS_CODES else TTS_FALLBACK
    chunks = _chunk(text, 2400)[:3]
    audios = []
    try:
        for c in chunks:
            r = client().text_to_speech.convert(text=c, language_code=code, model="bulbul:v3", speaker="shubh")
            audios.extend(r.audios)
    except Exception as e:
        return api_error(e)
    return jsonify(audios=audios, mime="audio/wav", fallback=lang not in TTS_CODES)


FLAG_TEXT = {
    "asks_secret": "It asks you to share or enter an OTP, PIN, CVV, password or your account or card details. A real bank never does this.",
    "unverified_credit": "It says money was deposited, but it does not look like a real bank alert. Check your passbook or bank app. Scammers send fake deposit messages and then ask you to return the money.",
    "prize": "It promises a prize, lottery, cashback or free money.",
    "kyc_block": "It says your account or KYC will be blocked unless you act now.",
    "call_number": "It asks you to call an ordinary mobile number.",
    "link": "It has a link. Do not tap links in messages you did not expect.",
    "urgency": "It tries to scare or hurry you with words like urgent, today or immediately.",
    "loan_offer": "It offers an easy loan with no documents.",
    "mobile_sender": "It came from an ordinary mobile number, not a bank's official sender name.",
}
STRONG = {"asks_secret", "prize", "kyc_block", "call_number", "loan_offer"}


def sms_flags(text, sender):
    t = text.lower()
    flags = []
    negated = re.search(r"(do not|don't|dont|never|not to)\s+(share|disclose|give|tell)", t)
    if re.search(r"(send|share|give|tell|provide|reply|enter|submit|update|confirm)\W+(?:\w+\W+){0,4}(otp|pin|cvv|password|passcode|account (number|no)|bank details|card (number|details)|aadhaar)", t) and not negated:
        flags.append("asks_secret")
    if re.search(r"\b(won|winner|lottery|lucky draw|prize|jackpot|free gift|cashback|crore|kbc)\b", t):
        flags.append("prize")
    if re.search(r"kyc|pan (card )?(update|expire)|account.{0,25}(block|suspend|deactivat|clos)", t) and re.search(r"update|verify|block|suspend|expire|deactivat|immediately", t):
        flags.append("kyc_block")
    if re.search(r"(call|contact|whatsapp|dial)\W+(?:\w+\W+){0,4}(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}", t):
        flags.append("call_number")
    if re.search(r"https?://|www\.|\b[a-z0-9-]+\.(xyz|top|click|link|cc|info|online|site|live|in|com)\b/?\S*", t):
        flags.append("link")
    if re.search(r"\b(urgent|immediately|within \d+ ?(hours|hrs|minutes)|expires? (today|soon)|last chance|today only|tonight|final notice|act now)\b", t):
        flags.append("urgency")
    if re.search(r"(pre-?approved|instant|easy).{0,30}loan|loan.{0,40}(no documents?|without documents?|0%)", t):
        flags.append("loan_offer")
    sender = (sender or "").strip()
    official = bool(sender) and bool(re.fullmatch(r"[A-Za-z]{2}-[A-Za-z0-9]{3,8}", sender))
    if sender and not official:
        flags.append("mobile_sender")
    # a "money received" message with no official sender and none of the usual alert details (A/c XX1234, Avl Bal, Ref no.)
    if (re.search(r"\b(dep\w*ited|deposit\w*|credited|received)\b", t) and not official
            and not re.search(r"a/c|acct|avl|bal\b|\bref\b|\bxx\d+|\bupi\b|\*{2,}\d+", t)):
        flags.append("unverified_credit")
    return flags


def sms_verdict(text, flags):
    if any(f in STRONG for f in flags) or len(flags) >= 2:
        return "suspicious"
    if flags:
        return "unsure"
    if re.search(r"\b(a/c|acct|account|debited|credited|avl|bal|upi|otp|statement|txn|transaction)\b", text.lower()):
        return "bank"
    return "unsure"


GUIDE = {
    "suspicious": "Say clearly that this looks like a scam.",
    "bank": "Say it looks like a normal bank message. Do not call it a scam.",
    "unsure": ("Do NOT say it is definitely fake and do NOT say it is definitely real. Say honestly that you cannot be sure from the text alone "
               "and explain what looks odd. The steps must be about checking safely: open the bank app or look at the passbook or call the bank on the "
               "number printed on the card, never use a number or link from the message, and never send or return any money to the sender."),
}


@app.post("/api/check-sms")
def check_sms():
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()[:1500]
    if len(text) < 8:
        return jsonify(error="Please paste the full message."), 400
    lang = data.get("lang", "hi-IN")
    flags = sms_flags(text, data.get("sender"))
    verdict = sms_verdict(text, flags)
    answer = None
    meaning = {"suspicious": "SUSPICIOUS - likely a scam", "bank": "looks like a normal bank message",
               "unsure": "not clear - be careful"}[verdict]
    prompt = (
        f"A user received this SMS:\n\"\"\"{text}\"\"\"\n"
        f"Sender: {data.get('sender') or 'unknown'}\n"
        f"Our checker's verdict (do not change it): {meaning}.\n"
        f"Red flags found: {'; '.join(FLAG_TEXT[f] for f in flags) or 'none'}.\n\n"
        f"{GUIDE[verdict]}\n\n"
        f"Reply ONLY in {LANG_NAME.get(lang, 'Hindi')}, in very simple words. First write 1-2 short sentences saying what this message is and why. "
        "Then write 3 or 4 short numbered steps telling the user exactly what to do next "
        "(for a scam: do not click, do not call, do not share anything, block the sender, report at 1930 or cybercrime.gov.in, "
        "call the bank on the number printed on the card; for a normal bank message: what it means and whether any action is needed). "
        "Plain text only, no markdown."
    )
    try:
        r = client().chat.completions(
            model="sarvam-105b",
            messages=[{"role": "system", "content": SYSTEM_PROMPT.format(lang=LANG_NAME.get(lang, "Hindi"))},
                      {"role": "user", "content": prompt}],
            temperature=0.2, max_tokens=1200, reasoning_effort=None)
        answer = re.sub(r"[*#`]+", "", (r.choices[0].message.content or "").strip()) or None
    except Exception:
        answer = None  # the verdict and red flags still work without the AI explanation
    return jsonify(verdict=verdict, flags=[{"code": f, "text": FLAG_TEXT[f]} for f in flags], answer=answer)


PAGES = {
    "scan": "read or ask about a photo of a bank paper: passbook, fixed deposit, loan, pension or any document",
    "steps": "describe a problem or situation and be told what to do next and what to carry to the bank",
    "form": "get help to fill in a bank form such as account opening, loan application, deposit slip or life certificate",
    "sms": "check whether an SMS or message received is a real bank message or a scam",
    "schemes": "learn about government schemes for pension, insurance, savings, farmers, loans, health or girl child",
    "words": "learn the meaning of a banking word such as nominee, KYC, EMI or interest",
    "safe": "learn how to stay safe from fraud and scams",
    "help": "learn how to use this website",
}
PAGE_WORDS = {
    "sms": r"sms|message|msg|scam|fraud message|lottery|otp|spam|fake|संदेश|मैसेज|ठग|धोखा",
    "form": r"\bform\b|fill|apply|application|फॉर्म|फार्म|भर",
    "scan": r"scan|photo|picture|passbook|paper|document|read|पासबुक|फोटो|कागज|दस्तावेज",
    "schemes": r"scheme|yojana|pension plan|insurance|subsid|government|योजना|सरकारी|बीमा",
    "words": r"meaning|what is|what does|explain|word|मतलब|अर्थ|शब्द",
    "safe": r"safe|security|protect|सुरक्षा|सुरक्षित",
    "help": r"how to use|help me use|instruction|guide|कैसे उपयोग|कैसे इस्तेमाल",
    "steps": r"problem|issue|not come|lost|stolen|blocked|what should i do|next step|समस्या|दिक्कत|परेशानी|खो",
}


@app.post("/api/route")
def route_voice():
    """Work out which page a spoken or typed request belongs to."""
    data = request.get_json(force=True)
    text = (data.get("text") or "").strip()[:500]
    if not text:
        return jsonify(error="Please say or type what you want to do."), 400
    menu = "\n".join(f"{k}: {v}" for k, v in PAGES.items())
    prompt = (f'A user of a banking helper website said (in any Indian language): "{text}"\n\n'
              f"Pick the ONE page that best matches what they want:\n{menu}\nnone: nothing above matches\n\n"
              "Reply with ONLY the page id (scan, steps, form, sms, schemes, words, safe, help or none), nothing else.")
    tab = None
    try:
        r = client().chat.completions(model="sarvam-105b", messages=[{"role": "user", "content": prompt}],
                                      temperature=0, max_tokens=20, reasoning_effort=None)
        out = (r.choices[0].message.content or "").lower()
        tab = next((k for k in [*PAGES, "none"] if re.search(rf"\b{k}\b", out)), None)
    except Exception:
        tab = None
    if tab is None:   # AI unavailable or unclear: simple keyword rules
        tab = next((k for k, pat in PAGE_WORDS.items() if re.search(pat, text.lower())), "none")
    return jsonify(tab=tab)


STT_LANGS = {"hi-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN", "en-IN", "gu-IN", "as-IN",
             "ur-IN", "ne-IN", "kok-IN", "ks-IN", "sd-IN", "sa-IN", "sat-IN", "mni-IN", "brx-IN", "mai-IN", "doi-IN"}


@app.post("/api/stt")
def stt():
    """Speech to text for the microphone button (recorded in the browser or by the phone's recorder)."""
    f = request.files.get("file")
    if not f:
        return jsonify(error="No audio received."), 400
    audio = f.read()
    if len(audio) < 1000:
        return jsonify(error="The recording was too short. Please try again."), 400
    lang = request.form.get("lang", "hi-IN")
    ctype = (f.mimetype or "audio/webm").split(";")[0]
    try:
        r = client().speech_to_text.transcribe(
            file=(f.filename or "voice.webm", audio, ctype),
            model="saaras:v4",
            language_code=lang if lang in STT_LANGS else "unknown",
        )
    except Exception as e:
        return api_error(e)
    text = (r.transcript or "").strip()
    if not text:
        return jsonify(error="I could not hear anything. Please try again."), 422
    heard = r.language_code if r.language_code in STT_LANGS else None   # set when lang="auto"/"unknown"
    return jsonify(text=text, lang=heard)


@app.post("/api/detect-lang")
def detect_lang():
    """Which language is this typed text in? (used by the Home prompt to switch the page language)"""
    text = (request.get_json(force=True).get("text") or "").strip()[:1000]
    if len(text) < 3:
        return jsonify(lang=None)
    try:
        code = client().text.identify_language(input=text).language_code
    except Exception:
        code = None
    return jsonify(lang=code if code in STT_LANGS else None)


def _chunk(text, size):
    parts, cur = [], ""
    for sentence in re.split(r"(?<=[.!?।॥])\s+", text):
        if len(cur) + len(sentence) + 1 > size and cur:
            parts.append(cur)
            cur = ""
        cur = f"{cur} {sentence}".strip()
    if cur:
        parts.append(cur)
    return parts


def lan_ips():
    import subprocess
    try:
        return [ip for ip in subprocess.run(["hostname", "-I"], capture_output=True, text=True).stdout.split() if "." in ip]
    except OSError:
        return []


def ensure_cert():
    """Browsers only allow the microphone on https (or localhost), so serve a self-signed certificate on the LAN."""
    import subprocess
    d = os.path.join(BASE, "certs")
    cert, key = os.path.join(d, "cert.pem"), os.path.join(d, "key.pem")
    if not (os.path.exists(cert) and os.path.exists(key)):
        os.makedirs(d, exist_ok=True)
        san = ",".join(["DNS:localhost", "IP:127.0.0.1"] + [f"IP:{ip}" for ip in lan_ips()])
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "825", "-keyout", key, "-out", cert,
                        "-subj", "/CN=Bank Sathi", "-addext", f"subjectAltName={san}"], check=True, capture_output=True)
        os.chmod(key, 0o600)
    return cert, key


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    use_https = os.environ.get("HTTPS", "1") != "0"
    ctx = ensure_cert() if use_https else None
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True, ssl_context=ctx,
            use_reloader=os.environ.get("RELOAD", "1") != "0")   # restarts by itself when you edit a .py file
