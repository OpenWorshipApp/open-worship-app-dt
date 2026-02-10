import { useState } from 'react';

import type { LocaleType } from '../../lang/langHelpers';
import { getLangCode, tran } from '../../lang/langHelpers';

function BibleKeyXMLInputComp({
    defaultVale,
    onChange,
    guessingKeys,
    takenBibleKeys,
}: Readonly<{
    defaultVale: string;
    onChange: (key: string) => void;
    guessingKeys?: string[];
    takenBibleKeys: string[];
}>) {
    const [value, setValue] = useState(defaultVale);
    const [invalidMessage, setInvalidMessage] = useState<string>('');
    const setValue1 = (value: string) => {
        setValue(value);
        onChange(value);
        if (takenBibleKeys.includes(value.toLowerCase())) {
            setInvalidMessage('Key is already taken');
        } else {
            setInvalidMessage('');
        }
    };
    return (
        <div className="w-100 h-100">
            <div>{tran('Define a Bible key')}</div>
            <div className="input-group" title={invalidMessage}>
                <div className="input-group-text">Key:</div>
                <input
                    className={
                        'form-control form-control-sm' +
                        (invalidMessage ? ' is-invalid' : '')
                    }
                    type="text"
                    value={value}
                    onChange={(e) => {
                        setValue1(e.target.value);
                    }}
                />
            </div>
            {guessingKeys !== undefined && guessingKeys.length > 0 ? (
                <div className="w-100">
                    <div>Guessing keys:</div>
                    <div>
                        {guessingKeys.map((guessingKey) => {
                            if (
                                takenBibleKeys.includes(
                                    guessingKey.toLowerCase(),
                                ) ||
                                guessingKey === value
                            ) {
                                return null;
                            }
                            return (
                                <button
                                    key={guessingKey}
                                    className="btn btn-sm btn-outline-info m-1"
                                    onClick={() => {
                                        setValue1(guessingKey);
                                    }}
                                >
                                    {guessingKey}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export function genBibleKeyXMLInput(
    key: string,
    onChange: (key: string) => void,
    takenBibleKeys: string[],
    guessingKeys?: string[],
) {
    return (
        <BibleKeyXMLInputComp
            takenBibleKeys={takenBibleKeys}
            defaultVale={key}
            onChange={onChange}
            guessingKeys={guessingKeys}
        />
    );
}

function BibleNumbersMapXMLInputComp({
    defaultVale,
    onChange,
    locale,
}: Readonly<{
    defaultVale: string;
    onChange: (key: string) => void;
    locale: LocaleType;
}>) {
    const [value, setValue] = useState(defaultVale);
    const [invalidMessage, setInvalidMessage] = useState<string>('');
    const setValue1 = (value: string) => {
        setValue(value);
        onChange(value);
        if (value.split(' ').length === 10) {
            setInvalidMessage('');
        } else {
            setInvalidMessage('Must have 10 numbers');
        }
    };
    const langCode = getLangCode(locale) ?? 'en';
    return (
        <div className="w-100 h-100">
            <div>Define numbers map</div>
            <div className="input-group" title={invalidMessage}>
                <div className="input-group-text">Key:</div>
                <input
                    className={
                        'form-control form-control-sm' +
                        (invalidMessage ? ' is-invalid' : '')
                    }
                    type="text"
                    value={value}
                    onChange={(e) => {
                        setValue1(e.target.value);
                    }}
                />
            </div>
            <div className="w-100">
                <a
                    className="btn btn-secondary ms-2"
                    href={
                        `https://translate.google.com/?sl=en&tl=${langCode}&` +
                        'text=0%201%202%203%204%205%206%207%208%209&op=translate'
                    }
                    target="_blank"
                >
                    Translate ({langCode})
                </a>
            </div>
        </div>
    );
}

export function genBibleNumbersMapXMLInput(
    numbers: string[],
    locale: LocaleType,
    onChange: (numbers: string[]) => void,
) {
    return (
        <BibleNumbersMapXMLInputComp
            defaultVale={numbers.join(' ')}
            onChange={(newValue) => {
                onChange(newValue.split(' '));
            }}
            locale={locale}
        />
    );
}

export const xmlFormatExample = `<?xml version="1.0" encoding="UTF-8"?>
<bible
    title="Example Bible Translation Version"
    // [name] optional alternative to title
    name="Example Bible Translation Version"
    // [translation] optional alternative to title
    translation="Example Bible Translation Version"
    // "key" is important for identifying ever bible
    //  the application will popup input key if it is not found
    key="EBTV"
    // [abbr] optional alternative to key
    abbr="EBTV"
    version="1"
    // e.g: for Khmer(km) locale="km"
    locale="en"
    legalNote="Example of legal note"
    // [status] optional alternative to legalNote
    status="Example of legal note"
    publisher="Example of publisher"
    copyRights="Example copy rights">
    <map>
        // e.g: for Khmer(km) value="លោកុ‌ប្បត្តិ" for value="GEN"
        <book-map key="GEN" value="GENESIS"/>
        <book-map key="EXO" value="EXODUS"/>
        <book-map key="LEV" value="LEVITICUS"/>
        <book-map key="NUM" value="NUMBERS"/>
        <book-map key="DEU" value="DEUTERONOMY"/>
        <book-map key="JOS" value="JOSHUA"/>
        <book-map key="JDG" value="JUDGES"/>
        <book-map key="RUT" value="RUTH"/>
        <book-map key="1SA" value="1 SAMUEL"/>
        <book-map key="2SA" value="2 SAMUEL"/>
        <book-map key="1KI" value="1 KINGS"/>
        <book-map key="2KI" value="2 KINGS"/>
        <book-map key="1CH" value="1 CHRONICLES"/>
        <book-map key="2CH" value="2 CHRONICLES"/>
        <book-map key="EZR" value="EZRA"/>
        <book-map key="NEH" value="NEHEMIAH"/>
        <book-map key="EST" value="ESTHER"/>
        <book-map key="JOB" value="JOB"/>
        <book-map key="PSA" value="PSALM"/>
        <book-map key="PRO" value="PROVERBS"/>
        <book-map key="ECC" value="ECCLESIASTES"/>
        <book-map key="SNG" value="SONG OF SOLOMON"/>
        <book-map key="ISA" value="ISAIAH"/>
        <book-map key="JER" value="JEREMIAH"/>
        <book-map key="LAM" value="LAMENTATIONS"/>
        <book-map key="EZK" value="EZEKIEL"/>
        <book-map key="DAN" value="DANIEL"/>
        <book-map key="HOS" value="HOSEA"/>
        <book-map key="JOL" value="JOEL"/>
        <book-map key="AMO" value="AMOS"/>
        <book-map key="OBA" value="OBADIAH"/>
        <book-map key="JON" value="JONAH"/>
        <book-map key="MIC" value="MICAH"/>
        <book-map key="NAM" value="NAHUM"/>
        <book-map key="HAB" value="HABAKKUK"/>
        <book-map key="ZEP" value="ZEPHANIAH"/>
        <book-map key="HAG" value="HAGGAI"/>
        <book-map key="ZEC" value="ZECHARIAH"/>
        <book-map key="MAL" value="MALACHI"/>
        <book-map key="MAT" value="MATTHEW"/>
        <book-map key="MRK" value="MARK"/>
        <book-map key="LUK" value="LUKE"/>
        <book-map key="JHN" value="JOHN"/>
        <book-map key="ACT" value="ACTS"/>
        <book-map key="ROM" value="ROMANS"/>
        <book-map key="1CO" value="1 CORINTHIANS"/>
        <book-map key="2CO" value="2 CORINTHIANS"/>
        <book-map key="GAL" value="GALATIANS"/>
        <book-map key="EPH" value="EPHESIANS"/>
        <book-map key="PHP" value="PHILIPPIANS"/>
        <book-map key="COL" value="COLOSSIANS"/>
        <book-map key="1TH" value="1 THESSALONIANS"/>
        <book-map key="2TH" value="2 THESSALONIANS"/>
        <book-map key="1TI" value="1 TIMOTHY"/>
        <book-map key="2TI" value="2 TIMOTHY"/>
        <book-map key="TIT" value="TITUS"/>
        <book-map key="PHM" value="PHILEMON"/>
        <book-map key="HEB" value="HEBREWS"/>
        <book-map key="JAS" value="JAMES"/>
        <book-map key="1PE" value="1 PETER"/>
        <book-map key="2PE" value="2 PETER"/>
        <book-map key="1JN" value="1 JOHN"/>
        <book-map key="2JN" value="2 JOHN"/>
        <book-map key="3JN" value="3 JOHN"/>
        <book-map key="JUD" value="JUDE"/>
        <book-map key="REV" value="REVELATION"/>
        // e.g: for Khmer(km) value="១" for value="1"
        <number-map key="0" value="0"/>
        <number-map value="0" value="1"/>
        <number-map key="2" value="2"/>
        <number-map key="3" value="3"/>
        <number-map key="4" value="4"/>
        <number-map key="5" value="5"/>
        <number-map key="6" value="6"/>
        <number-map key="7" value="7"/>
        <number-map key="8" value="8"/>
        <number-map key="9" value="9"/>
    </map>
    <testament name="Old">
        <book number="1">
            <chapter number="1">
                <verse number="1">
                    This is verse text number 1 of chapter 1 in book Genesis
                </verse>
            </chapter>
        </book>
    </testament>
    <testament name="New">
        <book number="40">
            <chapter number="2">
                <verse number="1">
                    This is verse text number 1 of chapter 2 in book Matthew
                </verse>
            </chapter>
        </book>
    </testament>
    <book number="3">
        <chapter number="3">
            <verse number="1">
                This is verse text number 1 of chapter 3 in book Leviticus
            </verse>
        </chapter>
    </book>
    <book number="num">
        <chapter number="1">
            <verse number="1">
                This is verse text number 1 of chapter 1 in book Number
            </verse>
        </chapter>
    </book>
    // Optional section for defining new lines in verses
    <new-lines>
        <item>MAT 7:6</item>
        <item>MAT 7:13</item>
    </new-lines>
    // Optional section for defining titles for new lines
    <new-lines-title-map>
        <item key="GEN 1:1">&lt;![CDATA[[{"content":"Title","cssStyle":{"fontSize":"1.2em"}}]]]&gt;</item>
    </new-lines-title-map>
    // Optional section for defining custom verses content
    <custom-verses-map>
        <item key="MAT 3:15">&lt;![CDATA[[{"content":"This is "},{"content":"God's word","isGW":true}]]]&gt;</item>
    </custom-verses-map>
</bible>`;
