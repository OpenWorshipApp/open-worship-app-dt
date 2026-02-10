import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';

import bibleInfoSchemaJson from './bibleInfoSchema.json';
import bookChapterSchemaJson from './bibleBookChapterSchema.json';
import bibleNewLinesSchemaJson from './bibleExtraSchema.json';

export const infoEditorSchemaHandler: SchemaNode =
    compileSchema(bibleInfoSchemaJson);

export const bookChapterEditorSchemaHandler: SchemaNode = compileSchema(
    bookChapterSchemaJson,
);

export const extraEditorSchemaHandler: SchemaNode = compileSchema(
    bibleNewLinesSchemaJson,
);
