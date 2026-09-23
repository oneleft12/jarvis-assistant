// Точка входа: Express-сервер J.A.R.V.I.S.
const express = require('express');
const cors = require('cors');
const path = require('path');

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

// Фронтенд: index.html лежит в корне проекта
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
// Раздельные ассеты, если появятся
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
// PWA-ассеты (п.15) — только whitelist, чтобы data/*.json не отдавался наружу
['manifest.json', 'icon.svg', 'sw.js'].forEach((f) => {
  app.get('/' + f, (req, res) => res.sendFile(path.join(__dirname, f)));
});

// === PIN-код на API (п.16 плана) ===
const PIN = process.env.JARVIS_PIN || '1212';

// Вход: POST /api/auth { pin } → { ok: true } | 401
app.post('/api/auth', (req, res) => {
  const pin = String((req.body && req.body.pin) || '');
  if (pin && pin === PIN) {
    addLog('PIN: вход подтверждён');
    return res.json({ ok: true });
  }
  addLog('PIN: неверная попытка');
  res.status(401).json({ error: 'Неверный PIN-код' });
});

// Заглушка: всё /api/* (кроме /api/auth) требует заголовок x-jarvis-pin
app.use('/api', (req, res, next) => {
  if (req.path === '/auth') return next();
  if (String(req.get('x-jarvis-pin') || '') === PIN) return next();
  res.status(401).json({ error: 'pin_required' });
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

// Запуск
app.listen(PORT, () => {
  addLog(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`J.A.R.V.I.S. server: http://localhost:${PORT}`);
  console.log(
    process.env.JARVIS_PIN
      ? `PIN-код из окружения: ${PIN}`
      : `PIN-код по умолчанию: ${PIN} (смените: JARVIS_PIN=xxxx node server.js)`
  );
});
