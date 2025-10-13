import { error, Handle } from "@sveltejs/kit";

export type TProxyOnRequestParams = { request: Request };

export type TProxyOnResponseParams = TProxyOnRequestParams & { response: Response, duration: number };

export type TProxyOnErrorParams = { error: unknown, request: Request };

export type TProxyHandleOptions = {
  target: string;
  origin?: string;
  rewrite?: (path: string) => string;
  fetch?: typeof fetch;
  onRequest?: (params: TProxyOnRequestParams) => Request;
  onResponse?: (params: TProxyOnResponseParams) => void;
  onError?: (params: TProxyOnErrorParams) => void;
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

  // Strip off header added by SvelteKit yet forbidden by underlying HTTP request
  // library `undici`.
  // https://github.com/nodejs/undici/issues/1470
  // ✅ Clone headers safely
  const headers = new Headers(event.request.headers);
  headers.delete("connection");

  // ✅ Create proxied request
  let newRequest = new Request(event.request, {
    headers
  });

  const finalFetch = customFetch || fetch;

  try {
    const start = performance.now();
    // ✅ Call onRequest callback if provided
    newRequest = onRequest?.({ request: newRequest }) || newRequest;
    const response = await finalFetch(proxiedUrl, newRequest);
    const end = performance.now();
    const duration = end - start;
    // ✅ Call onResponse callback if provided
    onResponse?.({ response, request: newRequest, duration });
    return response;
  } catch (err) {
    // ✅ Call onError callback if provided
    onError?.({ error: err, request: newRequest });
    throw err;
  }
}