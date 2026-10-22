#!/usr/bin/env python3
"""bredy_app 에뮬레이터 스모크 테스트용 adb 헬퍼.

사용: droid.py [-s SERIAL] <명령> [인자]
  preflight                    에뮬레이터·Metro·bredy_app HEAD·API 대상 점검 (-s 불필요)
  launch [--port 8081]         dev client 를 Metro 최신 번들로 재시작하고 첫 화면까지 대기(최대 180초)
  ui [정규식]                   화면 요소: C=clickable  '텍스트' | '설명' [x1,y1][x2,y2] (원본 좌표)
  tap 라벨 [--re] [--nth N]     텍스트/설명이 라벨과 같은(--re: 정규식) 요소를 탭. 키보드는 먼저 내림
  wait 라벨 [--re] [--timeout S] 라벨이 보일 때까지 대기 (기본 15초)
  type 문자열                   영문 입력(공백 자동 변환). 한글은 adb 로 못 친다
  key 이름                      키 이벤트 (BACK, ENTER ...)
  hidekb                       키보드가 떠 있으면 BACK 으로 내림
  scroll down|up               화면 스크롤
  shot 이름                     스크린샷 → $SMOKE_DIR/이름_s.png (1/3 축소: 좌표 ×3 = 원본)
  logs                         launch 이후 ReactNativeJS 경고·에러 로그

환경 변수: ANDROID_HOME(기본 ~/Library/Android/sdk), BREDY_APP_DIR(기본 ~/Desktop/pro/bredy_app),
SMOKE_DIR(기본 /tmp/smoke)
"""
import argparse
import html
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse

SDK = os.path.expanduser(os.environ.get("ANDROID_HOME", "~/Library/Android/sdk"))
ADB = os.path.join(SDK, "platform-tools", "adb")
if not os.path.exists(ADB):
    ADB = shutil.which("adb") or "adb"
APP_DIR = os.path.expanduser(os.environ.get("BREDY_APP_DIR", "~/Desktop/pro/bredy_app"))
SMOKE_DIR = os.environ.get("SMOKE_DIR", "/tmp/smoke")
PKG = "app.bredy.mobile"
DEV_CLIENT_SCHEME = "exp+bredyapp"
ERROR_SCREEN = re.compile(
    r"Render Error|Uncaught|TypeError|ReferenceError|SyntaxError|Unable to resolve"
    r"|There was a problem|Something went wrong|Could not connect"
)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def adb(serial, *args):
    return run([ADB] + (["-s", serial] if serial else []) + list(args))


def nodes(serial, tries=4):
    # 덤프가 실패하면(null root node 등) 이전 파일이 남아 지난 화면을 읽게 되므로 매번 지우고 성공했을 때만 읽는다
    xml = ""
    for _ in range(tries):
        xml = adb(serial, "exec-out", "rm -f /sdcard/smoke_ui.xml; uiautomator dump /sdcard/smoke_ui.xml"
                  " >/dev/null 2>&1 && cat /sdcard/smoke_ui.xml")
        if "<hierarchy" in xml:
            break
        time.sleep(0.8)

    def attr(node, key):
        m = re.search(r' %s="([^"]*)"' % key, node)
        return html.unescape(m.group(1)) if m else ""

    out = []
    for m in re.finditer(r"<node [^>]*>", xml):
        n = m.group(0)
        b = [int(v) for v in re.findall(r"-?\d+", attr(n, "bounds"))]
        out.append({
            "text": attr(n, "text"),
            "desc": attr(n, "content-desc"),
            "click": attr(n, "clickable") == "true",
            "b": tuple(b) if len(b) == 4 else (0, 0, 0, 0),
        })
    return out


def visible(n):
    x1, y1, x2, y2 = n["b"]
    return x2 > x1 and y2 > y1


def fmt(n):
    x1, y1, x2, y2 = n["b"]
    return "%s%r | %r [%d,%d][%d,%d]" % ("C " if n["click"] else "  ", n["text"], n["desc"], x1, y1, x2, y2)


def warn_error_screen(ns):
    hits = [n["text"] or n["desc"] for n in ns if ERROR_SCREEN.search(n["text"] or n["desc"])]
    if hits:
        print("⚠ 오류 화면 감지: " + " / ".join(hits[:3]))
    return bool(hits)


def find(ns, label, regex, nth=0):
    if regex:
        pat = re.compile(label)
        hits = [n for n in ns if visible(n) and (pat.search(n["text"]) or pat.search(n["desc"]))]
    else:
        hits = [n for n in ns if visible(n) and label in (n["text"], n["desc"])]
    hits.sort(key=lambda n: not n["click"])  # clickable 우선 (안정 정렬)
    return hits[nth] if len(hits) > nth else None


def kb_shown(serial):
    return "mInputShown=true" in adb(serial, "shell", "dumpsys", "input_method")


