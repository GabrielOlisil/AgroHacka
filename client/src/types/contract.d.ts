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
    "/auth/telefone": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["AuthController_updateTelefone"];
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
    "/devices/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["DevicesController_deleteOperator"];
        options?: never;
        head?: never;
        patch: operations["DevicesController_updateOperator"];
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
    "/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["ProductsController_create"];
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
        UpdateTelefoneDto: {
            telefone?: string | null;
        };
        AnalyzeStockDto: Record<string, never>;
        SendTestWhatsAppDto: {
            paraTelefone: string;
            mensagem?: string;
        };
        DispatchAlertsDto: {
            farmId: string;
        };
        UpdateOperatorDto: {
            nomeOperador?: string;
            ativo?: boolean;
        };
        OperatorMutationResponseDto: {
            farmId: string;
            id: string;
            sucesso: boolean;
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
        CreateProductDto: {
            /** @description UUID criado pelo cliente uma única vez e preservado nos retries. */
            id: string;
            nome: string;
            /** @description Categoria livre, incluindo Unicode. */
            categoria: string;
            /** @description Texto livre; aliases conhecidos são normalizados sem conversão de quantidade. */
            unidadeMedida: string;
            /** @description Número finito maior ou igual a zero; não representa saldo inicial. */
            estoqueMinimo: number;
            /** @description Ausente/null significa preço desconhecido; zero informado é válido. */
            precoAquisicao?: number | null;
            /** @description Data de calendário válida em YYYY-MM-DD; ausente/null significa desconhecida. */
            validade?: string | null;
            lote?: string | null;
            fornecedor?: string | null;
        };
        ProductResponseDto: {
            id: string;
            farmId: string;
            nome: string;
            categoria: string;
            unidadeMedida: string;
            estoqueMinimo: number;
            precoAquisicao: number | null;
            /** @description ISO 8601 à meia-noite UTC, compatível com newProducts no download de sync. */
            validade: string | null;
            lote: string | null;
            fornecedor: string | null;
            createdAt: string;
            updatedAt: string;
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
    AuthController_updateTelefone: {
        parameters: {
            query?: never;
            header: {
                /** @description JWT do gestor da fazenda. */
                authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateTelefoneDto"];
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
    StockController_analyze: {
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
                "application/json": components["schemas"]["AnalyzeStockDto"];
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
    NotificationsController_sendTest: {
        parameters: {
            query?: never;
            header: {
                /** @description JWT do gestor da fazenda. */
                authorization: string;
            };
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
            header: {
                /** @description JWT do gestor da fazenda. */
                authorization: string;
            };
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
    DevicesController_deleteOperator: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorMutationResponseDto"];
                };
            };
        };
    };
    DevicesController_updateOperator: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOperatorDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorMutationResponseDto"];
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
    ProductsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProductDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponseDto"];
                };
            };
        };
    };
}
