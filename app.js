// app.js (sin módulos, usa globals: STORAGE_KEY, AUDIO_SETTINGS_KEY, QUESTIONS)

// =====================
// Audio: autoplay + gate + SOLO mute
// =====================
const bgm = document.getElementById("bgm");
const muteBtn = document.getElementById("muteBtn");
const muteIcon = document.getElementById("muteIcon");
const audioGate = document.getElementById("audioGate");
const audioGateBtn = document.getElementById("audioGateBtn");

let audioCtx = null;
let muted = false;

(function initAudio() {
  loadAudioSettings();
  applyMute();
  bgm.loop = true;

  attemptAutoPlay();

  audioGateBtn.addEventListener("click", async () => {
    await ensureAudioUnlocked();
    try { await bgm.play(); hideAudioGate(); } catch {}
  });

  muteBtn.addEventListener("click", async () => {
    await ensureAudioUnlocked();
    muted = !muted;
    applyMute();
    saveAudioSettings();
  });

  window.addEventListener("pointerdown", async () => {
    await ensureAudioUnlocked();
    if (bgm.paused) {
      try { await bgm.play(); hideAudioGate(); } catch {}
    }
  }, { once: true, capture: true });
})();

async function attemptAutoPlay() {
  try { await bgm.play(); hideAudioGate(); }
  catch { showAudioGate(); }
}

function showAudioGate(){ audioGate.classList.remove("hidden"); }
function hideAudioGate(){ audioGate.classList.add("hidden"); }

function applyMute(){
  bgm.muted = muted;
  muteIcon.textContent = muted ? "🔇" : "🔊";
}

function saveAudioSettings(){
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ muted }));
}
function loadAudioSettings(){
  const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.muted === "boolean") muted = parsed.muted;
  } catch {}
}

async function ensureAudioUnlocked() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch {}
  }
}

// =====================
// Game State
// =====================
const defaultState = {
  players: [],
  phase: "setup", // setup | turn | questions | doneTurn | round2
  round1: null,
  round2: null,
};

let state = readState();

// round1:
// { order, pairs, answersByTarget, currentTurnIndex, currentQuestionIndex, showTarget }
// round2 (simplificada):
// { caseOrder: [targetName...], caseIndex: 0, answered: { [targetName]: true } }

const setStatus = (text) => (document.getElementById("statusPill").textContent = text);

// =====================
// UI refs
// =====================
const playersChips = document.getElementById("playersChips");
const progressBar = document.getElementById("progressBar");
const meterLabel = document.getElementById("meterLabel");

const screenSetup = document.getElementById("screenSetup");
const screenTurn = document.getElementById("screenTurn");
const screenQuestions = document.getElementById("screenQuestions");
const screenRound1Done = document.getElementById("screenRound1Done");
const screenRound2 = document.getElementById("screenRound2");

const nameInput = document.getElementById("nameInput");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const startRound1Btn = document.getElementById("startRound1Btn");
const toRound2Btn = document.getElementById("toRound2Btn");
const wipeBtn = document.getElementById("wipeBtn");

// Turn
const judgeBadge = document.getElementById("judgeBadge");
const turnCounter = document.getElementById("turnCounter");
const phasePill = document.getElementById("phasePill");
const turnText = document.getElementById("turnText");
const turnOkBtn = document.getElementById("turnOkBtn");

// Questions
const judgeBadge2 = document.getElementById("judgeBadge2");
const targetLabel = document.getElementById("targetLabel");
const qCounter = document.getElementById("qCounter");
const qTitle = document.getElementById("qTitle");
const qText = document.getElementById("qText");
const answersEl = document.getElementById("answers");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Done
const doneText = document.getElementById("doneText");
const doneTags = document.getElementById("doneTags");
const nextTurnBtn = document.getElementById("nextTurnBtn");
const finishRound1Btn = document.getElementById("finishRound1Btn");

// Round2 simplified
const caseCounterBadge = document.getElementById("caseCounterBadge");
const nextCaseBtn = document.getElementById("nextCaseBtn");
const restartRound2Btn = document.getElementById("restartRound2Btn");
const caseTitle = document.getElementById("caseTitle");
const caseSubtitle = document.getElementById("caseSubtitle");
const caseAnswers = document.getElementById("caseAnswers");
const voteChips = document.getElementById("voteChips");
const voteResult = document.getElementById("voteResult");

// =====================
// Init
// =====================
init();

function init() {
  renderPlayers();
  updateButtons();
  renderProgress();
  route();
  setStatus("Listo");
}

