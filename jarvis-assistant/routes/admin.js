// Админ-панель: POST /api/admin/login → токен, дальше CRUD-функции панели.
// Доступ: только с заголовком x-jarvis-admin (токен из login). Даже если у
// запроса есть сайтовый PIN — админ-функции без токена не работают.
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const adminStore = require('../services/adminStore');
const { state, addLog, formatUptime } = require('../services/stateStore');
const memoryStore = require('../services/memoryStore');
const scoreStore = require('../services/scoreStore');
const { clientKey } = require('../services/scope');
const visitorsStore = require('../services/visitorsStore');
const broadcastStore = require('../services/broadcastStore');

// Rate-limit входа: 5 неудач подряд С ОДНОГО IP → блок этого IP на 60 секунд
// (общий счётчик задевал бы всех: чужой спам не должен блокировать владельца)
const fails = new Map(); // ip → { n, until, ts }

// Публичная сводка (PIN-ы маскируются — в ответе они не светятся)
function pub(cfg) {
  const mask = (p) => String(p).replace(/.(?=.{2})/g, '•');
  return {
    siteEnabled: cfg.siteEnabled,
    guestsAllowed: cfg.guestsAllowed,
    aiEnabled: process.env.JARVIS_AI !== 'off',
    sitePinMasked: mask(cfg.sitePin),
    adminPinMasked: mask(cfg.adminPin),
    maintenanceMsg: cfg.maintenanceMsg
  };
}

// Вход: POST /api/admin/login { pin } → { ok, token, cfg }
router.post('/login', (req, res) => {
  const key = clientKey(req);
  const now = Date.now();
  const cur = fails.get(key) || { n: 0, until: 0, ts: 0 };

  if (now < cur.until) {
    return res.status(429).json({ error: 'Слишком много попыток. Подождите минуту.' });
  }
  const pin = String((req.body && req.body.pin) || '');
  const cfg = adminStore.get();

  if (pin && pin === cfg.adminPin) {
    fails.delete(key);
    const token = crypto.randomBytes(24).toString('hex');
    adminStore.tokens.add(token);
    addLog('Админ: вход в панель выполнен');
    return res.json({ ok: true, token, cfg: pub(cfg) });
  }

  cur.n += 1;
  cur.ts = now;
  addLog(`Админ: неверный PIN (${cur.n}/5, ip ${key})`);
  if (cur.n >= 5) { cur.n = 0; cur.until = now + 60000; }
  fails.set(key, cur);
  if (fails.size > 50) {
    fails.forEach((v, k) => {
      if (now >= (v.until || 0) && now - (v.ts || 0) > 60000) fails.delete(k);
    });
  }
  res.status(401).json({ error: 'Неверный админ-PIN' });
});

// Дальше — только с валидным токеном
router.use((req, res, next) => {
  const t = String(req.get('x-jarvis-admin') || '');
  if (t && adminStore.tokens.has(t)) return next();
  res.status(403).json({ error: 'admin_token_required' });
});

// Выход (токен сгорает)
router.post('/logout', (req, res) => {
  adminStore.tokens.delete(String(req.get('x-jarvis-admin') || ''));
  addLog('Админ: выход из панели');
  res.json({ ok: true });
});

// Сводка: GET /api/admin/status
router.get('/status', (req, res) => {
  res.json(Object.assign(pub(adminStore.get()), {
    uptime: formatUptime(process.uptime()),
    version: 'v2.9',
    logs: state.logs.length,
    memory: memoryStore.list().length,
    tokens: adminStore.tokens.size
  }));
});

// Вкл/выкл сайта для всех, кроме админа: POST /api/admin/site { enabled, message }
router.post('/site', (req, res) => {
  const cfg = adminStore.get();
  const enabled = typeof (req.body && req.body.enabled) === 'boolean' ? req.body.enabled : cfg.siteEnabled;
  const message = req.body && req.body.message !== undefined
    ? String(req.body.message).slice(0, 200) : cfg.maintenanceMsg;

  adminStore.set({ siteEnabled: enabled, maintenanceMsg: message || DEFAULT_MSG() });
  addLog('Админ: сайт ' + (enabled ? 'ВКЛЮЧЁН' : 'ОТКЛЮЧЁН для посетителей'));
  res.json({ ok: true, cfg: pub(adminStore.get()) });
});

function DEFAULT_MSG() {
  return 'Сайт временно отключён администратором. Проверьте позже.';
}

// Смена PIN-кодов: POST /api/admin/pins { sitePin?, adminPin?, currentAdminPin? }
router.post('/pins', (req, res) => {
  const cfg = adminStore.get();
  const body = req.body || {};
  const sitePin = String(body.sitePin || '').trim();
  const newAdmin = String(body.adminPin || '').trim();
  const valid = (p) => /^\d{4,8}$/.test(p);

  if (!sitePin && !newAdmin) return res.status(400).json({ error: 'Укажите новый PIN' });

  const patch = {};
  if (sitePin) {
    if (!valid(sitePin)) return res.status(400).json({ error: 'PIN сайта: 4–8 цифр' });
    patch.sitePin = sitePin;
  }
  if (newAdmin) {
    if (!valid(newAdmin)) return res.status(400).json({ error: 'Админ-PIN: 4–8 цифр' });
    if (String(body.currentAdminPin || '') !== cfg.adminPin) {
      return res.status(401).json({ error: 'Текущий админ-PIN неверен' });
    }
    patch.adminPin = newAdmin;
  }

  adminStore.set(patch);
  if (patch.sitePin) addLog('Админ: PIN сайта изменён');
  if (patch.adminPin) addLog('Админ: админ-PIN изменён');
  res.json({ ok: true, cfg: pub(adminStore.get()) });
});

