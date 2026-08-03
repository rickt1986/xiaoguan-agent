const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const HTML_PATH = path.join(__dirname, '销冠智能体.html');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API proxy route
  if (req.url.startsWith('/api/chat')) {
    const targetUrl = 'https://api.siliconflow.cn/v1/chat/completions';
    const url = new URL(targetUrl);
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const proxyReq = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'Authorization': req.headers['authorization'] || '',
          'Accept': req.headers['accept'] || 'application/json',
        },
        timeout: 60000,
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json',
          'Transfer-Encoding': proxyRes.headers['transfer-encoding'] || '',
        });
        proxyRes.pipe(res);
      });
      
      proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      
      proxyReq.on('timeout', () => {
        console.error('Proxy timeout');
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway timeout' }));
      });
      
      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // Static file serving
  let filePath = req.url === '/' ? HTML_PATH : path.join(__dirname, decodeURIComponent(req.url));
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // If file not found, try serving the main HTML for SPA routing
        fs.readFile(HTML_PATH, (err2, htmlData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlData);
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  销冠智能体 本地代理已启动`);
  console.log(`========================================`);
  console.log(`\n  访问地址: http://localhost:${PORT}`);
  console.log(`  API代理:  http://localhost:${PORT}/api/chat`);
  console.log(`\n  按 Ctrl+C 停止`);
  console.log(`========================================\n`);
});
