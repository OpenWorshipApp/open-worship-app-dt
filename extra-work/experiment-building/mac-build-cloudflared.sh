#!/bin/bash
#
# Build cloudflared (https://github.com/cloudflare/cloudflared) from source on
# macOS -- the binary Screen Mirror's internet tunnel runs
# (electron/screenMirrorTunnel.ts: `cloudflared tunnel --url ...`, Cloudflare's
# free quick tunnel). It ships in the extra-bin pack as cloudflared/cloudflared:
# extra-work/build-extra-bin.mjs picks it up from the platform dir below by the
# 'cloudflared' name prefix, the same way it picks up yt-dlp/ffmpeg/qjs.
#
# cloudflared is pure Go, so unlike the sibling scripts this one CAN build every
# pack platform from one host: with CGO_ENABLED=0 Go cross-compiles natively,
# and that is how Cloudflare builds its own Linux releases. Without cgo the
# macOS build still resolves names through the system (Go calls libSystem
# directly), and the Go linker gives the arm64 binary the ad-hoc signature
# Apple silicon needs to run it -- unsigned otherwise, like the sibling
# scripts' results. There is no "feature-minimal" knob; what keeps it lean is
# -trimpath and -ldflags "-s -w" (no symbol table, no DWARF).
#
# Go itself is NOT expected on this machine: a pinned toolchain is downloaded
# into the work dir, checked against go.dev's SHA-256, and used from there with
# its module/build caches kept beside it. GOTOOLCHAIN=local stops `go` fetching
# another one.
#
# Usage:
#   ./mac-build-cloudflared.sh [version] [targets]
#   ./mac-build-cloudflared.sh                     # 2026.9.3, this host's pack
#   ./mac-build-cloudflared.sh 2026.9.3 all        # every pack platform
#   ./mac-build-cloudflared.sh 2026.9.3 linux,mac  # a comma list of pack names
#
# Pack names (extra-work/buildPlatformHelpers.mjs): win, win-arm64, mac (Apple
# silicon), mac-int, linux, linux-arm64.
#
# Knobs (env overrides):
#   GO                     a go to build with instead of the pinned one (it
#                          must satisfy cloudflared's go.mod).
#   GIT                    git to clone with (default: git on PATH).
#   CLOUDFLARED_BUILD_DIR  override the work dir (default: ./tmp/cloudflared-build).
#   CLOUDFLARED_SHIP       set to 1 to copy each result straight into its
#                          platform dir, replacing the cloudflared* file already
#                          there (build-extra-bin.mjs takes the FIRST file
#                          matching the prefix). Default: print the copy commands.
#
# Only this host's own result is smoke-tested; the others are checked for their
# file header.

set -euo pipefail

VERSION="${1:-2026.9.3}"
VERSION="${VERSION#v}" # tolerate a stray leading "v"
TARGET_ARG="${2:-}"

case "$(uname -m)" in
x86_64 | amd64) host_arch=amd64 host_pack=mac-int ;;
aarch64 | arm64) host_arch=arm64 host_pack=mac ;;
*)
    echo "Error: unsupported host arch $(uname -m)" >&2
    exit 1
    ;;
esac

# Pack name -> Go target. Mirrors getPlatformDirName() in buildPlatformHelpers.mjs.
all_packs="win win-arm64 mac mac-int linux linux-arm64"
go_target() { # $1 = pack name; prints "goos goarch"
    case "$1" in
    win) echo "windows amd64" ;;
    win-arm64) echo "windows arm64" ;;
    mac) echo "darwin arm64" ;;
    mac-int) echo "darwin amd64" ;;
    linux) echo "linux amd64" ;;
    linux-arm64) echo "linux arm64" ;;
    *) return 1 ;;
    esac
}
if [[ -z "$TARGET_ARG" ]]; then
    packs="$host_pack"
elif [[ "$TARGET_ARG" == all ]]; then
    packs="$all_packs"
