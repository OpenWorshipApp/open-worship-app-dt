import FileSource from '../helper/FileSource';
import { fsCheckFileExist, fsDeleteFile } from './fileHelpers';
import { unlocking } from './unlockingHelpers';
import { PPTX_BUILD_META_DOT_EXTENSION } from './pptxBuildOptionConstants';

/**
 * The sidecar beside a PowerPoint file holding how its slides are BUILT --
 * `<file>.build.json`, the way its transitions are kept in
 * `<file>.transition.json`: a deck has no room of its own for a choice of
 * ours. Renamed and trashed with the deck (`FILE_EXTENSIONS` in
 * `appHelpers`); not carried by the archives, where a deck falls back to the
 * default.
 *
 * It holds only what differs from the default and is deleted when nothing
 * does, so a deck nobody touched has none. Reading never creates it.
 */
export { PPTX_BUILD_META_DOT_EXTENSION };

type PptxBuildMetaType = { omitBackground?: boolean };

function toMetaFilePath(filePath: string) {
    return `${filePath}${PPTX_BUILD_META_DOT_EXTENSION}`;
}

function toLockingKey(filePath: string) {
    return `pptx-build-${filePath}`;
}

/**
 * Whether the deck's slides are built without their own background, so what
 * the app puts behind them shows through. On by default: no sidecar, or one
 * that cannot be read, is `true`.
 */
export async function getPptxOmitBackground(filePath: string) {
    const metaFilePath = toMetaFilePath(filePath);
    if (!(await fsCheckFileExist(metaFilePath))) {
        return true;
    }
    const data = (await FileSource.getInstance(
        metaFilePath,
    ).readFileJsonData()) as PptxBuildMetaType | null;
    return data?.omitBackground !== false;
}

/** `true` is the default, so it removes the sidecar rather than writing it. */
export async function setPptxOmitBackground(filePath: string, isOmit: boolean) {
    await unlocking(toLockingKey(filePath), async () => {
        const metaFilePath = toMetaFilePath(filePath);
        if (!isOmit) {
            const data: PptxBuildMetaType = { omitBackground: false };
            await FileSource.getInstance(metaFilePath).writeFileData(
                JSON.stringify(data),
            );
            return;
        }
        if (await fsCheckFileExist(metaFilePath)) {
            await fsDeleteFile(metaFilePath);
        }
        FileSource.forgetCachedData(metaFilePath);
    });
}
