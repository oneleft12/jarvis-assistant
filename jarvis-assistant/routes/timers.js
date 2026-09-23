// П.6 плана: серверные таймеры/напоминания
// GET    /api/timers        — список
// POST   /api/timers        — создать {sec, msg}
// DELETE /api/timers/:id    — отменить
const express = require('express');
const router = express.Router();
const store = require('../services/timerStore');

router.get('/', (req, res) => {
  res.json({ timers: store.list() });
});

router.post('/', (req, res) => {
  const { sec, msg } = req.body || {};
  const n = Number(sec);
  if (!isFinite(n) || n <= 0) {
    return res.status(400).json({ status: 'err', message: 'Нужен положительный sec' });
  }
  res.json({ status: 'ok', timer: store.add(n, msg) });
});

router.delete('/:id', (req, res) => {
  const ok = store.remove(Number(req.params.id));
  res.json({ status: ok ? 'ok' : 'err' });
});

module.exports = router;