else
    packs="${TARGET_ARG//,/ }"
fi
for pack in $packs; do
    if ! go_target "$pack" >/dev/null; then
        echo "Error: unknown pack '$pack' (one of: $all_packs, or all)." >&2
        exit 1
    fi
done

# --- pinned Go toolchain -------------------------------------------------------
# The version cloudflared's own Dockerfile builds this tag with. Hashes are
# go.dev's (https://go.dev/dl/?mode=json&include=all).
go_version=1.26.8
go_archive="go${go_version}.darwin-${host_arch}.tar.gz"
case "$host_arch" in
amd64) go_sha256=186be014105aa6542b767d2c6ed5cca10a0214bdff809ef1724022a8c7894150 ;;
arm64) go_sha256=a012b25b571bd0138a03dcd25375ceba866fe5ca822f426d2c66a4de56fd3f4b ;;
esac

script_dir=$(cd "$(dirname "$0")" && pwd)
# tmp/ is gitignored (extra-work/.gitignore), so build junk never lands in the repo.
work_dir="${CLOUDFLARED_BUILD_DIR:-$script_dir/tmp/cloudflared-build}"
src_dir="${work_dir}/cloudflared-src-${VERSION}"
out_dir="${work_dir}/out-${VERSION}"
repo_url="https://github.com/cloudflare/cloudflared.git"
git_bin="${GIT:-git}"

log() { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }

for tool in "$git_bin" curl tar; do
    command -v "$tool" >/dev/null 2>&1 || {
        echo "Error: '$tool' is required (Xcode command line tools: 'xcode-select --install')." >&2
        exit 1
    }
done

mkdir -p "$work_dir"

# --- Go: $GO, else the pinned toolchain (downloaded once, hash-checked) --------
if [[ -n "${GO:-}" ]]; then
    go_bin="$GO"
else
    go_root="${work_dir}/go-${go_version}-darwin-${host_arch}"
    go_bin="${go_root}/go/bin/go"
    if [[ ! -x "$go_bin" ]]; then
        if [[ ! -f "$work_dir/$go_archive" ]]; then
            log "Downloading Go ${go_version} (${go_archive})"
            curl -fL --retry 3 -o "$work_dir/$go_archive.part" "https://go.dev/dl/${go_archive}"
            mv "$work_dir/$go_archive.part" "$work_dir/$go_archive"
        fi
        actual_sha256=$(shasum -a 256 "$work_dir/$go_archive" | cut -d' ' -f1)
        if [[ "$actual_sha256" != "$go_sha256" ]]; then
            rm -f "$work_dir/$go_archive"
            echo "Error: Go archive SHA-256 mismatch ($actual_sha256); deleted it -- run again." >&2
            exit 1
        fi
        log "Extracting Go ${go_version}"
        rm -rf "$go_root"
        mkdir -p "$go_root"
        tar -xzf "$work_dir/$go_archive" -C "$go_root"
    fi
fi

log "Building cloudflared ${VERSION}  (packs: ${packs})"
echo "    work dir : ${work_dir}"
echo "    go       : ${go_bin}  ($("$go_bin" version))"
echo "    source   : ${repo_url} @ ${VERSION}"

# --- fetch source (cached shallow checkout of the exact tag) --------------------
if [[ ! -d "$src_dir/.git" ]]; then
    log "Cloning ${repo_url} @ ${VERSION}"
    rm -rf "$src_dir"
    "$git_bin" -c advice.detachedHead=false clone --depth 1 --branch "$VERSION" "$repo_url" "$src_dir"
else
    log "Using cached source at ${src_dir}"
fi

# What `cloudflared --version` reports: the RELEASE_NOTES commit time, as
# cloudflared's Makefile stamps it, but in real UTC rather than this host's
# zone. With it and an empty build ID (the one part that differs between Go's
# Windows, macOS and Linux toolchains) every host builds the same bytes, so a
# committed binary can be checked by rebuilding it anywhere.
build_time=$(TZ=UTC0 "$git_bin" -C "$src_dir" log -1 --format='%ad' \
    --date=format-local:'%Y-%m-%dT%H:%M UTC' -- RELEASE_NOTES || true)
