/**
 * The sidecar beside a PowerPoint file holding how its slides are built
 * (`pptxBuildOptionHelpers`). Declared here, in a leaf, so the rename / trash
 * code in `appHelpers` can name it without loading the helpers -- which load
 * `FileSource`, and so `appHelpers` again, before this constant is set.
 */
export const PPTX_BUILD_META_DOT_EXTENSION = '.build.json';
