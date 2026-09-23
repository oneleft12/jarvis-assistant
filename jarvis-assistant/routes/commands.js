// Быстрые команды-кнопки: POST /api/command
const express = require('express');
const { exec } = require('child_process');
const router = express.Router();

const { addLog } = require('../services/stateStore');
const pcActions = require('../services/pcActions'); // п.13: реальные действия ПК

router.post('/', async (req, res) => {
  const action = (req.body && req.body.action) || '';

  try {
    // Сканирование — особый случай (нужен stdout)
    if (action === 'system_scan') {
      return await new Promise((resolve) => {
        const cmd = process.platform === 'win32' ? 'tasklist' : 'tasklist.exe';
        exec(cmd, { timeout: 8000 }, (err, stdout) => {
          if (err) {
            // WSL без interop / не Windows — покажем процессы Linux
            exec('ps -eo comm,%mem --sort=-%mem | head -11', { timeout: 5000 }, (e2, out2) => {
              if (e2) {
                addLog('Сканирование: ошибка');
                return resolve(res.json({ status: 'error', message: 'Не удалось выполнить сканирование.' }));
              }
              const lines = out2.split('\n').filter(Boolean).slice(0, 11);
              addLog('Сканирование: локальные процессы');
              resolve(res.json({ status: 'ok', message: lines.join('\n') }));
            });
            return;
          }
          const lines = stdout.split(/\r?\n/).filter(Boolean).slice(0, 10);
          addLog('Сканирование: список процессов получен');
          resolve(res.json({ status: 'ok', message: lines.join('\n') }));
        });
      });
    }

    const out = await pcActions.execute(action);
    return res.json(out);
  } catch (e) {
    addLog('Ошибка выполнения команды: ' + e.message);
    return res.json({ status: 'error', message: 'Внутренняя ошибка сервера.' });
  }
});

module.exports = router;
