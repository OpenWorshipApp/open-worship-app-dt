#!/bin/bash
# Publishes the packages for the CURRENT host platform: packs them, stages every
# artifact under `extra-work/tmp/<platform prefix>` beside a `files.txt`
# manifest, then hands the whole staging dir to `s3-push-release.js`.
#
#   npm run release          -- the real thing: resets to the release tag, uploads
#                               to S3 and invalidates the CDN cache.
#   npm run release:dry-run  -- same packs, but git is left alone and the push
#                               writes into `extra-work/fake-s3` instead.
#                               `RELEASE_SKIP_INSTALL=true` additionally skips the
#                               (slow) dependency reinstall -- dry runs only.
set -euo pipefail

current_script_dir=$(dirname "$0")
cd "$current_script_dir/.."
git pull
pwd

release_dir="./release"
tmp_dir="./extra-work/tmp"
backup_dir="$tmp_dir/backup-release"
failed_dir="$tmp_dir/failed-release"
env_file="./extra-work/.env"
bin_file_info="files.txt"
sep="|"
extra_bin_dir_name="extra-bin"
extra_bin_src_dir="./extra-work/experiment-building/release"

is_dry_run=${RELEASE_DRY_RUN:-false}
is_skipping_install=${RELEASE_SKIP_INSTALL:-false}
start_seconds=$SECONDS
# Filled in by `start_prep`, one entry per platform prefix, printed at the end.
staged_dir_list=()
# Resolved by `preflight`: coreutils on Windows/Linux, `shasum` on macOS.
checksum_command=""

log_step() {
    local elapsed=$((SECONDS - start_seconds))
    printf '\n=== [%02d:%02d] %s ===\n' $((elapsed / 60)) $((elapsed % 60)) "$1"
}

fail() {
    echo "Error: $1" >&2
    exit 1
}

abort() {
    echo "Release process aborted."
    exit 1
}

confirm() {
    local answer=""
    # A closed stdin (a non-interactive shell) must read as "no", not as an
    # unexplained `set -e` abort.
    if ! read -r -p "$1 (y/n): " answer; then
        answer=""
    fi
    [[ "$answer" == "y" || "$answer" == "Y" ]]
}

gen_checksum() {
    if [[ "$checksum_command" == "shasum" ]]; then
        shasum -a 512 "$1" | awk '{print $1}'
    else
        sha512sum "$1" | awk '{print $1}'
    fi
}

gen_size() {
    du -sh "$1" 2>/dev/null | awk '{print $1}' || true
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        fail "the \"$1\" command is required but was not found."
    fi
}

