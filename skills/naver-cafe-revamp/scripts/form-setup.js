(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));
const w=document.getElementById('articleFormIframe').contentWindow, d=w.document;
const out=[]; const BOARDS=BOARDS_JSON, GUIDE=GUIDE_JSON;
// 1) 적용 게시판 선택
[...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='+추가').click(); await wait(800);
for(const name of BOARDS){ const cb=[...d.querySelectorAll('input[type=checkbox]')].find(c=>((c.labels&&c.labels[0]&&c.labels[0].innerText)||c.parentElement.innerText||'').trim()===name); if(!cb){out.push('nobox:'+name);continue;} if(!cb.checked) (cb.labels&&cb.labels[0]||cb).click(); await wait(150); out.push(name+':'+cb.checked); }
const ok=[...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='확인'); out.push('okDisabled='+ok.disabled); ok.click(); await wait(800);
// 2) 게시판 안내 / 본문 글양식 '사용'
const sections=[...d.querySelectorAll('h3')];
const pick=(title,val)=>{const h=sections.find(x=>x.innerText.trim()===title); const box=h.parentElement.parentElement; const r=[...box.querySelectorAll('input[type=radio]')].find(x=>((x.labels&&x.labels[0]&&x.labels[0].innerText)||x.parentElement.innerText||'').trim()===val); (r.labels&&r.labels[0]||r).click(); return r.checked;};
if(GUIDE){ out.push('guide='+pick('게시판 안내','사용')); await wait(600); const ta=[...d.querySelectorAll('textarea')].find(t=>t.offsetParent); if(ta){ const set=Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set; set.call(ta,GUIDE); ta.dispatchEvent(new w.Event('input',{bubbles:true})); out.push('guideText='+ta.value.length);} else out.push('noGuideTextarea'); }
out.push('body='+pick('본문 글양식','사용')); await wait(1500);
out.push('applied='+[...d.querySelectorAll('h3')].find(x=>x.innerText.trim()==='적용 게시판').parentElement.parentElement.innerText.replace(/\n/g,' ').slice(0,120));
out.push('seParas='+d.querySelectorAll('.se-text-paragraph').length);
return out.join(' | ');})()
