// `npm run build-open-worship-app-mcp [-- flags]` writes the npm package
// `open-worship-app-mcp` -- the app's MCP server, its knowledge, every
// language's text, its unit tests, its types and the robot-test skill -- into
// `../owa-mcp-dist`, the package's own repository. `npm i open-worship-app-mcp`,
// start the app, and the server finds it.
//
//   --out=<dir>        where (default: ../owa-mcp-dist beside this repository)
//   --version=<v>      the package version (default: the app's, which npm
//                      writes without a leading zero: 2026.11.02 is 2026.11.2)
//   --dry-run          stage and verify, write nothing into the dist folder
//   --no-verify        skip the checks (never for a release)
//   --live[=dev|prod]  also ask a RUNNING app's state through the packed server
//
// The files come from ONE staged tree (`mcp-dist/mcpRuntimeTree.mjs`), the
// same the extra-bin pack's single executable runs. The checks, in order:
// `npm pack` and the packed tarball extracted; a handshake with the packed
// server; its own tests; the PARITY check -- a single executable built from
// the same files must answer `tools/list` and every offline call exactly as
// `node bin.mjs` does (the user's rule: "npm mcp and the single executable
// have to be no different functionalities"); the API from a scratch ESM,
// CommonJS and TypeScript consumer. Nothing is published, committed or pushed:
// the dist folder is a repository of its own, and what happens to it is the
// person's call.

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { extract as tarExtract } from 'tar';

import {
  DIST_MANIFEST_FILE_NAME,
  MCP_DEPENDENCY_NAME_LIST,
  MCP_DIR,
  MCP_PACKAGE_NAME,
  MCP_SERVER_NAME,
  ONLINE_DATA_DIR,
  checkDistOutDir,
  checkIsMcpTestFile,
  checkIsMcpTypesFile,
  listTestPackageNames,
  toMcpExecutableName,
  toNpmVersion,
} from './mcp-dist/mcpDistHelpers.mjs';
import {
  OFFLINE_CALL_LIST,
  checkSmokeHandshake,
  compareHandshakes,
  genHermeticEnv,
  normalizeHandshake,
  runMcpHandshake,
} from './mcp-dist/mcpHandshake.mjs';
import {
  REPO_ROOT,
  listRepoFiles,
  readGitSource,
  stageMcpRuntimeTree,
} from './mcp-dist/mcpRuntimeTree.mjs';
import { buildMcpExecutable, readNodeSeaSupport } from './mcp-dist/mcpSea.mjs';

const DEFAULT_OUT_DIR = path.resolve(REPO_ROOT, '..', 'owa-mcp-dist');
const README_TEMPLATE_PATH = path.join(
  REPO_ROOT,
  'extra-work',
  'mcp-dist',
  'README.template.md',
);
const ROBOT_TEST_SKILL_DIR = '.claude/skills/owa-robot-test';
const COVERAGE_MATRIX_FILE = 'docs/test-paths/coverage-matrix.md';
// Repository modules the shipped tests import.
const TEST_HELPER_FILE_LIST = [
  'extra-work/language-packages.mjs',
  'extra-work/bibleNoteGuideHelpers.mjs',
];
// A language package's own tests of the server (its labels, its corpus, its
// Bible names), found by place, naming no language.
const LANG_TEST_DIR_SOURCE = `^${ONLINE_DATA_DIR}/[^/]+/tests/${MCP_DIR}/`;
const LANG_PACKAGE_MCP_TEST_PATTERN = new RegExp(
  `${LANG_TEST_DIR_SOURCE}[^/]+\\.test\\.mjs$`,
);
// The tests that need the app's whole checkout, each with its reason. Every
// other test ships, and the staged run holds them to passing there.
const CHECKOUT_ONLY_TEST_LIST = [
  [
    new RegExp(`^${MCP_DIR}/agentNoteEdit\\.test\\.mjs$`),
    "imports the Bible note editor's own code from src/",
  ],
  [
    new RegExp(`^${MCP_DIR}/packagedImports\\.test\\.mjs$`),
    "holds the app's electron-builder file lists",
  ],
  [
    new RegExp(`^${MCP_DIR}/tran\\.test\\.mjs$`),
    "reads the raw .claude notes and English's dictionary source",
  ],
  [
    new RegExp(`${LANG_TEST_DIR_SOURCE}tran\\.test\\.mjs$`),
    "reads the raw .claude notes, as the server's own tran test does",
  ],
  [
    new RegExp(`^${MCP_DIR}/openLyricEditRecordedCalls\\.test\\.mjs$`),
    "replays model calls recorded in the chatbot skill's references",
  ],
];

