import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFile), '..');
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf-8'),
);
const packageName = packageJson.name;
const rpmVersion = normalizeRpmVersion(packageJson.version);
const appOutDir = join(repoRoot, 'release', 'linux-unpacked');
const iconPath = join(repoRoot, 'icon.png');
const licensePath = join(repoRoot, 'LICENSE.txt');
const rpmTopDir = join(repoRoot, 'extra-work', 'tmp', 'rpm-build');
const sourceArchiveName = `${packageName}-${rpmVersion}-linux-unpacked.tar.gz`;
const sourceArchivePath = join(rpmTopDir, 'SOURCES', sourceArchiveName);
const specPath = join(rpmTopDir, 'SPECS', `${packageName}.spec`);
const releaseRpmName = `${packageName}_${rpmVersion}_${getArtifactArch()}.rpm`;
const releaseRpmPath = join(repoRoot, 'release', releaseRpmName);

if (process.platform !== 'linux') {
  console.log('Skipping Fedora RPM package: not running on Linux.');
  process.exit(0);
}

if (!isFedoraBase()) {
  console.log(
    'Skipping Fedora RPM package: current Linux distribution is not Fedora-based.',
  );
  process.exit(0);
}

if (!existsSync(appOutDir)) {
  throw new Error(
    `Cannot build RPM package because ${appOutDir} does not exist.`,
  );
}

if (!commandExists('rpmbuild')) {
  throw new Error(
    'Cannot build RPM package because rpmbuild is not installed.',
  );
}

rmSync(rpmTopDir, { recursive: true, force: true });
for (const dirName of [
  'BUILD',
  'BUILDROOT',
  'RPMS',
  'SOURCES',
  'SPECS',
  'SRPMS',
]) {
  mkdirSync(join(rpmTopDir, dirName), { recursive: true });
}

execFileSync(
  'tar',
  [
    '-C',
    join(repoRoot, 'release'),
    '-czf',
    sourceArchivePath,
    'linux-unpacked',
  ],
  {
    stdio: 'inherit',
  },
);
copyFileSync(iconPath, join(rpmTopDir, 'SOURCES', 'icon.png'));
copyFileSync(licensePath, join(rpmTopDir, 'SOURCES', 'LICENSE.txt'));
writeSpecFile();

execFileSync(
  'rpmbuild',
  ['--define', `_topdir ${rpmTopDir}`, '-bb', specPath],
  {
    stdio: 'inherit',
  },
);

const rpmOutputPath = join(
  rpmTopDir,
  'RPMS',
  getRpmArch(),
  `${packageName}-${rpmVersion}-1${getDistTag()}.${getRpmArch()}.rpm`,
);

if (!existsSync(rpmOutputPath)) {
  throw new Error(
    `RPM build completed, but expected output was not found at ${rpmOutputPath}.`,
  );
}

copyFileSync(rpmOutputPath, releaseRpmPath);
rmSync(rpmTopDir, { recursive: true, force: true });
console.log(`Fedora RPM package written to ${releaseRpmPath}`);

function normalizeRpmVersion(version) {
  return version
    .split('.')
    .map((part) => String(Number(part)))
    .join('.');
}

function commandExists(command) {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isFedoraBase() {
  if (process.env.RELEASE_LINUX_IS_FEDORA === 'true') {
    return true;
  }

  if (!existsSync('/etc/os-release')) {
    return false;
  }

  const osRelease = parseOsRelease(readFileSync('/etc/os-release', 'utf-8'));
  const distroIds = [
    osRelease.ID,
    ...(osRelease.ID_LIKE || '').split(/\s+/),
  ].filter(Boolean);
  return distroIds.some((id) =>
    ['fedora', 'rhel', 'centos', 'rocky', 'almalinux'].includes(id),
  );
}

function parseOsRelease(content) {
  return Object.fromEntries(
    content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const key = line.slice(0, separatorIndex);
        const value = line.slice(separatorIndex + 1).replace(/^"|"$/g, '');
        return [key, value];
      }),
  );
}

function getArtifactArch() {
  if (process.arch === 'x64') {
    return 'x86_64';
  }
  if (process.arch === 'arm64') {
    return 'arm64';
  }
  return process.arch;
}

function getRpmArch() {
  if (process.arch === 'x64') {
    return 'x86_64';
  }
  if (process.arch === 'arm64') {
    return 'aarch64';
  }
  return process.arch;
}

function getDistTag() {
  try {
    return execFileSync('rpm', ['--eval', '%{?dist}'], {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

function writeSpecFile() {
  const spec = `Name:           ${packageName}
Version:        ${rpmVersion}
Release:        1%{?dist}
Summary:        ${packageJson.description}
License:        GPL-2.0-only
URL:            ${packageJson.homepage}
Source0:        ${sourceArchiveName}
Source1:        icon.png
Source2:        LICENSE.txt

%global debug_package %{nil}
%global _build_id_links none
%global __os_install_post %{nil}
AutoReqProv:    no

Requires:       gtk3
Requires:       libnotify
Requires:       nss
Requires:       libXScrnSaver
Requires:       libXtst
Requires:       xdg-utils
Requires:       at-spi2-core
Requires:       libuuid

%description
Open Worship app is an open-source desktop application for worship services.

%prep
%setup -q -c -T
tar -xzf %{SOURCE0}

%build

%install
rm -rf %{buildroot}
install -d %{buildroot}/opt/OpenWorshipApp
cp -a linux-unpacked/. %{buildroot}/opt/OpenWorshipApp/
chmod 4755 %{buildroot}/opt/OpenWorshipApp/chrome-sandbox

install -d %{buildroot}%{_bindir}
ln -s ../../opt/OpenWorshipApp/open-worship-app %{buildroot}%{_bindir}/open-worship-app

install -d %{buildroot}%{_datadir}/applications
cat > %{buildroot}%{_datadir}/applications/${packageName}.desktop <<'EOF'
[Desktop Entry]
Name=${packageJson.build.productName}
Exec=/opt/OpenWorshipApp/open-worship-app %U
Icon=${packageName}
Type=Application
Terminal=false
Categories=AudioVideo;Presentation;
StartupWMClass=${packageJson.build.productName}
EOF

install -d %{buildroot}%{_datadir}/icons/hicolor/512x512/apps
install -m 0644 %{SOURCE1} %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/${packageName}.png

install -d %{buildroot}%{_licensedir}/%{name}
install -m 0644 %{SOURCE2} %{buildroot}%{_licensedir}/%{name}/LICENSE.txt

%files
%defattr(-,root,root,-)
/opt/OpenWorshipApp
%{_bindir}/open-worship-app
%{_datadir}/applications/${packageName}.desktop
%{_datadir}/icons/hicolor/512x512/apps/${packageName}.png
%license %{_licensedir}/%{name}/LICENSE.txt

%changelog
* Sun May 17 2026 ${packageJson.author} - ${rpmVersion}-1
- Build RPM package from Electron Linux unpacked payload.
`;
  writeFileSync(specPath, spec);
}
