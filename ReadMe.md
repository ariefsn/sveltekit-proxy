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
            // Optionally modify the request before forwarding
            const headers = new Headers(request.headers);
            headers.set('x-proxied-by', 'sveltekit-proxy');
            return new Request(request, { headers });
          },
          onResponse: ({ response, duration }) => {
            // Optionally log response info
            console.log(`[Proxy] ${response.status} in ${duration.toFixed(2)}ms`);
          },
          onError: ({ error, request }) => {
            console.error('[Proxy Error]', error, request.url);
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
  | `onRequest` | Callback to modify the outgoing Request before sending. Must return a Request. | No  | `undefined` |
  | `onResponse` | Callback after receiving the response. Useful for logging or metrics. | No  | `undefined` |
  | `onError` | Callback when fetch fails or throws an error. | No  | `undefined` |

🪶 Notes

- The function returns a valid SvelteKit Handle — you can compose it inside your main handle chain.
- Request objects are immutable; to modify headers or body, return a new Request instance inside onRequest.

🧱 License

MIT © 2025 — Crafted for SvelteKit developers.