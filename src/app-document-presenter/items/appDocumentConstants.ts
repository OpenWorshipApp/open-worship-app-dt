// Kept in a dependency-free module: `appDocumentHelpers` sits inside an
// import cycle (AppDocument -> appDocumentHelpers -> CanvasController -> ...
// -> varyAppDocumentHelpers), and a module-scope read of this constant while
// `appDocumentHelpers` is still initializing throws a TDZ ReferenceError on
// the screen page.
export const APP_DOCUMENT_ITEM_CLASS = 'data-vary-app-document-item';
