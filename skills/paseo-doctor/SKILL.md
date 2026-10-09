---
name: paseo-doctor
description: 로컬 Paseo(데스크톱 앱이 띄운 데몬)가 이상할 때 원인을 진단하고 고친다. Claude·Codex 에이전트가 응답하지 않거나 로그인 실패처럼 보일 때, 데몬 로그에 'Could not resolve host'·GitHubCommandError 가 쌓일 때, 앱 업데이트 뒤 데몬 버전이 낡았을 때, 사이드바 워크스페이스를 눌러도 엉뚱한(같은) 대화창만 열릴 때 쓴다. 사용자가 'Paseo 이상해', '데몬 고쳐줘', '에이전트가 응답 안 해', '클로드도 안 되고 아스트라도 안 돼', '코덱스 무응답', '워크스페이스 눌러도 같은 화면만 나와', 'paseo doctor' 등을 말할 때 사용한다. Paseo 사용법·설정 질문은 paseo-help, 에이전트·워크스페이스 조작은 paseo 스킬 담당.
---

# Paseo Doctor

로컬 macOS, 데스크톱 앱이 관리하는 데몬(`desktopManaged: true`) 기준이다. 원격·Docker 데몬이면 paseo-help 스킬로 넘긴다.

## 0. 진단부터 (읽기 전용)

```bash
bash ~/.claude/skills/paseo-doctor/scripts/diagnose.sh
```

버전, Supervisor·워커 프로세스 시작 시각, 현재 워커의 로그 오류 수, 프로바이더 상태를 보여 주고 판정을 낸다. 아무것도 재시작하지 않는다.

## 1. 알려진 장애와 처방

### A. 데몬이 낡았거나 DNS·키체인과 끊김 (2026-10-09 실제 사례)

증상
- Claude 에이전트가 로그인 실패처럼 보이고, Codex(gpt-6-astra 등) 에이전트가 메시지를 받아도 응답하지 않는다.
- 데몬 로그에 `Could not resolve host: github.com`(git fetch), `GitHubCommandError`(gh api graphql), `ProcessTransport is not ready for writing` 이 반복된다.
- `diagnose.sh` 에서 앱 버전과 데몬 버전이 다르다(당시 앱 0.11.1, 데몬 0.10.3).

원인
- `Paseo Supervisor` 프로세스는 앱을 닫아도 죽지 않고 계속 산다. 당시 10월 6일에 뜬 Supervisor 가 3일 동안 살아 있으면서 macOS GUI 세션 서비스(DNS 리졸버 mDNSResponder, 키체인)와 연결이 끊겼다.
- 그 Supervisor 가 새로 띄우는 워커에도 끊긴 상태를 물려준다. 그래서 `paseo daemon restart` 로 워커만 0.11.1 로 올려도 같은 오류가 그대로 났다.
- DNS 가 안 되니 git·gh·모델 API 호출이 실패하고, 키체인이 안 되니 Claude·Codex 자격 증명을 못 읽는다.

처방 (위에서부터 하나씩, 매번 `diagnose.sh` 로 확인)
1. 사용자에게 알린다. 재시작하면 실행 중인 에이전트(이 세션 포함)가 끊긴다. 기록은 남고 이어서 시키면 된다. 지금 `running` 인 에이전트가 있으면 `paseo ls` 로 보여 주고 기다릴지 묻는다.
2. 워커만 재시작: `paseo daemon restart`. 15초 뒤 `diagnose.sh` 를 다시 돌려 현재 워커에서 `Could not resolve host` 가 0인지 본다. 0이면 끝이다.
3. 그래도 나면 Supervisor 째로 내린다. 사용자 확인을 받은 뒤 `bash ~/.claude/skills/paseo-doctor/scripts/relaunch.sh --yes` 를 실행한다. 앱 종료 → Supervisor·워커·Helper 종료 → 앱 재실행을 nohup 으로 분리해 돌린다. 이 세션도 끊기므로 실행 전에 사용자에게 다음 확인 방법을 남긴다.
   - 새 에이전트 하나를 열어 Claude 가 답하는지 본다.
   - 응답하지 않던 Codex 에이전트에 한마디 보낸다.
   - `paseo daemon status` 의 `pid` 가 이전 Supervisor pid 와 다른지 본다.
4. 그래도 안 되면 macOS 로그아웃·재로그인이나 재부팅을 권한다. 이 셸에서도 `getaddrinfo` 나 `keychain` 이 FAIL 이면 Paseo 문제가 아니라 GUI 세션 문제다.

참고: 이 셸에서는 `dig` 가 되는데 `getaddrinfo` 만 실패하면 시스템 리졸버(XPC)가 끊긴 상태다. git push 우회 방법은 메모 `paseo-session-dns-keychain-loss` 에 있다.

### B. 사이드바 워크스페이스를 눌러도 같은 대화창만 열림

증상: 워크스페이스 4개를 각각 눌러도 항상 한 워크스페이스의 대화창으로만 간다. 가끔 생긴다.

판단 순서
1. `diagnose.sh` 로 버전 불일치부터 본다. 앱이 업데이트됐는데 데몬이 낡았으면 앱과 데몬의 프로토콜이 어긋나 워크스페이스 목록·선택 상태가 틀어질 수 있다. A 처방으로 데몬을 맞춘 뒤 재현되는지 본다.
2. 버전이 같으면 앱 화면 상태 문제다. 앱을 완전히 종료(⌘Q)하고 다시 연다. 데몬은 Supervisor 가 들고 있으므로 에이전트는 끊기지 않는다.
3. 그래도 재현되면 Paseo 버그다. 비슷한 기존 이슈를 먼저 찾는다.
   ```bash
   gh issue list --repo getpaseo/paseo --state all --search "workspace switch" --limit 20
   ```
   2026-10-09 기준으로 똑같은 이슈는 없다. 가까운 것은 #5581(아카이브 해제한 세션 탭이 다른 워크스페이스들에도 열림), #5447(늦게 온 워크스페이스 스냅샷이 상태를 덮어씀), #5522(Android 에서 워크스페이스 전환 시 "Agent not found")이다.
4. 새 이슈를 올릴 때는 앱·데몬 버전, 플랫폼(데스크톱·iOS·Android·웹), 재현 순서, 그 시각 `~/Library/Logs/Paseo/main.log` 일부를 붙인다. 이슈 등록은 외부 공개이므로 사용자 확인 뒤에 한다.

## 2. 위치

| 항목 | 경로 |
|---|---|
| 데몬 로그 | `~/.paseo/daemon.log` (용량이 차면 `~/.paseo/YYYYMMDD-HHMM-NN-daemon.log` 로 넘어감) |
| 데스크톱 앱 로그 | `~/Library/Logs/Paseo/main.log` |
| 설정 | `~/.paseo/config.json` (수정 뒤 `paseo reload`) |
| 번들 CLI | `/Applications/Paseo.app/Contents/Resources/bin/paseo` |

로그 줄의 `"pid"` 는 워커 pid 다. 현재 워커의 오류만 보려면 `"pid":<workerPid>,` 로 거른다. 이전 워커의 오류를 현재 문제로 착각하지 않는다.

## 3. 하지 않는 것

- 사용자 확인 없이 데몬·앱을 재시작하지 않는다.
- `config.json` 을 고쳐서 해결하려 하지 않는다. 위 장애는 설정 문제가 아니다.
- 공식 문서: https://paseo.sh/docs/troubleshooting.md
