#!/bin/bash
#
# Build a *very minimal* Node.js from source — just enough to run a script like
# `console.log('hello world')`. Everything not needed for plain JS execution is
# compiled out to shrink the binary (no npm/corepack, no ICU/Intl, no inspector,
# no OpenSSL/crypto, no snapshot, and V8 built in "lite" mode = no JIT).
#
# Usage:
#   ./build-node.sh [version]
#   ./build-node.sh 24.18.0     # explicit
#   ./build-node.sh             # defaults to 24.18.0
#
# Override the configure flags entirely with NODE_CONFIGURE_FLAGS if you need to.
# Result binary + a size report are printed at the end.

set -euo pipefail

VERSION="${1:-24.18.0}"
VERSION="${VERSION#v}" # tolerate a leading "v" (e.g. v24.18.0)

script_dir=$(cd "$(dirname "$0")" && pwd)
# tmp/ is gitignored in this folder, so build junk never lands in the repo.
work_dir="${NODE_BUILD_DIR:-$script_dir/tmp/node-build}"
src_name="node-v${VERSION}"
tarball="${src_name}.tar.gz"
src_url="https://nodejs.org/dist/v${VERSION}/${tarball}"
src_dir="${work_dir}/${src_name}"
out_binary="${work_dir}/node-v${VERSION}-minimal"

# Parallel build jobs: nproc (Linux) or hw.ncpu (macOS), fallback 4.
if command -v nproc >/dev/null 2>&1; then
    jobs=$(nproc)
elif command -v sysctl >/dev/null 2>&1; then
    jobs=$(sysctl -n hw.ncpu)
else
    jobs=4
fi

# --- minimal build knobs -----------------------------------------------------
# Each flag drops a feature that `console.log('hello world')` does not need.
# Edit here (or export NODE_CONFIGURE_FLAGS) to tune the tradeoff.
default_flags=(
    --without-npm          # no npm
    --without-corepack     # no corepack shim
    --without-intl         # drop bundled ICU (no Intl / full-icu) — big size win
    --without-inspector    # no V8 inspector / --inspect debugging
    --without-node-snapshot # skip the startup snapshot builder
    --without-ssl          # no OpenSSL: no crypto/tls/https modules
    --v8-lite-mode         # V8 interpreter only, no JIT — smaller binary
)
if [[ -n "${NODE_CONFIGURE_FLAGS:-}" ]]; then
    # shellcheck disable=SC2206
    configure_flags=(${NODE_CONFIGURE_FLAGS})
else
    configure_flags=("${default_flags[@]}")
fi

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

# --- toolchain sanity check --------------------------------------------------
missing=()
for tool in curl tar make python3; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if ! command -v cc >/dev/null 2>&1 && ! command -v gcc >/dev/null 2>&1; then
    missing+=("a C/C++ compiler (cc/gcc/clang)")
fi
if ((${#missing[@]})); then
    echo "Error: missing build prerequisites: ${missing[*]}" >&2
    echo "Install Xcode command line tools (macOS) or build-essential + python3 (Linux)." >&2
    exit 1
fi

log "Building minimal Node.js v${VERSION}  (jobs=${jobs})"
echo "    work dir : ${work_dir}"
echo "    flags    : ${configure_flags[*]}"

mkdir -p "$work_dir"

# --- fetch (cached) ----------------------------------------------------------
if [[ ! -f "${work_dir}/${tarball}" ]]; then
    log "Downloading ${src_url}"
    curl -fL --retry 3 -o "${work_dir}/${tarball}.part" "$src_url"
    mv "${work_dir}/${tarball}.part" "${work_dir}/${tarball}"
else
    log "Using cached ${tarball}"
fi

# --- extract -----------------------------------------------------------------
if [[ ! -d "$src_dir" ]]; then
    log "Extracting ${tarball}"
    tar -xzf "${work_dir}/${tarball}" -C "$work_dir"
else
    log "Source already extracted at ${src_dir}"
fi

# --- configure + make --------------------------------------------------------
cd "$src_dir"
log "Configuring"
python3 ./configure "${configure_flags[@]}"

log "Compiling (this takes a while)"
make -j"${jobs}"

built="${src_dir}/out/Release/node"
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
log "Smoke test: console.log('hello world')"
"$out_binary" -e "console.log('hello world')"

size=$(du -h "$out_binary" | cut -f1)
log "Done."
echo "    binary : ${out_binary}"
echo "    version: $("$out_binary" -v)"
echo "    size   : ${size}"
