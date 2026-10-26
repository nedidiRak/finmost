const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../dist/learning.js');
const F=require('../dist/engine.js');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} ≠ ${expected}`);

test('Покупательная способность: рост цен и точное реальное изменение',()=>{
  const p=L.purchasingPower(10000,10,5,1);
  near(p.nominal,10500);near(p.basket,1100);near(p.real,9545.454545454545);near(p.change,-4.54545454545454);
  near(L.purchasingPower(10000,10,10,10).real,10000);
  near(L.purchasingPower(10000,0,0,1).baskets,10);
  near(L.purchasingPower(10000,10,0,2).basket,1210);
  assert.ok(L.purchasingPower(10000,5,10,3).real>10000);
});
test('Лаборатория цен отвергает недопустимые параметры',()=>{
  for(const args of [[10000,-1,5,1],[10000,5,30,1],[10000,5,5,1.5],[10000,5,5,0],[NaN,5,5,1],[10000,5,5,11],[10000,'5',5,1]])assert.throws(()=>L.purchasingPower(...args));
});
test('Четыре перевода сохраняют сумму модели и не меняют входное состояние',()=>{
  const original={...L.flowAccounts};let accounts={...original};
  L.flowSteps.forEach((s,i)=>{const input=accounts,before={...input};accounts=L.applyFlow(input,i,s.to);assert.deepEqual(input,before);assert.equal(Object.values(accounts).reduce((a,b)=>a+b,0),8000);});
  assert.deepEqual(original,{people:5000,bakery:2000,supplier:1000,public:0});
  assert.deepEqual(accounts,{people:4500,bakery:2100,supplier:1300,public:100});
  assert.throws(()=>L.applyFlow(original,0,'supplier'));
  assert.throws(()=>L.applyFlow({...original,people:0},0,'bakery'));
});
test('Хронология требует всех четырёх событий в правильном порядке',()=>{
  assert.equal(L.timelineCorrect(['coins','china','russia','sbp']),true);
  assert.equal(L.timelineCorrect(['russia','sbp','coins','china']),false);
  assert.equal(L.timelineCorrect(['coins','coins','russia','sbp']),false);
  assert.equal(L.timelineCorrect(['coins','china']),false);
});
test('Новые уроки сохраняются без потери старого прогресса и повторных баллов',()=>{
  const state=F.defaultState();F.completeLesson(state,'fraud',2,'2026-10-25');
  const old=F.validateState(JSON.parse(JSON.stringify(state)));assert.equal(old.lessons.fraud.score,2);
  for(const id of Object.keys(L.lessons)){assert.equal(F.completeLesson(old,id,3,'2026-10-26').points,100);assert.equal(F.completeLesson(old,id,1,'2026-10-26').points,0);}
  const restored=F.validateState(JSON.parse(JSON.stringify(old)));
  assert.equal(Object.keys(restored.lessons).length,5);assert.equal(restored.lessons.money.score,3);assert.equal(restored.lessons.fraud.score,2);
});
test('Все новые уроки имеют интерактивное задание, три корректных вопроса и источники',()=>{
  assert.equal(F.lessonIds.length,10);
  for(const [id,l] of Object.entries(L.lessons)){
    assert.ok(F.lessonIds.includes(id));assert.equal(l.questions.length,3);assert.ok(l.activity&&l.sources.length);
    for(const q of l.questions){assert.equal(q.a.length,3);assert.ok(Number.isInteger(q.c)&&q.c>=0&&q.c<q.a.length);assert.ok(q.e);}
  }
});
