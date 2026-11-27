#!/usr/bin/env node
/**
 * 브리디(Bredy) 외부 매체·제휴 전달용 소개 킷 생성기
 * 사용법: node build-press-kit.mjs --partner "펫집(petzip)" --slug "petzip" [--out-root ~/bredy-media/marketing]
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
const getArg = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const PARTNER = getArg('--partner', '제휴 매거진');
const SLUG = getArg('--slug', 'partner').replace(/[^a-zA-Z0-9_-]/g, '');
const DATE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const HOME = os.homedir();
const OUT_ROOT = getArg('--out-root', path.join(HOME, 'bredy-media/marketing'));
const BASE = path.join(OUT_ROOT, `${DATE}-${SLUG}-kit`);
const RAW = path.join(BASE, 'raw');
const DIR_CARDS = path.join(BASE, '01_카드뉴스용_소개이미지_4x5');
const DIR_ASSETS = path.join(BASE, '02_편집용_원본화면_및_로고');

const PW_PATH = path.join(HOME, 'Desktop/pro/bredy-marketing/node_modules/playwright-core/index.mjs');
const FONTS = path.join(HOME, 'Desktop/pro/bredy-marketing/assets/fonts');
const ICON = path.join(HOME, 'Desktop/pro/bredy_app/store-assets/play/icon-512.png');

const { chromium } = await import(`file://${PW_PATH}`);

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(DIR_CARDS, { recursive: true });
fs.mkdirSync(DIR_ASSETS, { recursive: true });
fs.copyFileSync(ICON, path.join(DIR_ASSETS, 'logo_icon_512.png'));

const fontCss = `
@font-face { font-family: 'Pretendard'; src: url('file://${FONTS}/Pretendard-Regular.otf'); font-weight: 400; }
@font-face { font-family: 'Pretendard'; src: url('file://${FONTS}/Pretendard-Medium.otf'); font-weight: 500; }
@font-face { font-family: 'Pretendard'; src: url('file://${FONTS}/Pretendard-SemiBold.otf'); font-weight: 600; }
@font-face { font-family: 'Pretendard'; src: url('file://${FONTS}/Pretendard-Bold.otf'); font-weight: 700; }
@font-face { font-family: 'Pretendard'; src: url('file://${FONTS}/Pretendard-ExtraBold.otf'); font-weight: 800; }
`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  // 1. Capture live Korean screens
  const ctx = await browser.newContext({
    locale: 'ko-KR',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9' },
  });
  await ctx.addCookies([{ name: 'bredy_locale', value: 'ko', domain: 'bredy.app', path: '/' }]);
  const live = await ctx.newPage();

  for (const [name, url, wait] of [
    ['shelter', 'https://bredy.app/adoption?tab=shelter', 3000],
    ['memorial', 'https://bredy.app/village', 4000],
    ['rainbow', 'https://bredy.app/village/memorial?side=rainbow', 4500],
    ['tarot', 'https://bredy.app/fun/tarot', 2500],
    ['cute', 'https://bredy.app/cute', 2500],
    ['home', 'https://bredy.app/?category=dog', 2500],
  ]) {
    await live.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await live.waitForTimeout(wait);
    await live.screenshot({ path: path.join(RAW, `${name}.png`) });
    console.log('[capture]', name);
  }

  await live.goto('https://bredy.app/adoption?tab=shelter', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await live.waitForTimeout(2500);
  await live.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === '고양이');
    if (btn) btn.click();
  });
  await live.waitForTimeout(2000);
  await live.screenshot({ path: path.join(RAW, 'shelter-cat.png') });
  await ctx.close();

  // 2. Privacy-safe crops
  const cropPage = await browser.newPage({ viewport: { width: 1179, height: 2556 }, deviceScaleFactor: 1 });
  const writeCrop = async (srcName, outPath, height) => {
    const tmp = path.join(BASE, '_crop.html');
    fs.writeFileSync(tmp, `<!doctype html><html><head><style>*{margin:0;padding:0}</style></head><body><img src="file://${path.join(RAW, srcName)}" style="width:1179px;display:block"></body></html>`);
    await cropPage.goto(`file://${tmp}`, { waitUntil: 'load' });
    await cropPage.waitForTimeout(150);
    await cropPage.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1179, height } });
  };

  const RAINBOW_CLEAN = path.join(DIR_ASSETS, 'screen_04_rainbow_village_ko.png');
  const WORLDCUP_CLEAN = path.join(DIR_ASSETS, 'screen_06_worldcup_ko.png');
  await writeCrop('rainbow.png', RAINBOW_CLEAN, 2060);
  await writeCrop('cute.png', WORLDCUP_CLEAN, 2150);
  await cropPage.close();

  fs.copyFileSync(path.join(RAW, 'shelter.png'), path.join(DIR_ASSETS, 'screen_01_shelter_dog_ko.png'));
  fs.copyFileSync(path.join(RAW, 'shelter-cat.png'), path.join(DIR_ASSETS, 'screen_02_shelter_cat_ko.png'));
  fs.copyFileSync(path.join(RAW, 'memorial.png'), path.join(DIR_ASSETS, 'screen_03_village_day_ko.png'));
  fs.copyFileSync(path.join(RAW, 'tarot.png'), path.join(DIR_ASSETS, 'screen_05_tarot_ko.png'));
  fs.copyFileSync(path.join(RAW, 'home.png'), path.join(DIR_ASSETS, 'screen_07_categories_ko.png'));

  // 3. Render 4:5 cards & 1200x630 banner
  const cardsHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Pretendard',-apple-system,sans-serif;background:#ddd;word-break:keep-all;-webkit-font-smoothing:antialiased}
.card{width:1080px;height:1350px;position:relative;overflow:hidden;background:#FFF8F1;color:#191F28;padding:152px 96px;display:flex;flex-direction:column}
.card.dark{background:linear-gradient(180deg,#17152A 0%,#241E42 58%,#1B1830 100%);color:#F8F6FF}
.pill{display:inline-flex;align-items:center;align-self:flex-start;padding:10px 22px;border-radius:999px;font-size:25px;font-weight:700;letter-spacing:-.3px;background:rgba(255,111,15,.12);color:#FF6F0F}
.pill.green{background:rgba(36,143,89,.12);color:#1E824C}
.pill.pink{background:rgba(240,70,110,.12);color:#E63963}
.pill.night{background:rgba(255,217,142,.16);color:#FFD98E;border:1px solid rgba(255,217,142,.28)}
h1{margin-top:22px;font-size:62px;font-weight:800;line-height:1.22;letter-spacing:-2px}
h1 em{font-style:normal;color:#FF6F0F}
h1 em.green{color:#1E824C}
h1 em.pink{color:#E63963}
h1 em.night{color:#FFD98E}
.sub{margin-top:18px;font-size:28px;font-weight:500;line-height:1.48;color:#596370;letter-spacing:-.4px}
.card.dark .sub{color:#C9C3E0}
.stage{flex:1;margin-top:36px;border-radius:40px;position:relative;overflow:hidden;background:#FFEFE0}
.card.dark .stage{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.phone{position:absolute;border-radius:34px;overflow:hidden;background:#fff;box-shadow:0 24px 56px rgba(20,24,36,.20);border:6px solid #fff}
.card.dark .phone{border-color:rgba(255,255,255,.22);box-shadow:0 26px 64px rgba(0,0,0,.5)}
.phone img{display:block;width:100%;height:auto}
.footer{margin-top:28px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:14px;font-size:30px;font-weight:800;letter-spacing:-.6px}
.brand img{width:48px;height:48px;border-radius:13px}
.meta{font-size:24px;font-weight:600;color:#6B7684;letter-spacing:-.3px}
.card.dark .meta{color:#B5AED1}
#banner{width:1200px;height:630px;background:linear-gradient(135deg,#FFF8F1 0%,#FFECDC 100%);display:flex;align-items:center;justify-content:space-between;padding:56px 72px;position:relative;overflow:hidden;color:#191F28}
</style></head><body>
<section class="card" id="c1">
  <div class="pill">반려동물 커뮤니티 앱 · 브리디</div>
  <h1>입양부터 일상까지,<br><em>이별 뒤 기억</em>까지 함께해요</h1>
  <p class="sub">전국 보호소 공고 모아보기 · 반려생활 소통 · 3D 무지개 마을 추모관</p>
  <div class="stage" style="background:linear-gradient(180deg,#FFEAD6 0%,#FFE0C4 100%)">
    <div class="phone" style="width:285px;left:34px;top:66px;transform:rotate(-4deg)"><img src="file://${path.join(RAW, 'shelter.png')}"></div>
    <div class="phone" style="width:285px;height:520px;right:34px;top:66px;transform:rotate(4deg)"><img src="file://${WORLDCUP_CLEAN}"></div>
    <div class="phone" style="width:325px;height:572px;left:50%;top:28px;transform:translateX(-50%);z-index:2;box-shadow:0 30px 70px rgba(20,24,36,.28)"><img src="file://${RAINBOW_CLEAN}"></div>
  </div>
  <div class="footer"><div class="brand"><img src="file://${ICON}">브리디 Bredy</div><div class="meta">강아지 · 고양이 · 소동물 · 물고기 · 파충류 · 식물</div></div>
</section>
<section class="card" id="c2">
  <div class="pill green">전국 보호소 입양 · 임보</div>
  <h1>보호소에서 기다리는 아이들,<br><em class="green">매일 한곳에</em> 모아 보여드려요</h1>
  <p class="sub">가입 없이 지역·나이별로 찾고, 보호소·임보처 '가족 찾아요' 공유 카드도 무료예요</p>
  <div class="stage" style="background:#E9F5EE">
    <div class="phone" style="width:390px;left:42px;top:38px"><img src="file://${path.join(RAW, 'shelter.png')}"></div>
    <div class="phone" style="width:390px;right:42px;top:68px"><img src="file://${path.join(RAW, 'shelter-cat.png')}"></div>
  </div>
  <div class="footer"><div class="brand"><img src="file://${ICON}">브리디</div><div class="meta">bredy.app/adoption · 전체 무료</div></div>
</section>
<section class="card dark" id="c3">
  <div class="pill night">무료 3D 온라인 추모관 · 무지개 마을</div>
  <h1>별이 된 우리 아이,<br><em class="night">무지개 마을</em>에서 언제든 만나요</h1>
  <p class="sub">아이마다 작은 추모관을 세우고 이웃 집사님들과 꽃과 밤 등불을 함께 켜요</p>
  <div class="stage">
    <div class="phone" style="width:380px;left:44px;top:58px"><img src="file://${path.join(RAW, 'memorial.png')}"></div>
    <div class="phone" style="width:400px;right:40px;top:32px;height:560px"><img src="file://${RAINBOW_CLEAN}"></div>
  </div>
  <div class="footer"><div class="brand"><img src="file://${ICON}">브리디 무지개 마을</div><div class="meta">강아지·고양이부터 작은 동물까지 모두 무료</div></div>
</section>
<section class="card" id="c4">
  <div class="pill pink">집사 참여 놀거리</div>
  <h1>우리 아이 오늘 운세부터<br><em class="pink">세젤귀 멍냥 월드컵</em>까지</h1>
  <p class="sub">사진 한 장으로 뽑는 오늘의 행운 타로카드 · 실시간 1:1 귀여움 투표</p>
  <div class="stage" style="background:#FFE5EC">
    <div class="phone" style="width:385px;left:44px;top:38px"><img src="file://${path.join(RAW, 'tarot.png')}"></div>
    <div style="position:absolute;left:68px;bottom:36px;width:340px;background:#fff;border-radius:26px;padding:22px 26px;box-shadow:0 18px 42px rgba(230,57,99,.22);z-index:3;border:2px solid #FFD0DC">
      <div style="font-size:20px;font-weight:700;color:#E63963">오늘 뽑은 행운 타로카드</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:6px"><span style="font-size:46px;font-weight:800;color:#191F28">92점</span><span style="font-size:22px;font-weight:700;color:#596370">간식 운 대박 예감!</span></div>
      <div style="margin-top:8px;font-size:20px;color:#6B7684">"오늘 산책 나가면 좋은 일 생길 거래요"</div>
    </div>
    <div class="phone" style="width:375px;right:44px;top:38px;height:595px"><img src="file://${WORLDCUP_CLEAN}"></div>
  </div>
  <div class="footer"><div class="brand"><img src="file://${ICON}">브리디</div><div class="meta">인스타 스토리 · 카톡 공유 카드 지원</div></div>
</section>
<section class="card" id="c5">
  <div class="pill">관심 동물 맞춤 커뮤니티</div>
  <h1>키우는 동물만 골라 보고<br><em>집사님들과 편하게</em> 소통해요</h1>
  <p class="sub">가입 인사·등업 없이 사진 자랑과 초보 집사 질문을 무료로 나눠보세요</p>
  <div class="stage" style="background:#FFF0E3;display:flex;align-items:center;padding:34px 40px;gap:34px">
    <div class="phone" style="position:relative;width:365px;height:565px;flex-shrink:0;background:#fff"><img src="file://${path.join(RAW, 'home.png')}" style="margin-top:-158px"></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:18px">
      <div style="background:#fff;border-radius:24px;padding:22px 26px;box-shadow:0 10px 28px rgba(0,0,0,.04)"><div style="font-size:22px;font-weight:800;color:#1E824C">01 · 보호소 입양 모아보기</div><div style="font-size:21px;font-weight:600;color:#333D4B;margin-top:5px">전국 유기견·유기묘 공고 매일 업데이트</div></div>
      <div style="background:#fff;border-radius:24px;padding:22px 26px;box-shadow:0 10px 28px rgba(0,0,0,.04)"><div style="font-size:22px;font-weight:800;color:#6B4EFF">02 · 3D 무지개 마을 추모관</div><div style="font-size:21px;font-weight:600;color:#333D4B;margin-top:5px">별이 된 아이에게 꽃과 등불 놓아주기</div></div>
      <div style="background:#fff;border-radius:24px;padding:22px 26px;box-shadow:0 10px 28px rgba(0,0,0,.04)"><div style="font-size:22px;font-weight:800;color:#E63963">03 · 일상 자랑 · 타로 · 월드컵</div><div style="font-size:21px;font-weight:600;color:#333D4B;margin-top:5px">우리 아이 자랑과 육아 질문 소통</div></div>
      <div style="margin-top:6px;padding:16px 8px 4px"><div style="font-size:20px;font-weight:600;color:#6B7684">iOS · Android · 모바일 웹 전체 무료</div><div style="font-size:25px;font-weight:800;color:#191F28;margin-top:6px">앱스토어 · 플레이스토어 <span style="color:#FF6F0F">'브리디'</span> 검색</div></div>
    </div>
  </div>
  <div class="footer"><div class="brand"><img src="file://${ICON}">브리디</div><div class="meta">https://bredy.app</div></div>
</section>
<section id="banner">
  <div style="max-width:600px;z-index:2">
    <div style="display:flex;align-items:center;gap:14px;font-size:28px;font-weight:800"><img src="file://${ICON}" style="width:48px;height:48px;border-radius:13px">브리디 Bredy</div>
    <div style="margin-top:24px;font-size:50px;font-weight:800;line-height:1.22;letter-spacing:-1.8px">입양부터 일상 소통,<br><span style="color:#FF6F0F">무지개 마을 추모</span>까지 함께해요</div>
    <div style="margin-top:18px;font-size:23px;font-weight:600;color:#596370;line-height:1.45">전국 보호소 공고 모아보기 · 3D 무지개 마을 · 우리 아이 타로카드<br>앱스토어 · 플레이스토어 <b>'브리디'</b> 검색 · bredy.app</div>
  </div>
  <div style="position:relative;width:455px;height:520px;flex-shrink:0">
    <div class="phone" style="width:235px;height:465px;left:0;top:38px;transform:rotate(-4deg)"><img src="file://${path.join(RAW, 'shelter.png')}"></div>
    <div class="phone" style="width:250px;height:440px;right:0;top:24px;transform:rotate(3deg);z-index:2"><img src="file://${RAINBOW_CLEAN}"></div>
  </div>
</section>
</body></html>`;

  const tmpCards = path.join(BASE, '_cards.html');
  fs.writeFileSync(tmpCards, cardsHtml);
  const page = await browser.newPage({ viewport: { width: 1300, height: 1500 }, deviceScaleFactor: 1 });
  await page.goto(`file://${tmpCards}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  for (const [sel, out] of [
    ['#c1', path.join(DIR_CARDS, '01_표지_입양부터이별까지_브리디.png')],
    ['#c2', path.join(DIR_CARDS, '02_보호소입양_가족을기다려요.png')],
    ['#c3', path.join(DIR_CARDS, '03_무지개마을_3D온라인추모관.png')],
    ['#c4', path.join(DIR_CARDS, '04_재미콘텐츠_타로와멍냥월드컵.png')],
    ['#c5', path.join(DIR_CARDS, '05_커뮤니티와무료이용안내.png')],
    ['#banner', path.join(DIR_ASSETS, 'banner_1200x630.png')],
  ]) {
    await (await page.$(sel)).screenshot({ path: out });
  }
  await page.close();

  // 4. Render exact 2-page PDF
  const pdfHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontCss}
@page{size:A4;margin:12mm 16mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Pretendard',-apple-system,sans-serif;color:#191F28;line-height:1.56;font-size:10pt;word-break:keep-all}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:2px solid #FF6F0F;margin-bottom:14px}
.header-left{display:flex;align-items:center;gap:14px}
.header-left img{width:46px;height:46px;border-radius:12px}
.header-title{font-size:20pt;font-weight:800;letter-spacing:-.6px}
.header-sub{font-size:10.5pt;color:#596370;font-weight:600;margin-top:2px}
.badge{background:#FFF2E8;color:#FF6F0F;font-weight:700;font-size:9.5pt;padding:6px 14px;border-radius:999px}
h2{font-size:13pt;font-weight:800;color:#191F28;margin:14px 0 8px;display:flex;align-items:center;gap:8px}
h2::before{content:'';display:inline-block;width:5px;height:16px;background:#FF6F0F;border-radius:3px}
table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.6pt}
th,td{padding:6px 10px;border-bottom:1px solid #E5E8EB;text-align:left;vertical-align:top}
th{width:125px;background:#F9FAFB;font-weight:700;color:#333D4B}
a{color:#FF6F0F;text-decoration:none;font-weight:600}
.story-box{background:#FFF8F1;border-radius:12px;padding:11px 15px;color:#333D4B;font-size:9.6pt;line-height:1.56;border:1px solid #FFE4CC}
.grid-features{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.feat{border:1px solid #E5E8EB;border-radius:12px;padding:10px 13px;background:#fff}
.feat-tag{font-size:9pt;font-weight:800;color:#FF6F0F}
.feat-title{font-size:11pt;font-weight:800;margin:3px 0 5px;color:#191F28}
.feat p{font-size:9.3pt;color:#4E5968;line-height:1.5}
.feat .url{margin-top:5px;font-size:8.6pt;color:#8B95A1;font-weight:600}
.page-break{page-break-before:always}
.copy-box{background:#F9FAFB;border:1px solid #E5E8EB;border-radius:12px;padding:11px 14px;margin-bottom:10px;font-size:9.4pt;line-height:1.54;color:#333D4B}
.copy-label{font-size:9.4pt;font-weight:800;color:#1E824C;margin-bottom:5px}
.preview-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}
.preview-strip img{width:100%;border-radius:8px;border:1px solid #E5E8EB}
.foot-note{margin-top:12px;padding-top:8px;border-top:1px solid #E5E8EB;font-size:9pt;color:#8B95A1;display:flex;justify-content:space-between}
</style></head><body>
<div class="header">
  <div class="header-left"><img src="file://${ICON}"><div><div class="header-title">브리디 (Bredy) 서비스 소개서</div><div class="header-sub">입양부터 함께 사는 일상, 무지개다리 건넌 뒤의 기억까지 함께하는 반려동물 앱</div></div></div>
  <div class="badge">${PARTNER} 전달용 자료</div>
</div>
<h2>1. 서비스 기본 정보</h2>
<table>
  <tr><th>서비스명</th><td><b>브리디 (Bredy)</b> — 반려동물 입양 · 일상 소통 · 온라인 추모 커뮤니티</td></tr>
  <tr><th>지원 환경</th><td>iOS 앱(App Store) · Android 앱(Google Play) · 모바일/PC 웹 (<b>전체 무료</b>)</td></tr>
  <tr><th>함께하는 동물</th><td>강아지 · 고양이 · 소동물(햄스터·토끼·앵무새 등) · 물고기 · 파충류 · 반려식물</td></tr>
  <tr><th>대표 링크</th><td>웹사이트 <a href="https://bredy.app">https://bredy.app</a> &nbsp;|&nbsp; 앱 다운로드 <a href="https://bredy.app/download">https://bredy.app/download</a></td></tr>
  <tr><th>인스타그램</th><td>@bredy_official · @bredy_dogs · @bredy_cats · @bredy_memorial</td></tr>
</table>
<h2>2. 만든 계기와 취지</h2>
<div class="story-box">반려동물과 함께하는 시간은 <b>처음 가족을 맞이하는 순간</b>부터 <b>매일의 크고 작은 일상</b>, 그리고 <b>언젠가 찾아오는 이별 뒤의 그리움</b>까지 길게 이어집니다.<br><br>하지만 보호소 입양 공고는 여러 사이트와 카페에 흩어져 있어 찾기 어렵고, 아이를 떠나보낸 뒤에는 사진첩 말고는 기억하고 위로받을 공간이 마땅치 않았습니다. <b>브리디</b>는 가족을 기다리는 보호소 아이들을 매일 한곳에 모으고, 함께 사는 동안에는 집사님들끼리 자랑·질문·놀거리를 나누며, 별이 된 뒤에는 3D 무지개 마을에 작은 추모관을 만들어 따뜻한 위로를 나눌 수 있도록 만든 무료 서비스입니다.</div>
<h2>3. 주요 기능 (구독자 추천 포인트)</h2>
<div class="grid-features">
  <div class="feat"><div class="feat-tag" style="color:#1E824C">POINT 01 · 유기동물 입양·임보</div><div class="feat-title">전국 보호소 입양 공고 모아보기</div><p>전국 시·군 보호소의 유기견·유기묘 공고를 매일 모아 지역·나이별로 보여줍니다. 보호소·임보처에서 무료로 '가족 찾아요' 글을 올리면 스토리·카톡 공유용 카드 이미지도 자동 생성됩니다.</p><div class="url">bredy.app/adoption</div></div>
  <div class="feat"><div class="feat-tag" style="color:#6B4EFF">POINT 02 · 무료 온라인 추모관</div><div class="feat-title">3D 무지개 마을 & 밤 등불 켜기</div><p>별이 된 반려동물마다 사진과 이야기를 담은 작은 추모관이 생기는 3D 마을입니다. 이웃 집사님들이 꽃을 놓아주거나 밤 광장에 등불(촛불)을 함께 켜 줄 수 있으며 모든 반려동물이 갈 수 있습니다.</p><div class="url">bredy.app/village/memorial?side=rainbow</div></div>
  <div class="feat"><div class="feat-tag" style="color:#E63963">POINT 03 · 집사 참여형 놀거리</div><div class="feat-title">우리 아이 타로카드 & 멍냥 월드컵</div><p>아이 사진 한 장으로 뽑아보는 '오늘의 행운 타로카드(집사 행운 점수 & 아이의 한마디)'와 실시간 강아지·고양이 1:1 귀여움 투표 '멍냥 월드컵'을 회원가입 부담 없이 즐길 수 있습니다.</p><div class="url">bredy.app/fun/tarot · bredy.app/cute</div></div>
  <div class="feat"><div class="feat-tag">POINT 04 · 맞춤 반려생활 소통</div><div class="feat-title">관심 동물만 골라 보는 집사 커뮤니티</div><p>가입 인사나 등업 절차 없이 키우는 동물만 골라 일상 자랑 사진과 초보 집사 질문을 나눌 수 있습니다. 먼저 키워본 집사님들의 답변과 찬반 투표 토론도 활발히 열립니다.</p><div class="url">bredy.app</div></div>
</div>
<div class="page-break"></div>
<h2>4. 에디터님 참고용 소개 문구 예시 (자유롭게 편집 가능)</h2>
<div class="copy-box"><div class="copy-label">[예시 A] 인스타그램 피드 · 스토리용 소개 문구</div><b>"입양부터 함께 사는 날들, 그리고 무지개다리 건넌 뒤의 기억까지 🐾"</b><br><br>집사님들을 위한 따뜻한 반려동물 앱 <b>'브리디(Bredy)'</b>를 소개해요!<br><br>💚 <b>보호소 입양 모아보기</b> — 전국 보호소에서 가족을 기다리는 아이들 공고를 지역별로 한눈에 볼 수 있어요.<br>🌈 <b>3D 무지개 마을</b> — 별이 된 우리 아이에게 무료로 작은 추모관을 만들어 주고, 이웃 집사님들과 꽃과 등불을 함께 놓아줄 수 있어요.<br>🔮 <b>우리 아이 타로카드 & 멍냥 월드컵</b> — 사진 한 장으로 뽑는 오늘의 행운 점수와 세젤귀 댕냥이 월드컵까지!<br>💬 <b>집사 커뮤니티</b> — 등업 없이 편하게 우리 아이 자랑하고 궁금한 점도 물어보세요.<br><br>앱스토어·플레이스토어에서 <b>'브리디'</b>를 검색하거나 <b>bredy.app</b> 웹에서도 무료로 바로 만나보실 수 있어요 :)</div>
<div class="copy-box"><div class="copy-label">[예시 B] 블로그 · 매거진 아티클용 문단 소개</div><b>브리디(Bredy)</b>는 반려동물의 입양부터 일상 기록, 이별 후 추모까지 전 과정을 따뜻하게 잇는 무료 반려생활 플랫폼입니다. 흩어져 있는 전국 유기동물 보호소 공고를 매일 한곳에 모아 입양과 임시보호 연결을 돕고, 평소에는 반려인들이 모여 사진 자랑과 육아 질문을 나누거나 '우리 아이 오늘의 타로카드', '멍냥 월드컵' 같은 가벼운 놀거리를 즐길 수 있습니다. 특히 무지개다리를 건넌 반려동물마다 작은 추모관을 세워 꽃과 밤 등불을 나눌 수 있는 <b>3D 무지개 마을</b>을 무료로 운영해, 반려동물과의 추억을 오래도록 간직하고 싶은 보호자들에게 따뜻한 위로의 공간을 제공하고 있습니다.</div>
<h2>5. 함께 전달드리는 이미지 파일 안내</h2>
<table>
  <tr><th>01_카드뉴스용_소개이미지_4x5<br><span style="font-weight:500;color:#6B7684">(1080×1350px · 5장)</span></th><td>인스타그램 피드(4:5) 및 카드뉴스에 바로 올리시거나 참고하실 수 있는 완성형 소개 이미지 5장 세트입니다.<br>(01 표지 · 02 보호소 입양 · 03 3D 무지개 마을 · 04 타로&멍냥월드컵 · 05 커뮤니티&이용안내)</td></tr>
  <tr><th>02_편집용_원본화면_및_로고<br><span style="font-weight:500;color:#6B7684">(로고·배너·실제화면 9종)</span></th><td>자체 카드뉴스 템플릿이나 블로그 아티클에 자유롭게 합성·배치하실 수 있는 원본 파일입니다.<br>· <b>logo_icon_512.png</b> (앱 아이콘) &nbsp;|&nbsp; <b>banner_1200x630.png</b> (가로형 대표 배너)<br>· <b>screen_01 ~ screen_07</b> (보호소 강아지/고양이, 브리디 마을 낮, 무지개 마을 밤, 타로, 월드컵, 동물 선택 화면)</td></tr>
</table>
<div class="preview-strip">
  <img src="file://${path.join(DIR_CARDS, '01_표지_입양부터이별까지_브리디.png')}">
  <img src="file://${path.join(DIR_CARDS, '02_보호소입양_가족을기다려요.png')}">
  <img src="file://${path.join(DIR_CARDS, '03_무지개마을_3D온라인추모관.png')}">
  <img src="file://${path.join(DIR_CARDS, '04_재미콘텐츠_타로와멍냥월드컵.png')}">
  <img src="file://${path.join(DIR_CARDS, '05_커뮤니티와무료이용안내.png')}">
</div>
<div class="foot-note"><span>브리디 (Bredy) · https://bredy.app</span><span>추가 이미지나 화면이 필요하시면 언제든 편하게 말씀해 주세요!</span></div>
</body></html>`;

  const tmpPdf = path.join(BASE, '_pdf.html');
  fs.writeFileSync(tmpPdf, pdfHtml);
  const pdfPage = await browser.newPage();
  await pdfPage.goto(`file://${tmpPdf}`, { waitUntil: 'load' });
  await pdfPage.evaluate(() => document.fonts.ready);
  await pdfPage.waitForTimeout(400);
  await pdfPage.pdf({ path: path.join(BASE, '브리디_소개자료.pdf'), format: 'A4', printBackground: true });
  await pdfPage.close();

  // 5. Plain text file
  const txt = `[브리디(Bredy) 서비스 소개 자료 — ${PARTNER} 전달용]
한 줄 소개: 입양부터 함께 사는 일상, 무지개다리 건넌 뒤의 기억까지 함께하는 반려동물 커뮤니티 앱

1. 기본 정보
- 서비스명: 브리디 (Bredy)
- 지원 환경: iOS 앱(App Store) · Android 앱(Google Play) · 모바일/PC 웹 (전체 무료)
- 함께하는 동물: 강아지 · 고양이 · 소동물(햄스터·토끼·앵무새 등) · 물고기 · 파충류 · 반려식물
- 대표 웹사이트: https://bredy.app
- 앱 다운로드: https://bredy.app/download (앱스토어·플레이스토어 '브리디' 검색)
- 공식 인스타그램: @bredy_official · @bredy_dogs · @bredy_cats · @bredy_memorial

2. 주요 기능
① 전국 보호소 입양·임보 모아보기: https://bredy.app/adoption
② 3D 무지개 마을 무료 추모관: https://bredy.app/village/memorial?side=rainbow
③ 오늘 우리 아이 타로카드: https://bredy.app/fun/tarot
④ 멍냥 월드컵(강아지·고양이 투표): https://bredy.app/cute

3. 참고용 소개 문구 (자유 편집 가능)
"입양부터 함께 사는 날들, 그리고 무지개다리 건넌 뒤의 기억까지 🐾"
집사님들을 위한 따뜻한 반려동물 앱 '브리디(Bredy)'를 소개해요!
💚 보호소 입양 모아보기 — 전국 보호소 아이들 공고를 지역별로 한눈에 볼 수 있어요.
🌈 3D 무지개 마을 — 별이 된 우리 아이에게 무료로 작은 추모관을 만들어 주고 꽃과 등불을 놓아줄 수 있어요.
🔮 우리 아이 타로카드 & 멍냥 월드컵 — 사진 한 장으로 뽑는 오늘의 행운 점수와 세젤귀 댕냥이 월드컵까지!
💬 집사 커뮤니티 — 등업 없이 편하게 우리 아이 자랑하고 궁금한 점도 물어보세요.
앱스토어·플레이스토어에서 '브리디' 검색 또는 bredy.app 웹에서 무료로 만나보세요 :)
`;
  fs.writeFileSync(path.join(BASE, '브리디_소개자료_복붙용.txt'), txt);

  // Clean temp files & build zip
  fs.rmSync(RAW, { recursive: true, force: true });
  for (const f of ['_crop.html', '_cards.html', '_pdf.html']) {
    fs.rmSync(path.join(BASE, f), { force: true });
  }

  const zipPath = path.join(OUT_ROOT, `브리디_${SLUG}_전달용_자료모음.zip`);
  fs.rmSync(zipPath, { force: true });
  execFileSync('zip', ['-rq', zipPath, '브리디_소개자료.pdf', '브리디_소개자료_복붙용.txt', '01_카드뉴스용_소개이미지_4x5', '02_편집용_원본화면_및_로고'], { cwd: BASE });
  console.log('[done] Kit folder:', BASE);
  console.log('[done] Zip file:', zipPath);
} finally {
  await browser.close();
}
