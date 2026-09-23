// П.8 плана: память — GET список, POST добавить, DELETE удалить
const express = require('express');
const router = express.Router();
const store = require('../services/memoryStore');

router.get('/', (req, res) => res.json({ notes: store.list() }));

router.post('/', (req, res) => {
  const text = req.body && req.body.text;
  const n = store.add(text);
  if (!n) return res.status(400).json({ status: 'err', message: 'Пустая заметка' });
  res.json({ status: 'ok', note: n });
});

router.delete('/:id', (req, res) => {
  const ok = store.remove(Number(req.params.id));
  res.json({ status: ok ? 'ok' : 'err' });
});

module.exports = router;
