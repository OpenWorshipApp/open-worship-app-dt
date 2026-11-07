import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    toAnswerShownInLanguage,
    toRepliesShownInLanguage,
} from '../../../../chatbot/answerLanguageHelpers';
import {
    checkIsChosenScript,
    checkIsLanguageWord,
    detectTypedLanguage,
    getAssistantLanguage,
    listAssistantLanguages,
    listTypedLanguages,
    OTHER_CHAT_LANG_CODE,
    pickReplyLanguage,
} from '../../../../chatbot/chatLangHelpers';
import {
    findPageLanguage,
    findTranslatedLanguage,
    genAskTranslation,
    readRepliesTranslation,
    toAnswerTranslationAsk,
    toQuestionTranslationAsk,
    toRepliesTranslationAsk,
} from '../../../../chatbot/chatTranslateHelpers';

// The same two questions, as a person in each language types them: a how-to
// about the app and one about what is too small to read. A third column is a
// language of the same family the line cannot be told from: Slovenian and
// Croatian share every little word in it.
const SAMPLE_LIST: [string, string, string?][] = [
    ['es', '¿Cómo pongo un versículo de la Biblia en la pantalla?'],
    ['es', 'Las letras son muy pequeñas, ¿cómo las hago más grandes?'],
    ['es', '¿Qué dice la Biblia sobre el amor?'],
    ['es', 'Quiero cambiar el fondo de la diapositiva'],
    ['pt', 'Como coloco um versículo da Bíblia na tela?'],
    ['pt', 'As letras estão muito pequenas. Como posso aumentar?'],
    ['pt', 'O que a Bíblia diz sobre o perdão?'],
    ['it', 'Come metto un versetto della Bibbia sullo schermo?'],
    ['it', 'Le parole sono troppo piccole, come posso ingrandirle?'],
    ['it', 'Cosa dice la Bibbia sul perdono?'],
    ['de', 'Wie zeige ich einen Bibelvers auf dem Bildschirm an?'],
    ['de', 'Die Schrift ist zu klein. Wie mache ich sie größer?'],
    ['de', 'Was sagt die Bibel über Vergebung?'],
    ['nl', 'Hoe zet ik een bijbeltekst op het scherm?'],
    ['nl', 'De letters zijn te klein, hoe maak ik ze groter?'],
    ['af', 'Hoe wys ek die vers op die skerm?'],
    ['ca', 'Com puc posar un verset de la Bíblia a la pantalla?'],
    ['ro', 'Cum afișez un verset din Biblie pe ecran?'],
    ['ro', 'Literele sunt prea mici, cum le pot mări?'],
    ['pl', 'Jak wyświetlić werset z Biblii na ekranie?'],
    ['pl', 'Litery są za małe, jak je powiększyć?'],
    ['cs', 'Jak zobrazím verš z Bible na obrazovce?'],
    ['sk', 'Ako zobrazím verš z Biblie na obrazovke?'],
    ['hr', 'Kako da prikažem stih iz Biblije na ekranu?'],
    ['sl', 'Kako prikažem verz iz Svetega pisma na zaslonu?', 'hr'],
    ['hu', 'Hogyan jeleníthetek meg egy bibliaverset a képernyőn?'],
    ['sv', 'Hur visar jag en bibelvers på skärmen?'],
    ['no', 'Hvordan viser jeg et bibelvers på skjermen?'],
    ['da', 'Hvordan viser jeg et bibelvers på skærmen?', 'no'],
    ['fi', 'Miten näytän raamatunjakeen näytöllä?'],
    ['et', 'Kuidas ma saan piiblisalmi ekraanil näidata?'],
    ['lt', 'Kaip parodyti Biblijos eilutę ekrane?'],
    ['lv', 'Kā es varu parādīt Bībeles pantu uz ekrāna?'],
    ['sq', 'Si mund ta shfaq një varg të Biblës në ekran?'],
    ['tr', 'Ekranda bir İncil ayetini nasıl gösterebilirim?'],
    ['az', 'Ekranda Müqəddəs Kitabdan bir ayəni necə göstərə bilərəm?'],
    ['vi', 'Làm sao để hiển thị câu Kinh Thánh lên màn hình?'],
    ['vi', 'Chữ quá nhỏ. Làm sao để phóng to chữ lên?'],
    ['id', 'Bagaimana cara menampilkan ayat Alkitab di layar?'],
    ['id', 'Hurufnya terlalu kecil. Bagaimana cara memperbesar tulisan?'],
    ['ms', 'Bagaimana saya boleh paparkan ayat Alkitab di skrin?'],
    ['tl', 'Paano ko ipapakita ang talata ng Bibliya sa screen?'],
    ['tl', 'Masyadong maliit ang mga letra. Paano ko ito palalakihin?'],
    ['ceb', 'Unsaon nako pagpakita sa bersikulo sa screen?'],
    ['sw', 'Ninawezaje kuonyesha mstari wa Biblia kwenye skrini?'],
    ['sw', 'Herufi ni ndogo sana. Ninawezaje kuzifanya kuwa kubwa zaidi?'],
    ['rw', 'Nshobora gute kwerekana umurongo wa Bibiliya kuri ecran?'],
    [
        'rn',
        'Ndashaka kumenya ingene nokwerekana umurongo wa Bibiliya kuri ecran',
        'rw',
    ],
    [
        'om',
        'Akkamitti caqasa Macaafa Qulqulluu iskiriinii irratti agarsiisuu nan danda’a?',
    ],
    [
        'to',
        'ʻE lava fēfē ke u fakahā ha veesi mei he Tohi Tapu ʻi he sikiliini?',
    ],
    [
        'fj',
        'Au na vakaraitaka vakacava e dua na tikina ni iVolatabu ena sikirini?',
    ],
    ['mg', 'Ahoana no ahafahako mampiseho andininy ao amin ny efijery?'],
    ['yo', 'Báwo ni mo ṣe le fi ẹsẹ Bíbélì hàn lórí iboju?'],
    ['ig', 'Kedu ka m ga-esi gosi amaokwu Baịbụl na ihuenyo?'],
    ['ha', 'Ta yaya zan nuna ayar Littafi Mai Tsarki a kan allo?'],
    ['zu', 'Ngingalibonisa kanjani ivesi leBhayibheli esikrinini?'],
    ['xh', 'Ndingayibonisa njani ivesi yeBhayibhile kwisikrini?'],
    ['sn', 'Ndingaratidza sei ndima yeBhaibheri pachiratidziri?'],
    ['ny', 'Kodi ndingasonyeze bwanji vesi la Baibulo pa sikirini?'],
    [
        'so',
        'Sidee baan shaashadda ugu soo bandhigi karaa aayad Kitaabka Quduuska ah?',
    ],
    ['ht', 'Kijan pou m mete yon vèsè Bib la sou ekran an?'],
    ['mi', 'Me pēhea au e whakaatu ai i tētahi irava Paipera ki te mata?'],
    ['sm', 'E faapefea ona ou faaali atu se fuaiupu o le Tusi Paia i le lau?'],
    ['is', 'Hvernig sýni ég biblíuvers á skjánum?'],
    ['ru', 'Как показать стих из Библии на экране?'],
    ['ru', 'Буквы слишком маленькие. Как их увеличить?'],
    ['uk', 'Як показати вірш з Біблії на екрані?'],
    ['be', 'Як паказаць верш з Бібліі на экране?'],
    ['bg', 'Как да покажа стих от Библията на екрана?'],
    ['sr', 'Како да прикажем стих из Библије на екрану?'],
    ['mk', 'Како да прикажам стих од Библијата на екранот?', 'sr'],
    ['kk', 'Экранда Киелі кітаптан аятты қалай көрсетуге болады?'],
    ['mn', 'Дэлгэц дээр Библийн ишлэлийг яаж харуулах вэ?'],
    ['el', 'Πώς μπορώ να εμφανίσω ένα εδάφιο της Βίβλου στην οθόνη;'],
    ['hy', 'Ինչպե՞ս ցուցադրել Աստվածաշնչի համարը էկրանին:'],
    ['ka', 'როგორ ვაჩვენო ბიბლიის მუხლი ეკრანზე?'],
    ['he', 'איך אני מציג פסוק מהתנ"ך על המסך?'],
    ['ar', 'كيف أعرض آية من الكتاب المقدس على الشاشة؟'],
    ['ar', 'الكلمات صغيرة جدا. كيف أكبرها؟'],
    ['fa', 'چگونه یک آیه از کتاب مقدس را روی صفحه نمایش بدهم؟'],
    ['ur', 'میں سکرین پر بائبل کی آیت کیسے دکھاؤں؟'],
    ['hi', 'मैं स्क्रीन पर बाइबल का पद कैसे दिखाऊं?'],
    ['mr', 'मी स्क्रीनवर बायबलचे वचन कसे दाखवू?'],
    ['ne', 'म स्क्रिनमा बाइबलको पद कसरी देखाउने?'],
    ['bn', 'আমি কীভাবে পর্দায় বাইবেলের পদ দেখাব?'],
    ['pa', 'ਮੈਂ ਸਕਰੀਨ ਉੱਤੇ ਬਾਈਬਲ ਦੀ ਆਇਤ ਕਿਵੇਂ ਦਿਖਾਵਾਂ?'],
    ['gu', 'હું સ્ક્રીન પર બાઇબલની કલમ કેવી રીતે બતાવું?'],
    ['or', 'ମୁଁ ପରଦାରେ ବାଇବଲ ପଦ କିପରି ଦେଖାଇବି?'],
    ['ta', 'திரையில் பைபிள் வசனத்தை எப்படி காட்டுவது?'],
    ['te', 'తెరపై బైబిల్ వచనాన్ని ఎలా చూపించాలి?'],
    ['kn', 'ಪರದೆಯ ಮೇಲೆ ಬೈಬಲ್ ವಚನವನ್ನು ಹೇಗೆ ತೋರಿಸುವುದು?'],
    ['ml', 'സ്ക്രീനിൽ ബൈബിൾ വാക്യം എങ്ങനെ കാണിക്കാം?'],
    ['si', 'තිරයේ බයිබල් පදයක් පෙන්වන්නේ කෙසේද?'],
    ['th', 'ฉันจะแสดงข้อพระคัมภีร์บนหน้าจอได้อย่างไร'],
    ['lo', 'ຂ້ອຍຈະສະແດງຂໍ້ພຣະຄຳພີເທິງໜ້າຈໍໄດ້ແນວໃດ?'],
    ['my', 'မျက်နှာပြင်ပေါ်တွင် ကျမ်းချက်ကို မည်သို့ပြမည်နည်း'],
    ['bo', 'བོད་ཡིག་གི་ཚིག་འདི་ཅི་ཡིན།'],
    ['zh', '如何在屏幕上显示圣经经文？'],
    ['zh', '字太小了，怎么把字放大？'],
    ['zh-Hant', '如何在螢幕上顯示聖經經文？'],
    ['ja', '聖書の節を画面に表示するにはどうすればいいですか？'],
    ['ja', '文字が小さすぎます。大きくするにはどうすればいいですか？'],
    ['ko', '화면에 성경 구절을 어떻게 표시하나요?'],
    // Korean around an English button's name: a Hangul letter is a syllable.
    ['ko', 'Bible Lookup 버튼은 어디에 있나요?'],
    ['am', 'የመጽሐፍ ቅዱስን ጥቅስ በስክሪኑ ላይ እንዴት ማሳየት እችላለሁ?'],
    // Irish and Galician (2026-11-05: their packages had no typed.json, and a
    // window shown in either answered in English).
    [
        'ga',
        'Conas is féidir liom véarsa ón mBíobla a thaispeáint ar an scáileán?',
    ],
    ['ga', 'Tá na litreacha ró-bheag, cad ba cheart dom a dhéanamh?'],
    ['gl', 'Como podo poñer un versículo da Biblia na pantalla?'],
    ['gl', 'As letras son moi pequenas, como as fago máis grandes?'],
    ['gl', 'Non atopo o botón, podes axudarme?'],
];

