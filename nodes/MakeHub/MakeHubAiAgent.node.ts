/* eslint-disable n8n-nodes-base/node-dirname-against-convention */

import {
	NodeConnectionType,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	LoggerProxy,
} from 'n8n-workflow';

import { getConnectionHintNoticeField } from '@utils/sharedFields';
import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import { makeN8nLlmFailedAttemptHandler } from '../n8nLlmFailedAttemptHandler';
import { N8nLlmTracing } from '../N8nLlmTracing';

export class LmChatMakeHub implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MakeHub AI Chat Model',
		name: 'lmChatMakeHub',
		icon: { light: 'file:makehub.svg', dark: 'file:makehub.dark.svg' },
		group: ['transform'],
		version: [1],
		description: 'Interface avec les modèles de langage MakeHub AI',
		defaults: {
			name: 'MakeHub AI Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatmakehub/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'makeHubApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: 'https://api.makehub.ai/v1',
		},
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiChain, NodeConnectionType.AiAgent]),
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				description: 'Choisissez le modèle de langage MakeHub AI à utiliser',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/models',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data',
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{$responseItem.model_id || $responseItem.id || $responseItem.name}}',
											value: '={{$responseItem.model_id || $responseItem.id || $responseItem.name}}',
										},
									},
									{
										type: 'sort',
										properties: {
											key: 'name',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				default: '',
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'System Prompt',
						name: 'systemPrompt',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: '',
						description: 'System message to set the behavior of the assistant',
						placeholder: 'You are a helpful assistant...',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'maxTokens',
						default: 1024,
						description: 'The maximum number of tokens to generate in the completion',
						type: 'number',
					},
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.7,
						typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
						description: 'Controls randomness: Lowering results in less random completions',
						type: 'number',
					},
					{
						displayName: 'Stream',
						name: 'stream',
						default: false,
						description: 'Whether to stream back partial progress',
						type: 'boolean',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 360000,
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
				],
			},
			{
				displayName: 'Min Throughput Settings',
				name: 'minThroughputSettings',
				type: 'collection',
				placeholder: 'Add Min Throughput Settings',
				default: {},
				options: [
					{
						displayName: 'Min Throughput Mode',
						name: 'minThroughputMode',
						type: 'options',
						options: [
							{ name: 'Best Price', value: 'bestPrice' },
							{ name: 'Custom Value', value: 'custom' },
							{ name: 'Best Performance', value: 'best' },
						],
						default: 'bestPrice',
						description: 'Choose between Best Price, Custom Value or Best Performance'
					},
					{
						displayName: 'Min Throughput',
						name: 'minThroughput',
						type: 'number',
						default: 40,
						displayOptions: {
							show: {
								minThroughputMode: ['custom']
							}
						},
						description: 'Custom value in tokens/sec'
					},
				],
			},
			{
				displayName: 'Max Latency Settings',
				name: 'maxLatencySettings',
				type: 'collection',
				placeholder: 'Add Max Latency Settings',
				default: {},
				options: [
					{
						displayName: 'Max Latency Mode',
						name: 'maxLatencyMode',
						type: 'options',
						options: [
							{ name: 'Best Price', value: 'bestPrice' },
							{ name: 'Custom Value', value: 'custom' },
							{ name: 'Best Performance', value: 'best' },
						],
						default: 'bestPrice',
						description: 'Choose between Best Price, Custom Value or Best Performance'
					},
					{
						displayName: 'Max Latency',
						name: 'maxLatency',
						type: 'number',
						default: 1000,
						displayOptions: {
							show: {
								maxLatencyMode: ['custom']
							}
						},
						description: 'Custom value in milliseconds'
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		LoggerProxy.info('Starting MakeHub AI Chat Model node');
		
		const credentials = await this.getCredentials('makeHubApi');
		
		if (!credentials?.apiKey) {
			throw new Error('No valid API key provided');
		}

		const modelName = this.getNodeParameter('model', itemIndex) as string;
		
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			systemPrompt?: string;
			maxTokens?: number;
			temperature?: number;
			stream?: boolean;
			maxRetries?: number;
			timeout?: number;
		};

		// Get performance parameters
		const minThroughputSettings = this.getNodeParameter('minThroughputSettings', itemIndex, {}) as { 
			minThroughputMode?: string, 
			minThroughput?: number 
		};
		
		const maxLatencySettings = this.getNodeParameter('maxLatencySettings', itemIndex, {}) as { 
			maxLatencyMode?: string, 
			maxLatency?: number 
		};

		// Build extra_query for performance parameters
		const modelKwargs: Record<string, any> = {};
		const extraQuery: { [key: string]: string } = {};
		
		if (minThroughputSettings.minThroughputMode && minThroughputSettings.minThroughputMode !== 'bestPrice') {
			extraQuery.min_throughput = minThroughputSettings.minThroughputMode === 'custom'
				? String(minThroughputSettings.minThroughput)
				: 'best';
		}
		
		if (maxLatencySettings.maxLatencyMode && maxLatencySettings.maxLatencyMode !== 'bestPrice') {
			extraQuery.max_latency = maxLatencySettings.maxLatencyMode === 'custom'
				? String(maxLatencySettings.maxLatency)
				: 'best';
		}
		
		if (Object.keys(extraQuery).length > 0) {
			modelKwargs.extra_query = extraQuery;
		}

		LoggerProxy.debug('Preparing MakeHub model options', { modelName, options, modelKwargs });

		const configuration: ClientOptions = {
			baseURL: 'https://api.makehub.ai/v1',
		};

		// Set up the model with LangChain
		const model = new ChatOpenAI({
			openAIApiKey: credentials.apiKey as string,
			modelName,
			maxTokens: options.maxTokens,
			temperature: options.temperature,
			streaming: options.stream,
			timeout: options.timeout ?? 360000,
			maxRetries: options.maxRetries ?? 2,
			configuration,
			modelKwargs,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		LoggerProxy.info('MakeHub AI Chat Model node initialized successfully');

		return {
			response: model,
		};
	}
}