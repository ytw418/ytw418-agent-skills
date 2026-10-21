import { useEffect, useState } from "react";
import { useMedia } from "../../lib/hooks";
import type { Section, TaskDetail } from "../../lib/api";
import { Inline, Table, TextLines } from "../../lib/md";
import { Q_STATES, Q_STATUS_TONE as STATUS_TONE, SEND_HOW, roles, toSendOf } from "../../lib/stages";
import { Badge, Button, ListRow, Tabs, useOverlay } from "../../ui";

type TabKey = "요약" | "요구사항" | "화면 상태" | "검토 항목" | "설계" | "수용 기준" | "질문지" | "기록";
const TAB_SECTIONS: Record<Exclude<TabKey, "질문지">, number[]> = {
  "요약": [1, 3, 0], "요구사항": [2], "화면 상태": [4], "검토 항목": [5], "설계": [6], "수용 기준": [8], "기록": [9],
};

const SHORT = new Set(["범위", "확인 방법", "상태", "영향", "유형", "체크", "판정", "자동/수동", "단계", "담당"]);

function cellOf(h: string, v: string) {
  if (h === "상태" && STATUS_TONE[v]) return <Badge tone={STATUS_TONE[v]} size="sm">{v}</Badge>;
  if (h === "영향") return v === "막힘" ? <Badge tone="red" size="sm">막힘</Badge> : <span className={v === "사소" ? "faint" : ""}>{v}</span>;
  if (h === "근거" && v.length > 40) return <details><summary className="faint" style={{ cursor: "pointer", fontSize: 13 }}>근거 보기</summary><Inline text={v} /></details>;
  return <Inline text={v} />;
}

function SectionView({ sec, filter, narrow }: { sec: Section; filter?: { state: string; owner: string }; narrow: boolean }) {
  const body = sec.blocks.map((b, i) => {
    if (b.type === "text") return <TextLines key={i} lines={b.lines ?? []} />;
    let rows = b.rows ?? [];
    const header = (b.header ?? []).filter((h) => !(filter && h === "체크"));
    const idx = (h: string) => (b.header ?? []).indexOf(h);
    if (filter) {
      rows = rows.filter((r) => (filter.state === "전체" || r[idx("상태")] === filter.state) && (filter.owner === "전체" || roles(r[idx("결정 주체")] ?? "").includes(filter.owner)));
    }
    const shaped = rows.map((r) => header.map((h) => r[idx(h)] ?? ""));
    if (filter && !shaped.length && (b.rows ?? []).length) return <p key={i} className="muted">고른 조건에 맞는 항목이 없어요</p>;
    if (narrow && header.length > 2) {
      // 좁은 화면에서는 표 대신 행마다 한 줄씩: 가장 긴 칸을 제목으로, 짧은 칸은 배지로
      const main = header.reduce((best, h, j) => (SHORT.has(h) || j === 0 ? best : (shaped.reduce((n, r) => n + (r[j]?.length ?? 0), 0) > shaped.reduce((n, r) => n + (r[best]?.length ?? 0), 0) ? j : best)), header.length > 1 ? 1 : 0);
      return (
        <ul key={i} className="list doc-list">
          {shaped.map((r, k) => (
            <ListRow key={k} as="li"
              top={<Inline text={r[main] ?? ""} />}
              bottom={<span className="doc-meta">{header.map((h, j) => (j === main || !r[j] ? null : <span key={h}>{SHORT.has(h) ? cellOf(h, r[j]) : <><span className="faint">{h}</span> <Inline text={r[j]} /></>}</span>))}</span>}
            />
          ))}
        </ul>
      );
    }
    return <Table key={i} header={header} rows={shaped} cell={(h, v) => (SHORT.has(h) ? <span className="short">{cellOf(h, v)}</span> : cellOf(h, v))} />;
  });
  if (sec.no === 0) return <details style={{ marginTop: 18 }}><summary className="muted" style={{ cursor: "pointer", fontSize: 14 }}>입력·출처 보기</summary>{body}</details>;
  return <><h3>{sec.title}</h3>{body}</>;
}

/** 내부용 절에서 역할별 보낸 날('- 보냄: 백엔드 절 — 2026-10-17')과 역할별 Q('- 백엔드 1 = Q-4')를 읽는다 */
function sendInfo(internal: string) {
  const sent = new Map<string, string>();
  for (const m of internal.matchAll(/^-\s*보냄:\s*(\S+)\s*절\s*—\s*\d{4}-(\d{2})-(\d{2})/gm)) sent.set(m[1], `${Number(m[2])}/${Number(m[3])}`);
  const qs = new Map<string, string[]>();
  for (const m of internal.matchAll(/^-\s*(\S+)\s[^=\n]*=\s*(Q-\d+)/gm)) qs.set(m[1], [...(qs.get(m[1]) ?? []), m[2]]);
  return { sent, qs };
}

