import { 
    INodeType, 
    INodeTypeDescription,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    LoggerProxy,
    NodeOperationError,
    IExecuteFunctions,
    INodeExecutionData,
    IDataObject,
    IHttpRequestMethods,
    IRequestOptions,
} from 'n8n-workflow';

// Suppression de l'interface non utilisée IMakeHubModel

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

export class MakeHubAiAgent implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'MakeHub AI Chat Model',
        name: 'makeHubAiAgent',
        icon: 'file:makehub.svg',
        group: ['ai'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Interface avec les modèles de langage MakeHub AI',
        defaults: {
            name: 'MakeHub AI',
            color: '#ff6600',
        },
        inputs: '={{["main"]}}',
        outputs: '={{["main"]}}',
        tags: ['AI', 'Language Model', 'LLM'],
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
                try {
                    LoggerProxy.info('Starting MakeHub models retrieval for AI Agent');
                    const credentials = await this.getCredentials('makeHubApi');
                    
                    LoggerProxy.debug('Sending request with headers:', {
                        baseUrl: 'https://api.makehub.ai/v1/models',
                        hasApiKey: !!credentials.apiKey
                    });
                    
                    const requestOptions: IRequestOptions = {
                        url: 'https://api.makehub.ai/v1/models',
                        headers: {
                            'Authorization': `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        method: 'GET' as IHttpRequestMethods,
                        json: true,
                    };
                    
                    const responseData = await this.helpers.request(requestOptions);
                    
                    LoggerProxy.info('Response received from MakeHub API');
                    LoggerProxy.debug('Response analysis:', {
                        type: typeof responseData,
                        isArray: Array.isArray(responseData),
                        keys: Object.keys(responseData),
                    });

                    let modelsList: any[] = [];
                    
                    if (responseData && typeof responseData === 'object') {
                        if (Array.isArray(responseData)) {
                            modelsList = responseData;
                        } else if (responseData.data && Array.isArray(responseData.data)) {
                            modelsList = responseData.data;
                        } else if (responseData.models && Array.isArray(responseData.models)) {
                            modelsList = responseData.models;
                        } else {
                            // Look for any array property
                            for (const [_, value] of Object.entries(responseData)) {
                                if (Array.isArray(value)) {
                                    modelsList = value;
                                    break;
                                }
                            }
                        }
                    }

                    LoggerProxy.debug('Structure of found models:', {
                        modelsCount: modelsList.length,
                        firstElement: modelsList.length > 0 ? modelsList[0] : null
                    });

                    if (modelsList.length === 0) {
                        LoggerProxy.warn('No models found in the response');
                        return [{ name: 'No Models Available', value: '' }];
                    }

                    const modelOptions: INodePropertyOptions[] = modelsList.map((model: any) => {
                        const modelId = model.model_id || model.id || model.name;
                        return {
                            name: modelId,
                            value: modelId,
                            description: model.description || '',
                        };
                    }).filter((option) => !!option.value);

                    LoggerProxy.info(`${modelOptions.length} models converted to options`);
                    return modelOptions;
                } catch (error) {
                    LoggerProxy.error('Error retrieving models:', {
                        message: (error as Error).message,
                        stack: (error as Error).stack,
                    });
                    
                    throw new NodeOperationError(
                        this.getNode(),
                        `Error retrieving models: ${(error as Error).message}`
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

        LoggerProxy.info('Starting execution of MakeHub AI Agent node');

        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i) as string;
                const model = this.getNodeParameter('model', i) as string;
                const systemPrompt = this.getNodeParameter('system_prompt', i, '') as string;
                const message = this.getNodeParameter('message', i) as string;
                const temperature = this.getNodeParameter('temperature', i) as number;
                const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
                
                // Get performance parameters
                const minThroughputSettings = this.getNodeParameter('minThroughputSettings', i, {}) as { 
                    minThroughputMode?: string, 
                    minThroughput?: number 
                };
                const maxLatencySettings = this.getNodeParameter('maxLatencySettings', i, {}) as { 
                    maxLatencyMode?: string, 
                    maxLatency?: number 
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

                    LoggerProxy.debug('Preparing request body', { model, messagesCount: messages.length });

                    const requestBody: any = {
                        model,
                        messages,
                        temperature,
                    };

                    // Add max_tokens if specified
                    if (additionalFields.max_tokens !== undefined) {
                        requestBody.max_tokens = additionalFields.max_tokens;
                    }

                    // Add stream if specified
                    if (additionalFields.stream !== undefined) {
                        requestBody.stream = additionalFields.stream;
                    }

                    // Build extra_query for performance parameters
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
                        Object.assign(requestBody, { extra_query: extraQuery });
                    }

                    LoggerProxy.debug('Final request body:', requestBody);

                    const options: IRequestOptions = {
                        url: 'https://api.makehub.ai/v1/chat/completions',
                        headers: {
                            'Authorization': `Bearer ${credentials.apiKey}`,
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
                            'Invalid response format from MakeHub API'
                        );
                    }

                    const typedResponse = response as IMakeHubResponse;
                    const messageContent = typedResponse.choices[0].message.content.trim();

                    // Format for AI Agent compatibility
                    returnData.push({
                        json: {
                            response: messageContent,
                            messageId: typedResponse.id || `makehub-${Date.now()}`,
                            conversationId: `makehub-conversation-${Date.now()}`,
                            metadata: {
                                usage: typedResponse.usage || {},
                                model: typedResponse.model,
                                finishReason: typedResponse.choices[0].finish_reason,
                            }
                        },
                        pairedItem: { item: i },
                    });
                    
                    LoggerProxy.info('Successfully processed item with MakeHub AI Agent');
                }
            } catch (error) {
                LoggerProxy.error('Error during execution:', {
                    message: (error as Error).message,
                    stack: (error as Error).stack,
                    itemIndex: i
                });

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

        LoggerProxy.info('MakeHub AI Agent execution completed successfully');
        return [returnData];
    }
}