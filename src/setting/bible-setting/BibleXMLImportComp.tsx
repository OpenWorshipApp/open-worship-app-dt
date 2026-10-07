import { lazy, Suspense, useCallback, useState, useTransition } from 'react';
import type { ChangeEvent, SyntheticEvent, MouseEvent } from 'react';

import { tran } from '../../lang/langHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import LoadingComp from '../../others/LoadingComp';
import {
    checkIsValidUrl,
    getInputByName,
    readFromFile,
    readFromUrl,
} from './bibleXMLHelpers';
import { xmlFormatExample } from './bibleXMLAttributesGuessing';
import {
    xmlTextToJson,
    type BibleXMLJsonType,
} from './bibleXMLJsonDataHelpers';
import { useAppCurrentRef, useAppEffect } from '../../helper/appHooks';
import { takeBibleImportRequest } from './bibleImportRequestHelpers';

const LazyBibleImportReviewComp = lazy(() => import('./BibleImportReviewComp'));

export default function BibleXMLImportComp({
    loadBibleKeys,
}: Readonly<{
    loadBibleKeys: () => void;
}>) {
    const [isShowingExample, setIsShowingExample] = useState(false);
    const [selectedFileName, setSelectedFileName] = useState('');
    const [urlText, setUrlText] = useState('');
    const [reviewData, setReviewData] = useState<BibleXMLJsonType | null>(null);
    const reviewDataRef = useAppCurrentRef(reviewData);
    const [keyChoices, setKeyChoices] = useState<string[]>([]);
    useAppEffect(() => {
        const takeRequest = () => {
            if (reviewDataRef.current !== null) return;
            const url = takeBibleImportRequest();
            if (url !== null) {
                setSelectedFileName('');
                setUrlText(url);
            }
        };
        takeRequest();
        window.addEventListener('focus', takeRequest);
        return () => window.removeEventListener('focus', takeRequest);
    }, [reviewData]);
    const [isPending, startTransition] = useTransition();
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const isFileSelected = selectedFileName !== '';
    const isValidUrl = checkIsValidUrl(urlText);
    const handleFileCanceling = useCallback((form: any) => {
        if (form instanceof HTMLFormElement) {
            const inputFile = getInputByName(form, 'file');
            if (inputFile instanceof HTMLInputElement) {
                inputFile.value = '';
            }
        }
        setSelectedFileName('');
    }, []);
    const isFileSelectedRef = useAppCurrentRef(isFileSelected);
    const isValidUrlRef = useAppCurrentRef(isValidUrl);
    const loadBibleKeysRef = useAppCurrentRef(loadBibleKeys);
    const handleFileCancelingRef = useAppCurrentRef(handleFileCanceling);
    const handleFormSubmitting = useCallback(
        async (event: SyntheticEvent<HTMLFormElement>) => {
            event.preventDefault();
            startTransition(async () => {
                try {
                    const form = event.currentTarget;
                    if (!(form instanceof HTMLFormElement)) {
                        return;
                    }
                    const sourceName = isFileSelectedRef.current
                        ? (getInputByName(form, 'file') as HTMLInputElement)
                              ?.files?.[0]?.name
                        : getInputByName(form, 'url')?.value;
                    let dataText: string | null = null;
                    if (isFileSelectedRef.current) {
                        dataText = await readFromFile(form, setLoadingMessage);
                    } else if (isValidUrlRef.current) {
                        dataText = await readFromUrl(form, setLoadingMessage);
                    }
                    if (dataText === null) {
                        showSimpleToast(
                            tran('No Data'),
                            tran('No data to process'),
                        );
                        return;
                    }
                    const dataJson = await xmlTextToJson(dataText, {
                        isImportPreview: true,
                        sourceName,
                        onKeyChoices: setKeyChoices,
                    });
                    if (dataJson === null) {
                        showSimpleToast(
                            tran('Parsing XML'),
                            tran('Failed to parse XML data'),
                        );
                        return;
                    }
                    setReviewData(dataJson);
                } catch (error) {
                    showSimpleToast(
                        tran('Format Submit Error'),
                        `Error: ${error}`,
                    );
                }
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const isShowingExampleRef = useAppCurrentRef(isShowingExample);
    const handleToggleExample = useCallback(() => {
        setIsShowingExample(!isShowingExampleRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleFileSelected = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setSelectedFileName(event.currentTarget.files?.[0]?.name ?? '');
        },
        [],
    );
    const handleCancelSelection = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            const form = event.currentTarget.form;
            handleFileCancelingRef.current(form);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleUrlChange = useCallback((event: any) => {
        setUrlText(event.target.value);
    }, []);
    const handleClearUrl = useCallback(() => {
        setUrlText('');
    }, []);
    // The way in for somebody this form is too much for: the assistant
    // finds the Bible by its language (or takes the link already typed
    // below) and asks one plain question at a time, with buttons.
    const urlTextRef = useAppCurrentRef(urlText);
    const handleAskingAssistant = useCallback(async () => {
        const url = isValidUrlRef.current ? urlTextRef.current.trim() : '';
        // Loaded at the press: the caution and the window opener are
        // nothing this panel needs until somebody asks for the assistant.
        const { openChatbotAsking } =
            await import('../../helper/ai/chatbotHandoffHelpers');
        await openChatbotAsking(
            url === '' ? 'Import bible' : `Import bible from ${url}`,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (reviewData !== null)
        return (
            <Suspense fallback={<LoadingComp />}>
                <LazyBibleImportReviewComp
                    data={reviewData}
                    keyChoices={keyChoices}
                    onCancel={() => {
                        setReviewData(null);
                        setSelectedFileName('');
                    }}
                    onImported={() => {
                        setReviewData(null);
                        setSelectedFileName('');
                        setUrlText('');
                        loadBibleKeysRef.current();
                    }}
                />
            </Suspense>
        );
    return (
        <div className="app-border-white-round p-1" style={{ margin: 'auto' }}>
            <h3>
                {tran('Import XML File')}{' '}
                <button
                    title={tran('XML format example')}
                    className={
                        'btn btn-sm ms-2' +
                        ` btn${isShowingExample ? '' : '-outline'}-info`
                    }
                    onClick={handleToggleExample}
                >
                    <i className="bi bi-question-lg" />
                </button>
            </h3>
            <div className="mb-2">
                <button
                    type="button"
                    className="btn btn-info w-100"
                    disabled={isPending}
                    onClick={handleAskingAssistant}
                >
                    <i className="bi bi-robot me-2" />
                    {tran('Let the assistant import a Bible for me')}
                </button>
                <div className="form-text">
                    {isValidUrl
                        ? tran('It will use the link you typed below.')
                        : tran(
                              'It finds Bibles in your language and asks you a few simple questions.',
                          )}
                </div>
            </div>
            {isShowingExample ? (
                <div>
                    <textarea
                        className="form-control"
                        style={{
                            padding: '5px',
                            height: '200px',
                        }}
                        defaultValue={xmlFormatExample}
                        readOnly
                    />
                </div>
            ) : null}
            <form onSubmit={handleFormSubmitting}>
                <div className="p-1">
                    <div
                        className="input-group"
                        style={{
                            opacity: isValidUrl ? 0.5 : 1,
                            pointerEvents: isValidUrl ? 'none' : 'auto',
                        }}
                    >
                        <input
                            id="bible-xml-file-input"
                            className="visually-hidden"
                            type="file"
                            name="file"
                            accept=".xml,text/xml,application/xml"
                            aria-describedby="bible-xml-file-name"
                            onChange={handleFileSelected}
                        />
                        <label
                            className="btn btn-outline-secondary"
                            htmlFor="bible-xml-file-input"
                        >
                            {tran('Choose File')}
                        </label>
                        <div
                            id="bible-xml-file-name"
                            className="form-control text-truncate"
                            aria-live="polite"
                            title={selectedFileName || tran('No file chosen')}
                        >
                            {selectedFileName || tran('No file chosen')}
                        </div>
                        {isFileSelected ? (
                            <button
                                className="btn btn-sm btn-danger"
                                type="button"
                                title={tran('Cancel selection')}
                                onClick={handleCancelSelection}
                            >
                                <i className="bi bi-x-lg" />
                            </button>
                        ) : null}
                    </div>
                    <div
                        style={{
                            opacity: isFileSelected ? 0.5 : 1,
                            pointerEvents: isFileSelected ? 'none' : 'auto',
                        }}
                    >
                        <span>{tran('Or')}</span>
                        <div className="input-group">
                            <div className="input-group-text">
                                {tran('URL:')}
                            </div>
                            <input
                                className={
                                    'form-control form-control-sm' +
                                    (!urlText || isValidUrl
                                        ? ''
                                        : ' is-invalid')
                                }
                                title={isValidUrl ? '' : tran('Invalid URL')}
                                type="text"
                                name="url"
                                placeholder="http://example.com/file.xml"
                                value={urlText}
                                onChange={handleUrlChange}
                            />
                            {isValidUrl ? (
                                <button
                                    className="btn btn-sm btn-danger"
                                    type="button"
                                    title={tran('Clear url')}
                                    onClick={handleClearUrl}
                                >
                                    <i className="bi bi-x-lg" />
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
                <div>
                    <input
                        className="form-control btn btn-primary"
                        type="submit"
                        value={tran('Import')}
                        disabled={isPending || !(isFileSelected || isValidUrl)}
                    />
                </div>
                {isPending ? (
                    <div className="app-border-white-round">
                        <LoadingComp message={loadingMessage} />
                    </div>
                ) : null}
            </form>
        </div>
    );
}
