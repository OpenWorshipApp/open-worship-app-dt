import { useState } from 'react';

import {
    doFinding,
    FindDataType,
    SelectedBookKeyType,
} from './bibleFindHelpers';
import BibleFindRenderDataComp from './BibleFindRenderDataComp';
import BibleSelectionComp from '../bible-lookup/BibleSelectionComp';
import BibleFindHeaderComp from './BibleFindHeaderComp';
import { useBibleFindController } from './BibleFindController';
import {
    useAppEffect,
    useAppEffectAsync,
    useAppStateAsync,
} from '../helper/debuggerHelpers';
import RenderFindingInfoHeaderComp from './RenderFindingInfoHeaderComp';

export default function BibleFindBodyComp({
    setBibleKey,
}: Readonly<{
    setBibleKey: (_: string, newBibleKey: string) => void;
}>) {
    const bibleFindController = useBibleFindController();
    const [selectedBooks, setSelectedBooks] = useAppStateAsync(() => {
        return bibleFindController.getSelectedBooks();
    });
    const [findText, setFindText] = useState('');
    const [data, setData] = useState<FindDataType | null | undefined>(null);
    useAppEffectAsync(
        async (contextMethod) => {
            await doFinding(
                bibleFindController,
                findText,
                data,
                contextMethod.setData,
            );
        },
        [data],
        { setData },
    );
    useAppEffect(() => {
        if (!findText) {
            setData(null);
        } else {
            setData(undefined);
        }
    }, [findText, selectedBooks]);
    const setSelectedBooks1 = (newSelectedBooks: SelectedBookKeyType[]) => {
        bibleFindController.selectedBookKeys = newSelectedBooks.map((book) => {
            return book.bookKey;
        });
        setSelectedBooks(newSelectedBooks);
    };
    const handleFinding = (text: string, isFresh?: boolean) => {
        if (text === findText) {
            if (isFresh) {
                doFinding(bibleFindController, findText, undefined, setData);
            }
            return;
        }
        setFindText(text);
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
            <RenderFindingInfoHeaderComp
                bibleKey={bibleFindController.bibleKey}
                selectedBooks={selectedBooks ?? []}
                setSelectedBooks={setSelectedBooks1}
            />
            <BibleFindRenderDataComp
                findText={findText}
                data={data}
                findFor={(page: string) => {
                    setData((oldData) => {
                        if (!oldData || oldData.foundData[page] === undefined) {
                            return oldData;
                        }
                        return {
                            ...oldData,
                            foundData: {
                                ...oldData.foundData,
                                [page]: undefined,
                            },
                        };
                    });
                }}
            />
        </div>
    );
}
