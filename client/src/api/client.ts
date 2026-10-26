import createClient from "openapi-fetch";
import type { paths } from "../types/contract";
import {
  object,
  parseSession,
  parsePairedOperators,
  parseSyncResponse,
  text,
  type ConnectInput,
  type LoginInput,
  type PairingInput,
  type PairingResponse,
  type RegisterInput,
  type Session,
  type SyncPayload,
  type SyncResponse,
} from "../offline/types";

// URL da API injetada pelo Vite em tempo de build a partir de:
//   .env.development  → dev  (`npm run dev` / `tauri dev`)
//   .env.production   → prod (`npm run build` / `tauri build`)
// Em produção este valor é embutido no binário — não há leitura de arquivo em runtime.
const _apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (!_apiUrl) {
  throw new Error(
    "VITE_API_URL não definida. Crie client/.env.development ou client/.env.production antes de compilar.",
  );
}
export const API_URL: string = _apiUrl;

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function createApi(
  baseUrl = API_URL,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15_000,
) {
  const client = createClient<paths>({ baseUrl, fetch: fetcher });
  const headers = (session?: Session) => ({
    ...(session?.accessToken
      ? { Authorization: `Bearer ${session.accessToken}` }
      : {}),
    ...(session?.deviceToken ? { "X-Device-Token": session.deviceToken } : {}),
  });
  async function unpack(result: {
    response: Response;
    data?: unknown;
    error?: unknown;
  }): Promise<unknown> {
    if (!result.response.ok) {
      const value = result.error;
      const message =
        value && typeof value === "object" && "message" in value
          ? String(value.message)
          : `Falha na API (${result.response.status}).`;
      throw new ApiError(message, result.response.status);
    }
    // Respostas sem schema no contrato são lidas e validadas na fronteira HTTP.
    return result.data;
  }
  const signal = () => AbortSignal.timeout(timeoutMs);
  function auth(value: unknown): Session {
    const response = object(value);
    const user = object(response.user);
    return parseSession({
      role: user.role,
      userId: text(user.id, "usuário"),
      farmId: user.farmId,
      farmNome: user.farmNome,
      nome: user.nome,
      accessToken: text(response.accessToken, "token de acesso"),
      telefone: user.telefone,
    });
  }
  return {
    async testWhatsApp(
      session: Session,
      paraTelefone: string,
    ): Promise<{ simulado: boolean }> {
      if (session.role !== "GESTOR")
        throw new Error("Somente o gestor pode testar os alertas de WhatsApp.");
      const result = object(
        await unpack(
          await client.POST("/notifications/test-whatsapp", {
            body: { paraTelefone: text(paraTelefone, "WhatsApp") },
            headers: {
              Authorization: `Bearer ${text(session.accessToken, "token do gestor")}`,
            },
            signal: signal(),
          }),
        ),
      );
      // A API responde HTTP 200 mesmo quando a Twilio recusa a mensagem.
      if (result.sucesso !== true)
        throw new Error(
          typeof result.erro === "string" && result.erro
            ? result.erro
            : "A mensagem de teste não foi enviada.",
        );
      return { simulado: result.modo === "SIMULADO" };
    },
    async listOperators(session: Session) {
      if (session.role !== "GESTOR")
        throw new Error(
          "Somente o gestor pode consultar códigos de operadores.",
        );
      const authorization = `Bearer ${text(session.accessToken, "token do gestor")}`;
      const result = await unpack(
        await client.GET("/devices", {
          params: { header: { authorization } },
          cache: "no-store",
          signal: signal(),
        }),
      );
      return parsePairedOperators(result, session.farmId);
    },
    async login(body: LoginInput): Promise<Session> {
      return auth(
        await unpack(
          await client.POST("/auth/login", { body, signal: signal() }),
        ),
      );
    },
    async register(body: RegisterInput): Promise<Session> {
      return auth(
        await unpack(
          await client.POST("/auth/register", { body, signal: signal() }),
        ),
      );
    },
    async connect(body: ConnectInput): Promise<Session> {
      const result = object(
        await unpack(
          await client.POST("/devices/connect", { body, signal: signal() }),
        ),
      );
      if (result.sucesso !== true)
        throw new Error("Pareamento não confirmado.");
      return parseSession({
        role: "OPERADOR",
        farmId: result.farmId,
        farmNome: result.farmNome,
        nome: result.nomeOperador,
        deviceId: text(result.deviceId, "dispositivo"),
        localIp: result.localIp,
        localPort: result.localPort,
        ...(typeof result.deviceToken === "string"
          ? { deviceToken: text(result.deviceToken, "token do dispositivo") }
          : body.tokenOrCode.startsWith("tok_")
            ? { deviceToken: body.tokenOrCode }
            : {}),
      });
    },
    async pairing(
      body: PairingInput,
      session: Session,
    ): Promise<PairingResponse> {
      if (session.role !== "GESTOR" || body.farmId !== session.farmId)
        throw new Error(
          "Somente o gestor pode parear operadores desta fazenda.",
        );
      const result = object(
        await unpack(
          await client.POST("/devices/pairing-token", {
            params: {
              header: {
                authorization: `Bearer ${text(session.accessToken, "token do gestor")}`,
              },
            },
            body,
            headers: headers(session),
            signal: signal(),
          }),
        ),
      );
      const qr = object(result.qrPayload);
      if (qr.farmId !== session.farmId)
        throw new Error("Pareamento de outra fazenda.");
      return {
        deviceToken: text(result.deviceToken, "token"),
        pairingCode: text(result.pairingCode, "código"),
        qrPayload: {
          farmId: text(qr.farmId, "fazenda"),
          farmNome: text(qr.farmNome, "nome da fazenda"),
          nomeOperador: text(qr.nomeOperador, "operador"),
          deviceToken: text(qr.deviceToken, "token"),
          localIp: typeof qr.localIp === "string" ? qr.localIp : null,
          localPort: typeof qr.localPort === "number" ? qr.localPort : 3333,
        },
      };
    },
    async sync(body: SyncPayload, session: Session): Promise<SyncResponse> {
      if (body.farmId !== session.farmId)
        throw new Error("Fazenda de sincronização inválida.");
      const result = object(
        await unpack(
          await client.POST("/sync", {
            body: { ...body, protocolVersion: 2 },
            headers: headers(session),
            signal: signal(),
          }),
        ),
      );
      return parseSyncResponse(
        result,
        session.farmId,
        body.pendingMovements ?? [],
      );
    },
    async updateLocalIp(
      body: { farmId: string; localIp: string; localPort?: number },
      session: Session,
    ) {
      if (session.role !== "GESTOR" || body.farmId !== session.farmId)
        throw new Error("Somente o gestor pode atualizar o IP da fazenda.");
      const result = object(
        await unpack(
          await (client as any).POST("/devices/local-ip", {
            body,
            headers: headers(session),
            signal: signal(),
          }),
        ),
      );
      return result;
    },
  };
}
export type Api = ReturnType<typeof createApi>;
