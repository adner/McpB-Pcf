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
- Exposes MCP tools: `getPageInfo`, `getGridData`, `sortGrid`, `selectRecordsBySearch`, `quickFilter`
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

### MCP Integration

This control exposes several tools via Model Context Protocol for AI agent interaction:

**getPageInfo** - Returns current page title and URL
**getGridData** - Returns comprehensive grid state including:
- Total records, pagination info, loading state
- Column definitions with display names and data types
- Selected record IDs and full record data with formatted values
- Current sorting and filtering state

**sortGrid** - Sorts grid by column name (ascending/descending)
**selectRecordsBySearch** - Search and select records matching text across all visible columns
**quickFilter** - Apply common filters like empty values, date ranges, text contains/equals

### Development Workflow

**Local Development:**
1. Use `npm run build` to compile the PCF control
2. Use `npm run dev:proxy` to start proxy server for testing with Dynamics 365
3. The proxy script (`dev/proxy.js`) requires environment variables in `.env`:
   - `MITMPROXY_PATH` - Path to mitmproxy executable
   - `CRM_URL_PATH` - Dynamics 365 environment URL
   - `CHROME_EXE_PATH` - Path to Chrome browser
   - `HTTP_SERVER_PORT` and `PROXY_PORT` for local server ports

**Key Implementation Details:**
- React 16.14 with Fluent UI v8 for UI components
- Selection state sync between PCF framework and React Selection
- Pagination with exact page loading via PCF paging API
- Column context menus for sorting and filtering operations
- Responsive design with full-screen mode support

### Project Structure
- `ModelDrivenGrid/` - Main control implementation
- `dev/` - Development tools and proxy scripts  
- `out/controls/` - Build output directory
- `assets/` - Static assets including sample data

### Project References
- PCF code is based on the samples found here: https://learn.microsoft.com/en-us/power-apps/developer/component-framework/tutorial-create-model-driven-app-dataset-component
- To build the PCF, follow the instructions found here: https://learn.microsoft.com/en-us/power-apps/developer/component-framework/tutorial-create-model-driven-app-dataset-component#download-and-install-the-model-driven-app-sample-code

### PCF Build Steps
- There are two steps involved when building the PCF. First run "npm install", and then run "pac pcf push -pp samples" to push the PCF to the environment that you are currently authenticated with (using PAC CLI).