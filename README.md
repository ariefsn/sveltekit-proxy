# SvelteKit Proxy

A lightweight proxy utility for **SvelteKit** applications.  
Since the built-in [Vite server proxy](https://vitejs.dev/config/server-options#server-proxy) only works in **development mode**,  
this package provides a simple way to proxy requests **in production** using SvelteKit's `hooks.server.ts`.

## How to

1. Install

    ```shell
    npm install sveltekit-proxy
    # or
    yarn add sveltekit-proxy
    # or
    bun add sveltekit-proxy
    ```

2. Import

    ```typescript
    import { handleProxy } from 'sveltekit-proxy';
    ```

3. Use it

    ```typescript
    // hooks.server.ts
    const apiPath = '/api'

    export const handle: Handle = async ({ event, resolve }) => {
      if (event.url.pathname.startsWith(apiPath)) {
        return handleProxy({
          target: 'https://example.com',
          rewrite: (path) => path.replace(apiPath, ''),
          origin: 'https://your-app-domain.com',
          onRequest: ({ request }) => {
            // Optionally modify the request before forwarding.
            // Return nothing to forward the original.
            const headers = new Headers(request.headers);
            headers.set('x-proxied-by', 'sveltekit-proxy');
            return new Request(request, { headers });
          },
          onResponse: ({ response, duration }) => {
            console.log(`[Proxy] ${response.status} in ${duration.toFixed(2)}ms`);

            // Optionally rewrite the response. Common case: strip Domain=...
            // from Set-Cookie so cookies bind to the proxy host, not upstream.
            const cookies = response.headers.getSetCookie();
            if (cookies.length === 0) return; // forward original
            const headers = new Headers(response.headers);
            headers.delete('set-cookie');
            for (const c of cookies) {
              headers.append('set-cookie', c.replace(/;\s*Domain=[^;]+/i, ''));
            }
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers,
            });
          },
          onError: ({ error, request }) => {
            console.error('[Proxy Error]', error, request.url);
            // Optionally recover with a fallback Response:
            // return new Response(JSON.stringify({ error: 'upstream unavailable' }), {
            //   status: 502, headers: { 'content-type': 'application/json' },
            // });
            // Or replace the thrown error (e.g., wrap with SvelteKit's error helper):
            // import { error } from '@sveltejs/kit';
            // return error(502, 'Upstream unavailable');
          },
        })({ event, resolve });
      }

      return resolve(event);
    };
    ```

4. Options

  | Name  | Description  | Required | Default  |
  |---|---|---|---|
  | `target`  | Target proxy URL  | Yes |   |
  | `origin` | Set to avoid the abused proxy, only permitted if the origin is valid. Default `undefined` which will allow from all | No  | `undefined` |
  | `rewrite` | Rewrite the `path` | No  | `undefined` |
  | `fetch` | Custom fetch function | No  | `undefined` |
  | `onRequest` | Callback to modify the outgoing Request. Return a `Request` to forward the modified version, or return nothing to forward the original. Async-friendly. | No  | `undefined` |
  | `onResponse` | Callback after receiving the upstream response. Return a `Response` to send a modified version to the client, or return nothing to forward the original. Async-friendly. | No  | `undefined` |
  | `onError` | Callback when fetch fails or throws. Return a `Response` to recover with a fallback, return an `Error` to replace the thrown error, or return nothing to rethrow the original. Async-friendly. | No  | `undefined` |

🪶 Notes

- The function returns a valid SvelteKit Handle — you can compose it inside your main handle chain.
- Request objects are immutable; to modify headers or body, return a new Request instance inside onRequest.

## Development

```shell
yarn install
yarn test          # run the vitest suite once
yarn test:watch    # watch mode
yarn build         # tsup → dist/
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) on GitHub.

🧱 License

MIT © 2025–2026 — Crafted for SvelteKit developers. See [LICENSE](LICENSE).