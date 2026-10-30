# 녹화할 때만 cue 생성 locale(ko.ts)에 시트 반영 전 키의 한국어 문구를 넣는다. 되돌리기: git checkout -- <ko.ts>
# python3 i18n-local.py <워크트리>/apps/cue/src/lib/i18n/generated/ko.ts
import pathlib
import sys

ROWS = """apps.cue.routes.settings.usage.page.tabAll	전체 사용량
apps.cue.routes.settings.usage.page.tabMembers	사용자별 사용량
apps.cue.routes.settings.usage.memberUsageTab.presetThisMonth	이번 달
apps.cue.routes.settings.usage.memberUsageTab.presetLastMonth	지난 달
apps.cue.routes.settings.usage.memberUsageTab.presetLast3Months	최근 3개월
apps.cue.routes.settings.usage.memberUsageTab.presetCustom	직접 선택
apps.cue.routes.settings.usage.memberUsageTab.excelDownload	엑셀 다운로드
apps.cue.routes.settings.usage.memberUsageTab.excelDownloadFailed	엑셀 파일을 받지 못했어요. 다시 시도해 주세요.
apps.cue.routes.settings.usage.memberUsageTab.excelFilename	사용자별_사용량.xlsx
apps.cue.routes.settings.usage.memberUsageTab.totalCredits	총 AI 크레딧
apps.cue.routes.settings.usage.memberUsageTab.usedMembers	사용 구성원 / 현재 구성원
apps.cue.routes.settings.usage.memberUsageTab.noUsage	선택한 기간에 사용 기록이 없어요
apps.cue.routes.settings.usage.memberUsageTab.columnMember	구성원
apps.cue.routes.settings.usage.memberUsageTab.columnRole	역할
apps.cue.routes.settings.usage.memberUsageTab.columnCredits	AI 크레딧
apps.cue.routes.settings.usage.memberUsageTab.columnAgentCount	AI 물어보기
apps.cue.routes.settings.usage.memberUsageTab.columnReviewCount	계약서 검토
apps.cue.routes.settings.usage.memberUsageTab.columnEsignSendCount	전자서명 발송
apps.cue.routes.settings.usage.memberUsageTab.columnContractUploadCount	계약서 등록
apps.cue.routes.settings.usage.memberUsageTab.roleAdmin	마스터
apps.cue.routes.settings.usage.memberUsageTab.roleUser	멤버
apps.cue.routes.settings.usage.memberUsageTab.roleGuest	게스트
apps.cue.routes.settings.usage.memberUsageTab.roleCustom	커스텀
apps.cue.routes.settings.usage.memberUsageTab.statusRemoved	내보낸 구성원
apps.cue.routes.settings.usage.memberUsageTab.statusWithdrawn	탈퇴한 사용자
apps.cue.routes.settings.usage.memberUsageTab.statusUnknown	기타(사용자 정보 없음)
apps.cue.routes.settings.usage.memberUsageTab.planLocked	Team 300 이상 플랜에서 구성원별 사용량을 볼 수 있어요
apps.cue.routes.settings.usage.memberUsageTab.viewPlans	요금제 보기
apps.cue.routes.settings.usage.memberUsageTab.loadFailed	사용량을 불러오지 못했어요
apps.cue.routes.settings.usage.memberUsageTab.retry	다시 시도"""

p = pathlib.Path(sys.argv[1])
s = p.read_text()
anchor = "\t'apps.cue.routes.settings.usage.contractStorageCard.title'"
assert s.count(anchor) == 1, "위치 매칭 실패"
add = "".join(f"\t'{k}': '{v}',\n" for k, v in (r.split("\t") for r in ROWS.splitlines()) if f"'{k}'" not in s)
p.write_text(s.replace(anchor, add + anchor))
print("녹화용 ko 키", add.count("\n"), "개 추가(커밋 금지)")
