#!/usr/bin/env python3
"""slack-send-guard.py 테스트. 가짜 대화 기록(transcript)을 만들고 훅처럼(JSON stdin) 불러 결정을 확인한다.

사용: python3 slack-send-guard_test.py   (실제 Slack 에는 아무것도 보내지 않는다)
"""
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "slack-send-guard.py")
TMP = tempfile.mkdtemp(prefix="slack-guard-test-")
STATE = os.path.join(TMP, "state.json")
ENV = dict(os.environ, SLACK_SEND_GUARD_STATE=STATE)
P = "mcp__claude_ai_Slack__"
SEND, SCHEDULE, DRAFT = P + "slack_send_message", P + "slack_schedule_message", P + "slack_send_message_draft"
MSG = "○○님, 말씀 주신 수신자용 API는 경로랑 응답 형태 정해지면 공유 부탁드려요!\nFE는 그 전까지 기존 API 기준으로 작업해 둘게요🙏"
INPUT = {"channel_id": "C0TEST", "thread_ts": "1792472166.965219", "message": MSG}
Q_THREAD = "#unit(C0TEST) 스레드 답글로 보낼까요?"
_n = [0]


def code_of(tool: str, tool_input: dict) -> str:
    out = subprocess.run([sys.executable, GUARD, "--code", tool], input=json.dumps(tool_input), capture_output=True, text=True, env=ENV)
    return out.stdout.strip()


def card(code: str, answer: str, text: str = MSG, *, question: str = Q_THREAD, preview="same", minutes_ago: int = 1,
         genuine: bool = True, header=None, labels=("보내기", "고치기", "보내지 않기"), result_extra=None, ts=None) -> list:
    """AskUserQuestion 호출(assistant)과 그 결과(user) 두 줄. 첫 선택지 설명(description)에 글을 넣는다."""
    _n[0] += 1
    tid = f"toolu_test{_n[0]}"
    first = {"label": labels[0], "description": text}
    if preview == "same":
        first["preview"] = text
    elif preview is not None:
        first["preview"] = preview
    options = [first] + [{"label": lab, "description": "다른 선택"} for lab in labels[1:]]
    q = {"question": question, "header": header or f"승인 {code}", "options": options, "multiSelect": False}
    if ts is None:
        ts = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutes_ago)).isoformat().replace("+00:00", "Z")
    call = {"type": "assistant", "timestamp": ts, "message": {"role": "assistant", "content": [
        {"type": "tool_use", "id": tid if genuine else "toolu_other", "name": "AskUserQuestion", "input": {"questions": [q]}}]}}
    result = {"type": "user", "userType": "external", "timestamp": ts,
              "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": tid, "content": "answered"}]},
              "toolUseResult": {"questions": [q], "answers": {question: answer}, **(result_extra or {})}}
    return [call, result]


def transcript(*groups, raw_lines=()) -> str:
    _n[0] += 1
    path = os.path.join(TMP, f"t{_n[0]}.jsonl")
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps({"type": "user", "message": {"role": "user", "content": "질문 보내줘"}}, ensure_ascii=False) + "\n")
        for line in raw_lines:
            f.write(line + "\n")
        for group in groups:
            for line in group:
                f.write(json.dumps(line, ensure_ascii=False) + "\n")
    return path


def run(tool: str, tool_input, path) -> tuple:
    payload = json.dumps({"tool_name": tool, "tool_input": tool_input, "transcript_path": path, "hook_event_name": "PreToolUse"})
    out = subprocess.run([sys.executable, GUARD], input=payload, capture_output=True, text=True, env=ENV)
    if out.returncode != 0:
        return "error", out.stderr[-300:]
    if not out.stdout.strip():
        return "allow", ""
    hso = json.loads(out.stdout)["hookSpecificOutput"]
    return hso["permissionDecision"], hso.get("permissionDecisionReason", "")


def approved(tool, tool_input, text=None, question=Q_THREAD, **kw):
    """입력에 맞는 정상 승인 카드가 있는 대화 기록."""
    return transcript(card(code_of(tool, tool_input), kw.pop("answer", "보내기"),
                           text if text is not None else tool_input.get("message", ""), question=question, **kw))


