/**
 * 관리자 API 와 같은 모양의 JSON 을 dev DB 실제 결과로 만든다(읽기 전용). 워크트리 루트에 복사해 실행한다.
 *   cp <skill>/scripts/dump_digests.ts ./kd-dump.tmp.ts && npx tsx --tsconfig tsconfig.json kd-dump.tmp.ts /tmp/<세션>/real.json ; rm -f kd-dump.tmp.ts
 */
import { writeFileSync } from "fs";
import { buildAllKakaoDigests } from "@libs/server/kakaoDigest";

(async () => {
  const out = process.argv[2] || "/tmp/kakao-digest-real.json";
  const digests = await buildAllKakaoDigests();
  const body = {
    success: true,
    slackConfigured: false,
    digests: digests.map(({ room, data, text }) => ({
      key: room.key,
      label: room.label,
      emoji: room.emoji,
      text,
      counts: {
        endingAuctions: data.endingAuctions.length,
        newProducts: data.newProductCount,
        popularPosts: data.popularPosts.length,
        openQuestions: data.openQuestions.length,
      },
    })),
  };
  writeFileSync(out, JSON.stringify(body));
  digests.forEach((d) => console.log(`----- ${d.room.key}\n${d.text}`));
  process.exit(0);
})();
