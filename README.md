# OpenWorship app (PSA.150.6, Praise the Lord)

Simple all in one, free and open-source app for church.

<img src="screenshots/Screenshot 2025-03-05 at 11.02.34 PM.png" alt="Screenshot 2025-03-05 at 11.02.34 PM" style="max-width: 400px;">

<img src="screenshots/Screenshot 2025-04-04 220931.png" alt="Screenshot 2025-04-04 220931" style="max-width: 400px;">

## Tech Stack

- [Typescript](https://www.typescriptlang.org/)
- [React](https://reactjs.org/)
- [Electron](https://www.electronjs.org/)
- [Bootstrap](https://getbootstrap.com/)
- [SASS](https://sass-lang.com/)

Special thanks for others frameworks and tools in [npm package](./package.json)

## Requirements

- [Node.js v22](https://nodejs.org/en/download/) or higher
- [dotnet 8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
- For Windows, [Cygwin](https://cygwin.com/) is needed. `Cygwin` through [Git](https://git-scm.com/) is recommended (by installing `Git` with `Git-bash` we will have all required commands installed)

For Fedora:
```bash
sudo dnf install libxcrypt-compat
```


## Install

```bash
$ npm i
```

## Run

```bash
$ npm run dev
```

## Package

```bash
# for Windows x86_64 (need Developer mode enabled: "https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development")
> npm run pack:win

# for Apple Mac
$ npm run pack:mac
# universal package
$ npm run pack:mac:uni
```

## Linting and Formatting

```bash
npm run lint:pre
npm run lint:es
npm run lint
```

## Info

### FYI

- KJV: Psalm 150:6
  => Let every thing that hath breath Praise the LORD. Praise ye the LORD.
- I want to see an application very powerful, easy to use and free for everyone to do presentation during worship service.
- Thanks God for everything. I'm Raksa, the first creator and working alone on this project. But I'm alone cannot make this app possible for using for worship. May God bless this project through you.
- This app will be free forever and absolutely open-source.
- This is not ready to use yet, but I need many help.
- If you have any question or idea please share in [Issues](https://github.com/OpenWorshipApp/open-worship-app-dt/issues), or contact me at <eng.raksa@gmail.com> if you need more information
- 🙏🏻May God bless you🙏🏻

## Licence

GNU GENERAL PUBLIC LICENSE Version 2
