import { useState } from 'react';
import { useBibleFindController } from './BibleFindController';
import { useAppEffect } from '../helper/debuggerHelpers';

export default function BibleFindHeaderComp({
    handleFind,
    isFinding,
}: Readonly<{
    handleFind: (isFresh?: boolean) => void;
    isFinding: boolean;
}>) {
    const bibleFindController = useBibleFindController();
    const [canFind, setCanFind] = useState(
        bibleFindController.findText?.trim() !== '',
    );
    useAppEffect(() => {
        bibleFindController.onTextChange = () => {
            setCanFind(!!bibleFindController.findText);
        };
        return () => {
            bibleFindController.onTextChange = () => {};
        };
    }, [bibleFindController]);
    const keyUpHandling = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            if (bibleFindController.isAddedByEnter) {
                bibleFindController.isAddedByEnter = false;
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            handleFind(true);
            return;
        }
        bibleFindController.handleKeyUp(event);
    };
    return (
        <>
            <input
                ref={(input) => {
                    bibleFindController.input = input;
                    return () => {
                        bibleFindController.input = null;
                    };
                }}
                data-bible-key={bibleFindController.bibleKey}
                type="text"
                className="form-control"
                onKeyUp={keyUpHandling}
                onChange={(event) => {
                    const value = event.currentTarget.value.trim();
                    if (!value) {
                        setCanFind(false);
                        bibleFindController.findText = '';
                    } else if (!canFind) {
                        setCanFind(true);
                    }
                }}
            />
            <button
                className="btn btn-sm"
                disabled={isFinding || !canFind}
                onClick={() => {
                    handleFind(true);
                }}
            >
                <i className="bi bi-search" />
            </button>
        </>
    );
}
