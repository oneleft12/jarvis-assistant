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

module.exports = { isGuest };