def hide_kb(serial):
    if kb_shown(serial):
        adb(serial, "shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(0.6)
        return True
    return False


def screen_size(serial):
    m = re.search(r"(\d+)x(\d+)", adb(serial, "shell", "wm", "size"))
    return (int(m.group(1)), int(m.group(2))) if m else (1080, 2400)


def cmd_preflight(_args):
    lines = adb(None, "devices").splitlines()[1:]
    serials = [l.split()[0] for l in lines if l.strip().endswith("device")]
    if not serials:
        print("에뮬레이터 없음 — `%s/emulator/emulator -avd bredy_pixel &` 로 띄운다" % SDK)
    for s in serials:
        avd = adb(s, "shell", "getprop", "ro.boot.qemu.avd_name").strip()
        top = re.search(r"topResumedActivity=ActivityRecord\{\S+ \S+ (\S+)", adb(s, "shell", "dumpsys", "activity", "activities"))
        app = "설치됨" if ("package:" + PKG) in adb(s, "shell", "pm", "list", "packages", PKG) else "미설치"
        rev = ",".join(re.findall(r"tcp:(\d+) tcp", adb(s, "reverse", "--list"))) or "-"
        print("%s  avd=%s  앞화면=%s  앱=%s  reverse=%s" % (s, avd, top.group(1) if top else "?", app, rev))

    metro = []
    for line in run(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]).splitlines():
        m = re.match(r"node\s+(\d+)\s.*TCP \S*:(80[89]\d) \(LISTEN\)", line)
        if m:
            pid, port = m.groups()
            cmd = run(["ps", "-o", "command=", "-p", pid]).strip()
            cwd = next((l[1:] for l in run(["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"]).splitlines() if l.startswith("n")), "?")
            metro.append(port)
            print("Metro :%s  pid=%s  dev-client=%s  cwd=%s" % (port, pid, "--dev-client" in cmd, cwd))
    if not metro:
        print("Metro 없음 — `cd %s && npx expo start --dev-client --port 8081` 을 백그라운드로 띄운다" % APP_DIR)

    branch = run(["git", "-C", APP_DIR, "branch", "--show-current"]).strip()
    head = run(["git", "-C", APP_DIR, "log", "--oneline", "-1"]).strip()
    dirty = len(run(["git", "-C", APP_DIR, "status", "--short"]).splitlines())
    print("bredy_app  %s  %s  미커밋 %d개" % (branch, head, dirty))

    env = {}
    for name in (".env", ".env.local"):
        path = os.path.join(APP_DIR, name)
        if os.path.exists(path):
            for line in open(path, encoding="utf-8"):
                m = re.match(r"\s*(EXPO_PUBLIC_(?:API_BASE_URL|APP_ENV))\s*=\s*(\S+)", line)
                if m:
                    env[m.group(1)] = m.group(2).strip("'\"")
    base, app_env = env.get("EXPO_PUBLIC_API_BASE_URL", "?"), env.get("EXPO_PUBLIC_APP_ENV", "?")
    print("API  %s  APP_ENV=%s" % (base, app_env))
    if app_env.lower() in ("production", "prod") or "dev" not in base:
        print("⚠ API 대상이 dev 가 아닐 수 있다 — 테스트 데이터가 운영에 쌓이지 않게 멈추고 사용자에게 묻는다")


def cmd_launch(args):
    s, port = args.serial, args.port
    adb(s, "reverse", "tcp:%d" % port, "tcp:%d" % port)
    adb(s, "logcat", "-c")
    adb(s, "shell", "am", "force-stop", PKG)
    url = urllib.parse.quote("http://127.0.0.1:%d" % port, safe="")
    adb(s, "shell", "am start -a android.intent.action.VIEW -d '%s://expo-development-client/?url=%s' %s"
        % (DEV_CLIENT_SCHEME, url, PKG))
    t0 = time.time()
    deadline = t0 + args.timeout
    # dev 콜드 스타트는 번들·폰트를 Metro 에서 받느라 1분 넘게 걸리기도 한다. JS 시작은 화면 덤프보다 가벼운 logcat 으로 기다린다
    while time.time() < deadline and 'Running "main"' not in adb(s, "logcat", "-d", "-s", "ReactNativeJS"):
        time.sleep(1)
    js_at = time.time() - t0
    # 첫 렌더는 safe-area 여백 없이 그려졌다가 다시 배치되므로, 기준 요소 위치가 두 번 연속 같을 때 완료로 본다
    prev = None
    while time.time() < deadline:
        ns = nodes(s, tries=1)
        if warn_error_screen(ns):
            sys.exit(1)
        anchor = next((n for n in ns if n["text"] == "브리디" or n["desc"] in ("홈", "마이페이지")), None)
        key = (anchor["text"], anchor["desc"], anchor["b"]) if anchor else None
        if key and key == prev:
            print("%s: JS 시작 %.0f초, 첫 화면 %.0f초 %s" % (s, js_at, time.time() - t0, fmt(anchor).strip()))
            return
        prev = key
        time.sleep(2)
    print("%s: %d초 안에 첫 화면이 안 떴다 — Metro 로그와 화면을 확인한다" % (s, args.timeout))
    sys.exit(1)


