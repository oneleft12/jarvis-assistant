// Таблица рекордов: GET /api/scores?game=runner | POST { game, score, name }
const express = require('express');
const router = express.Router();

const { addLog } = require('../services/stateStore');
const scoreStore = require('../services/scoreStore');

const GAMES = ['runner', 'memory', 'snake'];

router.get('/', (req, res) => {
  const game = String(req.query.game || 'runner');
  if (!GAMES.includes(game)) return res.status(400).json({ error: 'Неизвестная игра' });
  res.json({ game, top: scoreStore.top(game, 10) });
});

router.post('/', (req, res) => {
  const game = String((req.body && req.body.game) || '');
  const score = Number(req.body && req.body.score);
  const name = (req.body && req.body.name) || '';

  if (!GAMES.includes(game)) return res.status(400).json({ error: 'Неизвестная игра' });
  if (!isFinite(score) || score < 0) return res.status(400).json({ error: 'Некорректный счёт' });

  scoreStore.add(game, score, name);
  addLog(`Рекорд: ${game} — ${Math.round(score)} (${name || 'Аноним'})`);
  res.json({ status: 'ok', top: scoreStore.top(game, 10) });
});

module.exports = router;
