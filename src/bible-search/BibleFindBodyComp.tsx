import { useState, useTransition } from 'react';

import {
    AllDataType,
    BibleFindForType,
    calcPaging,
    findPageNumber,
    SelectedBookKeyType,
} from './bibleFindHelpers';
import BibleFindRenderDataComp from './BibleFindRenderDataComp';
import BibleSelectionComp from '../bible-lookup/BibleSelectionComp';
import BibleFindHeaderComp from './BibleFindHeaderComp';
import { useBibleFindController } from './BibleFindController';

export default function BibleFindBodyComp({
    setBibleKey,
}: Readonly<{
    setBibleKey: (_: string, newBibleKey: string) => void;
}>) {
    const bibleFindController = useBibleFindController();
    const [selectedBook, setSelectedBook] = useState<SelectedBookKeyType>(null);
    const [findText, setFindText] = useState('');
    const [allData, setAllData] = useState<AllDataType>({});
    const [isFinding, startTransition] = useTransition();
    const doFinding = async (findData: BibleFindForType, isFresh = false) => {
        startTransition(async () => {
            const data = await bibleFindController.doFinding(findData);
            if (data !== null) {
                const { perPage, pages } = calcPaging(data);
                const pageNumber = findPageNumber(data, perPage, pages);
                const newAllData = {
                    ...(isFresh ? {} : allData),
                    [pageNumber]: data,
                };
                delete newAllData['0'];
                setAllData(newAllData);
            }
        });
    };
    const setSelectedBook1 = (newSelectedBook: SelectedBookKeyType) => {
        bibleFindController.bookKey = newSelectedBook?.bookKey ?? null;
        setAllData({});
        setSelectedBook(newSelectedBook);
        if (bibleFindController.findText) {
            doFinding({ text: bibleFindController.findText }, true);
        }
    };
    const handleFinding = (isFresh = false) => {
        const findText = bibleFindController.findText;
        if (!findText) {
            return;
        }
        setFindText(findText);
        if (isFresh) {
            setAllData({});
        }
        const findData: BibleFindForType = {
            text: findText,
        };
        doFinding(findData, isFresh);
    };
    return (
        <div className="card overflow-hidden w-100 h-100">
            <div
                className="card-header input-group overflow-hidden"
                style={{
                    minHeight: '54px',
                }}
            >
                <BibleSelectionComp
                    onBibleKeyChange={setBibleKey}
                    bibleKey={bibleFindController.bibleKey}
                />
                <BibleFindHeaderComp
                    handleFind={handleFinding}
                    isFinding={isFinding}
                />
            </div>
            <BibleFindRenderDataComp
                text={findText}
                allData={allData}
                findFor={(from: number, to: number) => {
                    doFinding({
                        fromLineNumber: from,
                        toLineNumber: to,
                        text: findText,
                    });
                }}
                selectedBook={selectedBook}
                setSelectedBook={setSelectedBook1}
                isFinding={isFinding}
            />
        </div>
    );
}
