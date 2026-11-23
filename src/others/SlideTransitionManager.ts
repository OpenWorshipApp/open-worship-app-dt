import FileSource from '../helper/FileSource';
import {
    fsCheckFileExist,
    fsDeleteFile,
    getFileDotExtension,
    mimetypePptx,
} from '../server/fileHelpers';
import { unlocking } from '../server/unlockingHelpers';
import type { TransitionEffectType } from '../_screen/transitionEffectHelpers';
import {
    TRANSITION_META_DOT_EXTENSION,
    toValidTransitionEffect,
} from '../_screen/transitionOverrideHelpers';
import CacheManager from './CacheManager';

/**
 * `{ "self"?: effect, "<slideId>"?: effect }` -- a document's own transition
 * (its slides preview) and each slide's, overriding the screen's `Slide:`.
 */
export type SlideTransitionMapType = { [key: string]: TransitionEffectType };

/**
 * The sidecar as written: an effect per level, plus `null` for a document
 * level whose default was turned off -- its checkbox unticked, so it follows
 * the screen (`getDefaultDocumentEffect`).
 */
type StoredSlideTransitionMapType = {
    [key: string]: TransitionEffectType | null;
};

export { TRANSITION_META_DOT_EXTENSION };

const DOCUMENT_KEY = 'self';

/**
 * What a document's slides preview comes in with while its sidecar says
 * nothing. A PowerPoint deck: `none`. A deck plays its own animations on its
 * slides, and only an instant cut leaves them alone -- a fade, slide or zoom
 * runs over them. So a deck starts with its OWN transition ticked on `none`
 * (the cyan icon beside its ⋮ shows it), the person can still pick another,
 * and unticking it stores `null`: following the screen is then the choice
 * that has to be kept. Every other kind of document has no default.
 */
function getDefaultDocumentEffect(
    filePath: string,
): TransitionEffectType | undefined {
    const dotExtension = getFileDotExtension(filePath).toLocaleLowerCase();
    return mimetypePptx.extensions.includes(dotExtension) ? 'none' : undefined;
}

const cached = new CacheManager<SlideTransitionMapType>(5);

/**
 * The transitions chosen for a slides preview and its slides, kept in a
 * sidecar beside the document -- `<file>.transition.json`, the way attached
 * backgrounds are kept in `<file>.bg.json` -- so every kind of document can
 * have them: a song, a PDF or a PowerPoint file has no room of its own for
 * one, and a slide document's would need a Save before the projector saw it.
 *
 * The sidecar follows the document through rename, trash, the agent backups
 * and the archives (`FILE_EXTENSIONS` in `appHelpers`, the archive helpers),
 * holds only what differs from the default -- entries that are switched on,
 * and a deck's document default switched off -- and is deleted when the last
 * one goes. Reading never creates it.
 */
export default class SlideTransitionManager {
    static genMetaDataFilePath(filePath: string) {
        return `${filePath}${TRANSITION_META_DOT_EXTENSION}`;
    }

    toKey(id?: string | number): string {
        if (typeof id === 'number') {
            return id.toString();
        }
        return id ?? DOCUMENT_KEY;
    }

    toLockingKey(filePath: string): string {
        return `slide-transition-${filePath}`;
    }

    private async readStoredData(
        filePath: string,
    ): Promise<StoredSlideTransitionMapType> {
        const metaDataFilePath =
            SlideTransitionManager.genMetaDataFilePath(filePath);
        if (!(await fsCheckFileExist(metaDataFilePath))) {
            return {};
        }
        const data =
            await FileSource.getInstance(metaDataFilePath).readFileJsonData();
        if (data === null) {
            return {};
        }
        const newData: StoredSlideTransitionMapType = {};
        for (const [key, value] of Object.entries(data)) {
            const effect = toValidTransitionEffect(value);
            if (effect !== undefined) {
                newData[key] = effect;
            } else if (
                value === null &&
                key === DOCUMENT_KEY &&
                getDefaultDocumentEffect(filePath) !== undefined
            ) {
                newData[key] = null;
            }
        }
        return newData;
    }

