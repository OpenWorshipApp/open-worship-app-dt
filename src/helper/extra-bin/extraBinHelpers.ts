import { appManagedDataDirNames } from '../constants';
import appProvider from '../../server/appProvider';
import {
    ensureDirectory,
    fsCheckFileExist,
    fsList,
    fsMove,
    fsReadFile,
    pathJoin,
} from '../../server/fileHelpers';
import { handleError } from '../errorHelpers';
import { appLocalStorage } from '../../setting/directory-setting/appLocalStorage';

export const EXTRA_BIN_INFO_FILE_NAME = 'info.json';
export const EXTRA_BIN_ARCHIVE_REGEX = /^bin-.+\.tar\.gz$/;

/**
 * "What I just found on disk disagrees with what another window is showing."
 *
 * The Settings window is its own renderer, so the Extra Binaries panel cannot
 * see what another window did: the download gate installing or updating the
 * pack (`extraBinGateHelpers.ts`). It reads once and re-reads only after one
 * of its own buttons, so without this it can greet the user with a stale
 * `Installed 0.0.2` -- and, because that answer hides the primary button, with
 * no way to install.
 */
const EXTRA_BIN_CHANGED_BROADCAST_CHANNEL = 'all:app:extra-bin-changed';
const EXTRA_BIN_CHANGED_RENDERER_CHANNEL = 'main:app:extra-bin-changed';

export function notifyExtraBinChanged() {
    appProvider.messageUtils.sendData(EXTRA_BIN_CHANGED_BROADCAST_CHANNEL);
}

/** Returns the unregister function, so a component can hand it back as its
 * effect cleanup without knowing the channel names. */
export function registerExtraBinChangedListener(handler: () => void) {
    appProvider.messageUtils.listenForData(
        EXTRA_BIN_CHANGED_RENDERER_CHANNEL,
        handler,
    );
    return () => {
        appProvider.messageUtils.removeListener(
            EXTRA_BIN_CHANGED_RENDERER_CHANNEL,
            handler,
        );
    };
}

export type ExtraBinPathsType = {
    dirPath: string;
    ytDlpBinPath: string;
    // yt-dlp's `--ffmpeg-location` takes the DIRECTORY, not the executable.
    ffmpegBinDirPath: string;
    // The executable itself, for the existence check only.
    ffmpegBinPath: string;
    qjsBinPath: string;
    // Run by the main process for Screen Mirror's tunnel
    // (`electron/extraBinPaths.ts` resolves the same path); here for the
    // existence check only.
    cloudflaredBinPath: string;
    // The app's MCP server as one program, for an AI agent on a computer
    // with no Node.js (pack 0.0.6 and later). The app never runs it: an AI
    // client does, from the command Settings shows.
    mcpBinPath: string;
};

export type ExtraBinNameType = 'yt-dlp' | 'ffmpeg' | 'qjs' | 'cloudflared';
// What a video or audio download needs; the pack carries cloudflared too.
export const EXTRA_BIN_MEDIA_NAMES: readonly ExtraBinNameType[] = [
    'yt-dlp',
    'ffmpeg',
    'qjs',
];
const EXTRA_BIN_ALL_NAMES: readonly ExtraBinNameType[] = [
    ...EXTRA_BIN_MEDIA_NAMES,
    'cloudflared',
];

/**
 * Where the on-demand media pack is installed. Pure path math and NO `mkdir`:
 * this is called by an existence check, and a user who never downloads media
 * must not end up with an empty folder in their data directory.
 *
 * `defaultStorageDirPath` rather than `ensureDataDirectory`: that one creates the
 * folder and answers null before a parent directory has been picked, while this
 * one falls back to `getUserWritablePath()`, so the pack always has a home and
 * the read path can never disagree with the write path. Same shape as the
 * app-managed bible data folder in `dataDirectories.ts`.
 */
export function getExtraBinDirPath() {
    return pathJoin(getExtraBinRootDirPath(), getExtraBinPlatformName());
}

function getExtraBinRootDirPath() {
    return pathJoin(
        appLocalStorage.defaultStorageDirPath,
        appManagedDataDirNames.EXTRA_BIN,
    );
}

/**
 * Which pack this computer runs, named the way
 * `extra-work/buildPlatformHelpers.mjs` names the packs it builds (`win`,
 * `mac`, `mac-int`, `linux-arm64` …) -- and the name of the folder it lives in
 * under `extra-bin/`. One folder per platform because the pack sits in the
 * DATA folder, which a flash drive carries between computers: in one shared
 * folder a Mac found the Windows pack, re-extracted it on every Download and
 * Install and failed each time, and a Mac pack on Linux read as "Installed"
 * and failed every download with "Exec format error".
 */
export function getExtraBinPlatformName() {
    const { isWindows, isMac, isArm64, is64System } = appProvider.systemUtils;
    if (isMac) {
        return isArm64 ? 'mac' : 'mac-int';
    }
    const osName = isWindows ? 'win' : 'linux';
    if (isArm64) {
        return `${osName}-arm64`;
    }
    return is64System ? osName : `${osName}-i386`;
}

