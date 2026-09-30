import { useMemo, useState } from 'react';

import AppDocument, {
    type DocumentFontTargetType,
} from '../../../app-document-list/AppDocument';
import { useAppStateAsync } from '../../../helper/appHooks';
import { useFileSourceEvents } from '../../../helper/dirSourceHelpers';
import { genTimeoutAttempt } from '../../../helper/timeoutHelpers';
import { tran } from '../../../lang/langHelpers';
import type { CanvasItemTextPropsType } from '../CanvasItemText';
import type { CanvasItemBiblePropsType } from '../CanvasItemBibleItem';

export default function DocumentFontTargetsComp({
    filePath,
    includeLocked,
    targets,
    setTargets,
}: Readonly<{
    filePath: string;
    includeLocked: boolean;
    targets: DocumentFontTargetType[];
    setTargets: (targets: DocumentFontTargetType[]) => void;
}>) {
    const [revision, setRevision] = useState(0);
    const attemptTimeout = useMemo(() => genTimeoutAttempt(500), []);
    useFileSourceEvents(
        ['update'],
        () => {
            attemptTimeout(() => setRevision((value) => value + 1));
        },
        [],
        filePath,
    );
    const [slides] = useAppStateAsync(async () => {
        const data = await AppDocument.getInstance(filePath).getJsonData();
        // The picker needs labels and ids, not a retained copy of every Bible
        // passage, HTML fragment or media payload in the document.
        return data.items.map((slide) => ({
            id: slide.id,
            name: slide.name,
            items: slide.canvasItems
                .filter((item) => ['text', 'bible', 'html'].includes(item.type))
                .map((item) => {
                    const text =
                        item.type === 'text'
                            ? (item as CanvasItemTextPropsType).text
                            : item.type === 'bible'
                              ? (item as CanvasItemBiblePropsType)
                                    .bibleRenderingList?.[0]?.title
                              : '';
                    return {
                        id: item.id,
                        type: item.type,
                        locked: item.locked,
                        description: text
                            ?.replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, 60),
                    };
                }),
        }));
    }, [filePath, revision]);
    if (!slides) {
        return <div>{tran('Loading')}...</div>;
    }

    const selectSlide = (slideId: number, itemIds: number[]) => {
        setTargets([
            ...targets.filter((target) => target.slideId !== slideId),
            ...(itemIds.length ? [{ slideId, itemIds }] : []),
        ]);
    };

    return (
        <div
            className="d-flex flex-column gap-1"
            style={{ maxHeight: '260px', overflow: 'auto' }}
        >
            {slides.map((slide, index) => {
                const { items } = slide;
                const eligibleIds = items
                    .filter((item) => {
                        return includeLocked || !item.locked;
                    })
                    .map((item) => item.id);
                const selectedIds =
                    targets.find((target) => {
                        return target.slideId === slide.id;
                    })?.itemIds ?? [];
                const selectedCount = eligibleIds.filter((id) =>
                    selectedIds.includes(id),
                ).length;
                const isAllSelected =
                    eligibleIds.length > 0 &&
                    selectedCount === eligibleIds.length;
                const label = `${tran('Slide')} ${index + 1}${slide.name ? `: ${slide.name}` : ''}`;
                return (
                    <div key={slide.id} className="border rounded p-1">
                        <label className="d-flex align-items-center gap-2 small">
                            <input
                                type="checkbox"
                                className="form-check-input m-0 flex-shrink-0"
                                checked={isAllSelected}
                                ref={(element) => {
                                    if (element) {
                                        element.indeterminate =
                                            selectedCount > 0 && !isAllSelected;
                                    }
                                }}
                                disabled={eligibleIds.length === 0}
                                onChange={() =>
                                    selectSlide(
                                        slide.id,
                                        isAllSelected ? [] : eligibleIds,
                                    )
                                }
                            />
                            <span>{label}</span>
                        </label>
                        {items.length > 0 ? (
                            <details className="ms-3 small">
                                <summary>
                                    {tran('Canvas Items')} ({selectedCount}/
                                    {eligibleIds.length})
                                </summary>
                                {items.map((item) => {
                                    const description =
                                        item.description ||
                                        (item.type === 'bible'
                                            ? tran('Bible')
                                            : item.type === 'html'
                                              ? 'HTML'
                                              : '');
                                    return (
                                        <label
                                            key={item.id}
                                            className="d-flex align-items-start gap-2 py-1"
                                        >
                                            <input
                                                type="checkbox"
                                                className="form-check-input flex-shrink-0"
                                                checked={selectedIds.includes(
                                                    item.id,
                                                )}
                                                disabled={
                                                    item.locked === true &&
                                                    !includeLocked
                                                }
                                                onChange={(event) =>
                                                    selectSlide(
                                                        slide.id,
                                                        event.target.checked
                                                            ? [
                                                                  ...selectedIds,
                                                                  item.id,
                                                              ]
                                                            : selectedIds.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      item.id,
                                                              ),
                                                    )
                                                }
                                            />
                                            <span>
                                                {tran('Item ID:')} {item.id}
                                                {item.locked ? ' 🔒' : ''}
                                                {description
                                                    ? ` — ${description}`
                                                    : ''}
                                            </span>
                                        </label>
                                    );
                                })}
                            </details>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
