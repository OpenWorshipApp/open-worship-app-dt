import { describe, expect, test } from 'vitest';

import { redactSecrets } from '../../tools/owa-devtools-mcp/firewall.mjs';
import {
  MCP_DIR,
  SEA_FUSE,
  SEA_LAUNCH_SOURCE,
  SEA_MAIN_SOURCE,
  checkDistOutDir,
  checkIsBuiltinSpecifier,
  checkIsEnglishDataFile,
  checkIsLangPackageTextFile,
  checkIsMcpRuntimeFile,
  checkIsPlaceholderSecret,
  checkIsProseFile,
  checkIsTextBuffer,
  checkNodeForSea,
  findPatternLines,
  findSecrets,
  findTextLines,
  genExecutableReadme,
  genHomePathPatternList,
  genSeaConfig,
  hashSecretValue,
  listModuleSpecifiers,
  listTestPackageNames,
  redactHomePaths,
  selectRuntimeTreeFiles,
  toMcpExecutableName,
  toNpmVersion,
  toPackageName,
} from './mcpDistHelpers.mjs';

// A made-up package code, as every language-agnostic test here uses.
const CODE = 'xx';
const PACKAGE_CODE_SET = new Set([CODE]);
const ONLINE = 'src/lang/data/online';

describe('what the runtime tree takes', () => {
  test('the server, never its tests, types or live probe', () => {
    expect(checkIsMcpRuntimeFile(`${MCP_DIR}/server.mjs`)).toBe(true);
    expect(checkIsMcpRuntimeFile(`${MCP_DIR}/questions/common.json`)).toBe(
      true,
    );
    expect(checkIsMcpRuntimeFile(`${MCP_DIR}/server.test.mjs`)).toBe(false);
    expect(checkIsMcpRuntimeFile(`${MCP_DIR}/index.d.mts`)).toBe(false);
    expect(checkIsMcpRuntimeFile(`${MCP_DIR}/probe-mcp.mjs`)).toBe(false);
    expect(checkIsMcpRuntimeFile('tools/other/server.mjs')).toBe(false);
  });

  test("English's top-level tables only", () => {
    expect(checkIsEnglishDataFile('src/lang/data/en/world.json')).toBe(true);
    expect(
      checkIsEnglishDataFile(
        'src/lang/data/en/location-name-map-data/namesMap.json',
      ),
    ).toBe(false);
    expect(checkIsEnglishDataFile('src/lang/data/en/index.ts')).toBe(false);
    expect(checkIsEnglishDataFile('src/lang/data/en/bb-cr.gz.bundle')).toBe(
      false,
    );
  });

  test("a language package's text, without code, tests, fonts or datasets", () => {
    const take = (inner) => {
      return checkIsLangPackageTextFile(
        `${ONLINE}/${CODE}/${inner}`,
        PACKAGE_CODE_SET,
      );
    };
    expect(take('dictionary.json')).toBe(true);
    expect(take('manual/presenter/w-01.md')).toBe(true);
    expect(take('manual/index.json')).toBe(true);
    expect(take('chatbot-asks/asks.json')).toBe(true);
    expect(take('flag.svg')).toBe(false);
    expect(take('bb-cr.gz.bundle')).toBe(false);
    expect(take('openLyricPlugin.ts')).toBe(false);
    expect(take('package.json')).toBe(false);
    expect(take('package-lock.json')).toBe(false);
    expect(take('.npmrc')).toBe(false);
    expect(take('tests/chatbot/x.test.ts')).toBe(false);
    expect(take('tests/chatbot/asks.json')).toBe(false);
    expect(take('fonts/face.json')).toBe(false);
    expect(take('location-name-map-data/namesMap.json')).toBe(false);
    expect(take('node_modules/plugin/package.json')).toBe(false);
    expect(take('experiment/notes.md')).toBe(false);
    expect(
      checkIsLangPackageTextFile(`${ONLINE}/README.md`, PACKAGE_CODE_SET),
    ).toBe(true);
    expect(
      checkIsLangPackageTextFile(
        `${ONLINE}/onlineLangPackage.ts`,
        PACKAGE_CODE_SET,
      ),
    ).toBe(false);
    // A folder with no dictionary is no package.
    expect(
      checkIsLangPackageTextFile(`${ONLINE}/yy/meta.json`, PACKAGE_CODE_SET),
    ).toBe(false);
  });

  test('the selection is sorted, unique and posix', () => {
    const selected = selectRuntimeTreeFiles(
      [
        `${MCP_DIR}\\server.mjs`,
        `${MCP_DIR}/server.mjs`,
        'docs/manual-sources/presenter/w-01.md',
        'docs/manual-sources/images/a.png',
        'src/lang/data/en/meta.json',
        `${ONLINE}/${CODE}/meta.json`,
        'src/other.ts',
      ],
      { packageCodeSet: PACKAGE_CODE_SET },
    );
    expect(selected).toEqual([
      'docs/manual-sources/presenter/w-01.md',
      'src/lang/data/en/meta.json',
      `${ONLINE}/${CODE}/meta.json`,
      `${MCP_DIR}/server.mjs`,
    ]);
  });
});

