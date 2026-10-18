"""브리디 자동화 크롬(CDP 9222)에 붙는 공용 도우미(파이썬). 사용: import bpw; SESSION = bpw.start("<사이트>")
→ playwright-cli -s=SESSION … 이 '자기 탭'에서만 돈다. 같은 사이트는 잠금으로 차례대로, 끝나면(atexit) 탭 닫고 연결만 끊는다."""
import atexit, os, shutil, subprocess, time

def _x(*a):
    return subprocess.run(["npx", "--yes", "--package", "@playwright/cli", "playwright-cli", *a], capture_output=True, text=True).stdout

def start(site):
    subprocess.run([os.path.expanduser("~/.local/bin/bredy-chrome")], check=True)
    os.makedirs("/tmp/bredy-chrome-locks", exist_ok=True)
    lock = f"/tmp/bredy-chrome-locks/{site}"
    while True:
        try:
            os.mkdir(lock); break
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(lock) > 1800: shutil.rmtree(lock, ignore_errors=True); continue
            except FileNotFoundError: continue
            time.sleep(2)
    s = f"job-{site}-{os.getpid()}"
    _x("attach", "--cdp=http://127.0.0.1:9222", f"--session={s}")
    _x(f"-s={s}", "tab-new", "about:blank")
    def end():
        _x(f"-s={s}", "tab-close"); _x(f"-s={s}", "detach"); shutil.rmtree(lock, ignore_errors=True)
    atexit.register(end)
    return s
