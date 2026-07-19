Recommended run in Git Bash on Windows or Terminal on MacOS/Linux.


## Build ffmpeg (Windows)

```bash

# ffmpeg build script for Windows
cd extra-work/experiment-building
pwsh -ExecutionPolicy Bypass -File ./win-build-ffmpeg.ps1

# qjs build script for Windows
cd extra-work/experiment-building
pwsh -ExecutionPolicy Bypass -File ./win-build-qjs.ps1

# node build script for Windows
cd extra-work/experiment-building
pwsh -ExecutionPolicy Bypass -File
./win-build-node.ps1

# yt-dlp build script for Windows
cd extra-work/experiment-building
pwsh -ExecutionPolicy Bypass -File ./win-build-yt-dlp.ps1

```

## Build ffmpeg (MacOS)

```bash

# ffmpeg build script for MacOS
cd extra-work/experiment-building
bash ./mac-build-ffmpeg.sh

# qjs build script for MacOS
cd extra-work/experiment-building
bash ./mac-build-qjs.sh

# node build script for MacOS
cd extra-work/experiment-building
bash ./mac-build-node.sh

# yt-dlp build script for MacOS
cd extra-work/experiment-building
bash ./mac-build-yt-dlp.sh

```