describe('what may leave', () => {
  test('text only', () => {
    expect(checkIsTextBuffer(Buffer.from('plain words\n'))).toBe(true);
    expect(checkIsTextBuffer(Buffer.from([0x61, 0x00, 0x62]))).toBe(false);
    expect(checkIsTextBuffer(Buffer.from([0xff, 0xfe, 0x41]))).toBe(false);
  });

  test("a home folder is written ~, the builder's and anybody's", () => {
    const patternList = genHomePathPatternList(['/Users/builder']);
    const redact = (text) => {
      return redactHomePaths(text, patternList);
    };
    expect(redact('see /Users/builder/Desktop/app.')).toBe(
      'see ~/Desktop/app.',
    );
    expect(redact('at /Users/builder.')).toBe('at ~.');
    expect(redact('"C:\\\\Users\\\\someone\\\\AppData"')).toBe(
      '"~\\\\AppData"',
    );
    expect(redact('C:\\Users\\someone\\AppData')).toBe('~\\AppData');
    expect(redact('/home/runner/work')).toBe('~/work');
    // Shared folders, addresses and a longer name are left alone.
    expect(redact('C:\\Users\\Public\\Documents')).toBe(
      'C:\\Users\\Public\\Documents',
    );
    expect(redact('/Users/Shared/data')).toBe('/Users/Shared/data');
    expect(redact('https://example.com/home/page')).toBe(
      'https://example.com/home/page',
    );
    expect(redact('/Users/builderx/a')).toBe('~/a');
    expect(redact('no paths here')).toBe('no paths here');
  });

  test("a Windows builder's home in every spelling", () => {
    const patternList = genHomePathPatternList(['C:\\Users\\Builder']);
    expect(redactHomePaths('c:\\users\\builder\\x', patternList)).toBe('~\\x');
    expect(redactHomePaths('C:/Users/Builder/x', patternList)).toBe('~/x');
  });

  test('only prose is rewritten; code is judged by the builder home alone', () => {
    expect(checkIsProseFile('.claude/skills/x/SKILL.md')).toBe(true);
    expect(checkIsProseFile('src/lang/data/online/xx/notes.txt')).toBe(true);
    expect(checkIsProseFile('electron-build/knowledge/index.json')).toBe(true);
    expect(checkIsProseFile('tools/owa-devtools-mcp/domMatch.test.mjs')).toBe(
      false,
    );
    expect(checkIsProseFile('src/lang/data/en/world.json')).toBe(false);

    const ownList = genHomePathPatternList(['/Users/builder'], {
      isAnyHomeIncluded: false,
    });
    expect(ownList).toHaveLength(1);
    // A test's made-up home is its input, never the builder's.
    const fixture = "label('Grace C:\\\\Users\\\\me\\\\Grace.owl')\n";
    expect(findPatternLines(fixture, ownList)).toEqual([]);
    expect(
      findPatternLines('a\nread("/Users/builder/x")\n/USERS/BUILDER', ownList),
    ).toEqual([2, 3]);
    // The g flag of a shared pattern does not make a second line miss.
    expect(
      findPatternLines('/Users/builder/a\n/Users/builder/b', ownList),
    ).toEqual([1, 2]);
  });

  test('every credential the firewall scrubs, the scan finds too', () => {
    const realLooking = [
      `sk-proj-${'aB3dE5fG7hJ9kL1mN2pQ4rS6tU8vW0x'}`,
      `ABSK${'QmVkcm9ja0FQSUtleS1hYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0'}`,
      `bedrock-api-key-${'YmVkcm9jay5hbWF6b25hd3MuY29tLz9BY3Rpb249'}&Version=1`,
      `eyJhbGciOiJIUzI1NiJ9.${'eyJzdWIiOiIxMjM0NTY3ODkwIn0'}.${'SflKxwRJSMeKKF2QT4fwpM'}`,
      `Bearer ${'Zx81Kq0LmN7pR2sT5uV9wY3a'}`,
    ];
    for (const secret of realLooking) {
      expect(redactSecrets(`value ${secret} end`)).not.toContain(secret);
      expect(findSecrets(`value ${secret} end`)).toHaveLength(1);
    }
  });

  test('a hit says where and what, never the value', () => {
    const secret = `ghp_${'q8W3e7R1t5Y9u2I6o0P4a8S3d7F1g5H9j2K6'}`;
    const [hit] = findSecrets(`line one\ntoken ${secret}`);
    expect(hit).toEqual({
      line: 2,
      pattern: 'GitHub token',
      hash: hashSecretValue(secret),
    });
    expect(JSON.stringify(hit)).not.toContain(secret);
  });

  test('a made-up credential or a recorded fixture is not a hit', () => {
    expect(checkIsPlaceholderSecret(`sk-ant-api03-${'A'.repeat(24)}`)).toBe(
      true,
    );
    expect(checkIsPlaceholderSecret(`Bearer ${'x'.repeat(20)}`)).toBe(true);
    expect(findSecrets(`key sk-${'B'.repeat(26)}`)).toEqual([]);
    const fixture = `eyJhbGciOiJub25lIn0.${'eyJzdWIiOiJ0ZXN0In0'}.${'c2lnbmF0dXJlMTIz'}`;
    expect(findSecrets(fixture)).toHaveLength(1);
    expect(
      findSecrets(fixture, {
        fixtureHashSet: new Set([hashSecretValue(fixture)]),
      }),
    ).toEqual([]);
  });

  test('an address is found by line, in any case', () => {
    expect(
      findTextLines('a\nMail: Someone@Example.org\nb', 'someone@example.org'),
    ).toEqual([2]);
    expect(findTextLines('a\nb', null)).toEqual([]);
  });
});

