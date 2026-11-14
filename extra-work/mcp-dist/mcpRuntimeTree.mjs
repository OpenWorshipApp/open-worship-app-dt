// Stages the MCP server's RUNTIME TREE: exactly what `tools/owa-devtools-mcp`
// reads when it runs, laid out as it is in this repository -- every module
// finds its files from `tools/owa-devtools-mcp/../..`, so a tree of the same
// shape runs unchanged, as `app.asar.unpacked` already does in the packaged
// app. The npm package and the extra-bin executable are both made from it.
//
//   tools/owa-devtools-mcp/**   the server (no tests, types or live probe)
//   electron-build/knowledge/** the knowledge bundle, built fresh for it
//   docs/manual-sources/**      the manual's pages
//   src/lang/data/en/*.json     English's tables
//   src/lang/data/online/**     every language package's text (what the
//                               server reads where no app hands it plugins)
//
// Every file that leaves goes through ONE gate (`createFileGate`): tracked or
// not ignored by git, text only, a home folder in a note written `~` (code
// and data leave byte for byte, and the builder's own home in them stops the
// build), no credential
// (`secret-fixtures.json` names the made-up ones a person checked), and not
// the builder's own address. A file that fails stops the build, named by its
// path and line only.

import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MCP_VERSION_FILE_NAME,
  genMcpVersionFileText,
} from '../../tools/owa-devtools-mcp/mcpVersion.mjs';
import { listPackageCodes } from '../language-packages.mjs';
import {
  KNOWLEDGE_DIR,
  MANUAL_DIR,
  MCP_DEPENDENCY_NAME_LIST,
  MCP_DIR,
  ENGLISH_DATA_DIR,
  ONLINE_DATA_DIR,
  checkIsBuiltinSpecifier,
  checkIsProseFile,
  checkIsTextBuffer,
  findPatternLines,
  findSecrets,
  findTextLines,
  genHomePathPatternList,
  listModuleSpecifiers,
  redactHomePaths,
  selectRuntimeTreeFiles,
  toPackageName,
} from './mcpDistHelpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
const SECRET_FIXTURES_FILE_PATH = path.join(HERE, 'secret-fixtures.json');

function toPosixPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

