import { useState } from 'react';

import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import type { BibleMinimalInfoType } from '../../helper/bible-helpers/bibleDownloadHelpers';
import {
    getDownloadedBibleInfoList,
    getOnlineBibleInfoList,
} from '../../helper/bible-helpers/bibleDownloadHelpers';

export type BibleListType = BibleMinimalInfoType[] | null | undefined;

export function useDownloadedBibleInfoList() {
    const [bibleInfoList, setBibleInfoList] = useState<BibleListType>(null);
    useAppEffectAsync(
        async (methodContext) => {
            if (bibleInfoList !== null) {
                return;
            }
            const newDownloadedBibleInfoList =
                await getDownloadedBibleInfoList();
            methodContext.setBibleInfoList(
                newDownloadedBibleInfoList || undefined,
            );
        },
        [bibleInfoList],
        { setBibleInfoList },
    );
    return [bibleInfoList, setBibleInfoList] as const;
}

export function useOnlineBibleInfoList() {
    const [bibleInfoList, setBibleInfoList] = useState<BibleListType>(null);
    useAppEffect(() => {
        if (bibleInfoList !== null) {
            return;
        }
        getOnlineBibleInfoList().then((bibleInfoList) => {
            setBibleInfoList(bibleInfoList || undefined);
        });
    }, [bibleInfoList]);
    const setBibleInfoList1 = (bibleInfoList: BibleListType) => {
        setBibleInfoList(bibleInfoList);
    };
    return [bibleInfoList, setBibleInfoList1] as const;
}
