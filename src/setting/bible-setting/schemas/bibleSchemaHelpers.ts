import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';

import bibleInfoSchemaJson from './bibleInfoSchema.json';
import bookChapterSchemaJson from './bibleBookChapterSchema.json';
import bibleNewLinesSchemaJson from './bibleExtraSchema.json';
import localeTableJson from '../../../lang/data/en/locales.json';

// The locale a Bible may be in: any tag of the app's table of the world's
// locales (`src/lang/data/en/locales.json`), every language alike. Until
// 2026-11-09 the schema carried its own list -- the song format's 229 tags --
// and a Bible in Burmese, Haitian Creole, Hausa or ten more installed
// languages failed it (the user: _all languages development, except
// english, should be treated the same way_).
export const BIBLE_LOCALE_LIST: string[] = Object.keys(localeTableJson.locales);

export const infoEditorSchemaHandler: SchemaNode = compileSchema({
    ...bibleInfoSchemaJson,
    properties: {
        ...bibleInfoSchemaJson.properties,
        locale: {
            ...bibleInfoSchemaJson.properties.locale,
            enum: BIBLE_LOCALE_LIST,
        },
    },
});

export const bookChapterEditorSchemaHandler: SchemaNode = compileSchema(
    bookChapterSchemaJson,
);

export const extraEditorSchemaHandler: SchemaNode = compileSchema(
    bibleNewLinesSchemaJson,
);
