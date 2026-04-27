import { error, Handle } from "@sveltejs/kit";

export type TProxyOnRequestParams = { request: Request };

export type TProxyOnResponseParams = TProxyOnRequestParams & { response: Response, duration: number };

export type TProxyOnErrorParams = { error: unknown, request: Request };

export type TProxyHandleOptions = {
  target: string;
  origin?: string;
  rewrite?: (path: string) => string;
  fetch?: typeof fetch;
  onRequest?: (params: TProxyOnRequestParams) => Request | void | Promise<Request | void>;
  onResponse?: (params: TProxyOnResponseParams) => Response | void | Promise<Response | void>;
  onError?: (params: TProxyOnErrorParams) => Response | Error | void | Promise<Response | Error | void>;
};

export type TProxyHandle = (props: TProxyHandleOptions) => Handle;

export const handleProxy: TProxyHandle = ({
  origin,
  target,
  rewrite,
  fetch:
  customFetch,
  onError,
  onResponse,
  onRequest,
}) => async ({ event }) => {
  // ✅ Strict origin check (optional but safer)
  if (origin && (event.url.origin !== origin)) {
    throw error(403, "Request Forbidden.");
  }

  // ✅ Cleanly build new target URL
  const strippedPath = rewrite ? rewrite(event.url.pathname) : event.url.pathname;
  const urlPath = `${target}${strippedPath}${event.url.search}`;
  const proxiedUrl = new URL(urlPath);

  // ✅ Create proxied request and call onRequest callback if provided
  const newRequest = (await onRequest?.({ request: event.request })) ?? event.request;

  const finalFetch = customFetch || fetch;

  try {
    const start = performance.now();
    const response = await finalFetch(proxiedUrl, newRequest);
    const end = performance.now();
    const duration = end - start;
    // ✅ Call onResponse callback; if it returns a Response, send that instead
    const maybeResponse = await onResponse?.({ response, request: newRequest, duration });
    return maybeResponse ?? response;
  } catch (err) {
    // ✅ Call onError callback; Response recovers, Error replaces, void rethrows
    const handled = await onError?.({ error: err, request: newRequest });
    if (handled instanceof Response) return handled;
    throw handled instanceof Error ? handled : err;
  }
}