// node invite.mjs <lounge: reptile|insect|aquatic|smallpet|dog|cat> → 브리디 자동화 크롬(운영자 로그인)의 초대 페이지에서 "만들기" 1번 눌러 새 초대 링크 코드를 낸다. 한 사람에 한 장.
const lounge=process.argv[2];
const t=await (await fetch('http://127.0.0.1:9222/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);let id=0;const p={};
ws.onmessage=e=>{const m=JSON.parse(e.data);if(p[m.id]){p[m.id](m.result);delete p[m.id]}};
await new Promise(r=>ws.onopen=r);
const s=(method,params={})=>new Promise(r=>{p[++id]=r;ws.send(JSON.stringify({id,method,params}))});
const ev=async x=>(await s('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true})).result.value;
await s('Page.navigate',{url:'https://bredy.app/invite?lounge='+lounge});await new Promise(r=>setTimeout(r,7000));
const codes=`JSON.stringify([...new Set((document.documentElement.innerHTML.match(/invite\\/([A-Za-z0-9_-]{4,})/g)||[]))])`;
const before=JSON.parse(await ev(codes));
console.log('clicked',await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='만들기');if(!b)return false;b.click();return true})()`));
await new Promise(r=>setTimeout(r,5000));
const after=JSON.parse(await ev(codes));
console.log(JSON.stringify({new:after.filter(x=>!before.includes(x)),before}));
console.log((await ev('document.body.innerText')).slice(0,400));
await fetch('http://127.0.0.1:9222/json/close/'+t.id);process.exit(0);