C = code_of(SEND, INPUT)
CASES = []


def case(name, expect, tool, tool_input, path, contains=None, before=None):
    CASES.append((name, expect, tool, tool_input, path, contains, before))


# ── 승인 없음 ──
case("승인 카드 없음 → 막고 코드를 알려 준다", "deny", SEND, INPUT, transcript(), f"승인 {C}")
case("대화 기록 경로 없음", "deny", SEND, INPUT, None)
# ── 정상 승인 ──
ok = transcript(card(C, "보내기"))
case("승인 카드에서 보내기", "allow", SEND, INPUT, ok)
case("같은 승인으로 두 번째 전송", "deny", SEND, INPUT, ok, "이미 한 번")
two = transcript(card(C, "보내기"), card(C, "보내기"))
case("승인 두 번이면 두 번까지", "allow", SEND, INPUT, two)
case("승인 두 번이면 두 번까지(2)", "allow", SEND, INPUT, two)
case("승인 두 번이면 세 번째는 막음", "deny", SEND, INPUT, two)
case("'보내기 (추천)' 선택지", "allow", SEND, INPUT, transcript(card(C, "보내기 (추천)", labels=("보내기 (추천)", "고치기"))))
case("preview 없이 설명만 있어도 통과(Paseo 카드)", "allow", SEND, INPUT, transcript(card(C, "보내기", preview=None)))
case("설명·preview 를 코드 블록·<pre>로 감싸도 통과", "allow", SEND, INPUT,
     transcript(card(C, "보내기", "```\n" + MSG.replace("\n", "\n\n") + "\n```", preview="<pre>" + MSG.replace("&", "&amp;") + "</pre>")))
code_msg = {"channel_id": "C0TEST", "message": "```\nGET /a/b\n```"}
case("글 자체가 코드 블록이어도 통과", "allow", SEND, code_msg, approved(SEND, code_msg, question="#unit(C0TEST)에 새 글로 보낼까요?"))
nothread = {"channel_id": "C0TEST", "message": MSG, "thread_ts": ""}
case("thread_ts 빈 값 = 새 글", "allow", SEND, nothread, approved(SEND, {"channel_id": "C0TEST", "message": MSG}, question="#unit(C0TEST)에 새 글로 보낼까요?"))
dm = {"channel_id": "U05TEST", "message": MSG}
case("DM", "allow", SEND, dm, approved(SEND, dm, question="○○님(U05TEST)께 DM으로 보낼까요?"))
# ── 본인 DM 은 승인 없이(아침 브리핑) ──
selfdm = {"channel_id": "U092LHJH732", "message": "📊 아침 브리핑\n• 방문자 125"}
case("본인 DM 은 승인 없이 보냄", "allow", SEND, selfdm, None)
case("본인 DM 채널 ID·스레드 답글도 승인 없이", "allow", SEND, {"channel_id": "D092LHKM2Q0", "thread_ts": "1792472166.965219", "message": "후속"}, None)
case("본인 DM 이라도 흔적은 막음", "deny", SEND, {**selfdm, "message": selfdm["message"] + "\n🤖 Generated with Claude"}, None, "흔적")
case("본인 DM 예약은 승인 필요", "deny", SCHEDULE, {**selfdm, "post_at": 1792500000}, transcript())
case("본인 DM 초안 지우기(draft_id)는 승인 필요", "deny", SEND, {**selfdm, "draft_id": "Dr0USER"}, transcript())
case("다른 사람 DM 은 그대로 승인 필요", "deny", SEND, {**selfdm, "channel_id": "U05TEST"}, transcript())
# ── 승인이 맞지 않음 ──
case("고치기를 고름", "deny", SEND, INPUT, transcript(card(C, "고치기")), "고른 답")
case("보내지 않기를 고름", "deny", SEND, INPUT, transcript(card(C, "보내지 않기")))
case("직접 입력에 '보내기 전에 고쳐줘'", "deny", SEND, INPUT, transcript(card(C, "보내기 전에 고쳐줘")))
case("승인 뒤 글을 바꿈", "deny", SEND, {**INPUT, "message": MSG + " 감사합니다!"}, transcript(card(C, "보내기")), "승인 코드는")
case("승인 뒤 채널을 바꿈", "deny", SEND, {**INPUT, "channel_id": "C0OTHER"}, transcript(card(C, "보내기")))
case("승인 뒤 스레드를 바꿈", "deny", SEND, {**INPUT, "thread_ts": "1700000000.000001"}, transcript(card(C, "보내기")))
case("승인 뒤 broadcast 를 켬", "deny", SEND, {**INPUT, "reply_broadcast": True}, transcript(card(C, "보내기")))
case("승인 뒤 draft_id 를 더함(사용자 초안 삭제)", "deny", SEND, {**INPUT, "draft_id": "Dr0USER"}, transcript(card(C, "보내기")))
case("승인 뒤 unfurl 을 켬", "deny", SEND, {**INPUT, "unfurl_app_links": True}, transcript(card(C, "보내기")))
case("설명에 보여 준 글이 다름", "deny", SEND, INPUT, transcript(card(C, "보내기", "다른 글", preview=None)), "설명")
case("설명은 짧은 글, preview·실제는 긴 글(Paseo 는 preview 안 보임)", "deny", SEND, INPUT,
     transcript(card(C, "보내기", "경로 공유 부탁드려요", preview=MSG)), "설명")
