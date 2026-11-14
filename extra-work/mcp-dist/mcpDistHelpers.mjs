// The rules shared by the two ways the app's MCP server leaves this repository:
// the npm package `open-worship-app-mcp` (`build-open-worship-app-mcp.mjs`)
// and the `mcp/` folder of the extra-bin pack, a Node single executable
// (`build-extra-bin.mjs`). Both are built from ONE staged tree
// (`mcpRuntimeTree.mjs`), so what is chosen, cleaned and refused here is the
// same for both -- the user's rule: "npm mcp and the single executable have to
// be no different functionalities".
//
// Pure: no disk, no process. The I/O lives beside it.

import { createHash } from 'node:crypto';
import { builtinModules } from 'node:module';

export const MCP_PACKAGE_NAME = 'open-worship-app-mcp';
// What a client names the server; the tools' own docs, the robot-test skill
// and the repo's `.mcp.json` all say `mcp__owa-devtools__*`.
export const MCP_SERVER_NAME = 'owa-devtools';
export const MCP_DIR = 'tools/owa-devtools-mcp';
export const KNOWLEDGE_DIR = 'electron-build/knowledge';
export const MANUAL_DIR = 'docs/manual-sources';
export const ENGLISH_DATA_DIR = 'src/lang/data/en';
export const ONLINE_DATA_DIR = 'src/lang/data/online';
// Everything the server imports from outside Node itself. chrome-devtools-mcp
// is pinned EXACTLY wherever it is declared: the server deep-imports its
// `build/src/*` internals, which no semver range promises.
export const MCP_DEPENDENCY_NAME_LIST = ['chrome-devtools-mcp', 'ws'];
export const MCP_EXECUTABLE_BASE_NAME = 'open-worship-app-mcp';
export const MCP_LAUNCH_FILE_NAME = 'launch.cjs';
// Node's own sentinel for a single-executable blob (`postject` and
// `--build-sea` both look for it). A Node binary without it cannot become one.
export const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
export const MIN_NODE_VERSION = '22.12.0';

const LANG_TEXT_EXTENSION_LIST = ['.json', '.md', '.txt'];
// A language package's folders that are not what the server reads: its tests,
// experiments, fonts, the names datasets (megabytes the app reads, never the
// MCP), its song plugin's code and installed dependencies.
const LANG_SKIPPED_DIR_NAME_SET = new Set([
  'tests',
  'experiment',
  'location-name-map-data',
  'node_modules',
  'fonts',
  'src',
]);
const LANG_SKIPPED_FILE_NAME_SET = new Set([
  'package.json',
  'package-lock.json',
]);

function toPosixPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function toBaseName(filePath) {
  return toPosixPath(filePath).split('/').pop();
}

function checkIsUnder(filePath, dirPath) {
  return toPosixPath(filePath).startsWith(`${dirPath}/`);
}

/** A file the server runs: no test, no type declaration, no live probe. */
export function checkIsMcpRuntimeFile(filePath) {
  if (!checkIsUnder(filePath, MCP_DIR)) {
    return false;
  }
  const baseName = toBaseName(filePath);
  return (
    !baseName.endsWith('.test.mjs') &&
    !baseName.endsWith('.d.mts') &&
    baseName !== 'probe-mcp.mjs'
  );
}

export function checkIsMcpTestFile(filePath) {
  return (
    checkIsUnder(filePath, MCP_DIR) &&
    toBaseName(filePath).endsWith('.test.mjs')
  );
}

export function checkIsMcpTypesFile(filePath) {
  return (
    checkIsUnder(filePath, MCP_DIR) && toBaseName(filePath).endsWith('.d.mts')
  );
}

export function checkIsManualFile(filePath) {
  return (
    checkIsUnder(filePath, MANUAL_DIR) && toBaseName(filePath).endsWith('.md')
  );
}

/** English's own tables, the top of `src/lang/data/en/` and nothing deeper. */
export function checkIsEnglishDataFile(filePath) {
  const posixPath = toPosixPath(filePath);
  if (!checkIsUnder(posixPath, ENGLISH_DATA_DIR)) {
    return false;
  }
  const rest = posixPath.slice(ENGLISH_DATA_DIR.length + 1);
  return !rest.includes('/') && rest.endsWith('.json');
}