const LEGACY_EXTRA_BIN_ENTRY_NAMES = new Set([
    'yt',
    'ffmpeg',
    'qjs',
    EXTRA_BIN_INFO_FILE_NAME,
]);

async function readExtraBinInfoPlatform(infoPath: string): Promise<unknown> {
    try {
        return JSON.parse(await fsReadFile(infoPath)).platform;
    } catch (_error) {
        return null;
    }
}

/**
 * A pack installed before the per-platform folders sat straight in
 * `extra-bin/`. Moved into this computer's own folder when its `info.json`
 * says it was built for this OS, so nothing is downloaded twice; a pack for
 * another OS is left where it is for that OS to move.
 */
export async function moveLegacyExtraBinPack() {
    const rootDirPath = getExtraBinRootDirPath();
    const legacyInfoPath = pathJoin(rootDirPath, EXTRA_BIN_INFO_FILE_NAME);
    if (!(await fsCheckFileExist(legacyInfoPath))) {
        return;
    }
    const platform = await readExtraBinInfoPlatform(legacyInfoPath);
    // The OS decides, not the processor: an Intel Mac pack runs on Apple
    // silicon, and it is what such a machine may well have downloaded.
    const osName = getExtraBinPlatformName().split('-')[0];
    if (typeof platform !== 'string' || platform.split('-')[0] !== osName) {
        return;
    }
    const dirPath = getExtraBinDirPath();
    await ensureDirectory(dirPath);
    for (const { name } of await fsList(rootDirPath)) {
        if (
            !LEGACY_EXTRA_BIN_ENTRY_NAMES.has(name) &&
            !EXTRA_BIN_ARCHIVE_REGEX.test(name)
        ) {
            continue;
        }
        try {
            await fsMove(pathJoin(rootDirPath, name), pathJoin(dirPath, name));
        } catch (error) {
            // Another window moving the same pack at the same moment.
            handleError(error);
        }
    }
}

export function getExtraBinPaths(): ExtraBinPathsType {
    const dirPath = getExtraBinDirPath();
    const dotExe = appProvider.systemUtils.isWindows ? '.exe' : '';
    const ffmpegBinDirPath = pathJoin(dirPath, 'ffmpeg', 'bin');
    return {
        dirPath,
        ytDlpBinPath: pathJoin(dirPath, 'yt', `yt-dlp${dotExe}`),
        ffmpegBinDirPath,
        ffmpegBinPath: pathJoin(ffmpegBinDirPath, `ffmpeg${dotExe}`),
        qjsBinPath: pathJoin(dirPath, 'qjs', `qjs${dotExe}`),
        cloudflaredBinPath: pathJoin(
            dirPath,
            'cloudflared',
            `cloudflared${dotExe}`,
        ),
        mcpBinPath: pathJoin(dirPath, 'mcp', `open-worship-app-mcp${dotExe}`),
    };
}

/**
 * The MCP executable when the installed pack carries one, else null. Not one
 * of `EXTRA_BIN_ALL_NAMES` on purpose: a pack from before it is still whole,
 * "Installed" stays true for it, and its update is offered by its version.
 */
export async function findInstalledMcpBinPath() {
    const { mcpBinPath } = getExtraBinPaths();
    return (await fsCheckFileExist(mcpBinPath)) ? mcpBinPath : null;
}

// The client texts moved to a leaf of their own with the AI client picker;
// kept reachable from here for the callers that had them.
export {
    genMcpClientCommand,
    genMcpClientJson,
    MCP_CLIENT_SERVER_NAME,
} from './mcpClientHelpers';

/**
 * `missingNames` is what makes a failure diagnosable — "not installed" and "the
 * ffmpeg half of the pack is gone" need different answers. The whole pack by
 * default; the media download asks for its own three only, so a pack from
 * before cloudflared joined it still downloads video.
 */
export async function checkIsExtraBinInstalled(
    names: readonly ExtraBinNameType[] = EXTRA_BIN_ALL_NAMES,
) {
    await moveLegacyExtraBinPack();
    const { ytDlpBinPath, ffmpegBinPath, qjsBinPath, cloudflaredBinPath } =
        getExtraBinPaths();
    const pathMap: Record<ExtraBinNameType, string> = {
        'yt-dlp': ytDlpBinPath,
        ffmpeg: ffmpegBinPath,
        qjs: qjsBinPath,
        cloudflared: cloudflaredBinPath,
    };
    const targetList = names.map((name) => {
        return [name, pathMap[name]] as const;
    });
    const existingList = await Promise.all(
        targetList.map(([_name, filePath]) => {
            return fsCheckFileExist(filePath);
        }),
    );
    const missingNames = targetList
        .filter((_target, index) => {
            return !existingList[index];
        })
        .map(([name]) => {
            return name;
        });
    return { isInstalled: missingNames.length === 0, missingNames };
}

export async function getInstalledExtraBinVersion() {
    try {
        const text = await fsReadFile(
            pathJoin(getExtraBinDirPath(), EXTRA_BIN_INFO_FILE_NAME),
        );
        const version = JSON.parse(text).version;
        return typeof version === 'string' ? version : null;
    } catch (_error) {
        return null;
    }
}