// =====================
// Setup events
// =====================
addPlayerBtn.addEventListener("click", () => {
  const name = cleanName(nameInput.value);
  if (!name) return;
  if (state.players.some(p => p.toLowerCase() === name.toLowerCase())) return;
  if (state.round1) return; // no agregar si ya empezó

  state.players.push(name);
  nameInput.value = "";
  persist();
  renderPlayers();
  updateButtons();
  renderProgress();
});

nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addPlayerBtn.click();
});

wipeBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = deepClone(defaultState);
  persist();
  init();
});

// =====================
// Round 1 start
// =====================
startRound1Btn.addEventListener("click", () => {
  if (state.players.length < 2) return;

  const pairs = buildRandomPairs(state.players);
  const order = shuffle(range(state.players.length));

  state.round1 = {
    order,
    pairs,
    answersByTarget: {},
    currentTurnIndex: 0,
    currentQuestionIndex: 0,
    showTarget: false,
  };
  state.round2 = null;
  state.phase = "turn";

  persist();
  updateButtons();
  renderProgress();
  route();
});

toRound2Btn.addEventListener("click", () => {
  if (!canGoRound2()) return;
  startRound2();
});

// =====================
// Turn screen
// =====================
turnOkBtn.addEventListener("click", () => {
  if (state.phase !== "turn") return;
  state.round1.showTarget = true;
  state.phase = "questions";
  state.round1.currentQuestionIndex = 0;
  persist();
  route();
});

// =====================
// Questions nav
// =====================
prevBtn.addEventListener("click", () => {
  if (state.phase !== "questions") return;
  const r1 = state.round1;
  if (r1.currentQuestionIndex > 0) {
    r1.currentQuestionIndex--;
    persist();
    renderQuestions();
    renderProgress();
  }
});

nextBtn.addEventListener("click", () => {
  if (state.phase !== "questions") return;

  const r1 = state.round1;
  const pair = getCurrentPair();
  const target = pair.target;
  const answers = ensureAnswersArrayForTarget(target);
  const qi = r1.currentQuestionIndex;

  if (answers[qi] == null) return;

  if (qi < QUESTIONS.length - 1) {
    r1.currentQuestionIndex++;
    persist();
    renderQuestions();
    renderProgress();
  } else {
    // turno terminado
    r1.showTarget = false;
    state.phase = "doneTurn";
    persist();
    updateButtons();
    route();
  }
});

// =====================
// Done turn
// =====================
nextTurnBtn.addEventListener("click", () => {
  if (state.phase !== "doneTurn") return;

  const r1 = state.round1;
  r1.currentTurnIndex++;

  if (r1.currentTurnIndex >= r1.order.length) {
    // Ronda 1 completa
    setStatus("Ronda 1 completa");
    state.phase = "setup";
    persist();
    updateButtons();
    renderProgress();
    route();
    return;
  }

  state.phase = "turn";
  persist();
  route();
});

finishRound1Btn.addEventListener("click", () => {
  if (!isRound1Complete()) return;
  startRound2();
});

// =====================
// Round 2 simplified flow
// =====================
nextCaseBtn.addEventListener("click", () => {
  if (state.phase !== "round2") return;
  nextRound2Case();
});

restartRound2Btn.addEventListener("click", () => {
  if (state.phase !== "round2") return;
  startRound2(true);
});

// =====================
// Routing
// =====================
function route() {
  hideAllScreens();

  if (state.phase === "setup") {
    screenSetup.classList.remove("hidden");
    renderPlayers();
    updateButtons();
    renderProgress();
    return;
  }

  if (state.phase === "turn") {
    screenTurn.classList.remove("hidden");
    renderTurn();
    updateButtons();
    renderProgress();
    return;
  }

  if (state.phase === "questions") {
    screenQuestions.classList.remove("hidden");
    renderQuestions();
    updateButtons();
    renderProgress();
    return;
  }

  if (state.phase === "doneTurn") {
    screenRound1Done.classList.remove("hidden");
    renderDoneTurn();
    updateButtons();
    renderProgress();
    return;
  }

  if (state.phase === "round2") {
    screenRound2.classList.remove("hidden");
    renderRound2();
    updateButtons();
    renderProgress();
    return;
  }
}

function hideAllScreens() {
  screenSetup.classList.add("hidden");
  screenTurn.classList.add("hidden");
  screenQuestions.classList.add("hidden");
  screenRound1Done.classList.add("hidden");
  screenRound2.classList.add("hidden");
}

// =====================
// Render helpers
// =====================
function renderPlayers() {
  playersChips.innerHTML = "";
  if (state.players.length === 0) {
    playersChips.appendChild(makeChip("Nadie todavía"));
    return;
  }
  state.players.forEach(p => playersChips.appendChild(makeChip(p)));
}

