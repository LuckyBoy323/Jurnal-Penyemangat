/* ==========================================================================
   JURNAL SEMANGAT MAULIA - Vanilla JS book engine (tanpa dependensi)
   ========================================================================== */
const state = {
  isCoverOpen: false,
  currentChapter: 1,
  isWaxCracked: false,
  turning: false,
};
const $ = (id) => document.getElementById(id);
const spreadMQ = window.matchMedia("(min-width: 1000px)");
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const dom = {
  bookVolume: $("book-3d-container"),
  cover: $("book-cover"),
  stage: $("page-mesh-stage"),
  pageIndicator: $("page-indicator"),
  waxSeal: $("wax-seal"),
  waxEnvelope: $("wax-envelope"),
  nekoSpeechText: $("neko-speech-text"),
  boosterModal: $("booster-modal"),
  modalTitle: $("modal-title"),
  modalBody: $("modal-body"),
  modalBadge: $("modal-icon-badge"),
  lightboxModal: $("lightbox-modal"),
  lightboxImg: $("lightbox-img"),
  lightboxCaption: $("lightbox-caption"),
};

/* ---------- Audio synthesizer (Web Audio API) ---------- */
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function noiseBurst(
  dur,
  { type = "bandpass", freq = 3000, q = 1, gain = 0.1, sweepTo } = {},
) {
  const ctx = getAudioContext(),
    t = ctx.currentTime;
  const buf = ctx.createBuffer(
    1,
    Math.ceil(ctx.sampleRate * dur),
    ctx.sampleRate,
  );
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++)
    d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  src.buffer = buf;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  src.start(t);
}
function tone(freq, dur, { type = "sine", gain = 0.1, to } = {}) {
  const ctx = getAudioContext(),
    t = ctx.currentTime,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}
const safe =
  (fn) =>
  (...a) => {
    try {
      fn(...a);
    } catch (e) {}
  };
const playPaperSound = safe(() =>
  noiseBurst(0.3, { freq: 2500, sweepTo: 6500, q: 0.7, gain: 0.12 }),
);
const playChimeSound = safe(() => {
  tone(880, 0.5, { gain: 0.09 });
  tone(1320, 0.7, { gain: 0.05 });
});
const playCrackSound = safe(() => {
  noiseBurst(0.12, { type: "highpass", freq: 1800, gain: 0.35 });
  tone(140, 0.15, { type: "triangle", gain: 0.25, to: 40 });
  setTimeout(
    safe(() => noiseBurst(0.08, { type: "highpass", freq: 2600, gain: 0.25 })),
    90,
  );
});
const playMeowSound = safe(() => {
  const ctx = getAudioContext(),
    t = ctx.currentTime;
  const o = ctx.createOscillator(),
    f = ctx.createBiquadFilter(),
    g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(420, t);
  o.frequency.linearRampToValueAtTime(820, t + 0.15);
  o.frequency.linearRampToValueAtTime(380, t + 0.45);
  f.type = "bandpass";
  f.frequency.value = 1400;
  f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.5);
});
const playPurrSound = safe(() => {
  const ctx = getAudioContext(),
    t = ctx.currentTime + 0.4;
  const o = ctx.createOscillator(),
    lfo = ctx.createOscillator(),
    depth = ctx.createGain(),
    g = ctx.createGain(),
    f = ctx.createBiquadFilter();
  o.type = "sawtooth";
  o.frequency.value = 55;
  f.type = "lowpass";
  f.frequency.value = 260;
  lfo.frequency.value = 24;
  depth.gain.value = 0.04;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  lfo.connect(depth);
  depth.connect(g.gain);
  o.connect(f);
  f.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + 1.2);
  lfo.stop(t + 1.2);
});

/* ---------- Buku: sampul & halaman ---------- */
function openBookCover() {
  if (state.isCoverOpen) return;
  state.isCoverOpen = true;
  dom.bookVolume.classList.replace("cover-closed", "cover-opened");
  $("toggle-cover-btn").classList.remove("hidden");
  playPaperSound();
}
function closeBookCover() {
  if (!state.isCoverOpen) return;
  state.isCoverOpen = false;
  dom.bookVolume.classList.replace("cover-opened", "cover-closed");
  $("toggle-cover-btn").classList.add("hidden");
  playPaperSound();
}

