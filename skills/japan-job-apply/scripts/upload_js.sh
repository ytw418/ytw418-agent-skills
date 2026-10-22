#!/bin/zsh
# Emit a JS file that attaches a local file to <input-selector> via DataTransfer.
# usage: upload_js.sh <file> '<css selector of input[type=file]>' > /tmp/up.js
f="$1"; sel="$2"; name=$(basename "$f"); b64=$(base64 -i "$f" | tr -d '\n')
mime=application/pdf; [[ "$f" == *.docx ]] && mime=application/vnd.openxmlformats-officedocument.wordprocessingml.document
cat <<JS
(function(){var b=atob("$b64"),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
var dt=new DataTransfer();dt.items.add(new File([u],"$name",{type:"$mime"}));
var inp=document.querySelector('$sel');if(!inp)return 'NO INPUT';inp.files=dt.files;
inp.dispatchEvent(new Event('change',{bubbles:true}));return 'attached '+inp.files[0].size;})()
JS
