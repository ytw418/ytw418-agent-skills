import { useState } from "react";
import { api, shotUrl, type Inbox, type Shot, type WorkItem } from "../../lib/api";
import { Inline } from "../../lib/md";
import { Q_STATUS_TONE, SEND_HOW, STAGE_HINT, STAGE_TONE, daysSince, daysText, idsOf, waitingWhat, whyParts } from "../../lib/stages";
import { Badge, BottomSheet, Button, ChatIcon, SegmentedControl, TextArea, useOverlay } from "../../ui";
import { Option } from "./Decide";
import { hasUnsent, shownStage } from "./Board";

const AUTO_STAGES = new Set(["검토 중", "질문 대기", "결정 필요"]);

function metaText(w: WorkItem, othersAsked: Set<string>) {
  const who = w.owner && w.owner !== "본인" ? `${w.owner} 담당` : "내가 해요";
  if (w.why.startsWith("아직 안 보낸")) return `${w.id} · ${idsOf(w.why)} 아직 안 보냈어요 · ${who}`;
  if (w.why.startsWith("질문함") || w.why.startsWith("기다림")) return `${w.id} · ${waitingWhat(w.why, othersAsked)}을 기다려요 · ${who}`;
  if (w.why.startsWith("답 옴")) return `${w.id} · ${idsOf(w.why)} 답이 왔어요 · ${who}`;
  if (w.why.startsWith("앞 작업")) return `${w.id} · ${idsOf(w.why)}이 끝나야 시작해요 · ${who}`;
  if (w.why.startsWith("기본값")) return `${w.id} · ${idsOf(w.why)}는 기본값으로 진행해요 · ${who}`;
  if (w.why === "사용자가 정함") return `${w.id} · 직접 정한 단계예요 · ${who}`;
  return `${w.id} · ${who}`;
}

/** 기다림 항목 한 줄: '○○님이 하기로 했어요 · 2일째'. 다른 사람이 이미 물은 건이면 그렇게 쓴다.
 *  누가 하기로 했는지는 답 칸('기다림 — <누가> …, 날짜')에서 먼저 찾고, 없을 때만 결정 주체를 쓴다 */
function promisedText(id: string, r: Record<string, string>, othersAsked: Set<string>) {
  const answer = r["답"] ?? "";
  const days = daysSince(answer);
  const when = days == null ? "" : ` · ${daysText(days)}`;
  if (othersAsked.has(id)) return `같은 내용을 이미 물어봤어요. 답을 기다려요${when}`;
  const who = (answer.includes("—") ? answer.split("—").slice(1).join("—") : answer).split(/\d{4}-\d{2}-\d{2}/)[0];
  const person = who.match(/([^\s,·()]+?)\s*님/)?.[1];
  if (person) return `${person}님이 하기로 했어요${when}`;
  const owners = (r["결정 주체"] ?? "").split("+").map((o) => ({ role: o.replace(/\(.*?\)/g, "").trim(), name: o.match(/\(([^)]+)\)/)?.[1]?.replace(/님$/, "") }));
  const hit = owners.find((o) => (o.role && who.includes(o.role)) || (o.name && who.includes(o.name))) ?? (who.trim() ? undefined : owners[0]);
  if (hit?.name) return `${hit.name}님이 하기로 했어요${when}`;
  if (hit?.role) return `${hit.role} 쪽에서 하기로 했어요${when}`;
  return `하기로 한 것을 기다려요${when}`;
}

