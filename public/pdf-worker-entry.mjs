// pdf.js worker entry point.
//
// GlobalWorkerOptions.workerSrc points here rather than straight at
// pdf.worker.min.mjs so the worker's realm can be patched before the vendored
// bundle evaluates. A worker gets its own globals, so the shim installed on the
// main thread in src/lib/pdfjs-lazy.ts does not reach it.
//
// Promise.withResolvers is used by pdf.js 5.x and only exists from Safari 17.4
// on; without this, iOS 16 devices throw inside the worker on the first parse.
// Deliberately duplicated rather than imported: this file is served as a static
// asset and cannot pull from src/.
//
// pdf.js constructs the worker with { type: "module" }, so top-level await and
// dynamic import are both available here.
if (typeof Promise.withResolvers !== "function") {
  Promise.withResolvers = function withResolvers() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

await import("./pdf.worker.min.mjs");
