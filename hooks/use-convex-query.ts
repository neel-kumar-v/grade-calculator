"use client";

import { useEffect } from "react";
import {
  useQuery_experimental,
  type OptionalRestArgsOrSkip,
} from "convex/react";
import { useConvexBackendHealth } from "@/components/convex-backend-health";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

type ConvexQuery = FunctionReference<"query">;

export type ConvexQueryState<T> =
  | { status: "pending" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

/** Full status for fallbacks and outage UI. */
export function useConvexQueryState<Query extends ConvexQuery>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): ConvexQueryState<FunctionReturnType<Query>> {
  const { reportQueryError } = useConvexBackendHealth();
  const queryArgs = (args[0] ?? {}) as FunctionArgs<Query> | "skip";
  const result = useQuery_experimental({
    query,
    args: queryArgs,
    throwOnError: false,
  });

  const queryError = result.status === "error" ? result.error : null;
  const queryErrorMessage = queryError ? queryError.message : "";

  useEffect(() => {
    if (queryError) {
      reportQueryError(queryError);
    }
  }, [reportQueryError, queryError, queryErrorMessage]);

  if (result.status === "success") {
    return { status: "success", data: result.data };
  }
  if (result.status === "error") {
    return { status: "error", error: result.error };
  }
  return { status: "pending" };
}

/** Convex `useQuery` that never throws — returns `undefined` while loading or on failure. */
export function useConvexQuery<Query extends ConvexQuery>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): FunctionReturnType<Query> | undefined {
  const state = useConvexQueryState(query, ...args);
  if (state.status === "success") {
    return state.data;
  }
  return undefined;
}