# The push needs the credentials, so they are read BEFORE anything expensive
# runs: finding out that one is missing after a 20-minute pack throws the whole
# build away. A dry run never reaches AWS, so there they are only a warning.
load_env() {
    if [[ ! -f "$env_file" ]]; then
        if [[ "$is_dry_run" == "true" ]]; then
            echo "WARNING: \"$env_file\" not found - a dry run never reaches AWS"
            return
        fi
        fail "\"$env_file\" not found. Copy \"$env_file-example\" and fill it in."
    fi
    # shellcheck source=/dev/null
    source "$env_file"
    local missing_name_list=()
    local name
    for name in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION \
        AWS_BUCKET_NAME AWS_DISTRIBUTION_ID; do
        if [[ -z "${!name:-}" ]]; then
            missing_name_list+=("$name")
        fi
    done
    if [[ ${#missing_name_list[@]} -gt 0 ]]; then
        local missing="${missing_name_list[*]}"
        if [[ "$is_dry_run" == "true" ]]; then
            echo "WARNING: empty in \"$env_file\": $missing"
            return
        fi
        fail "empty in \"$env_file\": $missing"
    fi
}

preflight() {
    log_step "Preflight"
    local command_name
    for command_name in node npm git awk grep du; do
        require_command "$command_name"
    done
    if command -v sha512sum >/dev/null 2>&1; then
        checksum_command="sha512sum"
    elif command -v shasum >/dev/null 2>&1; then
        checksum_command="shasum"
    else
        fail "neither \"sha512sum\" nor \"shasum\" is available to checksum the artifacts."
    fi
    load_env
    echo "Preflight passed."
}

# `git reset --hard` below is unrecoverable, so anything it would throw away is
# shown and confirmed first. Untracked files survive a reset and are not asked
# about.
check_worktree_is_clean() {
    local dirty
    dirty=$(git status --porcelain --untracked-files=no)
    if [[ -z "$dirty" ]]; then
        return
    fi
    echo "The working tree has uncommitted changes:"
    echo "$dirty"
    echo "Resetting to the release tag will DISCARD them permanently."
    if ! confirm "Continue anyway?"; then
        abort
    fi
}

reset_to_release_tag() {
    local release_tag="release-$1"
    # Ask for the tag ref explicitly -- a bare `git rev-parse` also answers for a
    # branch or a raw sha that happens to carry the same name.
    if ! git rev-parse --verify --quiet "refs/tags/$release_tag^{commit}" >/dev/null; then
        echo "Error: Tag '$release_tag' does not exist."
        echo "Run \`npm run release:version\` then \`npm run release:tag\` to create the tag first."
        exit 1
    fi
    local commit_hash
    commit_hash=$(git rev-parse "refs/tags/$release_tag^{commit}")
    echo "Resetting to tag '$release_tag' ($commit_hash)."
    git reset --hard "$commit_hash"
}

install_dependencies() {
    log_step "Installing dependencies"
    if [[ "$is_skipping_install" == "true" ]]; then
        if [[ "$is_dry_run" == "true" ]]; then
            echo "Skipping \`npm run i:d\` (RELEASE_SKIP_INSTALL=true)."
            return
        fi
        # A published build has to come out of a clean install, whatever the
        # environment says.
        echo "WARNING: RELEASE_SKIP_INSTALL is honored on a dry run only; installing anyway."
    fi
    npm run i:d
}

is_linux_ubuntu() {
    if command -v lsb_release &> /dev/null; then
        local distro_id
        distro_id=$(lsb_release -is)
        if [[ "$distro_id" == "Ubuntu" || "$distro_id" == "Linuxmint" ]]; then
            echo "true"
        fi
    fi
}

is_linux_fedora() {
    if [[ -f /etc/os-release ]]; then
        # Sourced in a subshell: `/etc/os-release` defines a dozen generic names
        # (`ID`, `NAME`, `VERSION`, ...) that have no business leaking into the
        # rest of the release.
        local distro_ids
        distro_ids=$(. /etc/os-release; echo "${ID:-} ${ID_LIKE:-}")
        if [[ "$distro_ids" =~ (^|[[:space:]])(fedora|rhel|centos|rocky|almalinux)($|[[:space:]]) ]]; then
            echo "true"
        fi
    fi
}

export RELEASE_LINUX_IS_UBUNTU=$(is_linux_ubuntu)
export RELEASE_LINUX_IS_FEDORA=$(is_linux_fedora)

# The media helpers are no longer inside the packages: `build-extra-bin.mjs`
# writes one `bin-<version>.tar.gz` per platform into extra_bin_src_dir, and it
# is picked up here right after the pack that produced it. Missing is a warning,
# not a failure -- only some platforms have committed binaries.
copy_extra_bin() {
    local target_dir="$1"
    local info_file="$extra_bin_src_dir/bin-info.json"
    if [[ ! -f "$info_file" ]]; then
        echo "WARNING: no extra-bin pack for \"$target_dir\" - it will not be published"
        return
    fi
    # Take the name from `bin-info.json` instead of globbing the dir: that file
    # also carries the checksum the app verifies after downloading, so a pack the
    # glob picked but the info file does not describe would publish a checksum
    # that can never match and every install would fail the integrity check.
    local tar_name
    tar_name=$(node -p "require('$info_file').fileFullName ?? ''")
    local tar_path="$extra_bin_src_dir/$tar_name"
    if [[ -z "$tar_name" || ! -f "$tar_path" ]]; then
        fail "\"$info_file\" names \"$tar_name\", which is not in \"$extra_bin_src_dir\"."
    fi
    local expected_checksum actual_checksum
    expected_checksum=$(node -p "require('$info_file').checksum ?? ''")
    actual_checksum=$(gen_checksum "$tar_path")
    if [[ "$expected_checksum" != "$actual_checksum" ]]; then
        fail "\"$tar_path\" does not match the checksum in \"$info_file\"; re-run \`node ./extra-work/build-extra-bin.mjs\`."
    fi
    mkdir -p "$target_dir/$extra_bin_dir_name"
    cp "$tar_path" "$target_dir/$extra_bin_dir_name/"
    cp "$info_file" "$target_dir/$extra_bin_dir_name/"
    echo "  $tar_name ($(gen_size "$tar_path")) [extra-bin]"
}

start_prep() {
    local target_dir="$1"
    if [[ ! -d "$release_dir" ]]; then
        fail "\"$release_dir\" does not exist - the pack for \"$target_dir\" produced nothing."
    fi
    mv "$release_dir" "$target_dir"
    local target_file="$target_dir/$bin_file_info"
    rm -f "$target_file"
    touch "$target_file"
    copy_extra_bin "$target_dir"
    staged_dir_list+=("$target_dir")
}

append_file_info() {
    local target_dir="$1" file_path="$2" checksum="$3" yml_file="$4"
    if [[ ! -f "$yml_file" ]]; then
        fail "\"$yml_file\" not found - electron-builder did not finish."
    fi
    local file_name version release_date
    file_name=$(basename "$file_path")
    version=$(grep -m1 -E '^version:' "$yml_file" | awk '{print $2}' | tr -d "'" || true)
    release_date=$(grep -m1 -E '^releaseDate:' "$yml_file" | awk '{print $2}' | tr -d "'" || true)
    if [[ -z "$version" || -z "$release_date" ]]; then
        fail "no \"version\"/\"releaseDate\" in \"$yml_file\"."
    fi
    # 2026.6.1 => 2026.06.01
    version=$(echo "$version" | awk -F. '{printf "%02d.%02d.%02d", $1, $2, $3}')
    echo "${file_name}${sep}${checksum}${sep}${release_date}${sep}${version}${sep}${latest_commit}" \
        >> "$target_dir/$bin_file_info"
}

# Collected by glob, not by `ls | grep`: the names carry spaces ("Open Worship
# app-2026.6.1-win.exe") and an empty result has to be an error here -- it would
# otherwise reach the push script as an empty `files.txt`, whose first line it
# reads for the version.
collect_artifacts() {
    local target_dir="$1" yml_file="$2"
    shift 2
    local extension file checksum
    local count=0
    shopt -s nullglob
    for extension in "$@"; do
        for file in "$target_dir"/*"$extension"; do
            checksum=$(gen_checksum "$file")
            append_file_info "$target_dir" "$file" "$checksum" "$yml_file"
            echo "  $(basename "$file") ($(gen_size "$file"))"
            count=$((count + 1))
        done
    done
    shopt -u nullglob
    if [[ $count -eq 0 ]]; then
        fail "no \"$*\" artifact in \"$target_dir\"."
    fi
    echo "Staged $count artifact(s) in \"$target_dir\"."
}

win_prep() {
    start_prep "$1"
    collect_artifacts "$1" "$1/latest.yml" '.exe' '.zip'
}

mac_prep() {
    start_prep "$1"
    collect_artifacts "$1" "$1/latest-mac.yml" '.dmg' '.zip'
}

linux_prep() {
    start_prep "$1"
    local file
    shopt -s nullglob
    for file in "$1"/*.AppImage "$1"/*.deb "$1"/*.rpm; do
        chmod +x "$file"
    done
    shopt -u nullglob
    if [[ "$2" == "fedora" ]]; then
        collect_artifacts "$1" "$1/latest-linux.yml" '.rpm' '.AppImage'
    else
        collect_artifacts "$1" "$1/latest-linux.yml" '.deb' '.AppImage'
    fi
}

# `npm i` builds the pack once, for the HOST arch. Every packed arch is the host
# arch now, so the pack is simply rebuilt right before each `electron-builder`
# run to make sure it matches what `copy-build.mjs` copies in.
build_extra_bin() {
    node ./extra-work/build-extra-bin.mjs
}

build_release() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        process=$(node -p "process.arch")
        if [[ "$process" == "arm64" ]]; then
            log_step "Packing win-arm64"
            build_extra_bin
            npm run pack:win
            win_prep "$tmp_dir/win-arm64"
        else
            log_step "Packing win"
            build_extra_bin
            npm run pack:win
            win_prep "$tmp_dir/win"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        build_extra_bin
        if [[ "$(uname -m)" == "arm64" ]]; then
            log_step "Packing mac"
            npm run pack:mac
            mac_prep "$tmp_dir/mac"
        else
            log_step "Packing mac-intel"
            npm run pack:mac
            mac_prep "$tmp_dir/mac-intel"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        build_extra_bin
        if [[ "$RELEASE_LINUX_IS_UBUNTU" == "true" ]]; then
            log_step "Packing linux-ubuntu"
            npm run pack:linux
            linux_prep "$tmp_dir/linux-ubuntu" "ubuntu"
        elif [[ "$RELEASE_LINUX_IS_FEDORA" == "true" ]]; then
            log_step "Packing linux-fedora"
            npm run pack:linux
            linux_prep "$tmp_dir/linux-fedora" "fedora"
        else
            fail "Unsupported Linux distribution"
        fi
    else
        fail "Unsupported OS: $OSTYPE"
    fi
}

# `./release` is moved aside for the whole pack so electron-builder starts from
# an empty dir. Whatever ends the run in between -- a failed pack, Ctrl+C -- has
# to put it back: the next run wipes `$tmp_dir`, and it would take the previous
# release output with it.
restore_release_dir() {
    if [[ ! -d "$backup_dir" ]]; then
        return
    fi
    if [[ -e "$release_dir" ]]; then
        rm -rf "$failed_dir"
        mv "$release_dir" "$failed_dir"
        echo "Kept the unfinished pack in \"$failed_dir\"."
    fi
    mv "$backup_dir" "$release_dir"
}

package_version=$(node -p "require('./package.json').version")
if [[ "$is_dry_run" == "true" ]]; then
    echo "!!!Dry run mode!!!"
fi

preflight

if [[ "$is_dry_run" == "true" ]]; then
    target_title="fake S3 (\"./extra-work/fake-s3\")"
else
    target_title="S3 bucket \"${AWS_BUCKET_NAME:-}\""
fi
echo "Preparing release for version: $package_version"
echo "  tag    : release-$package_version"
echo "  target : $target_title"

if [[ "$is_dry_run" != "true" ]]; then
    check_worktree_is_clean
    if ! confirm "Do you want to continue?"; then
        abort
    fi
    reset_to_release_tag "$package_version"
fi

install_dependencies

# After the reset, so it names the commit that is actually being published.
latest_commit=$(git rev-parse HEAD)

log_step "Preparing the staging dir"
# A run that was killed outright (no trap) leaves the backup behind; recover it
# rather than wiping it with the rest of the staging dir.
if [[ -d "$backup_dir" && ! -e "$release_dir" ]]; then
    echo "Recovering \"$release_dir\" from an interrupted run."
    mv "$backup_dir" "$release_dir"
fi
rm -rf "$tmp_dir"
mkdir -p "$tmp_dir"

mkdir -p "$release_dir"
mv "$release_dir" "$backup_dir"
trap restore_release_dir EXIT

build_release

restore_release_dir
trap - EXIT

log_step "Pushing to $target_title"
export RELEASE_DRY_RUN="$is_dry_run"
export RELEASE_AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
export RELEASE_AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
export RELEASE_AWS_REGION="${AWS_REGION:-}"
export RELEASE_AWS_BUCKET_NAME="${AWS_BUCKET_NAME:-}"
export RELEASE_AWS_DISTRIBUTION_ID="${AWS_DISTRIBUTION_ID:-}"
export RELEASE_STORAGE_DIR="$tmp_dir"
export RELEASE_BIN_FILE_SEPARATOR="$sep"
export RELEASE_BIN_FILE_INFO="$bin_file_info"
export RELEASE_EXTRA_BIN_DIR_NAME="$extra_bin_dir_name"
node ./extra-work/s3-push-release.js

log_step "Published $package_version ($latest_commit) to $target_title"
if [[ ${#staged_dir_list[@]} -gt 0 ]]; then
    for staged_dir in "${staged_dir_list[@]}"; do
        echo "  $staged_dir ($(gen_size "$staged_dir"))"
    done
fi

if [[ "$is_dry_run" != "true" ]]; then
    echo "Release process completed successfully."
    git pull
else
    echo "Dry run completed successfully. No changes were made."
fi
