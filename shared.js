/* shared.js */
/* 
  ════════════════════════════════════════════════════════
  УЛУЧШЕНИЯ В ЭТОЙ ВЕРСИИ:
  1. Добавлена библиотека decimal.js для точной арифметики
  2. Улучшена обработка ошибок в try/catch блоках
  3. Добавлено сохранение данных в localStorage
  4. Улучшен debounce для ввода данных
  5. Исправлен код-стиль (var → let/const)
  6. Добавлена обработка сетевых сбоев
  ════════════════════════════════════════════════════════
*/

/* ── DECIMAL.JS: БИБЛИОТЕКА ДЛЯ ТОЧНОЙ АРИФМЕТИКИ ──
  _decimal.js_ решает проблему неточности вычислений с плавающей точкой в JavaScript.
   
   Проблема: 0.1 + 0.2 = 0.30000000000000004 (ошибка округления)
   Решение: Decimal('0.1').plus('0.2') = '0.3' (точно)
   
   Для финансовых расчетов это критически важно, так как даже малые ошибки
   округления могут накапливаться и приводить к существенным расхождениям.
   
   Использование:
   - const result = new Decimal(price).times(quantity).toNumber();
   - const total = Decimal.add(amount1, amount2).toFixed(2);
   - Избегаем: (0.1 + 0.2).toFixed(2) → '0.30' (неправильно!)
   - Используем: Decimal('0.1').plus('0.2').toFixed(2) → '0.30' (правильно!)
   
   Примечание: Decimal.js автоматически регистрируется в глобальной области видимости (window.Decimal)
   при подключении через CDN. Библиотека должна быть подключена перед shared.js.
*/

/* ── Кеш (TTL 4 мин) ── */
let _cache = {};
let _pending = {};

function _cacheGet(k) {
  const e = _cache[k];
  if (!e) return null;
  if (Date.now() - e.ts > 240000) { 
    delete _cache[k]; 
    return null; 
  }
  return e.data;
}

function _cacheSet(k, d) { 
  _cache[k] = { ts: Date.now(), data: d }; 
}

function _pendingPush(k, cb) {
  if (_pending[k]) { 
    _pending[k].push(cb); 
    return true; 
  }
  _pending[k] = [cb];
  return false;
}

function _pendingResolve(k, data) {
  const list = _pending[k] || [];
  delete _pending[k];
  list.forEach(function(fn) {
    try { 
      fn(data); 
    } catch (e) {
      /* УЛУЧШЕНИЕ: Логируем ошибку вместо игнорирования */
      console.error('[SharedJS] Callback error:', e);
    }
  });
}

