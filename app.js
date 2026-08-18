const STORAGE_KEY = "scorekeep.history.v1";

const colors = ["red", "blue", "green", "amber"];
const state = {
  view: "home",
  history: loadHistory(),
  race: null,
  straight: null,
  selectedHistoryId: null,
  modal: null
};

const app = document.querySelector("#app");

window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
  render();
});

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function upsertMatch(match) {
  const index = state.history.findIndex((item) => item.id === match.id);
  if (index >= 0) state.history[index] = match;
  else state.history.unshift(match);
  saveHistory();
}

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function cleanName(value, fallback) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

function render() {
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">8</span><span>Pool ScoreKeep</span></div>
        <div class="mini">Saved on this device</div>
      </header>
      <section class="view">${viewMarkup()}</section>
      <nav class="nav" aria-label="Main navigation">
        <button class="${state.view === "home" ? "active" : ""}" data-view="home">Score</button>
        <button class="${state.view.startsWith("history") ? "active" : ""}" data-view="history">History</button>
      </nav>
      ${state.modal ? modalMarkup() : ""}
    </main>
  `;
  bindEvents();
}

function viewMarkup() {
  if (state.view === "race") return raceSetupMarkup();
  if (state.view === "straight-setup") return straightSetupMarkup();
  if (state.view === "straight-order") return straightOrderMarkup();
  if (state.view === "race-match") return raceMatchMarkup();
  if (state.view === "straight-match") return straightMatchMarkup();
  if (state.view === "history") return historyMarkup();
  if (state.view === "history-detail") return historyDetailMarkup();
  return homeMarkup();
}

function homeMarkup() {
  return `
    <div class="panel">
      <h1 class="section-title">Start a match</h1>
      <div class="grid two">
        <button class="primary" data-view="race">8 / 9 / 10 Ball</button>
        <button class="primary" data-view="straight-setup">K-ball / Straight Pool</button>
      </div>
    </div>
    <div class="panel">
      <h2 class="section-title">Recent results</h2>
      ${state.history.length ? historyRows(state.history.slice(0, 3)) : `<p class="mini">No saved matches yet.</p>`}
    </div>
  `;
}

function raceSetupMarkup() {
  const raceOptions = Array.from({ length: 30 }, (_, index) => index + 1);
  return `
    <form class="panel grid" data-form="race-setup">
      <h1 class="section-title">8 / 9 / 10 Ball</h1>
      <div class="grid two">
        <label class="field"><span>Game type</span><select name="type"><option>8 Ball</option><option>9 Ball</option><option>10 Ball</option></select></label>
        <label class="field"><span>Race</span><select name="goal">${raceOptions.map((value) => `<option ${value === 5 ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      </div>
      <div class="grid two">
        <label class="field"><span>Red side</span><input name="p1" value="Player 1"></label>
        <label class="field"><span>Blue side</span><input name="p2" value="Player 2"></label>
      </div>
      <button class="primary" type="submit">Start Race</button>
    </form>
  `;
}

function straightSetupMarkup() {
  const count = state.straight?.setupCount ?? 2;
  return `
    <form class="panel grid" data-form="straight-setup">
      <h1 class="section-title">K-ball setup</h1>
      <div class="grid two">
        <label class="field"><span>Players</span><select name="count">${[2, 3, 4].map((n) => `<option ${n === count ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="field"><span>Race</span><select name="goal"><option>100</option><option>150</option><option>200</option></select></label>
      </div>
      <div class="grid two">
        ${Array.from({ length: count }, (_, i) => `<label class="field"><span>Player ${i + 1}</span><input name="p${i}" value="Player ${i + 1}"></label>`).join("")}
      </div>
      <button class="primary" type="submit">Randomize Order</button>
    </form>
  `;
}

function straightOrderMarkup() {
  return `
    <div class="panel grid">
      <h1 class="section-title">Random order</h1>
      <div class="order-list">
        ${state.straight.players.map((player, index) => `<div class="row card"><span class="pill">${index + 1}</span><strong>${escapeHtml(player.name)}</strong></div>`).join("")}
      </div>
      <button class="primary" data-action="start-straight">Start Game</button>
    </div>
  `;
}

function raceMatchMarkup() {
  const match = state.race;
  match.scoringLog ??= [];
  const leadingScore = Math.max(...Object.values(match.scores));
  return `
    <div class="panel grid">
      <h1 class="section-title">${match.type} - race to ${match.goal}</h1>
      <div class="score-grid">
        ${match.players.map((player) => `
          <button class="score-card card ${player.color} ${match.scores[player.id] === leadingScore && leadingScore > 0 ? "leading" : ""}" data-race-plus="${player.id}">
            <span class="winner-ring">${match.scores[player.id] >= match.goal ? "Won" : "Tap to score"}</span>
            <div class="player-name">${escapeHtml(player.name)}</div>
            <div class="score">${match.scores[player.id] ?? 0}</div>
          </button>
        `).join("")}
      </div>
      <div class="actions">
        <button class="danger" data-action="undo-race" ${match.scoringLog.length ? "" : "disabled"}>- Undo Last Game</button>
        <button data-action="save-race">Save Match</button>
        <button class="danger" data-view="race">New Setup</button>
      </div>
    </div>
  `;
}

function straightMatchMarkup() {
  const game = state.straight;
  const rackBalls = Object.values(game.currentRack.points).reduce((a, b) => a + b, 0);
  return `
    <div class="panel grid">
      <h1 class="section-title">K-ball - race to ${game.goal}</h1>
      <div class="totals">
        ${game.players.map((player) => `
          <div class="total card ${player.color}">
            <strong>${escapeHtml(player.name)}</strong>
            <div class="score-pair">
              <span>${straightTotal(player.id)}</span>
              <small>Total</small>
            </div>
            <div class="rack-status">
              <span><b>${game.currentRack.points[player.id] ?? 0}</b> rack balls</span>
              <span><b>${currentRackPenalty(player.id)}</b> rack penalty</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="panel grid">
      <h2 class="section-title">Rack ${game.currentRack.number} - ${rackBalls} of 15 balls</h2>
      <div class="rack-list">
        ${game.players.map((player) => `
          <div class="row card">
            <strong>${escapeHtml(player.name)}</strong>
            <div class="actions">
              <button class="primary" data-ball="${player.id}" ${rackBalls >= 15 ? "disabled" : ""}>+ Ball</button>
              <button data-minus-ball="${player.id}" ${(game.currentRack.points[player.id] ?? 0) > 0 ? "" : "disabled"}>- Ball</button>
              <button data-foul="${player.id}">Foul</button>
              <button class="danger" data-major="${player.id}">-15</button>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="actions">
        <button class="danger" data-action="undo-straight" ${game.activityLog?.length ? "" : "disabled"}>- Undo Last Action</button>
        <button class="primary" data-action="finish-rack" ${rackBalls === 15 ? "" : "disabled"}>Finish Rack</button>
      </div>
    </div>
  `;
}

function historyMarkup() {
  return `
    <div class="panel grid">
      <h1 class="section-title">History</h1>
      ${state.history.length ? historyRows(state.history) : `<p class="mini">No saved matches yet.</p>`}
      ${state.history.length ? `<button class="danger" data-action="clear-history">Clear History</button>` : ""}
    </div>
  `;
}

function historyRows(matches) {
  return `<div class="history-list">${matches.map((match) => `
    <button class="card row history-row" data-history-id="${match.id}">
      <div>
        <strong>${escapeHtml(match.title)}</strong>
        <div class="mini">${new Date(match.createdAt).toLocaleString()}</div>
        <div>${escapeHtml(match.summary)}</div>
      </div>
      ${match.winner ? `<span class="pill">${escapeHtml(match.winner)}</span>` : ""}
    </button>
  `).join("")}</div>`;
}

function historyDetailMarkup() {
  const match = state.history.find((item) => item.id === state.selectedHistoryId);
  if (!match) {
    return `
      <div class="panel grid">
        <h1 class="section-title">Match not found</h1>
        <button class="primary" data-view="history">Back to History</button>
      </div>
    `;
  }

  return `
    <div class="panel grid">
      <div class="detail-head">
        <div>
          <h1 class="section-title">${escapeHtml(match.title)}</h1>
          <div class="mini">${new Date(match.createdAt).toLocaleString()}</div>
        </div>
        ${match.winner ? `<span class="pill winner-pill">${escapeHtml(match.winner)} won</span>` : ""}
      </div>
      <div>${escapeHtml(match.summary)}</div>
      <button data-view="history">Back to History</button>
    </div>
    ${match.title === "K-ball / Straight Pool" ? straightHistoryDetail(match.payload) : raceHistoryDetail(match.payload)}
  `;
}

function raceHistoryDetail(match) {
  match.scoringLog ??= [];
  const playerMap = Object.fromEntries(match.players.map((player) => [player.id, player]));
  const counts = Object.fromEntries(match.players.map((player) => [player.id, 0]));
  return `
    <div class="panel grid">
      <h2 class="section-title">Player activity</h2>
      <div class="totals">
        ${match.players.map((player) => `
          <div class="total card ${player.color}">
            <strong>${escapeHtml(player.name)}</strong>
            <div class="score-pair"><span>${match.scores[player.id] ?? 0}</span><small>Games</small></div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="panel grid">
      <h2 class="section-title">Scoring order</h2>
      ${match.scoringLog.length ? `
        <div class="activity-list">
          ${match.scoringLog.map((playerId, index) => {
            counts[playerId] = (counts[playerId] ?? 0) + 1;
            const player = playerMap[playerId] ?? { name: "Unknown", color: "" };
            return `<div class="activity-row card ${player.color}">
              <span class="pill">${index + 1}</span>
              <strong>${escapeHtml(player.name)}</strong>
              <span>${counts[playerId]}</span>
            </div>`;
          }).join("")}
        </div>
      ` : `<p class="mini">No scoring activity was recorded for this match.</p>`}
    </div>
  `;
}

function straightHistoryDetail(game) {
  const allRacks = [...game.racks, game.currentRack].filter((rack) => {
    return Object.keys(rack.points).length || Object.keys(rack.fouls).length || Object.keys(rack.majorFouls).length;
  });
  return `
    <div class="panel grid">
      <h2 class="section-title">Player activity</h2>
      <div class="totals">
        ${game.players.map((player) => `
          <div class="total card ${player.color}">
            <strong>${escapeHtml(player.name)}</strong>
            <div class="score-pair"><span>${straightHistoryTotal(game, player.id)}</span><small>Total</small></div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="panel grid">
      <h2 class="section-title">Rack activity</h2>
      ${allRacks.length ? `
        <div class="activity-list">
          ${allRacks.map((rack) => `
            <div class="card rack-detail">
              <strong>Rack ${rack.number}</strong>
              ${game.players.map((player) => `
                <div class="activity-row ${player.color}">
                  <span>${escapeHtml(player.name)}</span>
                  <span>${rack.points[player.id] ?? 0} balls</span>
                  <span>${((rack.fouls[player.id] ?? 0) + ((rack.majorFouls[player.id] ?? 0) * 15))} penalty</span>
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
      ` : `<p class="mini">No rack activity was recorded for this match.</p>`}
    </div>
  `;
}

function modalMarkup() {
  return `
    <div class="modal-backdrop">
      <div class="modal card">
        <h2>${escapeHtml(state.modal.title)}</h2>
        <p>${escapeHtml(state.modal.message)}</p>
        <div class="actions">
          <button class="primary" data-action="${state.modal.primaryAction}">${state.modal.primary}</button>
          <button data-action="${state.modal.secondaryAction}">${state.modal.secondary}</button>
        </div>
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });

  document.querySelector('[data-form="race-setup"]')?.addEventListener("submit", startRace);
  document.querySelector('[data-form="straight-setup"]')?.addEventListener("submit", randomizeStraight);
  document.querySelector('[name="count"]')?.addEventListener("change", (event) => {
    state.straight = { setupCount: Number(event.target.value) };
    render();
  });

  document.querySelectorAll("[data-race-plus]").forEach((button) => button.addEventListener("click", () => addRace(button.dataset.racePlus, 1)));
  document.querySelectorAll("[data-ball]").forEach((button) => button.addEventListener("click", () => addBall(button.dataset.ball)));
  document.querySelectorAll("[data-minus-ball]").forEach((button) => button.addEventListener("click", () => subtractBall(button.dataset.minusBall)));
  document.querySelectorAll("[data-foul]").forEach((button) => button.addEventListener("click", () => addFoul(button.dataset.foul, 1)));
  document.querySelectorAll("[data-major]").forEach((button) => button.addEventListener("click", () => addFoul(button.dataset.major, 15)));
  document.querySelectorAll("[data-history-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedHistoryId = button.dataset.historyId;
      state.view = "history-detail";
      render();
    });
  });

  document.querySelector('[data-action="save-race"]')?.addEventListener("click", saveRace);
  document.querySelector('[data-action="undo-race"]')?.addEventListener("click", undoRace);
  document.querySelector('[data-action="start-straight"]')?.addEventListener("click", () => {
    state.view = "straight-match";
    state.straight.activityLog ??= [];
    saveStraight();
    render();
  });
  document.querySelector('[data-action="finish-rack"]')?.addEventListener("click", finishRack);
  document.querySelector('[data-action="undo-straight"]')?.addEventListener("click", undoStraight);
  document.querySelector('[data-action="clear-history"]')?.addEventListener("click", () => {
    state.history = [];
    saveHistory();
    render();
  });
  document.querySelector('[data-action="new-race"]')?.addEventListener("click", () => {
    state.modal = null;
    state.view = "race";
    render();
  });
  document.querySelector('[data-action="new-straight"]')?.addEventListener("click", () => {
    state.modal = null;
    state.view = "straight-setup";
    render();
  });
  document.querySelector('[data-action="exit-home"]')?.addEventListener("click", () => {
    state.modal = null;
    state.view = "home";
    render();
  });
}

function startRace(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const players = [
    { id: id(), name: cleanName(data.get("p1"), "Red"), color: "red" },
    { id: id(), name: cleanName(data.get("p2"), "Blue"), color: "blue" }
  ];
  state.race = {
    id: id(),
    createdAt: new Date().toISOString(),
    type: data.get("type"),
    goal: Number(data.get("goal")),
    players,
    scores: Object.fromEntries(players.map((player) => [player.id, 0])),
    scoringLog: []
  };
  state.view = "race-match";
  saveRace();
  render();
}

function addRace(playerId, amount) {
  const match = state.race;
  match.scoringLog ??= [];
  match.scores[playerId] = Math.max(0, (match.scores[playerId] ?? 0) + amount);
  if (amount > 0) match.scoringLog.push(playerId);
  const player = match.players.find((item) => item.id === playerId);
  saveRace(player && match.scores[playerId] >= match.goal ? player : null);
  if (player && match.scores[playerId] >= match.goal) {
    state.modal = {
      title: "Race complete",
      message: `${player.name} won.`,
      primary: "Start New Race",
      primaryAction: "new-race",
      secondary: "Go Home",
      secondaryAction: "exit-home"
    };
  }
  render();
}

function undoRace() {
  const match = state.race;
  match.scoringLog ??= [];
  const playerId = match.scoringLog.pop();
  if (!playerId) return;
  match.scores[playerId] = Math.max(0, (match.scores[playerId] ?? 0) - 1);
  saveRace();
  render();
}

function saveRace(winner = null) {
  const match = state.race;
  upsertMatch({
    id: match.id,
    createdAt: match.createdAt,
    completedAt: winner ? new Date().toISOString() : null,
    winner: winner?.name ?? null,
    title: match.type,
    summary: match.players.map((player) => `${player.name} ${match.scores[player.id] ?? 0}`).join(" - "),
    payload: match
  });
}

function randomizeStraight(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  const count = Number(data.get("count"));
  const players = Array.from({ length: count }, (_, index) => ({
    id: id(),
    name: cleanName(data.get(`p${index}`), `Player ${index + 1}`),
    color: colors[index]
  })).sort(() => Math.random() - 0.5);
  state.straight = {
    id: id(),
    createdAt: new Date().toISOString(),
    goal: Number(data.get("goal")),
    players,
    racks: [],
    currentRack: { number: 1, points: {}, fouls: {}, majorFouls: {} },
    activityLog: []
  };
  state.view = "straight-order";
  render();
}

function rackBallCount() {
  return Object.values(state.straight.currentRack.points).reduce((a, b) => a + b, 0);
}

function addBall(playerId) {
  if (rackBallCount() >= 15) return;
  const rack = state.straight.currentRack;
  rack.points[playerId] = (rack.points[playerId] ?? 0) + 1;
  state.straight.activityLog ??= [];
  state.straight.activityLog.push({ type: "ball", playerId });
  saveStraight();
  checkStraightWinner();
  render();
}

function subtractBall(playerId) {
  const rack = state.straight.currentRack;
  if ((rack.points[playerId] ?? 0) <= 0) return;
  rack.points[playerId] -= 1;
  state.straight.activityLog ??= [];
  state.straight.activityLog.push({ type: "minusBall", playerId });
  saveStraight();
  render();
}

function addFoul(playerId, amount) {
  const rack = state.straight.currentRack;
  if (amount === 15) rack.majorFouls[playerId] = (rack.majorFouls[playerId] ?? 0) + 1;
  else rack.fouls[playerId] = (rack.fouls[playerId] ?? 0) + 1;
  state.straight.activityLog ??= [];
  state.straight.activityLog.push({ type: amount === 15 ? "majorFoul" : "foul", playerId });
  saveStraight();
  checkStraightWinner();
  render();
}

function finishRack() {
  if (rackBallCount() !== 15) return;
  const game = state.straight;
  game.racks.push(game.currentRack);
  game.activityLog ??= [];
  game.activityLog.push({ type: "finishRack" });
  game.currentRack = { number: game.racks.length + 1, points: {}, fouls: {}, majorFouls: {} };
  saveStraight();
  checkStraightWinner();
  render();
}

function undoStraight() {
  const game = state.straight;
  game.activityLog ??= [];
  const action = game.activityLog.pop();
  if (!action) return;

  if (action.type === "finishRack") {
    const previousRack = game.racks.pop();
    if (previousRack) game.currentRack = previousRack;
  }

  if (action.type === "ball") {
    const rack = game.currentRack;
    rack.points[action.playerId] = Math.max(0, (rack.points[action.playerId] ?? 0) - 1);
  }

  if (action.type === "minusBall") {
    const rack = game.currentRack;
    rack.points[action.playerId] = (rack.points[action.playerId] ?? 0) + 1;
  }

  if (action.type === "foul") {
    const rack = game.currentRack;
    rack.fouls[action.playerId] = Math.max(0, (rack.fouls[action.playerId] ?? 0) - 1);
  }

  if (action.type === "majorFoul") {
    const rack = game.currentRack;
    rack.majorFouls[action.playerId] = Math.max(0, (rack.majorFouls[action.playerId] ?? 0) - 1);
  }

  saveStraight();
  render();
}

function straightTotal(playerId) {
  const game = state.straight;
  return [...game.racks, game.currentRack].reduce((sum, rack) => {
    return sum + (rack.points[playerId] ?? 0) - (rack.fouls[playerId] ?? 0) - ((rack.majorFouls[playerId] ?? 0) * 15);
  }, 0);
}

function straightHistoryTotal(game, playerId) {
  return [...game.racks, game.currentRack].reduce((sum, rack) => {
    return sum + (rack.points[playerId] ?? 0) - (rack.fouls[playerId] ?? 0) - ((rack.majorFouls[playerId] ?? 0) * 15);
  }, 0);
}

function currentRackPenalty(playerId) {
  const rack = state.straight.currentRack;
  return (rack.fouls[playerId] ?? 0) + ((rack.majorFouls[playerId] ?? 0) * 15);
}

function checkStraightWinner() {
  const winner = state.straight.players.find((player) => straightTotal(player.id) >= state.straight.goal);
  if (!winner) return;
  saveStraight(winner);
  state.modal = {
    title: "Game complete",
    message: `${winner.name} reached ${state.straight.goal}.`,
    primary: "Start New Game",
    primaryAction: "new-straight",
    secondary: "Go Home",
    secondaryAction: "exit-home"
  };
}

function saveStraight(winner = null) {
  const game = state.straight;
  upsertMatch({
    id: game.id,
    createdAt: game.createdAt,
    completedAt: winner ? new Date().toISOString() : null,
    winner: winner?.name ?? null,
    title: "K-ball / Straight Pool",
    summary: game.players.map((player) => `${player.name} ${straightTotal(player.id)}`).join(" - "),
    payload: game
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
