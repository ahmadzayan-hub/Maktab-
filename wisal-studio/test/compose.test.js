// اختبارات محرّك التأليف — بتتشغّل على Node من غير متصفح: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compose, composeOne, applyGender, rng, whatsappLink, daysUntil,
  RELATIONS, INTENTS, DIALECTS, relationById, intentById,
} from '../src/lib/compose.js';

test('صيغة المؤنث بتتبدّل صح', () => {
  assert.equal(applyGender('قلبي معا{ك|كي}', false), 'قلبي معاك');
  assert.equal(applyGender('قلبي معا{ك|كي}', true), 'قلبي معاكي');
  assert.equal(applyGender('نص عادي', true), 'نص عادي');
});

test('نفس الـ seed بيدّي نفس النص (حتمية)', () => {
  const o = { relationId: 'partner_wife', intentId: 'longing', dialect: 'egyptian', seed: 42 };
  assert.equal(composeOne(o).text, composeOne(o).text);
});

test('بذور مختلفة بتدّي نصوص مختلفة', () => {
  const base = { relationId: 'mother', intentId: 'thanks', dialect: 'egyptian' };
  const a = composeOne({ ...base, seed: 1 }).text;
  const b = composeOne({ ...base, seed: 2 }).text;
  const c = composeOne({ ...base, seed: 3 }).text;
  assert.ok(new Set([a, b, c]).size > 1, 'المفروض يختلفوا');
});

test('compose بيرجّع العدد المطلوب من غير تكرار', () => {
  const items = compose({ relationId: 'son', intentId: 'support', dialect: 'gulf', seed: 5 }, 2);
  assert.equal(items.length, 2);
  assert.notEqual(items[0].text, items[1].text);
});

test('الاسم بيستبدل النداء الافتراضي', () => {
  const withName = composeOne({ relationId: 'partner_wife', intentId: 'general', name: 'سارة', seed: 9 }).text;
  assert.ok(withName.includes('يا سارة'), withName);
  const noName = composeOne({ relationId: 'partner_wife', intentId: 'general', seed: 9 }).text;
  assert.ok(noName.includes('يا حبيبتي'), noName);
});

test('مفيش علامات {م|ف} متسرّبة في أي تركيبة', () => {
  for (const r of RELATIONS) {
    for (const i of INTENTS) {
      for (const d of DIALECTS) {
        for (let s = 1; s <= 4; s++) {
          const t = composeOne({ relationId: r.id, intentId: i.id, dialect: d.id, seed: s, name: 'نور' }).text;
          assert.ok(!/[{}|]/.test(t), `علامة متسرّبة: ${r.id}/${i.id}/${d.id} → ${t}`);
          assert.ok(t.length > 10, `نص قصير جداً: ${t}`);
        }
      }
    }
  }
});

test('كل نيّة × لهجة ليها بنك جُمل حقيقي', () => {
  for (const i of INTENTS) {
    for (const d of DIALECTS) {
      const texts = new Set();
      for (let s = 1; s <= 30; s++) texts.add(composeOne({ relationId: 'friend', intentId: i.id, dialect: d.id, seed: s }).text);
      assert.ok(texts.size >= 3, `تنوّع ضعيف في ${i.id}/${d.id}: ${texts.size}`);
    }
  }
});

test('لمسة الوقت بتظهر في الصباحي/المسائي', () => {
  const m = composeOne({ relationId: 'father', intentId: 'general', slot: 'morning', seed: 3 }).text;
  assert.ok(m.startsWith('صباح الخير'), m);
  const e = composeOne({ relationId: 'father', intentId: 'general', slot: 'evening', seed: 3 }).text;
  assert.ok(e.startsWith('مساء الخير'), e);
});

test('الطول القصير بيشيل الخاتمة', () => {
  const short = composeOne({ relationId: 'brother', intentId: 'dua', length: 'short', emoji: false, seed: 11 }).text;
  const warm = composeOne({ relationId: 'brother', intentId: 'dua', length: 'warm', emoji: false, seed: 11 }).text;
  assert.ok(warm.length > short.length);
});

test('إيموجي بيتقفل لما emoji=false', () => {
  const t = composeOne({ relationId: 'sister', intentId: 'congrats', emoji: false, seed: 2 }).text;
  assert.ok(!/\p{Extended_Pictographic}/u.test(t), t);
});

test('السياق اللي يكتبه المستخدم بيدخل في الرسالة', () => {
  const t = composeOne({ relationId: 'mother', intentId: 'general', context: 'عيد ميلادها بكرة', seed: 4 }).text;
  assert.ok(t.includes('عيد ميلادها بكرة'), t);
});

test('رابط واتساب بيترميز صح ومن غير رقم كمان', () => {
  assert.ok(whatsappLink('أهلاً', '+971 50 123 4567').startsWith('https://wa.me/971501234567?text='));
  assert.ok(whatsappLink('أهلاً').startsWith('https://wa.me/?text='));
  assert.ok(whatsappLink('a&b=c').includes(encodeURIComponent('a&b=c')));
});

test('daysUntil بيحسب صح وبيلف للسنة الجاية', () => {
  const today = new Date(2026, 0, 10); // 10 يناير
  assert.equal(daysUntil('01-10', today), 0);
  assert.equal(daysUntil('01-11', today), 1);
  assert.equal(daysUntil('01-09', today), 364); // عدّت → السنة الجاية
  assert.equal(daysUntil('99-99', today), null);
  assert.equal(daysUntil('', today), null);
});

test('rng ثابت ومحصور بين 0 و 1', () => {
  const a = rng(7), b = rng(7);
  for (let i = 0; i < 5; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('المعرّفات الغلط بترجع لافتراضي آمن', () => {
  assert.equal(relationById('nope').id, RELATIONS[0].id);
  assert.equal(intentById('nope').id, INTENTS[0].id);
  assert.ok(composeOne({ relationId: 'nope', intentId: 'nope', dialect: 'nope', seed: 1 }).text.length > 10);
});
