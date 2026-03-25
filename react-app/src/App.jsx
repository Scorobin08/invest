document.getElementById('calc-btn').addEventListener('click', calculate);

function calculate() {
  var amountVal = document.getElementById('amount').value.trim();
  var rateVal   = document.getElementById('rate').value.trim();
  var periodVal = document.getElementById('period').value.trim();

  var ok = true;

  // Валидация суммы
  if (amountVal === '' || isNaN(amountVal) || Number(amountVal) <= 0) {
    document.getElementById('err-amount').textContent = 'Введите сумму больше 0';
    document.getElementById('amount').classList.add('invalid');
    ok = false;
  } else {
    document.getElementById('err-amount').textContent = '';
    document.getElementById('amount').classList.remove('invalid');
  }

  // Валидация ставки
  if (rateVal === '' || isNaN(rateVal) || Number(rateVal) <= 0) {
    document.getElementById('err-rate').textContent = 'Введите ставку больше 0';
    document.getElementById('rate').classList.add('invalid');
    ok = false;
  } else {
    document.getElementById('err-rate').textContent = '';
    document.getElementById('rate').classList.remove('invalid');
  }

  // Валидация срока
  if (periodVal === '' || isNaN(periodVal) || Number(periodVal) <= 0) {
    document.getElementById('err-period').textContent = 'Введите срок больше 0';
    document.getElementById('period').classList.add('invalid');
    ok = false;
  } else {
    document.getElementById('err-period').textContent = '';
    document.getElementById('period').classList.remove('invalid');
  }

  if (!ok) return;

  var P = Number(amountVal);
  var r = Number(rateVal) / 100;
  var raw = Number(periodVal);
  var unit = document.getElementById('unit').value;

  // Срок в годах
  var t = (unit === 'months') ? raw / 12 : raw;

  // Сложные проценты с ежемесячным начислением
  var n = 12;
  var total  = P * Math.pow(1 + r / n, n * t);
  var profit = total - P;
  var pct    = ((profit / P) * 100).toFixed(2);

  function fmt(x) {
    return x.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  }

  document.getElementById('res-total').textContent     = fmt(total);
  document.getElementById('res-principal').textContent = fmt(P);
  document.getElementById('res-profit').textContent    = fmt(profit);
  document.getElementById('res-pct').textContent       = pct + '%';

  document.getElementById('result').style.display = 'block';
}