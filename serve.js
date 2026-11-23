#!/usr/bin/env node
/**
 * Zero-dependency static server for local preview.
 *   node serve.js            # http://127.0.0.1:8080/
 *   node serve.js 3000       # custom port
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon'
};

function send(res, status, filePath) {
  const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (error) {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const resolved = path.resolve(ROOT, '.' + pathname);
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(resolved, (error, stat) => {
    if (!error && stat.isDirectory()) return send(res, 200, path.join(resolved, 'index.html'));
    if (!error && stat.isFile()) return send(res, 200, resolved);
    if (!path.extname(pathname)) return send(res, 200, path.join(ROOT, pathname, 'index.html'));
    send(res, 404, path.join(ROOT, '404.html'));
  });
});

server.listen(PORT, HOST, () => {
  console.log('Christianity’s Problems → http://' + HOST + ':' + PORT + '/');
});
