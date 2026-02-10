import { useState } from 'react';
import type { SchemaNode } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import {
    allLocalesMap,
    getLangCode,
    getLangDataAsync,
    LanguageDataType,
    languageNameMap,
    LocaleType,
    tran,
} from '../../lang/langHelpers';
import type { EditorStoreType } from '../../helper/monacoEditorHelpers';
import { useInitMonacoEditor } from '../../helper/monacoEditorHelpers';
import { useAppEffect } from '../../helper/debuggerHelpers';

import type { AnyObjectType } from '../../helper/typeHelpers';
import { checkAreObjectsEqual } from '../../server/comparisonHelpers';
import { useStateSettingBoolean } from '../../helper/settingHelpers';
import { getModelKeyBookMap } from '../../helper/bible-helpers/bibleLogicHelpers1';
import { getBibleModelInfo } from '../../helper/bible-helpers/bibleModelHelpers';
import { BibleJsonInfoType } from './bibleXMLJsonDataHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
import { genBibleNumbersMapXMLInput } from './bibleXMLAttributesGuessing';

function parseJsonData(content: string) {
    try {
        return JSON.parse(content);
    } catch (_error) {
        return {} as any;
    }
}

let setCanSave1: (canSave: boolean) => void = () => {};
function validateCanSave(
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
    setCanSave1(isNoError && isChanged);
    return { canSave: isNoError, newJsonData };
}

function RenderSaveButton({
    editorStore,
    jsonDataSchema,
    save,
}: Readonly<{
    editorStore: ReturnType<typeof useInitMonacoEditor>['editorStore'];
    jsonDataSchema: SchemaNode;
    save: (newJsonData: AnyObjectType) => void;
}>) {
    const [canSave, setCanSave] = useState(false);
    useAppEffect(() => {
        setCanSave1 = setCanSave;
        return () => {
            setCanSave1 = () => {};
        };
    }, []);
    return (
        <button
            className={
                'btn btn-sm m-1 ' + (canSave ? 'btn-primary' : 'btn-secondary')
            }
            disabled={!canSave}
            onClick={() => {
                const { canSave, newJsonData } = validateCanSave(
                    jsonDataSchema,
                    editorStore.systemContent,
                    editorStore.editorInstance.getValue(),
                );
                if (canSave) {
                    save(newJsonData);
                }
            }}
        >
            {tran('Save')}
        </button>
    );
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
        onContentChange: validateCanSave.bind(null, jsonDataSchema),
        uri: editorUri,
        language: 'json',
    });
    const { editorStore, onContainerInit } = store;
    const applyJsonData = (newJsonData: AnyObjectType | null) => {
        const content =
            newJsonData === null ? '' : JSON.stringify(newJsonData, null, 4);
        store.setNewValue(content);
        validateCanSave(jsonDataSchema, content, content);
    };
    useAppEffect(() => {
        applyJsonData(jsonData);
    }, [jsonData]);
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
                        onClick={() => {
                            setIsFullView(!isFullView);
                        }}
                    >
                        {isFullView ? 'Exit Full View' : 'Full View'}
                    </button>
                </div>
                <div>
                    <RenderSaveButton
                        editorStore={editorStore}
                        jsonDataSchema={jsonDataSchema}
                        save={save}
                    />
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
}: Readonly<{
    defaultVale: string;
    onChange: (newValue: string) => void;
    locale: LocaleType;
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
    const handleMarkupStringParsing = (
        markupString: string,
        lang: LanguageDataType | null,
    ) => {
        const parser = new DOMParser();
        markupString = markupString.replaceAll('</', '@newline</');
        const doc = parser.parseFromString(markupString, 'text/html');
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
    };
    const langCode = getLangCode(locale) ?? 'en';
    return (
        <div className="w-100 h-100">
            <h3 className="p-2">Define books map</h3>
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
                    onClick={(event) => {
                        event.stopPropagation();
                        editorStore.replaceValue(
                            Object.values(getModelKeyBookMap()).join('\n'),
                        );
                    }}
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
                    onClick={async (event) => {
                        event.stopPropagation();
                        const value = editorStore.editorInstance.getValue();
                        const isHTML = value.includes('<');
                        if (!isHTML) {
                            return;
                        }
                        const lang = await getLangDataAsync(locale);
                        handleMarkupStringParsing(value, lang);
                    }}
                >
                    {tran('Parse Markup String (HTML|XML)')}
                </button>
            </div>
        </div>
    );
}

export function genBibleBooksMapXMLInput(
    books: string[],
    locale: LocaleType,
    onChange: (books: string[]) => void,
) {
    return (
        <BibleBooksMapXMLInputComp
            defaultVale={books.join('\n')}
            onChange={(newValue) => {
                onChange(newValue.split('\n'));
            }}
            locale={locale}
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
            showAppContextMenu(
                genMouseEvent(),
                Object.entries(allLocalesMap).map(([locale, langCode]) => {
                    const menuElement = `${locale} (${languageNameMap[langCode] ?? 'Unknown'})`;
                    return {
                        menuElement,
                        onSelect: () => {
                            setPartialBibleInfo({
                                locale,
                            });
                        },
                    };
                }),
            );
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
