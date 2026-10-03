// No-op shim for native-only SDKs when bundling for web (see metro.config.js).
// Any named export resolves to a function returning null, so imports and JSX
// usage don't crash a web smoke render. Real usage is guarded by Platform.OS.
const noop = () => null;
const handler = { get: (_t, prop) => (prop === '__esModule' ? true : noop) };
const proxy = new Proxy(noop, handler);
module.exports = proxy;
module.exports.default = proxy;
