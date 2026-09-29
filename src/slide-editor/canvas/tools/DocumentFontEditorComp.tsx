import { useId, useRef, useState } from 'react';

import AppDocument, {
    type DocumentFontChangeType,
    type DocumentFontTargetType,
} from '../../../app-document-list/AppDocument';
import { useSelectedEditingSlideContext } from '../../../app-document-list/appDocumentHelpers';
import { handleError } from '../../../helper/errorHelpers';
import { tran } from '../../../lang/langHelpers';
import FontFamilyControlComp from '../../../others/FontFamilyControlComp';
import SlideEditorToolTitleComp from './SlideEditorToolTitleComp';
import DocumentFontTargetsComp from './DocumentFontTargetsComp';

function DocumentFontFieldsComp({ filePath }: Readonly<{ filePath: string }>) {
    const sizeId = useId();
    const scopeId = useId();
    const [fontSize, setFontSize] = useState('60');
    const [fontFamily, setFontFamily] = useState('');
    const [includeLocked, setIncludeLocked] = useState(false);
    const [isChoosingTargets, setIsChoosingTargets] = useState(false);
    const [targets, setTargets] = useState<DocumentFontTargetType[]>([]);
    const [isApplying, setIsApplying] = useState(false);
    const applyingRef = useRef(false);
    const [changedItems, setChangedItems] = useState<number | null>(null);
    const [hasError, setHasError] = useState(false);
    const size = Number(fontSize);
    const isValidSize = Number.isFinite(size) && size > 0;
    const hasTargets =
        !isChoosingTargets || targets.some((target) => target.itemIds?.length);

    const applyFont = async (change: DocumentFontChangeType) => {
        if (applyingRef.current) {
            return;
        }
        applyingRef.current = true;
        setIsApplying(true);
        setChangedItems(null);
        setHasError(false);
        try {
            const appDocument = AppDocument.getInstance(filePath);
            setChangedItems(
                await appDocument.changeSlidesFont(change, {
                    includeLocked,
                    targets: isChoosingTargets ? targets : undefined,
                }),
            );
        } catch (error) {
            handleError(error);
            setHasError(true);
        } finally {
            applyingRef.current = false;
            setIsApplying(false);
        }
    };

    return (
        <div role="group" aria-label={tran('Bulk Font')}>
            <p className="small text-muted mb-2">
                {tran('Apply to text, Bible and HTML items.')}
            </p>
            <fieldset
                disabled={isApplying}
                className="d-flex flex-column gap-2"
            >
                <div>
                    <label htmlFor={scopeId}>{tran('Apply to')}</label>
                    <select
                        id={scopeId}
                        aria-label={tran('Apply to')}
                        className="form-select form-select-sm"
                        value={isChoosingTargets ? 'choose' : 'all'}
                        onChange={(event) =>
                            setIsChoosingTargets(
                                event.target.value === 'choose',
                            )
                        }
                    >
                        <option value="all">{tran('All Slides')}</option>
                        <option value="choose">
                            {tran('Choose slides and items')}
                        </option>
                    </select>
                </div>
                <label className="d-flex align-items-center gap-2 small">
                    <input
                        type="checkbox"
                        className="form-check-input m-0"
                        checked={includeLocked}
                        onChange={(event) =>
                            setIncludeLocked(event.target.checked)
                        }
                    />
                    {tran('Include locked items')}
                </label>
                {isChoosingTargets ? (
                    <DocumentFontTargetsComp
                        filePath={filePath}
                        includeLocked={includeLocked}
                        targets={targets}
                        setTargets={setTargets}
                    />
                ) : null}
                <div>
                    <label htmlFor={sizeId}>{tran('Font Size')}</label>
                    <div className="d-flex flex-wrap align-items-center gap-1">
                        <input
                            id={sizeId}
                            aria-label={tran('Font Size')}
                            className="form-control form-control-sm"
                            style={{ maxWidth: '100px' }}
                            type="number"
                            min="1"
                            step="any"
                            value={fontSize}
                            onChange={(event) =>
                                setFontSize(event.target.value)
                            }
                        />
                        <span>px</span>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={!isValidSize || !hasTargets}
                            onClick={() => applyFont({ fontSize: size })}
                        >
                            {tran('Apply Font Size')}
                        </button>
                    </div>
                </div>
                <div>
                    <FontFamilyControlComp
                        fontFamily={fontFamily}
                        setFontFamily={setFontFamily}
                        isShowingLabel
                    />
                    <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={!hasTargets}
                        onClick={() => applyFont({ fontFamily })}
                    >
                        {tran('Apply Font Family')}
                    </button>
                </div>
            </fieldset>
            <div role="status" className="small mt-2">
                {hasError
                    ? tran('Failed to apply font changes')
                    : changedItems === null
                      ? null
                      : changedItems === 0
                        ? tran('No items needed updating')
                        : `${tran('Updated items:')} ${changedItems}`}
            </div>
        </div>
    );
}

export default function DocumentFontEditorComp() {
    const slide = useSelectedEditingSlideContext();
    return (
        <SlideEditorToolTitleComp
            title={tran('Bulk Font')}
            isCollapsible
            isInitiallyExpanded={false}
            persistingKey="document-font-editor"
        >
            <DocumentFontFieldsComp
                key={slide.filePath}
                filePath={slide.filePath}
            />
        </SlideEditorToolTitleComp>
    );
}
