// node jira-shot.mjs <티켓> <out.png> [스크롤할 본문 글귀] — 회사 크롬(9224) 기본 컨텍스트(Jira 로그인)에 자기 탭을 열어 티켓 화면을 찍고, 본문 이미지 크기를 출력한 뒤 그 탭만 닫는다
const { chromium } = await import(process.env.PW_MJS || `${process.env.HOME}/Desktop/bhsn/allibee-frontend/node_modules/playwright/index.mjs`);
const [issue, out, text] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9224');
const page = await browser.contexts()[0].newPage();
try {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto(`https://bhsn.atlassian.net/browse/${issue}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  if (text) await page.getByText(text).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: out });
  // 본문 이미지: 226x141 같은 작은 카드면 크기가 안 들어간 것이다 → jira-embed.mjs 를 다시 돌린다
  console.log(await page.evaluate(() => [...document.querySelectorAll('img[src*="media-cdn"]')].map((e) => `${e.clientWidth}x${e.clientHeight}`).join(' ')));
} finally { await page.close(); }
process.exit(0);
