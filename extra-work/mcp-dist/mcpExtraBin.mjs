// The extra-bin pack's `mcp/` folder (pack 0.0.6 and later): the MCP runtime
// tree (`mcpRuntimeTree.mjs`, the very tree the npm package is made from), the
// two packages its modules import, the single executable over them
// (`mcpSea.mjs`) and a README. "As an AI user I want to install
// open-worship-app's extra-bin and have the executable mcp binary file ready"
// -- built when the pack is built, never committed, so it is always the
// server of the checkout that built the pack.
//
//   mcp/open-worship-app-mcp[.exe]  Node + a three-line start
//   mcp/launch.cjs                  starts tools/owa-devtools-mcp/bin.mjs
//   mcp/tools/ ...                  the runtime tree, as in the repository
//   mcp/node_modules/               chrome-devtools-mcp, ws
//   mcp/README.md, LICENSE.txt, NODE-LICENSE

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { listPackageCodes } from '../language-packages.mjs';
import {
  ENGLISH_DATA_DIR,
  MANUAL_DIR,
  MCP_DEPENDENCY_NAME_LIST,
  MCP_DIR,
  MCP_PACK_DIR_NAME,
  NODE_LICENSE_FILE_NAME,
  ONLINE_DATA_DIR,
  genExecutableReadme,
  selectRuntimeTreeFiles,
  toMcpExecutableName,
} from './mcpDistHelpers.mjs';
import {
  REPO_ROOT,
  listRepoFiles,
  readGitSource,
  stageMcpRuntimeTree,
} from './mcpRuntimeTree.mjs';
import { buildMcpExecutable, smokeTestMcpExecutable } from './mcpSea.mjs';

// Besides the tree's own sources: what its knowledge is built from and the
// scripts that build it.
const BUILD_INPUT_ROOT_LIST = [
  '.claude',
  'extra-work/build-knowledge.mjs',
  'extra-work/bibleNoteGuideHelpers.mjs',
  'extra-work/language-packages.mjs',
  'extra-work/mcp-dist',
];
// The knowledge bundle carries the installed Bible Note editor's own guide.
const VERSIONED_INPUT_PACKAGE_LIST = [
  ...MCP_DEPENDENCY_NAME_LIST,
  'bible-note',
];

function readInstalledVersion(packageName) {
  try {
    return JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, 'node_modules', packageName, 'package.json'),
        'utf8',
      ),
    ).version;
  } catch (_error) {
    return null;
  }
}

/**
 * One hash over everything `mcp/` is made from: the tree's sources, the notes
 * and scripts its knowledge comes from, the packages it carries and the Node
 * inside the executable. The pack is rebuilt when, and only when, it changes.
 * Content, not times: a checkout touches every time and changes nothing.
 */
export function digestMcpPackInputs() {
  const packageCodeSet = new Set(
    listPackageCodes({ isEnglishIncluded: false }),
  );
  const fileList = [
    ...selectRuntimeTreeFiles(
      listRepoFiles([MCP_DIR, MANUAL_DIR, ENGLISH_DATA_DIR, ONLINE_DATA_DIR]),
      { packageCodeSet },
    ),
    ...listRepoFiles(BUILD_INPUT_ROOT_LIST),
  ];
  const hash = createHash('sha256');
  for (const relPath of [...new Set(fileList)].sort()) {
    hash.update(`${relPath}\0`);
    hash.update(readFileSync(path.join(REPO_ROOT, ...relPath.split('/'))));
    hash.update('\0');
  }
  for (const packageName of VERSIONED_INPUT_PACKAGE_LIST) {
    hash.update(`${packageName}@${readInstalledVersion(packageName)}\0`);
  }
  hash.update(`node@${process.version} ${process.platform}-${process.arch}`);
  return hash.digest('hex').slice(0, 32);
}

/**
 * Node's own license, from beside the Node that becomes the executable: the
 * official tarball keeps it one folder up from `bin/node`, the Windows
 * installer beside `node.exe`.
 */
function findNodeLicensePath() {
  const nodeDir = path.dirname(process.execPath);
  return (
    [path.join(nodeDir, 'LICENSE'), path.join(nodeDir, '..', 'LICENSE')].find(
      (filePath) => {
        return existsSync(filePath);
      },
    ) ?? null
  );
}

function copyDependencies(treeDir) {
  for (const packageName of MCP_DEPENDENCY_NAME_LIST) {
    const sourceDir = path.join(REPO_ROOT, 'node_modules', packageName);
    if (!existsSync(path.join(sourceDir, 'package.json'))) {
      throw new Error(`"${packageName}" is not installed: run npm install`);
    }
    cpSync(sourceDir, path.join(treeDir, 'node_modules', packageName), {
      recursive: true,
      // A package's own nested node_modules would be another tree to vet.
      filter: (sourcePath) => {
        return !path
          .relative(sourceDir, sourcePath)
          .split(path.sep)
          .includes('node_modules');
      },
    });
  }
}

/**
 * Writes `<packStagingDir>/mcp` and starts the executable there exactly as a
 * client would, before the pack is made. Answers what `info.json` records.
 */
export async function stageMcpPackDir({
  packStagingDir,
  packVersion,
  platform,
  log = console.log,
}) {
  const appVersion = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'),
  ).version;
  const exeName = toMcpExecutableName(process.platform === 'win32');
  // Staged outside the repository (`stageMcpRuntimeTree` writes nowhere
  // inside it), then moved into the pack's staging folder.
  const workDir = mkdtempSync(path.join(os.tmpdir(), 'owa-mcp-pack-'));
  const treeDir = path.join(workDir, MCP_PACK_DIR_NAME);
  const packMcpDir = path.join(packStagingDir, MCP_PACK_DIR_NAME);
  try {
    stageMcpRuntimeTree(treeDir, { log });
    copyDependencies(treeDir);
    writeFileSync(
      path.join(treeDir, 'LICENSE.txt'),
      readFileSync(path.join(REPO_ROOT, 'LICENSE.txt')),
    );
    const nodeLicensePath = findNodeLicensePath();
    if (nodeLicensePath === null) {
      log(
        `WARNING: no LICENSE beside ${process.execPath}; the MCP README ` +
          "links Node.js's instead",
      );
    } else {
      writeFileSync(
        path.join(treeDir, NODE_LICENSE_FILE_NAME),
        readFileSync(nodeLicensePath),
      );
    }
    const built = await buildMcpExecutable({
      outFilePath: path.join(treeDir, exeName),
    });
    rmSync(packMcpDir, { recursive: true, force: true });
    mkdirSync(packStagingDir, { recursive: true });
    cpSync(treeDir, packMcpDir, { recursive: true });
    // Asked on the copy that is packed, not the one it was copied from.
    const handshake = await smokeTestMcpExecutable({
      exePath: path.join(packMcpDir, exeName),
    });
    writeFileSync(
      path.join(packMcpDir, 'README.md'),
      genExecutableReadme({
        exeName,
        packVersion,
        platform,
        appVersion,
        nodeVersion: built.nodeVersion,
        toolCount: handshake.tools.length,
        hasNodeLicense: nodeLicensePath !== null,
      }),
    );
    log(
      `"${MCP_PACK_DIR_NAME}/${exeName}" is staged (Node ${built.nodeVersion}, ` +
        `${built.method}, ${handshake.tools.length} tools answered)`,
    );
    return {
      exeName,
      appVersion,
      commit: readGitSource().commit,
      nodeVersion: built.nodeVersion,
      toolCount: handshake.tools.length,
    };
  } catch (error) {
    rmSync(packMcpDir, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