case("설명은 같고 preview 만 다름", "deny", SEND, INPUT, transcript(card(C, "보내기", preview="다른 글")), "preview")
case("카드에 더 긴 글을 보여 주고 일부만 보냄", "deny", SEND, INPUT, transcript(card(C, "보내기", MSG + "\n그리고 하나 더 여쭤봐요!")))
case("글이 고르지 않은 선택지에 있음", "deny", SEND, INPUT, transcript(card(C, "보내기", labels=("고치기", "보내기"))))
# ── 보낼 곳을 사용자에게 보여 줬는지 ──
case("질문에 채널 ID 가 없음", "deny", SEND, INPUT, transcript(card(C, "보내기", question="#unit 스레드 답글로 보낼까요?")), "채널 ID")
case("스레드 답글인데 질문엔 새 글", "deny", SEND, INPUT, transcript(card(C, "보내기", question="#unit(C0TEST)에 새 글로 보낼까요?")))
everyone = {"channel_id": "C0ALLCOMPANY", "message": MSG}
case("새 글인데 질문엔 스레드 답글이라고 함", "deny", SEND, everyone,
     approved(SEND, everyone, question="#unit(C0ALLCOMPANY) 스레드 답글로 보낼까요?"))
case("DM 인데 질문엔 새 글", "deny", SEND, dm, approved(SEND, dm, question="#unit(U05TEST)에 새 글로 보낼까요?"))
bc = {**INPUT, "reply_broadcast": True}
case("broadcast 인데 질문에 '채널에도' 없음", "deny", SEND, bc, approved(SEND, bc), "채널에도")
case("broadcast 를 질문에 적음", "allow", SEND, bc, approved(SEND, bc, question=Q_THREAD + " 채널에도 같이 올려요."))
# ── 메모·자동 진행·추가 질문 ──
case("보내기에 메모를 남김", "deny", SEND, INPUT,
     transcript(card(C, "보내기", result_extra={"annotations": {Q_THREAD: {"notes": "끝에 감사합니다 붙여서 보내줘"}}})), "메모")
