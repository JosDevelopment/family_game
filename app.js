(function bootWhenReady() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

function boot() {
  const $ = (id) => document.getElementById(id);

  const statusPill = $("statusPill");
  const setStatus = (t) => { if (statusPill) statusPill.textContent = t; };

  setStatus("JS OK ✅");

  if (typeof STORAGE_KEY === "undefined" || typeof AUDIO_SETTINGS_KEY === "undefined" || !Array.isArray(QUESTIONS)) {
    setStatus("Falta constants.js o no cargó.");
    console.error("constants.js no cargó / no define STORAGE_KEY, AUDIO_SETTINGS_KEY, QUESTIONS");
    return;
  }

  const on = (el, evt, fn, opts) => { if (el) el.addEventListener(evt, fn, opts); };
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");
  const escapeHtml = (str) => String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  // =====================
  // Audio
  // =====================
  const bgm = $("bgm");
  const muteBtn = $("muteBtn");
  const muteIcon = $("muteIcon");
  const audioGate = $("audioGate");
  const audioGateBtn = $("audioGateBtn");

  let muted = false;
  let audioCtx = null;

  function applyMute(){
    if (!bgm) return;
    bgm.muted = muted;
    if (muteIcon) muteIcon.textContent = muted ? "🔇" : "🔊";
  }
  function loadAudioSettings(){
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.muted === "boolean") muted = parsed.muted;
    } catch {}
  }
  function saveAudioSettings(){
    try { localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ muted })); } catch {}
  }
  async function ensureAudioUnlocked() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      try { await audioCtx.resume(); } catch {}
    }
  }
  async function tryPlay() {
    if (!bgm) return;
    try {
      await bgm.play();
      if (audioGate) hide(audioGate);
    } catch {
      if (audioGate) show(audioGate);
    }
  }

  if (bgm) bgm.loop = true;
  loadAudioSettings();
  applyMute();
  tryPlay();

  on(audioGateBtn, "click", async () => { await ensureAudioUnlocked(); await tryPlay(); });
  on(muteBtn, "click", async () => {
    await ensureAudioUnlocked();
    muted = !muted;
    applyMute();
    saveAudioSettings();
  });
  on(window, "pointerdown", async () => {
    await ensureAudioUnlocked();
    if (bgm && bgm.paused) await tryPlay();
  }, { once: true, capture: true });

  // =====================
  // Estado
  // =====================
  const defaultState = {
    players: [],
    phase: "setup", // setup | turn | questions | doneTurn | round2
    round1: null,
    round2: null,
  };

  let state = readState();

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      const parsed = JSON.parse(raw);
      return {
        players: Array.isArray(parsed.players) ? parsed.players : [],
        phase: typeof parsed.phase === "string" ? parsed.phase : "setup",
        round1: parsed.round1 && typeof parsed.round1 === "object" ? parsed.round1 : null,
        round2: parsed.round2 && typeof parsed.round2 === "object" ? parsed.round2 : null,
      };
    } catch {
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  // =====================
  // Modales: Help / Players / Result
  // =====================
  const helpBtn = $("helpBtn");
  const helpModal = $("helpModal");
  const helpCloseBtn = $("helpCloseBtn");

  function openHelp(){ show(helpModal); }
  function closeHelp(){ hide(helpModal); }

  on(helpBtn, "click", openHelp);
  on(helpCloseBtn, "click", closeHelp);
  on(helpModal, "click", (e) => { if (e.target === helpModal) closeHelp(); });

  const openPlayersBtn = $("openPlayersBtn");
  const playersModal = $("playersModal");
  const playersCloseBtn = $("playersCloseBtn");
  const playersDoneBtn = $("playersDoneBtn");
  const playersList = $("playersList");

  const nameInput = $("nameInput");
  const addPlayerBtn = $("addPlayerBtn");

  function openPlayers(){
    show(playersModal);
    renderPlayersModalList();
    if (nameInput) nameInput.focus();
  }
  function closePlayers(){
    hide(playersModal);
  }

  on(openPlayersBtn, "click", openPlayers);
  on(playersCloseBtn, "click", closePlayers);
  on(playersDoneBtn, "click", closePlayers);
  on(playersModal, "click", (e) => { if (e.target === playersModal) closePlayers(); });

  // =====================
  // Modal resultado (Ronda 2)
  // =====================
  const resultModal = $("resultModal");
  const modalTitle = $("modalTitle");
  const modalSub = $("modalSub");
  const modalImg = $("modalImg");
  const modalMsg = $("modalMsg");
  const modalNextBtn = $("modalNextBtn");

  let modalTimer = null;
  let modalLock = false;

  const REVEAL_IMG = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="0 0 800 380">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#ff5d8f"/>
          <stop offset="0.5" stop-color="#ffe66d"/>
          <stop offset="1" stop-color="#4ea8de"/>
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="768" height="348" rx="26" fill="white" stroke="black" stroke-width="10"/>
      <rect x="40" y="40" width="720" height="300" rx="22" fill="url(#g)" opacity="0.28"/>
      <g transform="translate(110,80)">
        <rect x="0" y="70" width="260" height="180" rx="18" fill="white" stroke="black" stroke-width="10"/>
        <rect x="0" y="70" width="260" height="70" rx="18" fill="#ffe66d" stroke="black" stroke-width="10"/>
        <circle cx="130" cy="165" r="42" fill="#ff5d8f" stroke="black" stroke-width="10"/>
        <text x="130" y="182" text-anchor="middle" font-size="54" font-family="Comic Sans MS, Trebuchet MS, Arial" font-weight="900">?</text>
      </g>
      <text x="520" y="150" font-size="44" font-family="Comic Sans MS, Trebuchet MS, Arial" font-weight="900" text-anchor="middle">
        Revelando…
      </text>
      <text x="520" y="210" font-size="22" font-family="Comic Sans MS, Trebuchet MS, Arial" font-weight="900" text-anchor="middle" opacity="0.9">
        espera 3 segundos
      </text>
    </svg>
  `);

  function openModalPending() {
    modalLock = true;
    if (modalTitle) modalTitle.textContent = "Revelando…";
    if (modalSub) modalSub.textContent = "Espera 3 segundos.";
    if (modalMsg) modalMsg.textContent = "…";
    if (modalImg) modalImg.src = REVEAL_IMG;

    if (modalNextBtn) {
      modalNextBtn.classList.add("hidden");
      modalNextBtn.disabled = true;
      modalNextBtn.textContent = "Siguiente caso ▶";
    }
    show(resultModal);
  }

  function revealModalResult({ correct, target, guess, isLast }) {
    if (modalTitle) modalTitle.textContent = correct ? "✅ Acertaste" : "❌ Fallaste";
    if (modalSub) modalSub.textContent = `Era: ${target}`;
    if (modalMsg) modalMsg.textContent = correct
      ? `Bien. Elegiste ${guess} y sí era.`
      : `Elegiste ${guess}. No era.`;

    if (modalNextBtn) {
      modalNextBtn.classList.remove("hidden");
      modalNextBtn.disabled = false;
      modalNextBtn.textContent = isLast ? "Cerrar" : "Siguiente caso ▶";
    }
    modalLock = false;
  }

  function closeResultModal() {
    hide(resultModal);
    if (modalTimer) clearTimeout(modalTimer);
    modalTimer = null;
    modalLock = false;
  }

  on(resultModal, "click", (e) => {
    if (e.target === resultModal && !modalLock) closeResultModal();
  });

  // =====================
  // UI refs
  // =====================
  const playersChips = $("playersChips");
  const progressBar = $("progressBar");
  const meterLabel = $("meterLabel");

  const screenSetup = $("screenSetup");
  const screenTurn = $("screenTurn");
  const screenQuestions = $("screenQuestions");
  const screenRound1Done = $("screenRound1Done");
  const screenRound2 = $("screenRound2");

  const startRound1Btn = $("startRound1Btn");
  const toRound2Btn = $("toRound2Btn");
  const wipeBtn = $("wipeBtn");
  const resetAllBtn = $("resetAllBtn");

  const judgeBadge = $("judgeBadge");
  const turnCounter = $("turnCounter");
  const phasePill = $("phasePill");
  const turnText = $("turnText");
  const turnOkBtn = $("turnOkBtn");

  const judgeBadge2 = $("judgeBadge2");
  const targetLabel = $("targetLabel");
  const qCounter = $("qCounter");
  const qTitle = $("qTitle");
  const qText = $("qText");
  const answersEl = $("answers");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  const doneText = $("doneText");
  const doneTags = $("doneTags");
  const nextTurnBtn = $("nextTurnBtn");
  const finishRound1Btn = $("finishRound1Btn");

  const caseCounterBadge = $("caseCounterBadge");
  const nextCaseBtn = $("nextCaseBtn");
  const restartRound2Btn = $("restartRound2Btn");
  const caseAnswers = $("caseAnswers");
  const voteChips = $("voteChips");
  const voteResult = $("voteResult");

  // =====================
  // Reset / wipe
  // =====================
  on(wipeBtn, "click", () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AUDIO_SETTINGS_KEY);
    state = JSON.parse(JSON.stringify(defaultState));
    persist();
    renderAll();
    setStatus("Borrado ✅");
    openPlayers(); // vuelve directo a lo importante
  });

  on(resetAllBtn, "click", async () => {
    setStatus("Reiniciando…");
    try {
      localStorage.clear();
      sessionStorage.clear();

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch (e) {
      console.error("resetAll error:", e);
    } finally {
      location.reload();
    }
  });

  // =====================
  // Jugadores (modal)
  // =====================
  function renderPlayersModalList() {
    if (!playersList) return;
    playersList.innerHTML = "";

    if (state.players.length === 0) {
      const empty = document.createElement("div");
      empty.className = "item";
      empty.innerHTML = `<div class="t">Sin jugadores</div><div class="small">Agrega mínimo 2.</div>`;
      playersList.appendChild(empty);
      return;
    }

    state.players.forEach((name) => {
      const row = document.createElement("div");
      row.className = "playerItem";
      row.innerHTML = `
        <div class="playerName">${escapeHtml(name)}</div>
        <button class="playerDel" type="button" aria-label="Eliminar ${escapeHtml(name)}">✕</button>
      `;

      const del = row.querySelector("button.playerDel");
      del.addEventListener("click", () => {
        if (state.round1) return; // no tocar lista a mitad de ronda 1
        state.players = state.players.filter(p => p !== name);
        persist();
        renderAll();
        renderPlayersModalList();
      });

      playersList.appendChild(row);
    });
  }

  function addPlayerFromModal() {
    const name = cleanName(nameInput ? nameInput.value : "");
    if (!name) return;
    if (state.round1) return;
    if (state.players.some(p => p.toLowerCase() === name.toLowerCase())) return;

    state.players.push(name);
    if (nameInput) nameInput.value = "";
    persist();
    renderAll();
    renderPlayersModalList();
    if (nameInput) nameInput.focus();
  }

  on(addPlayerBtn, "click", addPlayerFromModal);
  on(nameInput, "keydown", (e) => {
    if (e.key === "Enter") addPlayerFromModal();
  });

  // =====================
  // Flujo juego
  // =====================
  on(startRound1Btn, "click", () => {
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
    renderAll();
    closePlayers();
  });

  on(toRound2Btn, "click", () => {
    if (!isRound1Complete()) return;
    startRound2(false);
  });

  // Ronda 1
  on(turnOkBtn, "click", () => {
    if (state.phase !== "turn") return;
    state.round1.showTarget = true;
    state.phase = "questions";
    state.round1.currentQuestionIndex = 0;
    persist();
    renderAll();
  });

  on(prevBtn, "click", () => {
    if (state.phase !== "questions") return;
    const r1 = state.round1;
    if (r1.currentQuestionIndex > 0) {
      r1.currentQuestionIndex--;
      persist();
      renderAll();
    }
  });

  on(nextBtn, "click", () => {
    if (state.phase !== "questions") return;
    const r1 = state.round1;
    const pair = getCurrentPair();
    const answers = ensureAnswersArrayForTarget(pair.target);

    const qi = r1.currentQuestionIndex;
    if (answers[qi] == null) return;

    if (qi < QUESTIONS.length - 1) {
      r1.currentQuestionIndex++;
      persist();
      renderAll();
    } else {
      r1.showTarget = false;
      state.phase = "doneTurn";
      persist();
      renderAll();
    }
  });

  on(nextTurnBtn, "click", () => {
    if (state.phase !== "doneTurn") return;
    const r1 = state.round1;
    r1.currentTurnIndex++;

    if (r1.currentTurnIndex >= r1.order.length) {
      state.phase = "setup";
      persist();
      renderAll();
      setStatus("Ronda 1 completa");
      return;
    }
    state.phase = "turn";
    persist();
    renderAll();
  });

  on(finishRound1Btn, "click", () => {
    if (!isRound1Complete()) return;
    startRound2(false);
  });

  // Ronda 2
  on(nextCaseBtn, "click", () => {
    if (state.phase !== "round2") return;
    nextRound2Case();
  });

  on(restartRound2Btn, "click", () => {
    if (state.phase !== "round2") return;
    startRound2(true);
  });

  on(modalNextBtn, "click", () => {
    if (modalLock) return;

    closeResultModal();

    if (state.phase === "round2") {
      const r2 = state.round2;
      if (r2.caseIndex < r2.caseOrder.length - 1) {
        r2.caseIndex++;
        persist();
        renderAll();
      } else {
        if (voteResult) voteResult.textContent = "Se acabaron los casos. Reinicia Ronda 2 si quieres repetir.";
        persist();
        renderAll();
      }
    }
  });

  function startRound2(force) {
    if (!isRound1Complete()) return;

    if (!state.round2 || force) {
      state.round2 = {
        caseOrder: shuffle(state.players.slice()),
        caseIndex: 0,
        answered: {},
      };
    }
    state.phase = "round2";
    persist();
    renderAll();
  }

  function nextRound2Case() {
    const r2 = state.round2;
    r2.caseIndex++;
    if (r2.caseIndex >= r2.caseOrder.length) r2.caseIndex = r2.caseOrder.length - 1;
    persist();
    renderAll();
  }

  // =====================
  // Render
  // =====================
  function renderAll() {
    renderPlayersChips();
    renderProgress();
    updateButtons();
    route();
  }

  function route() {
    [screenSetup, screenTurn, screenQuestions, screenRound1Done, screenRound2].forEach(hide);

    if (state.phase === "setup") { show(screenSetup); return; }
    if (state.phase === "turn") { show(screenTurn); renderTurn(); return; }
    if (state.phase === "questions") { show(screenQuestions); renderQuestions(); return; }
    if (state.phase === "doneTurn") { show(screenRound1Done); renderDoneTurn(); return; }
    if (state.phase === "round2") { show(screenRound2); renderRound2(); return; }
  }

  function renderPlayersChips() {
    if (!playersChips) return;
    playersChips.innerHTML = "";
    if (!state.players.length) {
      playersChips.appendChild(chip("Nadie todavía"));
      return;
    }
    state.players.forEach(p => playersChips.appendChild(chip(p)));
  }

  function renderProgress() {
    if (!progressBar || !meterLabel) return;
    const total = state.players.length || 0;

    let completed = 0;
    if (state.round1 && state.round1.answersByTarget) {
      completed = state.players.filter(t => {
        const arr = state.round1.answersByTarget[t];
        return Array.isArray(arr) && arr.length === QUESTIONS.length && arr.every(v => v != null);
      }).length;
    }
    progressBar.style.width = total ? `${(completed / total) * 100}%` : "0%";
    meterLabel.textContent = `${completed}/${total}`;
  }

  function updateButtons() {
    if (startRound1Btn) startRound1Btn.disabled = state.players.length < 2 || !!state.round1;
    if (toRound2Btn) toRound2Btn.disabled = !isRound1Complete();
    if (finishRound1Btn) finishRound1Btn.disabled = !isRound1Complete();

    // si estás en ronda1, bloquea editar jugadores (para no romper el flujo)
    if (openPlayersBtn) openPlayersBtn.disabled = !!state.round1;
  }

  function renderTurn() {
    if (!state.round1) return;
    const r1 = state.round1;
    const pair = getCurrentPair();
    if (judgeBadge) judgeBadge.textContent = `Juez: ${pair.judge}`;
    if (turnCounter) turnCounter.textContent = `${r1.currentTurnIndex + 1}/${r1.order.length}`;
    if (phasePill) phasePill.textContent = "Fase: Confirmación";
    if (turnText) turnText.textContent = `Jugador ${pair.judge}, toca OK para revelar a quién juzgas.`;
  }

  function renderQuestions() {
    if (!state.round1) return;
    const r1 = state.round1;
    const pair = getCurrentPair();
    const answers = ensureAnswersArrayForTarget(pair.target);

    if (judgeBadge2) judgeBadge2.textContent = `Juez: ${pair.judge}`;
    if (targetLabel) targetLabel.textContent = `Objetivo: ${pair.target}`;
    if (qCounter) qCounter.textContent = `${r1.currentQuestionIndex + 1}/${QUESTIONS.length}`;

    const q = QUESTIONS[r1.currentQuestionIndex];
    if (qTitle) qTitle.textContent = `Pregunta ${r1.currentQuestionIndex + 1}`;
    if (qText) qText.textContent = q.text;

    if (!answersEl) return;
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
        renderAll();
      });

      answersEl.appendChild(btn);
    });

    if (prevBtn) prevBtn.disabled = r1.currentQuestionIndex === 0;
    if (nextBtn) {
      nextBtn.disabled = answers[r1.currentQuestionIndex] == null;
      nextBtn.textContent = (r1.currentQuestionIndex === QUESTIONS.length - 1) ? "Guardar turno ✅" : "Siguiente ➡";
    }
  }

  function renderDoneTurn() {
    if (doneText) doneText.textContent = "Turno guardado. Pasa el celular al siguiente jugador.";
    if (doneTags) {
      doneTags.innerHTML = "";
      const t = document.createElement("span");
      t.className = "chip";
      t.textContent = "Respuestas: 6/6";
      doneTags.appendChild(t);
    }
  }

  function renderRound2() {
    if (!state.round2 || !state.round1) return;

    const r2 = state.round2;
    const total = r2.caseOrder.length;
    const idx = r2.caseIndex;

    const target = r2.caseOrder[idx];
    const answers = state.round1.answersByTarget[target] || [];

    if (caseCounterBadge) caseCounterBadge.textContent = `Caso ${idx + 1}/${total}`;

    if (caseAnswers) {
      caseAnswers.innerHTML = "";
      for (let qi = 0; qi < QUESTIONS.length; qi++) {
        const q = QUESTIONS[qi];
        const picked = answers[qi];
        const a = (picked == null) ? "(Sin respuesta)" : q.options[picked].label;

        const li = document.createElement("li");
        li.className = "item";
        li.innerHTML = `
          <div class="t">${escapeHtml(q.text)}</div>
          <div class="a"><b>${escapeHtml(a)}</b></div>
          <div class="small">Pregunta ${qi + 1}</div>
        `;
        caseAnswers.appendChild(li);
      }
    }

    if (!voteChips) return;
    voteChips.innerHTML = "";

    const already = !!r2.answered[target];
    if (voteResult) {
      voteResult.textContent = already
        ? "Este caso ya fue respondido. Dale a Siguiente caso."
        : "Toca un nombre para votar.";
    }

    state.players.forEach(name => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btnBlue";
      b.textContent = name;
      b.disabled = already;

      b.addEventListener("click", () => {
        if (already) return;
        if (modalLock) return;

        r2.answered[target] = true;
        persist();
        renderAll();

        openModalPending();

        if (modalTimer) clearTimeout(modalTimer);
        modalTimer = setTimeout(() => {
          const correct = (name === target);
          const isLast = (r2.caseIndex >= r2.caseOrder.length - 1);
          revealModalResult({ correct, target, guess: name, isLast });
        }, 3000);
      });

      voteChips.appendChild(b);
    });

    if (nextCaseBtn) nextCaseBtn.disabled = (idx >= total - 1);
  }

  // =====================
  // Lógica
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

    return players.map((_, judgeIdx) => ({ judge: players[judgeIdx], target: players[perm[judgeIdx]] }));
  }

  function cleanName(s) { return String(s || "").trim().replace(/\s+/g, " ").slice(0, 20); }
  function chip(text) {
    const el = document.createElement("span");
    el.className = "chip";
    el.textContent = text;
    return el;
  }
  function range(n) { return Array.from({ length: n }, (_, i) => i); }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Render inicial
  renderAll();

  // ✅ Para celular: si no hay jugadores, abre el modal de jugadores de inmediato.
  if (state.players.length === 0 && state.phase === "setup") {
    openPlayers();
  }
}