function showChapter(n, animateClass) {
  document.querySelectorAll(".chapter-page").forEach((p) => {
    p.classList.remove("page-active", "flip-in", "flip-back");
    p.classList.add("hidden-page");
  });
  const page = $(`page-chapter-${n}`);
  if (page) {
    page.classList.replace("hidden-page", "page-active");
    page.scrollTop = 0;
    if (animateClass) {
      void page.offsetWidth;
      page.classList.add(animateClass);
      page.addEventListener(
        "animationend",
        () => page.classList.remove(animateClass),
        { once: true },
      );
    }
  }
  state.currentChapter = n;
  dom.pageIndicator.innerText = `Halaman ${n} dari 6`;
}

function goToChapter(n) {
  if (!state.isCoverOpen) openBookCover();
  if (n < 1 || n > 6 || state.turning) return;
  const forward = n >= state.currentChapter;
  playChimeSound();
  playPaperSound();
  if (spreadMQ.matches && !reduceMotion && n !== state.currentChapter) {
    state.turning = true;
    const leaf = document.createElement("div");
    leaf.className = "turn-leaf" + (forward ? "" : " back");
    dom.stage.appendChild(leaf);
    setTimeout(() => showChapter(n, null), 430);
    setTimeout(() => {
      leaf.remove();
      state.turning = false;
    }, 980);
  } else {
    showChapter(n, forward ? "flip-in" : "flip-back");
  }
}
const nextPage = () =>
  state.currentChapter < 6 && goToChapter(state.currentChapter + 1);
const prevPage = () =>
  state.currentChapter > 1 && goToChapter(state.currentChapter - 1);

/* ---------- Bab 2: segel lilin ---------- */
function crackWaxSeal() {
  if (state.isWaxCracked) return;
  state.isWaxCracked = true;
  playCrackSound();
  dom.waxSeal.classList.add("cracked");
  setTimeout(() => {
    dom.waxEnvelope.classList.add("unsealed");
    playChimeSound();
  }, 600);
}

/* ---------- Bab 3: Neko & es krim ---------- */
const catQuotes = [
  "Purrr~ Maul jangan lupa minum air putih pas belajar ya!",
  "TKA itu cuma step kecil. Kemampuan Maul jauh lebih besar dari ujian apapun!",
  "Kalau kerasa capek, meowww... rebahan sebentar gak dosa kok!",
  "FEB UNAIR udah nungguin kamu kok, Maul! Semangat!",
];
function petNekoCat() {
  playMeowSound();
  playPurrSound();
  dom.nekoSpeechText.innerText =
    catQuotes[Math.floor(Math.random() * catQuotes.length)];
  const av = document.querySelector("#page-chapter-4 .neko-avatar-wrapper");
  [dom.nekoSpeechText, av].forEach((el, i) => {
    const c = i ? "purr" : "pop";
    el.classList.remove(c);
    void el.offsetWidth;
    el.classList.add(c);
  });
}
/* ---------- Bab 5: hati ungu V ---------- */
const vQuotes = [
  "Widihh disemangatin sama idolanya meoww! V bilang: 'Borahea Maulia!' 💜",
  "V bilang: 'Jangan lupa senyum hari ini ya Maul!' ✨💜",
  "V bilang: 'Kalau lelah, rehat sebentar sambil dengerin lagu favoritmu. Semangat TKA-nya Maul!' 🎶💜",
  "V bilang: 'Kamu sudah berusaha keras sejauh ini. Aku bangga sama kamu, Maulia!' 🌟💜",
  "Iri banget sama idolmu, bisa dapet cinta sebanyak itu dari Maul. When ya Neko dapet cinta sebanyak itu juga? meoww... 💜",
  "Kalau Neko berubah jadi Kim Taehyung, Maul bakal sedemikian sayangnya juga gak ya sama Neko? Meoww... 🥺💜",
];
let lastVQuote = -1;
function retrigger(el, classes) {
  el.classList.remove(...classes);
  void el.offsetWidth;
  el.classList.add(...classes);
}
function petVHeart() {
  playChimeSound();
  let i;
  do {
    i = Math.floor(Math.random() * vQuotes.length);
  } while (i === lastVQuote && vQuotes.length > 1);
  lastVQuote = i;
  const text = $("v-speech-text");
  text.innerText = vQuotes[i];
  retrigger($("v-heart-avatar"), ["heart-pop", "glow-on"]);
  retrigger(text, ["pop"]);
}

