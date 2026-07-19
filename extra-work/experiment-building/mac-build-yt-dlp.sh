#!/bin/bash
#
# Build yt-dlp (https://github.com/yt-dlp/yt-dlp) as a *self-contained standalone
# binary* from source, the same artifact the app ships and runs. The app invokes
# yt-dlp through yt-dlp-wrap (electron/client/ytUtils.ts -> bin-helper/yt/yt-dlp)
# to download audio/video and hand it to ffmpeg. Today extra-work/bin-helper/
# build.sh just DOWNLOADS the prebuilt release binary (yt-dlp_macos, a ~36MB
# universal PyInstaller bundle); this script builds that binary yourself from a
# pinned source tag instead — reproducible, and no trusting a prebuilt download.
#
# yt-dlp is pure Python, so unlike the sibling build-node/qjs/ffmpeg scripts
# there is no meaningful "feature-minimal" knob here: PyInstaller bundles a whole
# Python interpreter + the runtime deps into one executable. What this DOES do to
# keep it lean is run make_lazy_extractors first (defers importing the ~1800
# site extractors until one is actually used — faster startup, less resident
# memory, which matters on the app's low-spec target machines).
#
# Usage:
#   ./build-yt-dlp.sh [version]
#   ./build-yt-dlp.sh                 # defaults to 2026.07.04 (the shipped tag)
#   ./build-yt-dlp.sh 2026.07.04      # a pinned release tag (reproducible)
#   ./build-yt-dlp.sh master          # bleeding edge
#
# Knobs (env overrides):
#   PYTHON            interpreter to build with (default: first python >=3.10
#                     found: python3.13/3.12/.../3.10, then `python3`).
#   GIT               git to clone with (default: first git on PATH that has the
#                     https remote helper — some bundled gits, e.g. editors',
#                     ship without it and can't clone over https).
#   YTDLP_BUILD_DIR   override the work dir.
#
# NOTE: PyInstaller builds for the SAME CPU arch as the Python used, so this
# produces a single-arch binary (this host's arch). The official yt-dlp_macos
# release is a universal2 (arm64+x86_64) build made on a special runner; to match
# it you'd need a universal2 Python. The result here is also unsigned — fine to
# run locally; the app's own packaging step signs the shipped copy.
#
# Result binary + a size report are printed at the end.

set -euo pipefail

VERSION="${1:-2026.07.04}"
VERSION="${VERSION#v}" # tolerate a stray leading "v"

script_dir=$(cd "$(dirname "$0")" && pwd)
# tmp/ is gitignored in this folder, so build junk never lands in the repo.
work_dir="${YTDLP_BUILD_DIR:-$script_dir/tmp/yt-dlp-build}"
src_dir="${work_dir}/yt-dlp-src-${VERSION}"
venv_dir="${work_dir}/venv"
repo_url="https://github.com/yt-dlp/yt-dlp.git"
out_binary="${work_dir}/yt-dlp-${VERSION}-$(uname -m)"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

# --- pick a Python >=3.10 (yt-dlp's requires-python) --------------------------
# yt-dlp needs >=3.10; macOS system python3 is often 3.9. Honor $PYTHON, else
# probe the usual versioned names, else fall back to a `python3` that passes the
# version gate.
py_ok() { # $1 = interpreter; true if it runs and is >=3.10
    "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' \
        >/dev/null 2>&1
}
python=""
if [[ -n "${PYTHON:-}" ]]; then
    if py_ok "$PYTHON"; then python="$PYTHON"; fi
else
    for cand in python3.14 python3.13 python3.12 python3.11 python3.10 python3; do
        if command -v "$cand" >/dev/null 2>&1 && py_ok "$cand"; then
            python=$(command -v "$cand")
            break
        fi
    done
fi

# --- pick a git that can clone over https ------------------------------------
# Some bundled gits (e.g. the one shipped inside code editors) come WITHOUT the
# git-remote-https helper and fail the clone with "'remote-https' is not a git
# command". Probe for one that has it (checked via --exec-path, no network).
git_has_https() { # $1 = git binary
    local ep
    ep=$("$1" --exec-path 2>/dev/null) || return 1
    [[ -e "$ep/git-remote-https" || -e "$ep/git-remote-http" ]]
}
git_bin=""
for cand in "${GIT:-}" git /usr/bin/git /opt/homebrew/bin/git; do
    [[ -n "$cand" ]] || continue
    if command -v "$cand" >/dev/null 2>&1 && git_has_https "$cand"; then
        git_bin=$(command -v "$cand")
        break
    fi