ldflags="-s -w -buildid= -X main.Version=${VERSION} -X 'main.BuildTime=${build_time:-unknown}'"

# Everything Go writes stays in the work dir.
export CGO_ENABLED=0 GOTOOLCHAIN=local GOFLAGS=-mod=readonly
export GOPATH="${work_dir}/gopath" GOMODCACHE="${work_dir}/gopath/pkg/mod"
export GOCACHE="${work_dir}/gocache"
unset GOOS GOARCH

cd "$src_dir"
log "Downloading Go modules"
"$go_bin" mod download

results=()
for pack in $packs; do
    read -r goos goarch <<<"$(go_target "$pack")"
    ext=""
    [[ "$goos" == windows ]] && ext=".exe"
    out_binary="${out_dir}/${pack}/cloudflared-${VERSION}-${goarch}${ext}"
    mkdir -p "$(dirname "$out_binary")"
    log "Compiling ${pack} (${goos}/${goarch})"
    GOOS="$goos" GOARCH="$goarch" "$go_bin" build -trimpath -ldflags "$ldflags" \
        -o "$out_binary" ./cmd/cloudflared
    results+=("${pack}|${goos}|${out_binary}")
done

# --- smoke test ------------------------------------------------------------------
# This host's own build runs; for the others the first bytes say whether the
# right kind of executable came out: Mach-O 64 (cffaedfe), ELF (7f454c46) or
# PE (4d5a).
for result in "${results[@]}"; do
    IFS='|' read -r pack goos out_binary <<<"$result"
    if [[ "$pack" == "$host_pack" ]]; then
        log "Smoke test (${pack}): cloudflared --version"
        "$out_binary" --version
        continue
    fi
    magic=$(head -c 4 "$out_binary" | od -An -tx1 | tr -d ' \n')
    case "$goos" in
    darwin) expected=cffaedfe ;;
    linux) expected=7f454c46 ;;
    windows) expected=4d5a ;;
    esac
    if [[ "$magic" != "$expected"* ]]; then
        echo "Error: ${pack}: unexpected file header '$magic' (expected '$expected')" >&2
        exit 1
    fi
    echo "    ${pack}: header ${magic} ok (not run on this host)"
done

# --- report + ship -----------------------------------------------------------------
log "Done."
for result in "${results[@]}"; do
    IFS='|' read -r pack _goos out_binary <<<"$result"
    printf '    %-12s %s  %s  sha256 %s\n' "$pack" "$(basename "$out_binary")" \
        "$(du -h "$out_binary" | cut -f1)" "$(shasum -a 256 "$out_binary" | cut -d' ' -f1)"
done
echo
if [[ "${CLOUDFLARED_SHIP:-}" == 1 ]]; then
    for result in "${results[@]}"; do
        IFS='|' read -r pack _goos out_binary <<<"$result"
        mkdir -p "${script_dir}/${pack}"
        rm -f "${script_dir}/${pack}"/cloudflared*
        cp "$out_binary" "${script_dir}/${pack}/"
        echo "Shipped ${pack}: ${script_dir}/${pack}/$(basename "$out_binary")"
    done
    echo "Bump extra-work/experiment-building/info.json and run 'node extra-work/build-extra-bin.mjs'."
else
    echo "Ship it by copying each into its platform dir (build-extra-bin.mjs picks it up by"
    echo "the 'cloudflared' name prefix and packs it as cloudflared/cloudflared[.exe]);"
    echo "remove the older cloudflared* file there first, or set CLOUDFLARED_SHIP=1:"
    for result in "${results[@]}"; do
        IFS='|' read -r pack _goos out_binary <<<"$result"
        echo "    cp '${out_binary}' '${script_dir}/${pack}/'"
    done
fi
