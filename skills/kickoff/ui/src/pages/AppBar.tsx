import { BackIcon } from "../ui";

export function AppBar({ back, name, stamp, error, right }: { back?: boolean; name?: string; stamp: Date | null; error: string | null; right?: React.ReactNode }) {
  return (
    <div className="appbar">
      <div className="appbar-inner">
        {back && <a className="back" href="#/" aria-label="프로젝트 목록으로"><BackIcon /></a>}
        {name && <span className="name">{name}</span>}
        <span className="spacer" />
        <span className="stamp" title="4초마다 새로 읽어요">
          {error ? <span style={{ color: "var(--red)" }}>서버에 연결하지 못했어요</span> : stamp && <><span className="live-dot" /><span className="time">{stamp.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></>}
        </span>
        {right}
      </div>
    </div>
  );
}