// How a language is told apart is ITS data (`online/<code>/typed.json`),
// there when it is installed (2026-11-04: only English ships) -- here every
// package of the checkout stands in for an installed one. A language with no
// package yet keeps its file in a folder of its own and is not named.
const ONLINE_DIR = path.join(import.meta.dirname, '..', '..', 'online');
const TYPED_FILE_CODE_LIST = readdirSync(ONLINE_DIR).flatMap((folder) => {
    const filePath = path.join(ONLINE_DIR, folder, 'typed.json');
    return existsSync(filePath)
        ? Object.keys(JSON.parse(readFileSync(filePath, 'utf8')))
        : [];
});
const NAMED_CODE_SET = new Set(
    [...listAssistantLanguages(), ...listTypedLanguages()].map((language) => {
        return language.code;
    }),
);
const NAMED_SAMPLE_LIST = SAMPLE_LIST.filter(([code]) => {
    return NAMED_CODE_SET.has(code);
});
const UNNAMED_SAMPLE_LIST = SAMPLE_LIST.filter(([code]) => {
    return !NAMED_CODE_SET.has(code);
});
// A case about particular languages runs while every one of them is named
// here -- installed, its package in the checkout -- so the suite still runs
// with every non-English package deleted.
function checkHasAll(...codeList: string[]) {
    return codeList.every((code) => {
        return NAMED_CODE_SET.has(code);
    });
}