function checkIsCheckoutOnlyTest(filePath) {
  return CHECKOUT_ONLY_TEST_LIST.some(([pattern]) => {
    return pattern.test(filePath);
  });
}
// What the shipped tests need besides the server's own dependencies, at the
// app's own ranges (or, for one the app has only through another package, the
// version it runs with). `checkTestPackages` fails the build when a shipped
// test imports a package or asks for an environment this list lacks, and the
// clean installs (`checkCleanInstalls`) when one is missing that no reading
// of the tests can see -- `bible-note` is a `require.resolve` of a string.
const TEST_DEV_DEPENDENCY_LIST = [
  'vitest',
  'eslint',
  'open-lyric',
  'bible-note',
  // Twenty tests run in `@vitest-environment jsdom`; vitest's optional peer.
  'jsdom',
  // open-lyric's optional peer, which its entry imports as it loads: five
  // tests load open-lyric. A dev install only -- `npm install
  // open-worship-app-mcp` never installs a package's devDependencies.
  'monaco-editor',
];
const PACKAGE_FILE_LIST = [
  'tools/',
  'electron-build/',
  'docs/',
  'src/',
  'extra-work/',
  '.claude/',
  'vitest.config.mjs',
  '.mcp.json',
];
const isWindows = process.platform === 'win32';

function log(...items) {
  console.log(...items);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readJsonIfAny(filePath) {
  try {
    return readJson(filePath);
  } catch (_error) {
    return null;
  }
}

function readOptions(argList) {
  const options = {
    out: null,
    version: null,
    isDryRun: false,
    isVerified: true,
    live: null,
  };
  for (const arg of argList) {
    if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg.startsWith('--version=')) {
      options.version = arg.slice('--version='.length);
    } else if (arg === '--dry-run') {
      options.isDryRun = true;
    } else if (arg === '--no-verify') {
      options.isVerified = false;
    } else if (arg === '--live') {
      options.live = 'any';
    } else if (arg.startsWith('--live=')) {
      options.live = arg.slice('--live='.length);
      if (!['dev', 'prod'].includes(options.live)) {
        throw new Error('--live takes dev or prod');
      }
    } else if (arg === '--help' || arg === '-h') {
      options.isHelp = true;
    } else {
      throw new Error(`Unknown flag "${arg}" (see --help)`);
    }
  }
  return options;
}

/** A link to the repository's dependencies, for a run inside a temp tree. */
function linkNodeModules(dirPath) {
  const linkPath = path.join(dirPath, 'node_modules');
  symlinkSync(
    path.join(REPO_ROOT, 'node_modules'),
    linkPath,
    isWindows ? 'junction' : 'dir',
  );
  return linkPath;
}

// Taken off before any folder holding it is removed: a recursive delete must
// never walk into the repository's own node_modules.
function unlinkIfLink(linkPath) {
  try {
    if (lstatSync(linkPath).isSymbolicLink()) {
      unlinkSync(linkPath);
    }
  } catch (_error) {
    // Not there.
  }
}

/**
 * Every package a shipped test or test helper needs by name must be one the
 * package declares: the build runs the tests against the repository's own
 * node_modules, where a package the app has only through another one is
 * found, and a clean `npm install` of the package does not have it.
 */
function checkTestPackages(stageDir, fileList) {
  const declaredSet = new Set([
    ...MCP_DEPENDENCY_NAME_LIST,
    ...TEST_DEV_DEPENDENCY_LIST,
  ]);
  const problemList = [];
  for (const relPath of fileList) {
    if (!relPath.endsWith('.mjs')) {
      continue;
    }
    const filePath = path.join(stageDir, ...relPath.split('/'));
    if (!existsSync(filePath)) {
      continue;
    }
    for (const packageName of listTestPackageNames(
      readFileSync(filePath, 'utf8'),
    )) {
      if (!declaredSet.has(packageName)) {
        problemList.push(`${relPath} needs "${packageName}"`);
      }
    }
  }
  if (problemList.length > 0) {
    throw new Error(
      'The package would not declare what its tests need -- add each to ' +
        `TEST_DEV_DEPENDENCY_LIST:\n  ${problemList.join('\n  ')}`,
    );
  }
}

