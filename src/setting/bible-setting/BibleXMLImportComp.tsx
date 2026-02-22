import type { FormEvent } from 'react';
import { useState, useTransition } from 'react';

import { tran } from '../../lang/langHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import LoadingComp from '../../others/LoadingComp';
import {
    checkIsValidUrl,
    getInputByName,
    readFromFile,
    readFromUrl,
    saveJsonDataToXMLfile,
} from './bibleXMLHelpers';
import { xmlFormatExample } from './bibleXMLAttributesGuessing';
import { xmlTextToJson } from './bibleXMLJsonDataHelpers';

export default function BibleXMLImportComp({
    loadBibleKeys,
}: Readonly<{
    loadBibleKeys: () => void;
}>) {
    const [isShowingExample, setIsShowingExample] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [urlText, setUrlText] = useState('');
    const [isPending, startTransition] = useTransition();
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const isValidUrl = checkIsValidUrl(urlText);
    const handleFileCanceling = (form: any) => {
        if (form instanceof HTMLFormElement) {
            const inputFile = getInputByName(form, 'file');
            if (inputFile instanceof HTMLInputElement) {
                inputFile.value = '';
            }
        }
        setIsFileSelected(false);
    };
    const handleFormSubmitting = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        startTransition(async () => {
            try {
                const form = event.currentTarget;
                if (!(form instanceof HTMLFormElement)) {
                    return;
                }
                let dataText: string | null = null;
                if (isFileSelected) {
                    dataText = await readFromFile(form, setLoadingMessage);
                } else if (isValidUrl) {
                    dataText = await readFromUrl(form, setLoadingMessage);
                }
                if (dataText === null) {
                    showSimpleToast('No Data', 'No data to process');
                    return;
                }
                const dataJson = await xmlTextToJson(dataText);
                if (dataJson === null) {
                    showSimpleToast('Parsing XML', 'Failed to parse XML data');
                    return;
                }
                const isSuccess = await saveJsonDataToXMLfile(dataJson);
                if (isSuccess) {
                    handleFileCanceling(form);
                    setUrlText('');
                    loadBibleKeys();
                }
            } catch (error) {
                showSimpleToast('Format Submit Error', `Error: ${error}`);
            }
        });
    };
    return (
        <div className="app-border-white-round p-1" style={{ margin: 'auto' }}>
            <h3>
                Import XML File{' '}
                <button
                    title="XML format example"
                    className={
                        'btn btn-sm ms-2' +
                        ` btn${isShowingExample ? '' : '-outline'}-info`
                    }
                    onClick={() => {
                        setIsShowingExample(!isShowingExample);
                    }}
                >
                    <i className="bi bi-question-lg" />
                </button>
            </h3>
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
                            className="form-control"
                            type="file"
                            name="file"
                            onChange={() => {
                                setIsFileSelected(true);
                            }}
                        />
                        {isFileSelected ? (
                            <button
                                className="btn btn-sm btn-danger"
                                type="button"
                                title={tran('Cancel selection')}
                                onClick={(event) => {
                                    const form = event.currentTarget.form;
                                    handleFileCanceling(form);
                                }}
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
                        <span>or</span>
                        <div className="input-group">
                            <div className="input-group-text">URL:</div>
                            <input
                                className={
                                    'form-control form-control-sm' +
                                    (!urlText || isValidUrl
                                        ? ''
                                        : ' is-invalid')
                                }
                                title={isValidUrl ? '' : 'Invalid URL'}
                                type="text"
                                name="url"
                                placeholder="http://example.com/file.xml"
                                value={urlText}
                                onChange={(event: any) => {
                                    setUrlText(event.target.value);
                                }}
                            />
                            {isValidUrl ? (
                                <button
                                    className="btn btn-sm btn-danger"
                                    type="button"
                                    title="Clear url"
                                    onClick={() => {
                                        setUrlText('');
                                    }}
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
