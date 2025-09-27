import { genBookMatches } from '../helper/bible-helpers/serverBibleHelpers';
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
import ScrollingHandlerComp from '../scrolling/ScrollingHandlerComp';

async function selectBookKey(
    event: any,
    bibleKey: string,
    selectedBook: SelectedBookKeyType | null,
    setSelectedBook: (selectedBook: SelectedBookKeyType | null) => void,
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

function ShowFindingComp() {
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
            className="p-0"
            style={{
                minHeight: 60,
                maxHeight: 200,
                overflowY: 'auto',
                borderTop: '2px solid var(--bs-border-color)',
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
            <ScrollingHandlerComp />
        </div>
    );
}

function RenderFindingInfoHeaderComp({
    bibleKey,
    selectedBook,
    setSelectedBook,
}: Readonly<{
    text: string;
    bibleKey: string;
    selectedBook: SelectedBookKeyType | null;
    setSelectedBook: (selectedBook: SelectedBookKeyType | null) => void;
}>) {
    return (
        <div className="w-100 d-flex overflow-hidden">
            <div className="flex-fill overflow-hidden"></div>
            <div>
                <button
                    className="btn btn-sm btn-info"
                    onClick={(event) => {
                        selectBookKey(
                            event,
                            bibleKey,
                            selectedBook,
                            setSelectedBook,
                        );
                    }}
                >
                    <span data-bible-key={bibleKey}>
                        {selectedBook === null
                            ? 'All Books'
                            : selectedBook.book}
                    </span>
                </button>
            </div>
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
    selectedBook: SelectedBookKeyType | null;
    setSelectedBook: (selectedBook: SelectedBookKeyType | null) => void;
    isFinding: boolean;
}>) {
    const bibleFindController = useBibleFindController();
    const allPageNumberFound = Object.keys(allData);
    const pagingData = calcPaging(
        allPageNumberFound.length ? allData[allPageNumberFound[0]] : null,
    );
    const findFor1 = (pageNumber: string) => {
        const findForData = pageNumberToReqData(pagingData, pageNumber);
        findFor(findForData.fromLineNumber, findForData.toLineNumber);
    };
    const { bibleKey } = bibleFindController;
    return (
        <div
            className="card card-body w-100 overflow-hidden d-flex flex-column"
            style={{ height: 'calc(100% - 35px)' }}
        >
            <div
                className="w-100 flex-fill overflow-hidden"
                style={{
                    position: 'relative',
                }}
            >
                <div className="w-100 h-100 px-1" style={{ overflowY: 'auto' }}>
                    <RenderFindingInfoHeaderComp
                        text={text}
                        bibleKey={bibleKey}
                        selectedBook={selectedBook}
                        setSelectedBook={setSelectedBook}
                    />
                    {isFinding ? <ShowFindingComp /> : null}
                    {allPageNumberFound.length === 0 && !isFinding ? (
                        <div
                            className="my-2"
                            style={{ margin: 'auto', textAlign: 'center' }}
                        >
                            `No data available
                        </div>
                    ) : null}
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
                    <ScrollingHandlerComp />
                </div>
            </div>
            <RenderFooterComp
                pages={pagingData.pages}
                allPageNumberFound={allPageNumberFound}
                findFor={findFor1}
            />
        </div>
    );
}
