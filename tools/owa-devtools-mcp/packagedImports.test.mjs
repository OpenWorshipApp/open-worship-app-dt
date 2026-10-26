import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

// A packaged app loads this folder from `app.asar.unpacked`, and a bare import
// from there resolves against `app.asar.unpacked/node_modules` -- never inside
// the asar. Release 2026.10.24 packed `chrome-devtools-mcp` into the asar, so
// every chatbot question answered "The app's own help service did not
// respond" with ERR_MODULE_NOT_FOUND in the log. A dev run reads the checkout's
// `node_modules` and cannot see it.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PACKAGE = JSON.parse(
  readFileSync(path.join(HERE, '..', '..', 'package.json'), 'utf8'),
);

// The same exclusions as `build.files`.
function checkIsShipped(fileName) {
  return (
    fileName.endsWith('.mjs') &&
    !fileName.endsWith('.test.mjs') &&
    fileName !== 'probe-mcp.mjs'
  );
}

function toPackageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function listShippedPackageNames() {
  const pattern =
    /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const names = new Set();
  for (const fileName of readdirSync(HERE).filter(checkIsShipped)) {
    const text = readFileSync(path.join(HERE, fileName), 'utf8');
    for (const match of text.matchAll(pattern)) {
      const specifier = match[1] ?? match[2];
      if (!/^(?:\.|\/|node:)/.test(specifier)) {
        names.add(toPackageName(specifier));
      }
    }
  }
  return [...names].sort();
}

describe('a packaged app can load this package', () => {
  const packageNames = listShippedPackageNames();

  test('reads chrome-devtools-mcp, the import this test exists for', () => {
    expect(packageNames).toContain('chrome-devtools-mcp');
  });

  test('ships every package it imports', () => {
    const missing = packageNames.filter((name) => {
      return ROOT_PACKAGE.dependencies[name] === undefined;
    });
    expect(missing).toEqual([]);
  });

  test('unpacks every package it imports beside it', () => {
    const asarUnpack = ROOT_PACKAGE.build.asarUnpack;
    const packed = packageNames.filter((name) => {
      return !asarUnpack.includes(`node_modules/${name}/**/*`);
    });
    expect(packed).toEqual([]);
  });
});
