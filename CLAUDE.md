# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**IMPORTANT**: This repository uses **pnpm** as the package manager. Always use `pnpm` commands instead of `npm` for all dependency operations.

## Build and Development Commands

### Development
```bash
pnpm start             # Start the application in development mode with hot reload
```

### Build and Package
```bash
pnpm package           # Package the application for distribution
pnpm make              # Build distributable packages for all platforms
pnpm make:mac          # Build distributable package for macOS only
```

### Code Quality
```bash
pnpm lint              # Run ESLint on all TypeScript and JavaScript files
```

### Package Management
```bash
pnpm install           # Install dependencies
pnpm add <package>     # Add new dependencies
pnpm remove <package>  # Remove dependencies
```

## Architecture Overview

This is an Electron-based desktop dictionary application built with React, TypeScript, and Webpack. The application follows a two-process architecture typical of Electron apps:

### Main Process (`src/main/`)
- **Entry Point**: `app.ts` - Application lifecycle management
- **Window Management**: `appWindow.ts` - Creates and manages browser windows, registers IPC handlers
- **Dictionary Service**: `dictionary.ts` - Handles MDX/MDD dictionary file loading and word lookups using js-mdict
- **AI Service**: `geminiService.ts` - Integrates Google Gemini API for AI-powered word definitions and image generation
- **IPC Handlers**: Registered in `appWindow.ts` for:
  - Dictionary operations (`search-words`, `lookup-word`, `open-file-dialog-for-dictionary`)
  - Word book management (`add-book`, `read-book`)
  - AI features (`ai-lookup-word`, `ai-generate-image`, `ai-lookup-word-with-image`, `check-ai-config`)

### Renderer Process (`src/renderer/`)
- **Entry Point**: `appRenderer.tsx` - Sets up React Router and renders the application
- **Routing Structure**: Hash-based routing with main routes:
  - `/` - Home page with nested routes for dictionary, notebook, and AI mode
  - `/displayContent` - Separate window for displaying selected text translations
- **State Management**: Uses Jotai for atomic state management (`src/renderer/store/`)
- **Key Components**:
  - `pages/dictionary/` - Main dictionary interface with search and word display
  - `pages/notebook/` - Word book for saved vocabulary
  - `pages/ai-mode/` - AI-powered word lookup with Gemini integration
  - `components/` - Reusable UI components

### Key Features
- **Dictionary Import**: Supports importing third-party MDX/MDD dictionary files
- **Global Shortcut**: `Cmd/Ctrl+Shift+C` for quick text translation (requires accessibility permissions on macOS)
- **AI Integration**: Uses Google Gemini API for enhanced word definitions when configured
- **Word Book**: Automatically saves looked-up words with timestamps
- **Multi-window Support**: Main app window and popup translation windows

### Configuration
- **Path Aliases**: Configured in `tsconfig.json` and webpack configs for cleaner imports (@renderer, @main, @components, etc.)
- **Webpack**: Custom webpack configuration in `tools/webpack/` for both main and renderer processes
- **Electron Forge**: Build and packaging configuration in `tools/forge/forge.config.js`
- **Styling**: Uses SCSS with Tailwind CSS for styling
- **AI Configuration**: Requires `.env` file with `GEMINI_API_KEY` for AI features

### Storage
- **Electron Store**: Persists dictionary file paths
- **Local JSON File**: `wordbook.json` stores saved vocabulary