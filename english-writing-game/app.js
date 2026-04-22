const STORAGE_KEY = "ewg_submissions_v1";
const CUSTOM_MISSION_KEY = "ewg_custom_missions_v1";

const state = {
  levels: [],
  activeLevelId: null,
  missionIndex: 0,
};

const el = {
  levelList: document.getElementById("levelList"),
  missionSection: document.getElementById("missionSection"),
  missionPrompt: document.getElementById("missionPrompt"),
  missionHint: document.getElementById("missionHint"),
  answerInput: document.getElementById("answerInput"),
  submitBtn: document.getElementById("submitBtn"),
  nextBtn: document.getElementById("nextBtn"),
  resultBox: document.getElementById("resultBox"),
  historyList: document.getElementById("historyList"),
  customPrompt: document.getElementById("customPrompt"),
  customAnswer: document.getElementById("customAnswer"),
  customHints: document.getElementById("customHints"),
  addCustomBtn: document.getElementById("addCustomBtn"),
};

function tokenize(input) {
  return input.trim().toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
}

function includesAny(text, words) {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

function scoreSubmission({ userInput, mission }) {
  const feedback = [];
  let grammar = 50;
  let naturalness = 50;
  let meaning = 50;

  const trimmed = (userInput || "").trim();
  const tokens = tokenize(trimmed);

  if (!trimmed) {
    return { grammar: 0, naturalness: 0, meaning: 0, total: 0, feedback: ["문장을 입력해 주세요."] };
  }

  if (tokens.length >= 3) meaning += 20;
  else feedback.push("최소 3단어 이상 써보세요.");

  if (/[.!?]$/.test(trimmed)) naturalness += 10;
  else feedback.push("문장 끝에 마침표(.), 물음표(?)를 붙이면 더 좋아요.");

  const hintKeywords = (mission.hints || []).flatMap(tokenize).filter((v, i, arr) => arr.indexOf(v) === i);
  if (hintKeywords.length > 0 && includesAny(trimmed, hintKeywords)) grammar += 20;

  if (mission.prompt_ko.includes("어제") && !/(\bmet\b|\bwent\b|\bdid\b|\bwas\b|\bwere\b|ed\b)/i.test(trimmed)) {
    grammar -= 15;
    feedback.push("'어제'가 있으면 과거 시제를 확인해 보세요.");
  }

  grammar = Math.max(0, Math.min(100, grammar));
  naturalness = Math.max(0, Math.min(100, naturalness));
  meaning = Math.max(0, Math.min(100, meaning));

  return {
    grammar,
    naturalness,
    meaning,
    total: Math.round(grammar * 0.4 + naturalness * 0.3 + meaning * 0.3),
    feedback: feedback.length ? feedback : ["좋아요!"],
  };
}

async function loadLevels() {
  const res = await fetch("./level-template.json");
  const data = await res.json();
  const custom = JSON.parse(localStorage.getItem(CUSTOM_MISSION_KEY) || "[]");
  const lv2 = data.levels.find((x) => x.id === "lv2");
  if (lv2) lv2.missions = [...lv2.missions, ...custom];
  state.levels = data.levels;
  renderLevels();
}

function getSubmissions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveSubmission(row) {
  const prev = getSubmissions();
  prev.unshift(row);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prev.slice(0, 100)));
}

function renderLevels() {
  el.levelList.innerHTML = "";
  state.levels.forEach((level) => {
    const b = document.createElement("button");
    b.className = "level-btn";
    b.innerHTML = `<strong>${level.title}</strong><small>${level.goal}</small>`;
    b.addEventListener("click", () => selectLevel(level.id));
    el.levelList.appendChild(b);
  });
}

function selectLevel(levelId) {
  state.activeLevelId = levelId;
  state.missionIndex = 0;
  el.missionSection.classList.remove("hidden");
  renderMission();
}

function currentMission() {
  const lv = state.levels.find((x) => x.id === state.activeLevelId);
  if (!lv || lv.missions.length === 0) return null;
  return lv.missions[state.missionIndex % lv.missions.length];
}

function renderMission() {
  const mission = currentMission();
  if (!mission) return;
  el.missionPrompt.textContent = mission.prompt_ko;
  el.missionHint.textContent = `힌트: ${(mission.hints || []).join(", ") || "없음"}`;
  el.answerInput.value = "";
  el.resultBox.classList.add("hidden");
}

function renderHistory() {
  const items = getSubmissions();
  el.historyList.innerHTML = items.length ? "" : "<li>아직 제출한 문장이 없습니다.</li>";
  items.slice(0, 20).forEach((x) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${x.prompt_ko}</strong><div>${x.user_input}</div><small>점수: ${x.total} | ${new Date(x.created_at).toLocaleString()}</small>`;
    el.historyList.appendChild(li);
  });
}

function submitCurrent() {
  const mission = currentMission();
  if (!mission) return;
  const userInput = el.answerInput.value;
  const scored = scoreSubmission({ userInput, mission });

  const row = {
    mission_id: mission.id,
    prompt_ko: mission.prompt_ko,
    user_input: userInput,
    ...scored,
    created_at: new Date().toISOString(),
  };

  saveSubmission(row);
  renderHistory();

  el.resultBox.classList.remove("hidden");
  el.resultBox.innerHTML = `
    <strong>총점 ${scored.total}</strong>
    <div>문법 ${scored.grammar} / 자연스러움 ${scored.naturalness} / 의미전달 ${scored.meaning}</div>
    <ul>${scored.feedback.map((f) => `<li>${f}</li>`).join("")}</ul>
  `;
}

function addCustomMission() {
  const prompt = el.customPrompt.value.trim();
  if (!prompt) {
    alert("문제를 입력해 주세요.");
    return;
  }
  const hints = el.customHints.value.split(",").map((x) => x.trim()).filter(Boolean);
  const custom = JSON.parse(localStorage.getItem(CUSTOM_MISSION_KEY) || "[]");
  custom.push({
    id: `custom-${Date.now()}`,
    prompt_ko: prompt,
    target_points: ["custom"],
    example_answers: el.customAnswer.value ? [el.customAnswer.value.trim()] : [],
    hints,
    difficulty: 2,
  });
  localStorage.setItem(CUSTOM_MISSION_KEY, JSON.stringify(custom));
  el.customPrompt.value = "";
  el.customAnswer.value = "";
  el.customHints.value = "";
  loadLevels().then(() => alert("문제가 추가되었습니다. Lv2에서 확인하세요."));
}

el.submitBtn.addEventListener("click", submitCurrent);
el.nextBtn.addEventListener("click", () => {
  state.missionIndex += 1;
  renderMission();
});
el.addCustomBtn.addEventListener("click", addCustomMission);

loadLevels().then(renderHistory);