describe('versions and folders', () => {
  test("npm's version of the app's", () => {
    expect(toNpmVersion('2026.11.02')).toBe('2026.11.2');
    expect(toNpmVersion('2026.01.10')).toBe('2026.1.10');
    expect(toNpmVersion('1.2.3-beta.1')).toBe('1.2.3-beta.1');
    expect(() => {
      return toNpmVersion('2026.11');
    }).toThrow(/Not a version/);
  });

  test('the dist folder is never the repository, nor around it', () => {
    const base = { repoRoot: '/work/app' };
    expect(checkDistOutDir({ ...base, outDir: '/work/app' }).isOk).toBe(false);
    expect(checkDistOutDir({ ...base, outDir: '/work/app/dist' }).isOk).toBe(
      false,
    );
    expect(checkDistOutDir({ ...base, outDir: '/work' }).isOk).toBe(false);
    expect(checkDistOutDir({ ...base, outDir: '/work/app-mcp' }).isOk).toBe(
      true,
    );
  });

  test("a folder is written only when fresh or this builder's", () => {
    const base = { repoRoot: '/work/app', outDir: '/work/mcp' };
    expect(
      checkDistOutDir({ ...base, entryNameList: ['.git', 'README.md'] }),
    ).toEqual({ isOk: true, ownedEntryList: [] });
    expect(
      checkDistOutDir({ ...base, entryNameList: ['.git', 'src'] }).isOk,
    ).toBe(false);
    expect(
      checkDistOutDir({ ...base, packageJson: { name: 'another' } }).isOk,
    ).toBe(false);
    expect(
      checkDistOutDir({
        ...base,
        entryNameList: ['tools', 'CHANGELOG.md'],
        packageJson: { name: 'open-worship-app-mcp' },
        manifest: { owned: ['tools'] },
      }),
    ).toEqual({ isOk: true, ownedEntryList: ['tools'] });
  });
});

describe('modules', () => {
  test('every literal import a source names', () => {
    const source = [
      "import fs from 'node:fs';",
      'import {',
      '  a,',
      '  b,',
      "} from './local.mjs';",
      "export * from './again.mjs';",
      "import data from '../../src/lang/data/en/world.json' with { type: 'json' };",
      "import 'side-effect';",
      "const later = await import('chrome-devtools-mcp/build/src/x.js');",
      'const dynamic = await import(`./${name}.mjs`);',
      "const words = 'imported from a file';",
    ].join('\n');
    expect(listModuleSpecifiers(source).sort()).toEqual(
      [
        'node:fs',
        './local.mjs',
        './again.mjs',
        '../../src/lang/data/en/world.json',
        'side-effect',
        'chrome-devtools-mcp/build/src/x.js',
      ].sort(),
    );
  });

  test('package names and built-ins', () => {
    expect(toPackageName('chrome-devtools-mcp/build/src/a.js')).toBe(
      'chrome-devtools-mcp',
    );
    expect(toPackageName('@scope/name/deep')).toBe('@scope/name');
    expect(checkIsBuiltinSpecifier('node:fs')).toBe(true);
    expect(checkIsBuiltinSpecifier('fs/promises')).toBe(true);
    expect(checkIsBuiltinSpecifier('ws')).toBe(false);
  });

  test('what a test needs by name: its imports and its environment', () => {
    const source = [
      '// @vitest-environment jsdom',
      "import { describe } from 'vitest';",
      "import { readFileSync } from 'node:fs';",
      "import { a } from './near.mjs';",
      "import lyric from 'open-lyric/build/x.js';",
    ].join('\n');
    expect(listTestPackageNames(source)).toEqual([
      'jsdom',
      'open-lyric',
      'vitest',
    ]);
  });

  test('each environment as vitest loads it, the first comment only', () => {
    const withEnvironment = (name) => {
      return listTestPackageNames(`/** @vitest-environment ${name} */`);
    };
    expect(withEnvironment('node')).toEqual([]);
    expect(withEnvironment('happy-dom')).toEqual(['happy-dom']);
    expect(withEnvironment('edge-runtime')).toEqual(['@edge-runtime/vm']);
    expect(withEnvironment('custom')).toEqual(['vitest-environment-custom']);
    expect(withEnvironment('constructor')).toEqual([
      'vitest-environment-constructor',
    ]);
    expect(
      listTestPackageNames(
        '// @jest-environment node\n// @vitest-environment jsdom\n',
      ),
    ).toEqual([]);
    expect(listTestPackageNames("import x from 'vitest';")).toEqual(['vitest']);
  });
});

