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
# This is the Linux sibling of mac-build-ffmpeg.sh: same minimal component set,
# but it targets gcc/cc and finds libmp3lame via the system paths that
# libmp3lame-dev installs to (/usr) instead of Homebrew. It keeps the full
# decoder/demuxer set on purpose — YouTube et al. serve audio as AAC (m4a),
# Opus/Vorbis (webm/ogg), etc., and dropping those would silently break
# extraction for some sources — but drops the fat: docs, the player, the probe
# binary, the network/TLS layer, capture devices, postproc, and debug info,
# plus --enable-small to optimize libav* for size.
#
# Usage:
#   ./linux-build-ffmpeg.sh [version]
#   ./linux-build-ffmpeg.sh              # defaults to "snapshot" (matches README)
#   ./linux-build-ffmpeg.sh 7.1.1        # a pinned release (reproducible)
#
# Knobs (env overrides):
#   FFMPEG_CONFIGURE_FLAGS  replace the default configure flags entirely — e.g.
#                           to go component-minimal with --disable-everything +
#                           --enable-decoder=... for a few-MB audio-only binary.
#   LAME_PREFIX             libmp3lame install prefix (default: /usr, falling
#                           back to /usr/local). Set this if lame lives
#                           elsewhere (e.g. a custom prefix).
#   FFMPEG_BUILD_DIR        override the work dir.
#
# Result binary + a size report are printed at the end.

set -euo pipefail

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

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

# libmp3lame headers/libs. libmp3lame-dev (Debian/Ubuntu) / lame-devel
# (Fedora/RHEL) install into /usr; a hand-built lame usually lands in
# /usr/local. Autodetect between them, letting LAME_PREFIX win.
if [[ -n "${LAME_PREFIX:-}" ]]; then
    lame_prefix="$LAME_PREFIX"
elif [[ -f /usr/include/lame/lame.h ]]; then
    lame_prefix="/usr"
else
    lame_prefix="/usr/local"
fi

# How to link libmp3lame into the ffmpeg binary:
#   static  (default) -> bake libmp3lame.a in, so the result has NO libmp3lame.so
#                        runtime dep and is self-contained re: lame (still needs
#                        the system glibc/zlib). This is what you want to ship.
#   dynamic           -> plain -lmp3lame; the linker prefers libmp3lame.so, so the
#                        target machine must have libmp3lame installed.
# libmp3lame-dev ships both .a and .so, so with a plain -lmp3lame the linker
# picks the .so by default — hence the explicit -Bstatic wrapping below.
lame_link="${LAME_LINK:-static}"

# On Linux the default compiler is gcc; ffmpeg's configure autodetects it, but
# be explicit for a deterministic build and pick the first one available.
if command -v cc >/dev/null 2>&1; then
    cc="cc"
elif command -v gcc >/dev/null 2>&1; then
    cc="gcc"
elif command -v clang >/dev/null 2>&1; then
    cc="clang"
else
    cc=""
fi

