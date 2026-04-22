/**
 * 영작 게임 MVP 채점 로직 (규칙 기반 1차 점검)
 * - 빈 입력, 최소 단어 수, 문장부호, 타겟 키포인트를 점수화
 * - AI 채점 연결 전까지 사용 가능한 baseline
 */

function tokenize(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
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
    return {
      grammar: 0,
      naturalness: 0,
      meaning: 0,
      total: 0,
      feedback: ["문장을 입력해 주세요."],
    };
  }

  if (tokens.length >= 3) {
    meaning += 20;
  } else {
    feedback.push("단어 수가 너무 짧아요. 최소 3단어 이상 써보세요.");
  }

  if (/[.!?]$/.test(trimmed)) {
    naturalness += 10;
  } else {
    feedback.push("문장 끝에 마침표(.), 물음표(?) 등을 붙여보세요.");
  }

  const hintKeywords = (mission?.hints || [])
    .flatMap((h) => tokenize(h))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  if (hintKeywords.length > 0 && includesAny(trimmed, hintKeywords)) {
    grammar += 20;
  } else if (hintKeywords.length > 0) {
    feedback.push("힌트를 참고해 핵심 문법 포인트를 반영해 보세요.");
  }

  if (mission?.prompt_ko?.includes("어제") && !/(\bmet\b|\bwent\b|\bdid\b|\bwas\b|\bwere\b|ed\b)/i.test(trimmed)) {
    grammar -= 15;
    feedback.push("'어제' 문장은 과거 시제를 써야 해요.");
  }

  grammar = Math.max(0, Math.min(100, grammar));
  naturalness = Math.max(0, Math.min(100, naturalness));
  meaning = Math.max(0, Math.min(100, meaning));

  const total = Math.round(grammar * 0.4 + naturalness * 0.3 + meaning * 0.3);

  return {
    grammar,
    naturalness,
    meaning,
    total,
    feedback: feedback.length ? feedback : ["좋아요! 다음 레벨에 도전해 보세요."],
  };
}

module.exports = {
  tokenize,
  scoreSubmission,
};
