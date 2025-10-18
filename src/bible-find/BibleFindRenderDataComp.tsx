import { FindDataType } from './bibleFindHelpers';
import BibleFindRenderPerPageComp from './BibleFindRenderPerPageComp';
import { useBibleFindController } from './BibleFindController';
import { ShowFindingComp } from './ShowFindingComp';
import RenderPageNumberComp from './RenderPageNumberComp';

function RenderFooterComp({
    data,
    findFor,
}: Readonly<{
    data: FindDataType;
    findFor: (page: string) => void;
}>) {
    const pages = data.pagingData.pages;
    return (
        <nav>
            <ul className="pagination flex-wrap">
                {pages.map((pageNumber) => {
                    const isActive = !!data.foundData[pageNumber];
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
    );
}

function RenderFoundComp({
    findText,
    data,
}: Readonly<{
    findText: string;
    data: FindDataType;
}>) {
    const bibleFindController = useBibleFindController();
    const { pagingData, foundData: found } = data;
    const { bibleKey } = bibleFindController;
    return pagingData.pages.map((pageNumber) => {
        const data = found[pageNumber];
        if (data === null) {
            return null;
        }
        if (data === undefined) {
            return <ShowFindingComp key={pageNumber} />;
        }
        return (
            <BibleFindRenderPerPageComp
                key={pageNumber}
                findText={findText}
                items={data.content}
                page={pageNumber}
                bibleKey={bibleKey}
            />
        );
    });
}

export default function BibleFindRenderDataComp({
    findText,
    data,
    findFor,
}: Readonly<{
    findText: string;
    data: FindDataType | null | undefined;
    findFor: (page: string) => void;
}>) {
    if (data === undefined) {
        return <ShowFindingComp />;
    }
    if (data === null) {
        return (
            <div
                className="w-100 my-2"
                style={{ margin: 'auto', textAlign: 'center' }}
            >
                `No data available
            </div>
        );
    }
    return (
        <div
            className="card-body w-100 overflow-hidden d-flex flex-column"
            style={{ height: 'calc(100% - 35px)' }}
        >
            <div
                className="w-100 h-100 d-flex flex-column overflow-hidden"
                style={{
                    position: 'relative',
                }}
            >
                <div
                    className="w-100 px-1"
                    style={{ overflowY: 'auto', height: 'calc(100% - 42px)' }}
                >
                    <RenderFoundComp findText={findText} data={data} />
                </div>
                <div
                    className="p-0"
                    style={{
                        minHeight: 42,
                        maxHeight: 100,
                        overflowY: 'auto',
                        borderTop: '2px solid var(--bs-border-color)',
                    }}
                >
                    <RenderFooterComp data={data} findFor={findFor} />
                </div>
            </div>
        </div>
    );
}