describe('the language a question is written in', () => {
    test.each(NAMED_SAMPLE_LIST)('%s: %s', (code, text, sibling) => {
        expect([code, sibling]).toContain(detectTypedLanguage(text));
    });

    // Its words wait in its own folder until it has a package.
    test.each(UNNAMED_SAMPLE_LIST)(
        '%s, with no package, is not named: %s',
        (code, text) => {
            expect(detectTypedLanguage(text)).not.toBe(code);
        },
    );

    // A language added to a folder is a language a line here is written in.
    test.runIf(TYPED_FILE_CODE_LIST.length > 0)(
        'every language a folder tells apart has a line above',
        () => {
            const sampledCodeSet = new Set(
                SAMPLE_LIST.map(([code]) => {
                    return code;
                }),
            );
            expect(TYPED_FILE_CODE_LIST.length).toBeGreaterThan(0);
            expect(
                TYPED_FILE_CODE_LIST.filter((code) => {
                    return !sampledCodeSet.has(code);
                }),
            ).toEqual([]);
        },
    );

    test('a script nobody here names is still answered in itself', () => {
        expect(detectTypedLanguage('ᎣᏏᏲ ᏙᎯᏧ ᎤᏁᎳᏅᎯ')).toBe(OTHER_CHAT_LANG_CODE);
    });

    test('an English line quoting a Thai or Korean button is English', () => {
        expect(
            detectTypedLanguage('Where is the ปุ่ม button in this window?'),
        ).toBe('en');
        expect(detectTypedLanguage('How do I press the 설정 button?')).toBe(
            'en',
        );
    });

    test.runIf(checkHasAll('vi'))(
        'a letter typed as a base and its accent is the letter',
        () => {
            expect(
                detectTypedLanguage(
                    'Làm sao để hiển thị câu Kinh Thánh lên màn hình?'.normalize(
                        'NFD',
                    ),
                ),
            ).toBe('vi');
        },
    );
});

