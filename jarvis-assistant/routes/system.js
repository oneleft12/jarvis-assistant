// Мониторинг и состояние: GET /api/system, GET /api/state
const express = require('express');
const router = express.Router();

const { getStats } = require('../services/systemMonitor');
const { getState, formatUptime } = require('../services/stateStore');
const broadcastStore = require('../services/broadcastStore');

// GET /api/system → { cpu, ram, network, broadcasts, broadcast }
// broadcasts — активные рассылки из админ-панели (журнал), отдаются вместе
// с метриками, которые клиент и так опрашивает каждые 2 секунды.
// Клиент объявляет новые и вычищает из чата те, чьих id больше нет в списке —
// так удаление из админки убирает сообщение у всех.
// broadcast (последняя) — для совместимости со старыми закэшированными клиентами.
router.get('/system', (req, res) => {
  const out = getStats();
  const broadcasts = broadcastStore.list();
  out.broadcasts = broadcasts;
  out.broadcast = broadcasts[0] || null;
  res.json(out);
});

// GET /api/state → { theme, rain, online, uptime, logs }
router.get('/state', (req, res) => {
  const state = getState();
  res.json({
    theme: state.theme,
    rain: state.rain,
    online: true,
    uptime: formatUptime(process.uptime()),
    logs: state.logs
  });
});

module.exports = router;
