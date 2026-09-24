// Чат: POST /api/chat → { reply, action }
const express = require('express');
const router = express.Router();

const { getReply } = require('../services/jarvisBrain');
const { state, addLog } = require('../services/stateStore');
const memoryStore = require('../services/memoryStore'); // п.8: модуль памяти
const pluginHost = require('../services/pluginHost');   // п.12: плагины
const pcActions = require('../services/pcActions');     // п.13: управление ПК
const aiBrain = require('../services/aiBrain');         // п.17: ИИ-личность
const { isGuest } = require('../services/scope');       // гостевой режим: ПК-команды гостя не выполняем

router.post('/', async (req, res) => {
  const message = (req.body && req.body.message) || '';
  const guest = isGuest(req); // запрос через домен — гость

  if (!message.trim()) {
    return res.json({ reply: 'Сообщение не получено, сэр.', action: null });
  }

  // Сначала — плагины («погода Алматы», «курс доллара»)
  const pluginOut = await pluginHost.execute(message);
  if (pluginOut !== null) {
    addLog(`Чат: "${message}" → плагин`);
    return res.json({ reply: pluginOut, action: null });
  }

  const brain = getReply(message, memoryStore.list());
  let reply = brain.reply;
  const action = brain.action;

  // Обычная болтовня → бесплатная ИИ-модель с личностью Джарвиса (п.17)
  if (brain.fallback) {
    const history = (req.body && req.body.history) || null;
    const ai = await aiBrain.ask(message, history, memoryStore.list());
    if (ai) {
      reply = ai;
      addLog(`Чат: "${message}" → ИИ (${aiBrain.MODEL})`);
    }
  }

  // Применяем действие к состоянию сервера
  if (action && action.type === 'theme') state.theme = action.value;
  if (action && action.type === 'rain') state.rain = action.value;
  if (action && action.type === 'memory_add') memoryStore.add(action.value);
  const pcBlocked = guest && action && action.type === 'command';
  if (action && action.type === 'command' && !guest) {
    // реальное действие с ПК (п.13) — выполняем и кладём результат в журнал
    pcActions.execute(action.value).then((r) => addLog(`ПК-команда: ${action.value} → ${r.status}`));
  } else if (pcBlocked) {
    addLog(`Гость просил ПК-команду «${action.value}» — хост не трогаю`);
  }

  // Запись в общий журнал
  const actionInfo = action ? `${action.type}=${action.value}` : 'без действия';
  addLog(`Чат: "${message}" → ${actionInfo}`);

  // Гостю про ПК-команды отвечаем честно: хост не трогали
  const payload = {
    reply: pcBlocked
      ? 'Сэр, управление компьютером — привилегия основного устройства. На вашем устройстве всё под контролем.'
      : reply,
    action: pcBlocked ? null : action
  };
  if (guest) payload.scope = 'client'; // клиент знает, что он «гость»
  res.json(payload);
});

module.exports = router;
