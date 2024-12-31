import { useState, useTransition } from 'react';

import { showSimpleToast } from '../../toast/toastHelpers';
import LoadingComp from '../../others/LoadingComp';
import {
    BibleJsonType, checkIsValidUrl, getInputByName, readFromFile, readFromUrl,
    xmlFormatExample, xmlToJson,
} from './bibleXMLHelpers';

export default function SettingBibleXMLComp() {
    const [isShowingExample, setIsShowingExample] = useState(false);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [urlText, setUrlText] = useState('');
    const [outputJson, setOutputJson] = useState<BibleJsonType | null>(null);
    const [isPending, startTransition] = useTransition();
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const isValidUrl = checkIsValidUrl(urlText);
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
                setOutputJson(dataJson);
            } catch (error) {
                showSimpleToast(
                    'Format Submit Error',
                    `Error: ${error}`,
                );
            }
        });
    };
    const handleFileCanceling = (event: any) => {
        const form = event.currentTarget.form;
        if (form instanceof HTMLFormElement) {
            const inputFile = getInputByName(form, 'file');
            if (inputFile instanceof HTMLInputElement) {
                inputFile.value = '';
            }
        }
        setIsFileSelected(false);
    };
    return (
        <div className='w-100'>
            <h3>
                From XML <button
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
                                    onClick={handleFileCanceling}>
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
                        value='Submit' disabled={
                            isPending || !(isFileSelected || isValidUrl)
                        }
                    />
                </div>
                <div className='app-border-white-round'>
                    {isPending ? (
                        <LoadingComp message={loadingMessage} />
                    ) : null}
                    {outputJson ? (
                        <pre>{JSON.stringify(outputJson, null, 2)}</pre>
                    ) : null}
                </div>
            </form>
        </div>
    );
}
