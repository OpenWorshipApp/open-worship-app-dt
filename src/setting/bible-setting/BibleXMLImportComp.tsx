import { useState, useTransition } from 'react';

import { showSimpleToast } from '../../toast/toastHelpers';
import LoadingComp from '../../others/LoadingComp';
import {
    checkIsValidUrl, getInputByName, readFromFile,
    readFromUrl, saveJsonDataToXMLfile, xmlToJson,
} from './bibleXMLHelpers';
import { xmlFormatExample } from './bibleXMLAttributesGuessing';

export default function BibleXMLImportComp({ loadBibleKeys }: Readonly<{
    loadBibleKeys: () => void,
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
    const handleFormSubmitting = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
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
                    showSimpleToast(
                        'No Data',
                        'No data to process',
                    );
                    return;
                }
                const dataJson = await xmlToJson(dataText);
                if (dataJson === null) {
                    showSimpleToast(
                        'Parsing XML',
                        'Failed to parse XML data',
                    );
                    return;
                }
                const isSuccess = await saveJsonDataToXMLfile(dataJson);
                if (isSuccess) {
                    handleFileCanceling(form);
                    setUrlText('');
                    loadBibleKeys();
                }
            } catch (error) {
                showSimpleToast(
                    'Format Submit Error',
                    `Error: ${error}`,
                );
            }
        });
    };
    return (
        <>
            <h3>
                Import XML File <button
                    title='XML format example'
                    className={
                        'btn btn-sm ms-2' +
                        ` btn${isShowingExample ? '' : '-outline'}-info`
                    }
                    onClick={() => {
                        setIsShowingExample(!isShowingExample);
                    }}>
                    <i className='bi bi-question-lg' />
                </button>
            </h3>
            {!isShowingExample ? null : (
                <div>
                    <textarea className='form-control' style={{
                        padding: '5px',
                        height: '200px',
                    }} defaultValue={xmlFormatExample} readOnly />
                </div>
            )}
            <form onSubmit={handleFormSubmitting}>
                <div className='app-border-white-round p-2'>
                    {isValidUrl ? null : (
                        <div className='input-group'>
                            <input className='form-control' type='file'
                                name='file' onChange={() => {
                                    setIsFileSelected(true);
                                }}
                            />
                            {isFileSelected ? (
                                <button type='button' title='Cancel selection'
                                    className='btn btn-sm btn-danger'
                                    onClick={(event) => {
                                        const form = event.currentTarget.form;
                                        handleFileCanceling(form);
                                    }}>
                                    <i className='bi bi-x-lg' />
                                </button>
                            ) : null}
                        </div>
                    )}
                    {isFileSelected ? null : (
                        <>
                            <span>or</span>
                            <div className='input-group'>
                                <div className='input-group-text'>
                                    URL:
                                </div>
                                <input className={
                                    'form-control' +
                                    (
                                        !urlText || isValidUrl ?
                                            '' : ' is-invalid'
                                    )
                                }
                                    title={isValidUrl ? '' : 'Invalid URL'}
                                    type='text' name='url'
                                    placeholder='http://example.com/file.xml'
                                    value={urlText}
                                    onChange={(event: any) => {
                                        setUrlText(event.target.value);
                                    }}
                                />
                                {isValidUrl ? (
                                    <button type='button'
                                        title='Clear url'
                                        className='btn btn-sm btn-danger'
                                        onClick={() => {
                                            setUrlText('');
                                        }}>
                                        <i className='bi bi-x-lg' />
                                    </button>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
                <div>
                    <input className='form-control' type='submit'
                        value='Import' disabled={
                            isPending || !(isFileSelected || isValidUrl)
                        }
                    />
                </div>
                <div className='app-border-white-round'>
                    {isPending ? (
                        <LoadingComp message={loadingMessage} />
                    ) : null}
                </div>
            </form>
        </>
    );
}
