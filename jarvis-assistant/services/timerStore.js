// Серверное хранилище таймеров (п.6 плана): переживает закрытие вкладок,
// отсчёт идёт на сервере, все открытые вкладки видят одни и те же таймеры.
const fs = require('fs');
const path = require('path');
const { addLog } = require('./stateStore');

const FILE = path.join(__dirname, '..', 'data', 'timers.json');
let timers = [];
let seq = 0;

// сохранить на диск
function persist() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ seq, timers }, null, 2));
  } catch (e) {}
}

// загрузить с диска
function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    timers = Array.isArray(d.timers) ? d.timers : [];
    seq = d.seq || timers.reduce((m, t) => Math.max(m, t.id), 0);
    // просроченные, заведённые до перезагрузки, помечаем сработавшими
    const now = Date.now();
    timers.forEach((t) => {
      if (!t.fired && now >= t.endsAt) {
        t.fired = true;
        t.firedAt = now;
      }
    });
    timers = timers.filter((t) => !t.fired || (t.firedAt && now - t.firedAt < 120000));
    persist();
  } catch (e) {}
}
load();

function list() {
  return timers;
}

function add(sec, msg) {
  const t = {
    id: ++seq,
    endsAt: Date.now() + Math.max(1, Math.round(Number(sec) || 1)) * 1000,
    msg: String(msg || 'Напоминание').slice(0, 200),
    fired: false,
    firedAt: null
  };
  timers.push(t);
  addLog(`Таймер #${t.id} создан: «${t.msg}» через ${Math.round(sec)} сек`);
  persist();
  return t;
}

function remove(id) {
  const before = timers.length;
  timers = timers.filter((t) => t.id !== id);
  if (timers.length !== before) {
    addLog(`Таймер #${id} отменён`);
    persist();
    return true;
  }
  return false;
}

// тик раз в секунду: помечаем сработавшие, убираем старые (через 2 мин —
// чтобы все вкладки успели увидеть статус fired)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  timers.forEach((t) => {
    if (!t.fired && now >= t.endsAt) {
      t.fired = true;
      t.firedAt = now;
      addLog(`⏰ Таймер сработал: «${t.msg}»`);
      changed = true;
    }
  });
  const before = timers.length;
  timers = timers.filter((t) => !(t.fired && t.firedAt && now - t.firedAt > 120000));
  if (timers.length !== before) changed = true;
  if (changed) persist();
}, 1000).unref();

module.exports = { list, add, remove };
