// Гостевой режим: кто запросил API.
// localhost/127.0.0.1 — основное устройство (хост), всё остальное
// (windowshelper.win, *.trycloudflare.com, LAN) — гость через туннель.
// Гостю ПК-действия НЕ выполняем на хосте — отдаём клиенту на его устройство.
function isGuest(req) {
  const host = String((req.get && req.get('host')) || '')
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^\[|\]$/g, '');
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1' && host !== '0.0.0.0';
}

module.exports = { isGuest, clientKey };

// Ключ клиента для rate-limit: за туннелом Cloudflare все запросы доходят
// до сервера с 127.0.0.1, реальный IP посетителя — в CF-Connecting-IP
// (edge перезаписывает его сам, подделать из браузера нельзя).
// Локальный доступ (без заголовка) получает свой ключ — адрес сокета.
function clientKey(req) {
  const cf = String((req.get && req.get('cf-connecting-ip')) || '').trim();
  if (cf) return cf;
  return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
}