/**
 * A text file of an installable language package the server can read when no
 * app hands it installed plugins: dictionary, assistant facts, corpus,
 * manual, script and world facts. `packageCodeSet` names the packages
 * (folders with a dictionary), found on disk, never written here.
 */
export function checkIsLangPackageTextFile(filePath, packageCodeSet) {
  const posixPath = toPosixPath(filePath);
  if (!checkIsUnder(posixPath, ONLINE_DATA_DIR)) {
    return false;
  }
  const partList = posixPath.slice(ONLINE_DATA_DIR.length + 1).split('/');
  if (partList.length === 1) {
    return partList[0] === 'README.md';
  }
  const [code, ...innerPartList] = partList;
  if (!packageCodeSet.has(code)) {
    return false;
  }
  const fileName = innerPartList[innerPartList.length - 1];
  const dirNameList = innerPartList.slice(0, -1);
  if (
    fileName.startsWith('.') ||
    LANG_SKIPPED_FILE_NAME_SET.has(fileName) ||
    dirNameList.some((dirName) => {
      return LANG_SKIPPED_DIR_NAME_SET.has(dirName) || dirName.startsWith('.');
    })
  ) {
    return false;
  }
  return LANG_TEXT_EXTENSION_LIST.some((extension) => {
    return fileName.endsWith(extension);
  });
}

/**
 * The repository files of the runtime tree -- everything the server reads at
 * run time but the knowledge bundle, which is built fresh beside them.
 */
export function selectRuntimeTreeFiles(filePathList, { packageCodeSet }) {
  const selected = filePathList.map(toPosixPath).filter((filePath) => {
    return (
      checkIsMcpRuntimeFile(filePath) ||
      checkIsManualFile(filePath) ||
      checkIsEnglishDataFile(filePath) ||
      checkIsLangPackageTextFile(filePath, packageCodeSet)
    );
  });
  return [...new Set(selected)].sort();
}

/** UTF-8 text with no NUL: what both outputs may carry, besides the exe. */
export function checkIsTextBuffer(buffer) {
  if (buffer.includes(0)) {
    return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch (_error) {
    return false;
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Names that are no person's: `C:\Users\Public`, macOS's `/Users/Shared`.
const SHARED_HOME_NAME_SOURCE = '(?!(?:Public|Shared|Default|All Users)\\b)';
// A separator as text writes it: `/`, `\`, or `\\` inside a JSON string.
const SEPARATOR_SOURCE = '(?:\\\\\\\\|\\\\|/)';
// A user name, never ending on the full stop of the sentence around it.
const USER_NAME_SOURCE = '[A-Za-z0-9_-](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?';
const NAME_END_SOURCE = '(?![A-Za-z0-9_-]|\\.[A-Za-z0-9_-])';
// A path's own start, not the middle of an address: `example.com/home/x`
// stays as it is.
const PATH_START_SOURCE = '(?<![A-Za-z0-9.~%_-])';

/**
 * Whose computer built it is nobody's business: a home folder in a note is
 * written `~`. The builder's own home first (any form it takes), then -- unless
 * `isAnyHomeIncluded` is false -- any `/Users/<name>`, `/home/<name>` or
 * `X:\Users\<name>`.
 */
export function genHomePathPatternList(
  homeDirList = [],
  { isAnyHomeIncluded = true } = {},
) {
  const patternList = homeDirList
    .filter((homeDir) => {
      return typeof homeDir === 'string' && homeDir.length > 3;
    })
    .map((homeDir) => {
      const partList = toPosixPath(homeDir).split('/').filter(Boolean);
      const isWindowsDrive = /^[A-Za-z]:$/.test(partList[0] ?? '');
      const lead = isWindowsDrive ? '' : SEPARATOR_SOURCE;
      return new RegExp(
        lead +
          partList.map(escapeRegExp).join(SEPARATOR_SOURCE) +
          NAME_END_SOURCE,
        'gi',
      );
    });
  if (!isAnyHomeIncluded) {
    return patternList;
  }
  patternList.push(
    new RegExp(
      `${PATH_START_SOURCE}(?:[A-Za-z]:)?${SEPARATOR_SOURCE}(?:Users|home)` +
        `${SEPARATOR_SOURCE}${SHARED_HOME_NAME_SOURCE}${USER_NAME_SOURCE}` +
        NAME_END_SOURCE,
      'g',
    ),
  );
  return patternList;
}

/**
 * A file whose words are only read: a note, the manual, the knowledge bundle
 * built from them. A home folder in one is rewritten. Anything else is code or
 * data a program reads -- `C:\Users\me\Grace.owl` in a test is the input
 * the test is about -- and is never rewritten: the builder's own home in it
 * stops the build instead (`findPatternLines`).
 */
export function checkIsProseFile(relPath) {
  return (
    /\.(?:md|txt)$/i.test(relPath) || relPath.startsWith(`${KNOWLEDGE_DIR}/`)
  );
}

/** The 1-based lines some pattern matches. */
export function findPatternLines(text, patternList) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    return patternList.some((pattern) => {
      return new RegExp(pattern.source, pattern.flags.replace('g', '')).test(
        line,
      );
    })
      ? [index + 1]
      : [];
  });
}