// Гости через домен: POST /api/admin/guests { allowed }
router.post('/guests', (req, res) => {
  const allowed = !!(req.body && req.body.allowed);
  adminStore.set({ guestsAllowed: allowed });
  addLog('Админ: вход для гостей ' + (allowed ? 'разрешён' : 'закрыт'));
  res.json({ ok: true, cfg: pub(adminStore.get()) });
});

// Выключатель ИИ-чата: POST /api/admin/ai { enabled }
// aiBrain читает JARVIS_AI живьём при каждом запросе — переключение мгновенное
router.post('/ai', (req, res) => {
  const enabled = !!(req.body && req.body.enabled);
  process.env.JARVIS_AI = enabled ? 'on' : 'off';
  addLog('Админ: ИИ-чат ' + (enabled ? 'включён' : 'выключен'));
  res.json({ ok: true, aiEnabled: enabled });
});

// Очистка данных: POST /api/admin/clear { what: logs | memory | scores }
router.post('/clear', (req, res) => {
  const what = String((req.body && req.body.what) || '');
  if (what === 'logs') {
    state.logs.length = 0;
    addLog('Админ: журнал очищен');
  } else if (what === 'memory') {
    memoryStore.clear();
    addLog('Админ: память очищена');
  } else if (what === 'scores') {
    scoreStore.clear();
    addLog('Админ: таблицы рекордов очищены');
  } else {
    return res.status(400).json({ error: 'what: logs | memory | scores' });
  }
  res.json({ ok: true });
});

// Рассылка всем клиентам: POST /api/admin/broadcast { text }
// клиент подхватывает её вместе с /api/system (опрос каждые 2 сек);
// запись попадает в журнал рассылок (broadcastStore) — её можно удалить
router.post('/broadcast', (req, res) => {
  const text = String((req.body && req.body.text) || '').slice(0, 200);
  if (!text.trim()) return res.status(400).json({ error: 'Пустое сообщение' });
  const item = broadcastStore.add(text);
  addLog('Админ-рассылка: ' + text);
  res.json({ ok: true, id: item.id });
});

// Журнал рассылок: GET /api/admin/broadcasts → { list: [...] }
router.get('/broadcasts', (req, res) => {
  res.json({ list: broadcastStore.list() });
});

// Удалить рассылку у ВСЕХ клиентов: POST /api/admin/broadcast/delete { id }
// запись уходит из журнала; клиенты при следующем опросе /api/system
// вычищают её из чата и истории
router.post('/broadcast/delete', (req, res) => {
  const id = (req.body && req.body.id) != null ? req.body.id : '';
  if (id === '' || id == null) return res.status(400).json({ error: 'Укажите id' });
  const found = broadcastStore.remove(id);
  if (!found) return res.status(404).json({ error: 'Рассылка не найдена' });
  addLog(`Админ: рассылка ${id} удалена у всех клиентов`);
  res.json({ ok: true });
});

// Очистить весь журнал рассылок: POST /api/admin/broadcast/clear
// все ранее отправленные рассылки вычищаются у клиентов
router.post('/broadcast/clear', (req, res) => {
  const n = broadcastStore.clear();
  addLog(`Админ: журнал рассылок очищен (${n})`);
  res.json({ ok: true, cleared: n });
});

// Перезапуск сервера: поднимаем новый процесс и уходим сами
router.post('/restart', (req, res) => {
  res.json({ ok: true, message: 'Сервер перезапускается…' });
  addLog('Админ: перезапуск сервера');
  setTimeout(() => {
    try {
      const out = fs.openSync('/tmp/jarvis-server.log', 'a');
      const child = spawn(process.execPath, ['server.js'], {
        cwd: path.join(__dirname, '..'),
        detached: true,
        stdio: ['ignore', out, out]
      });
      child.unref();
    } catch (e) {
      console.error('Перезапуск не удался:', e.message);
    }
    setTimeout(() => process.exit(0), 300);
  }, 400);
});

// === Посетители: IP-адреса, действия, кик/бан ===
function cleanIp(v) {
  const ip = String((v && v.ip) || '').trim();
  if (!ip || ip.length > 64 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

// Список: GET /api/admin/visitors → { list: [...] }
router.get('/visitors', (req, res) => {
  const cfg = adminStore.get();
  res.json({ list: visitorsStore.list(new Set(cfg.blockedIPs || [])) });
});

// Кик: выкидывает посетителя на 60 секунд, потом может вернуться
router.post('/kick', (req, res) => {
  const ip = cleanIp(req.body);
  if (!ip) return res.status(400).json({ error: 'bad ip' });
  visitorsStore.kick(ip);
  addLog(`Админ: кик IP ${ip} (60 сек)`);
  res.json({ ok: true });
});

// Бан: пока не разблокируют в панели (переживает перезапуск)
router.post('/ban', (req, res) => {
  const ip = cleanIp(req.body);
  if (!ip) return res.status(400).json({ error: 'bad ip' });
  const cfg = adminStore.get();
  const list = Array.isArray(cfg.blockedIPs) ? cfg.blockedIPs.slice() : [];
  if (!list.includes(ip)) list.push(ip);
  adminStore.set({ blockedIPs: list });
  addLog(`Админ: блок IP ${ip}`);
  res.json({ ok: true });
});

// Разблок
router.post('/unban', (req, res) => {
  const ip = cleanIp(req.body);
  if (!ip) return res.status(400).json({ error: 'bad ip' });
  const cfg = adminStore.get();
  adminStore.set({ blockedIPs: (cfg.blockedIPs || []).filter((x) => x !== ip) });
  addLog(`Админ: разблок IP ${ip}`);
  res.json({ ok: true });
});

module.exports = router;