# --- minimal build knobs -----------------------------------------------------
# Each flag either enables the one thing we need (mp3) or drops a subsystem the
# yt-dlp mp3/merge flow never uses. Edit here (or export FFMPEG_CONFIGURE_FLAGS)
# to tune the tradeoff. --disable-autodetect makes the link set deterministic:
# only the libs named below get pulled in, regardless of what dev packages are
# installed (so no stray x264/x265/etc. bloating the binary).
default_flags=(
    --extra-version=owa-minimal # marks provenance in `ffmpeg -buildconf`
    --enable-gpl                # license umbrella (matches README)
    --enable-version3           # ""
    --disable-autodetect        # deterministic: only libs enabled below link in
    --enable-zlib               # needed by matroska/mov demuxers (compressed data)
    --enable-libmp3lame         # the one encoder we want: mp3
    --disable-shared            # static libav*, no runtime .so from our libs
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
# Only force --cc when we found one; otherwise let configure autodetect.
if [[ -n "$cc" ]]; then
    default_flags+=(--cc="$cc")
fi
# Force-static lame needs the archive; if it isn't there, fall back to dynamic
# with a warning rather than producing a broken link line.
if [[ "$lame_link" == "static" ]]; then
    lame_static_lib=$(find "${lame_prefix}/lib" -name 'libmp3lame.a' 2>/dev/null | head -1) || true
    if [[ -z "$lame_static_lib" ]]; then
        log "WARNING: LAME_LINK=static but no libmp3lame.a under ${lame_prefix}/lib"
        echo "    Falling back to dynamic linking (the binary will need libmp3lame.so"
        echo "    at runtime). Install the static lib (Debian/Ubuntu: 'libmp3lame-dev'"
        echo "    provides it) or set LAME_PREFIX to a prefix that has libmp3lame.a."
        lame_link="dynamic"
    fi
fi
# Force static lame by making the .a the ONLY libmp3lame on the linker's search
# path. ld searches -L dirs in order and, per dir, prefers .so over .a; it stops
# at the first dir that has the lib. A plain `-Wl,-Bstatic -lmp3lame` in
# --extra-libs does NOT work here: configure's own `--enable-libmp3lame`
# detection injects a plain (dynamic) `-lmp3lame` EARLIER on the link line, so
# the .so binds first and wins. Instead we copy libmp3lame.a into its own dir
# and prepend -L to it, so every `-lmp3lame` (configure's and ours) resolves to
# the archive. libc/libm/libz are unaffected — they live in the normal lib dirs.
if [[ "$lame_link" == "static" ]]; then
    lame_static_dir="${work_dir}/lame-static-only"
    mkdir -p "$lame_static_dir"
    cp -f "$lame_static_lib" "${lame_static_dir}/libmp3lame.a"
    lame_ldflags="-L${lame_static_dir} -L${lame_prefix}/lib"
else
    lame_ldflags="-L${lame_prefix}/lib"
fi
default_flags+=(
    --extra-cflags="-I${lame_prefix}/include"
    --extra-ldflags="${lame_ldflags}"
    --extra-libs="-lmp3lame"
)
# FFmpeg's x86 DSP is hand-written in nasm/yasm assembly; configure hard-errors
# if neither assembler is present. Rather than fail, fall back to --disable-x86asm
# so the build still produces a working binary — but warn loudly, because the
# no-asm build is slower (this app targets low-spec machines, so for a shippable
# binary install nasm and rebuild to get the optimized one).
if ! command -v nasm >/dev/null 2>&1 && ! command -v yasm >/dev/null 2>&1; then
    log "WARNING: nasm/yasm not found — building WITHOUT x86 hand-optimized assembly"
    echo "    The binary will run slower. For an optimized (shippable) build, install"
    echo "    an assembler and rebuild: Debian/Ubuntu 'sudo apt install nasm',"
    echo "    Fedora/RHEL 'sudo dnf install nasm'."
    default_flags+=(--disable-x86asm)
fi

if [[ -n "${FFMPEG_CONFIGURE_FLAGS:-}" ]]; then
    # shellcheck disable=SC2206
    configure_flags=(${FFMPEG_CONFIGURE_FLAGS})
else
    configure_flags=("${default_flags[@]}")
fi

# Parallel build jobs: nproc (Linux) or getconf, fallback 4.
if command -v nproc >/dev/null 2>&1; then
    jobs=$(nproc)
elif command -v getconf >/dev/null 2>&1; then
    jobs=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
else
    jobs=4
fi

# --- toolchain sanity check --------------------------------------------------
missing=()
for tool in curl tar make; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if [[ -z "$cc" ]]; then
    missing+=("a C compiler (cc/gcc/clang)")
fi
if ((${#missing[@]})); then
    echo "Error: missing build prerequisites: ${missing[*]}" >&2
    echo "Install build-essential (Debian/Ubuntu: 'sudo apt install build-essential curl bzip2')" >&2
    echo "or the equivalent 'Development Tools' group (Fedora/RHEL: 'sudo dnf groupinstall \"Development Tools\"')." >&2
    exit 1
fi
# libmp3lame is the whole point of this build; fail early with a clear fix.
if [[ ! -f "${lame_prefix}/include/lame/lame.h" ]]; then
    echo "Error: libmp3lame headers not found under ${lame_prefix}." >&2
    echo "Install it (Debian/Ubuntu: 'sudo apt install libmp3lame-dev';" >&2
    echo "Fedora/RHEL: 'sudo dnf install lame-devel') or set LAME_PREFIX." >&2
    exit 1
fi

log "Building minimal FFmpeg (${VERSION})  (jobs=${jobs})"
echo "    work dir : ${work_dir}"
echo "    compiler : ${cc:-<autodetect>}"
echo "    lame     : ${lame_prefix}  (link: ${lame_link})"
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
# `head` closes the pipe early, SIGPIPE-ing GNU tar; the trailing `|| true`
# keeps that from tripping `set -o pipefail` (the value is still captured
# before the exit status is checked). See linux-build-qjs.sh for the same trap.
top_dir=$(tar -tf "${work_dir}/${tarball}" 2>/dev/null | head -1 | cut -d/ -f1) || true
src_dir="${work_dir}/${top_dir}"
if [[ ! -d "$src_dir" ]]; then
    log "Extracting ${tarball}"
    # GNU tar shells out to `bzip2` to decode .tar.bz2, so bzip2 must be present.
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
# Force the final link every run: on a reconfigure (e.g. changing LAME_LINK) the
# object files are unchanged, so make would otherwise hand back the previously
# linked ffmpeg and silently ignore the new link flags.
rm -f ffmpeg ffmpeg_g
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
echo "    cp '${out_binary}' '${script_dir}/../ffmpeg/linux/ffmpeg'"
