#!/usr/bin/env python3
"""React app/*.json 에 직접 들어간 키와 코드에만 있는 키를 모아, 시트(BA-FE 탭·FE CUE 시트)에 빠진 것만 TSV 행으로 낸다.

사용: python3 -I i18n_sheet_rows.py <react 저장소> <cue 저장소> <커밋...> [-- 키=ko|en|ja ...]
- 커밋: develop 의 커밋 해시. 그 커밋이 app/{ko,en,ja}.json 에 더하거나 바꾼 말단 키를 모은다.
- `--` 뒤: 코드에만 있는 키(예: translateRuntime 기본값)를 직접 넣는다.
"""
import json
import re
import subprocess
import sys

LANGS = ('ko', 'en', 'ja')


def show(repo, ref, path):
    out = subprocess.run(['git', '-C', repo, 'show', f'{ref}:{path}'], capture_output=True, text=True)
    return out.stdout if out.returncode == 0 else ''


def flat(d, prefix=''):
    for k, v in d.items():
        key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            yield from flat(v, key)
        else:
            yield key, v


def main():
    react, cue, *rest = sys.argv[1:]
    commits, extra = (rest[:rest.index('--')], rest[rest.index('--') + 1:]) if '--' in rest else (rest, [])
    keys = {}  # key -> {lang: value}
    for c in commits:
        for l in LANGS:
            before = dict(flat(json.loads(show(react, f'{c}~1', f'src/i18n/messages/app/{l}.json') or '{}')))
            after = dict(flat(json.loads(show(react, c, f'src/i18n/messages/app/{l}.json') or '{}')))
            for k, v in after.items():
                if before.get(k) != v:
                    keys.setdefault(k, {})[l] = v
    for e in extra:
        k, vals = e.split('=', 1)
        keys[k] = dict(zip(LANGS, vals.split('|')))

    root = {l: dict(flat(json.loads(show(react, 'origin/develop', f'src/i18n/messages/{l}.json')))) for l in LANGS}
    cue_dict = {}
    for l in LANGS:
        text = show(cue, 'origin/develop', f'apps/cue/src/lib/i18n/generated/{l}.ts')
        cue_dict[l] = dict(re.findall(r"^\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'", text, re.M))

    ba_fe, fe_cue, done = [], [], []
    for k, v in sorted(keys.items()):
        vals = [v.get(l, '') for l in LANGS]
        if k.startswith('react.'):
            if not all(root[l].get(k) for l in LANGS):
                ns, last = k.rsplit('.', 1)
                ba_fe.append('\t'.join([ns, last, *vals]))
            else:
                done.append(f'BA-FE 있음 {k}')
        if not all(cue_dict[l].get(k) for l in LANGS):
            fe_cue.append('\t'.join([k, *vals]))
        else:
            done.append(f'FE CUE 있음 {k}')
    print('### BA-FE'); print('\n'.join(ba_fe))
    print('### FE CUE'); print('\n'.join(fe_cue))
    print('### 이미 있음'); print('\n'.join(done))


if __name__ == '__main__':
    main()