describe('the single executable', () => {
  test('its bootstrap hands over to the launcher beside it', () => {
    expect(SEA_MAIN_SOURCE).toContain('createRequire(process.execPath)');
    expect(SEA_MAIN_SOURCE).toContain("'launch.cjs'");
    expect(SEA_LAUNCH_SOURCE).toContain(
      "path.join(__dirname, 'tools', 'owa-devtools-mcp', 'bin.mjs')",
    );
    expect(genSeaConfig({ mainPath: 'm.cjs', outputPath: 'o' })).toEqual({
      main: 'm.cjs',
      output: 'o',
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    });
    expect(toMcpExecutableName(true)).toBe('open-worship-app-mcp.exe');
    expect(toMcpExecutableName(false)).toBe('open-worship-app-mcp');
    expect(SEA_FUSE).toMatch(/^NODE_SEA_FUSE_[0-9a-f]{32}$/);
  });

  test('only an official, static, new enough Node', () => {
    const official = {
      version: '26.13.1',
      release: { name: 'node' },
      config: {
        variables: {
          single_executable_application: true,
          node_shared: false,
          node_shared_openssl: false,
          node_shared_gtest_libraries: '',
        },
      },
      hasFuse: true,
    };
    expect(checkNodeForSea(official)).toEqual({ isUsable: true, reason: null });
    expect(checkNodeForSea({ ...official, version: '22.11.0' }).isUsable).toBe(
      false,
    );
    expect(checkNodeForSea({ ...official, hasFuse: false }).isUsable).toBe(
      false,
    );
    expect(
      checkNodeForSea({ ...official, release: { name: 'io.js' } }).isUsable,
    ).toBe(false);
    const shared = checkNodeForSea({
      ...official,
      config: { variables: { node_shared_libuv: true } },
    });
    expect(shared.isUsable).toBe(false);
    expect(shared.reason).toContain('node_shared_libuv');
    expect(
      checkNodeForSea({
        ...official,
        config: { variables: { single_executable_application: false } },
      }).isUsable,
    ).toBe(false);
  });

  test("the pack's README names the program, the npm twin and the licenses", () => {
    const args = {
      exeName: 'open-worship-app-mcp.exe',
      packVersion: '0.0.6',
      platform: 'win',
      appVersion: '2026.11.02',
      nodeVersion: '26.13.1',
      toolCount: 74,
      hasNodeLicense: true,
    };
    const readme = genExecutableReadme(args);
    expect(readme).toContain(
      'claude mcp add owa-devtools -- "<this folder>/open-worship-app-mcp.exe"',
    );
    expect(readme).toContain('npm package `open-worship-app-mcp`');
    expect(readme).toContain('Node.js 26.13.1');
    expect(readme).toContain('74 tools');
    expect(readme).toContain('Extra-bin pack 0.0.6 for `win`');
    expect(readme).toContain('`NODE-LICENSE`');
    expect(readme).toContain(
      '`launch.cjs` -- starts `tools/owa-devtools-mcp/bin.mjs`',
    );
    // The JSON a person copies out of it parses.
    const jsonText = readme
      .split('\n')
      .filter((line) => {
        return line.startsWith('    ');
      })
      .join('\n')
      .replace(/^[\s\S]*?(\{)/, '$1');
    expect(JSON.parse(jsonText)).toEqual({
      mcpServers: {
        'owa-devtools': {
          command: '<this folder>/open-worship-app-mcp.exe',
        },
      },
    });
    const withoutLicense = genExecutableReadme({
      ...args,
      hasNodeLicense: false,
    });
    expect(withoutLicense).not.toContain('`NODE-LICENSE`');
    expect(withoutLicense).toContain(
      'https://github.com/nodejs/node/blob/v26.13.1/LICENSE',
    );
  });
});