/** Files git tracks or would track (never an ignored one) under the roots. */
export function listRepoFiles(rootList) {
  const output = execFileSync(
    'git',
    [
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      ...rootList,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  return [...new Set(output.split('\0'))].filter((filePath) => {
    // Listed in the index, deleted in the working tree: nothing to copy.
    return filePath !== '' && existsSync(path.join(REPO_ROOT, filePath));
  });
}

function runGit(argList) {
  try {
    return execFileSync('git', argList, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_error) {
    return '';
  }
}

/** The builder's address, only ever compared with, never written or sent. */
export function readGitUserEmail() {
  return runGit(['config', 'user.email']) || null;
}

/** Which commit a build came from, and whether the tree had changed since. */
export function readGitSource() {
  return {
    commit: runGit(['rev-parse', 'HEAD']) || null,
    hasUncommittedChanges: runGit(['status', '--porcelain']) !== '',
  };
}

export function readSecretFixtureHashSet() {
  const { fixtures = [] } = JSON.parse(
    readFileSync(SECRET_FIXTURES_FILE_PATH, 'utf8'),
  );
  return new Set(
    fixtures.map(({ hash }) => {
      return hash;
    }),
  );
}

/**
 * The one gate every leaving file passes. `pass` returns the text to write, or
 * null when the file may not leave; `problemList` says why, by path and line.
 */
export function createFileGate({
  homeDirList = [os.homedir()],
  gitEmail = readGitUserEmail(),
  fixtureHashSet = readSecretFixtureHashSet(),
} = {}) {
  const anyHomePatternList = genHomePathPatternList(homeDirList);
  const ownHomePatternList = genHomePathPatternList(homeDirList, {
    isAnyHomeIncluded: false,
  });
  const problemList = [];
  let redactedFileCount = 0;
  return {
    problemList,
    getRedactedFileCount() {
      return redactedFileCount;
    },
    pass(relPath, buffer) {
      if (!checkIsTextBuffer(buffer)) {
        problemList.push(`${relPath}: not text`);
        return null;
      }
      const text = buffer.toString('utf8');
      let redactedText = text;
      if (checkIsProseFile(relPath)) {
        redactedText = redactHomePaths(text, anyHomePatternList);
        if (redactedText !== text) {
          redactedFileCount += 1;
        }
      } else {
        // Code and data leave byte for byte: a rewritten fixture path is a
        // test about something else (2026-11-13, two shipped tests failed on
        // their own `C:\Users\me\...` written `~`).
        for (const line of findPatternLines(text, ownHomePatternList)) {
          problemList.push(
            `${relPath}:${line}: the builder's home folder -- write a ` +
              'made-up path there',
          );
        }
      }
      for (const hit of findSecrets(redactedText, { fixtureHashSet })) {
        problemList.push(
          `${relPath}:${hit.line}: ${hit.pattern} (fixture hash ${hit.hash})`,
        );
      }
      for (const line of findTextLines(redactedText, gitEmail)) {
        problemList.push(`${relPath}:${line}: the git user's email address`);
      }
      return redactedText;
    },
  };
}

function walkFiles(rootDir, dirPath = rootDir) {
  const filePathList = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      filePathList.push(...walkFiles(rootDir, entryPath));
    } else if (entry.isFile()) {
      filePathList.push(toPosixPath(path.relative(rootDir, entryPath)));
    }
  }
  return filePathList;
}

function writeTreeFile(outDir, relPath, text) {
  const outPath = path.join(outDir, ...relPath.split('/'));
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
}

/** The knowledge bundle, built for this tree alone (`--out`). */
function buildKnowledgeInto(knowledgeDir) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(REPO_ROOT, 'extra-work', 'build-knowledge.mjs'),
      `--out=${knowledgeDir}`,
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(
      `The knowledge bundle did not build:\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim().split('\n').pop();
}

/**
 * Every module the tree's `.mjs` files name must be in it: a relative import
 * resolves to a file of the tree, a bare one is Node's or a declared
 * dependency. A missing file here is a server that dies on its first call.
 */
export function checkImportClosure(
  treeDir,
  relPathList,
  { dependencyNameList = MCP_DEPENDENCY_NAME_LIST } = {},
) {
  const relPathSet = new Set(relPathList);
  const problemList = [];
  for (const relPath of relPathList) {
    if (!relPath.endsWith('.mjs')) {
      continue;
    }
    const source = readFileSync(path.join(treeDir, relPath), 'utf8');
    for (const specifier of listModuleSpecifiers(source)) {
      if (specifier.startsWith('.')) {
        const target = toPosixPath(
          path.posix.normalize(
            path.posix.join(path.posix.dirname(relPath), specifier),
          ),
        );
        if (!relPathSet.has(target)) {
          problemList.push(`${relPath}: imports ${specifier}, not in the tree`);
        }
      } else if (
        !checkIsBuiltinSpecifier(specifier) &&
        !dependencyNameList.includes(toPackageName(specifier))
      ) {
        problemList.push(
          `${relPath}: imports "${specifier}", not a declared dependency`,
        );
      }
    }
  }
  return problemList;
}

/**
 * Writes the runtime tree into `outDir` (which must not exist yet, or be
 * empty), plus `extraFileList` -- repository files the npm package carries
 * besides (its tests, types, the robot-test skill) -- through the same gate.
 * Throws with every problem at once; returns what it wrote.
 */
export function stageMcpRuntimeTree(
  outDir,
  { extraFileList = [], log = console.log, gate = createFileGate() } = {},
) {
  if (existsSync(outDir) && readdirSync(outDir).length > 0) {
    throw new Error(`"${outDir}" is not empty`);
  }
  const relativeOut = path.relative(REPO_ROOT, outDir);
  if (!relativeOut.startsWith('..') && !path.isAbsolute(relativeOut)) {
    throw new Error(`"${outDir}" is inside the repository`);
  }
  mkdirSync(outDir, { recursive: true });

  const packageCodeSet = new Set(
    listPackageCodes({ isEnglishIncluded: false }),
  );
  const runtimeFileList = selectRuntimeTreeFiles(
    listRepoFiles([MCP_DIR, MANUAL_DIR, ENGLISH_DATA_DIR, ONLINE_DATA_DIR]),
    { packageCodeSet },
  );
  const extraSet = new Set(extraFileList.map(toPosixPath));
  for (const relPath of runtimeFileList) {
    extraSet.delete(relPath);
  }
  const copiedFileList = [...runtimeFileList, ...[...extraSet].sort()];
  for (const relPath of copiedFileList) {
    const text = gate.pass(
      relPath,
      readFileSync(path.join(REPO_ROOT, ...relPath.split('/'))),
    );
    if (text !== null) {
      writeTreeFile(outDir, relPath, text);
    }
  }

  // The app version this server is made from, beside it: `owa_app_state`
  // and `owa_choose_app` compare it with the app they drive -- they should
  // match for the best result (`mcpVersion.mjs`). Generated, so it passes
  // no gate: a version string is all it holds.
  const appVersion = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
  ).version;
  writeTreeFile(
    outDir,
    `${MCP_DIR}/${MCP_VERSION_FILE_NAME}`,
    genMcpVersionFileText(appVersion),
  );

  const knowledgeDir = path.join(outDir, ...KNOWLEDGE_DIR.split('/'));
  const knowledgeLine = buildKnowledgeInto(knowledgeDir);
  const knowledgeFileList = walkFiles(knowledgeDir).map((relPath) => {
    return `${KNOWLEDGE_DIR}/${relPath}`;
  });
  for (const relPath of knowledgeFileList) {
    const filePath = path.join(outDir, ...relPath.split('/'));
    const text = gate.pass(relPath, readFileSync(filePath));
    if (text === null) {
      rmSync(filePath, { force: true });
    } else {
      writeFileSync(filePath, text);
    }
  }

  const treeFileList = [...copiedFileList, ...knowledgeFileList].sort();
  const problemList = [
    ...gate.problemList,
    ...checkImportClosure(
      outDir,
      treeFileList.filter((relPath) => {
        return runtimeFileList.includes(relPath);
      }),
    ),
  ];
  if (problemList.length > 0) {
    throw new Error(
      `${problemList.length} file problem(s) stop the MCP tree:\n` +
        problemList
          .slice(0, 60)
          .map((problem) => {
            return `  ${problem}`;
          })
          .join('\n') +
        (problemList.length > 60
          ? `\n  ... ${problemList.length - 60} more`
          : ''),
    );
  }
  log(
    `MCP runtime tree: ${runtimeFileList.length} files, ` +
      `${extraSet.size} extra, ${knowledgeFileList.length} knowledge ` +
      `(${gate.getRedactedFileCount()} with a home folder written ~)`,
  );
  log(`  ${knowledgeLine}`);
  return {
    runtimeFileList,
    extraFileList: [...extraSet].sort(),
    knowledgeFileList,
    packageCodeList: [...packageCodeSet].sort(),
  };
}
