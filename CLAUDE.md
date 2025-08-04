# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Build the PCF control using pcf-scripts
- `npm run start` - Start development server
- `npm run start:watch` - Start development server with file watching
- `npm run rebuild` - Clean and rebuild the project
- `npm run clean` - Clean build artifacts

### Code Quality
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Run ESLint and automatically fix issues

### Development Proxy
- `npm run dev:proxy` - Start development proxy for testing with Dynamics 365
- Uses `dev/proxy.js` to set up a proxy environment for PCF testing

### PCF Specific
- `npm run refreshTypes` - Refresh TypeScript type definitions for PCF

## Architecture Overview

This is a PowerApps Component Framework (PCF) control that implements a model-driven grid with MCP (Model Context Protocol) integration.

### Core Components

**ModelDrivenGrid Control** (`ModelDrivenGrid/index.ts`)
- Main PCF control class implementing `ComponentFramework.StandardControl`
- Integrates with MCP server using `@mcp-b/transports` and `@modelcontextprotocol/sdk`
- Exposes MCP tools: `getPageInfo`, `sortGrid`, `addColumn`
- Handles PCF lifecycle methods: `init`, `updateView`, `getOutputs`, `destroy`

**Grid Component** (`ModelDrivenGrid/Grid.tsx`)
- React component using Fluent UI DetailsList
- Handles data visualization, sorting, filtering, and pagination
- Uses React hooks for state management and memoization
- Implements column context menus and row selection

### Key Technologies
- **PCF Framework**: Microsoft PowerApps Component Framework
- **React 16.14**: UI rendering with ReactDOM
- **Fluent UI**: Microsoft's design system components
- **MCP**: Model Context Protocol for AI agent integration
- **TypeScript**: Strongly typed JavaScript

### Data Flow
1. PCF framework provides dataset through `context.parameters.records`
2. ModelDrivenGrid processes dataset and passes to React Grid component
3. Grid component renders using Fluent UI DetailsList
4. User interactions trigger PCF methods which update the dataset
5. MCP tools expose grid operations to external agents

### Development Setup
- Uses pcf-scripts for build tooling
- ESLint configuration with Power Apps specific rules
- TypeScript configuration extends pcf-scripts base
- Development proxy setup for testing with Dynamics 365 environments

### Project Structure
- `ModelDrivenGrid/` - Main control implementation
- `dev/` - Development tools and proxy scripts
- `out/controls/` - Build output directory
- `assets/` - Static assets including sample data