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
import { useAppStateAsync } from '../helper/debuggerHelpers';

export default function BibleFindBodyComp({
    setBibleKey,
}: Readonly<{
    setBibleKey: (_: string, newBibleKey: string) => void;
}>) {
    const bibleFindController = useBibleFindController();
    const [selectedBook, setSelectedBook] = useAppStateAsync(() => {
        return bibleFindController.getSelectedBook();
    });
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
    const setSelectedBook1 = (newSelectedBook: SelectedBookKeyType | null) => {
        setSelectedBook(newSelectedBook);
        bibleFindController.selectedBookKey = newSelectedBook?.bookKey ?? null;
        doFinding({ text: findText }, true);
    };
    const handleFinding = (text: string, isFresh?: boolean) => {
        if (!isFresh && findText === text) {
            return;
        }
        if (text === '') {
            setAllData({});
            setFindText('');
            return;
        }
        setFindText(text);
        doFinding({ text });
    };
    return (
        <div className="card app-overflow-hidden w-100 h-100">
            <div
                className="card-header input-group app-overflow-hidden p-0"
                style={{
                    height: '35px',
                    minWidth: '200px',
                }}
            >
                <BibleSelectionComp
                    onBibleKeyChange={setBibleKey}
                    bibleKey={bibleFindController.bibleKey}
                />
                <BibleFindHeaderComp handleFinding={handleFinding} />
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
                selectedBook={selectedBook ?? null}
                setSelectedBook={setSelectedBook1}
                isFinding={isFinding}
            />
        </div>
    );
}
