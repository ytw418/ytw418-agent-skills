#!/usr/bin/env python3
"""Per-question token usage for Claude Code transcripts (~/.claude/projects/*/*.jsonl).

usage.py                             -> newest transcript of the current directory's project
usage.py <transcript.jsonl>          -> per-question table + group breakdown (JSON at the end)
usage.py --recent <days> [glob]      -> per-question stats across recent transcripts
                                        (glob defaults to every project)
"""
import glob
import json
import os
import re
import statistics
import sys
import time

PROJECTS = os.path.expanduser('~/.claude/projects')

W_IN, W_READ, W_WRITE, W_OUT = 1.0, 0.1, 2.0, 5.0

# attachment types whose text is actually injected into the model's context
SENT_ATTACH = {
    'deferred_tools_delta', 'agent_listing_delta', 'mcp_instructions_delta', 'skill_listing',
    'instructions', 'session_context', 'date', 'environment', 'hook_additional_context',
    'nested_memory', 'todo_reminder', 'plan_mode', 'diagnostics', 'selected_lines_in_ide',
    'opened_file_in_ide', 'queued_command', 'memory', 'edited_text_file', 'file', 'directory',
}

CONNECTOR_NAMES = {
    '1a59c906-04da-521d-bda7-7f71b9f9e01c': 'Claude Docs',
    '5b78127c-6a96-4af2-ae71-bf014a7e5131': 'Figma',
    'a61cb1bc-d8d5-4aaf-aef3-bd9ede72fce9': 'Jira/Confluence',
    '0b601002-209c-4be5-b9f8-dc05e9b5fc1f': 'Slack',
    '12cb831e-4bd9-4b49-8cd5-e6f6822941d0': 'Vercel',
    'f8fd87a5-6385-41fc-9cec-cc2740cbfcd2': 'Calendar',
    '6f616b42-0ed8-571e-823f-ee4aca6b7ce9': 'Chart widget',
    'visualize': 'Chart widget',
    'atlassian': 'Jira/Confluence',
    'Figma': 'Figma',
    'plugin_figma_figma': 'Figma',
    'Claude_Browser': 'Built-in browser',
    'ccd_session_mgmt': 'Desktop app tools',
    'ccd_session': 'Desktop app tools',
    'ccd_view': 'Desktop app tools',
    'ccd_pr': 'Desktop app tools',
    'computer-use': 'Computer use',
    'Control_Chrome': 'Chrome control',
}

INSTR = "Claude's instructions"
CHAT = 'Your messages & Claude thinking/replies'


