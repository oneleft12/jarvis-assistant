// Мини-хелпер для плагинов: GET без зависимостей (Node < 18 без глобального fetch)
const https = require('https');
const http = require('http');

function request(url, binary) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http:') ? http : https;
    const req = lib.get(url, { timeout: 12000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(request(res.headers.location, binary));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function getText(url) {
  return request(url);
}

async function getJson(url) {
  const txt = await request(url);
  return JSON.parse(txt);
}

// JSON-POST (для ИИ и API); headers — доп. заголовки (например Authorization)
function postJson(url, obj, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(obj);
    const lib = url.startsWith('http:') ? http : https;
    const req = lib.request(
      url,
      {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          headers || {}
        ),
        timeout: 30000 // reasoning-модели на холодном стартe живут до ~25с
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            // тело ошибки важно: роутер отдаёт там cooldown/reset_seconds
            return reject(new Error('HTTP ' + res.statusCode + ' ' + String(data).slice(0, 300)));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('не JSON: ' + String(data).slice(0, 120)));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { getText, getJson, postJson };
