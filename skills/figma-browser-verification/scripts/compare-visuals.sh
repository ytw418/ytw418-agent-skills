#!/usr/bin/env bash

set -euo pipefail

usage() {
    echo "Usage: $0 <reference-image> <actual-image> <output-directory> [label]" >&2
}

if [[ $# -lt 3 || $# -gt 4 ]]; then
    usage
    exit 2
fi

reference_path=$1
actual_path=$2
output_dir=$3
label=${4:-comparison}

for command_name in ffmpeg ffprobe shasum; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
        echo "Required command is unavailable: $command_name" >&2
        exit 2
    fi
done

for image_path in "$reference_path" "$actual_path"; do
    if [[ ! -f "$image_path" ]]; then
        echo "Image does not exist: $image_path" >&2
        exit 2
    fi
done

dimensions() {
    ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
        -of csv=s=x:p=0 "$1"
}

reference_dimensions=$(dimensions "$reference_path")
actual_dimensions=$(dimensions "$actual_path")

if [[ -z "$reference_dimensions" || -z "$actual_dimensions" ]]; then
    echo "Could not read image dimensions." >&2
    exit 2
fi

if [[ "$reference_dimensions" != "$actual_dimensions" ]]; then
    echo "Capture dimension mismatch: reference=$reference_dimensions actual=$actual_dimensions" >&2
    echo "Set the browser viewport or capture target to match Figma; evidence is not resized automatically." >&2
    exit 3
fi

mkdir -p "$output_dir"

side_by_side_path="$output_dir/side-by-side-$label.png"
overlay_path="$output_dir/overlay-$label.png"
diff_path="$output_dir/diff-$label.png"
report_path="$output_dir/comparison.txt"

ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]hstack=inputs=2" -frames:v 1 "$side_by_side_path"

ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]blend=all_expr='A*0.5+B*0.5'" -frames:v 1 "$overlay_path"

ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]blend=all_mode=difference" -frames:v 1 "$diff_path"

reference_sha=$(shasum -a 256 "$reference_path" | awk '{print $1}')
actual_sha=$(shasum -a 256 "$actual_path" | awk '{print $1}')

{
    echo "label=$label"
    echo "dimensions=$reference_dimensions"
    echo "reference=$reference_path"
    echo "reference_sha256=$reference_sha"
    echo "actual=$actual_path"
    echo "actual_sha256=$actual_sha"
    echo "side_by_side=$side_by_side_path"
    echo "overlay=$overlay_path"
    echo "diff=$diff_path"
    echo "note=Pixel output is evidence for inspection, not an automatic pass criterion."
} >"$report_path"

echo "Visual comparison created:"
echo "  $side_by_side_path"
echo "  $overlay_path"
echo "  $diff_path"
echo "  $report_path"