function updateButtons() {
  startRound1Btn.disabled = state.players.length < 2 || !!state.round1;
  toRound2Btn.disabled = !canGoRound2();
  finishRound1Btn.disabled = !isRound1Complete();
}

function renderProgress() {
  const total = state.players.length || 0;

  let completedTargets = 0;
  if (state.round1 && state.round1.answersByTarget) {
    completedTargets = state.players.filter(t => {
      const arr = state.round1.answersByTarget[t];
      return Array.isArray(arr) && arr.length === QUESTIONS.length && arr.every(v => v != null);
    }).length;
  }

  const pct = total ? (completedTargets / total) * 100 : 0;
  progressBar.style.width = `${pct}%`;
  meterLabel.textContent = `${completedTargets}/${total}`;
}

function renderTurn() {
  const r1 = state.round1;
  const pair = getCurrentPair();

  judgeBadge.textContent = `Juez: ${pair.judge}`;
  turnCounter.textContent = `${r1.currentTurnIndex + 1}/${r1.order.length}`;
  phasePill.textContent = "Fase: Confirmación";
  turnText.textContent = `Jugador ${pair.judge}, toca OK para revelar a quién juzgas.`;
}

function renderQuestions() {
  const r1 = state.round1;
  const pair = getCurrentPair();

  judgeBadge2.textContent = `Juez: ${pair.judge}`;
  targetLabel.textContent = `Objetivo: ${pair.target}`;
  qCounter.textContent = `${r1.currentQuestionIndex + 1}/${QUESTIONS.length}`;

  const q = QUESTIONS[r1.currentQuestionIndex];
  qTitle.textContent = `Pregunta ${r1.currentQuestionIndex + 1}`;
  qText.textContent = q.text;

  const answers = ensureAnswersArrayForTarget(pair.target);

  answersEl.innerHTML = "";
  q.options.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.textContent = opt.label;
    if (answers[r1.currentQuestionIndex] === idx) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      answers[r1.currentQuestionIndex] = idx;
      state.round1.answersByTarget[pair.target] = answers;
      persist();
      renderQuestions();
      renderProgress();
      setStatus(`Contestadas: ${answeredCount(answers)}/${QUESTIONS.length}`);
    });

    answersEl.appendChild(btn);
  });

  prevBtn.disabled = r1.currentQuestionIndex === 0;

  const currentAnswer = answers[r1.currentQuestionIndex];
  nextBtn.disabled = currentAnswer == null;
  nextBtn.textContent = (r1.currentQuestionIndex === QUESTIONS.length - 1) ? "Guardar turno ✅" : "Siguiente ➡";
}

function renderDoneTurn() {
  doneText.textContent = `Turno guardado. Pasa el celular al siguiente jugador.`;
  doneTags.innerHTML = "";
  doneTags.appendChild(makeTag("Respuestas: 6/6"));
  // IMPORTANTE: aquí ya NO mostramos objetivo (para que no se filtre).
  nextTurnBtn.disabled = (state.round1.currentTurnIndex + 1 >= state.round1.order.length);
  finishRound1Btn.disabled = !isRound1Complete();
}

// =====================
// Round 2 simplified
// =====================
function startRound2(forceReset = false) {
  if (!isRound1Complete()) return;

  if (!state.round2 || forceReset) {
    state.round2 = {
      caseOrder: shuffle(state.players.slice()),
      caseIndex: 0,
      answered: {}, // targetName -> true (si ya se intentó)
    };
  }

  state.phase = "round2";
  persist();
  route();
}

function nextRound2Case() {
  const r2 = state.round2;
  r2.caseIndex++;

  if (r2.caseIndex >= r2.caseOrder.length) {
    // terminó ronda 2
    r2.caseIndex = r2.caseOrder.length - 1;
    voteResult.textContent = "Se acabaron los casos. Reinicia si quieres repetir.";
    nextCaseBtn.disabled = true;
    persist();
    return;
  }

  voteResult.textContent = "Toca un nombre para ver si acertaste.";
  nextCaseBtn.disabled = false;
  persist();
  renderRound2();
}

function getActiveTarget() {
  const r2 = state.round2;
  return r2.caseOrder[r2.caseIndex];
}

