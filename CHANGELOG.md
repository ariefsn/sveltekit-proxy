# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] – 2026-04-28

### Added

- `onResponse` may now return a `Response` to send a modified version to the client (e.g. rewrite `Set-Cookie` headers, transform the body, change status). Returning nothing keeps the original response. Resolves [#2](https://github.com/ariefsn/sveltekit-proxy/issues/2).
- `onError` may now return a `Response` to recover from a fetch failure with a fallback, or return an `Error` to replace the thrown error (e.g. wrap with SvelteKit's `error(502, ...)`). Returning nothing rethrows the original.
- All three callbacks (`onRequest`, `onResponse`, `onError`) now support async returns, so consumers can do async token refresh, body signing, fallback fetches, etc.

### Changed

- `onRequest` return type widened from `Request` to `Request | void | Promise<Request | void>`. Logging-only callbacks no longer need to return the request.
- Internal: switched the `onRequest` fallback from `||` to `??` so a falsy return doesn't accidentally drop the modified request.

### Tests

- Added a vitest test suite covering URL construction, the origin guard, and all three callback contracts (sync return, void return, async return, recovery, replacement). Run with `yarn test`.

### Docs

- README options table and example block updated to reflect the new return-to-influence semantics. Added a `Development` section.
- Renamed `ReadMe.md` → `README.md` for convention.
- Added a `LICENSE` file (MIT) and corrected `package.json` license field from `ISC` to `MIT` to match the README footer.

### Notes

This release is fully backward-compatible. Existing callbacks that return `void` (logging, metrics) continue to work unchanged.

## [1.0.3] – 2025-10-13

### Fixed

- `onRequest` callback handling.

## [1.0.0] – [1.0.2] – 2024-07-31

### Added

- Initial release of `handleProxy` with `target`, `origin`, `rewrite`, `fetch`, `onRequest`, `onResponse`, and `onError` options.

[1.1.0]: https://github.com/ariefsn/sveltekit-proxy/compare/v1.0.3...v1.1.0