case("자리 비움 자동 진행", "deny", SEND, INPUT, transcript(card(C, "보내기", result_extra={"afkTimeoutMs": 60000})), "자동")
case("추가 질문 요청", "deny", SEND, INPUT, transcript(card(C, "보내기", result_extra={"followUp": True, "response": "근데 이거 왜 보내?"})))
# ── 위조·시각 ──
case("AskUserQuestion 호출 없이 결과 줄만 있음", "deny", SEND, INPUT, transcript(card(C, "보내기", genuine=False)), "AskUserQuestion")
case("다른 코드의 승인", "deny", SEND, INPUT, transcript(card("abcdef", "보내기")))
case("코드 앞부분만 같은 header", "deny", SEND, INPUT, transcript(card(C, "보내기", header=f"승인 {C}0")))
case("승인한 지 3시간", "deny", SEND, INPUT, transcript(card(C, "보내기", minutes_ago=180)), "2시간")
case("미래 시각 승인", "deny", SEND, INPUT, transcript(card(C, "보내기", minutes_ago=-60 * 24 * 30)))
case("시간대 없는 시각", "deny", SEND, INPUT, transcript(card(C, "보내기", ts=dt.datetime.now().isoformat())))
case("기록에 이상한 줄이 있어도 정상 승인은 통과", "allow", SEND, INPUT,
     transcript(card(C, "보내기"), raw_lines=['["answers"]', '{"type":"user","message":"answers","toolUseResult":"x"}', "not json answers"]))


def corrupt_state():
    with open(STATE, "w") as f:
        f.write("{broken")


def reset_state():
    if os.path.exists(STATE):
        os.remove(STATE)


case("승인 기록 파일이 깨지면 막음(초기화로 승인 되살리기 방지)", "deny", SEND, INPUT, transcript(card(C, "보내기")), "오류", before=corrupt_state)
case("승인 기록 파일을 지운 뒤 새 승인은 통과", "allow", SEND, INPUT, transcript(card(C, "보내기")), before=reset_state)
# ── 한 카드 문항 2개 ──
m2 = {**INPUT, "message": "두 번째 글이에요"}
c2 = code_of(SEND, m2)
pair = card(C, "보내기")
second = card(c2, "보내기", m2["message"], question="#unit(C0TEST) 스레드 답글로 이것도 보낼까요?")
pair[1]["toolUseResult"]["questions"].append(second[1]["toolUseResult"]["questions"][0])
pair[1]["toolUseResult"]["answers"].update(second[1]["toolUseResult"]["answers"])
both = transcript(pair)
case("한 카드 문항 2개: 첫 글", "allow", SEND, INPUT, both)
case("한 카드 문항 2개: 둘째 글", "allow", SEND, m2, both)
# ── 예약·초안 ──
sched = {**INPUT, "post_at": 1792500000}
when = dt.datetime.fromtimestamp(1792500000, dt.timezone(dt.timedelta(hours=9))).strftime("%m/%d %H:%M")
case("예약: 예약하기 + 시각", "allow", SCHEDULE, sched,
     approved(SCHEDULE, sched, question=f"{Q_THREAD} {when} 예약.", answer="예약하기", labels=("예약하기", "고치기")))
case("예약: 질문에 시각 없음", "deny", SCHEDULE, sched,
     approved(SCHEDULE, sched, answer="예약하기", labels=("예약하기",)), "예약 시각")
case("예약: 보내기 카드로는 안 됨", "deny", SCHEDULE, sched, approved(SCHEDULE, sched, question=f"{Q_THREAD} {when} 예약."))
case("예약: 시각을 바꿈", "deny", SCHEDULE, {**sched, "post_at": 1792600000},
     approved(SCHEDULE, sched, question=f"{Q_THREAD} {when} 예약.", answer="예약하기", labels=("예약하기",)))
case("초안: Slack 초안으로 넣기", "allow", DRAFT, INPUT,
     approved(DRAFT, INPUT, question="#unit(C0TEST) 스레드 답글 초안으로 넣을까요?", answer="Slack 초안으로 넣기", labels=("Slack 초안으로 넣기", "보내기")))
case("초안도 승인 없으면 막음", "deny", DRAFT, INPUT, transcript())
case("send 코드로 초안 승인 불가", "deny", DRAFT, INPUT, transcript(card(C, "Slack 초안으로 넣기", labels=("Slack 초안으로 넣기",))))
# ── 그 밖의 Slack 쓰기 도구 ──
react = {"channel_id": "C0TEST", "timestamp": "1792472166.965219", "name": "eyes"}
case("반응 달기도 승인 없으면 막음", "deny", P + "slack_add_reaction", react, transcript(), "진행하기")
case("반응 달기: 진행하기 승인", "allow", P + "slack_add_reaction", react,
     approved(P + "slack_add_reaction", react, text="👀 반응", question="#unit(C0TEST) 글에 👀 반응을 달까요?", answer="진행하기", labels=("진행하기", "하지 않기")))