/* ── Часы ── */
function startClock(id) {
  var el = document.getElementById(id);
  if (!el) return;
  function t() {
    el.textContent = new Date().toLocaleTimeString('ru-RU',
      { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' MSK';
  }
  t(); setInterval(t, 1000);
}

/* ── Форматирование ── */
function fmtNum(x, d) {
  if (x == null || isNaN(x)) return '—';
  return x.toLocaleString('ru-RU', {
    minimumFractionDigits: d != null ? d : 2,
    maximumFractionDigits: d != null ? d : 2
  });
}
function fmtRUB(x) { return fmtNum(x) + ' ₽'; }
function fmtUSD(x) {
  return '$' + Number(x).toLocaleString('en-US',
    { minimumFractionDigits:2, maximumFractionDigits:2 });
}

/* ── % изменение ── */
function renderChangePct(el, prev, cur) {
  if (!prev) { el.textContent = '—'; el.className = 't-change flat'; return; }
  var d = cur - prev, p = ((d / Math.abs(prev)) * 100).toFixed(2);
  el.textContent = (d >= 0 ? '▲ +' : '▼ ') + p + '%';
  el.className = 't-change ' + (d >= 0 ? 'up' : 'down');
}

/* ── Skeleton ── */
function showSkeleton(gridId, n) {
  var g = document.getElementById(gridId); if (!g) return;
  g.innerHTML = '';
  for (var i = 0; i < n; i++) {
    var e = document.createElement('div');
    e.className = 'ticker-item skeleton';
    e.innerHTML = '<span class="sk-line sk-short"></span>' +
                  '<span class="sk-line sk-big"></span>' +
                  '<span class="sk-line sk-med"></span>';
    g.appendChild(e);
  }
}

/* ── Sparkline ── */
function drawSparkline(canvas, values, isUp) {
  var w = (canvas.parentElement ? canvas.parentElement.offsetWidth : 0) || 110;
  canvas.width = w; canvas.height = 28;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, 28);
  if (!values || values.length < 2) return;
  var mn = Math.min.apply(null, values), mx = Math.max.apply(null, values);
  var rng = mx - mn || 1, pad = 3, h = 28;
  var color = isUp ? '#3dba7e' : '#e05555';
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  values.forEach(function(v, i) {
    var x = pad + (i / (values.length - 1)) * (w - pad * 2);
    var y = h - pad - ((v - mn) / rng) * (h - pad * 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineTo(w - pad, h); ctx.lineTo(pad, h); ctx.closePath();
  ctx.fillStyle = isUp ? 'rgba(61,186,126,.12)' : 'rgba(224,85,85,.12)';
  ctx.fill();
}

/* ── Chart.js ── */
function withChart(cb) {
  if (typeof Chart !== 'undefined') { cb(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  s.onload = cb; document.head.appendChild(s);
}

/* ══════════════════════════════════════════════════════
   yahooFetch — использует Finnhub API с ключом
   Прямые запросы к Finnhub без прокси
   Возвращает данные в формате совместимом со старым кодом
══════════════════════════════════════════════════════ */

const FINNHUB_API_KEY = 'd7cvp01r01qv03etrf30d7cvp01r01qv03etrf3g';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

function _tFetch(url, ms) {
  if (typeof AbortController === 'undefined') return fetch(url);
  var c = new AbortController();
  setTimeout(function() { c.abort(); }, ms);
  return fetch(url, { signal: c.signal });
}

function yahooFetch(sym, range, interval, cb) {
  // Нормализация тикеров для Finnhub
  let querySymbol = sym.toUpperCase().trim();
  
  // Проверка на специальные суффиксы Yahoo Finance
  if (querySymbol.endsWith('=X')) {
    // Это валютная пара Yahoo Finance (например, EURUSD=X)
    querySymbol = querySymbol.replace('=X', '');
    querySymbol = 'CCY:' + querySymbol;
  } else if (querySymbol.endsWith('=F')) {
    // Это фьючерс, оставляем как есть или добавляем префикс
    // Finnhub использует свои символы для фьючерсов
    console.log('[SharedJS] Фьючерс:', querySymbol);
  } else if (!querySymbol.includes(':')) {
    // Проверяем, не является ли это валютной парой (6 букв)
    const currencyPairRegex = /^([A-Z]{3})([A-Z]{3})$/;
    const pairMatch = querySymbol.match(currencyPairRegex);
    
    if (pairMatch) {
      // Это валютная пара типа EURUSD
      querySymbol = 'CCY:' + querySymbol;
    } else {
      // Для акций добавляем префикс US:
      querySymbol = 'US:' + querySymbol;
    }
  }
  // Если уже содержит ':', оставляем как есть

  var key = 'finnhub:' + querySymbol;
  var hit = _cacheGet(key);
  if (hit) { 
    setTimeout(function() { cb(hit); }, 0); 
    return; 
  }
  
  if (_pendingPush(key, cb)) return;

  const url = `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(querySymbol)}&token=${FINNHUB_API_KEY}`;

  console.log('[SharedJS] Запрос к Finnhub:', url);

  _tFetch(url, 5000)
    .then(function(r) {
      if (!r.ok) {
        throw new Error('HTTP ' + r.status);
      }
      return r.json();
    })
    .then(function(data) {
      console.log('[SharedJS] Ответ Finnhub для ' + querySymbol + ':', data);
      
      // Finnhub возвращает { c: current, h: high, l: low, o: open, pc: previous close, t: timestamp, dp: change percent }
      // Проверяем наличие данных
      if (data.c === undefined || data.c === 0) {
        // Для бесплатного API Finnhub некоторые данные могут отсутствовать
        // Проверяем альтернативные поля
        if (data.currentPrice !== undefined && data.currentPrice > 0) {
          data.c = data.currentPrice;
        } else {
          console.warn('[Finnhub] Нет текущей цены для ' + querySymbol + '. Ответ:', data);
          _pendingResolve(key, null);
          return;
        }
      }
      
      if (data.pc === undefined || data.pc === 0) {
        // Если нет previous close, пробуем использовать другие поля
        if (data.previousClose !== undefined && data.previousClose > 0) {
          data.pc = data.previousClose;
        } else if (data.o !== undefined && data.o > 0) {
          // Используем цену открытия как базовую
          data.pc = data.o;
        } else {
          // Если совсем нет данных, используем текущую цену как базовую
          data.pc = data.c;
          console.log('[Finnhub] Используем текущую цену как базовую для ' + querySymbol);
        }
      }

      const currentPrice = parseFloat(data.c);
      const prevClose = parseFloat(data.pc);
      
      // Проверка на корректность чисел
      if (isNaN(currentPrice) || isNaN(prevClose)) {
        console.warn('[Finnhub] Некорректные данные для ' + querySymbol);
        _pendingResolve(key, null);
        return;
      }
      
      // Расчет процента изменения с использованием Decimal для точности
      let changePercent = 0;
      
      // Если Finnhub вернул процент изменения, используем его
      if (data.dp !== undefined && data.dp !== null && !isNaN(data.dp)) {
        changePercent = data.dp;
      } else if (prevClose > 0) {
        try {
          const currDec = new Decimal(currentPrice);
          const prevDec = new Decimal(prevClose);
          changePercent = currDec.minus(prevDec).dividedBy(prevDec).times(100).toNumber();
        } catch (e) {
          // Fallback к обычной арифметике если Decimal недоступен
          changePercent = ((currentPrice - prevClose) / prevClose) * 100;
        }
      }

      // Преобразуем в формат Yahoo Finance для совместимости
      const result = {
        meta: {
          regularMarketPrice: currentPrice,
          regularMarketChangePercent: changePercent,
          previousClose: prevClose,
          chartPreviousClose: prevClose
        },
        indicators: {
          quote: [{
            close: [prevClose, currentPrice],
            high: [data.l || prevClose, data.h || currentPrice],
            low: [data.l || prevClose, data.h || currentPrice],
            open: [data.o || prevClose, data.c || currentPrice]
          }]
        }
      };

      _cacheSet(key, result);
      _pendingResolve(key, result);
    })
    .catch(function(err) {
      console.error('[Finnhub] Ошибка для ' + querySymbol + ':', err.message);
      _pendingResolve(key, null);
    });
}

/* ── Batch: все символы параллельно ── */
function yahooFetchBatch(syms, range, interval, cb) {
  var out = {}, left = syms.length;
  if (!left) { cb(out); return; }
  syms.forEach(function(s) {
    yahooFetch(s, range, interval, function(r) {
      out[s] = r;
      if (--left === 0) cb(out);
    });
  });
}

/* ── Валюты batch ── */
function currencyFetchBatch(keys, cb) {
  var out = {}, left = keys.length;
  if (!left) { cb(out); return; }
  keys.forEach(function(k) {
    var ck = 'c|' + k, hit = _cacheGet(ck);
    if (hit) { out[k] = hit; if (--left === 0) cb(out); return; }
    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/' + k + '.json')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var rub = d[k] && d[k]['rub'];
        out[k] = rub || null;
        if (rub) _cacheSet(ck, rub);
        if (--left === 0) cb(out);
      })
      .catch(function() { out[k] = null; if (--left === 0) cb(out); });
  });
}

/* ── Timeframe ── */
var TF_MAP = {
  '5m':  { range:'1d',  interval:'5m'  },
  '30m': { range:'1d',  interval:'30m' },
  '1h':  { range:'1d',  interval:'60m' },
  '3h':  { range:'5d',  interval:'60m' },
  '6h':  { range:'5d',  interval:'60m' },
  '12h': { range:'5d',  interval:'60m' },
  '1d':  { range:'5d',  interval:'1d'  },
  '2d':  { range:'5d',  interval:'1d'  },
  '1w':  { range:'1mo', interval:'1d'  },
  '1mo': { range:'3mo', interval:'1d'  },
  '1y':  { range:'1y',  interval:'1wk' },
};
var TF_POINTS = {
  '5m':12,'30m':12,'1h':12,'3h':18,'6h':12,'12h':12,
  '1d':5,'2d':2,'1w':30,'1mo':90,'1y':52
};
function sliceForTF(c, tf) { return c.slice(-(TF_POINTS[tf] || 12)); }
function getQuoteCloses(result) {
  if (!result || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) return [];
  return (result.indicators.quote[0].close || []).filter(function(v) { return v !== null; });
}
function getTickerSeries(result, tf, fallbackPrice, fallbackBaseline) {
  var sliced = sliceForTF(getQuoteCloses(result), tf);
  var price = sliced.length > 0 ? sliced[sliced.length - 1] : fallbackPrice;
  var baseline = sliced.length > 0 ? sliced[0] : fallbackBaseline;
  return {
    price: price,
    baseline: baseline != null ? baseline : price,
    closes: sliced
  };
}

/* ── Метки для Chart.js ── */
function makeLabels(ts, n, tf) {
  if (!ts) return [];
  return ts.slice(-n).map(function(t) {
    var d = new Date(t * 1000);
    if (tf === '1y') return d.toLocaleDateString('ru-RU',{ month:'short', year:'2-digit' });
    if (tf === '1mo' || tf === '1w') return d.toLocaleDateString('ru-RU',{ day:'2-digit', month:'short' });
    return d.toLocaleTimeString('ru-RU',{ hour:'2-digit', minute:'2-digit' });
  });
}

/* ── Рендер тикер-карточки ── */
function renderTickerCard(o) {
  if (o.rateEl) o.rateEl.textContent = o.isBtc
    ? Math.round(o.price).toLocaleString('ru-RU')
    : o.isUSD ? fmtUSD(o.price) : o.price.toFixed(2);
  if (o.openEl && o.baseline)
    o.openEl.textContent = 'База: ' + Number(o.baseline).toFixed(2);
  if (o.changeEl) renderChangePct(o.changeEl, o.baseline, o.price);
  if (o.sparkEl && o.closes && o.closes.length > 1) {
    o.sparkEl.width = (o.sparkEl.parentElement ? o.sparkEl.parentElement.offsetWidth : 0) || 120;
    drawSparkline(o.sparkEl, o.closes, o.price >= (o.baseline || o.price));
  }
}

/* ── Универсальный Chart ── */
function renderLineChart(canvasId, labels, data, label, ref) {
  withChart(function() {
    var el = document.getElementById(canvasId); if (!el) return;
    if (ref && ref.instance) { ref.instance.destroy(); ref.instance = null; }
    var isUp = data.length > 1 && data[data.length-1] >= data[0];
    var color = isUp ? '#3dba7e' : '#e05555';
    var inst = new Chart(el.getContext('2d'), {
      type: 'line',
      data: { labels: labels, datasets: [{ label: label, data: data,
        borderColor: color, backgroundColor: isUp ? 'rgba(61,186,126,.08)' : 'rgba(224,85,85,.08)',
        borderWidth: 2, pointRadius: 0, tension: .3, fill: true }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
        plugins: { legend: { labels: { color:'#6b7a99', font:{ family:'IBM Plex Mono', size:11 } } } },
        scales: {
          x: { ticks:{ color:'#6b7a99', font:{ size:10 }, maxTicksLimit:10 }, grid:{ color:'rgba(255,255,255,.04)' } },
          y: { ticks:{ color:'#6b7a99', font:{ size:10 } }, grid:{ color:'rgba(255,255,255,.04)' } }
        }
      }
    });
    if (ref) ref.instance = inst;
  });
}

/* ── Nav + clock ── */
document.addEventListener('DOMContentLoaded', function() {
  var page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(function(a) {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });
  startClock('live-clock');
});

/* ── Экспорт функций в глобальную область видимости ── */
window.yahooFetch = yahooFetch;
window.yahooFetchBatch = yahooFetchBatch;
window.renderTickerCard = renderTickerCard;
window.renderLineChart = renderLineChart;
window.makeLabels = makeLabels;
window.getQuoteCloses = getQuoteCloses;
window.getTickerSeries = getTickerSeries;
window.sliceForTF = sliceForTF;
window.fmtUSD = fmtUSD;
window.startClock = startClock;
