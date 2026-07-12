import { useCallback, useState, type MouseEvent } from 'react';
import type { SchemaNode } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import {
    allLocalesMap,
    getLangCode,
    getLangDataAsync,
    type LanguageDataType,
    languageNameMap,
    type LocaleType,
    tran,
} from '../../lang/langHelpers';
import type { EditorStoreType } from '../../helper/monacoEditorHelpers';
import { useInitMonacoEditor } from '../../helper/monacoEditorHelpers';
import { useAppEffect, useAppCurrentRef } from '../../helper/appHooks';

import type { AnyObjectType } from '../../helper/typeHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import { getModelKeyBookMap } from '../../helper/bible-helpers/bibleLogicHelpers1';
import { getBibleModelInfo } from '../../helper/bible-helpers/bibleModelHelpers';
import { type BibleJsonInfoType } from './bibleXMLJsonDataHelpers';
import {
    type ContextMenuItemType,
    createMouseEvent,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
import { genBibleNumbersMapXMLInput } from './bibleXMLAttributesGuessing';
import { setBibleEditorDirty } from './bibleEditorDirtyHelpers';

function parseJsonData(content: string) {
    try {
        return JSON.parse(content);
    } catch (_error) {
        return {} as any;
    }
}

function evaluateEditorState(
    jsonDataSchema: SchemaNode,
    oldContent: string,
    newContent: string,
) {
    const oldJsonData = parseJsonData(oldContent);
    const newJsonData = parseJsonData(newContent);
    const { valid, errors } = jsonDataSchema.validate(newJsonData);
    const isNoError = valid && errors.length === 0;
    const isChanged =
        oldJsonData !== null &&
        checkAreObjectsEqual(oldJsonData, newJsonData) === false;
    return { canSave: isNoError && isChanged, isChanged, newJsonData };
}

export default function BibleXMLEditorComp({
    id,
    jsonData,
    onStore,
    jsonDataSchema,
    save,
    editorUri,
}: Readonly<{
    id: string;
    jsonData: AnyObjectType;
    onStore: (editorStore: EditorStoreType) => void;
    jsonDataSchema: SchemaNode;
    save: (newJsonData: any) => void;
    editorUri: Uri;
}>) {
    const [isFullView, setIsFullView] = useStateSettingBoolean(
        `bible-xml-info-full-view-${id}`,
        false,
    );
    const [canSave, setCanSave] = useState(false);
    const [isChanged, setIsChanged] = useState(false);
    const jsonDataSchemaRef = useAppCurrentRef(jsonDataSchema);
    const handleContentChange = useCallback(
        (oldContent: string, newContent: string) => {
            const state = evaluateEditorState(
                jsonDataSchemaRef.current,
                oldContent,
                newContent,
            );
            setCanSave(state.canSave);
            setIsChanged(state.isChanged);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const store = useInitMonacoEditor({
        settingName: 'bible-xml-wrap-text',
        options: {
            value: '',
            language: 'json',
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
        },
        onStore,
        onContentChange: handleContentChange,
        uri: editorUri,
        language: 'json',
    });
    const { editorStore, onContainerInit } = store;
    const applyJsonData = (newJsonData: AnyObjectType | null) => {
        const content =
            newJsonData === null ? '' : JSON.stringify(newJsonData, null, 4);
        store.setNewValue(content);
        handleContentChange(content, content);
    };
    useAppEffect(() => {
        applyJsonData(jsonData);
    }, [jsonData]);
    const editorId = editorUri.toString();
    useAppEffect(() => {
        setBibleEditorDirty(id, editorId, isChanged);
        return () => {
            setBibleEditorDirty(id, editorId, false);
        };
    }, [id, editorId, isChanged]);
    const editorStoreRef = useAppCurrentRef(editorStore);
    const saveRef = useAppCurrentRef(save);
    const handleSaving = useCallback(() => {
        const currentEditorStore = editorStoreRef.current;
        const newContent = currentEditorStore.editorInstance.getValue();
        const state = evaluateEditorState(
            jsonDataSchemaRef.current,
            currentEditorStore.systemContent,
            newContent,
        );
        if (!state.canSave) {
            return;
        }
        // Update the baseline and clear the dirty flag before saving so the
        // force-reload that follows a successful save is not blocked as unsaved.
        currentEditorStore.systemContent = newContent;
        setBibleEditorDirty(id, editorId, false);
        setCanSave(false);
        setIsChanged(false);
        saveRef.current(state.newJsonData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, editorId]);
    const handleReset = useCallback(() => {
        const currentEditorStore = editorStoreRef.current;
        // Restore the editor to the last saved/loaded baseline, discarding any
        // unsaved changes.
        currentEditorStore.replaceValue(currentEditorStore.systemContent);
        setBibleEditorDirty(id, editorId, false);
        setCanSave(false);
        setIsChanged(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, editorId]);
    const isFullViewRef = useAppCurrentRef(isFullView);
    const setIsFullViewRef = useAppCurrentRef(setIsFullView);
    const handleToggleFullView = useCallback(() => {
        setIsFullViewRef.current(!isFullViewRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (jsonData === null) {
        return null;
    }

    return (
        <div
            className={
                'w-100 card app-border-white-round app-overflow-hidden' +
                (isFullView ? ' app-full-view' : '')
            }
        >
            <div
                className="w-100 card-body p-0 m-0 app-overflow-hidden"
                ref={onContainerInit}
                style={{ height: '450px' }}
            />
            <div
                className="w-100 card-footer d-flex p-0 app-overflow-hidden"
                style={{
                    height: '35px',
                }}
            >
                <div className="flex-grow-1">
                    <button
                        className="btn btn-sm btn-secondary m-1"
                        onClick={handleToggleFullView}
                    >
                        {isFullView ? 'Exit Full View' : 'Full View'}
                    </button>
                </div>
                {isChanged ? (
                    <div
                        className="align-self-center text-warning px-2 app-ellipsis"
                        title={tran('You have unsaved Bible changes.')}
                    >
                        <i className="bi bi-exclamation-triangle-fill me-1" />
                        {tran('Unsaved changes')}
                    </div>
                ) : null}
                <div className="d-flex">
                    <button
                        className={
                            'btn btn-sm m-1 ' +
                            (isChanged ? 'btn-warning' : 'btn-secondary')
                        }
                        disabled={!isChanged}
                        onClick={handleReset}
                        title={tran('Discard unsaved changes')}
                    >
                        {tran('Reset')}
                    </button>
                    <button
                        className={
                            'btn btn-sm m-1 ' +
                            (canSave ? 'btn-primary' : 'btn-secondary')
                        }
                        disabled={!canSave}
                        onClick={handleSaving}
                    >
                        {tran('Save')}
                    </button>
                </div>
            </div>
        </div>
    );
}

const genMonacoBibleLineNumber = (num: number) => {
    const bibleModelInfo = getBibleModelInfo();
    const map = bibleModelInfo.bookKeysOrder;
    const index = num - 1;
    const numString = `0${num}`.slice(-2);
    if (map[index] === undefined) {
        return numString;
    }
    const bookKey = map[num - 1];
    const modelKeyBook = getModelKeyBookMap();
    return `${modelKeyBook[bookKey]} (${bookKey}) ${numString}`;
};

function BibleBooksMapXMLInputComp({
    defaultVale,
    onChange,
    locale,
    bibleKey,
}: Readonly<{
    defaultVale: string;
    onChange: (newValue: string) => void;
    locale: LocaleType;
    bibleKey: string;
}>) {
    const { editorStore, onContainerInit } = useInitMonacoEditor({
        settingName: 'bible-xml-wrap-text',
        options: {
            value: defaultVale,
            language: 'plaintext',
            lineNumbersMinChars: 25,
            lineNumbers: genMonacoBibleLineNumber,
        },
        onContentChange: (_, content) => {
            onChange(content);
        },
        uri: Uri.parse('bible-books-map-editor'),
        language: 'plaintext',
    });
    useAppEffect(() => {
        editorStore.replaceValue(defaultVale);
    }, [defaultVale, editorStore]);
    const handleMarkupStringParsing = useCallback(
        (markupString: string, lang: LanguageDataType | null) => {
            markupString = markupString.replaceAll('</', '@newline</');
            const domParser = new DOMParser();
            const doc = domParser.parseFromString(markupString, 'text/html');
            let innerText = doc.body.innerText;
            innerText = innerText.replaceAll('@newline', '\n');
            innerText = innerText.replaceAll(/ +/g, ' ');
            innerText = innerText.replaceAll(/\n\s/g, '\n');
            innerText = innerText.replaceAll(/\n+/g, '\n');
            innerText = innerText.trim();
            if (lang !== null) {
                innerText = lang.sanitizeText(innerText);
            }
            onChange(innerText);
            editorStore.replaceValue(innerText);
        },
        [onChange, editorStore],
    );
    const langCode = getLangCode(locale) ?? 'en';
    const editorStoreRef = useAppCurrentRef(editorStore);
    const handleResetting = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        editorStoreRef.current.replaceValue(
            Object.values(getModelKeyBookMap()).join('\n'),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const localeRef = useAppCurrentRef(locale);
    const handleMarkupStringParsingRef = useAppCurrentRef(
        handleMarkupStringParsing,
    );
    const handleParseMarkup = useCallback(async (event: MouseEvent) => {
        event.stopPropagation();
        const value = editorStoreRef.current.editorInstance.getValue();
        const isHTML = value.includes('<');
        if (!isHTML) {
            return;
        }
        const lang = await getLangDataAsync(localeRef.current);
        handleMarkupStringParsingRef.current(value, lang);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleChoosingBibleBooks = useCallback(
        async (event: MouseEvent) => {
            event.stopPropagation();
            const lang = await getLangDataAsync(locale);
            const bibleBookOptions = lang?.bibleBooks ?? [];
            if (bibleBookOptions.length === 0) {
                showAppContextMenu(event as any, [
                    {
                        menuElement: tran('No book options available'),
                        disabled: true,
                    },
                ]);
                return;
            }
            const currentBibleKey = bibleKey.trim().toLowerCase();
            const checkIsCurrentBibleKey = (keys: string[]) => {
                return keys.some(
                    (key) => key.trim().toLowerCase() === currentBibleKey,
                );
            };
            const sortedBibleBookOptions = [...bibleBookOptions].sort(
                (a, b) => {
                    return (
                        Number(checkIsCurrentBibleKey(b.keys)) -
                        Number(checkIsCurrentBibleKey(a.keys))
                    );
                },
            );
            showAppContextMenu(
                event as any,
                sortedBibleBookOptions.map((bibleBookOption) => {
                    const value = bibleBookOption.books.join('\n');
                    const isCurrentBibleKey = checkIsCurrentBibleKey(
                        bibleBookOption.keys,
                    );
                    return {
                        menuElement: (
                            <span data-locale-ff={locale}>
                                {bibleBookOption.keys.join(', ')}
                            </span>
                        ),
                        title: bibleBookOption.keys.join(', '),
                        style: isCurrentBibleKey
                            ? { fontWeight: 'bold' }
                            : undefined,
                        onSelect: () => {
                            onChange(value);
                            editorStore.replaceValue(value);
                        },
                    };
                }),
                { maxHeigh: 320 },
            );
        },
        [bibleKey, editorStore, locale, onChange],
    );
    return (
        <div className="w-100 h-100">
            <h5 className="p-2">
                Define books map Locale: {locale}, Bible Key: {bibleKey}
            </h5>
            <div
                className="input-group"
                ref={onContainerInit}
                style={{
                    height: '400px',
                }}
            />
            <div className="w-100 p-1">
                <button
                    className="btn btn-sm btn-warning ms-2"
                    onClick={handleResetting}
                >
                    {tran('Reset')}
                </button>
                <a
                    className="btn btn-sm btn-secondary ms-2"
                    href={
                        `https://translate.google.com/?sl=en&tl=${langCode}&` +
                        'text=GENESIS%0AEXODUS%0ALEVITICUS%0ANUMBERS%0ADEUTERONO' +
                        'MY%0AJOSHUA%0AJUDGES%0ARUTH%0A1%20SAMUEL%0A2%20SAMUEL%0A' +
                        '1%20KINGS%0A2%20KINGS%0A1%20CHRONICLES%0A2%20CHRONICLES%' +
                        '0AEZRA%0ANEHEMIAH%0AESTHER%0AJOB%0APSALM%0APROVERBS%0AEC' +
                        'CLESIASTES%0ASONG%20OF%20SOLOMON%0AISAIAH%0AJEREMIAH%0A' +
                        'LAMENTATIONS%0AEZEKIEL%0ADANIEL%0AHOSEA%0AJOEL%0AAMOS%0' +
                        'AOBADIAH%0AJONAH%0AMICAH%0ANAHUM%0AHABAKKUK%0AZEPHANIAH' +
                        '%0AHAGGAI%0AZECHARIAH%0AMALACHI%0AMATTHEW%0AMARK%0ALUKE' +
                        '%0AJOHN%0AACTS%0AROMANS%0A1%20CORINTHIANS%0A2%20CORINTH' +
                        'IANS%0AGALATIANS%0AEPHESIANS%0APHILIPPIANS%0ACOLOSSIANS' +
                        '%0A1%20THESSALONIANS%0A2%20THESSALONIANS%0A1%20TIMOTHY%' +
                        '0A2%20TIMOTHY%0ATITUS%0APHILEMON%0AHEBREWS%0AJAMES%0A1%' +
                        '20PETER%0A2%20PETER%0A1%20JOHN%0A2%20JOHN%0A3%20JOHN%0A' +
                        'JUDE%0AREVELATION&op=translate'
                    }
                    target="_blank"
                >
                    Translate ({langCode})
                </a>
                <button
                    className="btn btn-sm btn-secondary ms-2"
                    onClick={handleParseMarkup}
                >
                    {tran('Parse Markup String (HTML|XML)')}
                </button>
                <button
                    className="btn btn-sm btn-info ms-2"
                    onClick={handleChoosingBibleBooks}
                    title="Choose Bible Books"
                    type="button"
                >
                    <i className="bi bi-book" /> Guessing Names
                </button>
            </div>
        </div>
    );
}

export function genBibleBooksMapXMLInput(
    books: string[],
    locale: LocaleType,
    bibleKey: string,
    onChange: (books: string[]) => void,
) {
    return (
        <BibleBooksMapXMLInputComp
            defaultVale={books.join('\n')}
            onChange={(newValue) => {
                onChange(newValue.split('\n'));
            }}
            locale={locale}
            bibleKey={bibleKey}
        />
    );
}

export function addMonacoBibleInfoActions(
    editorStore: EditorStoreType,
    getBibleInfo: () => BibleJsonInfoType,
    setPartialBibleInfo: (partialBibleInfo: AnyObjectType) => void,
) {
    const { editorInstance } = editorStore;
    const genMouseEvent = () => {
        return createMouseEvent(
            editorStore.lastMouseClickPos.x,
            editorStore.lastMouseClickPos.y,
        );
    };
    editorInstance.addAction({
        id: 'edit-numbers-map',
        label: '#️⃣ `Edit Numbers Map',
        contextMenuGroupId: 'navigation',
        run: async () => {
            const bibleInfo = getBibleInfo();
            let numbers = Object.values(bibleInfo.numbersMap);
            const isConfirmInput = await showAppInput(
                tran('Numbers map'),
                genBibleNumbersMapXMLInput(
                    numbers,
                    bibleInfo.locale,
                    (newNumbers) => {
                        numbers = newNumbers;
                    },
                ),
                {
                    escToCancel: false,
                    enterToOk: false,
                },
            );
            if (isConfirmInput) {
                setPartialBibleInfo({
                    numbersMap: Object.fromEntries(
                        numbers.map((value, index) => [
                            index.toString(),
                            value,
                        ]),
                    ),
                });
            }
        },
    });
    editorInstance.addAction({
        id: 'choose-locale',
        label: '🌎 `Choose Locale',
        contextMenuGroupId: 'navigation',
        run: async () => {
            const contextMenuItems: ContextMenuItemType[] = Object.entries(
                allLocalesMap,
            ).map(([locale, langCode]) => {
                const menuElement = `${locale} (${languageNameMap[langCode] ?? 'Unknown'})`;
                return {
                    menuElement,
                    onSelect: () => {
                        setPartialBibleInfo({
                            locale,
                        });
                    },
                };
            });
            showAppContextMenu(genMouseEvent(), contextMenuItems, {
                shouldAutoFocusContainer: true,
            });
        },
    });
    editorInstance.addAction({
        id: 'edit-books-map',
        label: '📚 `Edit Books Map',
        contextMenuGroupId: 'navigation',
        run: async () => {
            const bibleInfo = getBibleInfo();
            let keyBookMap = Object.values(bibleInfo.keyBookMap);
            const isConfirmInput = await showAppInput(
                'Books map',
                genBibleBooksMapXMLInput(
                    keyBookMap,
                    bibleInfo.locale,
                    bibleInfo.key,
                    (newNumbers) => {
                        keyBookMap = newNumbers;
                    },
                ),
                {
                    escToCancel: false,
                    enterToOk: false,
                },
            );
            if (isConfirmInput) {
                setPartialBibleInfo({
                    ...bibleInfo,
                    keyBookMap: Object.fromEntries(
                        Object.keys(bibleInfo.keyBookMap).map(
                            (value, index) => [value, keyBookMap[index]],
                        ),
                    ),
                });
            }
        },
    });
}
