import { initializeIcons } from "@fluentui/react/lib/Icons";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { Grid } from "./Grid";
import { TabServerTransport } from "@mcp-b/transports";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from 'zod';

// Register icons - but ignore warnings if they have been already registered by Power Apps
initializeIcons(undefined, { disableWarnings: true });

// Create the server (one per site)
const server = new McpServer({
  name: "my-website",
  version: "1.0.0",
});

export class ModelDrivenGrid implements ComponentFramework.StandardControl<IInputs, IOutputs> {
	notifyOutputChanged: () => void;
	container: HTMLDivElement;
	context: ComponentFramework.Context<IInputs>;
	sortedRecordsIds: string[] = [];
	resources: ComponentFramework.Resources;
	isTestHarness: boolean;
	records: Record<string, ComponentFramework.PropertyHelper.DataSetApi.EntityRecord>;
	currentPage = 1;
	isFullScreen = false;

	setSelectedRecords = (ids: string[]): void => {
		this.context.parameters.records.setSelectedRecordIds(ids);
		// Trigger a UI update to reflect the selection change
		this.notifyOutputChanged();
	};

	onNavigate = (item?: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord): void => {
		if (item) {
			this.context.parameters.records.openDatasetItem(item.getNamedReference());
		}
	};

	onSort = (name: string, desc: boolean): void => {
		const sorting = this.context.parameters.records.sorting;
		while (sorting.length > 0) {
			sorting.pop();
		}
		this.context.parameters.records.sorting.push({
			name: name,
			sortDirection: desc ? 1 : 0,
		});
		this.context.parameters.records.refresh();
	};

