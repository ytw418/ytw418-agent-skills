#!/usr/bin/env python3
"""usage: publish.py <morning|lunch|evening> [--dry-run] [--head <말머리>]
SKILL 7~10단계(검사 → 한도 → 브라우저 → 등록 → 비로그인 확인 → 기록 → 브라우저 정리)를 한 번에 돌리고 결과를 JSON 한 개로 출력한다.
입력 파일은 prepare.py 가 알려 준 `<오늘폴더>/<slot>-title.txt`, `-body.txt`, `-sources.json`.

- 포그라운드로 실행한다(2~6분). Bash timeout 은 600000 으로 준다 — 백그라운드로 돌리고 알림을 기다리다 일정 세션이 끝나면 기록·확인이 빠진다(10-20·10-21 일정이 그렇게 끝났다).
- --dry-run: 검사 + 브라우저 + 글쓰기 화면에서 게시판·말머리·제목·본문 입력과 원문 대조까지만 하고 등록하지 않는다. 비로그인 확인·기록·표식도 하지 않는다.
- 끝나면(성공·실패·중단 모두) 자기 탭을 닫고 네이버 잠금을 푼다.
- 이 스크립트는 같은 칸을 두 번 올리지 않는다: 등록 성공 시 `<slot>-published.json` 을 남기고, 있으면 멈춘다.

종료 코드: 0 성공 / 1 그 밖의 실패 / 2 사람이 로그인해야 함 / 3 쉬는 칸 / 4 검사 실패(고쳐서 다시) / 5 한도·이미 올림 / 6 등록 실패(올라가지 않음) / 7 등록 확인 실패(올라갔을 수 있음 — 카페에서 먼저 확인)
JSON: ok stage message code dry_run slot board head kind title article_id url anon_visible logged lint{ok,notes} needs_human maybe_posted elapsed_sec log_file"""
import datetime, json, os, re, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
HOME = os.environ.get('ROBOT_CAFE_HOME', os.path.expanduser('~/Desktop/pro/robot-cafe'))
T0 = time.time()
DEADLINE = 570  # Bash 포그라운드 한도(600초) 안에서 끝낸다

args = sys.argv[1:]
slot = args[0] if args and not args[0].startswith('--') else ''
DRY = '--dry-run' in args
head_opt = args[args.index('--head') + 1] if '--head' in args else None
res = dict(ok=False, stage='start', message='', code=1, dry_run=DRY, slot=slot, board=None, head=None, kind=None, title=None,
           article_id=None, url=None, anon_visible=None, logged=False, lint=None, needs_human=False, maybe_posted=False,
           elapsed_sec=0, log_file=None)
LOG = None


def say(msg):
    print(f'[{time.time() - T0:5.0f}s] {msg}', file=sys.stderr, flush=True)


def finish(stage, code, message, **kw):
    res.update(stage=stage, code=code, ok=(code == 0), message=message, elapsed_sec=round(time.time() - T0), **kw)
    print(json.dumps(res, ensure_ascii=False))
    sys.exit(code)


def sh(*cmd, timeout=120, name=None):
    """자식 프로세스 그룹째 실행·시간 제한. (종료 코드, 출력) 반환. 출력은 로그 파일에도 덧붙인다."""
    timeout = max(5, min(timeout, DEADLINE - (time.time() - T0)))
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        out, _ = p.communicate(timeout=timeout)
        code = p.returncode
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        out, _ = p.communicate()
        code = 124
        out += f'\n(시간 초과 {int(timeout)}초 — 중단)'
    if LOG:
        with open(LOG, 'a') as f:
            f.write(f'\n$ {name or " ".join(cmd)}  -> {code}\n{out}')
    return code, out.strip()


if slot not in ('morning', 'lunch', 'evening'):
    finish('args', 1, 'usage: publish.py <morning|lunch|evening> [--dry-run] [--head <말머리>]')

code, out = sh(sys.executable, f'{HERE}/slot.py', slot, timeout=20)
plan = json.loads(out) if out.startswith('{') else {}
if code == 3 or plan.get('rest'):
    finish('plan', 3, '쉬는 칸 — 올리지 않는다')
board, kind, head = plan['board'], plan['kind'], head_opt if head_opt is not None else plan.get('head', '')
res.update(board=board, kind=kind, head=head)
if '|' in head:
    finish('head', 1, f'말머리 후보가 여러 개({head}) — --head 로 하나를 고른다')

D = f'{HOME}/content/{plan["date"]}'
T, B, S = f'{D}/{slot}-title.txt', f'{D}/{slot}-body.txt', f'{D}/{slot}-sources.json'
MARK = f'{D}/{slot}-published.json'
LOG = res['log_file'] = f'{D}/{slot}-publish.log'
open(LOG, 'a').write(f'\n===== {datetime.datetime.now():%F %T} publish {slot} dry={DRY} {board}/{head}/{kind}\n')
for f in (T, B):
    if not os.path.exists(f) or not open(f).read().strip():
        finish('files', 1, f'글 파일이 없거나 비었다: {f}')
