import type { Project, TaskDetail, Waiting, WorkStage } from "./api";
import type { Tone } from "../ui";

/** 작업이 흘러가는 순서. 결정 필요는 사용자가 지금 할 일이라 따로 강조한다 */
export const FLOW: WorkStage[] = ["검토 중", "질문 대기", "결정 필요", "착수 가능", "진행 중", "완료"];
export const PARKED: WorkStage[] = ["보류", "취소"];

export const STAGE_TONE: Record<WorkStage, Tone> = {
  "검토 중": "grey",
  "질문 대기": "blue",
  "결정 필요": "orange",
  "착수 가능": "teal",
  "진행 중": "blue",
  "완료": "green",
  "보류": "yellow",
  "취소": "grey",
};

export const STAGE_HINT: Record<WorkStage, string> = {
  "검토 중": "아직 분류하지 않은 질문이 있어요",
  "질문 대기": "담당자 답을 기다리고 있어요",
  "결정 필요": "답이 왔어요. 반영할지 정해 주세요",
  "착수 가능": "바로 시작할 수 있어요",
  "진행 중": "만들고 있어요",
  "완료": "끝났어요",
  "보류": "잠시 멈췄어요",
  "취소": "하지 않기로 했어요",
};

/** 5장 검토 항목 상태(필터 순서). 보낼 질문은 내 차례라 주황, 질문함·기다림은 담당자 차례라 파랑 */
export const Q_STATES = ["답 옴", "보낼 질문", "질문함", "기다림", "추천(확인 전)", "정함", "열림", "범위 밖"];
export const Q_STATUS_TONE: Record<string, Tone> = {
  "답 옴": "orange", "보낼 질문": "orange", "질문함": "blue", "기다림": "blue",
  "추천(확인 전)": "yellow", "정함": "green", "열림": "grey", "범위 밖": "grey",
};

/** 화면은 Slack 으로 보내지 않는다. 보내기는 대화창에서 승인받고 한다 */
export const SEND_HOW = "대화창에서 '질문 보내줘'라고 하면 보낼 곳과 문구를 확인받고 보내요";

/** 멈췄거나 끝난 프로젝트는 보낼 질문을 내 차례로 보지 않는다(board.py QUIET_STAGES 와 같다) */
export const toSendOf = (p: { to_send?: string[]; stage: string }) => (["보류", "완료", "취소"].includes(p.stage) ? [] : p.to_send ?? []);

/** 기다림 중 다른 사람이 이미 물어 답을 기다리는 Q(나머지 기다림은 담당자가 하기로 한 것) */
export const othersAskedOf = (waiting: Waiting[] | undefined) => new Set((waiting ?? []).flatMap((w) => w.others_asked ?? []));

