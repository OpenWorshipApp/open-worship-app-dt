#!/bin/bash
#
# Build a *minimal* QuickJS (Fabrice Bellard's small JS engine) from source —
# just the `qjs` interpreter, enough to run a script like
# `console.log('hello world')`. QuickJS is already tiny (~1MB), so "minimal"
# here means: build ONLY the `qjs` target (skip qjsc, run-test262, the example
# programs and the .so native modules that the default `make all` also builds),
# then strip the binary.
#
# Usage:
#   ./linux-build-qjs.sh [version]
#   ./linux-build-qjs.sh 2026-06-04   # explicit (releases are date-stamped)
#   ./linux-build-qjs.sh              # defaults to 2026-06-04
#
# Knobs (env overrides):
#   QJS_MAKE_TARGET  make target to build            (default: qjs)
#   QJS_MAKE_FLAGS   extra make variables, space-sep  (default: none)
#                    e.g. QJS_MAKE_FLAGS="CONFIG_LTO=y"  -> link-time
#                    optimization: smaller/faster binary, but slower build.
#   NODE_BUILD_DIR / QJS_BUILD_DIR  override the work dir.
#
# Result binary + a size report are printed at the end.

set -euo pipefail

VERSION="${1:-2026-06-04}"
VERSION="${VERSION#v}" # tolerate a stray leading "v"

script_dir=$(cd "$(dirname "$0")" && pwd)
# tmp/ is gitignored in this folder, so build junk never lands in the repo.
work_dir="${QJS_BUILD_DIR:-${NODE_BUILD_DIR:-$script_dir/tmp/qjs-build}}"
src_name="quickjs-${VERSION}"
tarball="${src_name}.tar.xz"
src_url="https://bellard.org/quickjs/${tarball}"
src_dir="${work_dir}/${src_name}"
out_binary="${work_dir}/qjs-${VERSION}-minimal"

# --- build knobs -------------------------------------------------------------
# QuickJS uses a plain Makefile (no ./configure). On Linux the Makefile selects
# gcc + system `ar` by default, and LTO is off, so a stock `make qjs` just
# works. We build only the `qjs` interpreter target for a minimal result.
make_target="${QJS_MAKE_TARGET:-qjs}"
if [[ -n "${QJS_MAKE_FLAGS:-}" ]]; then
    # shellcheck disable=SC2206
    make_vars=(${QJS_MAKE_FLAGS})
else
    make_vars=()
fi

# Parallel build jobs: nproc (Linux) or getconf, fallback 4.
if command -v nproc >/dev/null 2>&1; then
    jobs=$(nproc)
elif command -v getconf >/dev/null 2>&1; then
    jobs=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)
else
    jobs=4
fi

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

# --- toolchain sanity check --------------------------------------------------
missing=()
for tool in curl tar make; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
done
if ! command -v cc >/dev/null 2>&1 \
    && ! command -v gcc >/dev/null 2>&1 \
    && ! command -v clang >/dev/null 2>&1; then
    missing+=("a C compiler (cc/gcc/clang)")
fi
if ((${#missing[@]})); then
    echo "Error: missing build prerequisites: ${missing[*]}" >&2
    echo "Install build-essential (Debian/Ubuntu: 'sudo apt install build-essential curl xz-utils')" >&2
    echo "or the equivalent 'Development Tools' group (Fedora/RHEL: 'sudo dnf groupinstall \"Development Tools\"')." >&2
    exit 1
fi

log "Building minimal QuickJS ${VERSION}  (jobs=${jobs})"
echo "    work dir : ${work_dir}"
echo "    target   : ${make_target}"
echo "    make vars: ${make_vars[*]:-<none>}"

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
# GNU tar shells out to `xz` to decode .tar.xz, so xz-utils must be installed.
if [[ ! -d "$src_dir" ]]; then
    log "Extracting ${tarball}"
    if ! tar -xf "${work_dir}/${tarball}" -C "$work_dir" 2>/dev/null; then
        if command -v xz >/dev/null 2>&1; then
            xz -dc "${work_dir}/${tarball}" | tar -xf - -C "$work_dir"
        else
            echo "Error: could not extract ${tarball}; install 'xz' (xz-utils)." >&2
            exit 1
        fi
    fi
else
    log "Source already extracted at ${src_dir}"
fi

# --- make --------------------------------------------------------------------
cd "$src_dir"
log "Compiling"
# ${make_vars[@]+...} keeps this safe under `set -u` when the array is empty.
make -j"${jobs}" ${make_vars[@]+"${make_vars[@]}"} "${make_target}"

built="${src_dir}/qjs"
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

# qjs has no -v/--version flag; the version is printed in the --help header.
# --help exits non-zero, so tolerate that and take the first line without a pipe
# (a `| head -1` would SIGPIPE qjs and trip pipefail).
qjs_help=$("$out_binary" --help 2>&1 || true)
qjs_version=${qjs_help%%$'\n'*}
size=$(du -h "$out_binary" | cut -f1)
log "Done."
echo "    binary : ${out_binary}"
echo "    version: ${qjs_version}"
echo "    size   : ${size}"
