import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	INodePropertyOptions,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface IMakeHubModel {
	model_id: string;
	name?: string;
	description?: string;
}

interface IMakeHubResponse extends IDataObject {
	id: string;
	model: string;
	created: number;
	object: string;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
		index: number;
	}>;
}

export class MakeHub implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MakeHub AI',
		name: 'makeHub',
		icon: 'file:makehub.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with MakeHub AI API',
		defaults: {
			name: 'MakeHub AI',
		},
		inputs: '={{["main"]}}',
		outputs: '={{["main"]}}',
		credentials: [
			{
				name: 'makeHubApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat',
						value: 'chat',
						description: 'Send a chat message',
						action: 'Send a chat message',
					},
				],
				default: 'chat',
			},
			{
				displayName: 'Model Name or ID',
				name: 'model',
				type: 'options',
				noDataExpression: true,
				typeOptions: {
					loadOptionsMethod: 'getModels',
				},
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'System Prompt',
				name: 'system_prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'System message to set the behavior of the assistant',
				placeholder: 'You are a helpful assistant...',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'The message to send to the chat model',
				required: true,
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 0.7,
				description: 'Controls randomness. Lower is more deterministic, higher is more random.',
			},
			{
				displayName: 'Performance Settings',
				name: 'performanceSettings',
				type: 'fixedCollection',
				placeholder: 'Add Performance Settings',
				default: {},
				options: [
					{
						displayName: 'Min Throughput',
						name: 'minThroughput',
						values: [
							{
								displayName: 'Mode',
								name: 'mode',
								type: 'options',
								options: [
									{ name: 'Best Price', value: 'bestPrice' },
									{ name: 'Custom Value', value: 'custom' },
									{ name: 'Best Performance', value: 'best' },
								],
								default: 'bestPrice',
								description: 'Choose from Best Price, Custom Value or Best Performance',
							},
							{
								displayName: 'Custom Value',
								name: 'value',
								type: 'number',
								default: 40,
								displayOptions: {
									show: {
										mode: ['custom'],
									},
								},
								description: 'Custom value in tokens/sec',
							},
						],
					},
					{
						displayName: 'Max Latency',
						name: 'maxLatency',
						values: [
							{
								displayName: 'Mode',
								name: 'mode',
								type: 'options',
								options: [
									{ name: 'Best Price', value: 'bestPrice' },
									{ name: 'Custom Value', value: 'custom' },
									{ name: 'Best Performance', value: 'best' },
								],
								default: 'bestPrice',
								description: 'Choose from Best Price, Custom Value or Best Performance',
							},
							{
								displayName: 'Custom Value',
								name: 'value',
								type: 'number',
								default: 1000,
								displayOptions: {
									show: {
										mode: ['custom'],
									},
								},
								description: 'Custom value in milliseconds',
							},
						],
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 1024,
						description: 'Maximum number of tokens to generate',
					},
					{
						displayName: 'Stream',
						name: 'stream',
						type: 'boolean',
						default: false,
						description: 'Whether to stream back partial progress',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('makeHubApi');
				const options: IRequestOptions = {
					url: 'https://api.makehub.ai/v1/models',
					headers: {
						Authorization: `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					method: 'GET' as IHttpRequestMethods,
					json: true,
				};

				try {
					const response = await this.helpers.request(options);
					
					// Find the models array in the response
					let modelsList: IMakeHubModel[] = [];
					
					if (Array.isArray(response)) {
						modelsList = response;
					} else if (response.data && Array.isArray(response.data)) {
						modelsList = response.data;
					} else if (response.models && Array.isArray(response.models)) {
						modelsList = response.models;
					} else {
						// Try to find an array in the response
						for (const [key, value] of Object.entries(response)) {
							if (Array.isArray(value)) {
								modelsList = value;
								break;
							}
						}
					}

					if (modelsList.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'No models found in MakeHub API response',
						);
					}

					const models = modelsList
						.filter((model: IMakeHubModel) => model.model_id)
						.map((model: IMakeHubModel) => ({
							name: model.name || model.model_id,
							value: model.model_id,
							description: model.description || '',
						}))
						.sort((a: INodePropertyOptions, b: INodePropertyOptions) =>
							a.name.localeCompare(b.name),
						);

					return models;
				} catch (error) {
					throw new NodeOperationError(
						this.getNode(),
						`Failed to load models: ${(error as Error).message}`,
					);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('makeHubApi');
		if (!credentials?.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No valid API key provided');
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const model = this.getNodeParameter('model', i) as string;
				const systemPrompt = this.getNodeParameter('system_prompt', i, '') as string;
				const message = this.getNodeParameter('message', i) as string;
				const temperature = this.getNodeParameter('temperature', i) as number;
				const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
				const performanceSettings = this.getNodeParameter('performanceSettings', i) as {
					minThroughput?: { mode: string; value: number };
					maxLatency?: { mode: string; value: number };
				};

				if (operation === 'chat') {
					const messages = [];

					// Add system message if provided
					if (systemPrompt) {
						messages.push({
							role: 'system',
							content: systemPrompt,
						});
					}

					// Add user message
					messages.push({
						role: 'user',
						content: message,
					});

					const requestBody: IDataObject = {
						model,
						messages,
						temperature,
					};

					// Add max_tokens if provided
					if (additionalFields.max_tokens !== undefined) {
						requestBody.max_tokens = additionalFields.max_tokens;
					}

					// Add stream if provided
					if (additionalFields.stream !== undefined) {
						requestBody.stream = additionalFields.stream;
					}

					// Add performance settings
					const extraQuery: { [key: string]: string } = {};
					
					if (performanceSettings.minThroughput?.mode && performanceSettings.minThroughput.mode !== 'bestPrice') {
						extraQuery.min_throughput = performanceSettings.minThroughput.mode === 'custom'
							? String(performanceSettings.minThroughput.value)
							: 'best';
					}
					
					if (performanceSettings.maxLatency?.mode && performanceSettings.maxLatency.mode !== 'bestPrice') {
						extraQuery.max_latency = performanceSettings.maxLatency.mode === 'custom'
							? String(performanceSettings.maxLatency.value)
							: 'best';
					}
					
					if (Object.keys(extraQuery).length > 0) {
						requestBody.extra_query = extraQuery;
					}

					const options: IRequestOptions = {
						url: 'https://api.makehub.ai/v1/chat/completions',
						headers: {
							Authorization: `Bearer ${credentials.apiKey}`,
							'Content-Type': 'application/json',
						},
						method: 'POST' as IHttpRequestMethods,
						body: requestBody,
						json: true,
					};

					const response = await this.helpers.request(options);

					if (!response?.choices?.[0]?.message?.content) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid response format from MakeHub API',
						);
					}

					const typedResponse = response as IMakeHubResponse;
					const messageContent = typedResponse.choices[0].message.content.trim();

					returnData.push({
						json: {
							response: messageContent,
							model: typedResponse.model,
							usage: typedResponse.usage,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}