function openBoosterModal(title, body, icon) {
  playChimeSound();
  dom.modalTitle.innerText = title;
  dom.modalBody.innerText = body;
  dom.modalBadge.innerText = icon;
  dom.boosterModal.classList.remove("hidden-modal");
}
const closeBoosterModal = () => dom.boosterModal.classList.add("hidden-modal");
document.addEventListener("click", (e) => {
  const c = e.target.closest(".icecream-card");
  if (!c) return;
  c.classList.add("picked");
  setTimeout(() => c.classList.remove("picked"), 1200);
});

/* ---------- Bab 4: kartu ---------- */
function flipAffirmationCard(cardEl) {
  cardEl.classList.toggle("flipped");
  playChimeSound();
}
function shuffleCardDeck() {
  playPaperSound();
  const deck = document.querySelector(".card-deck-grid");
  const cards = [...deck.children];
  cards.forEach((c) => c.classList.remove("flipped"));
  const first = cards.map((c) => c.getBoundingClientRect());
  let order;
  do {
    order = [...cards].sort(() => Math.random() - 0.5);
  } while (order.every((c, i) => c === cards[i]));
  order.forEach((c) => deck.appendChild(c));
  cards.forEach((c, i) => {
    const l = c.getBoundingClientRect(),
      dx = first[i].left - l.left,
      dy = first[i].top - l.top;
    c.animate(
      [
        { transform: `translate(${dx}px,${dy}px)` },
        {
          transform: `translate(${dx / 2}px,${dy / 2 - 56}px) rotate(${(Math.random() - 0.5) * 26}deg) scale(1.1)`,
          offset: 0.5,
        },
        { transform: "none" },
      ],
      { duration: 850, easing: "cubic-bezier(.3,.8,.3,1)" },
    );
  });
  setTimeout(playPaperSound, 300);
}

/* ---------- Bab 5: balon & lightbox ---------- */
function launchPurpleBalloons() {
  playChimeSound();
  const add = (el, ms) => {
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };
  for (let i = 0; i < 12; i++) {
    const b = document.createElement("div"),
      d = 4 + Math.random() * 3;
    b.className = "balloon";
    b.style.cssText = `left:${Math.random() * 90 + 3}vw;--w:${44 + Math.random() * 34}px;--d:${d}s;animation-delay:${Math.random() * 0.8}s,0s`;
    add(b, (d + 1) * 1000);
  }
  for (let i = 0; i < 18; i++) {
    const h = document.createElement("div"),
      d = 3 + Math.random() * 3;
    h.className = "heart-float";
    h.innerText = "💜";
    h.style.cssText = `left:${Math.random() * 94 + 2}vw;font-size:${16 + Math.random() * 22}px;--d:${d}s;--dx:${Math.random() * 90 - 45}px;--r:${Math.random() * 60 - 30}deg;animation-delay:${Math.random() * 1.2}s`;
    add(h, (d + 1.5) * 1000);
  }
}
function openLightbox(src, caption) {
  playChimeSound();
  dom.lightboxImg.src = src;
  dom.lightboxCaption.innerText = caption;
  dom.lightboxModal.classList.remove("hidden-modal");
}
const closeLightbox = () => dom.lightboxModal.classList.add("hidden-modal");

/* ---------- Suasana: lilin & audio latar ---------- */
function toggleCandlelight() {
  document.body.classList.toggle("candlelight-mode");
  playChimeSound();
}
let ambientActive = false,
  padNodes = null;
function cycleAmbientAudio() {
  ambientActive = !ambientActive;
  toggleAmbientPad(ambientActive);
  $("ambient-text").innerText = ambientActive ? "Borahae Lo-Fi" : "Audio Latar";
  playChimeSound();
}
function toggleAmbientPad(on) {
  try {
    const ctx = getAudioContext();
    if (on && !padNodes) {
      const master = ctx.createGain(),
        lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 700;
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
      const oscs = [220, 277.18, 329.63, 440].map((f, i) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f;
        o.detune.value = i * 4 - 6;
        o.connect(lp);
        o.start();
        return o;
      });
      lp.connect(master);
      master.connect(ctx.destination);
      padNodes = { master, oscs };
    } else if (!on && padNodes) {
      padNodes.master.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.8,
      );
      padNodes.oscs.forEach((o) => o.stop(ctx.currentTime + 0.9));
      padNodes = null;
    }
    $("ambient-icon").innerText = on ? "🎶" : "🌧️";
  } catch (e) {}
}