function listShippedFiles() {
  const mcpFileList = listRepoFiles([MCP_DIR]);
  const testList = [
    ...mcpFileList.filter(checkIsMcpTestFile),
    ...listRepoFiles([ONLINE_DATA_DIR]).filter((filePath) => {
      return LANG_PACKAGE_MCP_TEST_PATTERN.test(filePath);
    }),
  ];
  const shippedTestList = testList.filter((filePath) => {
    return !checkIsCheckoutOnlyTest(filePath);
  });
  const typeFileList = mcpFileList.filter(checkIsMcpTypesFile);
  const robotFileList = listRepoFiles([ROBOT_TEST_SKILL_DIR]);
  return {
    shippedTestList,
    stayedTestCount: testList.length - shippedTestList.length,
    extraFileList: [
      ...shippedTestList,
      ...typeFileList,
      ...TEST_HELPER_FILE_LIST,
      ...robotFileList,
      COVERAGE_MATRIX_FILE,
    ],
  };
}

function genPackageJson({ version, appVersion, gitSource }) {
  const rootPackage = readJson(path.join(REPO_ROOT, 'package.json'));
  const installedVersionOf = (name) => {
    return readJson(path.join(REPO_ROOT, 'node_modules', name, 'package.json'))
      .version;
  };
  const rangeOf = (name) => {
    return (
      rootPackage.dependencies?.[name] ??
      rootPackage.devDependencies?.[name] ??
      `^${installedVersionOf(name)}`
    );
  };
  const typesPath = `./${MCP_DIR}/index.d.mts`;
  const mainPath = `./${MCP_DIR}/index.mjs`;
  return {
    name: MCP_PACKAGE_NAME,
    version,
    description:
      "The Open Worship App's MCP server: lets an AI agent see and drive " +
      'the running app (Chrome DevTools tools aimed at it plus the app’s own ' +
      'owa_* tools, behind its firewall), with the app’s manual and ' +
      'language data.',
    keywords: [
      'mcp',
      'model-context-protocol',
      'open-worship',
      'worship',
      'church',
      'presentation',
      'ai-agent',
      'chrome-devtools',
    ],
    homepage: rootPackage.homepage,
    repository: {
      type: 'git',
      url: `git+${rootPackage.gitRepository}.git`,
      directory: MCP_DIR,
    },
    bugs: { url: `${rootPackage.gitRepository}/issues` },
    author: rootPackage.author,
    license: 'SEE LICENSE IN LICENSE.txt',
    type: 'module',
    main: mainPath,
    types: typesPath,
    exports: {
      '.': { types: typesPath, default: mainPath },
      './package.json': './package.json',
    },
    bin: { [MCP_PACKAGE_NAME]: `${MCP_DIR}/bin.mjs` },
    files: PACKAGE_FILE_LIST,
    scripts: {
      start: `node ${MCP_DIR}/bin.mjs`,
      test: 'vitest run',
    },
    engines: rootPackage.engines,
    dependencies: {
      // Exact: the server deep-imports its internals.
      'chrome-devtools-mcp': installedVersionOf('chrome-devtools-mcp'),
      ws: rangeOf('ws'),
    },
    devDependencies: Object.fromEntries(
      TEST_DEV_DEPENDENCY_LIST.map((name) => {
        return [name, rangeOf(name)];
      }),
    ),
    openWorshipApp: {
      version: appVersion,
      commit: gitSource.commit,
      hasUncommittedChanges: gitSource.hasUncommittedChanges,
    },
  };
}

function toTableCell(text) {
  return text.replace(/\s+/g, ' ').replaceAll('|', '\\|').trim();
}

function toFirstSentence(description = '') {
  const text = description.replace(/\s+/g, ' ').trim();
  const match = /^(.{20,220}?[.!?])(?:\s|$)/.exec(text);
  const sentence = match === null ? text.slice(0, 220) : match[1];
  return sentence.length < text.length && match === null
    ? `${sentence}...`
    : sentence;
}

function genToolTable(toolList) {
  const appToolList = toolList.filter((tool) => {
    return tool.name.startsWith('owa_');
  });
  const browserToolList = toolList.filter((tool) => {
    return !tool.name.startsWith('owa_');
  });
  const genTable = (list) => {
    return [
      '| Tool | What it does |',
      '| ---- | ------------ |',
      ...list.map((tool) => {
        return `| \`${tool.name}\` | ${toTableCell(toFirstSentence(tool.description))} |`;
      }),
    ].join('\n');
  };
  return [
    `### The app's own tools (${appToolList.length})`,
    '',
    genTable(appToolList),
    '',
    `### Browser tools, aimed at the app's windows (${browserToolList.length})`,
    '',
    genTable(browserToolList),
  ].join('\n');
}

