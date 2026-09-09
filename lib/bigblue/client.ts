const BIGBLUE_BASE_URL =
  "https://api.bigblue.co/bigblue.storeapi.v1.PublicAPI";
const DEFAULT_TIMEOUT_MS = 2_000;

export type BigblueRequest = <TRequest, TResponse>(
  method: string,
  payload: TRequest,
) => Promise<TResponse>;

type BigblueClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
};

export class BigblueApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "BigblueApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(date - Date.now(), 0);
}

function getApiErrorDetails(value: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!isRecord(value)) {
    return { code: null, message: null };
  }

  return {
    code: typeof value.code === "string" ? value.code : null,
    message:
      typeof value.msg === "string"
        ? value.msg
        : typeof value.message === "string"
          ? value.message
          : null,
  };
}

export function createBigblueClient({
  apiKey,
  baseUrl = BIGBLUE_BASE_URL,
  fetchImplementation = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: BigblueClientOptions): BigblueRequest {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return async function bigblueRequest<TRequest, TResponse>(
    method: string,
    payload: TRequest,
  ): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImplementation(`${normalizedBaseUrl}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });

      const responseText = await response.text();
      let responseBody: unknown = null;

      if (responseText) {
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          throw new BigblueApiError(
            "Bigblue returned invalid JSON",
            response.status,
            null,
            response.status === 429 || response.status >= 500,
          );
        }
      }

      if (!response.ok) {
        const details = getApiErrorDetails(responseBody);
        throw new BigblueApiError(
          details.message ?? `Bigblue request failed with HTTP ${response.status}`,
          response.status,
          details.code,
          response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
          parseRetryAfter(response.headers.get("retry-after")),
        );
      }

      return responseBody as TResponse;
    } catch (error) {
      if (error instanceof BigblueApiError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new BigblueApiError(
          "Bigblue request timed out",
          null,
          "timeout",
          true,
        );
      }

      throw new BigblueApiError(
        "Bigblue network request failed",
        null,
        "network_error",
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}