function renderRound2() {
  const r2 = state.round2;
  const total = r2.caseOrder.length;
  const idx = r2.caseIndex;

  caseCounterBadge.textContent = `Caso ${idx + 1}/${total}`;
  caseTitle.textContent = "Caso";
  caseSubtitle.textContent = "Preguntas y respuestas (adivina quién era)";

  const target = getActiveTarget();
  const answers = state.round1.answersByTarget[target] || [];

  caseAnswers.innerHTML = "";
  for (let qi = 0; qi < QUESTIONS.length; qi++) {
    const q = QUESTIONS[qi];
    const picked = answers[qi];
    const answerText = (picked == null) ? "(Sin respuesta)" : q.options[picked].label;

    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="t">${escapeHtml(q.text)}</div>
      <div class="a"><b>${escapeHtml(answerText)}</b></div>
      <div class="small">Pregunta ${qi + 1}</div>
    `;
    caseAnswers.appendChild(li);
  }

  // botones de voto (sin conteo)
  voteChips.innerHTML = "";
  state.players.forEach(playerName => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btnBlue";
    b.textContent = playerName;

    b.addEventListener("click", () => {
      // solo feedback inmediato, sin conteo
      const correct = (playerName === target);

      // marcar que ya se respondió este caso (opcional)
      r2.answered[target] = true;

      voteResult.textContent = correct
        ? `✅ Correcto: era ${target}`
        : `❌ Incorrecto. Tú dijiste ${playerName}`;

      // si quieres que solo se pueda votar una vez por caso:
      disableVoteButtons(true);

      // habilitar "siguiente caso"
      nextCaseBtn.disabled = (r2.caseIndex >= r2.caseOrder.length - 1);

      persist();
    });

    voteChips.appendChild(b);
  });

  // Si ya votaron ese caso antes, bloquea
  if (r2.answered[target]) {
    voteResult.textContent = "Este caso ya fue respondido. Dale a Siguiente caso.";
    disableVoteButtons(true);
  } else {
    disableVoteButtons(false);
    voteResult.textContent = "Toca un nombre para ver si acertaste.";
  }

  nextCaseBtn.disabled = (idx >= total - 1);
}

function disableVoteButtons(disabled) {
  const btns = voteChips.querySelectorAll("button");
  btns.forEach(b => b.disabled = disabled);
}

// =====================
// Core logic
// =====================
function getCurrentPair() {
  const r1 = state.round1;
  const judgeIndex = r1.order[r1.currentTurnIndex];
  return r1.pairs[judgeIndex];
}

function ensureAnswersArrayForTarget(targetName) {
  const r1 = state.round1;
  if (!r1.answersByTarget[targetName]) {
    r1.answersByTarget[targetName] = new Array(QUESTIONS.length).fill(null);
  }
  return r1.answersByTarget[targetName];
}

function isRound1Complete() {
  if (!state.round1) return false;
  return state.players.every(targetName => {
    const arr = state.round1.answersByTarget[targetName];
    return Array.isArray(arr) && arr.length === QUESTIONS.length && arr.every(v => v != null);
  });
}

function canGoRound2() {
  return !!state.round1 && isRound1Complete();
}

// Emparejamiento aleatorio SIN repetir targets (permutación).
// Intento derangement para evitar auto-juzgarse.
function buildRandomPairs(players) {
  const n = players.length;
  const idx = range(n);
  let perm = null;

  for (let tries = 0; tries < 2000; tries++) {
    const candidate = shuffle(idx.slice());
    const ok = (n <= 1) ? true : candidate.every((t, i) => t !== i);
    if (ok) { perm = candidate; break; }
  }
  if (!perm) perm = shuffle(idx.slice());

  const pairs = new Array(n);
  for (let judgeIdx = 0; judgeIdx < n; judgeIdx++) {
    pairs[judgeIdx] = {
      judge: players[judgeIdx],
      target: players[perm[judgeIdx]],
    };
  }
  return pairs;
}

// =====================
// Storage
// =====================
function readState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return deepClone(defaultState);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return deepClone(defaultState);
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      phase: typeof parsed.phase === "string" ? parsed.phase : "setup",
      round1: parsed.round1 && typeof parsed.round1 === "object" ? parsed.round1 : null,
      round2: parsed.round2 && typeof parsed.round2 === "object" ? parsed.round2 : null,
    };
  } catch {
    return deepClone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// =====================
// UI helpers + utils
// =====================
function hideAllScreens() {
  screenSetup.classList.add("hidden");
  screenTurn.classList.add("hidden");
  screenQuestions.classList.add("hidden");
  screenRound1Done.classList.add("hidden");
  screenRound2.classList.add("hidden");
}

function makeChip(text) {
  const el = document.createElement("span");
  el.className = "chip";
  el.textContent = text;
  return el;
}

function cleanName(s) {
  return String(s || "").trim().replace(/\s+/g, " ").slice(0, 20);
}

function answeredCount(arr) { return arr.filter(v => v != null).length; }

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function range(n) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(i);
  return a;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// =====================
// Boot
// =====================
route();
