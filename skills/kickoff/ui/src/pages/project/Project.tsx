import { useMemo, useState } from "react";
import { api, type WorkItem, type WorkStage } from "../../lib/api";
import { useMedia, usePoll } from "../../lib/hooks";
import { Inline } from "../../lib/md";
import { SEND_HOW, deadlineOf, detailNext, indexIds, othersAskedOf, toSendOf, waitText, waitingByRole } from "../../lib/stages";
import { Badge, BottomSheet, Button, Check, ListRow, MoreIcon, ProgressRing, Result, SkeletonRows, useOverlay } from "../../ui";
import { AppBar } from "../AppBar";
import { Board } from "./Board";
import { Decide } from "./Decide";
import { Docs } from "./Docs";
import { Flow } from "./Flow";
import { WorkSheet } from "./WorkSheet";

const STAGE_ACTIONS: { value: string; label: string; desc: string; danger?: boolean }[] = [
  { value: "진행 중", label: "진행 중으로 바꾸기", desc: "작업을 시작했어요" },
  { value: "보류", label: "잠시 멈추기", desc: "목록에 '보류'로 보여요" },
  { value: "완료", label: "끝내기", desc: "끝난 프로젝트로 옮겨요" },
  { value: "취소", label: "하지 않기로 하기", desc: "끝난 프로젝트로 옮겨요. 나중에 되돌릴 수 있어요", danger: true },
];

