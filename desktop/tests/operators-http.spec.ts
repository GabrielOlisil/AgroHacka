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
