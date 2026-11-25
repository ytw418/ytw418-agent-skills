---
name: ig-hashtag-strategist
description: "Build a sized Instagram hashtag set for a post using the 2026 reality that 3 to 5 well-chosen tags beat 30 random ones. Sizes each tag as niche (under 50k posts), mid (50k to 500k), or broad (500k+), then assembles a 2-3 niche, 1-2 mid, 0-1 broad mix that a small or mid account can actually rank in, matched to the post content and rotated to avoid spam patterns. Use to choose hashtags for a caption, carousel, or Reel. Not for writing the caption itself (use ig-caption-writer)."
---

> **브리디 적용 메모(설치 때 추가):** 이 스킬은 초안·다듬기·후킹 분석에만 쓴다. Publora 발행, Apify 수집, Pixfaro 이미지(`lib.*` 호출)는 쓰지 않는다(설치에서 lib 를 뺐다). 게시는 맥 게시 도구(no-link-guard)로 한다. 계정 스킬 `bredy-sns-growth` 규칙이 이 스킬보다 우선한다: 본문 링크 금지(링크는 댓글), 한국어·일본어·중국어 글은 그 나라 사람 말투, 계정별 컨셉과 24시간 판정 기준, 분양글 사진은 판매자 동의. 이 스킬의 영어 AI 말투 규칙(em dash 등)은 영어 계정 글에만 그대로 쓴다. `shared/` 는 원본 묶음의 공용 references 사본이다.


# Instagram Hashtag Strategist

Pick 3-5 hashtags that actually help, sized so the post can rank. The 30-tag wall
is dead: in 2026 hashtags work as topic labels, and a small account ranks in
niche tags, not in million-post broad ones. This skill builds the sized set.

## When to use

- User has a caption, carousel, or Reel and needs hashtags
- User is still posting 20-30 generic tags and wants the 2026 approach
- User wants tags sized to where their account can actually rank

## The model: size, not volume

A tag's **size** is its total post count. The strategy is a mix so the post
ranks in the small tags while touching the bigger ones.

| Tier | Post count | Role | Use |
|---|---|---|---|
| Niche | under 50k | where a small/mid account can actually rank for hours | 2-3 |
| Mid | 50k - 500k | enough audience, beatable competition | 1-2 |
| Broad | 500k+ | a brief category-label touch, ranks for minutes | 0-1 |

**Default: 3-5 total.** Full reasoning in `shared/hashtag-strategy.md`.

## Steps

1. **Get the post.** The caption, carousel topic, or Reel subject, plus the
   target audience and the account's rough size (so the niche/mid split fits).
2. **Extract topics.** Pull the 3-5 real topics the post is about (the subject,
   the niche community, the format, the outcome).
3. **Generate candidates per tier.** For each topic, propose niche, mid, and
   broad candidates. Niche tags are specific and long-tail
   (`#notionforfreelancers`); broad tags are single common words (`#marketing`).
4. **Size each candidate.** Estimate the tier from specificity (the API does not
   expose counts, so use judgment and tell the user to verify counts in the app's
   search). Flag any obviously generic or flag-prone tags
   (`#follow4follow`, `#like4like`) to drop.
5. **Assemble the set.** 2-3 niche + 1-2 mid + 0-1 broad, total 3-5. Drop the
   broad slot if nothing genuinely fits. Every tag must match the content.
6. **Check the match.** Reject any tag that is popular but off-topic; a mismatch
   mistrains the recommendation engine and lowers reach.
7. **Rotate.** Tell the user to vary the set per topic, not reuse one block on
   every post (identical sets across many posts read as automation).
8. **Output.** The 3-5 set, each tagged with its tier and a one-line why, plus
   placement guidance (end of caption or first comment).

## Output format

```
Sized set (4 tags):
  #notionforfreelancers   niche   the exact community this post serves
  #freelanceworkflow      niche   long-tail, low churn, rankable
  #productivitytips       mid     warm relevant audience, beatable
  #notion                 broad   category label, one touch

Placement: end of the caption or the first comment. Rotate the niche tags per topic.
```

## Hard rules

Global voice rules: see root `SKILL.md` Voice rules. Additional skill-specific
rules:

- 3-5 tags total. Never output a 30-tag block.
- Every tag must describe the actual content. No popular-but-off-topic tags.
- At most one broad tag; drop it if nothing fits.
- Flag and remove engagement-farm tags (`#follow4follow`, `#like4like`) and any
  known flagged tags.
- Hashtags go at the end of the caption or in the first comment, never
  mid-sentence.
- Rotate sets per topic; do not hand the user one block to paste forever.

## Anti-patterns (skill will refuse)

- Outputting 20-30 hashtags.
- A "viral hashtag pack" of generic broad tags.
- Tags that do not match the post to chase a bigger audience.
- Hiding 30 tags behind dots to "look clean".
- All-broad sets a small account cannot rank in.

## Resources

- `shared/hashtag-strategy.md` - the full 2026 sizing model and recipe
- `shared/algorithm-heuristics.md` - why sends and saves, not hashtag feeds, drive reach

## Related skills

- `ig-caption-writer` - writes the caption the hashtags attach to
- `ig-carousel-planner` - the carousel whose caption carries the set
- `ig-content-planner` - rotate tag themes across a week
