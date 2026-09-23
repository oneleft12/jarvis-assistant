// «Мозг» Джарвиса: разбор сообщения чата → ответ + действие
const THEMES = ['cyan', 'matrix', 'violet', 'amber'];

// Счётчик для чередования фраз
let fallbackIndex = 0;

// Вежливые ответы на нераспознанные сообщения
const FALLBACKS = [
  'Команда принята. Выполняю анализ.',
  'Слушаю вас, сэр.',
  'Принято, сэр. Вношу запрос в журнал.',
  'Запрос принят, выполняю.'
];

// Возвращает { reply, action }, action = null | { type, value }
// memory — список заметок из модуля памяти (п.8 плана)
function getReply(message, memory) {
  const text = (message || '').toString().toLowerCase().trim();
  const mem = Array.isArray(memory) ? memory : [];
  if (!text) return { reply: 'Слушаю вас, сэр.', action: null };

  // Запрещённая команда
  if (text.includes('shutdown') || text.includes('выключи компьютер') || text.includes('выключи пк')) {
    return { reply: 'Эта команда отключена соображениями безопасности.', action: null };
  }

  // --- память: запомнить новое ---
  const memAdd = (message || '').match(/^\s*(?:запомни|запомни-ка|remember)(?:\s+мне)?[\s:]+(.+)$/i);
  if (memAdd && memAdd[1].trim()) {
    const val = memAdd[1].trim();
    return { reply: `Записал в память, сэр: «${val}».`, action: { type: 'memory_add', value: val } };
  }

  // --- память: «что ты помнишь» ---
  if (/(?:что\s+ты\s+(?:обо\s+мне\s+)?помнишь|что\s+ты\s+запомнил|покажи\s+память|список\s+памяти|вспомни|что\s+ты\s+обо\s+мне\s+знаешь)/i.test(text)) {
    const items = mem.slice(-10);
    const reply = items.length
      ? 'В моей памяти (' + mem.length + ' записей), сэр:\n' +
        items.map((n, i) => (i + 1) + '. ' + n.text).join('\n')
      : 'Память пока пуста, сэр. Скажите «запомни …».';
    return { reply, action: null };
  }

  // --- память: имя пользователя ---
  const nameM = (message || '').match(/меня\s+зовут\s+([A-Za-zА-Яа-яЁё][\wА-Яа-яЁё-]{0,20})/i);
  if (nameM) {
    return {
      reply: `Приятно познакомиться, ${nameM[1]}. Запомнил — теперь обращаюсь по имени.`,
      action: { type: 'memory_add', value: 'Меня зовут ' + nameM[1] }
    };
  }

  // help — список команд
  if (text === 'help' || text === 'хелп' || text.includes('список команд') || text.includes('помощь')) {
    return {
      reply: 'Команды: тема <имя>, дождь включен / дождь выключен, help, открой браузер, запусти игру, скриншот, сканирование системы, «запомни …», «что ты помнишь», «напомни через 10 минут …».',
      action: null
    };
  }

  // Приветствие — с персонализацией из памяти
  if (text.includes('привет') || text === 'здравствуй' || text.includes('здравствуйте')) {
    const names = mem
      .map((n) => { const m = n.text.match(/меня\s+зовут\s+(.+)/i); return m ? m[1].trim() : null; })
      .filter(Boolean);
    const name = names[names.length - 1];
    return {
      reply: name ? `Здравствуйте, ${name}. Рад вас слышать. Все системы в норме.`
                  : 'Здравствуйте, сэр. Все системы в норме.',
      action: null
    };
  }

  // Смена темы: «тема <имя>» / «сменить тему на <имя>»
  const wantsTheme = text.includes('тема') || text.includes('тему') || text.includes('theme');
  const foundTheme = THEMES.find(t => text.includes(t));
  if (wantsTheme && foundTheme) {
    return { reply: `Принято, сэр. Переключаю тему на ${foundTheme}.`, action: { type: 'theme', value: foundTheme } };
  }
  if (wantsTheme) {
    return { reply: 'Какую тему включить, сэр? Доступны: cyan, matrix, violet, amber.', action: null };
  }
  // Просто название темы без слова «тема»
  if (THEMES.includes(text)) {
    return { reply: `Принято, сэр. Переключаю тему на ${text}.`, action: { type: 'theme', value: text } };
  }

  // Дождь: вкл/выкл
  if (text.includes('дождь') || text.includes('дожд')) {
    if (text.includes('выключ') || text.includes('выкл') || text.includes('off')) {
      return { reply: 'Выключаю кибер-дождь, сэр.', action: { type: 'rain', value: false } };
    }
    if (text.includes('включ') || text.includes('вкл') || text.includes('on')) {
      return { reply: 'Включаю кибер-дождь, сэр.', action: { type: 'rain', value: true } };
    }
    return { reply: 'Включить или выключить дождь, сэр?', action: null };
  }

  // --- управление ПК (п.13 плана) ---
  if (/(?:заблокируй|заблокировать|блокируй\s+экран|закрой\s+экран|замок)/i.test(text)) {
    return { reply: 'Блокирую рабочий стол, сэр.', action: { type: 'command', value: 'lock' } };
  }
  if (/(?:громче|увеличь\s+громкость|прибавь\s+звук)/i.test(text)) {
    return { reply: 'Увеличиваю громкость.', action: { type: 'command', value: 'volume_up' } };
  }
  if (/(?:тише|уменьши\s+громкость|убавь\s+звук)/i.test(text)) {
    return { reply: 'Уменьшаю громкость.', action: { type: 'command', value: 'volume_down' } };
  }
  if (/(?:без\s+звука|отключи\s+звук|включи\s+звук|mute)/i.test(text) && !text.includes('громк')) {
    return { reply: 'Переключаю звук.', action: { type: 'command', value: 'mute' } };
  }
  if (/(?:открой\s+проводник|проводник|папки|мой\s+компьютер)/i.test(text)) {
    return { reply: 'Открываю проводник, сэр.', action: { type: 'command', value: 'explorer' } };
  }
  if (/(?:спящий\s+режим|усни|спать\s+компьютер)/i.test(text)) {
    return { reply: 'Перевожу компьютер в спящий режим, сэр.', action: { type: 'command', value: 'sleep_pc' } };
  }

  // Быстрые действия (action у них = null, типы только theme/rain)
  if (text.includes('браузер')) {
    return { reply: 'Открываю браузер, сэр.', action: null };
  }
  if (text.includes('игр')) {
    return { reply: 'Запускаю игру. Удачи, сэр.', action: null };
  }
  if (text.includes('скриншот')) {
    return { reply: 'Делаю скриншот экрана, сэр.', action: null };
  }
  if (text.includes('сканир')) {
    return { reply: 'Запускаю сканирование системы, сэр.', action: null };
  }

  // Всё остальное — флаг fallback: чат отправит это в ИИ-модель (п.17),
  // а при её недоступности ответит FALLBACKS
  const reply = FALLBACKS[fallbackIndex % FALLBACKS.length];
  fallbackIndex++;
  return { reply, action: null, fallback: true };
}

module.exports = { getReply };
