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
diff_amplified_path="$output_dir/diff-amplified-$label.png"
report_path="$output_dir/comparison.txt"

ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]hstack=inputs=2" -frames:v 1 "$side_by_side_path"

ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]blend=all_expr='A*0.5+B*0.5'" -frames:v 1 "$overlay_path"

ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]blend=all_mode=difference" -frames:v 1 "$diff_path"

# Subtle differences (1px border color, thin dividers) are nearly invisible in the raw diff;
# amplify them so hairline deltas show up during image inspection.
ffmpeg -y -v error -i "$reference_path" -i "$actual_path" \
    -filter_complex "[0:v][1:v]blend=all_mode=difference,lutrgb=r='min(val*8,255)':g='min(val*8,255)':b='min(val*8,255)'" \
    -frames:v 1 "$diff_amplified_path"

# Fraction of pixels whose difference exceeds a small noise threshold. A thin border color
# change moves this ratio while barely moving the aggregate SSIM score.
stats_raw=$(ffmpeg -v error -i "$reference_path" -i "$actual_path" \
    -lavfi "blend=all_mode=difference,format=gray,lutyuv=y='if(gt(val,24),255,0)',signalstats,metadata=print:file=-" \
    -f null - 2>/dev/null) || true
changed_yavg=$(printf '%s\n' "$stats_raw" | grep -o 'signalstats\.YAVG=[0-9.]*' | tail -1 | cut -d= -f2)
if [[ -n "$changed_yavg" ]]; then
    changed_pixel_ratio=$(awk -v yavg="$changed_yavg" 'BEGIN { printf "%.6f", yavg / 255 }')
else
    changed_pixel_ratio="unavailable"
fi

ssim_raw=$(ffmpeg -y -i "$reference_path" -i "$actual_path" -lavfi ssim -f null - 2>&1) || true
ssim_score=$(printf '%s\n' "$ssim_raw" | grep -o 'All:[0-9.]*' | tail -1 | cut -d: -f2)

# PASS_SKIP_IMAGES requires both a high aggregate SSIM and almost no changed pixels.
# A 1px border color change moves SSIM by <0.5% and would otherwise skip inspection.
changed_ratio_threshold=0.001
if [[ -z "$ssim_score" || "$changed_pixel_ratio" == "unavailable" ]]; then
    [[ -z "$ssim_score" ]] && ssim_score="unavailable"
    verdict="REVIEW_IMAGES"
else
    verdict=$(awk -v score="$ssim_score" -v threshold="$ssim_threshold" \
        -v ratio="$changed_pixel_ratio" -v ratio_threshold="$changed_ratio_threshold" \
        'BEGIN { print (score + 0 >= threshold + 0 && ratio + 0 <= ratio_threshold + 0) ? "PASS_SKIP_IMAGES" : "REVIEW_IMAGES" }')
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
    echo "changed_pixel_ratio=$changed_pixel_ratio"
    echo "changed_ratio_threshold=$changed_ratio_threshold"
    echo "verdict=$verdict"
    echo "side_by_side=$side_by_side_path"
    echo "overlay=$overlay_path"
    echo "diff=$diff_path"
    echo "diff_amplified=$diff_amplified_path"
    echo "note=verdict gates whether image inspection is required for a recheck iteration; it is not an unconditional pass criterion on its own (see SKILL.md step 5-6). A small missing control can leave ssim_score high."
    echo "note2=hairline properties (border color/width, thin dividers, text color) are below SSIM sensitivity; they pass or fail only via the computed-style gate in SKILL.md step 5, never via ssim_score. Inspect diff_amplified when changed_pixel_ratio > 0."
} >"$report_path"

echo "Visual comparison created:"
echo "  ssim_score=$ssim_score (threshold=$ssim_threshold) -> $verdict"
echo "  changed_pixel_ratio=$changed_pixel_ratio"
echo "  $side_by_side_path"
echo "  $overlay_path"
echo "  $diff_path"
echo "  $diff_amplified_path"
echo "  $report_path"
