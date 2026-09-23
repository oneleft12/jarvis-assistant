// Мониторинг и состояние: GET /api/system, GET /api/state
const express = require('express');
const router = express.Router();

const { getStats } = require('../services/systemMonitor');
const { getState, formatUptime } = require('../services/stateStore');

// GET /api/system → { cpu, ram, network }
router.get('/system', (req, res) => {
  res.json(getStats());
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
