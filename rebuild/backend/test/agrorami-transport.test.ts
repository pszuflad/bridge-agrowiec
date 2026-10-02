import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createTransport } = require("../src/import/agrorami-worker.cjs") as {
  createTransport(fetch: typeof globalThis.fetch, wait?: (ms: number) => Promise<void>, timeout?: number): typeof globalThis.fetch;
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("Agrorami transport, ticket 183", () => {
  it("store=pl idzie do nagłówka, nie URL; odpowiedź pozostaje czytelna", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ data: { products: { items: [] } } }));
    const transport = createTransport(fetch);
    const result = await transport("https://hurtownia.agrorami.pl/graphql?store=pl", {
      headers: { Authorization: "Bearer test" }, body: JSON.stringify({ query: "{products{total_count}}" }),
    });
    expect(fetch.mock.calls[0]![0]).toBe("https://hurtownia.agrorami.pl/graphql");
    expect(fetch.mock.calls[0]![1].headers).toMatchObject({ Store: "pl", Authorization: "Bearer test" });
    expect(await result.json()).toHaveProperty("data.products");
  });

  it("ponawia błąd sieci i GraphQL internal, potem sukces", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(response({ errors: [{ message: "Internal server error" }] }))
      .mockResolvedValueOnce(response({ data: { products: {} } }));
    const wait = vi.fn().mockResolvedValue(undefined);
    await createTransport(fetch, wait)("https://hurtownia.agrorami.pl/graphql");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[2000], [4000]]);
  });

  it("3 błędy dostawcy dają czytelny komunikat, bez cennika i sekretów", async () => {
    const fetch = vi.fn().mockImplementation(async () =>
      response({ errors: [{ message: "Internal server error" }] }));
    await expect(createTransport(fetch, async () => {})("https://hurtownia.agrorami.pl/graphql"))
      .rejects.toThrow("Agrorami (produkty): API Agrorami zwraca Internal server error w GraphQL; próby: 3/3");
  });

  it("nie ponawia błędu autoryzacji, przekazuje go do odnowienia tokenu legacy", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ errors: [{ message: "Authentication error" }] }, 401));
    const result = await createTransport(fetch)("https://hurtownia.agrorami.pl/graphql");
    expect(result.status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("niepoprawny JSON 4xx nie jest ponawiany", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("<html>bad request</html>", { status: 400 }));
    await expect(createTransport(fetch)("https://hurtownia.agrorami.pl/graphql")).rejects.toThrow("niepoprawny JSON");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])("ponawia HTTP %s także dla odpowiedzi HTML", async status => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("<html>awaria</html>", { status }))
      .mockResolvedValueOnce(response({ data: {} }));
    await createTransport(fetch, async () => {})("https://hurtownia.agrorami.pl/graphql");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("timeout logowania ma rozpoznany etap; nie wyświetla hasła", async () => {
    const fetch = vi.fn().mockRejectedValue(Object.assign(new Error("secret"), { name: "TimeoutError" }));
    await expect(createTransport(fetch, async () => {}, 120000)("https://hurtownia.agrorami.pl/graphql", {
      body: JSON.stringify({ query: "mutation {generateCustomerToken}", variables: { password: "secret" } }),
    })).rejects.toThrow("Agrorami (logowanie): przekroczono limit 120 s; próby: 3/3");
  });
});
