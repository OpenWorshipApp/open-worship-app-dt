import { useState } from 'react';

import { useAppEffectAsync } from '../helper/debuggerHelpers';
import LoadingComp from '../others/LoadingComp';
import BibleFindBodyComp from './BibleFindBodyComp';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import BibleFindController, {
    BibleFindControllerContext,
} from './BibleFindController';

export default function BibleFindBodyPreviewerComp() {
    const selectedBibleKey = useBibleKeyContext();
    const { bibleKey: bibleKeyContext } = BibleFindController.findingContext;
    if (bibleKeyContext !== null) {
        BibleFindController.findingContext.bibleKey = null;
    }
    const [bibleKey, setBibleKey] = useState(
        bibleKeyContext ?? selectedBibleKey,
    );
    const [bibleFindController, setBibleFindController] = useState<
        BibleFindController | null | undefined
    >(undefined);
    const setBibleKey1 = (_: string, newBibleKey: string) => {
        setBibleFindController(undefined);
        setBibleKey(newBibleKey);
    };
    useAppEffectAsync(
        async (methodContext) => {
            if (bibleKey !== 'Unknown' && bibleFindController === undefined) {
                const newBibleFindController =
                    await BibleFindController.getInstant(bibleKey);
                const { findingText } = BibleFindController.findingContext;
                if (findingText !== null) {
                    BibleFindController.findingContext.findingText = null;
                }
                methodContext.setBibleFindController(newBibleFindController);
            }
        },
        [bibleFindController, bibleKey],
        { setBibleFindController },
    );
    if (bibleFindController === undefined) {
        return <LoadingComp />;
    }
    if (bibleFindController === null) {
        return (
            <div className="alert alert-warning">
                <i className="bi bi-info-circle" />
                <div className="ms-2">Fail to get find controller!</div>
                <button
                    className="btn btn-info"
                    onClick={() => {
                        setBibleFindController(undefined);
                    }}
                >
                    Reload
                </button>
            </div>
        );
    }

    return (
        <BibleFindControllerContext value={bibleFindController}>
            <BibleFindBodyComp setBibleKey={setBibleKey1} />
        </BibleFindControllerContext>
    );
}