describe('the language an answer is written in', () => {
    // Before: `fr` in every app, and Portuguese in a Khmer app was `km`.
    test.runIf(checkHasAll('es', 'pt', 'th'))(
        'what they typed, whatever language the app is in',
        () => {
            for (const appLangCode of [
                'en',
                ...listAssistantLanguages().map((language) => {
                    return language.code;
                }),
            ]) {
                expect(
                    pickReplyLanguage(
                        '¿Cómo pongo un versículo de la Biblia en la pantalla?',
                        { appLangCode },
                    ),
                ).toBe('es');
                expect(
                    pickReplyLanguage(
                        'Como coloco um versículo da Bíblia na tela?',
                        {
                            appLangCode,
                        },
                    ),
                ).toBe('pt');
                expect(
                    pickReplyLanguage(
                        'ตัวหนังสือเล็กเกินไป จะทำให้ใหญ่ขึ้นได้อย่างไร',
                        {
                            appLangCode,
                        },
                    ),
                ).toBe('th');
            }
        },
    );

    test('a press is still the app’s words', () => {
        expect(
            pickReplyLanguage('¿Cómo pongo un versículo en la pantalla?', {
                appLangCode: 'xx',
                isPressed: true,
            }),
        ).toBe('xx');
    });

    test.runIf(checkHasAll('es', 'th', 'ja'))(
        'a language only typed is named, and has no lists of its own',
        () => {
            const spanish = getAssistantLanguage('es');
            expect(spanish.code).toBe('es');
            expect(spanish.name).toBe('Spanish');
            expect(spanish.nativeName).toBe('Español');
            expect(spanish.isPackaged).toBe(false);
            expect(spanish.isLatinScript).toBe(true);
            expect(spanish.verseAskPatterns).toEqual([]);
            const thai = getAssistantLanguage('th');
            expect(thai.isLatinScript).toBe(false);
            expect(thai.scriptPattern.test('ก')).toBe(true);
            expect(thai.scriptPattern.test('a')).toBe(false);
            expect(getAssistantLanguage('ja').scriptPattern.test('の')).toBe(
                true,
            );
            expect(getAssistantLanguage('ja').scriptPattern.test('書')).toBe(
                true,
            );
        },
    );

    test.runIf(checkHasAll('es', 'ja', 'ru', 'th', 'pt', 'ko'))(
        'a yes and a no in any language here',
        () => {
            expect(checkIsLanguageWord('Sí', 'yes')).toBe(true);
            expect(checkIsLanguageWord('はい。', 'yes')).toBe(true);
            expect(checkIsLanguageWord('да', 'yes')).toBe(true);
            expect(checkIsLanguageWord('ใช่', 'yes')).toBe(true);
            expect(checkIsLanguageWord('não', 'no')).toBe(true);
            expect(checkIsLanguageWord('아니요', 'no')).toBe(true);
            expect(checkIsLanguageWord('Sí, quiero ver otro', 'yes')).toBe(
                false,
            );
        },
    );
});