export function redactHomePaths(text, homePathPatternList) {
  let out = text;
  for (const pattern of homePathPatternList) {
    out = out.replace(pattern, '~');
  }
  return out;
}

/**
 * Credentials by their SHAPE. The firewall's provider-key shapes
 * (`firewall.mjs` `SECRET_PATTERNS`: `sk-`, Bedrock, JWT, Bearer) and the
 * common token formats beside them. The firewall's last rule -- any value
 * after a word like `apiKey` -- is a run-time scrub for a page or a header;
 * over source code it reads `apiKey: config.apiKey` as a secret, so a file is
 * judged by shapes alone.
 */
export const SECRET_PATTERN_LIST = [
  { name: 'provider key (sk-)', pattern: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: 'Bedrock key', pattern: /\bABSK[A-Za-z0-9+/]{40,}={0,2}/g },
  {
    name: 'Bedrock short-term key',
    pattern: /\bbedrock-api-key-[A-Za-z0-9+/%_=&-]{20,}/g,
  },
  {
    name: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  },
  { name: 'bearer token', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi },
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  {
    name: 'private key',
    pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g,
  },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}/g },
  {
    name: 'GitHub fine-grained token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{40,}/g,
  },
  { name: 'npm token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { name: 'Slack token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}/g },
  { name: 'Hugging Face token', pattern: /\bhf_[A-Za-z0-9]{30,}/g },
];

const SECRET_PREFIX_PATTERN =
  /^(?:sk-(?:ant-api\d+-|proj-|svcacct-|admin-|or-v\d+-)?|ABSK|bedrock-api-key-|Bearer\s+|AKIA|ASIA|gh[pousr]_|github_pat_|npm_|xox[abprs]-|AIza|hf_)/i;

/**
 * A made-up credential a test or a note writes to show the shape: a body of a
 * few distinct characters, or one character run long. A real key is random,
 * and never either.
 */
export function checkIsPlaceholderSecret(value) {
  const body = value.replace(SECRET_PREFIX_PATTERN, '').replace(/[-_.]/g, '');
  if (body.length === 0) {
    return true;
  }
  return new Set(body).size < 10 || /(.)\1{5,}/.test(body);
}

/** How a fixture is named without writing its value down anywhere. */
export function hashSecretValue(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Every credential-shaped value in a text, by line, pattern and the hash of
 * its value -- never the value. `fixtureHashSet` holds what a person checked
 * and recorded as made up (`secret-fixtures.json`).
 */
export function findSecrets(text, { fixtureHashSet = new Set() } = {}) {
  const hitList = [];
  const lineList = text.split(/\r?\n/);
  lineList.forEach((line, index) => {
    for (const { name, pattern } of SECRET_PATTERN_LIST) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const value = match[0];
        const hash = hashSecretValue(value);
        if (checkIsPlaceholderSecret(value) || fixtureHashSet.has(hash)) {
          continue;
        }
        hitList.push({ line: index + 1, pattern: name, hash });
      }
    }
  });
  return hitList;
}

/** The lines that carry an address, by number only. */
export function findTextLines(text, needle) {
  if (!needle) {
    return [];
  }
  const lowerNeedle = needle.toLowerCase();
  return text.split(/\r?\n/).flatMap((line, index) => {
    return line.toLowerCase().includes(lowerNeedle) ? [index + 1] : [];
  });
}

