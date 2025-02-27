import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

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
        inputs: ['main' as NodeConnectionType],
        outputs: ['main' as NodeConnectionType],
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
                        name: 'Create Completion',
                        value: 'createCompletion',
                        action: 'Create a chat completion',
                        description: 'Create a completion with a LLM model',
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
                displayName: 'Model',
                name: 'model',
                type: 'string',
                required: true,
                default: 'meta/Llama-3.3-70B-Instruct-fp16',
                description: 'ID of the model to use (e.g., meta/Llama-3.3-70B-Instruct-fp16)',
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
                        description: 'Stream back partial progress',
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
}