case("캔버스 수정도 막음", "deny", P + "slack_update_canvas", {"canvas_id": "F0X", "content": "a"}, transcript())
case("채널 만들기도 막음", "deny", P + "slack_create_conversation", {"name": "x", "user_ids": ["U1"]}, transcript())
case("앞으로 생길 쓰기 도구도 막음", "deny", P + "slack_pin_message", {"channel_id": "C0TEST"}, transcript())
case("캔버스 글의 흔적", "deny", P + "slack_create_canvas", {"title": "회의록", "content": "🤖 Generated with Claude Code"}, transcript(), "흔적")
for tool in ("slack_read_thread", "slack_search_channels", "slack_get_reactions", "slack_list_channel_members", "slack_read_user_profile"):
    case(f"읽기 도구 {tool} 는 통과", "allow", P + tool, {"channel_id": "C0TEST"}, None)
# ── Claude 흔적 — 승인이 있어도 막음 ──
for i, trace in enumerate([
    "\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    "\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
    "\nCo-authored by Claude",
    "\n(Claude가 작성한 질문이에요)",
    "\n이 글은 Claude가 썼어요",
    "\n— Claude",
    "\n— Claude Opus 5.5",
    "\n- Claude 드림",
    "\nSent with Claude",
    "\nSent via Claude",
    "\n클로드로 작성했어요",
    "\nChatGPT가 작성한 글입니다",
    "\n(자동 생성된 메시지입니다)",
    "\nGen​erated with Claude Code",
    "\n— Ｃｌａｕｄｅ",
    "\n참고: https://claude.ai/new",
    "\n(by Claude)",
    "\n:robot: Generated by Claude",
]):
    m = {**INPUT, "message": MSG + trace}
    case(f"흔적 {i + 1}: {trace.strip()[:28]!r}", "deny", SEND, m, approved(SEND, m), "흔적")
dtrace = {**INPUT, "message": MSG + "\n🤖 Generated with Claude"}
case("초안도 흔적이 있으면 막음", "deny", DRAFT, dtrace, transcript(), "흔적")
# ── 막지 않아야 하는 업무 글 ──
for i, text in enumerate([
    "AI가 생성한 검토 결과는 목록에서 어떻게 보여 줄까요?",
    "이 초안은 AI가 생성해서 변호사 검토 문구를 붙이려고 해요.",
    "이 답변은 AI가 작성한 거라 출처 표시가 필요할 것 같아요.",
    "요약 옆에 (AI 생성) 배지를 두고, (AI 초안) 탭을 따로 둘까요?",
    "배지 문구를 'Generated by AI'로 할지 '자동 생성'으로 할지 여쭤봐요.",
    "Summaries generated by GPT-4o 결과랑 비교해 봤어요.",
    "Contracts drafted by AI 는 별도 목록으로 볼까요?",
    "후보는 아래예요.\n- GPT\n- Claude\n- Gemini\n어느 쪽이 좋을까요?",
    "via Claude API 로 붙이는 방식도 검토 중이에요.",
    "Claude로 생성한 요약이랑 비교해 봤어요.",
    "Kai가 작성한 글이에요.",
    "🤖 봇 알림 채널 정리했어요!",
    "혹시 Claude Code 써 보셨어요? 팀에서 쓰는 방식이 궁금해서요!",
    "zip generated by the server 형태로 받으면 될까요?",
]):
    m = {**INPUT, "message": text}
    case(f"정상 글 {i + 1}: {text[:22]!r}", "allow", SEND, m, approved(SEND, m))
