// brief.md 의 칸·비교표처럼 짧은 마크다운만 그린다(외부 라이브러리 없이)
import { Fragment, type ReactNode } from "react";

/** `코드`, **굵게** 만 처리한다 */
export function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(m[1] != null ? <code key={i++}>{m[1]}</code> : <b key={i++}>{m[2]}</b>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts.map((p, k) => <Fragment key={k}>{p}</Fragment>)}</>;
}

export function splitRow(line: string): string[] {
  const go = (honor: boolean) => {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
    const cells: string[] = [];
    let buf = "", code = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "\\" && s[i + 1] === "|") { buf += "|"; i++; continue; }
      if (ch === "`" && honor) code = !code;
      if (ch === "|" && !code) { cells.push(buf.trim()); buf = ""; } else buf += ch;
    }
    cells.push(buf.trim());
    return code ? null : cells;
  };
  return go(true) ?? go(false)!;
}

const isSep = (l: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l.trim());

export function Table({ header, rows, cell }: { header: string[]; rows: string[][]; cell?: (h: string, v: string, row: string[]) => ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr>{header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{header.map((h, j) => <td key={j}>{cell ? cell(h, r[j] ?? "", r) : <Inline text={r[j] ?? ""} />}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 표는 표로, 나머지 줄은 문단으로 */
export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  const tableAt = (j: number) => lines[j].trim().startsWith("|") && isSep(lines[j + 1] ?? "");
  while (i < lines.length) {
    if (tableAt(i)) {
      const tl: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) tl.push(lines[i++]);
      out.push(<Table key={k++} header={splitRow(tl[0])} rows={tl.slice(2).map(splitRow)} />);
    } else {
      const pl: string[] = [];
      while (i < lines.length && !tableAt(i)) pl.push(lines[i++]);
      const t = pl.join("\n").trim();
      if (t) out.push(<div key={k++} className="md-pre"><Inline text={t} /></div>);
    }
  }
  return <>{out}</>;
}

export function TextLines({ lines }: { lines: string[] }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}><Inline text={l} /></li>)}</ul>);
    list = [];
  };
  for (const l of lines) {
    if (/^\s*-\s+/.test(l)) list.push(l.replace(/^\s*-\s+/, ""));
    else { flush(); out.push(<p key={out.length}><Inline text={l} /></p>); }
  }
  flush();
  return <>{out}</>;
}