/* ---------- Interaksi pointer: foil sampul + polaroid ---------- */
dom.cover.addEventListener("pointermove", (e) => {
  const r = dom.cover.getBoundingClientRect();
  dom.cover.style.setProperty(
    "--mx",
    `${((e.clientX - r.left) / r.width) * 100}%`,
  );
  dom.cover.style.setProperty(
    "--my",
    `${((e.clientY - r.top) / r.height) * 100}%`,
  );
});
document.addEventListener("pointermove", (e) => {
  const card = e.target.closest && e.target.closest(".polaroid-card");
  if (!card) return;
  const r = card.getBoundingClientRect(),
    x = (e.clientX - r.left) / r.width - 0.5,
    y = (e.clientY - r.top) / r.height - 0.5;
  card.style.setProperty("--ry", `${x * 16}deg`);
  card.style.setProperty("--rx", `${-y * 16}deg`);
  card.style.setProperty("--px", `${-x * 4}px`);
  card.style.setProperty("--py", `${-y * 4}px`);
});
document.addEventListener("pointerout", (e) => {
  const card = e.target.closest && e.target.closest(".polaroid-card");
  if (!card || card.contains(e.relatedTarget)) return;
  ["--rx", "--ry", "--px", "--py"].forEach((v) => card.style.removeProperty(v));
});
document.addEventListener("keydown", (e) => {
  const t = e.target;
  if (
    (e.key === "Enter" || e.key === " ") &&
    t.matches &&
    t.matches('[role="button"][tabindex]')
  ) {
    e.preventDefault();
    t.click();
    return;
  }
  if (!state.isCoverOpen) {
    if (e.key === "Enter" && document.activeElement === dom.bookVolume)
      openBookCover();
    return;
  }
  if (e.key === "ArrowRight") nextPage();
  if (e.key === "ArrowLeft") prevPage();
  if (e.key === "Escape") {
    closeBoosterModal();
    closeLightbox();
  }
});

/* ---------- Partikel: bintang Borahae & orb cahaya lilin ---------- */
(function particles() {
  const cv = $("particles"),
    ctx = cv.getContext("2d");
  let W,
    H,
    dpr,
    items = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * dpr;
    H = cv.height = innerHeight * dpr;
    items = Array.from({ length: innerWidth < 700 ? 38 : 70 }, () => ({
      x: rnd(0, W),
      y: rnd(0, H),
      r: rnd(0.6, 2.2) * dpr,
      orb: Math.random() < 0.16,
      vy: rnd(0.08, 0.35) * dpr,
      ph: rnd(0, 6.28),
      sp: rnd(0.01, 0.03),
      hue: Math.random() < 0.5 ? "212,175,55" : "192,132,252",
    }));
    items.forEach((p) => {
      if (p.orb) p.r = rnd(14, 34) * dpr;
    });
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of items) {
      p.ph += p.sp;
      p.y -= p.vy * (p.orb ? 0.5 : 1);
      p.x += Math.sin(p.ph) * 0.25 * dpr;
      if (p.y < -p.r * 2) {
        p.y = H + p.r * 2;
        p.x = rnd(0, W);
      }
      const a = p.orb
        ? 0.07 + Math.sin(p.ph) * 0.03
        : 0.35 + Math.sin(p.ph * 3) * 0.35;
      const g = ctx.createRadialGradient(
        p.x,
        p.y,
        0,
        p.x,
        p.y,
        p.r * (p.orb ? 1 : 3),
      );
      g.addColorStop(0, `rgba(${p.hue},${Math.max(a, 0)})`);
      g.addColorStop(1, `rgba(${p.hue},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (p.orb ? 1 : 3), 0, 6.283);
      ctx.fill();
    }
    if (!reduceMotion && !document.hidden) requestAnimationFrame(frame);
  }
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !reduceMotion) requestAnimationFrame(frame);
  });
  resize();
  frame();
})();