	onFilter = (name: string, filter: boolean): void => {
		const filtering = this.context.parameters.records.filtering;
		if (filter) {
			filtering.setFilter({
				conditions: [
					{
						attributeName: name,
						conditionOperator: 12, // Does not contain Data
					},
				],
			} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
		} else {
			filtering.clearFilter();
		}
		this.context.parameters.records.refresh();
	};

	loadFirstPage = (): void => {
		this.currentPage = 1;
		this.context.parameters.records.paging.loadExactPage(1);
	};

	loadNextPage = (): void => {
		this.currentPage++;
		this.context.parameters.records.paging.loadExactPage(this.currentPage);
	};

	loadPreviousPage = (): void => {
		this.currentPage--;
		this.context.parameters.records.paging.loadExactPage(this.currentPage);
	};

	onFullScreen = (): void => {
		this.context.mode.setFullScreen(true);
	};

	private setupMcpTools(): void {
		server.tool("getPageInfo", "Get current page info", {}, async () => {
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							title: document.title,
							url: window.location.href,
						}),
					},
				],
			};
		});

		server.tool("getGridData", "Get current grid data and state including selected record values", {}, async () => {
			const selectedRecordIds = this.context.parameters.records.getSelectedRecordIds();
			const visibleColumns = this.context.parameters.records.columns.filter(col => !col.isHidden);
			
			// Get actual data for selected records
			const selectedRecordsData = selectedRecordIds.map(recordId => {
				const record = this.records[recordId];
				if (record) {
					const recordData: any = {
						recordId: recordId,
						entityName: record.getNamedReference().name,
						values: {}
					};
					
					// Get formatted values for all visible columns
					visibleColumns.forEach(column => {
						try {
							recordData.values[column.name] = {
								displayName: column.displayName,
								formattedValue: record.getFormattedValue(column.name),
								rawValue: record.getValue(column.name),
								dataType: column.dataType
							};
						} catch {
							// Skip columns that can't be read
							recordData.values[column.name] = {
								displayName: column.displayName,
								formattedValue: "N/A",
								rawValue: null,
								dataType: column.dataType
							};
						}
					});
					
					return recordData;
				}
				return null;
			}).filter(record => record !== null);
			
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify({
							totalRecords: this.context.parameters.records.paging.totalResultCount,
							currentPage: this.currentPage,
							selectedRecordIds: selectedRecordIds,
							selectedRecordsCount: selectedRecordIds.length,
							hasNextPage: this.context.parameters.records.paging.hasNextPage,
							hasPreviousPage: this.context.parameters.records.paging.hasPreviousPage,
							isLoading: this.context.parameters.records.loading,
							columns: visibleColumns.map(col => ({
								name: col.name,
								displayName: col.displayName,
								dataType: col.dataType,
								order: col.order,
								isHidden: col.isHidden
							})),
							sorting: this.context.parameters.records.sorting,
							filtering: this.context.parameters.records.filtering?.getFilter(),
							selectedRecordsData: selectedRecordsData
						}, null, 2)
					}
				]
			};
		});

		server.tool("sortGrid", "Sorts the grid on a column", {
			columnName: z.string().describe("The logical name of the column that we should sort on"),
			descending: z.boolean().optional().describe("Whether to sort in descending order (default: false)")
		}, async ({ columnName, descending = false }) => {
			this.onSort(columnName, descending);
			return {
				content: [
					{
						type: "text",
						text: `Grid sorted by ${columnName} in ${descending ? "descending" : "ascending"} order.`,
					},
				],
			};
		});

		server.tool("selectRecordsBySearch", "Search through dataset rows and select records that match a search string", {
			searchString: z.string().describe("The string to search for across all visible columns"),
			caseSensitive: z.boolean().optional().describe("Whether the search should be case sensitive (default: false)")
		}, async ({ searchString, caseSensitive = false }) => {
			const matchingRecordIds: string[] = [];
			const searchTerm = caseSensitive ? searchString : searchString.toLowerCase();
			
			// Get all visible columns for searching
			const visibleColumns = this.context.parameters.records.columns
				.filter(col => !col.isHidden);
			
			// Search through all records
			this.sortedRecordsIds.forEach(recordId => {
				const record = this.records[recordId];
				if (record) {
					// Check each visible column for the search term
					const isMatch = visibleColumns.some(column => {
						try {
							const value = record.getFormattedValue(column.name);
							if (value) {
								const searchValue = caseSensitive ? value : value.toLowerCase();
								return searchValue.includes(searchTerm);
							}
						} catch {
							// Skip columns that can't be read
						}
						return false;
					});
					
					if (isMatch) {
						matchingRecordIds.push(recordId);
					}
				}
			});
			
			// Select the matching records
			this.setSelectedRecords(matchingRecordIds);
			
			return {
				content: [
					{
						type: "text",
						text: `Found and selected ${matchingRecordIds.length} records matching "${searchString}". Record IDs: ${matchingRecordIds.join(', ')}`,
					},
				],
			};
		});

		server.tool("quickFilter", "Apply common quick filters to the dataset", {
			filterType: z.enum([
				"clear", 
				"empty_values", 
				"non_empty_values", 
				"today", 
				"this_week", 
				"this_month", 
				"last_30_days",
				"active_records",
				"inactive_records",
				"contains_text",
				"starts_with",
				"ends_with",
				"greater_than",
				"less_than",
				"equals"
			]).describe("The type of quick filter to apply"),
			columnName: z.string().optional().describe("The column name to apply the filter on (required for most filter types)"),
			value: z.string().optional().describe("The value to filter by (required for text and comparison filters)")
		}, async ({ filterType, columnName, value }) => {
			const filtering = this.context.parameters.records.filtering;
			
			try {
				switch (filterType) {
					case "clear":
						filtering.clearFilter();
						break;
						
					case "empty_values":
						if (!columnName) throw new Error("columnName is required for empty_values filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 12, // Does not contain data (existing pattern)
								value: ""
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "non_empty_values":
						if (!columnName) throw new Error("columnName is required for non_empty_values filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 1, // NotEqual
								value: ""
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "today":
						if (!columnName) throw new Error("columnName is required for today filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 15
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "this_week":
						if (!columnName) throw new Error("columnName is required for this_week filter");
						const weekStart = new Date();
						weekStart.setDate(weekStart.getDate() - weekStart.getDay());
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 6, // Greater than or equal
								value: weekStart.toISOString().split('T')[0]
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "this_month":
						if (!columnName) throw new Error("columnName is required for this_month filter");
						const monthStart = new Date();
						monthStart.setDate(1);
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 6, // Greater than or equal
								value: monthStart.toISOString().split('T')[0]
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "last_30_days":
						if (!columnName) throw new Error("columnName is required for last_30_days filter");
						const thirtyDaysAgo = new Date();
						thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 6, // Greater than or equal
								value: thirtyDaysAgo.toISOString().split('T')[0]
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "contains_text":
						if (!columnName || !value) throw new Error("columnName and value are required for contains_text filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 49, // Contains
								value: value
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "starts_with":
						if (!columnName || !value) throw new Error("columnName and value are required for starts_with filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 8, // Equal (simplified)
								value: value
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "ends_with":
						if (!columnName || !value) throw new Error("columnName and value are required for ends_with filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 8, // Equal (simplified)
								value: value
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "equals":
						if (!columnName || !value) throw new Error("columnName and value are required for equals filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 0, // Equal
								value: value
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "greater_than":
						if (!columnName || !value) throw new Error("columnName and value are required for greater_than filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 6, // Greater than or equal (closest available)
								value: value
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "less_than":
						if (!columnName || !value) throw new Error("columnName and value are required for less_than filter");
						filtering.setFilter({
							filterOperator: 0, // And
							conditions: [{
								attributeName: columnName,
								conditionOperator: 12, // Does not contain data (simplified)
								value: value
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "active_records":
						// Filter for active records (statecode = 0) - using correct ConditionOperator.Equal = 0
						filtering.setFilter({
							conditions: [{
								attributeName: "statecode",
								conditionOperator: 0, // Equal
								value: "0"
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					case "inactive_records":
						// Filter for inactive records (statecode = 1) - using correct ConditionOperator.Equal = 0
						filtering.setFilter({
							conditions: [{
								attributeName: "statecode",
								conditionOperator: 0, // Equal
								value: "1"
							}]
						} as ComponentFramework.PropertyHelper.DataSetApi.FilterExpression);
						break;
						
					default:
						throw new Error(`Unknown filter type: ${filterType}`);
				}
				
				// Refresh the dataset to apply the filter
				this.context.parameters.records.refresh();
				
				let resultMessage = `Applied ${filterType} filter`;
				if (columnName) resultMessage += ` on column '${columnName}'`;
				if (value) resultMessage += ` with value '${value}'`;
				
				return {
					content: [{
						type: "text",
						text: resultMessage + "."
					}]
				};
				
			} catch (error) {
				return {
					content: [{
						type: "text",
						text: `Failed to apply filter: ${error instanceof Error ? error.message : String(error)}`
					}]
				};
			}
		});	
	}

	/**
	 * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
	 * Data-set values are not initialized here, use updateView.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
	 * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
	 * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
	 * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
	 */
	public async init(
		context: ComponentFramework.Context<IInputs>,
		notifyOutputChanged: () => void,
		state: ComponentFramework.Dictionary,
		container: HTMLDivElement
	): Promise<void> {
		this.notifyOutputChanged = notifyOutputChanged;
		this.container = container;
		this.context = context;
		this.context.mode.trackContainerResize(true);
		this.resources = this.context.resources;
		this.isTestHarness = document.getElementById("control-dimensions") !== null;

		this.setupMcpTools();
		await server.connect(new TabServerTransport({ allowedOrigins: ["*"] })); // Adjust origins for security
	}

	/**
	 * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
	 * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
	 */
	public updateView(context: ComponentFramework.Context<IInputs>): void {
		const dataset = context.parameters.records;
		const paging = context.parameters.records.paging;

		// In MDAs, the initial population of the dataset does not provide updatedProperties
		const initialLoad = !this.sortedRecordsIds && dataset.sortedRecordIds;
		const datasetChanged = context.updatedProperties.includes("dataset") || initialLoad;
		const resetPaging = datasetChanged && !dataset.loading && !dataset.paging.hasPreviousPage && this.currentPage !== 1;

		if (context.updatedProperties.includes("fullscreen_close")) {
			this.isFullScreen = false;
		}
		if (context.updatedProperties.includes("fullscreen_open")) {
			this.isFullScreen = true;
		}

		if (resetPaging) {
			this.currentPage = 1;
		}

		if (resetPaging || datasetChanged || this.isTestHarness) {
			this.records = dataset.records;
			this.sortedRecordsIds = dataset.sortedRecordIds;
		}

		// The test harness provides width/height as strings
		const allocatedWidth = parseInt(context.mode.allocatedWidth as unknown as string);
		const allocatedHeight = parseInt(context.mode.allocatedHeight as unknown as string);

		// For MDA subgrid support when running on mobile/narrow formfactor
		// if (!this.isFullScreen && context.parameters.SubGridHeight.raw) {
		// 	allocatedHeight = context.parameters.SubGridHeight.raw;
		// }

		ReactDOM.render(
			React.createElement(Grid, {
				width: allocatedWidth,
				height: allocatedHeight,
				columns: dataset.columns,
				records: this.records,
				sortedRecordIds: this.sortedRecordsIds,
				selectedRecordIds: dataset.getSelectedRecordIds(),
				hasNextPage: paging.hasNextPage,
				hasPreviousPage: paging.hasPreviousPage,
				currentPage: this.currentPage,
				totalResultCount: paging.totalResultCount,
				sorting: dataset.sorting,
				filtering: dataset.filtering?.getFilter(),
				resources: this.resources,
				itemsLoading: dataset.loading,
				setSelectedRecords: this.setSelectedRecords,
				onNavigate: this.onNavigate,
				onSort: this.onSort,
				onFilter: this.onFilter,
				loadFirstPage: this.loadFirstPage,
				loadNextPage: this.loadNextPage,
				loadPreviousPage: this.loadPreviousPage,
				isFullScreen: this.isFullScreen,
				onFullScreen: this.onFullScreen,
			}),
			this.container
		);
	}

	/**
	 * It is called by the framework prior to a control receiving new data.
	 * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
	 */
	public getOutputs(): IOutputs {
		return {} as IOutputs;
	}

	/**
	 * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
	 * i.e. cancelling any pending remote calls, removing listeners, etc.
	 */
	public destroy(): void {
		ReactDOM.unmountComponentAtNode(this.container);
	}
}
