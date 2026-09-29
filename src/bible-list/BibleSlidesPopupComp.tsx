import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FloatingWidgetComp from '../app-modal/FloatingWidgetComp';
import { useAppStateAsync } from '../helper/appHooks';
import { getAllLocalBibleInfoList } from '../helper/bible-helpers/bibleDownloadHelpers';
import { tran } from '../lang/langHelpers';
import { useThemeSource } from '../others/themeHelpers';
import type BibleItem from './BibleItem';
import {
    generateBibleItemSlides,
    type BibleSlideOptions,
} from './bibleSlidesHelpers';
import AppDocument from '../app-document-list/AppDocument';
import { useSelectedAppDocumentSetterContext } from '../app-document-list/appDocumentHelpers';
import { previewingEventListener } from '../event/PreviewingEventListener';

export default function BibleSlidesPopupComp({
    bibleItem,
    onClose,
}: Readonly<{
    bibleItem: BibleItem;
    onClose: () => void;
}>) {
    const { theme } = useThemeSource();
    const setSelectedAppDocument = useSelectedAppDocumentSetterContext();
    const [bibles] = useAppStateAsync(getAllLocalBibleInfoList, []);
    const [title] = useAppStateAsync(
        () => bibleItem.toTitleWithBibleKey(),
        [bibleItem],
    );
    const [bibleKeys, setBibleKeys] = useState([bibleItem.bibleKey]);
    const [fontSize, setFontSize] = useState('');
    const [slideTheme, setSlideTheme] =
        useState<BibleSlideOptions['theme']>('dark');
    const fontSizeId = useId();
    const themeId = useId();
    const sizeHelpId = useId();
    const isValidSize =
        fontSize === '' ||
        (Number.isFinite(Number(fontSize)) && Number(fontSize) > 0);
    const [isGenerating, setIsGenerating] = useState(false);
    const isRunning = useRef(false);
    const close = () => {
        if (!isRunning.current) {
            onClose();
        }
    };
    return createPortal(
        <div className="app app-floating-widget-portal" data-bs-theme={theme}>
            <FloatingWidgetComp
                title={tran('Generate Slides')}
                widgetName="Generate Slides"
                onClose={close}
                options={{
                    width: 480,
                    height: 560,
                    minWidth: 320,
                    minHeight: 280,
                }}
            >
                <form
                    className="p-3 d-flex flex-column h-100 gap-2 overflow-auto"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (isRunning.current || !isValidSize) {
                            return;
                        }
                        isRunning.current = true;
                        setIsGenerating(true);
                        try {
                            const file = await generateBibleItemSlides(
                                bibleItem,
                                bibleKeys,
                                {
                                    fontSize:
                                        fontSize === ''
                                            ? undefined
                                            : Number(fontSize),
                                    theme: slideTheme,
                                },
                            );
                            if (file !== null) {
                                const appDocument = AppDocument.getInstance(
                                    file.filePath,
                                );
                                if (await setSelectedAppDocument(appDocument)) {
                                    previewingEventListener.showVaryAppDocument(
                                        appDocument,
                                    );
                                }
                                onClose();
                            }
                        } finally {
                            isRunning.current = false;
                            setIsGenerating(false);
                        }
                    }}
                >
                    <strong>{title}</strong>
                    <div className="row g-2 flex-shrink-0">
                        <div className="col-6">
                            <label
                                className="form-label mb-1"
                                htmlFor={fontSizeId}
                            >
                                {tran('Font Size')}
                            </label>
                            <div className="input-group">
                                <input
                                    id={fontSizeId}
                                    className="form-control"
                                    type="number"
                                    min={1}
                                    step="any"
                                    placeholder={tran('Auto')}
                                    value={fontSize}
                                    disabled={isGenerating}
                                    aria-describedby={sizeHelpId}
                                    onChange={(event) =>
                                        setFontSize(event.target.value)
                                    }
                                />
                                <span className="input-group-text">px</span>
                            </div>
                        </div>
                        <div className="col-6">
                            <label
                                className="form-label mb-1"
                                htmlFor={themeId}
                            >
                                {tran('Theme')}
                            </label>
                            <select
                                id={themeId}
                                className="form-select"
                                value={slideTheme}
                                disabled={isGenerating}
                                onChange={(event) =>
                                    setSlideTheme(
                                        event.target.value === 'light'
                                            ? 'light'
                                            : 'dark',
                                    )
                                }
                            >
                                <option value="dark">{tran('Dark')}</option>
                                <option value="light">{tran('Light')}</option>
                            </select>
                        </div>
                    </div>
                    <p id={sizeHelpId} className="small text-muted mb-1">
                        {tran('Leave empty for Auto. Text shrinks to fit.')}
                    </p>
                    <p className="mb-1">
                        {tran('Choose Bible versions to include on each slide')}
                    </p>
                    <div
                        className="flex-grow-1 overflow-auto"
                        style={{ minHeight: 100 }}
                    >
                        <label className="d-flex align-items-center gap-2 p-2">
                            <input
                                type="checkbox"
                                className="form-check-input m-0"
                                checked
                                disabled
                            />
                            {bibleItem.bibleKey}
                        </label>
                        {bibles === undefined && (
                            <p role="status">{tran('Loading')}</p>
                        )}
                        {bibles === null && (
                            <p role="alert">
                                {tran('Unable to get bible info list')}
                            </p>
                        )}
                        {(bibles ?? [])
                            .filter(({ key }) => key !== bibleItem.bibleKey)
                            .map((bible) => (
                                <label
                                    key={bible.key}
                                    className="d-flex align-items-center gap-2 p-2"
                                    data-locale-ff={bible.locale}
                                >
                                    <input
                                        type="checkbox"
                                        className="form-check-input m-0"
                                        checked={bibleKeys.includes(bible.key)}
                                        disabled={isGenerating}
                                        onChange={() =>
                                            setBibleKeys((keys) =>
                                                keys.includes(bible.key)
                                                    ? keys.filter(
                                                          (key) =>
                                                              key !== bible.key,
                                                      )
                                                    : [...keys, bible.key],
                                            )
                                        }
                                    />
                                    <span>
                                        {bible.key} — {bible.title}
                                    </span>
                                </label>
                            ))}
                    </div>
                    <p className="small text-muted mb-1">
                        {tran(
                            'A title slide, then one verse per slide with all selected Bible versions',
                        )}{' '}
                        {tran(
                            'The next verse appears quietly at the bottom right',
                        )}
                    </p>
                    <div className="d-flex justify-content-end gap-2">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={isGenerating}
                            onClick={close}
                        >
                            {tran('Cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isGenerating || !isValidSize}
                        >
                            {isGenerating && (
                                <span
                                    className="spinner-border spinner-border-sm me-2"
                                    aria-hidden="true"
                                />
                            )}
                            {tran('Generate Slides')}
                        </button>
                    </div>
                </form>
            </FloatingWidgetComp>
        </div>,
        document.body,
    );
}
