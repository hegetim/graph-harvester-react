// Vite copies the original module from the same pinned PDF.js release. Keeping
// its exports intact also supports PDF.js's fake-worker fallback. Node tests
// don't import this browser-worker asset.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url&no-inline'
export default workerUrl