def cmd_ui(args):
    ns = nodes(args.serial)
    warn_error_screen(ns)
    pat = re.compile(args.pattern) if args.pattern else None
    for n in ns:
        if (n["text"] or n["desc"]) and (not pat or pat.search(n["text"]) or pat.search(n["desc"])):
            print(fmt(n))


def cmd_tap(args):
    s = args.serial
    if hide_kb(s):
        print("키보드 내림")
    ns = nodes(s)
    warn_error_screen(ns)
    n = find(ns, args.label, args.re, args.nth)
    if not n:
        print("못 찾음: %r — 화면 밖이면 `scroll down`, 라벨은 `ui` 로 확인" % args.label)
        sys.exit(1)
    x1, y1, x2, y2 = n["b"]
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    adb(s, "shell", "input", "tap", str(cx), str(cy))
    print("탭 (%d,%d) %s" % (cx, cy, fmt(n).strip()))
    time.sleep(args.after)


def cmd_wait(args):
    deadline = time.time() + args.timeout
    while True:
        ns = nodes(args.serial)
        n = find(ns, args.label, args.re)
        if n:
            print("보임 " + fmt(n).strip())
            return
        if warn_error_screen(ns) or time.time() > deadline:
            print("%d초 안에 안 보임: %r" % (args.timeout, args.label))
            sys.exit(1)
        time.sleep(1)


def cmd_type(args):
    if not re.fullmatch(r"[A-Za-z0-9 .,_:@-]+", args.text):
        sys.exit("영문·숫자·공백·._,:@- 만 칠 수 있다 (adb input text 는 한글 불가)")
    adb(args.serial, "shell", "input text '%s'" % args.text.replace(" ", "%s"))
    print("입력: " + args.text)


def cmd_key(args):
    adb(args.serial, "shell", "input", "keyevent", "KEYCODE_" + args.name.upper())


def cmd_hidekb(args):
    print("키보드 내림" if hide_kb(args.serial) else "키보드 없음")


def cmd_scroll(args):
    w, h = screen_size(args.serial)
    a, b = (int(h * 0.7), int(h * 0.3)) if args.direction == "down" else (int(h * 0.3), int(h * 0.7))
    adb(args.serial, "shell", "input", "swipe", str(w // 2), str(a), str(w // 2), str(b), "300")
    time.sleep(0.6)


def cmd_shot(args):
    os.makedirs(SMOKE_DIR, exist_ok=True)
    full = os.path.join(SMOKE_DIR, args.name + ".png")
    small = os.path.join(SMOKE_DIR, args.name + "_s.png")
    with open(full, "wb") as f:
        subprocess.run([ADB, "-s", args.serial, "exec-out", "screencap", "-p"], stdout=f, check=True)
    subprocess.run(["sips", "-Z", "800", full, "--out", small], capture_output=True)
    print(small if os.path.exists(small) else full)


def cmd_logs(args):
    out = adb(args.serial, "logcat", "-d", "-v", "brief", "ReactNativeJS:W", "*:S")
    lines = [l for l in out.splitlines() if l[:2] in ("W/", "E/")]
    print("\n".join(lines[-40:]) if lines else "ReactNativeJS 경고·에러 없음")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("-s", "--serial", default=os.environ.get("ANDROID_SERIAL"))
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("preflight").set_defaults(fn=cmd_preflight)
    sp = sub.add_parser("launch")
    sp.add_argument("--port", type=int, default=8081)
    sp.add_argument("--timeout", type=int, default=180)
    sp.set_defaults(fn=cmd_launch)
    sp = sub.add_parser("ui")
    sp.add_argument("pattern", nargs="?")
    sp.set_defaults(fn=cmd_ui)
    sp = sub.add_parser("tap")
    sp.add_argument("label")
    sp.add_argument("--re", action="store_true")
    sp.add_argument("--nth", type=int, default=0)
    sp.add_argument("--after", type=float, default=0.8, help="탭 후 대기 초")
    sp.set_defaults(fn=cmd_tap)
    sp = sub.add_parser("wait")
    sp.add_argument("label")
    sp.add_argument("--re", action="store_true")
    sp.add_argument("--timeout", type=int, default=15)
    sp.set_defaults(fn=cmd_wait)
    sp = sub.add_parser("type")
    sp.add_argument("text")
    sp.set_defaults(fn=cmd_type)
    sp = sub.add_parser("key")
    sp.add_argument("name")
    sp.set_defaults(fn=cmd_key)
    sub.add_parser("hidekb").set_defaults(fn=cmd_hidekb)
    sp = sub.add_parser("scroll")
    sp.add_argument("direction", choices=["down", "up"])
    sp.set_defaults(fn=cmd_scroll)
    sp = sub.add_parser("shot")
    sp.add_argument("name")
    sp.set_defaults(fn=cmd_shot)
    sub.add_parser("logs").set_defaults(fn=cmd_logs)
    args = p.parse_args()
    if args.cmd != "preflight" and not args.serial:
        p.error("-s SERIAL 이 필요하다 (preflight 로 확인)")
    args.fn(args)


if __name__ == "__main__":
    main()
