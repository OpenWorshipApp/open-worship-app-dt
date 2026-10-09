Recommended run in Git Bash on Windows or Terminal on MacOS/Linux.

Make sure Powershell 7 installed: https://learn.microsoft.com/en-us/powershell/scripting/install/install-powershell-on-windows?view=powershell-7.6#msi

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
pwsh -ExecutionPolicy Bypass -File ./win-build-node.ps1

# yt-dlp build script for Windows
cd extra-work/experiment-building
pwsh -ExecutionPolicy Bypass -File ./win-build-yt-dlp.ps1

# cloudflared build script for Windows (Screen Mirror's internet tunnel)
cd extra-work/experiment-building
pwsh -ExecutionPolicy Bypass -File ./win-build-cloudflared.ps1

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

# cloudflared build script for MacOS (Screen Mirror's internet tunnel)
cd extra-work/experiment-building
bash ./mac-build-cloudflared.sh

```

## Build cloudflared (Linux)

```bash

# cloudflared build script for Linux (Screen Mirror's internet tunnel)
cd extra-work/experiment-building
bash ./linux-build-cloudflared.sh

```

## cloudflared: one host builds every pack

cloudflared is pure Go, so unlike the other tools it cross-compiles
(`CGO_ENABLED=0`, the way Cloudflare builds its own Linux releases): any of the
three scripts builds all six pack platforms with `all` as the second argument,
and `CLOUDFLARED_SHIP=1` copies each result into its platform dir in place of
the older `cloudflared-*` file (the pack takes the FIRST file matching the
prefix). Go is not needed on the machine: a pinned toolchain is downloaded into
`tmp/` and checked against go.dev's SHA-256.

The build is reproducible across hosts (UTC build stamp, empty Go build ID), so
the committed files can be checked by rebuilding them on any OS. cloudflared
2026.9.3 with Go 1.26.8 (built on Windows, `linux-arm64` and `mac` re-built
byte-identical on Linux):

| Pack        | File                           | SHA-256                                                            |
| ----------- | ------------------------------ | ------------------------------------------------------------------ |
| win         | cloudflared-2026.9.3-amd64.exe | `b272dde0b52eb4dddc94047d7503b0b2274045c28b9a5db4dc67973fa8071deb` |
| win-arm64   | cloudflared-2026.9.3-arm64.exe | `e5b0fe2a50111807134f6dcb92513c84c3f2bc3ae7832828134cbce7fd30261e` |
| mac         | cloudflared-2026.9.3-arm64     | `b81ff4a7861d96b8658f0536fd81b8f6d577621aae49ae931151261ce3253333` |
| mac-int     | cloudflared-2026.9.3-amd64     | `1fcdb08d2854ea7267be01d07b048f72f8f43f117d00f3030da179f095e757a0` |
| linux       | cloudflared-2026.9.3-amd64     | `ff7c4374df0fd7cae20cee7fa1cc326e08b30d393cbb8ed2347b152d643e2172` |
| linux-arm64 | cloudflared-2026.9.3-arm64     | `52dc8c3b7a51c570d87a74f83ebafebf569c256259261e8aca9da12dc36fbb1a` |

```bash

cd extra-work/experiment-building
CLOUDFLARED_SHIP=1 pwsh -ExecutionPolicy Bypass -File ./win-build-cloudflared.ps1 2026.9.3 all
# then bump info.json and rebuild the pack (from the repo root)
cd ../.. && node extra-work/build-extra-bin.mjs

```