def tool_group(name):
    if not name:
        return CHAT
    if name.startswith('mcp__claude-in-chrome__'):
        return 'Claude in Chrome'
    if name.startswith('mcp__'):
        server = name[5:].rsplit('__', 1)[0]
        return 'Connector: ' + CONNECTOR_NAMES.get(server, server)
    if name in ('WebSearch', 'WebFetch'):
        return 'Web research'
    if name in ('Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'NotebookEdit', 'LS'):
        return 'File operations'
    if name in ('Agent', 'Task', 'SendMessage', 'Workflow'):
        return 'Subagents'
    if name in ('Skill', 'ToolSearch'):
        return INSTR
    if name in ('Bash', 'BashOutput', 'KillShell', 'Monitor'):
        return 'Terminal commands'
    return 'Other tools'


def clen(x):
    if x is None:
        return 0
    if isinstance(x, str):
        return len(x)
    return len(json.dumps(x, ensure_ascii=False))


def eff(u):
    return (W_IN * u.get('input_tokens', 0) + W_READ * u.get('cache_read_input_tokens', 0)
            + W_WRITE * u.get('cache_creation_input_tokens', 0) + W_OUT * u.get('output_tokens', 0))


def raw(u):
    return (u.get('input_tokens', 0) + u.get('cache_read_input_tokens', 0)
            + u.get('cache_creation_input_tokens', 0) + u.get('output_tokens', 0))


def load(path):
    rows = []
    with open(path, errors='replace') as fh:
        for line in fh:
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows


def is_question(d):
    if d.get('type') != 'user' or d.get('isMeta') or d.get('isSidechain') or 'toolUseResult' in d:
        return False
    c = (d.get('message') or {}).get('content')
    if isinstance(c, list):
        if any(isinstance(b, dict) and b.get('type') == 'tool_result' for b in c):
            return False
        c = ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    c = (c or '').strip()
    if c.startswith('<local-command') or c.startswith('<command-name>/clear') or not c:
        return False
    return True


def question_text(d):
    c = (d.get('message') or {}).get('content')
    if isinstance(c, list):
        c = ' '.join(b.get('text', '') for b in c if isinstance(b, dict))
    c = c or ''
    while '<system-reminder>' in c and '</system-reminder>' in c:
        a, b = c.index('<system-reminder>'), c.index('</system-reminder>') + len('</system-reminder>')
        c = c[:a] + c[b:]
    return ' '.join(c.split())


def analyze(path):
    """Return (questions, groups, subagents). questions: list of dicts with usage sums."""
    rows = load(path)
    tool_names = {}  # tool_use_id -> tool name
    questions = []
    cur = None
    groups = {}
    pieces = {}  # group -> est tokens currently sitting in context
    new_pieces = {}  # group -> chars of inputs added since last call
    prev_ctx, prev_out_blocks, prev_out = 0, {}, 0
    seen = {}

    def add(g, v):
        if v:
            groups[g] = groups.get(g, 0.0) + v

    def spread(cost, weights, fallback):
        tot = sum(weights.values())
        if tot <= 0:
            add(fallback, cost)
            return
        for g, w in weights.items():
            add(g, cost * w / tot)

    # merge split assistant lines (same message id) first
    merged, order = {}, []
    for d in rows:
        if d.get('isSidechain'):
            continue
        t = d.get('type')
        if t == 'assistant':
            m = d.get('message') or {}
            mid = m.get('id') or d.get('uuid')
            if mid not in merged:
                merged[mid] = {'usage': m.get('usage') or {}, 'blocks': [], 'ts': d.get('timestamp')}
                order.append(('a', mid))
            else:
                u = m.get('usage') or {}
                if u.get('output_tokens', 0) > merged[mid]['usage'].get('output_tokens', 0):
                    merged[mid]['usage'] = u
            merged[mid]['blocks'] += [b for b in (m.get('content') or []) if isinstance(b, dict)]
        else:
            order.append(('r', d))

    for kind, item in order:
        if kind == 'r':
            d = item
            t = d.get('type')
            if t == 'user':
                if is_question(d):
                    cur = {'text': question_text(d), 'ts': d.get('timestamp'), 'calls': 0,
                           'in': 0, 'read': 0, 'write': 0, 'out': 0, 'eff': 0.0, 'sub_eff': 0.0, 'sub_raw': 0}
                    questions.append(cur)
                    new_pieces[CHAT] = new_pieces.get(CHAT, 0) + clen(cur['text'])
                else:
                    c = (d.get('message') or {}).get('content')
                    if isinstance(c, list):
                        for b in c:
                            if not isinstance(b, dict):
                                continue
                            if b.get('type') == 'tool_result':
                                g = tool_group(tool_names.get(b.get('tool_use_id')))
                                new_pieces[g] = new_pieces.get(g, 0) + clen(b.get('content'))
                            else:
                                new_pieces[INSTR] = new_pieces.get(INSTR, 0) + clen(b.get('text'))
                    else:
                        new_pieces[INSTR] = new_pieces.get(INSTR, 0) + clen(c)
            elif t == 'attachment':
                a = d.get('attachment') or {}
                if a.get('type') in SENT_ATTACH:
                    new_pieces[INSTR] = new_pieces.get(INSTR, 0) + clen(a) * 0.6
            continue

        m = merged[item]
        u = m['usage']
        if u.get('output_tokens') is None and not u:
            continue
        if cur is None:
            cur = {'text': '(session start)', 'ts': m['ts'], 'calls': 0, 'in': 0, 'read': 0,
                   'write': 0, 'out': 0, 'eff': 0.0, 'sub_eff': 0.0, 'sub_raw': 0}
            questions.append(cur)
        i_, r_, w_, o_ = (u.get('input_tokens', 0), u.get('cache_read_input_tokens', 0),
                          u.get('cache_creation_input_tokens', 0), u.get('output_tokens', 0))
        cur['calls'] += 1
        cur['in'] += i_; cur['read'] += r_; cur['write'] += w_; cur['out'] += o_
        cur['eff'] += eff(u)
        ctx = i_ + r_ + w_

        # --- attribute the input side ---
        if prev_ctx == 0 or ctx < prev_ctx * 0.7:  # first call or after compaction: reset
            pieces = {INSTR: float(ctx)}
            add(INSTR, W_IN * i_ + W_READ * r_ + W_WRITE * w_)
        else:
            fresh = max(ctx - prev_ctx, 0)
            out_part = min(prev_out, fresh)
            in_part = fresh - out_part
            fresh_by_group = {}
            tot = sum(prev_out_blocks.values())
            for g, w in prev_out_blocks.items():
                fresh_by_group[g] = fresh_by_group.get(g, 0) + (out_part * w / tot if tot else 0)
            tot = sum(new_pieces.values())
            for g, w in new_pieces.items():
                fresh_by_group[g] = fresh_by_group.get(g, 0) + (in_part * w / tot if tot else 0)
            if not fresh_by_group:
                fresh_by_group = {CHAT: fresh}
            written = i_ + w_
            write_cost = W_IN * i_ + W_WRITE * w_
            if written > fresh * 1.2 + 500 and written > 0:  # cache expired: old context rewritten too
                new_share = fresh / written
                spread(write_cost * new_share, fresh_by_group, CHAT)
                spread(write_cost * (1 - new_share), pieces, INSTR)
            else:
                spread(write_cost, fresh_by_group, CHAT)
            spread(W_READ * r_, pieces, INSTR)
            for g, v in fresh_by_group.items():
                pieces[g] = pieces.get(g, 0) + v
        new_pieces = {}

        # --- attribute the output side ---
        blocks = {}
        for b in m['blocks']:
            if b.get('type') == 'tool_use':
                tool_names[b.get('id')] = b.get('name')
                g = tool_group(b.get('name'))
                blocks[g] = blocks.get(g, 0) + clen(b.get('input')) + 40
            elif b.get('type') == 'thinking':
                blocks[CHAT] = blocks.get(CHAT, 0) + max(clen(b.get('thinking')), 200)
            else:
                blocks[CHAT] = blocks.get(CHAT, 0) + clen(b.get('text'))
        spread(W_OUT * o_, blocks, CHAT)
        prev_ctx, prev_out_blocks, prev_out = ctx, blocks, o_

    # --- subagents ---
    subagents = []
    subdir = os.path.join(os.path.dirname(path), os.path.basename(path)[:-6], 'subagents')
    for sp in sorted(glob.glob(os.path.join(subdir, '*.jsonl'))):
        seen_ids, e, rw, first_ts, calls = set(), 0.0, 0, None, 0
        best = {}
        for d in load(sp):
            if d.get('type') != 'assistant':
                continue
            m = d.get('message') or {}
            mid = m.get('id') or d.get('uuid')
            u = m.get('usage') or {}
            if mid not in best or u.get('output_tokens', 0) > best[mid].get('output_tokens', 0):
                best[mid] = u
            first_ts = first_ts or d.get('timestamp')
        for u in best.values():
            e += eff(u); rw += raw(u); calls += 1
        if calls:
            subagents.append({'file': os.path.basename(sp), 'calls': calls, 'eff': e, 'raw': rw, 'ts': first_ts})
            add('Subagents', e)
            # charge it to the question that was running at that time
            target = None
            for q in questions:
                if q['ts'] and first_ts and q['ts'] <= first_ts:
                    target = q
            if target:
                target['sub_eff'] += e; target['sub_raw'] += rw
    return questions, groups, subagents


def fmt(n):
    return f'{int(round(n)):,}'


def current_transcript():
    """Newest transcript of the project Claude Code derives from the working directory."""
    project = os.path.join(PROJECTS, re.sub(r'[^A-Za-z0-9]', '-', os.getcwd()))
    files = glob.glob(os.path.join(project, '*.jsonl'))
    if not files:
        sys.exit(f'no transcript found in {project} - pass a transcript path explicitly')
    return max(files, key=os.path.getmtime)


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ('-h', '--help'):
        print(__doc__)
        return
    if len(sys.argv) > 1 and sys.argv[1] == '--recent':
        days = float(sys.argv[2]) if len(sys.argv) > 2 else 7
        pattern = sys.argv[3] if len(sys.argv) > 3 else os.path.join(PROJECTS, '*', '*.jsonl')
        cutoff = time.time() - days * 86400
        allq = []
        files = [p for p in glob.glob(pattern) if os.path.getmtime(p) >= cutoff]
        for p in files:
            try:
                qs, _, _ = analyze(p)
            except Exception as ex:  # keep going on odd files
                print('skip', p, ex, file=sys.stderr)
                continue
            since = time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(cutoff))
            for q in qs:
                if (q['ts'] or '') < since:  # long-lived sessions carry questions older than the window
                    continue
                if q['calls'] and q['eff'] + q['sub_eff'] > 0:  # drop /model-style commands that cost nothing
                    q['file'] = p
                    allq.append(q)
        tot_raw = [q['in'] + q['read'] + q['write'] + q['out'] + q['sub_raw'] for q in allq]
        tot_eff = [q['eff'] + q['sub_eff'] for q in allq]
        calls = [q['calls'] for q in allq]
        print(f'sessions={len(files)} questions={len(allq)}')
        if not allq:
            return
        def stats(name, xs):
            xs = sorted(xs)
            p = lambda f: xs[min(len(xs) - 1, int(len(xs) * f))]
            print(f'{name}: median={fmt(statistics.median(xs))} p25={fmt(p(.25))} p75={fmt(p(.75))} '
                  f'p90={fmt(p(.9))} max={fmt(xs[-1])} mean={fmt(statistics.mean(xs))} sum={fmt(sum(xs))}')
        stats('raw tokens / question', tot_raw)
        stats('effective tokens / question', tot_eff)
        stats('API calls / question', calls)
        stats('output tokens / question', [q['out'] for q in allq])
        buckets = [(0, 1), (2, 5), (6, 20), (21, 60), (61, 10**9)]
        for lo, hi in buckets:
            sel = [q for q in allq if lo <= q['calls'] <= hi]
            if sel:
                e = [q['eff'] + q['sub_eff'] for q in sel]
                r = [q['in'] + q['read'] + q['write'] + q['out'] + q['sub_raw'] for q in sel]
                print(f'  calls {lo}-{hi if hi < 10**9 else "+"}: n={len(sel)} median_eff={fmt(statistics.median(e))} '
                      f'median_raw={fmt(statistics.median(r))} share_of_eff={sum(e) / sum(tot_eff):.0%}')
        print('top 5 by effective:')
        for q in sorted(allq, key=lambda q: -(q['eff'] + q['sub_eff']))[:5]:
            print(f"  eff={fmt(q['eff'] + q['sub_eff'])} calls={q['calls']} {q['ts']} {q['text'][:60]!r}")
        return

    path = sys.argv[1] if len(sys.argv) > 1 else current_transcript()
    qs, groups, subs = analyze(path)
    print('TRANSCRIPT', path)
    print('PER QUESTION')
    for n, q in enumerate(qs, 1):
        r = q['in'] + q['read'] + q['write'] + q['out']
        print(f"Q{n} {q['text'][:50]!r}\n   calls={q['calls']} new_input={fmt(q['in'])} cache_write={fmt(q['write'])} "
              f"cache_read={fmt(q['read'])} output={fmt(q['out'])} | raw_total={fmt(r)} effective={fmt(q['eff'])}"
              f" subagent_eff={fmt(q['sub_eff'])}")
    print('GROUPS (effective)')
    tot = sum(groups.values())
    for g, v in sorted(groups.items(), key=lambda kv: -kv[1]):
        print(f'  {g}: {fmt(v)} ({v / tot:.0%})')
    print('total effective', fmt(tot))
    if subs:
        print('SUBAGENTS', len(subs))
        for s in subs:
            print(f"  {s['file']}: calls={s['calls']} eff={fmt(s['eff'])}")
    print(json.dumps({'groups': {g: round(v) for g, v in groups.items()}}, ensure_ascii=False))


if __name__ == '__main__':
    main()