export function Project({ slug, tab }: { slug: string; tab: string | null }) {
  const { data: d, error, stamp, refresh } = usePoll(() => api.task(slug), [slug]);
  const { toast, confirm } = useOverlay();
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ stage: WorkStage; at: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const ids = useMemo(() => (d ? indexIds(d) : new Map<string, Record<string, string>>()), [d]);
  const narrow = useMedia("(max-width: 900px)");

  if (!d) {
    return (
      <>
        <AppBar back stamp={stamp} error={error} />
        <main className="page">
          {error ? <div className="surface"><Result title="프로젝트를 열지 못했어요" description={error} action={<a href="#/"><Button variant="light">목록으로 가기</Button></a>} /></div>
            : <div className="surface" style={{ marginTop: 12 }}><SkeletonRows rows={5} /></div>}
        </main>
      </>
    );
  }

  const c = d.check;
  const next = detailNext(d);
  const waits = waitingByRole(c.waiting);
  const jira = (c.task_id || "").replace(/\s*\(.*\)\s*$/, "");
  const open = c.work.find((w) => w.id === openId) ?? null;
  const submitted = !!d.inbox?.submitted;
  const pending = new Set(submitted ? Object.keys(d.inbox?.replies ?? {}) : []);
  const othersAsked = othersAskedOf(c.waiting);
  const decideTotal = (d.cards?.cards.length ?? 0) + c.replied.length;
  const sidePanel = decideTotal > 0 && !submitted;
  const due = deadlineOf(d.questions_md);
  const decided = ["진행 중", "보류", "완료", "취소"].includes(c.stage);
  const unsent = toSendOf(c).length;

  const moveWork = async (w: WorkItem, to: string) => {
    try {
      const r = await api.setWorkStage(slug, w.id, to);
      if (r.changed) toast(to === "자동" ? `${w.id} 작업을 질문 상태에 맞춰 두었어요` : `${w.id} 작업을 ${to} 단계로 옮겼어요`);
      refresh(true);
    } catch (e) { toast((e as Error).message); }
  };
  const setProjectStage = async (v: string) => {
    setMenu(false);
    if (v === "취소" && !(await confirm({ title: "이 프로젝트를 하지 않기로 할까요?", description: "끝난 프로젝트로 옮겨요. 나중에 되돌릴 수 있어요.", confirm: "하지 않기로 하기", danger: true }))) return;
    try { await api.setStage(slug, v); toast(v === c.verdict ? "자동 상태로 되돌렸어요" : `프로젝트를 ${v} 단계로 바꿨어요`); refresh(true); } catch (e) { toast((e as Error).message); }
  };

  return (
    <>
      <AppBar back name={c.title} stamp={stamp} error={error}
        right={<button className="icon-btn" aria-label="프로젝트 단계 바꾸기" onClick={() => setMenu(true)}><MoreIcon /></button>} />
      <main className={`page proj ${sidePanel ? "with-side" : ""}`}>
        <section className="surface hero area-hero">
          {c.work.length > 0 && <ProgressRing done={c.progress.done} total={c.progress.total} size={narrow ? 64 : 120} stroke={narrow ? 7 : 11} caption={`${c.progress.done}/${c.progress.total} 완료`} />}
          <div className="h-main">
            <h1 className="h-title">{c.title || d.slug}</h1>
            <div className="h-next" style={{ color: next.tone === "orange" ? "var(--orange-ink)" : undefined }}>{next.text}</div>
            <div className="h-meta">
              <Badge tone={decided ? "blue" : "grey"}>{c.stage}</Badge>
              {c.kind && <Badge>{c.kind}</Badge>}
              {/^[A-Z][A-Z0-9]+-\d+$/.test(jira) && <Badge>{jira}</Badge>}
              {c.blocking.length > 0 && <Badge tone="red">막힘 {c.blocking.length}</Badge>}
              {unsent > 0 && <Badge tone="orange">보낼 질문 {unsent}</Badge>}
              {due && c.asked.length > 0 && <Badge tone={due.left <= 0 ? "red" : due.left <= 1 ? "yellow" : "grey"}>{due.left > 0 ? `확인 희망일 ${due.label} · ${due.left}일 남음` : due.left === 0 ? `오늘이 확인 희망일이에요` : `확인 희망일 ${due.label}이 지났어요`}</Badge>}
            </div>
            {unsent > 0 && <div className="send-note" style={{ marginTop: 14 }}>{SEND_HOW}</div>}
            {waits.length > 0 && <div className="h-waits">{waits.map((w) => <span key={w.owner} className={w.days != null && w.days >= 3 ? "late" : ""}>{waitText(w)}</span>)}</div>}
            {c.early_start && c.blocking.length > 0 && <div className="early">답을 기다리는 동안 먼저 해도 돼요 — <Inline text={c.early_start} /></div>}
          </div>
        </section>

        {decideTotal > 0 && (
          <aside className={sidePanel ? "area-side" : "area-pending"}>
            <Decide key={`${d.cards?.round ?? 0}`} d={d} refresh={() => refresh(true)} />
          </aside>
        )}

        {c.work.length > 0 ? (
          <section className="surface area-board">
            <Flow work={c.work} pending={pending} onPick={(s) => setFocus({ stage: s, at: performance.now() })} />
            <Board work={c.work} shots={d.shots ?? {}} pending={pending} othersAsked={othersAsked} onOpen={(w) => setOpenId(w.id)} onMove={moveWork} focus={focus} />
          </section>
        ) : (
          <section className="surface area-board">
            <Result title="작업 목록이 아직 없어요" description="문서 7장에 작업(W-n)을 나누면 여기서 단계별로 보여요" />
          </section>
        )}

        <div className="area-docs"><Docs d={d} initial={tab} /></div>
      </main>

      <WorkSheet key={openId ?? "none"} slug={slug} w={open} shots={open ? d.shots?.[open.id] ?? [] : []} ids={ids} othersAsked={othersAsked} inbox={d.inbox} pending={pending} refresh={() => refresh(true)}
        onClose={() => setOpenId(null)} onMove={(w, to) => { setOpenId(null); moveWork(w, to); }} />

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="프로젝트 단계">
        <ul className="list" style={{ margin: "0 -24px" }}>
          {STAGE_ACTIONS.map((a) => (
            <ListRow key={a.value} onClick={() => c.stage !== a.value && setProjectStage(a.value)}
              top={<span style={{ color: a.danger ? "var(--red)" : undefined }}>{a.label}</span>} bottom={a.desc}
              right={c.stage === a.value ? <Check size={20} /> : undefined} />
          ))}
          {decided && <ListRow onClick={() => setProjectStage(c.verdict)} top="자동으로 되돌리기" bottom={`질문 상태에 맞춰 '${c.verdict}'로 보여요`} />}
        </ul>
      </BottomSheet>
    </>
  );
}