describe('chips in the script of the answer', () => {
    // Before: every chip under an answer in Chinese, Thai, Korean, Russian
    // and Arabic was dropped -- only a package's script counted.
    test.each([
        ['字还是太小', '点击经文左下角的小按钮 ⋯ 以打开隐藏控制栏。'],
        ['ยังเล็กอยู่', 'คลิกปุ่ม ⋯ เล็กๆ ที่มุมล่างซ้าย'],
        ['아직 작아요', '성경 본문 왼쪽 아래에 있는 작은 ⋯ 버튼을 클릭'],
        ['Всё ещё мелко', 'Нажмите на маленькую кнопку ⋯'],
        ['ما زالت صغيرة', 'اضغط على الزر الصغير ⋯'],
    ])('%s under an answer in its script', (chip, answerText) => {
        expect(checkIsChosenScript(chip, answerText, 'en')).toBe(true);
    });

    test('never a script nobody chose', () => {
        expect(
            checkIsChosenScript('请确认', 'ตัวหนังสือเล็กเกินไป', 'en'),
        ).toBe(false);
        expect(
            checkIsChosenScript('ยังเล็กอยู่', 'Press the button', 'en'),
        ).toBe(false);
    });
});

// What the answer is cleaned by depends on the SCREEN: an English one shows
// English names, one in another language that language's. `xx` is any
// screen not in English, its dictionary a stand-in.
describe('an answer shown on a screen in another language', () => {
    const asIs = (label: string) => {
        return label;
    };
    const toScreenWords = (label: string) => {
        return (
            (
                { 'Font Size': 'Font Size (xx)', Text: 'Text (xx)' } as Record<
                    string,
                    string
                >
            )[label] ?? label
        );
    };

    test.runIf(checkHasAll('es'))(
        'an English chip goes from under a Spanish answer',
        () => {
            expect(
                toRepliesShownInLanguage(
                    ['The words are big enough now', 'Ya se ve bien'],
                    'es',
                    asIs,
                    undefined,
                    'en',
                ),
            ).toEqual(['Ya se ve bien']);
        },
    );

    test('an English gloss stays on an English screen', () => {
        const answer = '点击 设置 (Settings) 按钮。';
        expect(
            toAnswerShownInLanguage(answer, 'zh', asIs, undefined, 'en'),
        ).toBe(answer);
    });

    test.runIf(checkHasAll('de'))(
        'a German noun is no label; a bold name is',
        () => {
            expect(
                toAnswerShownInLanguage(
                    'Der Text ist zu klein. Drücke **Font Size**.',
                    'de',
                    toScreenWords,
                    undefined,
                    'xx',
                ),
            ).toBe('Der Text ist zu klein. Drücke **Font Size (xx)**.');
        },
    );

    test.runIf(checkHasAll('zh'))(
        'a button’s English name in a chip on an English screen',
        () => {
            expect(
                toRepliesShownInLanguage(
                    ['Font Size 还是太小'],
                    'zh',
                    asIs,
                    undefined,
                    'en',
                ),
            ).toEqual(['Font Size 还是太小']);
            expect(
                toRepliesShownInLanguage(
                    ['Font Size 还是太小'],
                    'zh',
                    asIs,
                    undefined,
                    'xx',
                ),
            ).toEqual([]);
        },
    );
});

