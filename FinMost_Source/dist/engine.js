/* ФинМост 1.1.0. Расчеты без внешних зависимостей. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinMost = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
  function numeric(value, name, min = 0, max = 1e9) {
    if (value === '' || value === null || typeof value === 'boolean' || typeof value === 'object' || !Number.isFinite(Number(value))) throw new Error('Укажите число: ' + name);
    const n = Number(value);
    if (n < min || n > max) throw new Error(name + ': допустимо от ' + min + ' до ' + max);
    return n;
  }
  function budget(data) {
    const p = {};
    for (const k of ['income', 'essential', 'variable', 'debt', 'reserve', 'saving']) p[k] = numeric(data[k], k);
    p.targetMonths = numeric(data.targetMonths, 'месяцев резерва', 1, 12);
    if (!Number.isInteger(p.targetMonths)) throw new Error('Укажите целое число месяцев');
    const expenses = money(p.essential + p.variable + p.debt);
    const free = money(p.income - expenses);
    const available = money(free - p.saving);
    const target = money((p.essential + p.debt) * p.targetMonths);
    const remaining = Math.max(0, money(target - p.reserve));
    const sustainable = p.saving > 0 && available >= 0;
    return {expenses, free, available, target, remaining, sustainable,
      months: remaining === 0 ? 0 : sustainable ? Math.ceil(remaining / p.saving) : null,
      coverage: p.essential + p.debt > 0 ? p.reserve / (p.essential + p.debt) : null,
      progress: target > 0 ? Math.min(100, p.reserve / target * 100) : 100,
      savingRate: p.income > 0 ? p.saving / p.income : null};
  }
  function forecast(data) {
    let balance = numeric(data.opening, 'остаток', 0);
    if (!Array.isArray(data.weeks) || data.weeks.length !== 8) throw new Error('Нужно 8 недель');
    const rows = data.weeks.map((w, i) => {
      const income = numeric(w.income, 'поступления недели ' + (i + 1));
      const expense = numeric(w.expense, 'платежи недели ' + (i + 1));
      const opening = balance;
      balance = money(balance + income - expense);
      return {label: String(w.label).slice(0, 32), income, expense, opening, balance, index: i};
    });
    const min = Math.min(...rows.map(r => r.balance));
    return {rows, min, deficit: Math.max(0, -min), firstNegative: rows.findIndex(r => r.balance < 0),
      end: balance, income: money(rows.reduce((s,r) => s+r.income,0)), expense: money(rows.reduce((s,r) => s+r.expense,0))};
  }
  function shiftPayment(data, from, to, amount) {
    const copy = JSON.parse(JSON.stringify(data));
    amount = numeric(amount, 'перенос', 0.01);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || !copy.weeks[from] || !copy.weeks[to]) throw new Error('Укажите разные недели');
    if (copy.weeks[from].expense < amount) throw new Error('Сумма переноса больше платежей недели');
    copy.weeks[from].expense = money(copy.weeks[from].expense - amount);
    copy.weeks[to].expense = money(copy.weeks[to].expense + amount);
    return copy;
  }
  function delayReceipt(data, from, to, amount) {
    const copy = JSON.parse(JSON.stringify(data));
    amount = numeric(amount, 'задержка', 0.01);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || !copy.weeks[from] || !copy.weeks[to]) throw new Error('Укажите разные недели');
    if (copy.weeks[from].income < amount) throw new Error('Сумма задержки больше поступлений недели');
    copy.weeks[from].income = money(copy.weeks[from].income - amount);
    copy.weeks[to].income = money(copy.weeks[to].income + amount);
    return copy;
  }
  const riskRules = {
    safeAccount: {strong: true, text: 'Просят перевести деньги на «безопасный счёт». Это характерный сценарий обмана.'},
    code: {strong: true, text: 'Просят сообщить код подтверждения. Код нельзя передавать другому человеку.'},
    remote: {strong: true, text: 'Просят установить программу удалённого доступа. Так можно передать управление устройством.'},
    hurry: {strong: false, text: 'Торопят и не дают проверить информацию. Остановитесь и свяжитесь с организацией самостоятельно.'},
    stranger: {strong: false, text: 'Получатель новый. Проверьте его реквизиты и назначение платежа по независимому каналу.'}
  };
  function risk(flags) {
    const found = Object.keys(riskRules).filter(k => flags[k]);
    const high = found.some(k => riskRules[k].strong);
    return {level: high ? 'high' : found.length ? 'review' : 'clear', reasons: found.map(k => riskRules[k].text), flags: found};
  }
  const lessonIds = ['budget','reserve','fraud','credit','business','data','money','history','economy','inflation'];
  function defaultState() {
    return {version: VERSION, profile: 'personal', largeText: false,
      budget: {income:65000,essential:34000,variable:12000,debt:6000,reserve:28000,saving:8000,targetMonths:3},
      business: {opening:80000,weeks:[
        {label:'26 окт',income:30000,expense:55000},{label:'2 ноя',income:20000,expense:85000},
        {label:'9 ноя',income:45000,expense:35000},{label:'16 ноя',income:80000,expense:45000},
        {label:'23 ноя',income:60000,expense:55000},{label:'30 ноя',income:70000,expense:50000},
        {label:'7 дек',income:50000,expense:60000},{label:'14 дек',income:90000,expense:65000}]},
      lessons:{}, events:[], safetyRuns:0, safeDecisions:0};
  }
  function validateState(raw) {
    if (!raw || raw.version !== VERSION || !raw.budget || !raw.business) throw new Error('Неизвестный формат резервной копии');
    budget(raw.budget);forecast(raw.business);
    const base = defaultState();
    for (const k of Object.keys(base.budget)) base.budget[k] = Number(raw.budget[k]);
    base.business = {opening:Number(raw.business.opening), weeks: raw.business.weeks.map(w=>({label:String(w.label).slice(0,32),income:Number(w.income),expense:Number(w.expense)}))};
    base.profile = raw.profile === 'business' ? 'business':'personal';
    base.largeText = !!raw.largeText;
    for (const id of lessonIds) {
      const l = raw.lessons && raw.lessons[id];
      if (l && Number.isInteger(l.score) && l.score>=0 && l.score<=3 && typeof l.completedAt==='string') base.lessons[id]={score:l.score,completedAt:l.completedAt.slice(0,40)};
    }
    if (Array.isArray(raw.events)) base.events=raw.events.slice(-500).filter(e=>e&&typeof e.type==='string'&&typeof e.time==='string').map(e=>({type:e.type.slice(0,60),time:e.time.slice(0,40),detail:typeof e.detail==='string'?e.detail.slice(0,180):''}));
    base.safetyRuns = numeric(raw.safetyRuns ?? 0,'тренировки',0,1e6);
    base.safeDecisions = Math.min(base.safetyRuns,numeric(raw.safeDecisions ?? 0,'решения',0,1e6));
    if(!Number.isInteger(base.safetyRuns)||!Number.isInteger(base.safeDecisions)) throw new Error('Счётчики должны быть целыми числами');
    return base;
  }
  function completeLesson(state,id,score,date) {
    if(!lessonIds.includes(id)||!Number.isInteger(score)||score<0||score>3) throw new Error('Некорректный результат урока');
    const first = !state.lessons[id];
    if (first || score>state.lessons[id].score) state.lessons[id]={score,completedAt:date};
    return {first,points: first ? 100:0};
  }
  return {VERSION, numeric, budget, forecast, shiftPayment, delayReceipt, risk, riskRules, defaultState, validateState, completeLesson, lessonIds};
});
