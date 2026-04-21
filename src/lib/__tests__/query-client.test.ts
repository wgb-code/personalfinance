/**
 * Testes unitários para `src/lib/query-client.ts`
 *
 * Verifica que o QueryClient singleton está configurado corretamente
 * com os defaults especificados para um app financeiro.
 */
import { describe, expect, it } from "vitest";
import { queryClient } from "@/lib/query-client";

describe("queryClient", () => {
  it("exporta uma instância de QueryClient", () => {
    expect(queryClient).toBeDefined();
    expect(typeof queryClient.getQueryCache).toBe("function");
    expect(typeof queryClient.getMutationCache).toBe("function");
  });

  describe("defaultOptions.queries", () => {
    it("define retry como 1 para queries", () => {
      const defaults = queryClient.getDefaultOptions();
      expect(defaults.queries?.retry).toBe(1);
    });

    it("define staleTime como 60 segundos", () => {
      const defaults = queryClient.getDefaultOptions();
      expect(defaults.queries?.staleTime).toBe(60_000);
    });

    it("desabilita refetch on window focus", () => {
      const defaults = queryClient.getDefaultOptions();
      expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    });
  });

  describe("defaultOptions.mutations", () => {
    it("define retry como 0 para mutations", () => {
      const defaults = queryClient.getDefaultOptions();
      expect(defaults.mutations?.retry).toBe(0);
    });
  });

  describe("cache isolation", () => {
    it("possui cache de queries isolado", () => {
      const queryCache = queryClient.getQueryCache();
      expect(queryCache).toBeDefined();
      expect(typeof queryCache.getAll).toBe("function");
    });

    it("possui cache de mutations isolado", () => {
      const mutationCache = queryClient.getMutationCache();
      expect(mutationCache).toBeDefined();
      expect(typeof mutationCache.getAll).toBe("function");
    });
  });

  describe("singleton pattern", () => {
    it("retorna a mesma instância em múltiplos imports", async () => {
      const { queryClient: client1 } = await import("@/lib/query-client");
      const { queryClient: client2 } = await import("@/lib/query-client");
      
      expect(client1).toBe(client2);
    });
  });
});
