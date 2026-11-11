import type { EndpointDefinition } from "@/lib/api/endpoints";

export interface ApiRequestOptions<T> {
  endpoint: EndpointDefinition;
  resolver: () => T | Promise<T>;
  body?: unknown;
  path?: string;
  delayMs?: number;
  failRate?: number;
}

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";

export async function apiRequest<T>({
  endpoint,
  resolver,
  body,
  path,
  delayMs,
  failRate = 0,
}: ApiRequestOptions<T>): Promise<T> {
  if (useMocks) {
    if (typeof window !== "undefined") {
      const delay = delayMs ?? 250 + Math.floor(Math.random() * 451);
      await new Promise((resolve) => setTimeout(resolve, delay));
      const shouldFail =
        window.sessionStorage.getItem("paysafr-force-network-error") === "true" ||
        Math.random() < failRate;
      if (shouldFail) throw new Error("We couldn't connect. Check your connection and try again.");
    }
    return resolver();
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) throw new Error("NEXT_PUBLIC_API_BASE_URL is required when mock mode is disabled.");
  const response = await fetch(new URL(path ?? endpoint.path, baseUrl), {
    method: endpoint.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`The API request failed (${response.status}). Please try again.`);
  }
  return (await response.json()) as T;
}
