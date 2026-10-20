import { useEffect, useRef, useState } from "react";
import type { WorkItem, WorkStage } from "../../lib/api";
import { FLOW, STAGE_TONE, daysText } from "../../lib/stages";
import { Check } from "../../ui";
import { shownStage } from "./Board";

/**
 * 검토 중 → … → 완료. 늘 도는 것은 '진행 중' 궤도 하나뿐이다.
 * 숫자가 바뀌는 순간에만 노드가 한 번 튀고, 바뀐 구간의 연결선이 잠깐 흐른다.
 */
export function Flow({ work, pending, onPick }: { work: WorkItem[]; pending: Set<string>; onPick: (s: WorkStage) => void }) {
  const count = (s: WorkStage) => work.filter((w) => w.stage === s).length;
  const counts = FLOW.map(count);
  const prev = useRef<number[] | null>(null);
  const [bumped, setBumped] = useState<Set<number>>(new Set());
  const key = counts.join(",");

  useEffect(() => {
    const p = prev.current;
    prev.current = counts;
    if (!p) return;
    const changed = new Set(counts.map((n, i) => (n !== p[i] ? i : -1)).filter((i) => i >= 0));
    if (!changed.size) return;
    setBumped(changed);
    const t = setTimeout(() => setBumped(new Set()), 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const waiting = work.filter((w) => w.stage === "질문 대기" && w.wait_days != null).map((w) => w.wait_days!);
  const maxWait = waiting.length ? Math.max(...waiting) : null;
  const allPending = count("결정 필요") > 0 && work.filter((w) => w.stage === "결정 필요").every((w) => shownStage(w, pending) === "반영 중");

  return (
    <div className="flow" role="list" aria-label="단계별 작업 수">
      {FLOW.map((s, i) => {
        const n = counts[i];
        const sub =
          s === "질문 대기" && n ? (maxWait == null ? "답 기다리는 중" : maxWait === 0 ? "오늘 물어봤어요" : `가장 오래 ${daysText(maxWait)}`)
          : s === "결정 필요" && n ? (allPending ? "반영하고 있어요" : "답이 왔어요")
          : s === "진행 중" && n ? "만드는 중"
          : s === "완료" && n ? `${n}개 끝냈어요` : "";
        const tone = s === "결정 필요" && allPending ? "grey" : STAGE_TONE[s];
        const flowing = bumped.has(i) || bumped.has(i + 1);
        return (
          <div key={s} role="listitem" className={`node ${n ? "has" : ""} ${tone} ${bumped.has(i) ? "bump" : ""} ${s === "결정 필요" && n && !allPending ? "attn" : ""}`}>
            {i < FLOW.length - 1 && (
              <div className={`link ${flowing ? "moving" : ""}`} aria-hidden>
                <svg preserveAspectRatio="none" viewBox="0 0 100 4"><line x1="0" y1="2" x2="100" y2="2" vectorEffect="non-scaling-stroke" /></svg>
              </div>
            )}
            <button type="button" className="node-btn" onClick={() => onPick(s)} aria-label={`${s} ${n}개, 열로 이동`}>
              <span className="dot">
                {s === "완료" && n ? <Check size={52} draw={bumped.has(i)} /> : <span className="num" key={n}>{n}</span>}
                {s === "진행 중" && n > 0 && <span className="orbit" aria-hidden />}
              </span>
              <span className="n-label">{s}</span>
              <span className="n-sub">{sub}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
