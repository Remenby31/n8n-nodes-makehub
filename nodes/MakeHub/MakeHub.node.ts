import { 
    INodeType, 
    INodeTypeDescription,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    LoggerProxy,
    NodeOperationError,
    IExecuteFunctions,
} from 'n8n-workflow';

export class MakeHub implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'MakeHub AI',
        name: 'makeHub',
        icon: 'file:makehub.svg',
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
        description: 'Interact with MakeHub AI LLM API',
        defaults: {
            name: 'MakeHub AI',
        },
        inputs: ['main'] as any,
        outputs: ['main'] as any,
        credentials: [
            {
                name: 'makeHubApi',
                required: true,
            },
        ],
        requestDefaults: {
            baseURL: 'https://api.makehub.ai/v1',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        },
        properties: [
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Chat',
                        value: 'chat',
                    },
                ],
                default: 'chat',
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            'chat',
                        ],
                    },
                },
                options: [
                    {
                        name: 'Message Model',
                        value: 'messageModel',
                        action: 'Message a model',
                        description: 'Create a completion with any LLM model',
                    },
                ],
                default: 'messageModel',
            },
            {
                displayName: 'Model Name or ID',
                name: 'model',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getModels',
                },
                required: true,
                default: '',
                description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
                displayOptions: {
                    show: {
                        resource: ['chat'],
                        operation: ['messageModel'],
                    },
                },
            },
            {
                displayName: 'Messages',
                name: 'messages',
                type: 'fixedCollection',
                typeOptions: {
                    multipleValues: true,
                    sortable: true,
                },
                default: {},
                description: 'The messages to send with the request',
                placeholder: 'Add Message',
                displayOptions: {
                    show: {
                        resource: ['chat'],
                        operation: ['messageModel'],
                    },
                },
                options: [
                    {
                        name: 'messagesValues',
                        displayName: 'Message',
                        values: [
                            {
                                displayName: 'Role',
                                name: 'role',
                                type: 'options',
                                options: [
                                    {
                                        name: 'Assistant',
                                        value: 'assistant',
                                    },
                                    {
                                        name: 'System',
                                        value: 'system',
                                    },
                                    {
                                        name: 'User',
                                        value: 'user',
                                    },
                                ],
                                default: 'user',
                                description: 'The role of the message sender',
                            },
                            {
                                displayName: 'Content',
                                name: 'content',
                                type: 'string',
                                default: '',
                                description: 'The content of the message',
                                typeOptions: {
                                    rows: 4,
                                },
                                noDataExpression: false,
                            },
                        ],
                    },
                ],
            },
            {
                displayName: 'Transformed Messages',
                name: 'transformedMessages',
                type: 'string',
                default: '',
                required: true,
                displayOptions: {
                    hide: {
                        operation: [
                            'messageModel',
                        ],
                    },
                },
            },
            {
                displayName: 'Performance Settings',
                name: 'performanceSettings',
                type: 'collection',
                placeholder: 'Add Settings',
                default: {},
                displayOptions: {
                    show: {
                        resource: ['chat'],
                        operation: ['messageModel'],
                    },
                },
                options: [
                    {
                        displayName: 'Min Throughput',
                        name: 'minThroughput',
                        type: 'number',
                        default: 50,
                        description: 'Minimum throughput in tokens/sec',
                    },
                    {
                        displayName: 'Max Latency',
                        name: 'maxLatency',
                        type: 'number',
                        default: 1000,
                        description: 'Maximum latency in milliseconds',
                    },
                ],
            },
            {
                displayName: 'Additional Fields',
                name: 'additionalFields',
                type: 'collection',
                placeholder: 'Add Field',
                default: {},
                displayOptions: {
                    show: {
                        resource: ['chat'],
                        operation: ['messageModel'],
                    },
                },
                options: [
                    {
                        displayName: 'Max Tokens',
                        name: 'maxTokens',
                        type: 'number',
                        default: 1024,
                        description: 'Maximum number of tokens to generate',
                    },
                    {
                        displayName: 'Temperature',
                        name: 'temperature',
                        type: 'number',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 2,
                        },
                        default: 1,
                        description: 'Controls randomness. Lower is more deterministic, higher is more random.',
                    },
                    {
                        displayName: 'Stream',
                        name: 'stream',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to stream back partial progress',
                    },
                    {
                        displayName: 'Simplify Output',
                        name: 'simplifyOutput',
                        type: 'boolean',
                        default: false,
                        description: 'Return only the LLM response message',
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions) {
        const items = this.getInputData();
        const returnData = [];

        LoggerProxy.info('Démarrage de l\'exécution du nœud MakeHub');

        for (let i = 0; i < items.length; i++) {
            try {
                LoggerProxy.debug('Traitement de l\'item', { itemIndex: i });
                const resource = this.getNodeParameter('resource', i) as string;
                const operation = this.getNodeParameter('operation', i) as string;

                LoggerProxy.debug('Paramètres de base', { resource, operation });

                if (resource === 'chat' && operation === 'messageModel') {
                    // Nouveaux logs pour la récupération des messages
                    LoggerProxy.debug('Récupération des paramètres messages', { itemIndex: i });
                    const messages = this.getNodeParameter('messages', i) as { messagesValues: { role: string; content: string }[] };
                    LoggerProxy.debug('Structure des messages récupérés', { 
                        hasMessages: !!messages, 
                        hasMessagesValues: !!messages?.messagesValues,
                        messagesCount: messages?.messagesValues?.length || 0 
                    });
                    
                    if (messages?.messagesValues?.length) {
                        // Logs détaillés pour chaque message avant transformation
                        messages.messagesValues.forEach((msg, idx) => {
                            LoggerProxy.debug(`Message #${idx} avant transformation:`, {
                                role: msg.role,
                                content: msg.content,
                                contentType: typeof msg.content,
                                contentLength: msg.content.length,
                                contentIsExpression: msg.content.includes('{{') || msg.content.includes('$')
                            });
                        });
                        
                        LoggerProxy.info('Début de transformation des messages');
                        
                        const transformedMessages = await Promise.all(
                            messages.messagesValues.map(async (msg, index) => {
                                // Ne pas ajouter "=" si le contenu ne contient pas d'expression
                                const hasExpression = msg.content.includes('{{') || msg.content.includes('$');
                                const expressionString = hasExpression ? `=${msg.content}` : msg.content;
                                
                                LoggerProxy.debug(`Préparation évaluation du message #${index}:`, {
                                    expressionString,
                                    originalContent: msg.content,
                                    hasExpression
                                });

                                try {
                                    let evaluatedContent;
                                    if (hasExpression) {
                                        LoggerProxy.debug(`Appel à evaluateExpression pour message #${index}`);
                                        evaluatedContent = await this.evaluateExpression(expressionString, i);
                                    } else {
                                        evaluatedContent = expressionString;
                                    }
                                    
                                    LoggerProxy.debug(`Résultat évaluation message #${index}:`, {
                                        before: msg.content,
                                        after: evaluatedContent,
                                        changed: msg.content !== evaluatedContent,
                                        type: typeof evaluatedContent
                                    });

                                    return {
                                        role: msg.role,
                                        content: evaluatedContent as string,
                                    };
                                } catch (evalError) {
                                    LoggerProxy.error(`Erreur évaluation expression message #${index}:`, {
                                        expression: expressionString,
                                        error: evalError.message,
                                        stack: evalError.stack
                                    });
                                    throw new NodeOperationError(
                                        this.getNode(),
                                        `Erreur lors de l'évaluation de l'expression '${msg.content}': ${evalError.message}`,
                                        {
                                            description: `Une erreur s'est produite lors de l'évaluation de l'expression dans le message #${index}`,
                                            itemIndex: i,
                                        }
                                    );
                                }
                            })
                        );

                        // Log final après transformation
                        LoggerProxy.debug('Tous les messages après transformation:', {
                            original: messages.messagesValues.map(m => ({ role: m.role, content: m.content })),
                            transformed: transformedMessages
                        });

                        const body = {
                            model: this.getNodeParameter('model', i),
                            messages: transformedMessages,
                        };

                        LoggerProxy.debug('Corps de la requête construit:', body);

                        // Add additional fields if they exist
                        const additionalFields = this.getNodeParameter('additionalFields', i, {}) as {
                            maxTokens?: number;
                            temperature?: number;
                            stream?: boolean;
                            simplifyOutput?: boolean;
                        };

                        Object.assign(body, {
                            max_tokens: additionalFields.maxTokens,
                            temperature: additionalFields.temperature,
                            stream: additionalFields.stream,
                        });

                        // Add performance settings if they exist
                        const performanceSettings = this.getNodeParameter('performanceSettings', i, {}) as {
                            minThroughput?: number;
                            maxLatency?: number;
                        };

                        if (performanceSettings.minThroughput || performanceSettings.maxLatency) {
                            Object.assign(body, {
                                extra_query: {
                                    min_throughput: performanceSettings.minThroughput?.toString(),
                                    max_latency: performanceSettings.maxLatency?.toString(),
                                },
                            });
                        }

                        const response = await this.helpers.httpRequest({
                            method: 'POST',
                            url: 'https://api.makehub.ai/v1/chat/completions',
                            body,
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${(await this.getCredentials('makeHubApi')).apiKey}`,
                            },
                        });

                        const simplifyOutput = this.getNodeParameter('additionalFields.simplifyOutput', i, false) as boolean;
                        
                        if (simplifyOutput && response.choices && response.choices[0]) {
                            returnData.push({ content: response.choices[0].message.content });
                        } else {
                            returnData.push(response);
                        }
                    }
                }
            } catch (error) {
                LoggerProxy.error('Erreur pendant l\'exécution:', {
                    message: error.message,
                    stack: error.stack,
                    itemIndex: i
                });

                if (this.continueOnFail()) {
                    returnData.push({ error: error.message });
                    continue;
                }
                throw error;
            }
        }

        LoggerProxy.info('Exécution terminée avec succès');
        return [this.helpers.returnJsonArray(returnData)];
    }

    methods = {
        loadOptions: {
            async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                try {
                    LoggerProxy.info('Début de récupération des modèles MakeHub');
                    const credentials = await this.getCredentials('makeHubApi');
                    
                    // Log avant la requête
                    LoggerProxy.debug('Envoi de requête avec headers:', {
                        baseUrl: 'https://api.makehub.ai/v1/models',
                        hasApiKey: !!credentials.apiKey
                    });
                    
                    const responseData = await this.helpers.request({
                        method: 'GET',
                        url: 'https://api.makehub.ai/v1/models',
                        headers: {
                            'Authorization': `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        json: true,
                    });
                    
                    // Logs détaillés de la réponse
                    LoggerProxy.info('Réponse reçue de l\'API MakeHub');
                    LoggerProxy.debug('Analyse de la réponse:', {
                        type: typeof responseData,
                        isArray: Array.isArray(responseData),
                        keys: Object.keys(responseData),
                        rawData: JSON.stringify(responseData, null, 2)
                    });

                    let modelsList: any[] = [];
                    
                    if (responseData && typeof responseData === 'object') {
                        LoggerProxy.debug('Analyse de la structure:', {
                            hasDataProperty: !!responseData.data,
                            hasModelsProperty: !!responseData.models,
                        });
                        
                        if (Array.isArray(responseData)) {
                            LoggerProxy.debug('La réponse est un tableau direct');
                            modelsList = responseData;
                        } else if (responseData.data && Array.isArray(responseData.data)) {
                            LoggerProxy.debug('La réponse contient un tableau dans data');
                            modelsList = responseData.data;
                        } else if (responseData.models && Array.isArray(responseData.models)) {
                            LoggerProxy.debug('La réponse contient un tableau dans models');
                            modelsList = responseData.models;
                        } else {
                            // Parcourir toutes les propriétés pour trouver un tableau
                            LoggerProxy.debug('Recherche d\'un tableau dans les propriétés');
                            for (const [key, value] of Object.entries(responseData)) {
                                if (Array.isArray(value)) {
                                    LoggerProxy.debug(`Tableau trouvé dans la propriété: ${key}`);
                                    modelsList = value;
                                    break;
                                }
                            }
                        }
                    }

                    LoggerProxy.debug('Structure des modèles trouvés:', {
                        nombreModeles: modelsList.length,
                        premierElement: modelsList.length > 0 ? modelsList[0] : null
                    });

                    if (modelsList.length === 0) {
                        LoggerProxy.warn('Aucun modèle trouvé dans la réponse');
                        return [{ name: 'Aucun Modèle Disponible', value: '' }];
                    }

                    const options: INodePropertyOptions[] = modelsList.map((model: any) => {
                        const modelId = model.model_id || model.id || model.name;
                        LoggerProxy.debug('Traitement du modèle:', { modelId, modelData: model });
                        return {
                            name: modelId,
                            value: modelId,
                        };
                    }).filter((option): option is INodePropertyOptions => !!option.value);

                    LoggerProxy.info(`${options.length} modèles convertis en options`);
                    LoggerProxy.debug('Options finales:', options);

                    return options;
                } catch (error) {
                    LoggerProxy.error('Erreur lors de la récupération des modèles:', {
                        message: (error as Error).message,
                        stack: (error as Error).stack,
                    });
                    
                    if ('response' in error) {
                        LoggerProxy.debug('Détails de la réponse d\'erreur:', {
                            status: error.response?.status,
                            statusText: error.response?.statusText,
                            data: error.response?.data,
                            headers: error.response?.headers,
                        });
                    }
                    
                    throw new NodeOperationError(
                        this.getNode(),
                        `Erreur lors de la récupération des modèles: ${(error as Error).message}`
                    );
                }
            },
        },
    };
}