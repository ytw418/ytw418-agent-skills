import { useCallback, useEffect, useRef, useState } from "react";

/** 화면 폭 조건(예: "(max-width: 900px)")이 맞는지 */
export function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query), on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** #/ → 목록, #/p/<폴더>?tab=… → 프로젝트 */
export function useRoute() {
  const read = () => {
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, query = ""] = h.split("?");
    const m = path.match(/^\/p\/(.+)$/) ?? path.match(/^\/t\/(.+)$/); // 예전 주소(#/t/)도 받는다
    const tab = new URLSearchParams(query).get("tab");
    const safe = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
    return { slug: m ? safe(m[1]) : null, tab };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/**
 * 4초마다 다시 읽는다. 내용이 같으면 다시 그리지 않고, 글을 쓰는 중에는 건너뛴다.
 */
export function usePoll<T>(load: () => Promise<T>, deps: unknown[], ms = 4000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState<Date | null>(null);
  const sig = useRef("");
  const seq = useRef(0), applied = useRef(0); // 늦게 온 옛 응답이 새 데이터를 덮지 않게
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async (force = false) => {
    const a = document.activeElement;
    if (!force && a && a.tagName === "TEXTAREA") return;
    const my = ++seq.current;
    try {
      const d = await loadRef.current();
      if (my < applied.current) return;
      applied.current = my;
      setStamp(new Date());
      setError(null);
      const s = JSON.stringify(d);
      if (force || s !== sig.current) { sig.current = s; setData(d); }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    sig.current = "";
    setData(null);
    refresh(true);
    const id = setInterval(() => refresh(false), ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, stamp, refresh };
}

/** 이전 값과 비교해 바뀐 항목 id 를 잠깐 기억한다(반짝임·체크 애니메이션용) */
export function useChanged<T extends { id: string }>(items: T[], key: (t: T) => string, holdMs = 1600) {
  const prev = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Map(items.map((t) => [t.id, key(t)]));
    if (prev.current) {
      const diff = new Set<string>();
      now.forEach((v, id) => { if (prev.current!.has(id) && prev.current!.get(id) !== v) diff.add(id); });
      if (diff.size) {
        setChanged(diff);
        const t = setTimeout(() => setChanged(new Set()), holdMs);
        prev.current = now;
        return () => clearTimeout(t);
      }
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((t) => `${t.id}:${key(t)}`).join("|")]);
  return changed;
}
