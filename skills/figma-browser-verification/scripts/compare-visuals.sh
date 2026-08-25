#!/usr/bin/env bash

set -euo pipefail

usage() {
    echo "Usage: $0 <reference-image> <actual-image> <output-directory> [label] [ssim-threshold]" >&2
}

if [[ $# -lt 3 || $# -gt 5 ]]; then
    usage
    exit 2
fi

reference_path=$1
actual_path=$2
output_dir=$3
label=${4:-comparison}
ssim_threshold=${5:-0.995}

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

ssim_raw=$(ffmpeg -y -i "$reference_path" -i "$actual_path" -lavfi ssim -f null - 2>&1) || true
ssim_score=$(printf '%s\n' "$ssim_raw" | grep -o 'All:[0-9.]*' | tail -1 | cut -d: -f2)

if [[ -z "$ssim_score" ]]; then
    ssim_score="unavailable"
    verdict="REVIEW_IMAGES"
else
    verdict=$(awk -v score="$ssim_score" -v threshold="$ssim_threshold" \
        'BEGIN { print (score + 0 >= threshold + 0) ? "PASS_SKIP_IMAGES" : "REVIEW_IMAGES" }')
fi

reference_sha=$(shasum -a 256 "$reference_path" | awk '{print $1}')
actual_sha=$(shasum -a 256 "$actual_path" | awk '{print $1}')

{
    echo "label=$label"
    echo "dimensions=$reference_dimensions"
    echo "reference=$reference_path"
    echo "reference_sha256=$reference_sha"
    echo "actual=$actual_path"
    echo "actual_sha256=$actual_sha"
    echo "ssim_score=$ssim_score"
    echo "ssim_threshold=$ssim_threshold"
    echo "verdict=$verdict"
    echo "side_by_side=$side_by_side_path"
    echo "overlay=$overlay_path"
    echo "diff=$diff_path"
    echo "note=verdict gates whether image inspection is required for a recheck iteration; it is not an unconditional pass criterion on its own (see SKILL.md step 5-6). A small missing control can leave ssim_score high."
} >"$report_path"

echo "Visual comparison created:"
echo "  ssim_score=$ssim_score (threshold=$ssim_threshold) -> $verdict"
echo "  $side_by_side_path"
echo "  $overlay_path"
echo "  $diff_path"
echo "  $report_path"
