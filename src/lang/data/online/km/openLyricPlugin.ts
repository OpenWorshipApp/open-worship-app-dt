// The one part of a language that is CODE: its Open Lyric song plugin
// (keyboard, spellcheck, word breaks), a dependency of this folder's own
// `package.json`, never the app's. Everything else here is data.
export { EditorPluginKmKh as default } from 'open-lyric-plugin-km-kh';
// The song preview's and the Config card's: the app reads the labels they
// print around a song (`Key`, `Attachments`) and attaches those alone
// (`onlineLangPackage.ts`).
export {
    OpenLyricPluginKmKh as LyricPreviewPlugin,
    OpenLyricMarkdownManagerPluginKmKh as LyricMarkdownPlugin,
} from 'open-lyric-plugin-km-kh';
