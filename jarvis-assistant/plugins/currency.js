// Плагин курсов валют Национального Банка Казахстана (бесплатный XML)
const { getText } = require('../services/httpGet');

const WORD2CODE = [
  [/доллар/i, 'USD'],
  [/евро/i, 'EUR'],
  [/рубл/i, 'RUB'],
  [/юан|китайск/i, 'CNY'],
  [/фунт/i, 'GBP'],
  [/франк/i, 'CHF'],
  [/лир/i, 'TRY'],
  [/тенге/i, 'KZT']
];
const SHOW = ['USD', 'EUR', 'RUB', 'CNY'];

async function fetchRates(dateStr) {
  // НБК принимает только DD.MM.YYYY (или DD/MM/YYYY)
  const xml = await getText(
    'https://nationalbank.kz/rss/get_rates.cfm?fdate=' + encodeURIComponent(dateStr)
  );
  const rates = {};
  const re = /<item>[\s\S]*?<title>([A-Z]{3})<\/title>[\s\S]*?<description>([\d.]+)<\/description>[\s\S]*?<quant>(\d+)<\/quant>[\s\S]*?<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    rates[m[1]] = { value: m[2], quant: Number(m[3]) || 1 };
  }
  return rates;
}

// «1 USD = 421 KZT» с учётом котельности (RUB/AMD дают за 100/10 единиц)
function line(code, r) {
  const q = r.quant > 1 ? String(r.quant) : '1';
  return q + ' ' + code + ' = ' + r.value + ' KZT';
}

module.exports = {
  name: 'currency',
  commands: [
    { cmd: 'курс', desc: 'курсы валют НБК: курс доллара | курс' },
    { cmd: 'валюты', desc: 'топ-4 курса НБК (USD/EUR/RUB/CNY)' }
  ],
  async run(cmd, args) {
    // дата НБК: сегодня, при пустом ответе — вчера
    const now = new Date();
    const fmt = (d) =>
      String(d.getDate()).padStart(2, '0') + '.' +
      String(d.getMonth() + 1).padStart(2, '0') + '.' +
      d.getFullYear();
    const d1 = fmt(now);
    const y = fmt(new Date(now.getTime() - 86400000));
    let rates = {};
    let date = d1;
    try {
      rates = await fetchRates(d1);
      if (!Object.keys(rates).length) { date = y; rates = await fetchRates(y); }
    } catch (e) {
      return 'Сервис НБК недоступен, сэр (' + e.message + ').';
    }
    if (!Object.keys(rates).length) return 'Курсы НБК не получены, сэр.';

    if (cmd === 'курс' && args) {
      let code = null;
      for (const [re, c] of WORD2CODE) { if (re.test(args)) { code = c; break; } }
      if (code === 'KZT') return 'Тенге — это и есть база, сэр. 1 KZT = 1 KZT.';
      if (code) {
        const r = rates[code];
        if (!r) return `Валюта ${code} не найдена в курсах НБК.`;
        return `Курс НБК (${date}): ${line(code, r)}.`;
      }
      return 'Какую валюту? Например: курс доллара | курс евро | курс юаня.';
    }

    // валюты / «курс» без аргументов — топ-4
    const lines = SHOW.filter((c) => rates[c]).map((c) => line(c, rates[c]));
    if (!lines.length) return 'Курсы НБК не распознаны.';
    return `Курсы НБК (${date}):\n` + lines.join('\n');
  }
};
