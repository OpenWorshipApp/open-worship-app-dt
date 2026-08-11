#!/bin/bash
set -e

current_script_dir=$(dirname "$0")
cd "$current_script_dir/.."
pwd

package_version=$(node -p "require('./package.json').version")
# ask for confirmation for the version
echo "Preparing release for version: $package_version"
read -p "Do you want to continue? (y/n): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Release process aborted."
    exit 1
fi
release_tag="release-$package_version"

git pull
# reset main to release tag
# check tag exists
if ! git rev-parse "$release_tag" >/dev/null 2>&1; then
    echo "Error: Tag '$release_tag' does not exist."
    echo "Run \`npm run release:version\` then \`npm run release:tag\` to create the tag first."
    exit 1
fi
commit_hash=$(git rev-list -n 1 "$release_tag")
git reset --hard "$commit_hash"

npm i

release_dir="./release"
tmp_dir="./extra-work/tmp"
bin_file_info="files.txt"
sep="|"
latest_commit=$(git rev-parse HEAD)
extra_bin_dir_name="extra-bin"
extra_bin_src_dir="./extra-work/experiment-building/release"

is_linux_ubuntu() {
    if command -v lsb_release &> /dev/null; then
        if [[ "$(lsb_release -is)" == "Ubuntu" || "$(lsb_release -is)" == "Linuxmint" ]]; then
            echo "true"
        fi
    fi
}

is_linux_fedora() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        distro_ids="${ID:-} ${ID_LIKE:-}"
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
    shopt -s nullglob
    tar_files=("$extra_bin_src_dir"/bin-*.tar.gz)
    shopt -u nullglob
    if [[ ${#tar_files[@]} -eq 0 ]]; then
        echo "WARNING: no extra-bin pack for \"$1\" - it will not be published"
        return
    fi
    mkdir -p "$1/$extra_bin_dir_name"
    cp "${tar_files[0]}" "$1/$extra_bin_dir_name/"
    cp "$extra_bin_src_dir/bin-info.json" "$1/$extra_bin_dir_name/"
}

start_prep() {
    mv $release_dir $1
    target_file="$1/$bin_file_info"
    rm -f "$target_file"
    touch "$target_file"
    copy_extra_bin "$1"
}

append_file_info() {
    target_file="$1/$bin_file_info"
    file_name=$(basename "$2")
    version=$(grep 'version:' "$4" | awk '{print $2}' | tr -d "'")
    # 2026.6.1 => 2026.06.01
    version=$(echo "$version" | awk -F. '{printf "%02d.%02d.%02d", $1, $2, $3}')
    release_date=$(grep 'releaseDate:' "$4" | awk '{print $2}' | tr -d "'")
    echo "${file_name}${sep}$3${sep}${release_date}${sep}${version}${sep}${latest_commit}" >> "$target_file"
}

win_prep() {
    start_prep "$1"
    ls "$1" | grep -E '\.exe$|\.zip$' | while read -r file; do
        checksum=$(sha512sum "$1/$file" | awk '{print $1}')
        append_file_info "$1" "$file" "$checksum" "$1/latest.yml"
    done
}

mac_prep() {
    start_prep "$1"
    ls "$1" | grep -E "$2\.dmg$|$2\.zip$" | while read -r file; do
        checksum=$(shasum -a 512 "$1/$file" | awk '{print $1}')
        append_file_info "$1" "$file" "$checksum" "$1/latest-mac.yml"
    done
}

linux_prep() {
    start_prep "$1"
    shopt -s nullglob
    chmod +x "$1"/*.AppImage "$1"/*.deb "$1"/*.rpm 2>/dev/null
    shopt -u nullglob
    if [[ "$2" == "fedora" ]]; then
        file_pattern='\.rpm$|\.AppImage$'
    else
        file_pattern='\.deb$|\.AppImage$'
    fi
    ls "$1" | grep -E "$file_pattern" | while read -r file; do
        checksum=$(sha512sum "$1/$file" | awk '{print $1}')
        append_file_info "$1" "$file" "$checksum" "$1/latest-linux.yml"
    done
}

# `npm i` builds the pack once, for the HOST arch. A run that packs more than one
# arch from the same tree (win x64 + win-ia32) has to rebuild it per arch, with
# the same FORCE_ARCH_32 that `copy-build.mjs` will see, or the 32-bit build
# would publish the 64-bit pack.
build_extra_bin() {
    if [[ "$1" == "32" ]]; then
        FORCE_ARCH_32=true node ./extra-work/build-extra-bin.mjs
    else
        node ./extra-work/build-extra-bin.mjs
    fi
}

build_release() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        process=$(node -p "process.arch")
        if [[ "$process" == "arm64" ]]; then
            build_extra_bin
            npm run pack:win
            win_prep "$tmp_dir/win-arm64"
        else
            build_extra_bin
            npm run pack:win
            win_prep "$tmp_dir/win"
            build_extra_bin 32
            npm run pack:win:32
            win_prep "$tmp_dir/win-ia32"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        build_extra_bin
        if [[ "$(uname -m)" == "arm64" ]]; then
            npm run pack:mac
            mac_prep "$tmp_dir/mac"
        else
            npm run pack:mac
            mac_prep "$tmp_dir/mac-intel"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        build_extra_bin
        npm run pack:linux
        if [[ "$RELEASE_LINUX_IS_UBUNTU" == "true" ]]; then
            linux_prep "$tmp_dir/linux-ubuntu" "ubuntu"
        elif [[ "$RELEASE_LINUX_IS_FEDORA" == "true" ]]; then
            linux_prep "$tmp_dir/linux-fedora" "fedora"
        else
            echo "Unsupported Linux distribution"
            exit 1
        fi
    else
        echo "Unsupported OS: $OSTYPE"
        exit 1
    fi
}

rm -rf "$tmp_dir"
mkdir -p "$tmp_dir"

mkdir -p "$release_dir"
mv "$release_dir" "$tmp_dir/backup-release"

build_release

mv "$tmp_dir/backup-release" "$release_dir"

if [[ -f ./extra-work/.env ]]; then
    source ./extra-work/.env
else
    echo "Error: .env file not found."
    exit 1
fi

export RELEASE_AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
export RELEASE_AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
export RELEASE_AWS_REGION="${AWS_REGION}"
export RELEASE_AWS_BUCKET_NAME="${AWS_BUCKET_NAME}"
export RELEASE_AWS_DISTRIBUTION_ID="${AWS_DISTRIBUTION_ID}"
export RELEASE_STORAGE_DIR="$tmp_dir"
export RELEASE_BIN_FILE_SEPARATOR="$sep"
export RELEASE_BIN_FILE_INFO="$bin_file_info"
export RELEASE_EXTRA_BIN_DIR_NAME="$extra_bin_dir_name"
node ./extra-work/s3-push-release.js

git pull
