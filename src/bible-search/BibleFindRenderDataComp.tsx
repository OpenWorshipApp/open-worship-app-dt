import { genBookMatches } from '../helper/bible-helpers/serverBibleHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import LoadingComp from '../others/LoadingComp';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    calcPaging,
    BibleFindResultType,
    pageNumberToReqData,
    SelectedBookKeyType,
} from './bibleFindHelpers';
import BibleFindRenderPerPageComp, {
    APP_FOUND_PAGE_CLASS,
} from './BibleFindRenderPerPageComp';
import { useBibleFindController } from './BibleFindController';
import { bringDomToBottomView, bringDomToTopView } from '../helper/helpers';

async function selectBookKey(
    event: any,
    bibleKey: string,
    selectedBook: SelectedBookKeyType,
    setSelectedBook: (_: SelectedBookKeyType) => void,
) {
    const bookList = await genBookMatches(bibleKey, '');
    if (bookList === null) {
        showSimpleToast('Getting bible list', 'Fail to get bible list');
        return;
    }
    const contextMenuItems: ContextMenuItemType[] = [
        {
            menuElement: 'All Books',
            onSelect: () => {
                setSelectedBook(null);
            },
        },
        ...bookList.map(({ bookKey, book, bookKJV, isAvailable }) => {
            const extraName = book !== bookKJV ? ` (${bookKJV})` : '';
            return {
                menuElement: (
                    <span
                        data-bible-key={bibleKey}
                    >{`${book}${extraName}`}</span>
                ),
                disabled: !isAvailable || selectedBook?.bookKey === bookKey,
                onSelect: () => {
                    setSelectedBook({ bookKey, book });
                },
            } as ContextMenuItemType;
        }),
    ];
    showAppContextMenu(event, contextMenuItems);
}

function RenderPageNumberComp({
    pageNumber,
    isActive,
    handleFinding,
}: Readonly<{
    pageNumber: string;
    isActive: boolean;
    handleFinding: (pageNumber: string) => void;
}>) {
    return (
        <li
            key={pageNumber}
            className={`page-item ${isActive ? 'active' : ''}`}
        >
            <button
                className="page-link"
                onClick={() => {
                    if (isActive) {
                        const dom = document.querySelector(
                            `.${APP_FOUND_PAGE_CLASS}-${pageNumber}`,
                        );
                        if (dom !== null) {
                            bringDomToTopView(dom);
                        }
                        return;
                    }
                    handleFinding(pageNumber);
                }}
            >
                {pageNumber}
            </button>
        </li>
    );
}

function ShowFindComp() {
    return (
        <div
            className="d-flex justify-content-center"
            ref={(element) => {
                if (element === null) {
                    return;
                }
                bringDomToBottomView(element);
            }}
        >
            <hr />
            <LoadingComp />
        </div>
    );
}

function RenderFooterComp({
    pages,
    allPageNumberFound,
    findFor,
}: Readonly<{
    pages: string[];
    allPageNumberFound: string[];
    findFor: (pageNumber: string) => void;
}>) {
    if (pages.length === 0) {
        return null;
    }
    return (
        <div
            className="card-footer p-0"
            style={{
                minHeight: 60,
                maxHeight: 200,
                overflowY: 'auto',
            }}
        >
            <nav>
                <ul className="pagination flex-wrap">
                    {pages.map((pageNumber) => {
                        const isActive =
                            allPageNumberFound.includes(pageNumber);
                        return (
                            <RenderPageNumberComp
                                key={pageNumber}
                                pageNumber={pageNumber}
                                isActive={isActive}
                                handleFinding={findFor}
                            />
                        );
                    })}
                </ul>
            </nav>
        </div>
    );
}

export default function BibleFindRenderDataComp({
    text,
    allData,
    findFor,
    selectedBook,
    setSelectedBook,
    isFinding,
}: Readonly<{
    text: string;
    allData: { [key: string]: BibleFindResultType };
    findFor: (from: number, to: number) => void;
    selectedBook: SelectedBookKeyType;
    setSelectedBook: (_: SelectedBookKeyType) => void;
    isFinding: boolean;
}>) {
    const bibleFindController = useBibleFindController();
    useAppEffect(() => {
        setSelectedBook(null);
    }, [bibleFindController]);
    const allPageNumberFound = Object.keys(allData);
    const pagingData = calcPaging(
        allPageNumberFound.length ? allData[allPageNumberFound[0]] : null,
    );
    const findFor1 = (pageNumber: string) => {
        const findForData = pageNumberToReqData(pagingData, pageNumber);
        findFor(findForData.fromLineNumber, findForData.toLineNumber);
    };
    return (
        <div
            className="card card-body w-100 overflow-hidden"
            style={{ height: 'calc(100% - 35px)' }}
        >
            <div className="card-body px-1">
                <div className="d-flex w-100">
                    <div className="flex-fill">
                        {text ? <span>{`Result for :"${text}"`}</span> : null}
                    </div>
                    <div>
                        <button
                            className="btn btn-sm btn-info"
                            onClick={(event) => {
                                selectBookKey(
                                    event,
                                    bibleFindController.bibleKey,
                                    selectedBook,
                                    setSelectedBook,
                                );
                            }}
                        >
                            <span data-bible-key={bibleFindController.bibleKey}>
                                {selectedBook === null
                                    ? 'All Books'
                                    : selectedBook.book}
                            </span>
                        </button>
                    </div>
                </div>
                {allPageNumberFound.map((pageNumber) => {
                    if (!pagingData.pages.includes(pageNumber)) {
                        return null;
                    }
                    const data = allData[pageNumber];
                    return (
                        <BibleFindRenderPerPageComp
                            key={pageNumber}
                            findText={text}
                            items={data.content}
                            pageNumber={pageNumber}
                            bibleKey={bibleFindController.bibleKey}
                        />
                    );
                })}
                {isFinding ? <ShowFindComp /> : null}
            </div>
            <RenderFooterComp
                pages={pagingData.pages}
                allPageNumberFound={allPageNumberFound}
                findFor={findFor1}
            />
        </div>
    );
}
