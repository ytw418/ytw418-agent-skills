/**
 * 새 오픈채팅방(종)이 dev DB 에서 무엇을 잡는지 읽기 전용으로 센다.
 * breeder_web 워크트리 루트에 복사해 실행하고 지운다(경로 별칭 @libs 때문):
 *   cp <skill>/scripts/count_room.ts ./kd-count.tmp.ts && npx tsx --tsconfig tsconfig.json kd-count.tmp.ts "장수풍뎅이" "장수풍뎅이,장수" ; rm -f kd-count.tmp.ts
 * 인자: 1) 카테고리 트리 이름  2) 쉼표로 이은 이름 별칭
 */
import client from "@libs/server/client";
import { speciesCategoryIds } from "@libs/server/categories";

(async () => {
  const species = process.argv[2];
  const aliases = (process.argv[3] || species).split(",").map((s) => s.trim()).filter(Boolean);
  if (!species) throw new Error("종 이름을 넘겨 주세요");
  const ids = await speciesCategoryIds(species);
  const where = (field: string) => ({
    OR: [...(ids.length ? [{ categoryId: { in: ids } }] : []), { [field]: { in: aliases } }],
  });
  const since = new Date(Date.now() - 24 * 3600e3);
  console.log("categoryIds", ids.length ? ids : "(트리에 없음 — 이름 별칭으로만 찾는다)");
  console.log("분양글 전체", await client.product.count({ where: where("category") as never }));
  console.log("분양글 24h", await client.product.count({ where: { ...where("category"), createdAt: { gte: since } } as never }));
  console.log("경매 전체", await client.auction.count({ where: where("category") as never }));
  console.log("게시글 전체", await client.post.count({ where: where("type") as never }));
  // 별칭 후보: 실제로 저장된 문자열 값
  const names = await client.product.groupBy({ by: ["category"], where: where("category") as never, _count: { _all: true } });
  console.log("분양글 category 값", names.map((n) => `${n.category}:${n._count._all}`).join(", "));
  process.exit(0);
})();