function genReadme({ version, appVersion, gitSource, toolList, testCount }) {
  const rootPackage = readJson(path.join(REPO_ROOT, 'package.json'));
  const valueMap = {
    VERSION: version,
    APP_VERSION: appVersion,
    TOOL_COUNT: String(toolList.length),
    TOOL_TABLE: genToolTable(toolList),
    NODE_RANGE: rootPackage.engines.node,
    TEST_COUNT: String(testCount),
    COMMIT: (gitSource.commit ?? 'unknown').slice(0, 12),
  };
  return readFileSync(README_TEMPLATE_PATH, 'utf8').replace(
    /\{\{([A-Z_]+)\}\}/g,
    (match, key) => {
      if (valueMap[key] === undefined) {
        throw new Error(`README.template.md: no value for ${match}`);
      }
      return valueMap[key];
    },
  );
}

// The settings of the app's own `vitest.config.ts` the MCP tests depend on --
// without them a mock keeps its calls into the next test (2026-11-13: two
// tests failed in the package and passed in the app) and open-lyric's raw
// `.css` imports crash a node run.
const VITEST_CONFIG_SOURCE = `// The MCP server's unit tests, and each language package's tests of it, run
// with the Open Worship App's own test settings.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tools/**/*.test.mjs',
      'src/lang/data/online/*/tests/tools/**/*.test.mjs',
    ],
    environment: 'node',
    pool: 'threads',
    testTimeout: 30000,
    server: {
      deps: {
        // Both ship raw .css imports: inlined, vite stubs the css out.
        inline: ['open-lyric', /monaco-editor/],
      },
    },
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
  },
});
`;

function writeGeneratedFiles(stageDir, generated) {
  const fileMap = {
    'package.json': `${JSON.stringify(generated.packageJson, null, 2)}\n`,
    'README.md': generated.readme,
    'LICENSE.txt': readFileSync(path.join(REPO_ROOT, 'LICENSE.txt'), 'utf8'),
    '.mcp.json': `${JSON.stringify(
      {
        mcpServers: {
          [MCP_SERVER_NAME]: {
            command: 'node',
            args: [`${MCP_DIR}/bin.mjs`],
          },
        },
      },
      null,
      2,
    )}\n`,
    '.gitignore': 'node_modules/\n*.tgz\ntest-results/\n',
    'vitest.config.mjs': VITEST_CONFIG_SOURCE,
  };
  for (const [fileName, content] of Object.entries(fileMap)) {
    writeFileSync(path.join(stageDir, fileName), content);
  }
  const ownedEntryList = [...readdirSync(stageDir), DIST_MANIFEST_FILE_NAME]
    .filter((entryName) => {
      return entryName !== 'node_modules';
    })
    .sort();
  writeFileSync(
    path.join(stageDir, DIST_MANIFEST_FILE_NAME),
    `${JSON.stringify(
      {
        description:
          'Written by `npm run build-open-worship-app-mcp` in the Open ' +
          'Worship App repository: the entries it owns here, replaced on ' +
          'every build. Anything else in this folder is left alone.',
        owned: ownedEntryList,
        version: generated.packageJson.version,
        openWorshipApp: generated.packageJson.openWorshipApp,
      },
      null,
      2,
    )}\n`,
  );
}

/** The staged server's tool list, for the README. */
async function readStagedToolList(stageDir) {
  const linkPath = linkNodeModules(stageDir);
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-list-'));
  try {
    const handshake = await runMcpHandshake({
      command: process.execPath,
      args: [path.join(stageDir, MCP_DIR, 'bin.mjs')],
      cwd: tempDir,
      env: genHermeticEnv(tempDir),
      callList: [],
    });
    return handshake.tools;
  } finally {
    unlinkIfLink(linkPath);
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function runChecked(command, argList, options = {}) {
  const result = spawnSync(command, argList, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    throw new Error(
      `"${path.basename(command)} ${argList.join(' ')}" failed ` +
        `(${result.status ?? result.error?.message}):\n${output.slice(-4000)}`,
    );
  }
  return result.stdout;
}

// npm run outside `npm run`'s own settings: an inherited `npm_config_dry_run`
// or prefix would change what is packed or where an install goes.
function genNpmEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => {
      return !key.toLowerCase().startsWith('npm_');
    }),
  );
}

function packPackage(stageDir, packDir) {
  const output = runChecked(
    isWindows ? 'npm.cmd' : 'npm',
    ['pack', '--json', '--pack-destination', packDir],
    { cwd: stageDir, env: genNpmEnv(), shell: isWindows },
  );
  const [packed] = JSON.parse(output.slice(output.indexOf('[')));
  return { ...packed, filePath: path.join(packDir, packed.filename) };
}