/**
 * npm's version of the app's: `2026.11.02` is the app's, npm refuses a part
 * with a leading zero, so the package is `2026.11.2`.
 */
export function toNpmVersion(appVersion) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(
    String(appVersion).trim(),
  );
  if (match === null) {
    throw new Error(`Not a version: "${appVersion}"`);
  }
  const [, major, minor, patch, prerelease] = match;
  const core = [major, minor, patch]
    .map((part) => {
      return String(Number(part));
    })
    .join('.');
  return prerelease === undefined ? core : `${core}-${prerelease}`;
}

export function compareVersions(left, right) {
  const leftPartList = String(left).replace(/^v/, '').split('.').map(Number);
  const rightPartList = String(right).replace(/^v/, '').split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (leftPartList[index] ?? 0) - (rightPartList[index] ?? 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }
  return 0;
}

// What a dist folder may hold before the first build: a fresh clone of an
// empty repository.
const DIST_FRESH_ENTRY_PATTERN_LIST = [
  /^\.git$/,
  /^\.git[A-Za-z]*$/,
  /^README(?:\.md)?$/i,
  /^LICEN[CS]E/i,
];
export const DIST_MANIFEST_FILE_NAME = '.owa-mcp-dist.json';

function checkIsInsideOrSame(innerPath, outerPath) {
  const inner = toPosixPath(innerPath).replace(/\/+$/, '');
  const outer = toPosixPath(outerPath).replace(/\/+$/, '');
  return inner === outer || inner.startsWith(`${outer}/`);
}

/**
 * Whether the npm package may be written into `outDir`: never the repository
 * or a folder around or inside it, never another package's folder, and a
 * folder this builder did not write only while it holds a fresh clone at most.
 */
export function checkDistOutDir({
  outDir,
  repoRoot,
  entryNameList = [],
  packageJson = null,
  manifest = null,
}) {
  if (
    checkIsInsideOrSame(outDir, repoRoot) ||
    checkIsInsideOrSame(repoRoot, outDir)
  ) {
    return {
      isOk: false,
      reason: `"${outDir}" is the repository, inside it or around it`,
    };
  }
  if (packageJson !== null && packageJson.name !== MCP_PACKAGE_NAME) {
    return {
      isOk: false,
      reason:
        `"${outDir}" holds the package "${packageJson.name}", ` +
        `not ${MCP_PACKAGE_NAME}`,
    };
  }
  if (manifest !== null && Array.isArray(manifest.owned)) {
    return { isOk: true, ownedEntryList: manifest.owned };
  }
  const foreignEntryList = entryNameList.filter((entryName) => {
    return !DIST_FRESH_ENTRY_PATTERN_LIST.some((pattern) => {
      return pattern.test(entryName);
    });
  });
  if (foreignEntryList.length > 0) {
    return {
      isOk: false,
      reason:
        `"${outDir}" is not empty and was not written by this builder ` +
        `(it holds ${foreignEntryList.slice(0, 5).join(', ')})`,
    };
  }
  return { isOk: true, ownedEntryList: [] };
}

/** What a bare import names: `@scope/name/x` is `@scope/name`. */
export function toPackageName(specifier) {
  const partList = specifier.split('/');
  return specifier.startsWith('@')
    ? partList.slice(0, 2).join('/')
    : partList[0];
}

export function checkIsBuiltinSpecifier(specifier) {
  return (
    specifier.startsWith('node:') ||
    builtinModules.includes(toPackageName(specifier))
  );
}

/**
 * Every module a source names: static imports and re-exports, side-effect
 * imports, and `import()` of a literal. A template or a variable is no
 * literal; the run-time test of the tree is what covers those.
 */
