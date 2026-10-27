import { describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api/client";

const session = {
  role: "GESTOR" as const,
  farmId: "f",
  farmNome: "Fazenda",
  nome: "Gestor",
  accessToken: "signed",
};
const paired = {
  id: "d",
  farmId: "f",
  nomeOperador: "Ana",
  ativo: true,
  pairingCode: "AGRO-1234",
  createdAt: "2026-10-01T12:00:00.000Z",
};
describe("typed pairing lookup", () => {
  it.each(["update", "delete"] as const)(
    "uses typed authenticated %s with scoped acknowledgement",
    async (action) => {
      const fetcher = vi.fn<typeof fetch>(async (request) => {
        const req = request as Request;
        expect(new URL(req.url).pathname).toBe("/devices/d");
        expect(req.method).toBe(action === "update" ? "PATCH" : "DELETE");
        expect(req.headers.get("authorization")).toBe("Bearer signed");
        expect(req.headers.has("x-device-token")).toBe(false);
        if (action === "update")
          expect(await req.json()).toEqual({
            nomeOperador: "José",
            ativo: false,
          });
        return Response.json({ id: "d", farmId: "f", sucesso: true });
      });
      const api = createApi("http://api.test", fetcher);
      if (action === "update")
        await api.updateOperator(session, "d", {
          nomeOperador: " José ",
          ativo: false,
        });
      else await api.deleteOperator(session, "d");
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it.each([
    null,
    {},
    { id: "wrong", farmId: "f", sucesso: true },
    { id: "d", farmId: "foreign", sucesso: true },
    { id: "d", farmId: "f", sucesso: false },
  ])("rejects unconfirmed/foreign mutation responses %j", async (result) => {
    const api = createApi("http://api.test", async () => Response.json(result));
    await expect(api.deleteOperator(session, "d")).rejects.toThrow();
    await expect(
      api.updateOperator(session, "d", { ativo: true }),
    ).rejects.toThrow();
  });
  it.each([
    {},
    null,
    { nomeOperador: " " },
    { ativo: 1 },
    { farmId: "foreign" },
  ])("does not send an invalid update %j", async (patch) => {
    const fetcher = vi.fn();
    await expect(
      createApi("http://api.test", fetcher).updateOperator(
        session,
        "d",
        patch as never,
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["", " ", null])(
    "does not send absent ID %s or operator credentials",
    async (id) => {
      const fetcher = vi.fn();
      const api = createApi("http://api.test", fetcher);
      await expect(api.deleteOperator(session, id as never)).rejects.toThrow();
      await expect(
        api.deleteOperator({ ...session, role: "OPERADOR" }, "d"),
      ).rejects.toThrow(/gestor/i);
      await expect(
        api.updateOperator({ ...session, accessToken: undefined }, "d", {
          ativo: false,
        }),
      ).rejects.toThrow(/token/i);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("preserves network and HTTP mutation errors", async () => {
    await expect(
      createApi("http://api.test", async () => {
        throw new TypeError("offline");
      }).deleteOperator(session, "d"),
    ).rejects.toThrow("offline");
    await expect(
      createApi("http://api.test", async () =>
        Response.json({ message: "Not allowed" }, { status: 403 }),
      ).updateOperator(session, "d", { ativo: false }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("uses authenticated GET without cache and returns the existing code, never a new pairing", async () => {
    const fetcher = vi.fn<typeof fetch>(async (request) => {
      const req = request as Request;
      expect(new URL(req.url).pathname).toBe("/devices");
      expect(req.method).toBe("GET");
      expect(req.headers.get("authorization")).toBe("Bearer signed");
      expect(req.cache).toBe("no-store");
      return Response.json({
        farmId: "f",
        operators: [{ ...paired, deviceToken: "must-not-leak" }],
      });
    });
    expect(
      await createApi("http://api.test", fetcher).listOperators(session),
    ).toEqual([paired]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("accepts an empty result and inactive records with no reusable code", async () => {
    expect(
      await createApi("http://api.test", async () =>
        Response.json({ farmId: "f", operators: [] }),
      ).listOperators(session),
    ).toEqual([]);
    expect(
      await createApi("http://api.test", async () =>
        Response.json({
          farmId: "f",
          operators: [{ ...paired, ativo: false, pairingCode: null }],
        }),
      ).listOperators(session),
    ).toEqual([{ ...paired, ativo: false, pairingCode: null }]);
  });
  it("rejects operator sessions and missing manager credentials before fetching", async () => {
    const fetcher = vi.fn();
    const api = createApi("http://api.test", fetcher);
    await expect(
      api.listOperators({ ...session, role: "OPERADOR" }),
    ).rejects.toThrow(/gestor/i);
    await expect(
      api.listOperators({ ...session, accessToken: undefined }),
    ).rejects.toThrow(/token/i);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { farmId: "other", operators: [] },
    { farmId: "f", operators: null },
    { farmId: "f", operators: [paired, paired] },
    { farmId: "f", operators: [{ ...paired, farmId: "other" }] },
    { farmId: "f", operators: [{ ...paired, ativo: "true" }] },
    { farmId: "f", operators: [{ ...paired, pairingCode: null }] },
    { farmId: "f", operators: [{ ...paired, createdAt: "invalid" }] },
  ])("rejects malformed, duplicate or foreign-farm results", async (result) => {
    await expect(
      createApi("http://api.test", async () =>
        Response.json(result),
      ).listOperators(session),
    ).rejects.toThrow();
  });
  it("preserves authentication failures as HTTP errors rather than returning an empty list", async () => {
    await expect(
      createApi("http://api.test", async () =>
        Response.json({ message: "Unauthorized" }, { status: 401 }),
      ).listOperators(session),
    ).rejects.toMatchObject({ status: 401 });
  });
});
