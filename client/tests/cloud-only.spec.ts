import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";
import { parseSession } from "../src/offline/types";
import { pairingCredential } from "../src/offline/pairing";
import { createWorkspace } from "../src/workspace";

const operator = {
  role: "OPERADOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Ana",
  deviceId: "d",
  deviceToken: "tok_abc",
};
const legacy = { ...operator, localIp: "192.168.1.100", localPort: 3333 };
afterEach(() => vi.unstubAllGlobals());

describe("5.7-A: internet only, compatible with legacy sessions and QR codes", () => {
  it.each([
    { localIp: "192.168.1.100", localPort: 3333 },
    { localIp: null, localPort: 0 },
    { localIp: {}, localPort: "obsolete" },
  ])("ignores obsolete LAN fields without dropping credentials", (fields) => {
    expect(parseSession({ ...operator, ...fields })).toEqual(operator);
  });

  it("strips LAN fields from cloud connection and newly displayed pairing QR", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      return Response.json(
        request.url.endsWith("/connect")
          ? {
              sucesso: true,
              deviceId: "d",
              farmId: "f",
              farmNome: "Fazenda",
              nomeOperador: "Ana",
              deviceToken: "tok_abc",
              localIp: {},
              localPort: 0,
            }
          : {
              deviceToken: "tok_abc",
              pairingCode: "AGRO-TEST",
              qrPayload: {
                farmId: "f",
                farmNome: "Fazenda",
                nomeOperador: "Ana",
                deviceToken: "tok_abc",
                localIp: "192.168.1.100",
                localPort: 3333,
              },
            },
      );
    });
    const api = createApi("https://cloud.test", fetcher);
    expect(await api.connect({ tokenOrCode: "AGRO-TEST" })).toEqual(operator);
    const pairing = await api.pairing(
      { farmId: "f", nomeOperador: "Ana" },
      { ...operator, role: "GESTOR", accessToken: "signed" },
    );
    expect(pairing.qrPayload).toEqual({
      farmId: "f",
      farmNome: "Fazenda",
      nomeOperador: "Ana",
      deviceToken: "tok_abc",
    });
    expect(
      pairingCredential(
        JSON.stringify({
          ...pairing.qrPayload,
          localIp: "192.168.1.100",
          localPort: 3333,
        }),
      ),
    ).toBe("tok_abc");
    expect("updateLocalIp" in api).toBe(false);
  });

  it.each([
    new TypeError("offline"),
    Object.assign(new Error("Token expirado"), { status: 401 }),
  ])(
    "never contacts a local IP, and preserves pending data after cloud failure: %s",
    async (cause) => {
      const lanFetch = vi
        .fn()
        .mockRejectedValue(new Error("LAN must never be contacted"));
      vi.stubGlobal("fetch", lanFetch);
      const pending = [
        {
          id: "same-uuid",
          farmId: "f",
          productId: "p",
          tipo: "SAIDA",
          quantidade: 1,
          dataMovimento: "2026-10-16T10:00:00Z",
          responsavel: "Ana",
        },
      ];
      const store = {
        loadSession: vi.fn().mockResolvedValue(legacy),
        snapshot: vi.fn().mockResolvedValue({ products: [], movements: [] }),
        pending: vi.fn().mockResolvedValue(pending),
        lastSync: vi.fn().mockResolvedValue(null),
        syncReviews: vi.fn().mockResolvedValue([]),
        saveAlerts: vi.fn(),
        clearSession: vi.fn(),
        applySyncResponse: vi.fn(),
      };
      const api = { sync: vi.fn().mockRejectedValue(cause) };
      const workspace = createWorkspace({
        openStore: async () => store as never,
        api: api as never,
        backups: {
          create: vi.fn(),
          list: vi.fn().mockResolvedValue([]),
          restore: vi.fn(),
        },
      });
      await workspace.initialize();
      await workspace.sync();
      await workspace.sync();
      expect(lanFetch).not.toHaveBeenCalled();
      expect(api.sync).toHaveBeenCalledTimes(2);
      expect(
        api.sync.mock.calls.map(([payload]) => payload.pendingMovements),
      ).toEqual([pending, pending]);
      expect(store.applySyncResponse).not.toHaveBeenCalled();
      expect(store.clearSession).not.toHaveBeenCalled();
      expect(workspace.session.value?.deviceToken).toBe("tok_abc");
      expect(workspace.pendingCount.value).toBe(1);
      expect(workspace.pendingIds.value).toEqual(pending.map((m) => m.id));
      expect(workspace.error.value).toContain(
        "Os registros locais foram preservados",
      );
      expect("updateLocalIp" in workspace).toBe(false);
      workspace.dispose();
    },
  );
});
