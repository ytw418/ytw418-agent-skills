import { useLayoutEffect, useRef, useState } from "react";
import type { WorkItem, WorkStage } from "../../lib/api";
import { useChanged } from "../../lib/hooks";
import { Inline } from "../../lib/md";
import { FLOW, MOVABLE, PARKED, daysText, idsOf, roles, waitingWhat } from "../../lib/stages";
import { Badge, Check, Dot, Spinner } from "../../ui";

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 화면에 보여줄 단계: 제출하고 반영을 기다리는 결정은 '반영 중'으로 보인다 */
export const shownStage = (w: WorkItem, pending: Set<string>) =>
  w.stage === "결정 필요" && w.related.some((q) => pending.has(q)) ? "반영 중" : w.stage;

/** 질문지에만 넣고 아직 안 보낸 질문 때문에 검토 중인 작업 */
export const hasUnsent = (w: WorkItem) => w.stage === "검토 중" && w.why.startsWith("아직 안 보낸");

function Indicator({ w, shown, fresh }: { w: WorkItem; shown: string; fresh: boolean }) {
  if (shown === "반영 중") return <Spinner />; // 진짜로 기다리는 곳에만 로딩을 쓴다
  if (w.stage === "완료") return <Check size={18} draw={fresh} />;
  if (w.stage === "결정 필요") return <Badge tone="fill-orange" size="sm">답 옴</Badge>;
  if (hasUnsent(w)) return <Badge tone="orange" size="sm">보낼 질문</Badge>;
  if (w.stage === "진행 중") return <Dot tone="blue" />;
  if (w.stage === "질문 대기") return <Dot tone="grey" />;
  return null;
}

function whyText(w: WorkItem, shown: string, othersAsked: Set<string>) {
  if (shown === "반영 중") return "제출한 답을 반영하고 있어요";
  if (w.stage === "질문 대기") {
    if (w.why.startsWith("앞 작업")) return `${idsOf(w.why)}이 끝나면 시작해요`;
    return `${waitingWhat(w.why, othersAsked)} 기다리는 중${w.wait_days != null ? ` · ${daysText(w.wait_days)}` : ""}`;
  }
  if (w.stage === "결정 필요") return `${idsOf(w.why)} 답이 왔어요`;
  if (hasUnsent(w)) return `${idsOf(w.why)} 아직 안 보냈어요`;
  if (w.stage === "검토 중") return `${idsOf(w.why)} 검토하고 있어요`;
  if (w.stage === "진행 중") return w.memo || "만드는 중이에요";
  return w.memo;
}

