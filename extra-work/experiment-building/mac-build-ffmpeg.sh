#!/bin/bash
#
# Build a *minimal* FFmpeg from source — just the `ffmpeg` program with MP3
# encoding (libmp3lame), which is all this app actually needs. FFmpeg is only
# ever invoked by yt-dlp (see electron/client/ytUtils.ts `ffmpegBinPath` +
# src/server/appHelpers.ts `--ffmpeg-location`) to post-process downloads:
# extract audio to mp3 (`-x --audio-format mp3`) and merge video+audio streams.
# yt-dlp does all the downloading itself and only hands ffmpeg LOCAL files, so
# the binary needs no network stack, no ffplay, and no ffprobe.
#
# This mirrors extra-work/ffmpeg/README.md (ffmpeg snapshot source + `brew lame`
# + --enable-libmp3lame) but strips everything the mp3 flow does not touch, so
# the result is much smaller than the stock ~21-26MB build the README produces.
# It keeps the full decoder/demuxer set on purpose — YouTube et al. serve audio
# as AAC (m4a), Opus/Vorbis (webm/ogg), etc., and dropping those would silently
# break extraction for some sources — but drops the fat: docs, the player, the
# probe binary, the network/TLS layer, capture devices, postproc, and debug
# info, plus --enable-small to optimize libav* for size.
#
# Usage:
#   ./build-ffmpeg.sh [version]
#   ./build-ffmpeg.sh              # defaults to "snapshot" (matches README)
#   ./build-ffmpeg.sh 7.1.1        # a pinned release (reproducible)
#
# Knobs (env overrides):
#   FFMPEG_CONFIGURE_FLAGS  replace the default configure flags entirely — e.g.
#                           to go component-minimal with --disable-everything +
#                           --enable-decoder=... for a few-MB audio-only binary.
#   LAME_PREFIX             libmp3lame install prefix (default: `brew --prefix
#                           lame`, falling back to /opt/homebrew/opt/lame).
#   FFMPEG_BUILD_DIR        override the work dir.
#
# Result binary + a size report are printed at the end.

set -euo pipefail

VERSION="${1:-snapshot}"
VERSION="${VERSION#v}" # tolerate a stray leading "v" on a release (e.g. v7.1.1)

script_dir=$(cd "$(dirname "$0")" && pwd)
# tmp/ is gitignored in this folder, so build junk never lands in the repo.
work_dir="${FFMPEG_BUILD_DIR:-$script_dir/tmp/ffmpeg-build}"
if [[ "$VERSION" == "snapshot" ]]; then
    tarball="ffmpeg-snapshot.tar.bz2"
else
    tarball="ffmpeg-${VERSION}.tar.bz2"
fi
src_url="https://ffmpeg.org/releases/${tarball}"
out_binary="${work_dir}/ffmpeg-${VERSION}-minimal"

# libmp3lame lives outside the SDK; find it via brew so this works on both
# Apple Silicon (/opt/homebrew) and Intel (/usr/local).
lame_prefix="${LAME_PREFIX:-$(brew --prefix lame 2>/dev/null || echo /opt/homebrew/opt/lame)}"

# --- minimal build knobs -----------------------------------------------------
# Each flag either enables the one thing we need (mp3) or drops a subsystem the
# yt-dlp mp3/merge flow never uses. Edit here (or export FFMPEG_CONFIGURE_FLAGS)
# to tune the tradeoff. --disable-autodetect makes the link set deterministic:
# only the libs named below get pulled in, regardless of what brew has installed
# (so no stray x264/x265/etc. bloating the binary).
default_flags=(
    --cc=clang
    --extra-version=owa-minimal # marks provenance in `ffmpeg -buildconf`
    --enable-gpl                # license umbrella (matches README)
    --enable-version3           # ""
    --disable-autodetect        # deterministic: only libs enabled below link in
    --enable-zlib               # needed by matroska/mov demuxers (compressed data)
    --enable-libmp3lame         # the one encoder we want: mp3
    --disable-shared            # static ffmpeg, no .dylib runtime deps
    --enable-static             # ""
    --enable-small              # optimize libav* for size, not speed
    --disable-doc               # no HTML/man/txt docs
    --disable-ffplay            # no player (would need SDL anyway)
    --disable-ffprobe           # yt-dlp works with just the ffmpeg binary
    --disable-network           # yt-dlp downloads; ffmpeg only sees local files
    --disable-avdevice          # drop libavdevice: no capture/playback devices
    --disable-debug             # no debug info in the binary
    # (libpostproc is already off by default — no --disable-postproc needed)
)
default_flags+=(
    --extra-cflags="-I${lame_prefix}/include"
    --extra-ldflags="-L${lame_prefix}/lib"
    --extra-libs="-lmp3lame"
)
if [[ -n "${FFMPEG_CONFIGURE_FLAGS:-}" ]]; then
    # shellcheck disable=SC2206
    configure_flags=(${FFMPEG_CONFIGURE_FLAGS})