export function listModuleSpecifiers(sourceText) {
  const specifierList = [];
  const patternList = [
    /^\s*(?:import|export)\s[^'"`;]*?\sfrom\s*(['"])([^'"]+)\1/gm,
    /^\s*import\s*(['"])([^'"]+)\1/gm,
    /\bimport\(\s*(['"])([^'"]+)\1\s*\)/g,
  ];
  for (const pattern of patternList) {
    for (const match of sourceText.matchAll(pattern)) {
      specifierList.push(match[2]);
    }
  }
  return [...new Set(specifierList)];
}

// vitest's own reading of a test file's environment (`detectCodeBlock`): the
// first such comment anywhere in the file.
const TEST_ENVIRONMENT_PATTERN = /@(?:vitest|jest)-environment\s+([\w-]+)\b/;
// The package each built-in environment loads. They are vitest's OPTIONAL
// peers, so a clean install of the package lacks one it does not declare
// (2026-11-13: the repo had `jsdom` only through another package, and twenty
// shipped tests failed to start in the dist).
const TEST_ENVIRONMENT_PACKAGE_MAP = {
  node: null,
  jsdom: 'jsdom',
  'happy-dom': 'happy-dom',
  'edge-runtime': '@edge-runtime/vm',
};

/**
 * The packages a test file needs by name: what it imports (Node's own
 * modules aside) and the environment it asks vitest for. A package reached
 * through `require.resolve` of a string is not seen here.
 */
export function listTestPackageNames(sourceText) {
  const nameSet = new Set();
  for (const specifier of listModuleSpecifiers(sourceText)) {
    if (!specifier.startsWith('.') && !checkIsBuiltinSpecifier(specifier)) {
      nameSet.add(toPackageName(specifier));
    }
  }
  const environmentName = TEST_ENVIRONMENT_PATTERN.exec(sourceText)?.[1];
  if (environmentName !== undefined) {
    const packageName = Object.hasOwn(
      TEST_ENVIRONMENT_PACKAGE_MAP,
      environmentName,
    )
      ? TEST_ENVIRONMENT_PACKAGE_MAP[environmentName]
      : `vitest-environment-${environmentName}`;
    if (packageName !== null) {
      nameSet.add(packageName);
    }
  }
  return [...nameSet].sort();
}

/**
 * The single executable's bootstrap, embedded in the binary. In a single
 * executable `require` reaches Node's built-ins only, so it makes a full one
 * and hands over to `launch.cjs` ON DISK beside the binary: everything after
 * this line is the same files `node bin.mjs` runs.
 */
export const SEA_MAIN_SOURCE = [
  "'use strict';",
  "const path = require('node:path');",
  "const { createRequire } = require('node:module');",
  'createRequire(process.execPath)(',
  `  path.join(path.dirname(process.execPath), '${MCP_LAUNCH_FILE_NAME}'),`,
  ');',
  '',
].join('\n');

export const SEA_LAUNCH_SOURCE = [
  "'use strict';",
  '// The second step of `open-worship-app-mcp`, the single executable beside',
  '// this file: it starts the MCP server from the files around it, exactly as',
  '// `node tools/owa-devtools-mcp/bin.mjs` does. Keep it where it is.',
  "const path = require('node:path');",
  "const { pathToFileURL } = require('node:url');",
  '',
  "const binPath = path.join(__dirname, 'tools', 'owa-devtools-mcp', 'bin.mjs');",
  'import(pathToFileURL(binPath).href).catch((error) => {',
  "  console.error('[owa-devtools-mcp]', error);",
  '  process.exit(1);',
  '});',
  '',
].join('\n');

export function genSeaConfig({ mainPath, outputPath }) {
  return {
    main: mainPath,
    output: outputPath,
    disableExperimentalSEAWarning: true,
    // No snapshot and no code cache: the blob then carries the bootstrap's
    // source alone, and the same config builds on every Node from 22.12.
    useSnapshot: false,
    useCodeCache: false,
  };
}

export function toMcpExecutableName(isWindows) {
  return isWindows
    ? `${MCP_EXECUTABLE_BASE_NAME}.exe`
    : MCP_EXECUTABLE_BASE_NAME;
}

/**
 * Whether this Node can be the runtime inside the executable: Node itself,
 * new enough, built with single-executable support, and linked statically --
 * a Node that loads its libraries from the system (a package manager's)
 * would not run on the computer the pack is installed on.
 */
export function checkNodeForSea({ version, release, config, hasFuse }) {
  if (release?.name !== 'node') {
    return { isUsable: false, reason: `"${release?.name}" is not Node.js` };
  }
  if (compareVersions(version, MIN_NODE_VERSION) < 0) {
    return {
      isUsable: false,
      reason: `Node ${version} is older than ${MIN_NODE_VERSION}`,
    };
  }
  const variables = config?.variables ?? {};
  if (variables.single_executable_application === false) {
    return {
      isUsable: false,
      reason: 'this Node was built without single-executable support',
    };
  }
  const sharedList = Object.entries(variables)
    .filter(([key, value]) => {
      return (
        key.startsWith('node_shared') && (value === true || value === 'true')
      );
    })
    .map(([key]) => {
      return key;
    });
  if (sharedList.length > 0) {
    return {
      isUsable: false,
      reason:
        'this Node loads system libraries (' +
        `${sharedList.join(', ')}); use an official build from nodejs.org`,
    };
  }
  if (!hasFuse) {
    return {
      isUsable: false,
      reason: 'this Node binary has no single-executable fuse',
    };
  }
  return { isUsable: true, reason: null };
}

// The extra-bin pack's folder for the executable and its tree.
export const MCP_PACK_DIR_NAME = 'mcp';
export const NODE_LICENSE_FILE_NAME = 'NODE-LICENSE';

/**
 * The README beside the executable in the extra-bin pack: what it is, how a
 * client starts it, and that it is the npm package's server, file for file.
 */
export function genExecutableReadme({
  exeName,
  packVersion,
  platform,
  appVersion,
  nodeVersion,
  toolCount,
  hasNodeLicense,
}) {
  const nodeLicenseLine = hasNodeLicense
    ? `- \`${NODE_LICENSE_FILE_NAME}\` -- Node.js's license (the executable is Node.js).`
    : `- Node.js's license: https://github.com/nodejs/node/blob/v${nodeVersion}/LICENSE`;
  return `# Open Worship App MCP server: the single executable

\`${exeName}\` is the Open Worship App's MCP server for an AI agent (Claude
Code, Claude Desktop, Cursor, VS Code, ...) on a computer with no Node.js:
Node.js ${nodeVersion} and the server in one program, ${toolCount} tools. It is
the SAME server as the npm package \`${MCP_PACKAGE_NAME}\` -- the same files,
started the same way -- and the build holds the two to the same answers.

Extra-bin pack ${packVersion} for \`${platform}\`, from the app ${appVersion}.

## Connect an agent

**Settings -> Others -> Extra Binaries -> AI agents (MCP)** is a picker: choose
your AI program (Claude Code, Codex / ChatGPT desktop, Gemini CLI, Claude
Desktop, Cursor, VS Code, Windsurf, Zed, Cline, Continue, ... or the program's
path alone) and **Copy** the command or settings text it shows for this
computer. By hand:

    claude mcp add ${MCP_SERVER_NAME} -- "<this folder>/${exeName}"

or, for a client configured with JSON:

    {
      "mcpServers": {
        "${MCP_SERVER_NAME}": { "command": "<this folder>/${exeName}" }
      }
    }

The app must be running, with **Settings -> AI Providers -> Enable AI
features** on. The server finds it by itself, can start before it and follows
its restarts. With more than one app running it does nothing until one is
chosen: it lists them and the agent asks you which one (\`owa_choose_app\`).
\`owa_app_state\` says whether this server is the app's version -- they should
match for the best result. \`OWA_CDP_TARGET=dev\` or \`prod\` picks one kind of app,
\`OWA_CDP_PORT=<port>\` pins one; \`--bridge --listen=9223\` forwards a fixed
port to wherever the app is.

**The assistant may point, the human presses**: the server's firewall hides
script evaluation, refuses a press that cannot be undone, rations acting calls
and scrubs keys and tokens out of every result. \`OWA_MCP_FIREWALL=off\` is
an environment variable only; do not set it to make a task easier.

## What is here

- \`${exeName}\` -- Node.js with a three-line start that runs \`${MCP_LAUNCH_FILE_NAME}\`.
- \`${MCP_LAUNCH_FILE_NAME}\` -- starts \`${MCP_DIR}/bin.mjs\`.
- \`tools/\`, \`electron-build/knowledge/\`, \`docs/manual-sources/\`,
  \`src/lang/data/\` -- the server, its knowledge and every language's text,
  laid out as in the app's repository.
- \`node_modules/\` -- chrome-devtools-mcp and ws, the server's two packages.
- \`LICENSE.txt\` -- the app's license (GPL-2.0).
${nodeLicenseLine}

Keep the folder whole: the program runs the files beside it.
`;
}
