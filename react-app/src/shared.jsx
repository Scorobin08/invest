/* shared.js */

/* ── Кеш (TTL 4 мин) ── */
var _cache = {};
function _cacheGet(k) {
  var e = _cache[k];
  if (!e) return null;
  if (Date.now() - e.ts > 240000) { delete _cache[k]; return null; }
  return e.data;
}
function _cacheSet(k, d) { _cache[k] = { ts: Date.now(), data: d }; }

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
   yahooFetch — с кешем и умным fallback
   Порядок:
   1. query1 напрямую (быстро если браузер пропускает CORS)
   2. corsproxy.io (быстрый публичный прокси)
   3. allorigins (медленный, крайний вариант)
══════════════════════════════════════════════════════ */
function _tFetch(url, ms) {
  if (typeof AbortController === 'undefined') return fetch(url);
  var c = new AbortController();
  setTimeout(function() { c.abort(); }, ms);
  return fetch(url, { signal: c.signal });
}

function yahooFetch(sym, range, interval, cb) {
  var key = sym + '|' + range + '|' + interval;
  var hit = _cacheGet(key);
  if (hit) { setTimeout(function() { cb(hit); }, 0); return; }

  var base = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(sym) + '?interval=' + interval + '&range=' + range;

  /* Each entry: [url, isWrapped, timeoutMs] */
  var attempts = [
    [base, false, 3500],
    ['https://corsproxy.io/?' + encodeURIComponent(base), false, 6000],
    ['https://api.allorigins.win/get?url=' + encodeURIComponent(base), true, 12000],
  ];

  function parse(raw, isWrapped) {
    var data = isWrapped ? JSON.parse(raw.contents) : raw;
    if (!data.chart || !data.chart.result || !data.chart.result[0]) throw new Error('empty');
    return data.chart.result[0];
  }

  function run(i) {
    if (i >= attempts.length) { cb(null); return; }
    var cfg = attempts[i];
    _tFetch(cfg[0], cfg[2])
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var result = parse(data, cfg[1]);
        _cacheSet(key, result);
        cb(result);
      })
      .catch(function() { run(i + 1); });
  }
  run(0);
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