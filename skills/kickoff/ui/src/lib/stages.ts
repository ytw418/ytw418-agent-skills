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

/** 사용자가 직접 옮길 수 있는 단계. 나머지는 질문 상태로 정해진다 */
export const MOVABLE: Record<string, string> = { "착수 가능": "자동", "진행 중": "진행 중", "완료": "완료", "보류": "보류" };

/** '디자인(김OO)+기획' → ['디자인', '기획'] */
export const roles = (text: string) => text.split("+").map((o) => o.replace(/\(.*?\)/g, "").trim()).filter(Boolean);

/** 담당자별 답 대기를 역할로 묶는다: 디자인 3 · 2일째 */
export function waitingByRole(waiting: Waiting[]) {
  const m = new Map<string, { n: number; days: number | null }>();
  for (const w of waiting) {
    const k = roles(w.owner)[0] ?? w.owner;
    const p = m.get(k) ?? { n: 0, days: null };
    p.n += w.ids.length;
    if (w.days != null) p.days = Math.max(p.days ?? 0, w.days);
    m.set(k, p);
  }
  return [...m].map(([owner, p]) => ({ owner, ...p }));
}

export const daysText = (d: number | null) => (d == null ? "" : d === 0 ? "오늘" : `${d}일째`);

/** 기획 질문 3개 · 2일째 답 없음 */
export const waitText = (w: { owner: string; n: number; days: number | null }) =>
  `${w.owner} 질문 ${w.n}개${w.days == null ? "" : w.days === 0 ? " · 오늘 물어봄" : ` · ${w.days}일째 답 없음`}`;

/** 가장 오래 기다린 담당 하나: 기획 3일째 */
export function longestWait(waiting: Waiting[]) {
  const all = waitingByRole(waiting).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
  return all[0] ?? null;
}

/** 질문지 머리말의 'M/D까지'를 찾아 남은 날을 센다(없으면 null) */
export function deadlineOf(questionsMd: string | null, today = new Date()) {
  const m = questionsMd?.match(/(\d{1,2})\/(\d{1,2})\s*(?:\([^)]*\))?\s*까지/);
  if (!m) return null;
  const due = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return { label: `${m[1]}/${m[2]}`, left: Math.round((due.getTime() - start.getTime()) / 86400000) };
}

/** 관련 칸 표시용: 'Q-2, Q-3' */
export const idsOf = (why: string) => why.replace(/^[^:]*:\s*/, "");

type NextInfo = Pick<Project, "cards_open" | "replies_open" | "inbox_draft" | "inbox_pending" | "column" | "waiting" | "work_counts" | "progress">;

/** 프로젝트 한 줄 설명. 해요체, 지금 할 일 먼저 */
export function nextLine(p: NextInfo): { text: string; tone: Tone } {
  if (p.cards_open) return { text: `답할 질문이 ${p.cards_open}개 있어요`, tone: "orange" };
  if (p.replies_open?.length) return { text: `받은 답 ${p.replies_open.length}개를 보고 정해 주세요`, tone: "orange" };
  if (p.inbox_draft) return { text: "고른 답을 제출하면 반영돼요", tone: "orange" };
  if (p.inbox_pending) return { text: "제출한 답을 반영하고 있어요", tone: "blue" };
  const w = waitingByRole(p.waiting ?? []);
  const doing = p.work_counts?.["진행 중"] ?? 0;
  if (p.progress?.total && p.progress.done === p.progress.total) return { text: "모든 작업을 끝냈어요", tone: "green" };
  if (doing && w.length) return { text: `작업 ${doing}개를 만드는 중이고, ${w[0].owner} 답을 기다리고 있어요`, tone: "blue" };
  if (doing) return { text: `작업 ${doing}개를 만들고 있어요`, tone: "blue" };
  if (w.length) return { text: `${w.map((x) => x.owner).join("·")} 답을 기다리고 있어요`, tone: "blue" };
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
