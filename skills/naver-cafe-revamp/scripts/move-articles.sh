#!/bin/zsh
# usage: move-articles.sh <원본 게시판 id> <목적지 게시판 id> <글번호,글번호,...>  — 이동 폼을 fetch POST 로 보낸다(10개 이하씩)
source ${0:A:h}/env.sh
pwr eval "(async()=>{const body=new URLSearchParams({m:'result',clubid:'$NC_CLUB',menuid:'$1',articleid:'$3',allTradeOptionSafeOnly:'false',targetmenuid:'$2'}); const r=await fetch('https://cafe.naver.com/ArticleMove.nhn',{method:'POST',credentials:'include',body}); const t=new TextDecoder('euc-kr').decode(await r.arrayBuffer()); return (t.match(/alert\\(['\"]([^'\"]+)/)||[])[1]||t.replace(/\\s+/g,' ').slice(0,200)})()"
