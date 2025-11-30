# Open Worship App

**PSA.150.6 — Praise the Lord** 🙏

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)
[![GitHub issues](https://img.shields.io/github/issues/OpenWorshipApp/open-worship-app-dt)](https://github.com/OpenWorshipApp/open-worship-app-dt/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/OpenWorshipApp/open-worship-app-dt/pulls)

> A simple, all-in-one, **free** and **open-source** presentation app for churches.

<p align="center">
  <img src="screenshots/Screenshot 2025-11-25 at 10.41.36 PM.png" alt="Main Interface" width="600">
</p>

<summary>📸 More Screenshots</summary>

<p align="center">
  <img src="screenshots/Screenshot 2025-11-30 at 1.22.40 PM.png" alt="Screenshot 2" width="500">
</p>

<p align="center">
  <img src="screenshots/Screenshot 2025-11-25 at 10.37.31 PM.png" alt="Screenshot 3" width="500">
</p>

---

## ✨ Features

- 📖 **Bible Display** — Show scripture verses with multiple translations
- 🎵 **Lyrics Presentation** — Display song lyrics with easy navigation
- 🖼️ **Media Support** — Images, videos, and backgrounds
- 📺 **Multi-Display** — Separate presenter and audience views
- 🎨 **Customizable** — Themes, fonts, and layouts
- 💾 **Offline Ready** — Works without internet connection

---

## 🛠️ Tech Stack

- [Typescript](https://www.typescriptlang.org/)
- [React](https://reactjs.org/)
- [Electron](https://www.electronjs.org/)
- [Bootstrap](https://getbootstrap.com/)
- [SASS](https://sass-lang.com/)

Special thanks to all frameworks and tools listed in [package.json](./package.json)

---

## 📋 Requirements

- [Node.js v22](https://nodejs.org/en/download/) or higher
- [dotnet 8.0](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
- For Windows, [Cygwin](https://cygwin.com/) is needed. `Cygwin` through [Git](https://git-scm.com/) is recommended (by installing `Git` with `Git-bash` we will have all required commands installed)

For Fedora:
```bash
sudo dnf install libxcrypt-compat
```

---

## 🚀 Quick Start

### Install

```bash
npm i
```

### Run

```bash
npm run dev
```

---

## 📦 Building for Production

```bash
# Windows x86_64 (Developer mode required)
# See: https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development
npm run pack:win

# macOS
npm run pack:mac

# Linux
npm run pack:linux

```

## 🧹 Linting and Formatting

```bash
npm run lint:pre
npm run lint:es
npm run lint
```


## 🕸️ Dependencies Troubleshooting

```bash
npm run dc:err
```

---

## 🤝 Contributing

**Your help is needed and appreciated!** 🙌

This project is open-source and actively growing. Whether you're a developer, designer, tester, or just someone with great ideas — you can make a difference.

### Ways to Contribute

| Role | How You Can Help |
|------|------------------|
| 💻 **Developers** | Fix bugs, add features, improve performance |
| 🎨 **Designers** | Enhance UI/UX, create icons and graphics |
| 🧪 **Testers** | Try the app during real worship services, report issues |
| 📝 **Writers** | Improve docs, write tutorials, translate content |
| 💡 **Anyone** | Share ideas, report bugs, spread the word |
| 📚 **Translator** | Help translate the app and documentation into different languages |
| 𝌭 **Legal** | Assist with licensing, compliance, and legal documentation |
| Others | Any other skills you can offer! |

### Getting Started

1. **Fork** this repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/open-worship-app-dt.git
   cd open-worship-app-dt
   ```
3. **Install** dependencies and run:
   ```bash
   npm install
   npm run dev
   ```
4. **Create a branch**, make changes, and submit a **Pull Request**

Check out our [Issues](https://github.com/OpenWorshipApp/open-worship-app-dt/issues) for things to work on, or open a new issue with your idea!

---

## 💡 About This Project

> *"Let every thing that hath breath praise the LORD. Praise ye the LORD."*  
> — Psalm 150:6 (KJV)

### Vision

We want to build a powerful, easy-to-use, and **free** application for churches to use during worship services. This app will be **free forever** and completely **open-source**.

### Status

This project is under active development and not fully production-ready yet — which is exactly why your contributions matter so much!

### Contact

- 💬 Questions or ideas? → [Open an Issue](https://github.com/OpenWorshipApp/open-worship-app-dt/issues)
- 📧 Email → <owf2025@gmail.com>

🙏🏻 May God bless you and everyone 🙏🏻

---

## 📄 License

[GNU General Public License v2.0](./LICENSE.txt)

---

<p align="center">
  Made with ❤️ in Christ for churches worldwide
</p>
