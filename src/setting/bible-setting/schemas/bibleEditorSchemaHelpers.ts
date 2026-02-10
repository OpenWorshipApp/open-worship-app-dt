import type { SchemaNode } from 'json-schema-library';
import { compileSchema } from 'json-schema-library';
import { Uri } from 'monaco-editor';

import bibleInfoSchemaJson from './bibleInfoSchema.json';
import bookChapterSchemaJson from './bibleBookChapterSchema.json';
import bibleNewLinesSchemaJson from './bibleExtraSchema.json';

export const infoEditorSchemaHandler: SchemaNode =
    compileSchema(bibleInfoSchemaJson);
export const bibleInfoUri = Uri.parse('bible-info');

export const bookChapterEditorSchemaHandler: SchemaNode = compileSchema(
    bookChapterSchemaJson,
);
export const bibleBookChapterUri = Uri.parse('book-chapter');

export const extraEditorSchemaHandler: SchemaNode = compileSchema(
    bibleNewLinesSchemaJson,
);
export const bibleExtraUri = Uri.parse('bible-extra');
