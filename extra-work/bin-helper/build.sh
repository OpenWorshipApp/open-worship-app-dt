#!/bin/bash
set -xe

current_script_dir=$(dirname "$0")
cd "$current_script_dir"
pwd

gen_md5() {
    local input_string="$1"
    if command -v md5sum &> /dev/null; then
        echo -n "$input_string" | md5sum | awk '{print $1}'
    elif command -v md5 &> /dev/null; then
        echo -n "$input_string" | md5 | awk '{print $4}'
    else
        echo ""
    fi
}

is_debug=false
if [ "$1" == "--debug" ]; then
    is_debug=true
    echo "Debug build mode enabled."
else
    echo "Release build mode enabled."
fi
if [ "$is_debug" = true ]; then
    dotnet build -c Debug
else
    dotnet build -c Release
fi
if [ $? -ne 0 ]; then
    echo "Build failed. Please check the output for errors."
    exit 1
fi

dist_dir="./dist"
rm -rf $dist_dir
mkdir -p $dist_dir
if [ "$is_debug" = true ]; then
    dir_name="Debug"
else
    dir_name="Release"
fi
cp -r ./bin/$dir_name/net8.0/ $dist_dir/net8.0
if [ $? -ne 0 ]; then
    echo "Failed to copy build output to distribution directory."
    exit 1
fi
echo "Build and copy completed successfully."

yt_version="2025.12.08"
yt_prefix_url="https://github.com/yt-dlp/yt-dlp/releases/download/$yt_version/"
download_yt_dlp() {
    local url="$yt_prefix_url$1"
    local output_dir="$dist_dir/yt"
    mkdir -p "$output_dir"
    local output="$output_dir/yt-dlp$2"
    local file_basic_name="$(basename $url)"
    local file_name="${file_basic_name}_$yt_version"
    if [ ! -f "$file_name" ]; then
        echo "Downloading $url to $output"
        curl -L "$url" -o "$file_name"
        if [ $? -ne 0 ]; then
            echo "Failed to download $url"
            exit 1
        fi
    else
        echo "$file_name already exists, skipping download."
    fi
    cp "$file_name" "$output"
    chmod +x "$output"
}

ffmpeg_prefix_url="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/"
download_ffmpeg(){
    local url="$ffmpeg_prefix_url$1"
    local output_dir="$dist_dir/ffmpeg/bin"
    mkdir -p "$output_dir"
    local temp_output_dir="$dist_dir/ffmpeg/temp"
    mkdir -p "$temp_output_dir"
    local file_name=$(basename "$url")
    if [ ! -f "$file_name" ]; then
        echo "Downloading $url to $output_dir"
        curl -L "$url" -o "$file_name"
        if [ $? -ne 0 ]; then
            echo "Failed to download $url"
            exit 1
        fi
    else
        echo "$file_name already exists, skipping download."
    fi
    if [[ "$file_name" == *.zip ]]; then
        dir_name=$(basename "$file_name" .zip)
        unzip "$file_name" -d "$temp_output_dir"
    elif [[ "$file_name" == *.tar.xz ]]; then
        dir_name=$(basename "$file_name" .tar.xz)
        tar -xJf "$file_name" -C "$temp_output_dir"
    elif [[ "$file_name" == *.tar.gz ]]; then
        dir_name=$(basename "$file_name" .tar.gz)
        tar -xzf "$file_name" -C "$temp_output_dir"
    elif [[ "$file_name" == *.tar ]]; then
        dir_name=$(basename "$file_name" .tar)
        tar -xf "$file_name" -C "$temp_output_dir"
    else
        echo "Unknown file type for $file_name. Skipping extraction."
        return
    fi
    ls "$temp_output_dir/$dir_name/bin/ffmpeg"*
    cp "$temp_output_dir/$dir_name/bin/ffmpeg"* "$output_dir"
    chmod +x "$output_dir/ffmpeg"*
    rm -rf "$temp_output_dir"
}

dn_version="8.0.21"
dn_prefix_url="https://builds.dotnet.microsoft.com/dotnet/Runtime/$dn_version/dotnet-runtime-$dn_version-"
download_dotnet(){
    local url="$dn_prefix_url$1"
    local output="$dist_dir/bin$2"
    local file_name=$(basename "$url")
    mkdir -p "$output"
    if [ ! -f "$file_name" ]; then
        echo "Downloading $url to $output"
        curl -L "$url" -o "$file_name"
        if [ $? -ne 0 ]; then
            echo "Failed to download $url"
            exit 1
        fi
    else
        echo "$file_name already exists, skipping download."
    fi
    if [[ "$file_name" == *.zip ]]; then
        unzip "$file_name" -d "$output"
    elif [[ "$file_name" == *.tar.gz ]]; then
        tar -xzf "$file_name" -C "$output"
    elif [[ "$file_name" == *.tar ]]; then
        tar -xf "$file_name" -C "$output"
    else
        echo "Unknown file type for $file_name. Skipping extraction."
    fi
}

ffmpeg_build_version="n8.0-latest"
ffmpeg_version="8.0"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    process=$(node -p "process.arch")
    if [[ "$process" == "arm64" ]]; then
        download_yt_dlp yt-dlp.exe "-arm64.exe"
        download_dotnet win-arm64.zip "-arm64"
        download_ffmpeg ffmpeg-$ffmpeg_build_version-winarm64-gpl-$ffmpeg_version.zip
    else
        download_yt_dlp yt-dlp.exe ".exe"
        download_yt_dlp yt-dlp_x86.exe "-i386.exe"
        download_dotnet win-x64.zip
        download_dotnet win-x86.zip "-i386"
        download_ffmpeg ffmpeg-$ffmpeg_build_version-win64-gpl-$ffmpeg_version.zip
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ "$(uname -m)" == "arm64" ]]; then
        download_yt_dlp yt-dlp_macos
        download_dotnet osx-arm64.tar.gz
    fi
    download_yt_dlp yt-dlp_macos "-int"
    download_dotnet osx-x64.tar.gz "-int"
elif [[ "$OSTYPE" == "linux-gnu" ]]; then
    if [[ "$(uname -m)" == "aarch64" ]]; then
        download_yt_dlp yt-dlp_linux_aarch64 "-arm64"
        download_dotnet linux-arm64.tar.gz "-arm64"
        download_ffmpeg ffmpeg-$ffmpeg_build_version-linuxarm64-gpl-$ffmpeg_version.tar.xz
    else
        download_yt_dlp yt-dlp_linux
        download_dotnet linux-x64.tar.gz
        download_ffmpeg ffmpeg-$ffmpeg_build_version-linux64-gpl-$ffmpeg_version.tar.xz
    fi
fi
