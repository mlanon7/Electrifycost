#!/usr/bin/env node
// Tiny zero-dependency local dev server. Mirrors the pattern from the
// Construction Calculator project. No `npm install` required — only Node
// built-ins (http / fs / path / url). Serves the project folder on port
// 4173 with proper MIME types and permissive CORS so a static-site or
// post-`npm run build` `dist/` folder can be exercised end-to-end.
//
// Usage:
//   node local-server.js               # serve repo root on :4173
//   node local-server.js dist          # serve dist/ on :4173
//   PORT=8080 node local-server.js     # override port
//
// This is a *static* server intentionally separate from `astro dev`. Astro's
// dev server gives you HMR on `src/` changes; this one gives you a quick way
// to walk a built site or to expose CSVs at a stable URL during data
// editing. It will not transpile TS/JSX.
//
// Note: package.json declares "type": "module" so this file uses ESM syntax.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(process.cwd(), process.argv[2] || '.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.cjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.tsv':  'text/tab-separated-values; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.xml':  'application/xml; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};
const fallbackMime = 'application/octet-stream';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Cache-Control':                'no-cache',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...corsHeaders, Allow: 'GET, HEAD, OPTIONS' });
    res.end('Method Not Allowed');
    return;
  }

  const reqPath = decodeURIComponent(url.parse(req.url).pathname || '/');
  const safe = path.normalize(reqPath).replace(/^([/\\])+/, '');
  const abs = path.resolve(ROOT, safe);
  if (!abs.startsWith(ROOT)) {
    res.writeHead(403, corsHeaders); res.end('Forbidden'); return;
  }

  fs.stat(abs, (err, stat) => {
    if (err) return notFound();
    if (stat.isDirectory()) {
      const candidate = path.join(abs, 'index.html');
      fs.stat(candidate, (e2, s2) => {
        if (!e2 && s2.isFile()) sendFile(candidate, s2);
        else sendListing(abs, reqPath);
      });
    } else if (stat.isFile()) {
      sendFile(abs, stat);
    } else {
      notFound();
    }
  });

  function sendFile(file, stat) {
    const mime = MIME[path.extname(file).toLowerCase()] || fallbackMime;
    res.writeHead(200, { ...corsHeaders, 'Content-Type': mime, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  function sendListing(dir, urlPath) {
    fs.readdir(dir, { withFileTypes: true }, (e, entries) => {
      if (e) return notFound();
      const items = entries.filter(d => !d.name.startsWith('.')).map(d => {
        const slash = d.isDirectory() ? '/' : '';
        const href = (urlPath.endsWith('/') ? urlPath : urlPath + '/') + d.name + slash;
        return `<li><a href="${href}">${d.name}${slash}</a></li>`;
      });
      const html = `<!doctype html><meta charset="utf-8"><title>Index of ${urlPath}</title>
<style>body{font:14px/1.4 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem}h1{font-size:1.1rem}ul{list-style:none;padding:0}li{padding:0.15rem 0}</style>
<h1>Index of ${urlPath}</h1><ul>${items.join('\n')}</ul>`;
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
  }

  function notFound() {
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`local-server: serving ${ROOT}`);
  console.log(`              http://${HOST}:${PORT}/`);
});
