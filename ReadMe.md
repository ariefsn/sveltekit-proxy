# SvelteKit Proxy

This package is for creating proxies in SvelteKit applications. Since the vite proxy is only applicable in development mode based on the [docs](https://vitejs.dev/config/server-options#server-proxy).

## How to

1. Install

    ```shell
    npm install sveltekit-proxy
    // or
    yarn add sveltekit-proxy
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

      if (event.url.pathname.includes(apiPath)) {
        return handleProxy({
          target: "some domain",
          rewrite: (path) => path.replace(apiPath, ''),
          origin: "origin"
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
