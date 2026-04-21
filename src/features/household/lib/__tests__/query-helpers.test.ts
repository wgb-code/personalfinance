/**
 * Testes de helpers de query (RN-22.1).
 */
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import {
  clearHouseholdQueries,
  invalidateHouseholdMemberQueries,
} from "@/features/household/lib/query-helpers";

describe("clearHouseholdQueries", () => {
  test("remove queries que começam com 'household'", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["household"], { id: "hh-1" });
    queryClient.setQueryData(["household-members"], []);
    queryClient.setQueryData(["household-audit"], []);
    queryClient.setQueryData(["current-household"], { household_id: "hh-1" });
    queryClient.setQueryData(["other-query"], { data: "keep" });

    clearHouseholdQueries(queryClient);

    expect(queryClient.getQueryData(["household"])).toBeUndefined();
    expect(queryClient.getQueryData(["household-members"])).toBeUndefined();
    expect(queryClient.getQueryData(["household-audit"])).toBeUndefined();
    expect(queryClient.getQueryData(["current-household"])).toBeUndefined();
    expect(queryClient.getQueryData(["other-query"])).toEqual({ data: "keep" });
  });

  test("não remove queries sem prefix household", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user-profile"], { name: "João" });
    queryClient.setQueryData(["categories"], []);

    clearHouseholdQueries(queryClient);

    expect(queryClient.getQueryData(["user-profile"])).toEqual({
      name: "João",
    });
    expect(queryClient.getQueryData(["categories"])).toEqual([]);
  });
});

describe("invalidateHouseholdMemberQueries", () => {
  test("invalida queries household-members e household-audit", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateHouseholdMemberQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["household-members"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["household-audit"],
    });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);

    invalidateSpy.mockRestore();
  });
});
