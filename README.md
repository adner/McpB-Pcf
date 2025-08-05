# Power Apps Component Framework (PCF) dataset control that uses MCP-B for AI tool calling 
This repo contains the code for a PCF control that implements a number of MCP tools, that can be utilized by the [MCP-B](https://chromewebstore.google.com/detail/mcp-bextension/daohopfhkdelnpemnhlekblhnikhdhfa) Chrome extension, to allow LLMs to interact with Model-driven apps in Dataverse, using MCP.

For more info on MCP-B, see [here](https://mcp-b.ai/).

I wrote about this in a [post](https://www.linkedin.com/posts/andreas-adner-70b1153_mcp-b-pcf-activity-7358222495117639680-y29-?utm_source=share&utm_medium=member_desktop&rcm=ACoAAACM8rsBEgQIrYgb4NZAbnxwfDRk_Tu5e3w) on LinkedIn, and a video can be found on [YouTube](https://youtu.be/ppjGJggJ7FQ?si=23NGZ10uWp_tglQM).

## Overview

This project extends the standard Dynamics 365 grid functionality by integrating with the Model Context Protocol, enabling AI agents to interact with grid data through a set of exposed tools. A number of tools are implemented that can be called by a tool calling capable LLM:

### `getPageInfo`
Returns current page title and URL information.

### `getGridData` 
Returns a summary of the Grid, including:
- Total records and pagination info
- Column definitions with display names and data types
- Selected record IDs and full record data with formatted values
- Current sorting and filtering state

### `sortGrid`
Sorts the grid by a specified column name in ascending or descending order.

**Parameters:**
- `columnName` (string): The logical name of the column to sort
- `descending` (boolean, optional): Sort direction (default: false)

### `selectRecordsBySearch`
Search through dataset rows and select records matching a search string across all visible columns.

**Parameters:**
- `searchString` (string): The text to search for
- `caseSensitive` (boolean, optional): Case sensitivity (default: false)

### `quickFilter`
Apply common quick filters to the dataset.

**Parameters:**
- `filterType` (enum): Type of filter (clear, empty_values, contains_text, etc.)
- `columnName` (string, optional): Column to filter on
- `value` (string, optional): Filter value

## Usage

### Build the Control
```
npm run build
```

### Deploy the PCF control to Power Platform

Authenticate with your Power Platform environment using PAC CLI, then push the control:

```bash
# Authenticate with your environment (if not already done)
pac auth create --url https://yourenv.crm.dynamics.com

# Push the PCF control to your environment
pac pcf push -pp samples
```
Note that you need to have a Publisher in your Dataverse environment,called `samples`.

Follow the instructions [here](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/tutorial-create-model-driven-app-dataset-component#download-and-install-the-model-driven-app-sample-code) to add the PCF Control to a view. Note that no parameters need to be set, these have been removed from the PCF control.

### Wiring it up with MCP-B
- Install the MCP-B Chrome [extension](https://chromewebstore.google.com/detail/mcp-bextension/daohopfhkdelnpemnhlekblhnikhdhfa).
- Run the command `npm i -g @mcp-b/native-server` to install the component that bridges the external LLM to the Chrome extension.

### Connect your MCP enabled LLM to MCP-B
In order to connect your LLM to the MCP-B native bridge, an MCP Client is needed:

- **Visual Studio Code ** is easy to setup, just add a `http` MCP Server and enter the URL `http://127.0.0.1:12306/mcp`.
- **LM Studio** is also easy to setup, just add the following to the `mcp.json`file:

```json
"McpB":
{
 "type": "streamable-http",
 "url": "http://127.0.0.1:12306/mcp
}
```
- Claude Desktop requires the installation of a STDIO to HTTP bridge, more info [here](https://github.com/MiguelsPizza/WebMCP/blob/main/ConnectingTOClaudeDesktop.md).

## Development

**Build the control**:
   ```bash
   npm run build
   ```

**Start development server** (optional):
   ```bash
   npm run start:watch
   ```

**Code quality checks**:
   ```bash
   npm run lint
   npm run lint:fix
   ```

### Testing with Dynamics 365

For advanced testing with a live Dynamics 365 environment, you can use the [PAC CLI Proxy](https://github.com/framitdavid/pcf-cli-proxy-tools):

**Configure environment variables** in `.env`:
   ```
   MITMPROXY_PATH=path/to/mitmproxy
   CRM_URL_PATH=https://yourenv.crm.dynamics.com
   CHROME_EXE_PATH=path/to/chrome
   HTTP_SERVER_PORT=8082
   PROXY_PORT=8080
   ```

**Start the development proxy**:
   ```bash
   npm run dev:proxy -- cc_SampleNamespace.ModelDrivenGrid 
   ```

   It order to get the proxy to serve bundle.js from the right folder (given that the name of my component had a namespace prefix), I had to make a slight modification to the [proxy.js](/dev/proxy.js) file:

 ``` typescript
   const componentDistPath = path.resolve(__dirname, `../out/controls/ModelDrivenGrid`);
 ```