function Questions({ md, toSend }: { md: string; toSend: string[] }) {
  const { toast } = useOverlay();
  const parts = md.replace(/^#\s.*\n?/m, "").replace(/^---\s*$/gm, "").split(/\n(?=## )/);
  const unsent = toSend.length;
  const info = sendInfo(parts.find((p) => /^##\s*내부용/.test(p)) ?? "");
  return (
    <>
      {unsent > 0 && (
        <div className="send-note" style={{ margin: "4px 0 12px" }}>
          <div className="sn-title">아직 안 보낸 질문이 {unsent}개 있어요</div>
          <div className="sn-desc">{SEND_HOW}. 직접 보냈다면 대화창에 '보냈어'라고 알려 주세요</div>
        </div>
      )}
      {parts.map((p, i) => {
        if (!p.startsWith("## ")) return p.trim() ? <p key={i} className="muted" style={{ whiteSpace: "pre-wrap" }}>{p.trim()}</p> : null;
        const [head, ...rest] = p.split("\n");
        const body = rest.join("\n").trim();
        if (/^##\s*내부용/.test(head)) {
          return <details key={i} className="qsec internal"><summary className="muted">{head.replace(/^##\s*/, "")}</summary><div className="qs-body">{body}</div></details>;
        }
        const title = head.replace(/^##\s*/, "");
        const role = title.split(/\s*—\s*/)[0].trim();
        const notSent = (info.qs.get(role) ?? []).some((q) => toSend.includes(q));
        const sentOn = info.sent.get(role);
        return (
          <div className="qsec" key={i}>
            <div className="qs-head">
              <span className="qs-title">{title}{notSent ? <Badge tone="orange" size="sm">아직 안 보냈어요</Badge> : sentOn ? <Badge tone="blue" size="sm">보냄 {sentOn}</Badge> : null}</span>
              <Button variant="weak" size="sm" onClick={() => navigator.clipboard.writeText(body).then(() => toast("복사했어요. 직접 보냈다면 대화창에 '보냈어'라고 알려 주세요"))}>질문 복사하기</Button>
            </div>
            <div className="qs-body">{body}</div>
          </div>
        );
      })}
    </>
  );
}

export function Docs({ d, initial }: { d: TaskDetail; initial?: string | null }) {
  const secs = new Map(d.sections.map((s) => [s.no, s]));
  const rowsOf = (n: number) => secs.get(n)?.blocks.find((b) => b.type === "table")?.rows?.length ?? 0;
  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: "요약", label: "요약" }, { value: "요구사항", label: "요구사항", count: rowsOf(2) }, { value: "화면 상태", label: "화면 상태" },
    { value: "검토 항목", label: "검토 항목", count: rowsOf(5) }, { value: "설계", label: "설계", count: rowsOf(6) }, { value: "수용 기준", label: "수용 기준", count: rowsOf(8) },
    ...(d.questions_md ? [{ value: "질문지" as TabKey, label: "질문지" }] : []), { value: "기록", label: "기록" },
  ];
  const [tab, setTab] = useState<TabKey>((tabs.find((t) => t.value === initial)?.value) ?? "요약");
  const narrow = useMedia("(max-width: 600px)");
  useEffect(() => { const t = tabs.find((x) => x.value === initial)?.value; if (t) setTab(t); /* 주소의 ?tab= 이 바뀌면 따라간다 */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const change = (v: TabKey) => { setTab(v); history.replaceState(null, "", `#/p/${encodeURIComponent(d.slug)}?tab=${encodeURIComponent(v)}`); };
  const [state, setState] = useState("전체");
  const [owner, setOwner] = useState("전체");
  const qtable = secs.get(5)?.blocks.find((b) => b.type === "table");
  const owners = qtable ? [...new Set((qtable.rows ?? []).flatMap((r) => roles(r[(qtable.header ?? []).indexOf("결정 주체")] ?? "")))] : [];

  return (
    <section className="surface">
      <Tabs items={tabs} value={tab} onChange={change} />
      <div className="doc">
        {tab === "질문지" && d.questions_md ? <Questions md={d.questions_md} toSend={toSendOf(d.check)} /> : (
          <>
            {tab === "검토 항목" && (
              <>
                <div className="filters"><span className="f-label">상태</span>{["전체", ...Q_STATES].map((s) => <button key={s} className={state === s ? "on" : ""} onClick={() => setState(s)}>{s}</button>)}</div>
                <div className="filters"><span className="f-label">담당</span>{["전체", ...owners].map((s) => <button key={s} className={owner === s ? "on" : ""} onClick={() => setOwner(s)}>{s}</button>)}</div>
              </>
            )}
            {TAB_SECTIONS[tab as Exclude<TabKey, "질문지">].map((n) => {
              const s = secs.get(n);
              return s ? <SectionView key={n} sec={s} narrow={narrow} filter={tab === "검토 항목" ? { state, owner } : undefined} /> : null;
            })}
          </>
        )}
      </div>
    </section>
  );
}
