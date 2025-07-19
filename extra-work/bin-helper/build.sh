#!/bin/bash
set -x

current_script_dir=$(dirname "$0")
cd "$current_script_dir"
pwd

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

yt_prefix_url="https://github.com/yt-dlp/yt-dlp/releases/download/2025.06.30/"
download_yt_dlp() {
    local url="$yt_prefix_url$1"
    local output_dir="$dist_dir/yt"
    mkdir -p "$output_dir"
    local output="$output_dir/yt-dlp$2"
    local file_name=$(basename "$url")
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
    # download ffmpeg-n7.1-latest-win64-gpl-7.1.zip 
    # extract to ffmpeg-n7.1-latest-win64-gpl-7.1
    # copy ffmpeg-n7.1-latest-win64-gpl-7.1/bin/ffmpeg.exe to ./dist/ffmpeg/bin/ffmpeg.exe
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
    # copy ffmpeg binary to output directory
    ls "$temp_output_dir/$dir_name/bin/ffmpeg"*
    cp "$temp_output_dir/$dir_name/bin/ffmpeg"* "$output_dir"
    chmod +x "$output_dir/ffmpeg"*
    rm -rf "$temp_output_dir"
}

dn_prefix_url="https://builds.dotnet.microsoft.com/dotnet/Runtime/8.0.18/dotnet-runtime-8.0.18-"
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

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    if [[ "$PROCESSOR_ARCHITECTURE" == "ARM64" ]]; then
        # TODO: update to arm64 version when available
        download_yt_dlp yt-dlp.exe "-arm64.exe"
        download_dotnet win-arm64.zip "-arm64"
        download_ffmpeg ffmpeg-n7.1-latest-winarm64-gpl-7.1.zip
    else
        download_yt_dlp yt-dlp.exe ".exe"
        download_yt_dlp yt-dlp_x86.exe "-i386.exe"
        download_dotnet win-x64.zip
        download_dotnet win-x86.zip "-i386"
        download_ffmpeg ffmpeg-n7.1-latest-win64-gpl-7.1.zip
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
        download_ffmpeg ffmpeg-n7.1-latest-linuxarm64-gpl-7.1.tar.xz
    else
        download_yt_dlp yt-dlp_linux
        download_dotnet linux-x64.tar.gz
        download_ffmpeg ffmpeg-n7.1-latest-linux64-gpl-7.1.tar.xz
    fi
fi