done

# --- toolchain sanity check --------------------------------------------------
if ! command -v curl >/dev/null 2>&1; then
    echo "Error: missing build prerequisite: curl" >&2
    exit 1
fi
if [[ -z "$git_bin" ]]; then
    echo "Error: no git with https support found." >&2
    echo "Install git (macOS: 'xcode-select --install' or 'brew install git')," >&2
    echo "or point at one with GIT=/path/to/git $0 ${VERSION}." >&2
    exit 1
fi
if [[ -z "$python" ]]; then
    echo "Error: no Python >=3.10 found (yt-dlp requires it)." >&2
    echo "Install one and retry, e.g. 'brew install python' (macOS)," >&2
    echo "or point at it with PYTHON=/path/to/python3.xx $0 ${VERSION}." >&2
    exit 1
fi

log "Building yt-dlp ${VERSION}"
echo "    work dir : ${work_dir}"
echo "    python   : ${python}  ($("$python" --version 2>&1))"
echo "    git      : ${git_bin}"
echo "    source   : ${repo_url} @ ${VERSION}"

mkdir -p "$work_dir"

# --- fetch source (cached shallow checkout) ----------------------------------
# A shallow clone of the exact tag/branch gives yt-dlp correct version stamping.
if [[ ! -d "$src_dir/.git" ]]; then
    log "Cloning ${repo_url} @ ${VERSION}"
    rm -rf "$src_dir"
    "$git_bin" clone --depth 1 --branch "$VERSION" "$repo_url" "$src_dir"
else
    log "Using cached source at ${src_dir}"
fi

cd "$src_dir"

# --- isolated venv -----------------------------------------------------------
# Never touch system/site packages; build deps live only under work_dir.
if [[ ! -x "$venv_dir/bin/python" ]]; then
    log "Creating virtualenv at ${venv_dir}"
    "$python" -m venv "$venv_dir"
fi
vpy="$venv_dir/bin/python"
log "Upgrading pip tooling"
"$vpy" -m pip install -U pip wheel setuptools

# --- install build deps ------------------------------------------------------
# The documented build path: install runtime deps + the `pyinstaller` dependency
# group in one shot. Fall back to a plain editable install for older checkouts
# whose install_deps.py predates --include-group.
log "Installing dependencies (runtime + pyinstaller)"
if [[ -f devscripts/install_deps.py ]] \
    && "$vpy" devscripts/install_deps.py --include-group pyinstaller; then
    :
else
    echo "  (install_deps.py path unavailable — falling back to pip)"
    "$vpy" -m pip install -e ".[default]"
    "$vpy" -m pip install pyinstaller
fi

# --- lazy extractors (startup + memory win) ----------------------------------
if [[ -f devscripts/make_lazy_extractors.py ]]; then
    log "Generating lazy extractors"
    "$vpy" devscripts/make_lazy_extractors.py
fi

# --- bundle with PyInstaller (onefile by default) ----------------------------
log "Bundling standalone binary (this takes a few minutes)"
"$vpy" -m bundle.pyinstaller

# --- locate + collect --------------------------------------------------------
# The dist name is platform-specific (yt-dlp_macos / yt-dlp_linux_<arch> /
# yt-dlp.exe); glob for the produced regular file instead of hardcoding it.
built=""
for f in "$src_dir"/dist/yt-dlp*; do
    [[ -f "$f" ]] && built="$f" && break
done
if [[ -z "$built" || ! -x "$built" ]]; then
    echo "Error: no executable produced under ${src_dir}/dist" >&2
    exit 1
fi
# Do NOT strip: a PyInstaller onefile is a self-extracting archive; stripping it
# externally corrupts the bundle (PyInstaller's own --strip is the safe route).
cp "$built" "$out_binary"
chmod +x "$out_binary"

# --- smoke test --------------------------------------------------------------
log "Smoke test: yt-dlp --version"
"$out_binary" --version

size=$(du -h "$out_binary" | cut -f1)
log "Done."
echo "    binary : ${out_binary}"
echo "    arch   : $(uname -m) (single-arch; see the universal2 note in the header)"
echo "    size   : ${size}"
echo
echo "Ship it by copying to where the app loads yt-dlp, e.g.:"
echo "    cp '${out_binary}' '${script_dir}/../bin-helper/yt-dlp_macos_${VERSION}'"
echo "    # or into a running dist tree: bin-helper/dist/yt/yt-dlp"
