# План доработки J.A.R.V.I.S. — прогресс

Порядок: по номерам. **Пункт 11 пропущен** (named tunnel — отменён, будет платный домен).
После каждого пункта: `node --check` извлечённого `<script>`, `node --check server.js` (если менялся бэкенд), проверка `curl localhost:3000`.

| # | Пункт | Статус |
|---|-------|--------|
| 1 | Голосовое управление: распознавание речи (Web Speech API), кнопка в шапке, речь → чат | DONE (кнопка СЛУШАТЬ, ru-RU, живой текст в поле ввода, фолбэк «н/д») |
| 2 | История чата и команд: localStorage, кнопка «Очистить», поиск по истории, ↑↓ в терминале | DONE (50 сообщений, msgSearch, chatClear, ↑↓ терминал) |
| 3 | Погода: реакция дождя-Canvas на осадки + уведомление об осадках | DONE (setRainFX clear/rain/heavy/snow, уведомление 1 раз/session, JARVIS.weatherInfo) |
| 4 | Быстрые команды — редактируемый список (добавить/удалить, localStorage) | DONE (рендер из localStorage, режим ⚙, prompt-добавление, ✕-удаление) |
| 5 | Boot-экран при загрузке (типовой прогон строк, затем HUD) | DONE (#bootScreen, 10 строк, клик/клавиша — пропустить) |
| 6 | Серверные таймеры: /api/timers, оповещение во все вкладки, время «в 18:30» | DONE (timerStore+routes, poll 1.5с, HH:MM в чате/терминале/форме, API протестирован) |
| 7 | Wake-word «Джарвис»: непрерывное слушающее режим | DONE (wakeToggle, субтитр #wakeSub, перезапуск по тишине, взаимное выключение с mic) |
| 8 | Модуль памяти: /api/memory, вкладка «Память», «запомни…» в брейне | DONE (memoryStore+routes, brain: запомни/что помнишь/меня зовут→персонал. приветствие, терминал, вкладка, тесты прошли) |
| 9 | Погодный виджет в шапке (компактный, кэш 10 мин, клик → панель погоды) | DONE (wxChip, из JARVIS.weatherInfo, клик → скролл к панели) |
| 10 | Честный мониторинг: диск, топ процессов, график CPU (canvas) | DONE (df д/C:, ps топ, /proc/net/dev сеть, cpuHistory график, wmic/Powershell-фолбэки win) |
| 11 | Named tunnel + домен | SKIPPED (будет платный домен) |
| 12 | Плагины: папка plugins/, примеры — погода, курсы валют (NBK) | DONE (pluginHost+GET /api/plugins, weather+currency живые, terminal/chat хуки, help обогащён) |
| 13 | Управление ПК: замок, громкость, сон, проводник (/api/command) | DONE (pcActions: WSL-полные пути, keybd_event через EncodedCommand, brain-действия, терминал, кнопки+миграция DEFAULT_Q; lock/sleep не тест вживую) |
| 14 | Игры: Memory + Snake внутри вкладки «Игра», серверный лидерборд Neon Runner | DONE (game-switch 3 игры, Memory 4×4, Snake canvas, scoreStore + GET/POST /api/scores top-10, пост счёта с game over, roadmap ревизия) |
| 15 | PWA: manifest.json, service worker, SVG-иконка, установка на телефон | DONE (manifest+icon.svg+sw.js cache-first/offline, whitelist-роуты статики, регистрация в init) |
| 16 | PIN-код на API: /api/auth, заглушка-оверлей, заголовок x-jarvis-pin через переопределённый fetch | DONE (PIN gate на /api/* кроме auth, оверлей z-400 + ввод Enter, sessionStorage jarvis-pin, дубли после случайных повторов вычищены) |
| 17 | (бонус) ИИ-чат: бесплатная модель с личностью Джарвиса отвечает на обычные вопросы | DONE (aiBrain: сначала Pollinations keyless, затем **9router/omniroute localhost:20128**, ключ+URL+модели в gitignored `secrets.json`, модели с префиксом `9router-my/oc/…` (mimo-v2.6 основная, muse запасная), пауза по `reset_seconds` ≤18с, история 8 сообщений + память, фолбэк на FALLBACKS; JARVIS_AI=off — выкл.) |

## Ключевые решения
- fetch-обёртка для PIN (п.16) — переопределить window.fetch один раз, все существующие вызовы `/api/*` автоматически получают заголовок.
- Таймеры (п.6): сервер — источник истины; клиенты поллят GET /api/timers каждые 1.5с, стреляют однократно по новым fired-ид.
- Плагины (п.12): `plugins/*.js` → `module.exports = {name, commands:[{cmd, desc}], run(cmd,args)}`; терминал вызывает до локальных команд.
- Игры (п.14): внутри вкладки «Игра» мини-переключатель Neon Runner | Memory | Snake; лидерборд → GET/POST /api/scores.
- Бэкенд: server.js (express, port 3000), routes/{chat,system,commands,terminal}.js, services/{jarvisBrain,stateStore,systemMonitor}.js.

## ИИ-фичи (помечены бейджом «ИИ» в интерфейсе)

| Фича | Где в UI / API | Как работает |
|------|----------------|--------------|
| **ИИ-чат** | панель `Communication Channel` (бейдж ИИ), `POST /api/chat` (бейдж ИИ), модуль NEURAL CHAT | `routes/chat.js` → `aiBrain.ask()` → 9router `127.0.0.1:20128/v1`, модель `9router-my/oc/mimo-v2.6-flash-free` (бэкап `muse-spark-1.3`), системный промпт-личность, история 8 сообщений, память пользователя |
| **Голос → ИИ** | кнопка `СЛУШАТЬ` (title помечен) | Web Speech API: речь → `JARVIS.chatSend` → тот же ИИ-чат |
| **Wake-word «Джарвис»** | режим слушания (title помечен) | распознанная фраза после «джарвис…» → `chatSend` → ИИ-чат |
| **Текстовые быстрые команды** | кнопки с чипом `ИИ` | `q.text` → `chatSend` → ИИ-чат (кнопки с `action` — локальные, без ИИ) |
| **Озвучка ИИ-ответов** | `Голос: ВКЛ` (title помечен) | `speechSynthesis` произносит reply, полученный от ИИ |

**Не ИИ (помечено честно):** `AI News` — лента X/Hacker News/DEV.to (бейдж «лента · не ИИ»); погода — Open-Meteo, валюты — НБК; память («что ты помнишь»), команды-действия, терминал — правила `jarvisBrain`/заготовленные ответы; распознавание и синтез речи — системный Web Speech API, не модель.

**Секреты:** `secrets.json` (URL/ключ/модели) — в `.gitignore`, в git не попадает; `server.js` подгружает его до require роутов.