    /** The sidecar with the document's default filled in, `null`s gone. */
    private toEffectiveData(
        filePath: string,
        storedData: StoredSlideTransitionMapType,
    ): SlideTransitionMapType {
        const newData: SlideTransitionMapType = {};
        const defaultEffect = getDefaultDocumentEffect(filePath);
        if (defaultEffect !== undefined && !(DOCUMENT_KEY in storedData)) {
            newData[DOCUMENT_KEY] = defaultEffect;
        }
        for (const [key, value] of Object.entries(storedData)) {
            if (value !== null) {
                newData[key] = value;
            }
        }
        return newData;
    }

    async readData(filePath: string): Promise<SlideTransitionMapType> {
        const storedData = await this.readStoredData(filePath);
        return this.toEffectiveData(filePath, storedData);
    }

    private async getData(filePath: string) {
        const data = await cached.get(filePath);
        if (data !== null) {
            return data;
        }
        const newData = await this.readData(filePath);
        await cached.set(filePath, newData);
        return newData;
    }

    /** The whole map, for a caller that wants every slide of the document. */
    async getAllTransitions(filePath: string) {
        return await unlocking(this.toLockingKey(filePath), () => {
            return this.getData(filePath);
        });
    }

    /** This one level's own transition, nothing inherited. */
    async getTransition(
        filePath: string,
        id?: string | number,
    ): Promise<TransitionEffectType | undefined> {
        const data = await this.getAllTransitions(filePath);
        return data[this.toKey(id)];
    }

    /** What a slide goes up with: its own, else its document's. */
    async resolveSlideTransition(
        filePath: string,
        id: string | number,
    ): Promise<TransitionEffectType | undefined> {
        const data = await this.getAllTransitions(filePath);
        return data[this.toKey(id)] ?? data[this.toKey()];
    }

    /**
     * `effect` undefined is the checkbox unticked: the entry goes -- unless
     * it is a deck's document level, whose default has to be turned off in
     * writing. Choosing the default again removes the entry instead.
     */
    async setTransition(
        filePath: string,
        id: string | number | undefined,
        effect: TransitionEffectType | undefined,
    ) {
        await unlocking(this.toLockingKey(filePath), async () => {
            const data = await this.readStoredData(filePath);
            const key = this.toKey(id);
            const defaultEffect =
                key === DOCUMENT_KEY
                    ? getDefaultDocumentEffect(filePath)
                    : undefined;
            if (effect === defaultEffect) {
                delete data[key];
            } else {
                data[key] = effect ?? null;
            }
            await cached.set(filePath, this.toEffectiveData(filePath, data));
            const metaDataFilePath =
                SlideTransitionManager.genMetaDataFilePath(filePath);
            if (Object.keys(data).length > 0) {
                await FileSource.getInstance(metaDataFilePath).writeFileData(
                    JSON.stringify(data),
                );
                return;
            }
            if (await fsCheckFileExist(metaDataFilePath)) {
                await fsDeleteFile(metaDataFilePath);
                FileSource.forgetCachedData(metaDataFilePath);
                FileSource.getInstance(metaDataFilePath).fireUpdateEvent();
            }
        });
    }

    async deleteMetaDataFile(filePath: string) {
        await unlocking(this.toLockingKey(filePath), async () => {
            const metaDataFilePath =
                SlideTransitionManager.genMetaDataFilePath(filePath);
            await cached.delete(filePath);
            if (await fsCheckFileExist(metaDataFilePath)) {
                await fsDeleteFile(metaDataFilePath);
            }
            FileSource.forgetCachedData(metaDataFilePath);
            FileSource.getInstance(metaDataFilePath).fireUpdateEvent();
        });
    }

    /** Drops the short-lived copy, e.g. after the sidecar was replaced. */
    async forgetCachedData(filePath: string) {
        await cached.delete(filePath);
    }
}

export const slideTransitionManager = new SlideTransitionManager();
