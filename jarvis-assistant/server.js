// Точка входа: Express-сервер J.A.R.V.I.S.
const express = require('express');
const cors = require('cors');
const path = require('path');

// Секреты (ключ ИИ) из gitignored secrets.json — ДО require роутов,
// потому что aiBrain читает переменные окружения на момент загрузки модуля
try {
  const secrets = require('./secrets.json');
  Object.keys(secrets).forEach((k) => {
    if (!(k in process.env)) process.env[k] = String(secrets[k]);
  });
} catch (e) { /* secrets.json нет — работаем на дефолтах (Pollinations) */ }

const chatRoutes = require('./routes/chat');
const systemRoutes = require('./routes/system');
const commandRoutes = require('./routes/commands');
const terminalRoutes = require('./routes/terminal');
const { addLog } = require('./services/stateStore');

const app = express();
const PORT = 3000;

// Middleware: CORS, JSON
app.use(cors());
app.use(express.json());

// Журнал посетителей: IP и действия на сайте (в памяти, кроме опроса метрик)
const visitorsStore = require('./services/visitorsStore');
app.use((req, res, next) => {
  const p = req.path;
  if (p !== '/' && !p.startsWith('/api/')) return next();   // статику не следим
  if (p === '/api/system') return next();                   // опрос каждые 2с — шум
  if (req.method !== 'GET' && req.method !== 'POST') return next();
  // полный путь фиксируем СРАЗУ: к моменту res 'finish' req.path обрезан роутами
  res.on('finish', () => {
    try { visitorsStore.record(req, res.statusCode, p); } catch (e) { /* не мешаем ответу */ }
  });
  next();
});

// Фронтенд: index.html лежит в корне проекта
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// Раздельные ассеты, если появятся
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
// PWA-ассеты (п.15) — только whitelist, чтобы data/*.json не отдавался наружу
['manifest.json', 'icon.svg', 'sw.js'].forEach((f) => {
  app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, f)));
});

// === PIN-код и админ-режим (п.16 плана + админ-панель) ===
// PIN-ы живут в data/admin.json (gitignored) и меняются из админ-панели
const adminStore = require('./services/adminStore');
const { isGuest, clientKey } = require('./services/scope');

// rate-limit: не больше 10 неудачных попыток сайтового PIN за минуту — НА ОДИН IP.
// Счётчик общий был: друг наспамил — «подождите минуту» получил и владелец.
// Теперь чужой спам блокирует только адрес спамящего.
const authFails = new Map(); // ip → { n, until, ts }

// Заглушка на всё /api/* — регистрируется ДО роута /api/auth, чтобы при
// выключенном сайте или закрытых гостях вход по PIN тоже блокировался:
//  - админ-токен (x-jarvis-admin) — полный доступ, даже при выключенном сайте;
//  - вход в админку (/api/admin/login) — работает всегда (rate-limit в роуте);
//  - сайт выключен → 503 для всех, кроме админа (посетители видят «офлайн»);
//  - гости отключены → 403 для запросов через домен;
//  - /api/auth при работающем сайте — пропускается (rate-limit в роуте ниже);
//  - остальные: заголовок x-jarvis-pin.
app.use('/api', (req, res, next) => {
  const admTok = String(req.get('x-jarvis-admin') || '');
  if (admTok && adminStore.tokens.has(admTok)) return next();

  // вход в админку работает всегда — иначе при выключенном сайте
  // нельзя было бы войти и включить его обратно (rate-limit внутри роута)
  if (req.path.startsWith('/admin/login')) return next();

  const cfg = adminStore.get();
  const ip = clientKey(req);

  // бан и кик из админ-панели (бан живёт в data/admin.json, кик — 60 секунд)
  if (Array.isArray(cfg.blockedIPs) && cfg.blockedIPs.includes(ip)) {
    return res.status(403).json({ error: 'ip_blocked', message: 'Ваш IP-адрес заблокирован администратором.' });
  }
  if (visitorsStore.isKicked(ip)) {
    return res.status(403).json({ error: 'ip_kicked', message: 'Администратор вас отключил. Попробуйте позже.' });
  }

  if (cfg.siteEnabled === false) {
    return res.status(503).json({ error: 'site_disabled', message: cfg.maintenanceMsg });
  }
  if (cfg.guestsAllowed === false && isGuest(req)) {
    return res.status(403).json({ error: 'guests_disabled', message: 'Сайт закрыт для гостей, сэр.' });
  }
  if (req.path === '/auth') return next();
  if (String(req.get('x-jarvis-pin') || '') === cfg.sitePin) return next();
  res.status(401).json({ error: 'pin_required' });
});

// Вход: POST /api/auth { pin } → { ok: true } | 503 | 401 | 429
app.post('/api/auth', (req, res) => {
  const key = clientKey(req);
  const now = Date.now();
  const cur = authFails.get(key) || { n: 0, until: 0, ts: 0 };

  if (now < cur.until) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите минуту.' });
  }
  const pin = String((req.body && req.body.pin) || '');
  if (pin && pin === adminStore.get().sitePin) {
    authFails.delete(key);
    addLog('PIN: вход подтверждён');
    return res.json({ ok: true });
  }
  addLog(`PIN: неверная попытка (ip ${key})`);
  cur.n += 1;
  cur.ts = now;
  if (cur.n >= 10) { cur.n = 0; cur.until = now + 60000; }
  authFails.set(key, cur);
  // выкидываем протухшие ключи, чтобы Map не рос бесконечно
  if (authFails.size > 50) {
    authFails.forEach((v, k) => {
      if (now >= (v.until || 0) && now - (v.ts || 0) > 60000) authFails.delete(k);
    });
  }
  res.status(401).json({ error: 'Неверный PIN-код' });
});

// API-роуты
app.use('/api/chat', chatRoutes);        // POST /api/chat
app.use('/api', systemRoutes);           // GET /api/system, GET /api/state
app.use('/api/command', commandRoutes);  // POST /api/command
app.use('/api/terminal', terminalRoutes);// POST /api/terminal
app.use('/api/timers', require('./routes/timers')); // таймеры (п.6 плана)
app.use('/api/memory', require('./routes/memory')); // память (п.8 плана)

// Реестр плагинов (п.12 плана) — фронт подмешивает их команды в help
const pluginHost = require('./services/pluginHost');
app.get('/api/plugins', (req, res) => res.json({ commands: pluginHost.registry() }));

// Таблица рекордов игр (п.14 плана)
app.use('/api/scores', require('./routes/scores'));

// Админ-панель: вход по админ-PIN → токен x-jarvis-admin
app.use('/api/admin', require('./routes/admin'));

// Запуск
app.listen(PORT, () => {
  addLog(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`J.A.R.V.I.S. server: http://localhost:${PORT}`);
  console.log(
    `PIN сайта: ${adminStore.get().sitePin} · админ-PIN: ${adminStore.get().adminPin} (меняются в админ-панели, Ctrl+Shift+A)`
  );
});