else
    configure_flags=("${default_flags[@]}")
fi

# Parallel build jobs: nproc (Linux) or hw.ncpu (macOS), fallback 4.
if command -v nproc >/dev/null 2>&1; then
    jobs=$(nproc)
elif command -v sysctl >/dev/null 2>&1; then
    jobs=$(sysctl -n hw.ncpu)
else
    jobs=4
fi

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

# --- toolchain sanity check --------------------------------------------------
missing=()
for tool in curl tar make clang; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if ((${#missing[@]})); then
    echo "Error: missing build prerequisites: ${missing[*]}" >&2
    echo "Install Xcode command line tools (macOS) or build-essential + clang (Linux)." >&2
    exit 1
fi
# libmp3lame is the whole point of this build; fail early with a clear fix.
if [[ ! -f "${lame_prefix}/include/lame/lame.h" ]]; then
    echo "Error: libmp3lame headers not found under ${lame_prefix}." >&2
    echo "Install it (macOS: 'brew install lame') or set LAME_PREFIX." >&2
    exit 1
fi

log "Building minimal FFmpeg (${VERSION})  (jobs=${jobs})"
echo "    work dir : ${work_dir}"
echo "    lame     : ${lame_prefix}"
echo "    flags    : ${configure_flags[*]}"

mkdir -p "$work_dir"

# --- fetch (cached) ----------------------------------------------------------
# The "snapshot" tarball is a moving target; a pinned release is reproducible.
if [[ ! -f "${work_dir}/${tarball}" ]]; then
    log "Downloading ${src_url}"
    curl -fL --retry 3 -o "${work_dir}/${tarball}.part" "$src_url"
    mv "${work_dir}/${tarball}.part" "${work_dir}/${tarball}"
else
    log "Using cached ${tarball}"
fi

# --- extract -----------------------------------------------------------------
# Derive the top-level dir from the archive itself (snapshot extracts to
# ffmpeg/, a release to ffmpeg-<version>/) so we don't have to guess.
top_dir=$(tar -tf "${work_dir}/${tarball}" 2>/dev/null | head -1 | cut -d/ -f1)
src_dir="${work_dir}/${top_dir}"
if [[ ! -d "$src_dir" ]]; then
    log "Extracting ${tarball}"
    # macOS `tar` (bsdtar) decodes .bz2 natively; GNU tar shells out to bzip2.
    if ! tar -xf "${work_dir}/${tarball}" -C "$work_dir" 2>/dev/null; then
        if command -v bunzip2 >/dev/null 2>&1; then
            bunzip2 -dc "${work_dir}/${tarball}" | tar -xf - -C "$work_dir"
        else
            echo "Error: could not extract ${tarball}; install 'bzip2'." >&2
            exit 1
        fi
    fi
else
    log "Source already extracted at ${src_dir}"
fi

# --- configure + make --------------------------------------------------------
# No `make install`: with --disable-shared the built ./ffmpeg is a standalone
# static binary, so we grab it directly (no prefix pollution).
cd "$src_dir"
log "Configuring"
./configure "${configure_flags[@]}"

log "Compiling (this takes a while)"
make -j"${jobs}"

built="${src_dir}/ffmpeg"
if [[ ! -x "$built" ]]; then
    echo "Error: expected binary not found at ${built}" >&2
    exit 1
fi

# --- strip + collect ---------------------------------------------------------
cp "$built" "$out_binary"
if command -v strip >/dev/null 2>&1; then
    log "Stripping symbols"
    strip "$out_binary" || echo "  (strip failed — keeping unstripped binary)"
fi

# --- smoke test --------------------------------------------------------------
# Encode a real mp3 via libmp3lame — the exact capability the app depends on.
# Source is 1s of raw silence read as s16le from /dev/zero: this exercises the
# demux -> pcm-decode -> resample -> libmp3lame -> mp3-mux path without needing
# lavfi (which lives in the libavdevice we disable above).
log "Smoke test: encode 1s of silence to mp3 via libmp3lame"
if "$out_binary" -hide_banner -loglevel error \
    -f s16le -ar 44100 -ac 2 -i /dev/zero -t 1 \
    -c:a libmp3lame -q:a 5 -f mp3 -y /dev/null; then
    echo "    mp3 encode: OK"
else
    echo "    mp3 encode: FAILED — the binary cannot produce mp3 (check flags)" >&2
fi

size=$(du -h "$out_binary" | cut -f1)
log "Done."
echo "    binary : ${out_binary}"
echo "    version: $("$out_binary" -hide_banner -version 2>/dev/null | head -1)"
echo "    size   : ${size}"
echo
echo "Ship it by copying to the platform dir the app loads (ffmpeg/bin), e.g.:"
echo "    cp '${out_binary}' '${script_dir}/../ffmpeg/mac/ffmpeg'        # arm64"
echo "    cp '${out_binary}' '${script_dir}/../ffmpeg/mac-intel/ffmpeg'  # x86_64"
