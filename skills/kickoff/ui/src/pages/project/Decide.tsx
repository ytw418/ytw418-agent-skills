import { useState } from "react";
import { api, type Card, type TaskDetail } from "../../lib/api";
import { Inline, Markdown } from "../../lib/md";
import { Badge, Button, ChatIcon, ListHeader, ListRow, Spinner, TextArea, useOverlay } from "../../ui";

interface Reply { id: string; what: string; owner: string; reply: string }

export function repliesOf(d: TaskDetail): Reply[] {
  const tb = d.sections.find((s) => s.no === 5)?.blocks.find((b) => b.type === "table");
  if (!tb?.header || !tb.rows) return [];
  const i = (k: string) => tb.header!.indexOf(k);
  return tb.rows.filter((r) => r[i("상태")] === "답 옴").map((r) => ({ id: r[i("ID")], what: r[i("내용")], owner: r[i("결정 주체")], reply: r[i("답")] }));
}

export function Option({ selected, label, description, preview, recommended, onClick }: {
  selected: boolean; label: string; description?: string; preview?: string; recommended?: boolean; onClick: () => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <div>
      <button className={`opt ${selected ? "sel" : ""}`} onClick={onClick} role="radio" aria-checked={selected}>
        <span className="radio" />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="o-label">{label}{recommended && <Badge tone="blue" size="sm">추천</Badge>}</span>
          {description && <span className="o-desc" style={{ display: "block" }}><Inline text={description} /></span>}
        </span>
      </button>
      {preview && (
        <>
          <button className="text-btn" style={{ margin: "6px 0 0 48px" }} onClick={() => setMore((v) => !v)} aria-expanded={more}>{more ? "비교 접기" : "자세히 비교하기"}</button>
          {more && <div style={{ padding: "4px 2px 0" }}><Markdown text={preview} /></div>}
        </>
      )}
    </div>
  );
}

