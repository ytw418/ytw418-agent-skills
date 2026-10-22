#!/bin/bash
# 품질 검사용 장면 3장(시작·가운데·끝)을 한 장으로 붙인다. 사용: frames.sh <mp4> <out.png>
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"); t=/tmp/frames-$$; mkdir -p $t
for i in 0 1 2; do ffmpeg -loglevel error -y -ss $(python3 -c "print($d*($i*0.4+0.1))") -i "$1" -frames:v 1 -vf scale=360:-1 $t/$i.png; done
ffmpeg -loglevel error -y -i $t/0.png -i $t/1.png -i $t/2.png -filter_complex hstack=3 "$2"; rm -rf $t
