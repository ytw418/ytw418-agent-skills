#!/bin/zsh
# usage: list-articles.sh  — 카페 전체 글을 '번호 | 게시판(id) | 제목 | 작성자 | 날짜' 로 출력 (삭제·이동 전 확인용)
source ${0:A:h}/env.sh
pwr eval "(async()=>{const out=[];for(let p=1;p<=10;p++){const r=await fetch('https://apis.naver.com/cafe-web/cafe2/ArticleListV2dot1.json?search.clubid=$NC_CLUB&search.queryType=lastArticle&search.page='+p+'&search.perPage=50',{credentials:'include'});const l=((await r.json()).message.result||{}).articleList||[];for(const a of l)out.push(a.articleId+' | '+a.menuName+'('+a.menuId+') | '+a.subject+' | '+a.writerNickname+' | '+new Date(a.writeDateTimestamp).toISOString().slice(0,10));if(l.length<50)break;}return 'total='+out.length+'\n'+out.join('\n')})()" | python3 -I -c "import sys,json;print(json.loads(sys.stdin.read()))"
