/* global importScripts */

// Chrome MV3 accepts a single service worker entry. Keep the WebExtension
// Promise polyfill ahead of the application bundle so the shared Firefox and
// Chrome sources can continue to use the `browser` namespace.
importScripts("lib/browser-polyfill.js", "background.js");
