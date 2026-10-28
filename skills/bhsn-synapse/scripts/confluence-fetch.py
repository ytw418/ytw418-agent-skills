#!/usr/bin/env python3
"""CQL 로 찾은 컨플루언스 페이지 중 경로가 정규식에 맞는 것을 Markdown 으로 받아 <폴더>에 쓰고 목록.md 를 만든다.

인증은 환경변수 CONFLUENCE_URL·CONFLUENCE_USERNAME·CONFLUENCE_API_TOKEN, 없으면 ~/.claude.json 의 atlassian MCP 설정을 쓴다.
경로는 '스페이스 홈 > 상위 > …'(페이지 자신의 제목은 뺌)이고, 정규식을 주지 않으면 전부 받는다.
사용: uv run --no-project --with markdownify python -I confluence-fetch.py '<CQL>' <폴더> ['<경로 정규식>']
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from markdownify import markdownify


def creds():
    env = {k: os.environ.get(k) for k in ('CONFLUENCE_URL', 'CONFLUENCE_USERNAME', 'CONFLUENCE_API_TOKEN')}
    if not all(env.values()):
        env = json.loads((Path.home() / '.claude.json').read_text())['mcpServers']['atlassian']['env']
    return env['CONFLUENCE_URL'].rstrip('/'), env['CONFLUENCE_USERNAME'], env['CONFLUENCE_API_TOKEN']


def safe(name):
    return re.sub(r'[/\\:*?"<>|\n]', '_', name).strip()[:100] or '_'


def cell(text):
    return text.replace('|', '\\|')


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cql, out = sys.argv[1], Path(sys.argv[2]).expanduser()
    keep = re.compile(sys.argv[3]) if len(sys.argv) > 3 else None
    base, user, token = creds()
    auth = 'Basic ' + base64.b64encode(f'{user}:{token}'.encode()).decode()

    def get(url):
        req = urllib.request.Request(url, headers={'Authorization': auth})
        return json.load(urllib.request.urlopen(req, timeout=60))

    # 1단계: 메타데이터만 훑어 경로로 고른다.
    pages = []
    url = f'{base}/rest/api/content/search?' + urllib.parse.urlencode({'cql': cql, 'limit': 100, 'expand': 'ancestors,version'})
    while url:
        res = get(url)
        for c in res['results']:
            path = ' > '.join(a['title'] for a in c['ancestors'])
            if keep is None or keep.search(path):
                pages.append((c, path, res['_links']['base'] + c['_links']['webui']))
        nxt = res['_links'].get('next')
        url = res['_links']['base'] + nxt if nxt else None

    # 2단계: 고른 페이지만 본문을 받아 Markdown 으로 쓴다.
    rows, failed, used = [], 0, set()
    for c, path, link in pages:
        try:
            html = get(f"{base}/rest/api/content/{c['id']}?expand=body.export_view")['body']['export_view']['value']
        except urllib.error.URLError as e:
            failed += 1
            print(f"실패 {c['id']} {c['title']}: {e}", file=sys.stderr)
            continue
        # 요약용이라 본문 링크 주소·이미지는 뺀다(페이지 원문 링크는 머리말 url 에 남는다).
        md = re.sub(r'\n{3,}', '\n\n', markdownify(html, heading_style='ATX', strip=['a', 'img'])).strip()
        when = c['version']['when'][:10]
        f = out.joinpath(*[safe(a['title']) for a in c['ancestors']], safe(c['title']) + '.md')
        if f in used:
            f = f.with_name(f"{f.stem} ({c['id']}).md")
        used.add(f)
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(f"---\ntitle: {c['title']}\nurl: {link}\nupdated: {when}\npath: {path}\n---\n\n{md}\n", encoding='utf-8')
        rows.append((path, c['title'], when, link, len(md)))

    rows.sort()
    lines = ['| 경로 | 제목 | 수정일 |', '|---|---|---|']
    lines += [f'| {cell(p)} | [{cell(t)}]({l}) | {w} |' for p, t, w, l, _ in rows]
    (out / '목록.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(rows)}쪽, {sum(r[4] for r in rows):,}자 → {out} (실패 {failed})')


if __name__ == '__main__':
    main()
