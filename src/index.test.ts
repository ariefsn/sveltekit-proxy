import { describe, expect, it, vi } from "vitest";
import { handleProxy } from "./index";

const TARGET = "https://upstream.example";

const fakeFetchOk = () => vi.fn<typeof fetch>(async () => new Response("ok"));

function makeEvent(path = "/api/users", origin = "https://app.example") {
  return {
    url: new URL(`${origin}${path}`),
    request: new Request(`${origin}${path}`, { method: "GET" }),
  } as Parameters<ReturnType<typeof handleProxy>>[0]["event"];
}

const noopResolve = (() => new Response()) as Parameters<ReturnType<typeof handleProxy>>[0]["resolve"];

function invoke(handle: ReturnType<typeof handleProxy>, event = makeEvent()) {
  return handle({ event, resolve: noopResolve });
}

describe("handleProxy", () => {
  describe("URL construction", () => {
    it("forwards path and query to target", async () => {
      const fakeFetch = fakeFetchOk();
      const handle = handleProxy({ target: TARGET, fetch: fakeFetch });

      await invoke(handle, makeEvent("/api/users?id=1"));

      const calledUrl = fakeFetch.mock.calls[0]?.[0] as unknown as URL;
      expect(calledUrl.toString()).toBe(`${TARGET}/api/users?id=1`);
    });

    it("applies rewrite() to the path", async () => {
      const fakeFetch = fakeFetchOk();
      const handle = handleProxy({
        target: TARGET,
        rewrite: (p) => p.replace(/^\/api/, ""),
        fetch: fakeFetch,
      });

      await invoke(handle, makeEvent("/api/users"));

      expect((fakeFetch.mock.calls[0][0] as URL).pathname).toBe("/users");
    });
  });

  describe("origin guard", () => {
    it("throws 403 when origin is set and does not match", async () => {
      const handle = handleProxy({
        target: TARGET,
        origin: "https://allowed.example",
        fetch: vi.fn(),
      });

      await expect(invoke(handle, makeEvent("/api", "https://evil.example"))).rejects.toMatchObject({
        status: 403,
      });
    });

    it("allows the request when origin matches", async () => {
      const fakeFetch = fakeFetchOk();
      const handle = handleProxy({
        target: TARGET,
        origin: "https://app.example",
        fetch: fakeFetch,
      });

      await invoke(handle);

      expect(fakeFetch).toHaveBeenCalledOnce();
    });
  });

  describe("onRequest", () => {
    it("forwards the modified Request when callback returns one", async () => {
      const fakeFetch = fakeFetchOk();
      const handle = handleProxy({
        target: TARGET,
        fetch: fakeFetch,
        onRequest: ({ request }) => {
          const headers = new Headers(request.headers);
          headers.set("x-injected", "yes");
          return new Request(request, { headers });
        },
      });

      await invoke(handle);

      const forwarded = fakeFetch.mock.calls[0][1] as Request;
      expect(forwarded.headers.get("x-injected")).toBe("yes");
    });

    it("forwards the original Request when callback returns void", async () => {
      const fakeFetch = fakeFetchOk();
      const event = makeEvent();
      const handle = handleProxy({
        target: TARGET,
        fetch: fakeFetch,
        onRequest: () => {
          // observe-only
        },
      });

      await invoke(handle, event);

      expect(fakeFetch.mock.calls[0][1]).toBe(event.request);
    });

    it("awaits async return values", async () => {
      const fakeFetch = fakeFetchOk();
      const handle = handleProxy({
        target: TARGET,
        fetch: fakeFetch,
        onRequest: async ({ request }) => {
          await new Promise((r) => setTimeout(r, 1));
          const headers = new Headers(request.headers);
          headers.set("x-async", "true");
          return new Request(request, { headers });
        },
      });

      await invoke(handle);

      const forwarded = fakeFetch.mock.calls[0][1] as Request;
      expect(forwarded).toBeInstanceOf(Request);
      expect(forwarded.headers.get("x-async")).toBe("true");
    });
  });

  describe("onResponse", () => {
    it("returns the original response when callback returns void", async () => {
      const upstream = new Response("upstream body");
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => upstream,
        onResponse: () => {
          // observe-only
        },
      });

      const result = await invoke(handle);

      expect(result).toBe(upstream);
    });

    it("returns the modified response when callback returns one", async () => {
      const upstream = new Response("upstream body", {
        headers: { "set-cookie": "sid=abc; Domain=upstream.example; Path=/" },
      });
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => upstream,
        onResponse: ({ response }) => {
          const cookies = response.headers.getSetCookie();
          const headers = new Headers(response.headers);
          headers.delete("set-cookie");
          for (const c of cookies) {
            headers.append("set-cookie", c.replace(/;\s*Domain=[^;]+/i, ""));
          }
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        },
      });

      const result = await invoke(handle);

      expect(result).not.toBe(upstream);
      const cookie = result.headers.get("set-cookie") ?? "";
      expect(cookie).not.toMatch(/Domain=/i);
      expect(cookie).toContain("sid=abc");
    });

    it("passes duration to the callback", async () => {
      const onResponse = vi.fn();
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => new Response("ok"),
        onResponse,
      });

      await invoke(handle);

      expect(onResponse).toHaveBeenCalledOnce();
      const arg = onResponse.mock.calls[0][0];
      expect(typeof arg.duration).toBe("number");
      expect(arg.duration).toBeGreaterThanOrEqual(0);
    });

    it("awaits async return values", async () => {
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => new Response("upstream"),
        onResponse: async () => {
          await new Promise((r) => setTimeout(r, 1));
          return new Response("rewritten");
        },
      });

      const result = await invoke(handle);

      expect(await result.text()).toBe("rewritten");
    });
  });

  describe("onError", () => {
    it("rethrows the original error when callback returns void", async () => {
      const boom = new Error("upstream down");
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => {
          throw boom;
        },
        onError: () => {
          // observe-only
        },
      });

      await expect(invoke(handle)).rejects.toBe(boom);
    });

    it("recovers with the returned Response", async () => {
      const fallback = new Response("fallback", { status: 503 });
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => {
          throw new Error("upstream down");
        },
        onError: () => fallback,
      });

      const result = await invoke(handle);

      expect(result).toBe(fallback);
      expect(result.status).toBe(503);
    });

    it("throws the replacement Error when callback returns one", async () => {
      const replacement = new Error("clean message");
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => {
          throw new Error("ugly upstream stack");
        },
        onError: () => replacement,
      });

      await expect(invoke(handle)).rejects.toBe(replacement);
    });

    it("awaits async return values", async () => {
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => {
          throw new Error("upstream down");
        },
        onError: async () => {
          await new Promise((r) => setTimeout(r, 1));
          return new Response("async fallback", { status: 502 });
        },
      });

      const result = await invoke(handle);

      expect(result.status).toBe(502);
      expect(await result.text()).toBe("async fallback");
    });

    it("rethrows the original error when no callback is provided", async () => {
      const boom = new Error("upstream down");
      const handle = handleProxy({
        target: TARGET,
        fetch: async () => {
          throw boom;
        },
      });

      await expect(invoke(handle)).rejects.toBe(boom);
    });
  });
});