/** 지금 결정할 것: 받은 답(반영·추가로 묻기·빼기)과 질문 카드. 제출하면 한 줄로 접힌다 */
export function Decide({ d, refresh }: { d: TaskDetail; refresh: () => void }) {
  const { toast } = useOverlay();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const inbox = d.inbox;
  const submitted = !!inbox?.submitted;
  const cards: Card[] = d.cards?.cards ?? [];
  const replies = repliesOf(d);
  const total = cards.length + replies.length;
  const answered = cards.filter((c) => inbox?.cards?.[c.id]).length + replies.filter((r) => inbox?.replies?.[r.id]).length;
  if (!total) return null;

  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); refresh(); } catch (e) { toast((e as Error).message); }
  };
  const clearDraft = (key: string) => setDrafts((x) => { const n = { ...x }; delete n[key]; return n; });

  if (submitted) {
    return (
      <section className="surface decide compact">
        <ul className="list">
          <ListRow
            left={<Spinner large />}
            top={`제출한 답 ${answered}개를 반영하고 있어요`}
            bottom="반영이 끝나면 이 화면이 저절로 바뀌어요"
            right={<Button variant="light" size="sm" onClick={() => run(() => api.reopen(d.slug))}>다시 고치기</Button>}
          />
        </ul>
      </section>
    );
  }

  const unansweredRec = cards.filter((c) => !inbox?.cards?.[c.id] && c.options.some((o) => o.recommended));
  const left = total - answered;

  return (
    <section className="surface decide">
      <ListHeader
        title={<>지금 결정할 것 {left > 0 && <Badge tone="fill-orange" size="sm">{left}</Badge>}</>}
        description="고르고 맨 아래 '제출하기'를 누르면 에이전트가 문서에 반영해요"
        right={unansweredRec.length > 1 ? (
          <Button variant="weak" size="sm" onClick={() => run(async () => {
            for (const c of unansweredRec) await api.answerCard(d.slug, c.id, c.options.find((o) => o.recommended)!.label);
            toast(`${unansweredRec.length}개를 추천대로 골랐어요`);
          })}>모두 추천대로 고르기</Button>
        ) : undefined}
      />

      {replies.map((r) => {
        const picked = inbox?.replies?.[r.id];
        const key = `reply:${r.id}`;
        const note = drafts[key] ?? picked?.note ?? "";
        const choose = (decision: string) => run(async () => { await api.decideReply(d.slug, r.id, decision, note); clearDraft(key); });
        return (
          <div className="qcard" key={r.id} data-qid={r.id}>
            <div className="q-head"><Badge tone="orange" size="sm">답이 왔어요</Badge><span className="faint" style={{ fontSize: 13 }}>{r.id}</span></div>
            <div className="q-title"><Inline text={r.what} /></div>
            <div className="quote"><div className="who"><ChatIcon />{r.owner}</div><Inline text={r.reply} /></div>
            {([["반영", "반영하기", "답대로 문서를 고쳐요"], ["추가 질문", "추가로 묻기", "아래 메모를 질문지에 넣어요"], ["빼기", "이 항목 빼기", "이번 범위에서 빼요"]] as const).map(([v, label, desc]) => (
              <Option key={v} selected={picked?.decision === v} label={label} description={desc} recommended={v === "반영"} onClick={() => choose(v)} />
            ))}
            <div style={{ marginTop: 10 }}>
              <TextArea placeholder="메모나 추가로 물을 내용을 적어요(선택)" value={note}
                onChange={(e) => setDrafts((x) => ({ ...x, [key]: e.target.value }))}
                onBlur={() => picked && note !== (picked.note ?? "") && run(async () => { await api.decideReply(d.slug, r.id, picked.decision, note); clearDraft(key); })} />
            </div>
          </div>
        );
      })}

      {cards.map((c) => {
        const picked = inbox?.cards?.[c.id];
        const key = `card:${c.id}`;
        const own = drafts[key] ?? (picked?.choice === "직접 답" ? picked.note : "");
        return (
          <div className="qcard" key={c.id}>
            <div className="q-head">
              {c.header && <Badge tone="grey" size="sm">{c.header}</Badge>}
              {(c.qids ?? []).map((q) => <span key={q} className="faint" style={{ fontSize: 13 }}>{q}</span>)}
              {picked && <Badge tone="green" size="sm">골랐어요</Badge>}
            </div>
            <div className="q-title"><Inline text={c.question} /></div>
            {c.items && c.items.length > 0 && (
              <ul className="q-items">
                {c.items.map((it) => (
                  <li key={it.id}><span className="qi-id">{it.id}</span><span className="qi-text"><Inline text={it.text} />{it.rec && <span className="qi-rec">추천 · <Inline text={it.rec} /></span>}</span></li>
                ))}
              </ul>
            )}
            {c.options.map((o) => (
              <Option key={o.label} selected={picked?.choice === o.label} label={o.label} description={o.description} preview={o.preview} recommended={o.recommended}
                onClick={() => run(async () => { await api.answerCard(d.slug, c.id, o.label); clearDraft(key); })} />
            ))}
            <div style={{ marginTop: 10 }}>
              <TextArea placeholder="직접 답하기(선택) — 적으면 이 내용으로 답해요" value={own}
                onChange={(e) => setDrafts((x) => ({ ...x, [key]: e.target.value }))}
                onBlur={() => {
                  const t = own.trim();
                  if (t && !(picked?.choice === "직접 답" && picked.note === t)) run(async () => { await api.answerCard(d.slug, c.id, "직접 답", t); clearDraft(key); });
                  else if (!t && picked?.choice === "직접 답") run(async () => { await api.unsetCard(d.slug, c.id); clearDraft(key); });
                }} />
            </div>
          </div>
        );
      })}

      <div className="cta-bar">
        <Button size="lg" full disabled={!answered || busy} onClick={async () => {
          setBusy(true);
          try { await api.submit(d.slug); toast("제출했어요. 에이전트가 반영할게요"); refresh(); }
          catch (e) { toast((e as Error).message); }
          finally { setBusy(false); }
        }}>
          {answered ? `제출하기 · ${answered}/${total}` : "제출하기"}
        </Button>
      </div>
    </section>
  );
}
