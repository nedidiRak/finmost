const assert = require('node:assert/strict');
const test = require('node:test');
const F = require('../dist/engine.js');
test('Личный пример: 52 000 расходы, 5 000 остаток, цель 120 000, 12 пополнений',()=>{
  const r=F.budget(F.defaultState().budget);
  assert.equal(r.expenses,52000);assert.equal(r.free,13000);assert.equal(r.available,5000);
  assert.equal(r.target,120000);assert.equal(r.remaining,92000);assert.equal(r.months,12);
});
test('Взнос 10 000: срок 10 мес., остаток 3 000',()=>{
  const r=F.budget({...F.defaultState().budget,saving:10000});assert.equal(r.months,10);assert.equal(r.available,3000);assert.throws(()=>F.budget({...F.defaultState().budget,targetMonths:1.5}));
});
test('Нулевой взнос и непосильный взнос не создают ложного срока',()=>{
  assert.equal(F.budget({...F.defaultState().budget,saving:0}).months,null);
  assert.equal(F.budget({...F.defaultState().budget,saving:14000}).months,null);
  assert.equal(F.budget({...F.defaultState().budget,reserve:120000,saving:0}).months,0);
  assert.equal(F.budget({...F.defaultState().budget,income:0}).savingRate,null);
});
test('Некорректные и неполные суммы отклоняются',()=>{
  for(const value of ['',null,-1,NaN,Infinity,'abc',true,[]])assert.throws(()=>F.budget({...F.defaultState().budget,income:value}));
});
test('Календарь: дефицит 10 000 на второй неделе',()=>{
  const r=F.forecast(F.defaultState().business);assert.equal(r.min,-10000);assert.equal(r.firstNegative,1);assert.equal(r.end,75000);
});
test('Перенос платежа сохраняет итог и убирает недельный дефицит',()=>{
  const p=F.defaultState().business,r=F.forecast(F.shiftPayment(p,1,3,20000));
  assert.equal(r.min,10000);assert.equal(r.end,F.forecast(p).end);assert.equal(r.expense,F.forecast(p).expense);
  assert.equal(p.weeks[1].expense,85000);assert.throws(()=>F.shiftPayment(p,0,0,20000));assert.throws(()=>F.shiftPayment(p,1,3,90000));
});
test('Задержка поступления увеличивает дефицит, сохраняет общий доход',()=>{
  const p=F.defaultState().business,r=F.forecast(F.delayReceipt(p,1,2,20000));assert.equal(r.deficit,30000);assert.equal(r.income,F.forecast(p).income);assert.equal(r.end,75000);
});
test('Правила риска не выдают гарантию по новому получателю',()=>{
  assert.equal(F.risk({code:true}).level,'high');assert.equal(F.risk({stranger:true}).level,'review');assert.equal(F.risk({}).level,'clear');
});
test('Повторение улучшает результат, без повторных баллов',()=>{
  const s=F.defaultState();assert.equal(F.completeLesson(s,'budget',1,'2026-10-26').points,100);
  assert.equal(F.completeLesson(s,'budget',3,'2026-10-27').points,0);
  F.completeLesson(s,'budget',0,'2026-10-28');assert.equal(s.lessons.budget.score,3);assert.equal(Object.keys(s.lessons).length,1);
});
test('Импорт валидирует формат, очищает лишние поля, сохраняет корректные данные',()=>{
  const s=F.defaultState();s.untrusted='<script>';s.business.weeks[0].income='100';
  const restored=F.validateState(s);assert.equal(restored.untrusted,undefined);assert.equal(restored.business.weeks[0].income,100);
  assert.throws(()=>F.validateState({...s,version:99}));assert.throws(()=>F.validateState({...s,budget:{...s.budget,income:-20}}));
});