function readDeclaredExportList(packageDir) {
  const source = readFileSync(
    path.join(packageDir, MCP_DIR, 'index.d.mts'),
    'utf8',
  );
  return [...source.matchAll(/^export (?:const|function) ([A-Za-z_$][\w$]*)/gm)]
    .map((match) => {
      return match[1];
    })
    .filter((name, index, list) => {
      return list.indexOf(name) === index;
    })
    .sort();
}

const CONSUMER_TS_SOURCE = `import {
  OWA_CDP_INFO_DIR_PATH,
  createOwaMcpServer,
  findDrivenInstance,
  listOwaAppInstances,
  redactSecrets,
  resolveAppBrowserUrl,
  runOwaMcpBridge,
  runOwaMcpStdioServer,
  type OwaAppInstance,
  type OwaMcpServer,
  type OwaMcpTransport,
} from '${MCP_PACKAGE_NAME}';

const apps: OwaAppInstance[] = listOwaAppInstances();
const driven: OwaAppInstance | null = findDrivenInstance();
const browserUrl: string = resolveAppBrowserUrl();
const infoDirPath: string = OWA_CDP_INFO_DIR_PATH;
const clean: string = redactSecrets('nothing secret here');
const ports: number[] = apps.map((app) => app.port);

export async function embed(
  transport: OwaMcpTransport,
): Promise<OwaMcpServer> {
  const { server } = await createOwaMcpServer({ argv: ['--headless'] });
  await server.connect(transport);
  return server;
}

export async function serve(): Promise<number> {
  const stdio = await runOwaMcpStdioServer({ log: () => {} });
  await stdio.close();
  const bridge = await runOwaMcpBridge({ listenPort: 0 });
  await bridge.close();
  return bridge.port;
}

export const seen = [driven, browserUrl, infoDirPath, clean, ports];
`;

/**
 * The package as a program would use it: imported, required and type-checked
 * from a scratch project that installs nothing but a link to it.
 */
function checkApiConsumers(packageDir, workDir) {
  const consumerDir = path.join(workDir, 'consumer');
  const moduleDir = path.join(consumerDir, 'node_modules');
  mkdirSync(moduleDir, { recursive: true });
  const linkPath = path.join(moduleDir, MCP_PACKAGE_NAME);
  symlinkSync(packageDir, linkPath, isWindows ? 'junction' : 'dir');
  try {
    const declaredList = readDeclaredExportList(packageDir);
    const printExports = (loader) => {
      return runChecked(
        process.execPath,
        ['--input-type=module', '-e', loader],
        {
          cwd: consumerDir,
        },
      ).trim();
    };
    const esmList = JSON.parse(
      printExports(
        `const api = await import('${MCP_PACKAGE_NAME}');` +
          'console.log(JSON.stringify(Object.keys(api).sort()));',
      ),
    );
    const cjsList = JSON.parse(
      printExports(
        "import { createRequire } from 'node:module';" +
          `const api = createRequire(process.cwd() + '/')('${MCP_PACKAGE_NAME}');` +
          'console.log(JSON.stringify(Object.keys(api).sort()));',
      ),
    );
    const problemList = [];
    for (const [kind, list] of [
      ['import', esmList],
      ['require', cjsList],
    ]) {
      if (JSON.stringify(list) !== JSON.stringify(declaredList)) {
        problemList.push(
          `${kind}() gives [${list.join(', ')}], index.d.mts declares ` +
            `[${declaredList.join(', ')}]`,
        );
      }
    }
    writeFileSync(path.join(consumerDir, 'consumer.mts'), CONSUMER_TS_SOURCE);
    writeFileSync(
      path.join(consumerDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'nodenext',
          moduleResolution: 'nodenext',
          target: 'es2022',
          strict: true,
          noEmit: true,
          // The package's own declarations are checked too.
          skipLibCheck: false,
          types: [],
        },
        files: ['consumer.mts'],
      }),
    );
    runChecked(
      process.execPath,
      [
        path.join(
          REPO_ROOT,
          'node_modules',
          '@typescript',
          'native',
          'bin',
          'tsc',
        ),
        '-p',
        path.join(consumerDir, 'tsconfig.json'),
      ],
      { cwd: consumerDir },
    );
    if (problemList.length > 0) {
      throw new Error(
        `The API is not what it declares:\n  ${problemList.join('\n  ')}`,
      );
    }
    return declaredList;
  } finally {
    unlinkIfLink(linkPath);
  }
}

