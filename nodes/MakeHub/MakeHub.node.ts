import { 
    INodeType, 
    INodeTypeDescription,
    ILoadOptionsFunctions,
    INodePropertyOptions,
    LoggerProxy,
    NodeOperationError,
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
                        name: 'Message a Model',
                        value: 'createCompletion',
                        action: 'Message a model',
                        description: 'Create a completion with any LLM model',
                        routing: {
                            request: {
                                method: 'POST',
                                url: '/chat/completions',
                            },
                        },
                    },
                ],
                default: 'createCompletion',
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
                        operation: ['createCompletion'],
                    },
                },
                routing: {
                    send: {
                        property: 'model',
                        type: 'body',
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
                        operation: ['createCompletion'],
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
                            },
                        ],
                    },
                ],
                routing: {
                    send: {
                        property: 'messages',
                        type: 'body',
                        value: '={{ $parameter["messages"].messagesValues }}',
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
                        operation: ['createCompletion'],
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
                routing: {
                    send: {
                        property: 'extra_query',
                        type: 'body',
                        value: '={{ { "min_throughput": $parameter["performanceSettings"]["minThroughput"] ? $parameter["performanceSettings"]["minThroughput"].toString() : undefined, "max_latency": $parameter["performanceSettings"]["maxLatency"] ? $parameter["performanceSettings"]["maxLatency"].toString() : undefined } }}',
                    },
                },
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
                        operation: ['createCompletion'],
                    },
                },
                options: [
                    {
                        displayName: 'Max Tokens',
                        name: 'maxTokens',
                        type: 'number',
                        default: 1024,
                        description: 'Maximum number of tokens to generate',
                        routing: {
                            send: {
                                property: 'max_tokens',
                                type: 'body',
                            },
                        },
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
                        routing: {
                            send: {
                                property: 'temperature',
                                type: 'body',
                            },
                        },
                    },
                    {
                        displayName: 'Stream',
                        name: 'stream',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to stream back partial progress',
                        routing: {
                            send: {
                                property: 'stream',
                                type: 'body',
                            },
                        },
                    },
                ],
            },
        ],
    };

    methods = {
        loadOptions: {
            async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                try {
                    LoggerProxy.info('Début de récupération des modèles MakeHub');
                    const credentials = await this.getCredentials('makeHubApi');
                    
                    if (!credentials.apiKey) {
                        LoggerProxy.error('Clé API manquante dans les credentials');
                        throw new NodeOperationError(this.getNode(), 'Clé API manquante');
                    }
                    
                    LoggerProxy.info('Envoi de requête à l\'API MakeHub');
                    const responseData = await this.helpers.request({
                        method: 'GET',
                        url: 'https://api.makehub.ai/v1/models',
                        headers: {
                            'Authorization': `Bearer ${credentials.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        json: true,
                    });
                    
                    LoggerProxy.info('Réponse reçue de l\'API MakeHub');
                    LoggerProxy.debug('Structure de la réponse:', { 
                        preview: JSON.stringify(responseData).substring(0, 500) + '...' 
                    });
                    
                    // Vérifier si la réponse contient une liste de modèles
                    // La réponse peut être soit un objet avec une propriété 'data', soit directement un tableau.
                    let modelsList: any[] = [];
                    
                    if (responseData && typeof responseData === 'object') {
                        if (Array.isArray(responseData)) {
                            // Si la réponse est directement un tableau
                            modelsList = responseData;
                        } else if (responseData.data && Array.isArray(responseData.data)) {
                            // Si la réponse est un objet avec une propriété 'data' qui est un tableau
                            modelsList = responseData.data;
                        } else {
                            // Chercher d'autres propriétés qui pourraient contenir la liste des modèles
                            const possibleArrayProps = Object.keys(responseData).find(key => 
                                Array.isArray(responseData[key]) && 
                                responseData[key].length > 0 && 
                                responseData[key][0].model_id
                            );
                            
                            if (possibleArrayProps) {
                                modelsList = responseData[possibleArrayProps];
                            }
                        }
                    }
                    
                    if (modelsList.length === 0) {
                        LoggerProxy.warn('Aucun modèle trouvé dans la réponse de l\'API');
                        LoggerProxy.debug('Contenu de la réponse:', { 
                            response: responseData 
                        });
                        return [{ name: 'Aucun modèle disponible', value: '' }];
                    }
                    
                    // Utiliser un Set pour les model_id uniques
                    const uniqueModelIds = new Set<string>();
                    
                    // Ajouter chaque model_id au Set
                    modelsList.forEach((model: any) => {
                        if (model && model.model_id) {
                            uniqueModelIds.add(model.model_id);
                        } else if (model && model.id) {
                            // Alternative: l'identifiant pourrait être dans la propriété 'id'
                            uniqueModelIds.add(model.id);
                        }
                    });
                    
                    if (uniqueModelIds.size === 0) {
                        LoggerProxy.warn('Aucun identifiant de modèle trouvé dans les données');
                        return [{ name: 'Format de modèle non reconnu', value: '' }];
                    }
                    
                    // Convertir le Set en tableau d'options
                    const options: INodePropertyOptions[] = Array.from(uniqueModelIds).map((modelId) => ({
                        name: modelId,
                        value: modelId,
                    }));
                    
                    LoggerProxy.info(`${options.length} modèles récupérés avec succès`);
                    return options;
                } catch (error) {
                    LoggerProxy.error('Erreur détaillée lors de la récupération des modèles:', error as Error);
                    if (error.response) {
                        LoggerProxy.debug('Détails de la réponse d\'erreur:', {
                            errorResponse: error.response.data
                        });
                    }
                    throw new NodeOperationError(this.getNode(), `Erreur lors de la récupération des modèles: ${(error as Error).message}`);
                }
            },
        },
    };
}