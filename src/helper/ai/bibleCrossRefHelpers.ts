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
import { handleError } from '../errorHelpers';
import { getModelKeyBookMap } from '../bible-helpers/bibleLogicHelpers1';
import { cloneJson } from '../helpers';
import { toVerseKeyFormat } from '../bible-helpers/bibleInfoHelpers';

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
        const kjvBookKeyValue = getModelKeyBookMap();
        const { bookKey, chapter, verseNum } =
            params as GetBibleCrossRefParamsType;
        bibleTitle = toVerseKeyFormat(
            kjvBookKeyValue[bookKey],
            chapter,
            verseNum,
        );
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
                    const cachedData = JSON.parse(text);
                    cachedData.cachingTime = cachedData.cachingTime ?? 0;
                    // expire in 7 days
                    if (
                        Date.now() - cachedData.cachingTime <
                        7 * 24 * 60 * 60 * 1000
                    ) {
                        const dataValue =
                            cachedData.value as CrossReferenceType[];
                        const { valid, errors } =
                            validateCrossReference(dataValue);
                        if (valid) {
                            return cachedData.value as CrossReferenceType[];
                        } else {
                            handleError(errors);
                        }
                    }
                } catch (error) {
                    console.error('Error reading cross reference file:', error);
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
        await fsWriteFile(
            filePath,
            JSON.stringify(
                {
                    cachingTime: Date.now(),
                    value: data,
                },
                null,
                2,
            ),
        );
        return data;
    });
}

const reverseModelBookKeyValue = Object.fromEntries(
    Object.entries(getModelKeyBookMap()).map(([key, value]) => [value, key]),
);
export async function transformCrossReferenceToVerseList(
    data: CrossReferenceType[] | null,
) {
    if (data === null) {
        return null;
    }
    const clonedData = cloneJson(data);
    for (const crossRef of clonedData) {
        const verses = await Promise.all(
            crossRef.verses.map(async (title) => {
                title = title.trim();
                const arr = title.split(' ');
                if (arr.length < 2) {
                    return null;
                }
                const rest = arr.pop() as string;
                const bookName = arr.join(' ');
                const bookKey = reverseModelBookKeyValue[bookName];
                if (!bookKey) {
                    return null;
                }
                const verseKey = `${bookKey} ${rest}`;
                return verseKey;
            }),
        );
        crossRef.verses = verses.filter((item) => {
            return item !== null;
        });
    }
    return clonedData;
}

async function getBibleCrossRefFromParams(
    params: GetBibleCrossRefParamsType,
    getCrossRefs: GetBibleCrossRefsFuncType,
) {
    let data = await getBibleCrossRef(params, getCrossRefs);
    data = await transformCrossReferenceToVerseList(data);
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
