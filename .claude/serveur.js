// Petit serveur local pour prévisualiser le site : node .claude/serveur.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const racine = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

http.createServer((req, res) => {
  const chemin = decodeURIComponent(req.url.split('?')[0]);
  const fichier = path.join(racine, chemin === '/' ? 'index.html' : chemin);
  if (!fichier.startsWith(racine)) { res.writeHead(403); return res.end(); }
  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8123, '127.0.0.1', () => console.log('http://localhost:8123'));
