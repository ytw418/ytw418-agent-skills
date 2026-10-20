import { useState } from "react";
import { api, type Project } from "../lib/api";
import { usePoll } from "../lib/hooks";
import { daysText, longestWait, nextLine } from "../lib/stages";
import { Badge, Button, ListHeader, ListRow, ProgressRing, Result, SkeletonRows, Top } from "../ui";
import { AppBar } from "./AppBar";

const DONE = new Set(["완료", "취소"]);

function ProjectRow({ p }: { p: Project }) {
  const next = nextLine(p);
  const decide = p.cards_open + p.replies_open.length;
  const wait = longestWait(p.waiting ?? []);
  const progress = p.progress ?? { done: 0, total: 0 };
  return (
    <ListRow
      onClick={() => (location.hash = `#/p/${encodeURIComponent(p.slug)}`)}
      left={<ProgressRing done={progress.done} total={progress.total} size={44} stroke={5} />}
      top={<span className="row-title">{p.title || p.slug}{p.stage === "보류" && <Badge tone="yellow" size="sm">보류</Badge>}</span>}
      bottom={<span style={{ color: next.tone === "orange" ? "var(--orange-ink)" : undefined }}>{next.text || `작업 ${p.work?.length ?? 0}개`}</span>}
      right={
        <>
          {decide > 0 ? <Badge tone="fill-orange">결정 {decide}</Badge>
            : wait ? <Badge tone={wait.days != null && wait.days >= 3 ? "red" : "grey"}>{wait.owner} {wait.days == null ? "답 대기" : daysText(wait.days)}</Badge> : null}
          {p.errors.length > 0 && <Badge tone="red" size="sm">문서 확인 필요</Badge>}
        </>
      }
      arrow
    />
  );
}

export function ProjectList() {
  const { data, error, stamp } = usePoll(api.board, []);
  const [showDone, setShowDone] = useState(false);
  const all = data?.tasks ?? [];
  const live = all.filter((p) => !DONE.has(p.stage));
  const done = all.filter((p) => DONE.has(p.stage));
  const decideNow = live.filter((p) => p.cards_open || p.replies_open.length);
  const others = live.filter((p) => !(p.cards_open || p.replies_open.length));
  const decideCount = live.reduce((n, p) => n + p.cards_open + p.replies_open.length, 0);

  return (
    <>
      <AppBar stamp={stamp} error={error} />
      <main className="page narrow">
        <Top
          title="킥오프"
          subtitle={data ? (live.length ? `프로젝트 ${live.length}개${decideCount ? ` · 지금 결정할 것 ${decideCount}개` : ""}` : "") : " "}
        />
        {!data && !error && <div className="surface"><SkeletonRows /></div>}
        {data && !all.length && (
          <div className="surface">
            <Result title="아직 킥오프한 프로젝트가 없어요" description={<>대화창에서 <code>/kickoff</code>로 새 작업을 검토하면 여기에 보여요.</>} />
          </div>
        )}
        {decideNow.length > 0 && (
          <section className="surface" style={{ marginBottom: 12 }}>
            <ListHeader title={<>지금 결정할 것 <Badge tone="fill-orange" size="sm">{decideCount}</Badge></>} />
            <ul className="list">{decideNow.map((p) => <ProjectRow key={p.slug} p={p} />)}</ul>
          </section>
        )}
        {others.length > 0 && (
          <section className="surface" style={{ marginBottom: 12 }}>
            <ListHeader title={decideNow.length ? "다른 프로젝트" : "프로젝트"} right={`${others.length}개`} />
            <ul className="list">{others.map((p) => <ProjectRow key={p.slug} p={p} />)}</ul>
          </section>
        )}
        {done.length > 0 && (
          <section className="surface">
            <ListHeader title="끝난 프로젝트" right={<Button variant="light" size="sm" onClick={() => setShowDone((v) => !v)}>{showDone ? "접기" : `${done.length}개 보기`}</Button>} />
            {showDone && <ul className="list">{done.map((p) => <ProjectRow key={p.slug} p={p} />)}</ul>}
          </section>
        )}
      </main>
    </>
  );
}
