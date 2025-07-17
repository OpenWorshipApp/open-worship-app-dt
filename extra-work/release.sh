#!/bin/bash

current_script_dir=$(dirname "$0")
cd "$current_script_dir/.."
pwd

git pull
npm i

release_dir="./release"
tmp_dir="./extra-work/tmp"
bin_file_info="files.txt"
sep="|"
latest_commit=$(git rev-parse HEAD)

is_linux_ubuntu() {
    if command -v lsb_release &> /dev/null; then
        if [[ "$(lsb_release -is)" == "Ubuntu" ]]; then
            echo "true"
        fi
    fi
}

is_linux_fedora() {
    if [[ -f /etc/os-release ]]; then
        if grep -q 'Fedora' /etc/os-release; then
            echo "true"
        fi
    fi
}

export RELEASE_LINUX_IS_UBUNTU=$(is_linux_ubuntu)
export RELEASE_LINUX_IS_FEDORA=$(is_linux_fedora)

start_prep() {
    mv $release_dir $1
    target_file="$1/$bin_file_info"
    rm -f "$target_file"
    touch "$target_file"
}

append_file_info() {
    target_file="$1/$bin_file_info"
    file_name=$(basename "$2")
    version=$(grep 'version:' "$4" | awk '{print $2}' | tr -d "'")
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
    ls "$1" | grep -E '\.deb$|\.AppImage$' | while read -r file; do
        checksum=$(sha512sum "$1/$file" | awk '{print $1}')
        append_file_info "$1" "$file" "$checksum" "$1/latest-linux.yml"
    done
}

build_release() {
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
        npm run pack:win:32
        win_prep "$tmp_dir/win-ia32"
        npm run pack:win
        win_prep "$tmp_dir/win"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if [[ "$(uname -m)" == "arm64" ]]; then
            npm run pack:mac
            mac_prep "$tmp_dir/mac"
            npm run pack:mac:uni
            mac_prep "$tmp_dir/mac-uni" universal
        else
            npm run pack:mac
            mac_prep "$tmp_dir/mac-intel"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        npm run pack:linux
        if [[ "$RELEASE_LINUX_IS_UBUNTU" == "true" ]]; then
            linux_prep "$tmp_dir/linux-ubuntu"
        elif [[ "$RELEASE_LINUX_IS_FEDORA" == "true" ]]; then
            linux_prep "$tmp_dir/linux-fedora"
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
node ./extra-work/s3-push-release.js