title = open(T).read().strip()
res['title'] = title
if not DRY and os.path.exists(MARK):
    m = json.load(open(MARK))
    finish('already', 5, f'오늘 이 칸은 이미 올렸다: {m.get("url")}', article_id=m.get('article_id'), url=m.get('url'))

# 1) 검사
lint_cmd = [sys.executable, f'{HERE}/lint.py', T, B, '--kind', kind, '--fetch']
if kind not in ('talk', 'ask') and os.path.exists(S):
    lint_cmd += ['--sources', S]
say('검사(lint)')
code, out = sh(*lint_cmd, timeout=100)
notes = [l for l in out.split('\n') if l.strip()]
res['lint'] = dict(ok=(code == 0), notes=notes)
if code != 0:
    finish('lint', 4, '검사 실패 — 글을 고친 뒤 다시 실행: ' + ' / '.join(notes[-6:]))

# 2) 한도 (등록할 때만 막는다. dry-run 은 알리기만)
code, out = sh(sys.executable, f'{HERE}/history.py', 'today', board, timeout=20)
res['limit'] = out
if code == 1 and not DRY:
    finish('limit', 5, '한도에 걸림(하루 3개·2시간 간격·같은 게시판 하루 1개): ' + out)

# 3) 브라우저 → 4) 등록 → 5) 비로그인 확인 → 6) 기록. 어떤 경우든 마지막에 탭·잠금을 푼다.
try:
    say('브라우저 준비')
    code, out = sh(f'{HERE}/ensure-browser.sh', timeout=150)
    if code != 0:
        finish('browser', 2 if code == 2 else 1, '사람이 로그인해야 한다(캡차·2단계·저장된 비밀번호 없음): ' + out[-200:] if code == 2 else '브라우저 준비 실패: ' + out[-200:],
               needs_human=(code == 2))
    say('글쓰기 화면 입력' + (' (dry-run)' if DRY else ' → 등록'))
    cmd = [f'{HERE}/post.sh', board, T, B]
    if head:
        cmd += ['--head', head]
    if DRY:
        cmd += ['--dry-run']
    code, out = sh(*cmd, timeout=430)
    tail = out[-300:]
    if code == 3:
        finish('post', 6, '본문이 원문과 다르게 들어가 등록하지 않았다: ' + tail)
    if code == 4:
        finish('post', 6, '게시판·말머리·화면 문제로 등록하지 않았다: ' + tail)
    if code == 124:
        finish('post', 7, '등록 단계가 시간 초과 — 올라갔을 수 있으니 카페에서 먼저 확인', maybe_posted=True)
    if code == 5:
        finish('post', 7, '등록을 확인하지 못했다 — 올라갔을 수 있으니 카페에서 먼저 확인: ' + tail, maybe_posted=True)
    if code != 0:
        finish('post', 1, f'등록 스크립트 실패(종료 {code}): ' + tail)
    if DRY:
        links = re.search(r'링크 (\d+)개 / 미리보기 카드 (\d+)개 / 말머리 (.*)', out)
        finish('dry-run', 0, 'DRY RUN 통과 — 입력·원문 대조까지 됐고 등록하지 않았다' + (f' ({links.group(0)})' if links else ''))
    m_id, m_url = re.search(r'ARTICLE_ID=(\d+)', out), re.search(r'URL=(\S+)', out)
    if not m_id:
        finish('post', 7, '등록 결과에서 글 번호를 못 읽었다 — 카페에서 먼저 확인: ' + tail, maybe_posted=True)
    aid, url = m_id.group(1), m_url.group(1) if m_url else f'https://cafe.naver.com/ca-fe/cafes/16729678/articles/{m_id.group(1)}'
    res.update(article_id=aid, url=url)
    json.dump(dict(article_id=aid, url=url, board=board, title=title, at=datetime.datetime.now().isoformat(timespec='seconds')),
              open(MARK, 'w'), ensure_ascii=False)
    say(f'등록됨 {url}')
    probe = re.sub(r'\s+', ' ', title)[:24]
    anon = False
    for i in range(2):
        code, out = sh('node', f'{HERE}/anon-check.mjs', aid, probe, timeout=60)
        if code == 0:
            anon = True
            break
        time.sleep(8)
    res['anon_visible'] = anon
    note = f'lint 통과, 비로그인 확인 {"보임" if anon else "안 보임"}'
    if not os.path.exists(S):
        json.dump([], open(S, 'w'))
    code, out = sh(sys.executable, f'{HERE}/log.py', board, T, url, S, B, note, timeout=20)
    res['logged'] = (code == 0)
    if not anon:
        finish('anon', 1, '등록은 됐지만 비로그인 방문자 화면에서 글이 안 보인다 — 카페 공개 설정·게시판 권한 확인', maybe_posted=True)
    if code != 0:
        finish('log', 1, '등록은 됐지만 기록(log.py) 실패: ' + out[-200:])
    finish('done', 0, '등록·비로그인 확인·기록 완료')
finally:
    say('브라우저 정리')
    sh(f'{HERE}/release-browser.sh', timeout=40)
