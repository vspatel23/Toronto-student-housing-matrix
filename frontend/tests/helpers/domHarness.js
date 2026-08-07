import { JSDOM } from "jsdom";
import { createServer } from "vite";

const domGlobalNames = [
  "window",
  "document",
  "navigator",
  "Node",
  "Text",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLSelectElement",
  "HTMLButtonElement",
  "Document",
  "DocumentFragment",
  "MutationObserver",
  "Event",
  "CustomEvent",
  "KeyboardEvent",
  "MouseEvent",
  "FocusEvent",
  "getComputedStyle",
  "localStorage",
  "sessionStorage",
  "requestAnimationFrame",
  "cancelAnimationFrame",
];

export const installDom = (url = "http://localhost:5173/") => {
  const dom = new JSDOM(
    "<!doctype html><html><body><div id=\"root\"></div></body></html>",
    { url, pretendToBeVisual: true },
  );
  const previousDescriptors = new Map();

  dom.window.requestAnimationFrame ||= (callback) =>
    dom.window.setTimeout(() => callback(Date.now()), 0);
  dom.window.cancelAnimationFrame ||= (requestId) =>
    dom.window.clearTimeout(requestId);
  dom.window.scrollTo = () => {};
  dom.window.matchMedia ||= () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  domGlobalNames.forEach((name) => {
    previousDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    const value = name === "window" ? dom.window : dom.window[name];
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  });

  previousDescriptors.set(
    "IS_REACT_ACT_ENVIRONMENT",
    Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT"),
  );
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
  });

  return () => {
    dom.window.close();
    [...previousDescriptors.entries()].forEach(([name, descriptor]) => {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete globalThis[name];
      }
    });
  };
};

export const createFrontendTestServer = ({ stubListingsMap = false } = {}) =>
  createServer({
    appType: "custom",
    logLevel: "silent",
    plugins: stubListingsMap
      ? [
          {
            name: "test-listings-map-stub",
            enforce: "pre",
            resolveId(source, importer) {
              if (
                source === "./ListingsMap" &&
                importer?.endsWith("/BrowseResults.jsx")
              ) {
                return "\0test-listings-map-stub";
              }
              return null;
            },
            load(id) {
              return id === "\0test-listings-map-stub"
                ? "export default function ListingsMap() { return null; }"
                : null;
            },
          },
        ]
      : [],
    server: { middlewareMode: true },
  });
