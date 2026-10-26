export interface paths {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["AppController_getHello"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["AuthController_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/stock/analyze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["StockController_analyze"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/test-whatsapp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["NotificationsController_sendTest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/dispatch-critical": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["NotificationsController_dispatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["DevicesController_listOperators"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices/pairing-token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["DevicesController_createPairing"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices/local-ip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["DevicesController_updateLocalIp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices/connect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["DevicesController_connect"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["SyncController_sync"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sync/heartbeat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["SyncController_heartbeat"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        RegisterDto: {
            nome: string;
            email: string;
            senha: string;
            nomeFazenda: string;
            telefone?: string;
        };
        LoginDto: {
            email: string;
            senha?: string;
            password?: string;
        };
        AnalyzeStockDto: Record<string, never>;
        SendTestWhatsAppDto: {
            paraTelefone: string;
            mensagem?: string;
        };
        DispatchAlertsDto: {
            farmId: string;
        };
        PairedOperatorDto: {
            id: string;
            farmId: string;
            nomeOperador: string;
            ativo: boolean;
            pairingCode: string | null;
            createdAt: string;
        };
        OperatorsResponseDto: {
            farmId: string;
            operators: components["schemas"]["PairedOperatorDto"][];
        };
        CreatePairingDto: {
            farmId: string;
            nomeOperador: string;
        };
        UpdateLocalIpDto: {
            farmId: string;
            localIp: string;
            localPort?: number;
        };
        ConnectDeviceDto: {
            tokenOrCode: string;
        };
        SyncMovementDto: {
            id: string;
            farmId: string;
            productId: string;
            /** @enum {string} */
            tipo: "ENTRADA" | "SAIDA";
            quantidade: number;
            dataMovimento: string;
            destino?: string;
            responsavel: string;
            updatedAt?: string;
        };
        SyncPayloadDto: {
            /** @enum {number} */
            protocolVersion?: 2;
            farmId: string;
            deviceId?: string;
            lastSyncTimestamp?: string;
            pendingMovements?: components["schemas"]["SyncMovementDto"][];
        };
        SyncReceiptDto: {
            id: string;
            /** @enum {string} */
            status: "ACCEPTED" | "ID_PAYLOAD_CONFLICT" | "VALIDATION_REJECTED";
            message?: string;
            movement?: components["schemas"]["SyncMovementDto"];
        };
        SyncProductDto: {
            id: string;
            farmId: string;
            nome: string;
            categoria: string;
            unidadeMedida: string;
            estoqueMinimo: number;
            precoAquisicao: number | null;
            validade: string | null;
            lote: string | null;
            fornecedor: string | null;
            updatedAt: string;
        };
        SyncDivergenceDto: {
            productId: string;
            saldo: number;
            message: string;
        };
        SyncResponseDto: {
            /** @enum {number} */
            protocolVersion: 2;
            sucesso: boolean;
            serverTimestamp: string;
            syncedCount: number;
            results: components["schemas"]["SyncReceiptDto"][];
            newMovements: components["schemas"]["SyncMovementDto"][];
            newProducts: components["schemas"]["SyncProductDto"][];
            divergences: components["schemas"]["SyncDivergenceDto"][];
        };
        HeartbeatDto: {
            farmId: string;
            localIp: string;
            localPort?: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    AppController_getHello: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": string;
                };
            };
        };
    };
    AuthController_register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    AuthController_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    StockController_analyze: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnalyzeStockDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    NotificationsController_sendTest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendTestWhatsAppDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    NotificationsController_dispatch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DispatchAlertsDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    DevicesController_listOperators: {
        parameters: {
            query?: never;
            header: {
                /** @description JWT do gestor da fazenda. */
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorsResponseDto"];
                };
            };
        };
    };
    DevicesController_createPairing: {
        parameters: {
            query?: never;
            header: {
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePairingDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DevicesController_updateLocalIp: {
        parameters: {
            query?: never;
            header: {
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateLocalIpDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DevicesController_connect: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConnectDeviceDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    SyncController_sync: {
        parameters: {
            query?: never;
            header?: {
                /** @description JWT do gestor; alternativamente envie x-device-token. */
                authorization?: string;
                /** @description Credencial de operador ativo; não combine com Authorization. */
                "x-device-token"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SyncPayloadDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SyncResponseDto"];
                };
            };
        };
    };
    SyncController_heartbeat: {
        parameters: {
            query?: never;
            header: {
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["HeartbeatDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
