#!/usr/bin/env python3
"""두 화면을 같은 높이로 맞춰 좌우로 붙인다. 심사자용.

사용: python3 side_by_side.py <기준.png> <우리.png> <출력.png> [--shuffle]
--shuffle: 좌우를 무작위로 섞고 어느 쪽이 우리인지 <출력>.key 에만 적는다.
"""
import random
import sys
from pathlib import Path

from PIL import Image

H = 1600
GAP = 24


def load(p):
    im = Image.open(p).convert("RGB")
    w = round(im.width * H / im.height)
    return im.resize((w, H), Image.LANCZOS)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 3:
        sys.exit(__doc__)
    ref, ours, out = args
    shuffle = "--shuffle" in sys.argv
    left, right, ours_side = load(ref), load(ours), "B"
    if shuffle and random.random() < 0.5:
        left, right, ours_side = right, left, "A"
    canvas = Image.new("RGB", (left.width + right.width + GAP, H), (128, 128, 128))
    canvas.paste(left, (0, 0))
    canvas.paste(right, (left.width + GAP, 0))
    canvas.save(out)
    Path(out + ".key").write_text(f"ours={ours_side}\nref={ref}\nours_file={ours}\n")
    print(out)


if __name__ == "__main__":
    main()