/** 작업 이유를 나눈다: '질문함: Q-1, Q-2 · 기다림: Q-3' → { 질문함: 'Q-1, Q-2', 기다림: 'Q-3' } */
export function whyParts(why: string) {
  const out: Record<string, string> = {};
  for (const part of why.split(" · ")) {
    const m = part.match(/^([^:]+):\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

/** 질문 대기 작업이 무엇을 기다리는지: 'Q-1 답 · Q-3 하기로 한 것'. 다른 사람이 이미 물은 기다림은 '답' 쪽에 넣는다 */
export function waitingWhat(why: string, othersAsked: Set<string> = new Set()) {
  const g = whyParts(why);
  const split = (v?: string) => (v ? v.split(", ").filter(Boolean) : []);
  const waited = split(g["기다림"]);
  const asked = [...split(g["질문함"]), ...waited.filter((q) => othersAsked.has(q))];
  const promised = waited.filter((q) => !othersAsked.has(q));
  return [asked.length && `${asked.join(", ")} 답`, promised.length && `${promised.join(", ")} 하기로 한 것`].filter(Boolean).join(" · ") || idsOf(why);
}

/** 칸 안의 첫 날짜(YYYY-MM-DD)부터 며칠 지났는지(없으면 null) */
export function daysSince(text: string, today = new Date()) {
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const from = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((start.getTime() - from.getTime()) / 86400000));
}

/** 사용자가 직접 옮길 수 있는 단계. 나머지는 질문 상태로 정해진다 */
export const MOVABLE: Record<string, string> = { "착수 가능": "자동", "진행 중": "진행 중", "완료": "완료", "보류": "보류" };

/** '디자인(김OO)+기획' → ['디자인', '기획'] */
export const roles = (text: string) => text.split("+").map((o) => o.replace(/\(.*?\)/g, "").trim()).filter(Boolean);

/** 담당자별 대기(질문함·기다림)를 역할로 묶는다: 디자인 3(그중 하기로 함 1) · 2일째. 다른 사람이 이미 물은 기다림은 질문으로 센다 */
export function waitingByRole(waiting: Waiting[]) {
  const m = new Map<string, { n: number; promised: number; days: number | null }>();
  for (const w of waiting) {
    const k = roles(w.owner)[0] ?? w.owner;
    const p = m.get(k) ?? { n: 0, promised: 0, days: null };
    p.n += w.ids.length;
    p.promised += (w.promised?.length ?? 0) - (w.others_asked?.length ?? 0);
    if (w.days != null) p.days = Math.max(p.days ?? 0, w.days);
    m.set(k, p);
  }
  return [...m].map(([owner, p]) => ({ owner, ...p }));
}

export const daysText = (d: number | null) => (d == null ? "" : d === 0 ? "오늘" : `${d}일째`);

type RoleWait = { owner: string; n: number; promised?: number; days: number | null };
const onlyPromised = (w: RoleWait) => (w.promised ?? 0) > 0 && w.promised === w.n;

/** 기획 질문 3개 · 2일째 답 없음 / 백엔드 하기로 함 · 2일째 / 기획 질문 2개 · 하기로 함 1개 · 2일째 답 없음 */
export const waitText = (w: RoleWait) => {
  const p = w.promised ?? 0;
  if (onlyPromised(w)) return `${w.owner} 하기로 함${p > 1 ? ` ${p}개` : ""}${w.days == null ? "" : ` · ${daysText(w.days)}`}`;
  const asked = w.days == null ? "" : w.days === 0 ? " · 오늘 물어봄" : ` · ${w.days}일째 답 없음`;
  return `${w.owner} 질문 ${w.n - p}개${p ? ` · 하기로 함 ${p}개` : ""}${asked}`;
};

/** 목록 오른쪽 배지: 기획 3일째 / 백엔드 하기로 함 · 오늘 */
export const waitBadgeText = (w: RoleWait) =>
  onlyPromised(w) ? `${w.owner} 하기로 함${w.days == null ? "" : ` · ${daysText(w.days)}`}` : `${w.owner} ${w.days == null ? "답 대기" : daysText(w.days)}`;

/** '기획·디자인 답과 백엔드 쪽 진행' — 뒤에 '을 기다리고 있어요'를 붙인다 */
function waitObject(list: RoleWait[]) {
  const asked = list.filter((w) => !onlyPromised(w)).map((w) => w.owner);
  const promised = list.filter(onlyPromised).map((w) => w.owner);
  return [asked.length ? `${asked.join("·")} 답` : "", promised.length ? `${promised.join("·")} 쪽 진행` : ""].filter(Boolean).join("과 ");
}

/** 가장 오래 기다린 담당 하나: 기획 3일째 */
export function longestWait(waiting: Waiting[]) {
  const all = waitingByRole(waiting).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  return all[0] ?? null;
}

/** 질문지 '내부용' 절의 '확인 희망일: M/D'(예전 형식은 'M/D까지')로 남은 날을 센다(없으면 null) */
export function deadlineOf(questionsMd: string | null, today = new Date()) {
  const m = questionsMd?.match(/확인 희망일:\s*(\d{1,2})\/(\d{1,2})/) ?? questionsMd?.match(/(\d{1,2})\/(\d{1,2})\s*(?:\([^)]*\))?\s*까지/);
  if (!m) return null;
  const due = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { label: `${m[1]}/${m[2]}`, left: Math.round((due.getTime() - start.getTime()) / 86400000) };
}

/** 관련 칸 표시용: 'Q-2, Q-3' */
export const idsOf = (why: string) => why.replace(/^[^:]*:\s*/, "");

type NextInfo = Pick<Project, "cards_open" | "replies_open" | "inbox_draft" | "inbox_pending" | "column" | "waiting" | "work_counts" | "progress" | "stage"> & { to_send?: string[] };

/** 프로젝트 한 줄 설명. 해요체, 지금 할 일 먼저 */
export function nextLine(p: NextInfo): { text: string; tone: Tone } {
  if (p.cards_open) return { text: `답할 질문이 ${p.cards_open}개 있어요`, tone: "orange" };
  if (p.replies_open?.length) return { text: `받은 답 ${p.replies_open.length}개를 보고 정해 주세요`, tone: "orange" };
  // 고른 카드 답에 따라 보낼 질문이 바뀔 수 있어 제출을 먼저 안내한다(board.py next_action 과 같은 순서)
  if (p.inbox_draft) return { text: "고른 답을 제출하면 반영돼요", tone: "orange" };
  const send = toSendOf(p).length;
  if (send) return { text: `보낼 질문 ${send}개가 있어요 — 확인하고 보내 주세요`, tone: "orange" };
  if (p.inbox_pending) return { text: "제출한 답을 반영하고 있어요", tone: "blue" };
  const w = waitingByRole(p.waiting ?? []);
  const doing = p.work_counts?.["진행 중"] ?? 0;
  if (p.progress?.total && p.progress.done === p.progress.total) return { text: "모든 작업을 끝냈어요", tone: "green" };
  if (doing && w.length) return { text: `작업 ${doing}개를 만드는 중이고, ${waitObject([w[0]])}을 기다리고 있어요`, tone: "blue" };
  if (doing) return { text: `작업 ${doing}개를 만들고 있어요`, tone: "blue" };
  if (w.length) return { text: `${waitObject(w)}을 기다리고 있어요`, tone: "blue" };
  if (p.column === "착수 가능") return { text: "바로 시작할 수 있어요", tone: "teal" };
  if (p.column === "검토 중") return { text: "검토하고 있어요", tone: "grey" };
  return { text: "", tone: "grey" };
}

export function detailNext(d: TaskDetail) {
  return nextLine({ ...d.check, waiting: d.check.waiting, work_counts: d.check.work_counts, progress: d.check.progress });
}

/** 문서 안의 R-n·Q-n·D-n 을 찾아보기 위한 표 */
export function indexIds(d: TaskDetail) {
  const map = new Map<string, Record<string, string>>();
  for (const s of d.sections) {
    for (const b of s.blocks) {
      if (b.type !== "table" || !b.header || !b.rows) continue;
      for (const r of b.rows) {
        const id = r[0];
        if (/^[RQDW]-\d+$/.test(id)) map.set(id, Object.fromEntries(b.header.map((h, i) => [h, r[i] ?? ""])));
      }
    }
  }
  return map;
}
