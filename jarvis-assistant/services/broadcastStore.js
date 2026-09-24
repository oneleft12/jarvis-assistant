// Журнал рассылок администратора.
// Хранится в data/broadcasts.json (gitignored): журнал переживает перезапуск,
// а удаление записи = сообщение удаляется у ВСЕХ клиентов (они сверяют
// активный список с локальной историей чата и вычищают пропавшие id).
// Записи отдаются новыми сверху; MAX — сколько держим в журнале.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'broadcasts.json');
const MAX = 50;

let items = []; // [{ id, text, ts, time }] — новые первыми

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(raw)) {
      items = raw.filter((x) => x && x.id != null && typeof x.text === 'string');
    }
  } catch (e) { /* файла нет — журнал пуст */ }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
  } catch (e) { /* нет прав — журнал живёт в памяти до рестарта */ }
}

load();

function pad(n) { return String(n).padStart(2, '0'); }

function fmt(ts) {
  const d = new Date(ts);
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// Новая рассылка: id числовый (совместимость со старыми клиентами,
// которые сравнивают id как Number), time — для журнала
function add(text) {
  const ts = Date.now();
  const item = {
    id: ts * 1000 + Math.floor(Math.random() * 1000),
    text: String(text).slice(0, 200),
    ts,
    time: fmt(ts)
  };
  items.unshift(item);
  if (items.length > MAX) items.length = MAX;
  save();
  return item;
}

// Активные рассылки (новые сверху) — их получают все клиенты через /api/system
function list() {
  return items.slice();
}

// Удалить одну (уходит из журнала и у клиентов при следующем опросе)
function remove(id) {
  const before = items.length;
  items = items.filter((x) => String(x.id) !== String(id));
  if (items.length === before) return false;
  save();
  return true;
}

// Очистить журнал целиком (все рассылки вычищаются у клиентов)
function clear() {
  const n = items.length;
  items = [];
  save();
  return n;
}

module.exports = { add, list, remove, clear };
