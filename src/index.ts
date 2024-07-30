import { error, Handle } from "@sveltejs/kit";

export type TProxyHandleOptions = {
  target: string;
  origin?: string;
  rewrite?: (path: string) => string;
};

export type TProxyHandle = (props: TProxyHandleOptions) => Handle;

export const handleProxy: TProxyHandle = ({ origin, target, rewrite }) => async ({ event }) => {
  // avoid proxy being abused.
  if (origin && (event.url.origin !== origin)) {
    throw error(403, "Request Forbidden.");
  }

  const strippedPath = rewrite ? rewrite(event.url.pathname) : event.url.pathname;

  // build the new URL
  const urlPath = `${target}${strippedPath}${event.url.search}`;
  const proxiedUrl = new URL(urlPath);

  // Strip off header added by SvelteKit yet forbidden by underlying HTTP request
  // library `undici`.
  // https://github.com/nodejs/undici/issues/1470
  event.request.headers.delete("connection");

  return fetch(proxiedUrl, event.request).catch((err) => {
    throw err;
  });
}