/** 작업을 누르면 올라오는 시트: 왜 이 단계인지, 받은 답 정하기, 관련 항목, 단계 바꾸기 */
export function WorkSheet({ slug, w, shots, ids, othersAsked, inbox, pending, onClose, onMove, refresh }: {
  slug: string; w: WorkItem | null; shots: Shot[]; ids: Map<string, Record<string, string>>; othersAsked: Set<string>; inbox: Inbox | null; pending: Set<string>;
  onClose: () => void; onMove: (w: WorkItem, to: string) => void; refresh: () => void;
}) {
  const { toast } = useOverlay();
  const [moreStage, setMoreStage] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!w) return null;
  const shown = shownStage(w, pending);
  const choice = w.stage_set || "자동";
  const replies = w.related.filter((id) => ids.get(id)?.["상태"] === "답 옴");
  const unsent = ["완료", "취소"].includes(w.stage) ? [] : w.related.filter((id) => ids.get(id)?.["상태"] === "보낼 질문");
  const why = whyParts(w.why);
  const hint = shown === "반영 중" ? "제출한 답을 반영하고 있어요"
    : hasUnsent(w) ? "아직 안 보낸 질문이 있어요"
    : w.stage === "질문 대기" && why["기다림"] && !why["질문함"] && why["기다림"].split(", ").every((q) => !othersAsked.has(q)) ? "담당자가 하기로 한 것을 기다리고 있어요"
    : STAGE_HINT[w.stage];
  const submitted = !!inbox?.submitted;
  const decidedAll = replies.length > 0 && replies.every((q) => inbox?.replies?.[q]);
  const showStage = !AUTO_STAGES.has(w.stage) || moreStage || !replies.length;

  const decide = async (q: string, v: string) => {
    try { await api.decideReply(slug, q, v, notes[q] ?? inbox?.replies?.[q]?.note ?? ""); refresh(); }
    catch (e) { toast((e as Error).message); }
  };
  const submit = async () => {
    try { await api.submit(slug); toast("제출했어요. 에이전트가 반영할게요"); refresh(); onClose(); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={w.title}
      footer={replies.length > 0 && !submitted && decidedAll ? <Button size="lg" full onClick={submit}>제출하기</Button> : undefined}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <Badge tone={shown === "반영 중" ? "blue" : STAGE_TONE[w.stage]}>{shown}</Badge>
        <span className="muted" style={{ fontSize: 14 }}>{hint}</span>
      </div>
      <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>{metaText(w, othersAsked)}</div>

      {unsent.length > 0 && (
        <div className="send-note" style={{ marginTop: 16 }}>
          <div className="sn-title">보낼 질문 {unsent.length}개 · 아직 안 보냈어요</div>
          <div className="sn-desc">{SEND_HOW}</div>
        </div>
      )}

      {shots.length > 0 && (
        <>
          <div style={{ marginTop: 18, fontWeight: 700 }}>작업 화면 <span className="faint" style={{ fontWeight: 400, fontSize: 13 }}>{shots.length}장 · 최신 순</span></div>
          <div className="shots">
            {shots.map((s) => {
              const src = shotUrl(slug, w.id, s.file) + s.mtime;
              return (
                <a key={s.file} className="shot" href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt={s.caption} loading="lazy" />
                  <span className="shot-cap">{s.caption}</span>
                  <span className="faint shot-time">{new Date(s.mtime * 1000).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </a>
              );
            })}
          </div>
        </>
      )}

      {replies.length > 0 && !submitted && replies.map((q) => {
        const r = ids.get(q)!;
        const picked = inbox?.replies?.[q];
        return (
          <div key={q} style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 700 }}>{q} 답을 어떻게 할까요?</div>
            <div className="quote" style={{ marginTop: 8 }}><div className="who"><ChatIcon />{r["결정 주체"]}</div><Inline text={r["답"] ?? ""} /></div>
            {([["반영", "반영하기", "답대로 문서를 고쳐요"], ["추가 질문", "추가로 묻기", "아래 메모를 질문지에 넣어요"], ["빼기", "이 항목 빼기", "이번 범위에서 빼요"]] as const).map(([v, label, desc]) => (
              <Option key={v} selected={picked?.decision === v} label={label} description={desc} recommended={v === "반영"} onClick={() => decide(q, v)} />
            ))}
            <div style={{ marginTop: 8 }}>
              <TextArea placeholder="메모나 추가로 물을 내용을 적어요(선택)" value={notes[q] ?? picked?.note ?? ""} onChange={(e) => setNotes((x) => ({ ...x, [q]: e.target.value }))}
                onBlur={() => picked && (notes[q] ?? "") !== (picked.note ?? "") && decide(q, picked.decision)} />
            </div>
          </div>
        );
      })}
      {replies.length > 0 && !submitted && !decidedAll && <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>고르면 아래에 '제출하기'가 나와요. 다른 결정과 함께 제출해도 돼요.</div>}

      {showStage ? (
        <>
          <div style={{ marginTop: 20, fontWeight: 700 }}>단계 바꾸기</div>
          <div className="faint" style={{ fontSize: 13, margin: "2px 0 8px" }}>'자동'이면 관련 질문 상태로 정해져요</div>
          <SegmentedControl label="작업 단계" value={choice} onChange={(v) => v !== choice && onMove(w, v)}
            items={["자동", "진행 중", "완료", "보류", "취소"].map((v) => ({ value: v, label: v }))} />
        </>
      ) : (
        <button className="text-btn" style={{ marginTop: 16 }} onClick={() => setMoreStage(true)}>다른 단계로 옮기기</button>
      )}

      {w.related.length > 0 && <div style={{ marginTop: 22, fontWeight: 700 }}>관련 항목</div>}
      {w.related.map((id) => {
        const r = ids.get(id);
        if (!r) return <div key={id} className="rel">{id} — 문서에서 찾지 못했어요</div>;
        const text = r["무엇을"] || r["내용"] || r["결정"] || r["작업"] || "";
        const status = r["상태"] || r["단계"];
        return (
          <div key={id} className="rel">
            <div className="r-head">{id}{status && <Badge tone={Q_STATUS_TONE[status] ?? "grey"} size="sm">{status}</Badge>}{r["결정 주체"] && <span className="faint" style={{ fontWeight: 400, fontSize: 13 }}>{r["결정 주체"]}</span>}</div>
            <Inline text={text} />
            {status === "보낼 질문" && <div className="r-send">아직 안 보냈어요</div>}
            {status === "기다림" && <div className="r-wait">{promisedText(id, r, othersAsked)}</div>}
            {r["답"] && r["상태"] !== "답 옴" && r["상태"] !== "보낼 질문" && <div className="faint" style={{ marginTop: 4, fontSize: 13 }}><Inline text={r["답"]} /></div>}
          </div>
        );
      })}
      {w.memo && <div className="rel" style={{ background: "transparent", border: "1px solid var(--line)" }}><Inline text={w.memo} /></div>}
      <div style={{ height: 8 }} />
    </BottomSheet>
  );
}
