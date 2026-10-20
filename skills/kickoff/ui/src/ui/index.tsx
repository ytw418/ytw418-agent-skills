// 토스 화면 구조(Top·ListHeader·ListRow·Badge·BottomSheet…)를 따라 직접 만든 컴포넌트
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

export type Tone = "grey" | "blue" | "orange" | "teal" | "green" | "red" | "yellow" | "fill-blue" | "fill-orange";

export function Badge({ tone = "grey", size, children }: { tone?: Tone; size?: "sm"; children: ReactNode }) {
  return <span className={`badge ${tone} ${size ?? ""}`}>{children}</span>;
}

export function Button({ variant = "fill", size = "md", full, on, className = "", ...rest }: {
  variant?: "fill" | "weak" | "light" | "danger-text"; size?: "sm" | "md" | "lg"; full?: boolean; on?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`btn ${variant} ${size} ${full ? "full" : ""} ${on ? "on" : ""} ${className}`} {...rest} />;
}

export function Top({ title, subtitle, lower, right }: { title: ReactNode; subtitle?: ReactNode; lower?: ReactNode; right?: ReactNode }) {
  return (
    <header className="top" style={{ display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="title">{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
        {lower && <div className="lower">{lower}</div>}
      </div>
      {right}
    </header>
  );
}

export function ListHeader({ title, right, description }: { title: ReactNode; right?: ReactNode; description?: ReactNode }) {
  return (
    <div className="list-header">
      <div>
        <div className="lh-title">{title}</div>
        {description && <div className="lh-desc">{description}</div>}
      </div>
      {right && <div className="lh-right">{right}</div>}
    </div>
  );
}

export function ListRow({ left, top, bottom, right, onClick, arrow, shine, as = "li" }: {
  left?: ReactNode; top: ReactNode; bottom?: ReactNode; right?: ReactNode; onClick?: () => void; arrow?: boolean; shine?: boolean; as?: "li" | "div";
}) {
  const Tag = as;
  const inner = (
    <>
      {left && <div className="lr-left">{left}</div>}
      <div className="lr-contents">
        <div className="lr-top">{top}</div>
        {bottom && <div className="lr-bottom">{bottom}</div>}
      </div>
      {right && <div className="lr-right">{right}</div>}
      {arrow && <Chevron />}
    </>
  );
  const cls = `list-row ${onClick ? "clickable" : ""} ${shine ? "shine" : ""}`;
  return onClick ? (
    <Tag className={cls} role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}>{inner}</Tag>
  ) : <Tag className={cls}>{inner}</Tag>;
}

export function SegmentedControl<T extends string>({ items, value, onChange, label }: { items: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button key={it.value} role="radio" aria-checked={value === it.value} className={value === it.value ? "on" : ""} onClick={() => onChange(it.value)}>{it.label}</button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} className={value === it.value ? "on" : ""} onClick={() => onChange(it.value)}>
          {it.label}{it.count ? <span className="count">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

/** 숫자가 0에서 목표값까지 올라간다 */
function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(a + (target - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function ProgressRing({ done, total, size = 96, stroke = 9, caption }: { done: number; total: number; size?: number; stroke?: number; caption?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const shown = useCountUp(pct);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setDrawn(pct)); return () => cancelAnimationFrame(id); }, [pct]);
  return (
    <div className={`ring ${total && done === total ? "done" : ""}`} style={{ width: size, height: size }} aria-label={`진행률 ${pct}%`}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <circle className="bar" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - drawn / 100)} />
      </svg>
      <div className="label">
        <b style={{ fontSize: size > 80 ? 24 : 13 }}>{shown}%</b>
        {caption && size > 80 && <span style={{ fontSize: 12 }}>{caption}</span>}
      </div>
    </div>
  );
}

export const Spinner = ({ large }: { large?: boolean }) => <span className={`spinner ${large ? "lg" : ""}`} aria-label="진행 중" role="img" />;
export const Pulse = () => <span className="pulse" aria-hidden />;

export function Check({ size = 20, draw }: { size?: number; draw?: boolean }) {
  return (
    <svg className={`check ${draw ? "draw" : ""}`} width={size} height={size} viewBox="0 0 20 20" aria-label="완료" role="img">
      <circle cx="10" cy="10" r="10" />
      <path d="M5.8 10.4l2.7 2.7 5.7-5.9" />
    </svg>
  );
}

export function Result({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="result">
      <div className="r-figure">{icon ?? <DocIcon />}</div>
      <div className="r-title">{title}</div>
      {description && <div className="r-desc">{description}</div>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ padding: "8px 24px" }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "14px 0" }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 20 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 16, width: "55%" }} />
            <div className="skeleton" style={{ height: 13, width: "35%", marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 열리면 포커스를 안으로 옮기고 Tab 을 가두고, 닫히면 원래 자리로 돌려준다 */
function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll<HTMLElement>('button, [href], textarea, input, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute("disabled"));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); before?.focus?.(); };
  }, [open]);
  return ref;
}

export function BottomSheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const ref = useFocusTrap(open, onClose);
  const id = useId();
  if (!open) return null;
  return (
    <>
      <div className="dimmer" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined} tabIndex={-1} ref={ref}>
        <div className="grabber" />
        {title && <div className="sheet-head"><div className="sheet-title" id={id}>{title}</div></div>}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

// 다이얼로그·토스트: 화면 어디서든 부를 수 있게 한 곳에서 관리한다
interface ConfirmOpts { title: string; description?: string; confirm: string; danger?: boolean }
const OverlayCtx = createContext<{ toast: (m: string) => void; confirm: (o: ConfirmOpts) => Promise<boolean> }>({
  toast: () => undefined, confirm: async () => false,
});
export const useOverlay = () => useContext(OverlayCtx);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const showToast = useCallback((msg: string) => {
    const id = Date.now();
    setToast({ id, msg });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2600);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };
  const dlgRef = useFocusTrap(!!dlg, () => close(false));
  return (
    <OverlayCtx.Provider value={{ toast: showToast, confirm }}>
      {children}
      {toast && <div className="toast-wrap" aria-live="polite"><div className="toast" key={toast.id}>{toast.msg}</div></div>}
      {dlg && (
        <>
          <div className="dimmer" onClick={() => close(false)} />
          <div className="dialog" role="alertdialog" aria-modal="true" tabIndex={-1} ref={dlgRef}>
            <div className="d-title">{dlg.title}</div>
            {dlg.description && <div className="d-desc">{dlg.description}</div>}
            <div className="d-actions">
              <Button variant="light" size="lg" onClick={() => close(false)}>닫기</Button>
              <Button variant="fill" size="lg" style={dlg.danger ? { background: "var(--red)" } : undefined} onClick={() => close(true)} autoFocus>{dlg.confirm}</Button>
            </div>
          </div>
        </>
      )}
    </OverlayCtx.Provider>
  );
}

// 아이콘(직접 그린 선 아이콘)
export const Chevron = () => (
  <svg className="arrow" width="20" height="20" viewBox="0 0 20 20" aria-hidden><path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><path d="M13.5 4.5L7 11l6.5 6.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const DocIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden><rect x="6" y="3.5" width="16" height="21" rx="3.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 10h8M10 14.5h8M10 19h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);
export const MoreIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden><circle cx="5" cy="11" r="1.8" fill="currentColor" /><circle cx="11" cy="11" r="1.8" fill="currentColor" /><circle cx="17" cy="11" r="1.8" fill="currentColor" /></svg>
);
export const Dot = ({ tone = "blue" }: { tone?: "blue" | "orange" | "grey" }) => (
  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: "none", background: tone === "blue" ? "var(--blue)" : tone === "orange" ? "var(--orange)" : "var(--ink-400)" }} />
);
export const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M3 3.5h10a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0113 11.5H7.5L4.5 14v-2.5H3A1.5 1.5 0 011.5 10V5A1.5 1.5 0 013 3.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
);
