// П.17: ИИ с личностью Джарвиса, OpenAI-совместимый эндпоинт.
// По умолчанию — локальный 9router/omniroute (localhost:20128) из secrets.json
// (URL + ключ + модель); без secrets.json падает на keyless Pollinations.ai.
// Переключение: JARVIS_AI_URL / JARVIS_AI_KEY / JARVIS_AI_MODEL / JARVIS_AI_MODEL2,
// выключить: JARVIS_AI=off
const { postJson } = require('./httpGet');

const AI_URL = process.env.JARVIS_AI_URL || 'https://text.pollinations.ai/openai';
const AI_KEY = process.env.JARVIS_AI_KEY || ''; // пусто → без заголовка Authorization
const MODEL = process.env.JARVIS_AI_MODEL || 'openai';
// запасная модель — только если задана явно (по умолчанию та же → шаг пропускается)
const BACKUP_MODEL = process.env.JARVIS_AI_MODEL2 || MODEL;
// включённость проверяется живьём в ask(): JARVIS_AI=off переключается из админ-панели

const RATE_WAIT = 3000;   // пауза после HTTP 429 (окно rate-limit у них секунды)
const DEADLINE = 32000;   // общий дедлайн: чат не должен висеть минутами

// Личность: кратко, «сир», лёгкий сарказм Старка, без выдумок о выполнении
const SYSTEM = [
  'Ты — J.A.R.V.I.S., персональный ИИ-ассистент в стиле «Железного человека».',
  'Всегда отвечай по-русски (если пользователь пишет не по-русски — отвечай на его языке),',
  'коротко: 1–3 предложения, живо, с лёгким сарказмом и уверенным тоном.',
  'Обращайся к пользователю «сэр» — он твой создатель.',
  'Ты живёшь в HUD-сайте-джарвисе на Windows-ПК пользователя.',
  'Твои реальные модули: погода по городу, курсы валют НБК, таймеры и напоминания,',
  'память («запомни …»), управление ПК (громкость, замок, проводник, сон),',
  'кибер-дождь, смена тем, игры Neon Runner/Memory/Snake, мониторинг системы.',
  'Команды-действия уже выполняет система — НЕ говори, что ты что-то выполнил, если не выполнял,',
  'и не проси подтверждение того, что уже сделано. Никаких списков и заголовков — только текст ответа.'
].join(' ');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// История: последние 8 сообщений чата (u=user, b=бот)
function buildMessages(message, history, memory) {
  const msgs = [{ role: 'system', content: SYSTEM }];

  if (Array.isArray(memory) && memory.length) {
    msgs.push({
      role: 'system',
      content: 'Что ты помнишь о пользователе (используй природно, не перечисляй): ' +
        memory.slice(-10).map((m) => m.text).join('; ').slice(0, 600)
    });
  }

  if (Array.isArray(history)) {
    history.slice(-8).forEach((h) => {
      const role = h.w === 'u' ? 'user' : 'assistant';
      const content = String(h.t || '').slice(0, 500);
      if (content) msgs.push({ role, content });
    });
  }

  msgs.push({ role: 'user', content: String(message).slice(0, 1000) });
  return msgs;
}

// один запрос → {ok:текст} | {empty:true} | {err:...}
async function attempt(modelName, msgs) {
  try {
    const data = await postJson(
      AI_URL,
      {
        model: modelName,
        messages: msgs,
        temperature: 0.85,
        max_tokens: 2000 // reasoning-модели жрут бюджет на «размышления» — 400 не хватало
      },
      AI_KEY ? { Authorization: 'Bearer ' + AI_KEY } : undefined
    );
    const content =
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content;
    if (typeof content === 'string' && content.trim()) {
      const text = content.trim().slice(0, 1200);
      console.log(`ИИ (${modelName}) ответил: ` + text.slice(0, 90));
      return { ok: text };
    }
    return { empty: true };
  } catch (e) {
    return { err: String(e.message || e) };
  }
}

// ожидание при cooldown: берём reset_seconds из тела ошибки, но не дольше 18с
// (общий дедлайн чата — 32с), иначе просто 3с
function cooldownWait(err) {
  const m = /reset_seconds[":\s]+(\d+)/.exec(err || '');
  if (m) {
    const sec = parseInt(m[1], 10);
    if (sec > 0) return Math.min(sec, 18) * 1000 + 500;
  }
  return RATE_WAIT;
}

// ядро: основная → (429/cooldown|пусто) пауза и повтор → запасная модель
async function core(message, history, memory) {
  const msgs = buildMessages(message, history, memory);

  let res = await attempt(MODEL, msgs);
  if (res.ok) return res.ok;

  if (res.err && /429|cooldown/.test(res.err)) {
    const wait = cooldownWait(res.err);
    console.log(`ИИ: cooldown (${MODEL}) — пауза ${Math.round(wait / 1000)}с, повторяю`);
    await sleep(wait);
    res = await attempt(MODEL, msgs);
    if (res.ok) return res.ok;
  } else if (res.err && /429/.test(res.err)) {
    await sleep(RATE_WAIT);
    res = await attempt(MODEL, msgs);
    if (res.ok) return res.ok;
  } else if (res.empty) {
    console.log(`ИИ (${MODEL}) вернул пустой ответ — повторяю`);
    res = await attempt(MODEL, msgs);
    if (res.ok) return res.ok;
  }

  if (BACKUP_MODEL && BACKUP_MODEL !== MODEL) {
    const b = await attempt(BACKUP_MODEL, msgs);
    if (b.ok) return b.ok;
    console.log(`ИИ: запасная ${BACKUP_MODEL} тоже молчит (${b.err || 'пусто'})`);
  }

  console.log(`ИИ: нет ответа (${res.err || 'пусто'}) — локальный фолбэк`);
  return null;
}

// → строка-ответ или null (тогда используется локальный фолбэк)
async function ask(message, history, memory) {
  if (process.env.JARVIS_AI === 'off') return null;

  let timer;
  const deadline = new Promise((r) => { timer = setTimeout(() => r('__deadline__'), DEADLINE); });
  try {
    const out = await Promise.race([core(message, history, memory), deadline]);
    clearTimeout(timer);
    if (out === '__deadline__') {
      console.log('ИИ: дедлайн ' + (DEADLINE / 1000) + 'с — локальный фолбэк');
      return null;
    }
    return out;
  } catch (e) {
    clearTimeout(timer);
    console.log('ИИ недоступен, локальный фолбэк:', e.message);
    return null;
  }
}

module.exports = { ask, MODEL };