describe('worked in English behind the scenes', () => {
    test('a language only typed has no guide page of its own', () => {
        expect(findPageLanguage('es')).toBeNull();
        expect(
            listAssistantLanguages().some((language) => {
                return language.code === 'es';
            }),
        ).toBe(false);
    });

    test.runIf(checkHasAll('es', 'th'))(
        'a language only typed is translated for any model but Gemma 4',
        () => {
            expect(
                findTranslatedLanguage('es', 'Nemotron Super VL')?.name,
            ).toBe('Spanish');
            expect(findTranslatedLanguage('th', 'gpt-5-mini')?.nativeName).toBe(
                'ไทย',
            );
            expect(findTranslatedLanguage('es', 'gemma4:cloud')).toBeNull();
            expect(findTranslatedLanguage('other', 'gpt-5-mini')).toBeNull();
        },
    );

    test.runIf(checkHasAll('th'))(
        'the translator is told the language by name',
        () => {
            const thai = getAssistantLanguage('th');
            expect(toQuestionTranslationAsk('ทำอย่างไร', thai)).toContain(
                'from Thai into English',
            );
            expect(
                toAnswerTranslationAsk('Press **Font Size**.', thai),
            ).toContain('into Thai (ไทย)');
        },
    );

    test.runIf(checkHasAll('es'))(
        'a Spanish question is put into English once',
        async () => {
            const askedList: string[] = [];
            const translation = genAskTranslation({
                replyLang: 'es',
                words: '¿Cómo pongo un versículo de la Biblia en la pantalla?',
                findTranslator: async () => {
                    return {
                        provider: 'custom',
                        model: 'gemma4:cloud',
                        label: 'gemma4:cloud',
                    };
                },
                translate: async (ask) => {
                    askedList.push(ask);
                    return 'How do I put a Bible verse on the screen?';
                },
            });
            const plan = await translation.planFor('Nemotron Super VL');
            expect(plan?.language.code).toBe('es');
            expect(plan?.english).toBe(
                'How do I put a Bible verse on the screen?',
            );
            expect(askedList[0]).toContain('from Spanish into English');
            expect(await translation.planFor('gemma4:cloud')).toBeNull();
        },
    );

    // 2026-11-03: riding the answer as an OPTIONS line, the options came
    // back with no such line under 6 of 6 answers on the free tier, and the
    // model's English chips stood under a Spanish one.
    test.runIf(checkHasAll('es'))(
        'the options are put into the language on their own',
        async () => {
            const askedList: string[] = [];
            const translation = genAskTranslation({
                replyLang: 'es',
                words: 'x',
                findTranslator: async () => {
                    return null;
                },
                translate: async (ask, _translator, kind) => {
                    askedList.push(`${kind}: ${ask}`);
                    return '1. Todavía es muy pequeño\n2. No';
                },
            });
            const spanish = getAssistantLanguage('es');
            const translator = {
                provider: 'custom',
                model: 'gemma4:cloud',
                label: 'gemma4:cloud',
            };
            expect(
                await translation.translateReplies(
                    ['It is still too small', 'No'],
                    spanish,
                    translator,
                    (label) => {
                        return label;
                    },
                ),
            ).toEqual(['Todavía es muy pequeño', 'No']);
            expect(askedList[0]).toMatch(
                /^replies: 1\. It is still too small\n2\. No/,
            );
            expect(askedList[0]).toContain('into Spanish (Español)');
            expect(
                await translation.translateReplies(
                    [],
                    spanish,
                    translator,
                    (label) => {
                        return label;
                    },
                ),
            ).toBeNull();
        },
    );

    test.runIf(checkHasAll('th'))(
        'options that did not come back are no options',
        () => {
            const thai = getAssistantLanguage('th');
            expect(
                readRepliesTranslation('1. ยังเล็กอยู่', ['Still small'], thai),
            ).toEqual(['ยังเล็กอยู่']);
            // English handed back, a number missing, a Thai line in Latin.
            expect(
                readRepliesTranslation('1. Still small', ['Still small'], thai),
            ).toBeNull();
            expect(
                readRepliesTranslation(
                    '1. ยังเล็กอยู่',
                    ['Still small', 'No'],
                    thai,
                ),
            ).toBeNull();
            expect(
                readRepliesTranslation('1. Yang lek yu', ['Still small'], thai),
            ).toBeNull();
            expect(toRepliesTranslationAsk(['Show me'], thai)).toContain(
                'Keep each number and one line each',
            );
        },
    );
});
