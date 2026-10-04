import FileSource from '../helper/FileSource';
import { fsCheckFileExist, fsDeleteFile } from '../server/fileHelpers';
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

export { TRANSITION_META_DOT_EXTENSION };

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
 * holds only entries that are switched on, and is deleted when the last one
 * goes. Reading never creates it.
 */
export default class SlideTransitionManager {
    static genMetaDataFilePath(filePath: string) {
        return `${filePath}${TRANSITION_META_DOT_EXTENSION}`;
    }

    toKey(id?: string | number): string {
        if (typeof id === 'number') {
            return id.toString();
        }
        return id ?? 'self';
    }

    toLockingKey(filePath: string): string {
        return `slide-transition-${filePath}`;
    }

    async readData(filePath: string): Promise<SlideTransitionMapType> {
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
        const newData: SlideTransitionMapType = {};
        for (const [key, value] of Object.entries(data)) {
            const effect = toValidTransitionEffect(value);
            if (effect !== undefined) {
                newData[key] = effect;
            }
        }
        return newData;
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

    /** `effect` undefined is the checkbox unticked: the entry goes. */
    async setTransition(
        filePath: string,
        id: string | number | undefined,
        effect: TransitionEffectType | undefined,
    ) {
        await unlocking(this.toLockingKey(filePath), async () => {
            const data = await this.readData(filePath);
            const key = this.toKey(id);
            if (effect === undefined) {
                delete data[key];
            } else {
                data[key] = effect;
            }
            await cached.set(filePath, data);
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
