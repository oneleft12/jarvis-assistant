// Журнал посетителей: кто заходил и что делал.
// Хранится ТОЛЬКО в памяти (на диск не пишем) — IP и история действий
// не должны оседать в gitignored data/ вместе с прочими логами.
// Реальный IP берём из clientKey(): за туннелом это CF-Connecting-IP.
const { clientKey, isGuest } = require('./scope');

const KICK_MS = 60000;   // кик: выкидывает на 60 секунд
const MAX_EVENTS = 25;   // сколько последних действий помним на IP
const MAX_CLIENTS = 200; // сколько IP держим в памяти (старые выкидываем)

const clients = new Map(); // ip → { ip, guest, first, last, requests, lastAction, events[] }
const kicks = new Map();   // ip → timestamp окончания кика

// Человекочитаемые названия эндпоинтов
const NAMES = {
  '/': 'открыл сайт',
  '/api/state': 'обновил состояние',
  '/api/auth': 'вход по PIN',
  '/api/chat': 'чат',
  '/api/command': 'команда',
  '/api/terminal': 'терминал',
  '/api/scores': 'рекорд',
  '/api/timers': 'таймер',
  '/api/memory': 'память',
  '/api/admin/login': 'вход в админку',
  '/api/admin/logout': 'выход из админки',
  '/api/admin/status': 'админ: сводка',
  '/api/admin/visitors': 'админ: посетители',
  '/api/admin/site': 'админ: сайт',
  '/api/admin/pins': 'админ: смена PIN',
  '/api/admin/guests': 'админ: гости',
  '/api/admin/ai': 'админ: ИИ',
  '/api/admin/clear': 'админ: очистка',
  '/api/admin/broadcast': 'админ: рассылка',
  '/api/admin/restart': 'админ: рестарт',
  '/api/admin/kick': 'админ: кик',
  '/api/admin/ban': 'админ: блок',
  '/api/admin/unban': 'админ: разблок'
};

function pad(n) { return String(n).padStart(2, '0'); }

function fmt(ts) {
  const d = new Date(ts);
  return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + ' с назад';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' мин назад';
  return Math.round(m / 60) + ' ч назад';
}

// Что именно человек делал (без тел запросов — только суть)
function actionText(req, status) {
  const p = req.path;
  let text = NAMES[p];

  if (p === '/api/chat') {
    const msg = String((req.body && req.body.message) || '').slice(0, 60);
    text = 'чат: «' + msg + '»';
  } else if (p === '/api/command') {
    const a = String((req.body && (req.body.action || req.body.command)) || '').slice(0, 40);
    text = 'команда: ' + (a || '?');
  } else if (!text) {
    text = 'запрос ' + p.slice(5);
  }

  if (status >= 400) text += ' → ' + status;
  return text;
}

// Регистрирует одно действие (вызывается на res 'finish')
function record(req, status) {
  const ip = clientKey(req);
  const now = Date.now();

  let c = clients.get(ip);
  if (!c) {
    c = { ip, guest: false, first: now, last: now, requests: 0, lastAction: '', events: [] };
    clients.set(ip, c);
  }
  c.guest = isGuest(req);
  c.last = now;
  c.requests += 1;
  c.lastAction = actionText(req, status);
  c.events.unshift({ t: now, text: c.lastAction });
  if (c.events.length > MAX_EVENTS) c.events.length = MAX_EVENTS;

  // не даём Map расти бесконечно — выкидываем самых давних
  if (clients.size > MAX_CLIENTS) {
    const sorted = Array.from(clients.values()).sort((a, b) => a.last - b.last);
    for (let i = 0; i < sorted.length - MAX_CLIENTS; i++) clients.delete(sorted[i].ip);
  }
}

// Кик на 60 секунд
function kick(ip) {
  kicks.set(ip, Date.now() + KICK_MS);
}

function isKicked(ip) {
  const until = kicks.get(ip);
  if (!until) return false;
  if (Date.now() >= until) { kicks.delete(ip); return false; }
  return true;
}

// Список для админ-панели: свежие сверху, с флагами блока/кика
function list(blockedSet) {
  const blocked = blockedSet instanceof Set ? blockedSet : new Set(blockedSet || []);
  return Array.from(clients.values())
    .sort((a, b) => b.last - a.last)
    .slice(0, 40)
    .map((c) => ({
      ip: c.ip,
      guest: c.guest,
      first: fmt(c.first),
      last: fmt(c.last),
      lastAgo: ago(c.last),
      requests: c.requests,
      lastAction: c.lastAction,
      events: c.events.slice(0, 8).map((e) => ({ t: fmt(e.t), text: e.text })),
      blocked: blocked.has(c.ip),
      kicked: isKicked(c.ip)
    }));
}

module.exports = { record, kick, isKicked, list, KICK_MS };
