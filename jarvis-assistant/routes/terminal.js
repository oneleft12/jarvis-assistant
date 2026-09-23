// Терминал: POST /api/terminal → { output, clear }
const express = require('express');
const router = express.Router();

const { state, addLog, formatUptime } = require('../services/stateStore');
const pluginHost = require('../services/pluginHost'); // п.12: плагины

const THEMES = ['cyan', 'matrix', 'violet', 'amber'];

router.post('/', async (req, res) => {
  const raw = (req.body && req.body.command) || '';
  const cmd = raw.trim();

  addLog('Терминал: ' + (cmd || '(пусто)'));

  if (!cmd) {
    return res.json({ output: 'Введите команду. help — список команд.', clear: false });
  }

  const parts = cmd.split(/\s+/);
  const name = parts[0].toLowerCase();
  const arg = (parts[1] || '').toLowerCase();

  switch (name) {
    // Список команд
    case 'help':
      return res.json({
        output: [
          'help              — список команд',
          'ping              — проверка сети',
          'theme <имя>       — смена темы (cyan|matrix|violet|amber)',
          'rain on|off       — кибер-дождь вкл/выкл',
          'status            — состояние сервера',
          'clear             — очистить терминал'
        ],
        clear: false
      });

    // Проверка сети: пинг 5–40 мс
    case 'ping': {
      const ms = 5 + Math.floor(Math.random() * 36);
      return res.json({ output: `Проверка сети... пинг ${ms} мс, потерь 0%`, clear: false });
    }

    // Смена темы
    case 'theme':
      if (!THEMES.includes(arg)) {
        return res.json({ output: 'Неизвестная тема. Доступны: cyan, matrix, violet, amber.', clear: false });
      }
      state.theme = arg;
      addLog('Терминал: тема → ' + arg);
      return res.json({ output: 'Тема переключена: ' + arg, clear: false });

    // Дождь вкл/выкл
    case 'rain':
      if (arg === 'on' || arg === 'вкл') {
        state.rain = true;
      } else if (arg === 'off' || arg === 'выкл') {
        state.rain = false;
      } else {
        return res.json({ output: 'Использование: rain on | rain off', clear: false });
      }
      addLog('Терминал: дождь → ' + (state.rain ? 'вкл' : 'выкл'));
      return res.json({
        output: 'Кибер-дождь ' + (state.rain ? 'включён' : 'выключен'),
        clear: false
      });

    // Состояние сервера
    case 'status':
      return res.json({
        output: [
          'Статус: online',
          'Аптайм: ' + formatUptime(process.uptime()),
          'Тема: ' + state.theme,
          'Дождь: ' + (state.rain ? 'вкл' : 'выкл')
        ],
        clear: false
      });

    // Очистка терминала
    case 'clear':
      return res.json({ output: '', clear: true });

    // Неизвестная команда → пробуем плагины (п.12 плана)
    default: {
      const pluginOut = await pluginHost.execute(cmd);
      if (pluginOut !== null) {
        return res.json({ output: pluginOut, clear: false });
      }
      return res.json({ output: 'Неизвестная команда: ' + name + '. Введите help.', clear: false });
    }
  }
});

module.exports = router;
