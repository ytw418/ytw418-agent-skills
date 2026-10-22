// serve.py 가 주는 데이터 모양과 호출 함수
export type WorkStage = "검토 중" | "질문 대기" | "결정 필요" | "착수 가능" | "진행 중" | "완료" | "보류" | "취소";

export interface WorkItem {
  id: string;
  title: string;
  related: string[];
  owner: string;
  stage_set: string;
  stage: WorkStage;
  why: string;
  memo: string;
  wait_days: number | null;
}

export interface Waiting {
  owner: string;
  /** 질문함·기다림 모두 */
  ids: string[];
  /** 그중 기다림(담당자가 하기로 함·다른 사람이 이미 물음) */
  promised?: string[];
  /** promised 중 다른 사람이 이미 물어 답을 기다리는 것(나머지는 담당자가 하기로 함) */
  others_asked?: string[];
  since: string | null;
  days: number | null;
}

export interface Check {
  title: string;
  task_id: string;
  kind: string;
  stage: string;
  stage_text: string;
  errors: string[];
  warnings: string[];
  verdict: string;
  blocking: string[];
  /** 질문함(실제로 보낸 질문) */
  asked: string[];
  /** 보낼 질문(질문지에만 넣고 아직 안 보냄) */
  to_send: string[];
  /** 기다림(따로 묻지 않고 기다림) */
  promised: string[];
  replied: string[];
  waiting: Waiting[];
  defaults: string[];
  proposals: string[];
  early_start: string;
  work: WorkItem[];
  work_counts: Record<string, number>;
  progress: { done: number; total: number };
}

export interface Project extends Check {
  slug: string;
  dir: string;
  column: string;
  inbox_pending: boolean;
  inbox_draft: boolean;
  cards_open: number;
  replies_open: string[];
  updated: number;
}

export interface Board {
  root: string;
  columns: string[];
  tasks: Project[];
}

export interface Block {
  type: "table" | "text";
  header?: string[];
  rows?: string[][];
  lines?: string[];
}

export interface Section {
  no: number;
  title: string;
  blocks: Block[];
}

export interface CardOption {
  label: string;
  description?: string;
  preview?: string;
  recommended?: boolean;
}

export interface CardItem {
  id: string;
  text: string;
  rec?: string;
}

export interface Card {
  id: string;
  qids?: string[];
  header?: string;
  question: string;
  /** 묶음 카드가 무엇을 묶었는지. 카드 안에 바로 보여준다 */
  items?: CardItem[];
  options: CardOption[];
}

export interface Inbox {
  cards: Record<string, { choice: string; note: string; at: string }>;
  replies: Record<string, { decision: "반영" | "추가 질문" | "빼기"; note: string; at: string }>;
  submitted?: boolean;
  submitted_at?: string;
}

export interface TaskDetail {
  slug: string;
  dir: string;
  check: Check & Pick<Project, "cards_open" | "replies_open" | "inbox_pending" | "inbox_draft" | "column">;
  sections: Section[];
  cards: { round?: number; cards: Card[] } | null;
  inbox: Inbox | null;
  questions_md: string | null;
  shots?: Record<string, Shot[]>;
  updated: number;
}

export interface Shot {
  file: string;
  caption: string;
  mtime: number;
}

export const shotUrl = (slug: string, wid: string, file: string) =>
  `/api/task/${encodeURIComponent(slug)}/shots/${encodeURIComponent(wid)}/${encodeURIComponent(file)}?v=`;

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? { cache: "no-store" } : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? String(res.status));
  return data as T;
}

// 저장 요청은 한 번에 하나씩 보낸다(서버에서 답이 섞이지 않게)
let queue: Promise<unknown> = Promise.resolve();
function post<T>(path: string, body: unknown): Promise<T> {
  const p = queue.then(() => request<T>(path, body));
  queue = p.catch(() => undefined);
  return p;
}

const taskUrl = (slug: string, sub?: string) => `/api/task/${encodeURIComponent(slug)}${sub ? `/${sub}` : ""}`;

export const api = {
  board: () => request<Board>("/api/board"),
  task: (slug: string) => request<TaskDetail>(taskUrl(slug)),
  answerCard: (slug: string, id: string, choice: string, note = "") =>
    post<{ inbox: Inbox }>(taskUrl(slug, "inbox"), { type: "card", id, choice, note }),
  unsetCard: (slug: string, id: string) => post<{ inbox: Inbox }>(taskUrl(slug, "inbox"), { type: "unset", id }),
  decideReply: (slug: string, qid: string, decision: string, note = "") =>
    post<{ inbox: Inbox }>(taskUrl(slug, "inbox"), { type: "reply", qid, decision, note }),
  submit: (slug: string) => post<{ inbox: Inbox }>(taskUrl(slug, "inbox"), { type: "submit" }),
  reopen: (slug: string) => post<{ inbox: Inbox }>(taskUrl(slug, "inbox"), { type: "reopen" }),
  setStage: (slug: string, value: string, note = "") => post<{ ok: boolean }>(taskUrl(slug, "stage"), { value, note }),
  setWorkStage: (slug: string, id: string, stage: string, note = "") =>
    post<{ ok: boolean; changed: boolean }>(taskUrl(slug, "work"), { id, stage, note }),
};