# ── 터미널·파일·Paseo ──
B = "Bash"
for i, cmd in enumerate([
    "curl -X POST https://slack.com/api/chat.postMessage -H 'Authorization: Bearer xoxp-1' -d channel=C1 -d text=hi",
    "curl -d '{\"text\":\"hi\"}' https://hooks.slack.com/services/T/B/X",
    "curl https://slack.com/api/reactions.add -d name=eyes",
    "echo '{\"type\":\"user\"}' >> ~/.claude/projects/p/s.jsonl",
    "rm ~/.claude/hooks/state/slack-send-guard.json",
    "printf '{}' > \"$HOME/.claude/hooks/state/slack-send-guard.json\"",
    "sed -i '' 's/a/b/' ~/.claude/projects/p/s.jsonl",
    "cp /tmp/fake.jsonl ~/.claude/projects/p/s.jsonl",
    "mv ~/.claude/projects/p/s.jsonl /tmp/",
    "python3 -c \"open('/Users/x/.claude/projects/p/s.jsonl','a').write('x')\"",
    "tee -a ~/.claude/projects/p/s.jsonl < /tmp/x",
]):
    case(f"터미널 막음 {i + 1}: {cmd[:40]!r}", "deny", B, {"command": cmd}, None)
for i, cmd in enumerate([
    "curl -s https://slack.com/api/conversations.history -H 'Authorization: Bearer x'",
    "grep -l answers ~/.claude/projects/p/*.jsonl | head",
    "cat ~/.claude/projects/p/s.jsonl > /tmp/copy.jsonl",
    "cp ~/.claude/projects/p/s.jsonl /tmp/",
    "python3 -c \"import json; [json.loads(l) for l in open('/Users/x/.claude/projects/p/s.jsonl')]\"",
    "git commit -m 'slack.com/api/chat.postMessage 문서 링크 정리'",
    "ls ~/.claude/hooks/state",
]):
    expect = "deny" if "chat.postMessage" in cmd else "allow"
    case(f"터미널 {'막음' if expect == 'deny' else '통과'} {i + 1}: {cmd[:40]!r}", expect, B, {"command": cmd}, None)
case("데스크톱 커맨더로 Slack API", "deny", "mcp__plugin_desktop-commander_desktop-commander__start_process",
     {"command": "curl https://slack.com/api/chat.postMessage -d text=hi"}, None)
case("Write 로 대화 기록 쓰기", "deny", "Write", {"file_path": os.path.expanduser("~/.claude/projects/p/s.jsonl"), "content": "x"}, None)
case("Edit 로 승인 기록 고치기", "deny", "Edit", {"file_path": "~/.claude/hooks/state/slack-send-guard.json", "old_string": "a", "new_string": "b"}, None)
case("Write 로 메모리 파일 쓰기는 통과", "allow", "Write", {"file_path": os.path.expanduser("~/.claude/projects/p/memory/a.md"), "content": "x"}, None)
case("Paseo 로 승인 카드에 대신 답하기", "deny", "mcp__paseo__respond_to_permission",
     {"agentId": "a", "requestId": "r", "behavior": "allow", "updatedInput": {"answers": {"#unit(C0TEST)…": "보내기"}}}, None)
case("Paseo 로 다른 질문에 답하기는 통과", "allow", "mcp__paseo__respond_to_permission",
     {"agentId": "a", "requestId": "r", "behavior": "allow", "updatedInput": {"answers": {"어느 쪽?": "A안"}}}, None)
# ── 이상한 입력 ──
case("문자열 tool_input", "deny", SEND, "hello", transcript())
case("짝 없는 서로게이트", "deny", SEND, {**INPUT, "message": "a\ud800b"}, transcript())
case("Slack·터미널·파일 도구가 아니면 관여하지 않음", "allow", "Read", {"file_path": "/tmp/x"}, None)


def main():
    failed = 0
    for name, expect, tool, tool_input, path, contains, before in CASES:
        if before:
            before()
        got, reason = run(tool, tool_input, path)
        good = got == expect and (contains is None or contains in reason)
        if not good:
            failed += 1
            print(f"FAIL {name}: 기대 {expect}{' + ' + repr(contains) if contains else ''}, 결과 {got} — {reason[:300]}")
    print(f"{len(CASES) - failed}/{len(CASES)} 통과")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