// vitest colours its summary; the counts are read without the colour codes.
// eslint-disable-next-line no-control-regex
const ANSI_COLOR_PATTERN = /\x1b\[[0-9;]*m/g;

function runShippedTests(
  packageDir,
  vitestPath = path.join(REPO_ROOT, 'node_modules', 'vitest', 'vitest.mjs'),
) {
  const result = spawnSync(
    process.execPath,
    [
      vitestPath,
      'run',
      '--root',
      packageDir,
      '--config',
      path.join(packageDir, 'vitest.config.mjs'),
    ],
    {
      cwd: packageDir,
      encoding: 'utf8',
      env: genHermeticEnv(null),
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const output = `${result.stdout}\n${result.stderr}`.replace(
    ANSI_COLOR_PATTERN,
    '',
  );
  const summary = output
    .split('\n')
    .filter((line) => {
      return /^\s*(Test Files|Tests)\s/.test(line);
    })
    .map((line) => {
      return line.trim();
    });
  if (result.status !== 0) {
    const failedList = [
      ...new Set(
        [...output.matchAll(/FAIL\s+\S*?\s*(\S+\.test\.mjs)/g)].map((match) => {
          return match[1];
        }),
      ),
    ];
    throw new Error(
      `The shipped tests failed in the package: ${summary.join(', ')}\n` +
        `  ${failedList.join('\n  ')}\n${output.slice(-3000)}`,
    );
  }
  return summary;
}

// An install that owes nothing to this repository: npm's cache first (a build
// normally needs no network), no install scripts (none is needed to run or
// test the package, and a build runs no stranger's code), no lock file.
const CLEAN_INSTALL_FLAG_LIST = [
  '--prefer-offline',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  '--no-package-lock',
];

/**
 * The package as people get it, with none of the repository's node_modules:
 * a user's `npm install` of the tarball, then the handshake through the
 * command it installs; and the dist repo's own `npm install` (dev
 * dependencies too), then the shipped tests on the package's own vitest.
 * The runs above link the repository's node_modules, where a package the
 * app has only through another one is found (2026-11-13: `jsdom` and
 * `monaco-editor`, 25 test files that passed here and could not start in the
 * dist). An install that cannot reach the registry is NOT CHECKED, as a Node
 * that cannot build the executable leaves the parity.
 */
async function checkCleanInstalls({ packed, workDir }) {
  const npmCommand = isWindows ? 'npm.cmd' : 'npm';
  const install = (cwd, argList) => {
    return runChecked(
      npmCommand,
      ['install', ...CLEAN_INSTALL_FLAG_LIST, ...argList],
      { cwd, env: genNpmEnv(), shell: isWindows },
    );
  };
  const userDir = path.join(workDir, 'clean-user');
  mkdirSync(userDir, { recursive: true });
  writeFileSync(
    path.join(userDir, 'package.json'),
    `${JSON.stringify({ name: 'owa-mcp-clean-user', private: true }, null, 2)}\n`,
  );
  try {
    install(userDir, [packed.filePath]);
  } catch (error) {
    return { isChecked: false, reason: firstLineOf(error.message) };
  }
  // What a client starts: the command npm linked. On Windows that is a
  // `.cmd` shim, which only a shell starts, so the file it names is started
  // with this Node there instead.
  const installedDir = path.join(userDir, 'node_modules', MCP_PACKAGE_NAME);
  const binTarget = readJson(path.join(installedDir, 'package.json')).bin[
    MCP_PACKAGE_NAME
  ];
  const [command, args] = isWindows
    ? [process.execPath, [path.join(installedDir, binTarget)]]
    : [path.join(userDir, 'node_modules', '.bin', MCP_PACKAGE_NAME), []];
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-clean-'));
  let userHandshake;
  try {
    userHandshake = await runMcpHandshake({
      command,
      args,
      cwd: tempDir,
      env: genHermeticEnv(tempDir),
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
  const problemList = checkSmokeHandshake(userHandshake);
  if (problemList.length > 0) {
    throw new Error(
      `Installed with npm, the package answered wrong: ${problemList.join('; ')}`,
    );
  }
  const developerDir = path.join(workDir, 'clean-developer');
  mkdirSync(developerDir, { recursive: true });
  await tarExtract({ file: packed.filePath, cwd: developerDir });
  const developerPackageDir = path.join(developerDir, 'package');
  try {
    install(developerPackageDir, []);
  } catch (error) {
    return { isChecked: false, reason: firstLineOf(error.message) };
  }
  const testSummary = runShippedTests(
    developerPackageDir,
    path.join(developerPackageDir, 'node_modules', 'vitest', 'vitest.mjs'),
  );
  return {
    isChecked: true,
    toolCount: userHandshake.tools.length,
    testSummary,
  };
}

function firstLineOf(text) {
  return String(text).split('\n').find(Boolean) ?? '';
}

async function checkParity({ packageDir, npmHandshake }) {
  const support = readNodeSeaSupport();
  if (!support.isUsable) {
    return { isChecked: false, reason: support.reason };
  }
  const exePath = path.join(packageDir, toMcpExecutableName(isWindows));
  const built = await buildMcpExecutable({ outFilePath: exePath });
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-parity-'));
  try {
    const seaHandshake = await runMcpHandshake({
      command: exePath,
      cwd: tempDir,
      env: genHermeticEnv(tempDir),
    });
    const differenceList = compareHandshakes(
      normalizeHandshake(npmHandshake, [packageDir]),
      normalizeHandshake(seaHandshake, [packageDir]),
    );
    if (differenceList.length > 0) {
      throw new Error(
        'PARITY: the single executable answers differently from the npm ' +
          `package:\n  ${differenceList.join('\n  ')}`,
      );
    }
    return {
      isChecked: true,
      method: built.method,
      nodeVersion: built.nodeVersion,
      toolCount: seaHandshake.tools.length,
      callCount: seaHandshake.calls.length,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    rmSync(exePath, { force: true });
    rmSync(path.join(packageDir, 'launch.cjs'), { force: true });
  }
}

async function checkLive(packageDir, kind) {
  const env = genHermeticEnv(null);
  if (kind !== 'any') {
    env.OWA_CDP_TARGET = kind;
  }
  const handshake = await runMcpHandshake({
    command: process.execPath,
    args: [path.join(packageDir, MCP_DIR, 'bin.mjs')],
    cwd: packageDir,
    env,
    callList: [{ name: 'owa_app_state', arguments: {} }],
  });
  const [call] = handshake.calls;
  const text = call.result?.content?.[0]?.text ?? '';
  if (call.result?.isError || call.error) {
    throw new Error(
      `--live: the packed server found no app: ${text.slice(0, 300)}`,
    );
  }
  const state = JSON.parse(text);
  return `${state.page ?? state.window ?? 'a page'} (${
    state.isDev === undefined
      ? 'kind unknown'
      : state.isDev
        ? 'dev'
        : 'packaged'
  })`;
}

async function verifyPackage({ stageDir, workDir, live }) {
  const packDir = path.join(workDir, 'pack');
  mkdirSync(packDir, { recursive: true });
  const packed = packPackage(stageDir, packDir);
  log(
    `  npm pack: ${packed.filename}, ${packed.entryCount} files, ` +
      `${(packed.size / 1048576).toFixed(1)} MB packed, ` +
      `${(packed.unpackedSize / 1048576).toFixed(1)} MB unpacked`,
  );
  const extractDir = path.join(workDir, 'extract');
  mkdirSync(extractDir, { recursive: true });
  await tarExtract({ file: packed.filePath, cwd: extractDir });
  const packageDir = path.join(extractDir, 'package');
  const linkPath = linkNodeModules(packageDir);
  try {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-npm-'));
    let npmHandshake = null;
    try {
      npmHandshake = await runMcpHandshake({
        command: process.execPath,
        args: [path.join(packageDir, MCP_DIR, 'bin.mjs')],
        cwd: tempDir,
        env: genHermeticEnv(tempDir),
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
    const smokeProblemList = checkSmokeHandshake(npmHandshake);
    if (smokeProblemList.length > 0) {
      throw new Error(
        `The packed server answered wrong: ${smokeProblemList.join('; ')}`,
      );
    }
    log(
      `  handshake: ${npmHandshake.tools.length} tools, ` +
        `${OFFLINE_CALL_LIST.length} offline calls answered`,
    );
    log(`  tests: ${runShippedTests(packageDir).join(', ')}`);
    const clean = await checkCleanInstalls({ packed, workDir });
    log(
      clean.isChecked
        ? `  clean installs: \`npm install\` of the tarball answers ` +
            `${clean.toolCount} tools; in the dist repo's own install the ` +
            `tests: ${clean.testSummary.join(', ')}`
        : `  clean installs: NOT CHECKED -- ${clean.reason}`,
    );
    const parity = await checkParity({ packageDir, npmHandshake });
    log(
      parity.isChecked
        ? `  parity: the single executable (${parity.method}, Node ` +
            `${parity.nodeVersion}) answers ${parity.toolCount} tools and ` +
            `${parity.callCount} calls exactly as the npm package`
        : `  parity: NOT CHECKED -- ${parity.reason}`,
    );
    const exportList = checkApiConsumers(packageDir, workDir);
    log(
      `  API: import(), require() and TypeScript (nodenext, strict) see ` +
        `${exportList.length} exports`,
    );
    if (live !== null) {
      log(
        `  live: the packed server sees ${await checkLive(packageDir, live)}`,
      );
    }
    return { packed, parity };
  } finally {
    unlinkIfLink(linkPath);
  }
}

function readDistState(outDir) {
  const exists = existsSync(outDir);
  return checkDistOutDir({
    outDir,
    repoRoot: REPO_ROOT,
    entryNameList: exists ? readdirSync(outDir) : [],
    packageJson: exists
      ? readJsonIfAny(path.join(outDir, 'package.json'))
      : null,
    manifest: exists
      ? readJsonIfAny(path.join(outDir, DIST_MANIFEST_FILE_NAME))
      : null,
  });
}

function swapIntoDist(stageDir, outDir, ownedEntryList) {
  const isNew = !existsSync(outDir);
  mkdirSync(outDir, { recursive: true });
  const stagedEntryList = readdirSync(stageDir);
  for (const entryName of new Set([...ownedEntryList, ...stagedEntryList])) {
    if (entryName === '.git' || entryName === 'node_modules') {
      continue;
    }
    rmSync(path.join(outDir, entryName), { recursive: true, force: true });
  }
  cpSync(stageDir, outDir, { recursive: true });
  if (!existsSync(path.join(outDir, '.git'))) {
    runChecked('git', ['init', '--quiet'], { cwd: outDir });
    return isNew ? 'created, git init' : 'git init';
  }
  return 'updated';
}

const HELP_TEXT = `npm run build-open-worship-app-mcp [-- flags]

Writes the npm package ${MCP_PACKAGE_NAME} into ../owa-mcp-dist.

  --out=<dir>        where (default ../owa-mcp-dist)
  --version=<v>      package version (default: the app's)
  --dry-run          stage and verify, write nothing
  --no-verify        skip pack, tests, parity and API checks
  --live[=dev|prod]  also ask a running app's state through the packed server
`;

async function main() {
  const options = readOptions(process.argv.slice(2));
  if (options.isHelp) {
    log(HELP_TEXT);
    return;
  }
  const appVersion = readJson(path.join(REPO_ROOT, 'package.json')).version;
  const version = options.version ?? toNpmVersion(appVersion);
  const outDir = path.resolve(REPO_ROOT, options.out ?? DEFAULT_OUT_DIR);
  const distState = readDistState(outDir);
  if (!distState.isOk) {
    throw new Error(`Refusing to write the package: ${distState.reason}`);
  }
  const gitSource = readGitSource();
  log(
    `${MCP_PACKAGE_NAME}@${version} from the app ${appVersion} ` +
      `(${(gitSource.commit ?? 'no commit').slice(0, 12)}` +
      `${gitSource.hasUncommittedChanges ? ', WITH uncommitted changes' : ''})`,
  );

  const workDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-dist-'));
  const stageDir = path.join(workDir, 'package');
  try {
    const { shippedTestList, stayedTestCount, extraFileList } =
      listShippedFiles();
    stageMcpRuntimeTree(stageDir, { extraFileList, log });
    checkTestPackages(stageDir, [...shippedTestList, ...TEST_HELPER_FILE_LIST]);
    const toolList = await readStagedToolList(stageDir);
    writeGeneratedFiles(stageDir, {
      packageJson: genPackageJson({ version, appVersion, gitSource }),
      readme: genReadme({
        version,
        appVersion,
        gitSource,
        toolList,
        testCount: shippedTestList.length,
      }),
    });
    log(
      `  ${shippedTestList.length} tests ship, ` +
        `${stayedTestCount} stay (they need the ` +
        `app's checkout); ${toolList.length} tools in the README`,
    );
    if (options.isVerified) {
      log('Verifying ...');
      await verifyPackage({ stageDir, workDir, live: options.live });
    } else {
      log('Not verified (--no-verify).');
    }
    if (options.isDryRun) {
      log(`Dry run: nothing written to "${outDir}".`);
      return;
    }
    const how = swapIntoDist(stageDir, outDir, distState.ownedEntryList);
    log(
      `"${outDir}" ${how}. Nothing was committed or published: review it, ` +
        'then commit and `npm publish` there.',
    );
  } finally {
    unlinkIfLink(path.join(stageDir, 'node_modules'));
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`build-open-worship-app-mcp: ${error.message}`);
  process.exit(1);
});
