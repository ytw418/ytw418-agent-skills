(async()=>{
// 메뉴 개편 템플릿. 메뉴관리 화면(ca-fe/admin/cafes/<clubid>/menu-management)에서 eval 한다. 저장은 '저장하기' 버튼으로 따로 누른다.
// 아래 '기존 메뉴'·'새 메뉴'·'순서' 세 부분만 이 카페 계획에 맞게 고친다. byId(n)의 n 은 menuList 로 뽑은 이 카페의 실제 메뉴 id.
// 예시는 외국곤충연구회(2026-10-18) 실제 적용본. 등급 코드(1·110·120…·888·999)도 이 카페 권한 select 의 value 로 확인한다.
const s=document.querySelector('#app').__vue__.$store, NS='admin/menuManagement/', mm=s.state.admin.menuManagement, log=[];
const oc=window.confirm, oa=window.alert; window.confirm=(m)=>{log.push('confirm:'+m);return true;}; window.alert=(m)=>{log.push('alert:'+m);};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const byId=id=>mm.menuList.find(m=>m.id===id);
let hid=0; const heads=arr=>({articleHeadUse:true,articleHeads:arr.map(n=>({id:--hid,name:n}))});
const noHeads={articleHeadUse:false,articleHeads:[]};
const check=(m,cfg)=>{const c=s.getters[NS+'selectedMenuConfig']; if(c&&c.errorMessage) log.push('ERR '+m.id+' '+cfg.menuName+': '+c.errorMessage);};
const upd=async(m,cfg)=>{await s.dispatch(NS+'selectMenu',{menu:m,isAppending:false}); await s.dispatch(NS+'updateSelectedMenuConfig',cfg); check(m,cfg);};
let anchor=byId(6);   // 새 메뉴를 붙이기 시작할 기존 메뉴(보통 목록 맨 끝)
const add=async(palette,cfg)=>{
  await s.dispatch(NS+'selectMenu',{menu:anchor,isAppending:false}); await wait(250);
  const pal=[...document.querySelectorAll('a')].find(a=>a.innerText.trim()===palette); if(!pal){log.push('nopalette '+palette);return null;}
  pal.click(); await wait(350);
  await s.dispatch(NS+'addMenu',s.getters[NS+'selectedMenuType']); await wait(500);
  const m=s.getters[NS+'selectedMenus'][0]; await s.dispatch(NS+'updateSelectedMenuConfig',cfg); check(m,cfg); await wait(150);
  anchor=m; return m;
};
const B={writeLevel:1,commentWriteLevel:1,readLevel:0,defaultWriteOpenType:1,hidden:false,indent:false,upArticleUse:true,upArticleTopViewUse:true,upArticleMinimumCount:5,upArticleViewCount:3,rCodes:[]};
const MK={...B,writeLevel:110,readLevel:1};   // 장터: 1령부터 쓰기, 멤버만 읽기
const N=(name,desc,h,code='NORMAL',extra={})=>({...B,...(h?heads(h):noHeads),menuCode:code,menuName:name,menuDescription:desc,...extra});

// 기존 메뉴
await upd(byId(1),N('공지사항','외국곤충연구회 공지와 필독 안내',null,'NORMAL',{writeLevel:888}));
await upd(byId(5),{menuName:'가입인사',memberOpen:true});
await upd(byId(6),{menuName:'출석체크',memberOpen:true});
await upd(byId(7),N('외국 사슴벌레','기라파톱·만디부라리스·안타에우스 등 외국 사슴벌레 사육·종 정보와 해외 자료',['사육정보','종정보','해외자료','사진'],'WEBZINE'));
await upd(byId(8),N('사육 일지','키우는 곤충의 알부터 성충까지 기록',['사슴벌레','장수풍뎅이','꽃무지','기타'],'WEBZINE'));
await upd(byId(2),N('자유게시판','곤충 이야기도, 사는 이야기도 자유롭게',['잡담','정보','질문','유머']));
await upd(byId(3),N('내 곤충 자랑','내가 키우는 국내 곤충·표본 사진 (외국 생체 사진 금지)',null,'ALBUM'));

// 새 메뉴 (출석체크 뒤에 차례로 붙인 뒤 맨 끝에서 순서를 다시 맞춘다)
const g={}, b={};
g.guide=await add('그룹 제목',{menuName:'연구회 안내',fold:false});
b.levelup=await add('등업게시판',{menuName:'등업신청',menuDescription:'연구원 등급 신청 (사육 경력·자료 정리 기여 멤버)',useLevelUpNotice:true,levelUpNotice:'알~성충 등급은 활동하면 자동으로 올라갑니다. 이 게시판은 연구원 등급(사육 경력, 해외 자료 번역·위험분석 자료 정리로 기여한 멤버) 신청 전용입니다.'});
g.law=await add('그룹 제목',{menuName:'합법화·검역',fold:false});
b.lawnews=await add('통합게시판',N('합법화·법 소식','식물방역법·검역 고시 개정, 행정예고, 단속 소식',['법개정','행정예고','단속적발','해외소식']));
b.allow=await add('통합게시판',N('수입 허용 목록·검역 안내','검역본부 금지품 제외 목록, 수입·검역 절차 정리 (운영진 작성)',null,'NORMAL',{writeLevel:888}));
b.risk=await add('통합게시판',N('종별 위험분석 자료실','종마다 위험분석 신청에 쓸 분류·생태·국내 정착 가능성 자료 모음',['사슴벌레','장수풍뎅이','기타갑충','신청절차'],'NORMAL',{writeLevel:150}));
g.foreign=await add('그룹 제목',{menuName:'외국곤충 연구',fold:false});
b.dynastes=await add('통합게시판',N('외국 장수풍뎅이','헤라클레스·코카서스·넵튠 등 외국 장수풍뎅이 사육·종 정보와 해외 자료',['사육정보','종정보','해외자료','사진'],'WEBZINE'));
b.etc=await add('통합게시판',N('기타 외국 갑충','꽃무지·하늘소·비단벌레 등 외국 갑충 정보',['꽃무지','하늘소','비단벌레','기타'],'WEBZINE'));
b.overseas=await add('통합게시판',N('해외 사육 자료·번역','해외 사육자·책·논문 자료 번역과 소개 (출처 필수)',['번역','논문·책','해외사이트','영상']));
b.qna=await add('통합게시판',N('질문답변','종 이름과 사육 환경을 같이 적어 주세요',['외국곤충','국내사슴벌레','국내장수풍뎅이','사육용품','법·검역','기타']));
g.domestic=await add('그룹 제목',{menuName:'국내 곤충 사육',fold:false});
b.kstag=await add('통합게시판',N('국내 사슴벌레','왕·넓적·톱·애사슴벌레 등 국내 사슴벌레 사육과 채집',['왕사슴벌레','넓적사슴벌레','톱사슴벌레','애사슴벌레','기타'],'WEBZINE'));
b.kdyn=await add('통합게시판',N('국내 장수풍뎅이','국내 장수풍뎅이 사육·채집·사진',['사육','채집','사진'],'WEBZINE'));
b.supply=await add('통합게시판',N('사육 용품·먹이','톱밥·균사·젤리·사육통·온도 관리',['톱밥·균사','젤리·먹이','사육통','온도관리','기타']));
g.market=await add('그룹 제목',{menuName:'장터 (합법 거래만)',fold:false});
b.adopt=await add('통합게시판',N('국내 곤충 분양','국내 종만 분양 (2령부터). 국명·학명·채집지/혈통 필수, 외국 종 금지',['사슴벌레','장수풍뎅이','꽃무지','기타'],'NORMAL',{...MK,writeLevel:120}));
b.sell=await add('통합게시판',N('표본·용품 팝니다','곤충 표본과 사육 용품 판매 (2령부터). 살아 있는 곤충 금지',['표본','사육용품','기타'],'NORMAL',{...MK,writeLevel:120}));
b.buy=await add('통합게시판',N('삽니다','국내 곤충·표본·용품 구해요 (1령부터). 외국 생체 구함 글 금지',['국내곤충','표본','용품'],'NORMAL',MK));
b.review=await add('통합게시판',N('거래후기','거래 뒤 서로 후기를 남겨 믿을 수 있는 장터를 만들어요',null,'NORMAL',MK));
b.report=await add('통합게시판',N('불법거래·사기신고','불법 외국곤충 거래·사기 의심 사례 공유. 연락처·계좌는 일부 가려서',['불법거래','사기피해','사기의심'],'NORMAL',{...MK,defaultWriteOpenType:0}));
g.talk=await add('그룹 제목',{menuName:'연구회 소통',fold:false});
b.meet=await add('통합게시판',N('모임·곤충 박람회','곤충 박람회·체험전 같이 가요, 오프라인 모임',['박람회','모임','체험']));
b.archive=await add('스탭게시판',{menuName:'곤충 키우기 보관함',menuDescription:'옛 카페 시절 글 보관 (운영진 전용)'});

// 순서
const order=[g.guide,byId(1),byId(5),b.levelup,byId(6),
  g.law,b.lawnews,b.allow,b.risk,
  g.foreign,byId(7),b.dynastes,b.etc,b.overseas,b.qna,
  g.domestic,b.kstag,b.kdyn,byId(8),b.supply,
  g.market,b.adopt,b.sell,b.buy,b.review,b.report,
  g.talk,byId(2),byId(3),b.meet,
  byId(4),b.archive];
const ids=order.map(m=>m&&m.id), objs=ids.map(byId);
const missing=ids.map((id,i)=>objs[i]?null:i).filter(x=>x!==null); const notIn=mm.menuList.filter(m=>!ids.includes(m.id)).map(m=>m.id+':'+m.code+':'+m.name);
log.push('ids='+JSON.stringify(ids)+' missing='+JSON.stringify(missing)+' notInOrder='+JSON.stringify(notIn));
if(!missing.length && !notIn.length) s.commit(NS+'setMenuList',objs);
log.push('final: '+mm.menuList.map(m=>m.id+':'+m.code+':'+(m.config&&m.config.menuName||m.name)).join(' | '));
log.push('hasAnyChange='+s.getters[NS+'hasAnyChange']);
window.confirm=oc; window.alert=oa;
return log.join('\n');
})()
