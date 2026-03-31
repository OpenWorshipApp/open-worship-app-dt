# Open Worship app

**PSA.150.6 — Praise the Lord** 🙏

[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.en.html)
[![GitHub issues](https://img.shields.io/github/issues/OpenWorshipApp/open-worship-app-dt)](https://github.com/OpenWorshipApp/open-worship-app-dt/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/OpenWorshipApp/open-worship-app-dt/pulls)

> A simple PC cross-platform, **free** and **open-source**, presentation plus bible-studying app for churches. Built to run offline on lower-spec PCs to help budget-conscious churches.

Main Goals:
- **Portable** — No installation required, run from any folder
- **Cross-Platform** — Windows, macOS, and Linux support
- **Fast** — Optimized for low-spec machines
- **Privacy-Focused** — No data collection or tracking
- **Freedom for Worship** — Empowering churches with unrestricted access to digital worship tools
- **Bible Study Tools** — Save time with powerful search, cross-references, and study aids

<p align="center">
  <img src="screenshots/Screenshot 2025-11-25 at 10.41.36 PM.png" alt="Presenter" width="700">
</p>

<summary>📸 <strong>More Screenshots</strong></summary>
<br>

<p align="center">
  <img src="screenshots/Screenshot 2025-11-30 at 1.22.40 PM.png" alt="Bible Study Dark" width="600">
</p>

<p align="center">
  <img src="screenshots/Screenshot 2025-11-25 at 10.37.31 PM.png" alt="Bible Study Light" width="600">
</p>

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [📋 Requirements](#-requirements)
- [🚀 Quick Start](#-quick-start)
- [📦 Building for Production](#-building-for-production)
- [🧹 Linting and Formatting](#-linting-and-formatting)
- [🕸️ Dependencies Troubleshooting](#️-dependencies-troubleshooting)
- [🤝 Contributing](#-contributing)
- [💡 About This Project](#-about-this-project)
- [📄 License](#-license)

---

## ✨ Features

- 📚 **Bible Study** — Search, highlight, and lookup
- 🔍 **Fast Bible Search** — Lightning-quick verse lookup and advanced search capabilities
- 📖 **Bible Presentation** — Display verses and passages on screen for congregation
- 📖 **Parallel Bible Display** — Show multiple Bible translations side-by-side on presentation screen
- 🎨 **Slide Creation & Presentation** — Create, edit, and present custom slides with text, images, and media
- 📄 **PDF Support** — View and present PDF documents during services
- 📊 **PowerPoint Support** — Import and present Microsoft PowerPoint presentations directly
- 🌐 **Network Sharing** — Share files and chat with devices
- 🎵 **Lyric Presentation** — Display song lyrics and hymns with customizable formatting
- 🖼️ **Media Support** — Images, videos, and backgrounds
- 📺 **Multi-Display** — Separate presenter and audience views
- 🎨 **Customizable** — Themes, fonts, and layouts
- 💾 **Offline Ready** — Works without internet connection
- 📺 **Video and Audio Download** — Download videos and audios from the internet instantly for offline presentation

Other Features:
- ✂️ **Cut, Copy, Paste** — Standard editing features for text and slides
- 🔄 **Undo/Redo** — Easily revert or reapply changes
- 🔍 **Find in Page** — Find text within slides and documents
- ⏰ **Timer and Countdown** — Built-in timers for sermons, prayers, and service segments
- 📜 **Scrolling Messages** — Display scrolling marquee text for announcements and notices
- 🖱️ **Drag and Drop** — Easily arrange slides, import media files, and organize content by dragging and dropping
- 🖼️ **Dynamic Wallpaper Display** — Automatically cycle through background images
- And a lot more


Future Features:
- 🎵 **Dynamic Lyric Import** — Import song lyrics from various sources and formats
- 📖 **Dynamic Bible Import** — Import Bible translations from various sources and formats
- 🌍 **Multi-Language Support** — Interface and Bible translations in multiple languages
- 🔄 **Auto Updates** — Stay up-to-date with the latest features and improvements
- ☁️ **Cloud Data Sync** — Synchronize presentations, slides, and settings across multiple devices
- 🎮 **Interactive Bible Games** — Engaging games and quizzes to help memorize scripture and learn Bible context

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
- [dotnet 8.0 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) for MS PowerPoint support
- For Windows, [Cygwin](https://cygwin.com/) is needed. `Cygwin` through [Git](https://git-scm.com/) is recommended (by installing `Git` with `Git-bash` we will have all required commands installed)

For Fedora:
```bash
sudo dnf install libxcrypt-compat
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

The app will launch in development mode with hot reload enabled.

---

## 📦 Building for Production

### Windows
```bash
npm run pack:win
```
> **Note:** Developer mode must be enabled. [Learn more](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development)

### macOS
```bash
# Standard build
npm run pack:mac

# Universal build (Intel + Apple Silicon)
npm run pack:mac:uni
```

### Linux
```bash
npm run pack:linux
```

---

## 🧹 Linting and Formatting

Run code quality checks and formatting:

Run code quality checks and formatting:

```bash
# Pre-commit checks
npm run lint:pre

# ESLint
npm run lint:es

# All linting
npm run lint
```

---

## 🕸️ Dependencies Troubleshooting

Check for dependency issues:

```bash
npm run dc:err
```

### Common Issues

<details>
<summary><strong>NuGet Package Source Error</strong></summary>

If you encounter errors during `npm install` related to NuGet packages not being resolved:

```bash
dotnet nuget add source https://api.nuget.org/v3/index.json --name nuget.org
npm install
```

</details>

<details>
<summary><strong>Fedora Dependencies</strong></summary>

```bash
sudo dnf install libxcrypt-compat
```

</details>

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

### Getting Started with Contributing

1. **🍴 Fork** this repository on GitHub

2. **📥 Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/open-worship-app-dt.git
   cd open-worship-app-dt
   ```

3. **📦 Install** dependencies:
   ```bash
   npm install
   ```

4. **🌿 Create a branch** for your feature:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```

5. **🔨 Make your changes** and test thoroughly:
   ```bash
   npm run dev
   ```

6. **✅ Commit** your changes:
   ```bash
   git add .
   git commit -m "Add: your descriptive commit message"
   ```

7. **🚀 Push** to your fork:
   ```bash
   git push origin feature/your-awesome-feature
   ```

8. **🎯 Create a Pull Request** on GitHub with a clear description

### 📌 Where to Start

- 🐛 Check [Issues](https://github.com/OpenWorshipApp/open-worship-app-dt/issues) for bugs to fix
- ✨ Look for issues labeled `good first issue` or `help wanted`
- 💡 Have an idea? Open a new issue to discuss it first

### 📝 Contribution Guidelines

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Test your changes before submitting
- Update documentation when adding new features
- Be respectful and constructive in discussions

---

## 💡 About This Project

> *"Let every thing that hath breath praise the LORD. Praise ye the LORD."*  
> — Psalm 150:6 (KJV)

### 🎯 Vision

We're building a powerful, easy-to-use, and **free** application for churches worldwide to use during worship services. This app will be **free forever** and completely **open-source**.

### 📊 Status

This project is under **active development** and approaching production-ready status. We're continuously improving and adding features — which is why your contributions matter so much!

### 🌟 Why This Project?

Many churches, especially in developing countries or smaller congregations, cannot afford expensive presentation software. This project aims to:

- ✅ Provide a **professional-grade** worship presentation tool
- ✅ Work **offline** on lower-spec computers
- ✅ Support **multiple languages** and Bible translations
- ✅ Remain **100% free** and open-source forever
- ✅ Empower churches to focus on worship, not technology costs

### 📞 Contact & Support

- 💬 **Questions or Ideas?** → [Open an Issue](https://github.com/OpenWorshipApp/open-worship-app-dt/issues)
- 🐛 **Found a Bug?** → [Report it](https://github.com/OpenWorshipApp/open-worship-app-dt/issues/new)
- 📧 **Email** → <owf2025@gmail.com>
- 💡 **Feature Requests** → [Share your ideas](https://github.com/OpenWorshipApp/open-worship-app-dt/issues/new)

---

🙏🏻 **May God bless you and everyone who contributes to this ministry** 🙏🏻

---

## 📄 License

[GNU General Public License v2.0](./LICENSE.txt)

---

<p align="center">
  Made with ❤️ in Christ for churches worldwide
</p>
