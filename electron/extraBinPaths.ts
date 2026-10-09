import path from 'node:path';

// The on-demand extra-bin pack (Settings > Others > Extra Binaries) as the
// renderer installs it -- `<data folder>/extra-bin/<platform>/`, see
// `getExtraBinDirPath` in `src/helper/extra-bin/extraBinHelpers.ts`. The main
// process only reads it, to run what the pack carries for it: cloudflared,
// for Screen Mirror's tunnel.

// Named the way `extra-work/buildPlatformHelpers.mjs` names the packs it
// builds, and the renderer's `getExtraBinPlatformName` names the folder.
export function getExtraBinPlatformName(
    platform: string = process.platform,
    arch: string = process.arch,
) {
    if (platform === 'darwin') {
        return arch === 'arm64' ? 'mac' : 'mac-int';
    }
    const osName = platform === 'win32' ? 'win' : 'linux';
    if (arch === 'arm64') {
        return `${osName}-arm64`;
    }
    return arch === 'x64' ? osName : `${osName}-i386`;
}

export function getCloudflaredBinPath(
    dataDirPath: string,
    platform: string = process.platform,
    arch: string = process.arch,
) {
    return path.join(
        dataDirPath,
        'extra-bin',
        getExtraBinPlatformName(platform, arch),
        'cloudflared',
        platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
    );
}