function WorkCard({ w, shown, fresh, shotCount, othersAsked, onOpen, onDragState }: {
  w: WorkItem; shown: string; fresh: boolean; shotCount: number; othersAsked: Set<string>; onOpen: () => void; onDragState: (id: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const who = roles(w.owner)[0];
  const why = whyText(w, shown, othersAsked);
  return (
    <button
      data-wid={w.id}
      className={`wcard stage-${w.stage.replace(" ", "")} ${shown === "반영 중" ? "pending" : ""} ${fresh ? "shine" : ""} ${dragging ? "dragging" : ""}`}
      onClick={onOpen}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", w.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); onDragState(w.id); }}
      onDragEnd={() => { setDragging(false); onDragState(null); }}
      aria-label={`${w.id} ${w.title}, ${shown}`}
    >
      <div className="w-top">
        <span className="w-id">{w.id}</span>
        {who && who !== "본인" && <Badge tone="grey" size="sm">{who}</Badge>}
        {shotCount > 0 && <Badge tone="blue" size="sm">화면 {shotCount}</Badge>}
        <span className="w-ind"><Indicator w={w} shown={shown} fresh={fresh} /></span>
      </div>
      <div className="w-title">{w.title}</div>
      {why && <div className="w-why"><Inline text={why} /></div>}
    </button>
  );
}

/**
 * 단계별 열. 단계가 바뀐 카드만 이전 자리에서 새 자리로 한 번 미끄러진다(FLIP).
 * 위치는 보드 기준 레이아웃 좌표(offsetLeft/Top)로 재므로, 위쪽이 밀리거나 폴링으로 다시 그려도 헛 애니메이션이 없다.
 * 착수 가능(자동)·진행 중·완료 열에 끌어다 놓을 수 있다. 나머지 열은 질문 상태로 정해진다.
 */
export function Board({ work, shots, pending, othersAsked, onOpen, onMove, focus }: {
  work: WorkItem[]; shots: Record<string, unknown[]>; pending: Set<string>; othersAsked: Set<string>; onOpen: (w: WorkItem) => void; onMove: (w: WorkItem, to: string) => void; focus: { stage: WorkStage; at: number } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rects = useRef(new Map<string, { x: number; y: number }>());
  const prevStage = useRef(new Map<string, string>());
  const fresh = useChanged(work, (w) => w.stage);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const layoutKey = work.map((w) => `${w.id}:${w.stage}`).join("|");

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    const next = new Map<string, { x: number; y: number }>();
    host.querySelectorAll<HTMLElement>("[data-wid]").forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel()); // 도는 중인 애니메이션이 측정에 섞이지 않게
      const id = el.dataset.wid!;
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      const prev = rects.current.get(id);
      const was = prevStage.current.get(id), now = work.find((w) => w.id === id)?.stage;
      if (prev && was && was !== now && !reduceMotion()) {
        const dx = prev.x - pos.x, dy = prev.y - pos.y;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(1.03)`, boxShadow: "0 14px 32px rgba(23,25,29,.2)", zIndex: 5 }, { transform: "none", zIndex: 5 }],
          { duration: 720, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
      next.set(id, pos);
    });
    rects.current = next;
    prevStage.current = new Map(work.map((w) => [w.id, w.stage]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  // 창 크기가 바뀌면 자리만 다시 잰다(애니메이션 없음)
  useLayoutEffect(() => {
    const on = () => ref.current?.querySelectorAll<HTMLElement>("[data-wid]").forEach((el) => rects.current.set(el.dataset.wid!, { x: el.offsetLeft, y: el.offsetTop }));
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useLayoutEffect(() => {
    if (!focus) return;
    ref.current?.querySelector(`[data-col="${focus.stage}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const dragged = work.find((w) => w.id === dragId);
  const parked = work.filter((w) => PARKED.includes(w.stage));

  return (
    <>
      <div className="board" ref={ref}>
        {FLOW.map((s) => {
          const items = work.filter((w) => w.stage === s);
          const target = MOVABLE[s];
          const canDrop = !!dragged && !!target && dragged.stage !== s && (dragged.stage_set || "자동") !== target;
          const hot = s === "결정 필요" && items.some((w) => shownStage(w, pending) === "결정 필요");
          return (
            <section
              key={s}
              data-col={s}
              className={`col ${hot ? "hot" : ""} ${items.length ? "" : "empty"} ${dragged ? (canDrop ? (over === s ? "drop-ok" : "drop-can") : "drop-no") : ""}`}
              onDragOver={(e) => { if (canDrop) { e.preventDefault(); setOver(s); } }}
              onDragLeave={() => setOver((o) => (o === s ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (dragged && canDrop) onMove(dragged, target); }}
              aria-label={`${s} ${items.length}개`}
            >
              <div className="col-head">
                <span className="c-name">{s}</span>
                <span className="c-count">{items.length}</span>
              </div>
              {items.map((w) => (
                <WorkCard key={w.id} w={w} shown={shownStage(w, pending)} fresh={fresh.has(w.id)} shotCount={shots[w.id]?.length ?? 0} othersAsked={othersAsked} onOpen={() => onOpen(w)} onDragState={setDragId} />
              ))}
              {!items.length && <div className="c-empty">{dragged && canDrop ? "여기에 놓아요" : ""}</div>}
            </section>
          );
        })}
      </div>
      {dragged && <div className="drag-hint">착수 가능·진행 중·완료 열에 놓을 수 있어요. 나머지는 질문 상태로 정해져요</div>}
      {parked.length > 0 && (
        <div className="parked">
          <span className="p-label">멈춘 작업</span>
          {parked.map((w) => (
            <button key={w.id} onClick={() => onOpen(w)}><Badge tone={w.stage === "보류" ? "yellow" : "grey"} size="sm">{w.stage}</Badge>{w.id} {w.title}</button>
          ))}
        </div>
      )}
    </>
  );
}
