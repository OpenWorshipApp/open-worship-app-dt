import { createContext, RefObject, use, useState } from 'react';
import { compileSchema, SchemaNode } from 'json-schema-library';

import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsDeleteFile,
    fsMkDirSync,
    fsReadFile,
    fsWriteFile,
    pathJoin,
} from '../../server/fileHelpers';
import { ensureDataDirectory } from '../../setting/directory-setting/directoryHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { unlocking } from '../../server/unlockingHelpers';

import { useAppEffect, useAppEffectAsync } from '../debuggerHelpers';
import { bibleCrossRefSchemaJson, RefreshingRefType } from './aiHelpers';
import BibleItem from '../../bible-list/BibleItem';
import { handleError } from '../errorHelpers';
import { getKJVBookKeyValue } from '../bible-helpers/serverBibleHelpers';

type GetBibleCrossRefParamsType = {
    bookKey: string;
    chapter: number;
    verseNum: number;
    dataDir: string;
    forceRefresh?: boolean;
};
type GetBibleCrossRefsFuncType = (
    bibleTitle: string,
) => Promise<CrossReferenceType[] | null>;

const bibleCrossRefSchema: SchemaNode = compileSchema(bibleCrossRefSchemaJson);
export function validateCrossReference(data: any) {
    return bibleCrossRefSchema.validate(data);
}

export async function getBibleCrossRef(
    params:
        | GetBibleCrossRefParamsType
        | {
              bibleTitle: string;
              dataDir: string;
              forceRefresh?: boolean;
          },
    getCrossRefs: GetBibleCrossRefsFuncType,
): Promise<CrossReferenceType[] | null> {
    let bibleTitle = '';
    if ((params as any).bibleTitle) {
        bibleTitle = (params as { bibleTitle: string }).bibleTitle;
    } else {
        const kjvBookKeyValue = getKJVBookKeyValue();
        const { bookKey, chapter, verseNum } =
            params as GetBibleCrossRefParamsType;
        bibleTitle = `${kjvBookKeyValue[bookKey]} ${chapter}:${verseNum}`;
    }
    const dataDir = params.dataDir;
    const forceRefresh = params.forceRefresh ?? false;
    const lockingKey = `${dataDir}-${bibleTitle}`;
    return unlocking(lockingKey, async () => {
        const baseDir = await ensureDataDirectory(dataDir);
        if (baseDir === null) {
            showSimpleToast(
                'Bible Cross Reference',
                'Fail to ensure data directory for AI data.',
            );
            return null;
        }
        const containingDir = pathJoin(baseDir, 'bible-cross-refs');
        if ((await fsCheckDirExist(containingDir)) === false) {
            fsMkDirSync(containingDir);
        }
        const fileFullName = `${bibleTitle.replace(':', '_')}.json`;
        const filePath = pathJoin(containingDir, fileFullName);
        if (await fsCheckFileExist(filePath)) {
            if (!forceRefresh) {
                try {
                    const text = await fsReadFile(filePath);
                    const data = JSON.parse(text) as CrossReferenceType[];
                    const { valid, errors } = validateCrossReference(data);
                    if (!valid) {
                        handleError(errors);
                    } else {
                        return data;
                    }
                } catch (error) {
                    console.error('Error reading cross reference file:', error);
                    return null;
                }
            }
            await fsDeleteFile(filePath);
        }
        const data = await getCrossRefs(bibleTitle);
        const { valid, errors } = validateCrossReference(data);
        if (!valid) {
            handleError(errors);
            return null;
        }
        await fsWriteFile(filePath, JSON.stringify(data, null, 2));
        return data;
    });
}

export async function transformCrossReferenceToVerseList(
    data: CrossReferenceType[] | null,
) {
    if (data !== null) {
        for (const crossRef of data) {
            const verses = await Promise.all(
                crossRef.verses.map(async (title) => {
                    return BibleItem.bibleTitleToKJVVerseKey('KJV', title);
                }),
            );
            crossRef.verses = verses.filter((item) => {
                return item !== null;
            });
        }
    }
}

async function getBibleCrossRefFromParams(
    params: GetBibleCrossRefParamsType,
    getCrossRefs: GetBibleCrossRefsFuncType,
) {
    const data = await getBibleCrossRef(params, getCrossRefs);
    await transformCrossReferenceToVerseList(data);
    return data;
}

export function useGetBibleCrossRef(
    params: GetBibleCrossRefParamsType,
    getCrossRefs: GetBibleCrossRefsFuncType,
) {
    const [bibleCrossRef, setBibleCrossRef] = useState<
        CrossReferenceType[] | null | undefined
    >(undefined);
    useAppEffectAsync(
        async (methodContext) => {
            const data = await getBibleCrossRefFromParams(params, getCrossRefs);
            methodContext.setBibleCrossRef(data);
        },
        [JSON.stringify(params)],
        { setBibleCrossRef },
    );
    return {
        bibleCrossRef,
        refresh: () => {
            setBibleCrossRef(undefined);
            getBibleCrossRefFromParams(
                { ...params, forceRefresh: true },
                getCrossRefs,
            ).then((data) => {
                setBibleCrossRef(data);
            });
        },
    };
}

export const defaultRefreshingRef: RefreshingRefType = {
    refresh: () => {},
};

export function useGenRefreshRef(
    ref: RefObject<RefreshingRefType>,
    refresh: () => void,
) {
    useAppEffect(() => {
        ref.current = { refresh };
        return () => {
            ref.current = defaultRefreshingRef;
        };
    }, [refresh]);
}

export type CrossReferenceType = {
    title: string;
    titleEn?: string;
    verses: string[];
};

export const BibleKeyContext = createContext<string>('KJV');
export function useBibleKeyContext() {
    return use(BibleKeyContext);
}
