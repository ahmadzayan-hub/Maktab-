import React, { useEffect, useMemo, useState } from 'react';
import {
  compose, whatsappLink, daysUntil,
  RELATIONS, INTENTS, DIALECTS, relationById,
} from './lib/compose.js';

// تخزين محلي آمن: في وضع التصفّح الخاص الوصول نفسه ممكن يرمي استثناء.
const store = {
  get(key, def) {
    try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); }
    catch { return def; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* مش حرج */ } },
};

function Chips({ options, value, onChange, idKey = 'id', label }) {
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className="chips" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o[idKey]}
            type="button"
            className={'chip' + (value === o[idKey] ? ' sel' : '')}
            aria-pressed={value === o[idKey]}
            onClick={() => onChange(o[idKey])}
          >
            {o.emoji ? o.emoji + ' ' : ''}{o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Suggestion({ item, number, onFav, isFav, onRegen }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(item.text); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { /* بعض المتصفحات بتمنع النسخ من غير تفاعل مباشر */ }
  };
  return (
    <article className="sug">
      <div className="sug-top">
        <span className="theme">{number}️⃣ {item.theme}</span>
        <button className="icon" onClick={onFav} aria-pressed={isFav} title="مفضّلة">{isFav ? '★' : '☆'}</button>
      </div>
      <p className="sug-text">{item.text}</p>
      <div className="sug-actions">
        {/* الإرسال دايماً بإيد المستخدم: الرابط بيفتح واتساب بالرسالة جاهزة، وهو بيدوس Send. */}
        <a className="btn" href={whatsappLink(item.text)} target="_blank" rel="noopener noreferrer">📲 افتح في واتساب</a>
        <button className="ghost" onClick={copy}>{copied ? '✅ اتنسخت' : '📋 نسخ'}</button>
        <button className="ghost" onClick={onRegen}>🔄 غيّرها</button>
      </div>
    </article>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => store.get('wisal.theme', 'light'));
  const [relationId, setRelationId] = useState(() => store.get('wisal.relation', 'partner_wife'));
  const [intentId, setIntentId] = useState('general');
  const [dialect, setDialect] = useState(() => store.get('wisal.dialect', 'egyptian'));
  const [name, setName] = useState(() => store.get('wisal.name', ''));
  const [context, setContext] = useState('');
  const [slot, setSlot] = useState('manual');
  const [length, setLength] = useState('warm');
  const [emoji, setEmoji] = useState(true);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 100000));
  const [items, setItems] = useState([]);
  const [favs, setFavs] = useState(() => store.get('wisal.favs', []));
  const [occ, setOcc] = useState(() => store.get('wisal.occ', []));
  const [occLabel, setOccLabel] = useState('');
  const [occDate, setOccDate] = useState('');

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); store.set('wisal.theme', theme); }, [theme]);
  useEffect(() => { store.set('wisal.relation', relationId); }, [relationId]);
  useEffect(() => { store.set('wisal.dialect', dialect); }, [dialect]);
  useEffect(() => { store.set('wisal.name', name); }, [name]);
  useEffect(() => { store.set('wisal.favs', favs); }, [favs]);
  useEffect(() => { store.set('wisal.occ', occ); }, [occ]);

  const generate = (newSeed) => {
    const s = newSeed == null ? Math.floor(Math.random() * 100000) : newSeed;
    setSeed(s);
    setItems(compose({ relationId, intentId, dialect, name, context, slot, length, emoji, seed: s }, 2));
  };

  // أول تحميل: نولّد اقتراح فوراً عشان الصفحة ما تبانش فاضية.
  useEffect(() => { generate(); /* eslint-disable-next-line */ }, []);

  // Ctrl/⌘ + Enter = توليد، زي نسخة الديسكتوب.
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); generate(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const rel = relationById(relationId);
  const upcoming = useMemo(() => occ
    .map((o) => ({ ...o, d: daysUntil(o.date) }))
    .filter((o) => o.d != null)
    .sort((a, b) => a.d - b.d), [occ]);

  const toggleFav = (text) => setFavs((f) => (f.includes(text) ? f.filter((x) => x !== text) : [text, ...f].slice(0, 30)));

  return (
    <>
      <header className="top">
        <div className="wrap top-in">
          <div className="brand"><span className="logo" aria-hidden="true">💗</span> <b>وصال</b> <span className="tag">Studio</span></div>
          <div className="top-actions">
            <a className="ghost small" href="https://github.com/ahmadzayan-hub/Maktab-" target="_blank" rel="noopener noreferrer">الكود</a>
            <button className="ghost small" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="بدّل الثيم">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <h1>اكتب رسالة دافئة لأقرب ناس</h1>
          <p>
            اختار الشخص والنيّة واللهجة، وخد رسالة جاهزة تبعتها بإيدك.
            كل حاجة هنا بتشتغل <b>جوّه متصفحك</b> — من غير حساب، من غير مفتاح، ومن غير ما يطلع أي حرف للإنترنت.
          </p>
        </section>

        <div className="split">
          <section className="card" aria-label="المؤلّف">
            <Chips label="بتكتب لمين؟" options={RELATIONS} value={relationId} onChange={setRelationId} />
            <Chips label="نيّة الرسالة" options={INTENTS} value={intentId} onChange={setIntentId} />
            <Chips label="اللهجة" options={DIALECTS} value={dialect} onChange={setDialect} />

            <div className="grid2">
              <label className="field">
                <span className="lbl">اسمه أو دلعه (اختياري)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={rel.addr.replace('يا ', '')} />
              </label>
              <Chips
                label="لمسة الوقت"
                options={[{ id: 'manual', label: 'بدون' }, { id: 'morning', label: 'صباحي', emoji: '🌅' }, { id: 'evening', label: 'مسائي', emoji: '🌙' }]}
                value={slot} onChange={setSlot}
              />
            </div>

            <label className="field">
              <span className="lbl">حصل إيه؟ (اختياري — بيتحط في الرسالة زي ما هو)</span>
              <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} placeholder="مثلاً: نجحت في الامتحان" />
            </label>

            <div className="row">
              <Chips label="الطول" options={[{ id: 'short', label: 'قصيرة' }, { id: 'warm', label: 'دافية' }]} value={length} onChange={setLength} />
              <label className="check">
                <input type="checkbox" checked={emoji} onChange={(e) => setEmoji(e.target.checked)} /> إيموجي
              </label>
            </div>

            <button className="btn block" onClick={() => generate()}>✨ اكتبلي رسالة <kbd>Ctrl + Enter</kbd></button>
          </section>

          <section className="col" aria-label="الاقتراحات" aria-live="polite">
            {items.map((it, i) => (
              <Suggestion
                key={it.text}
                item={it}
                number={i + 1}
                isFav={favs.includes(it.text)}
                onFav={() => toggleFav(it.text)}
                onRegen={() => generate(seed + 101 + i)}
              />
            ))}

            {favs.length > 0 && (
              <details className="card soft">
                <summary><b>⭐ المفضّلة</b> <span className="muted">({favs.length})</span></summary>
                <ul className="favs">
                  {favs.map((t) => (
                    <li key={t}>
                      <span>{t}</span>
                      <button className="icon" onClick={() => toggleFav(t)} title="شيل من المفضّلة">✕</button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>

        <section className="card" aria-label="المناسبات">
          <h2>🎀 مناسبات جايّة</h2>
          <p className="muted">اكتب المناسبة وتاريخها (شهر-يوم) وهنحسبلك باقي كام يوم. متخزّنة على جهازك بس.</p>
          <div className="row">
            <input value={occLabel} onChange={(e) => setOccLabel(e.target.value)} placeholder="عيد جوازنا" aria-label="اسم المناسبة" />
            <input value={occDate} onChange={(e) => setOccDate(e.target.value)} placeholder="10-02" aria-label="التاريخ شهر-يوم" inputMode="numeric" />
            <button
              className="ghost"
              onClick={() => {
                if (!occLabel.trim() || daysUntil(occDate) == null) return;
                setOcc((o) => [...o, { label: occLabel.trim(), date: occDate.trim() }]);
                setOccLabel(''); setOccDate('');
              }}
            >➕ ضيف</button>
          </div>
          {upcoming.length === 0
            ? <p className="muted">لسه مفيش مناسبات.</p>
            : (
              <ul className="occs">
                {upcoming.map((o, i) => (
                  <li key={o.label + o.date + i}>
                    <span><b>{o.label}</b> · {o.d === 0 ? 'النهاردة' : o.d === 1 ? 'بكرة' : `بعد ${o.d} يوم`}</span>
                    <span className="row tight">
                      <button className="ghost small" onClick={() => { setContext(o.label); setIntentId('congrats'); generate(); }}>✍️ اكتب</button>
                      <button className="icon" onClick={() => setOcc((x) => x.filter((_, j) => j !== i))} title="حذف">✕</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="card soft" aria-label="التطبيقات">
          <h2>📥 عايزها على جهازك؟</h2>
          <p className="muted">
            نسخة الموبايل والديسكتوب فيهم تعلّم أسلوبك، إدارة أشخاص، وتذكيرات —
            والذكاء الاصطناعي اختياري بمفتاح بتجيبه إنت.
          </p>
          <div className="row">
            <a className="btn" href="https://github.com/ahmadzayan-hub/Maktab-/releases/download/android-latest/wisal.apk">🤖 أندرويد (APK)</a>
            <a className="ghost" href="https://github.com/ahmadzayan-hub/Maktab-/releases/download/windows-latest/Wisal-Setup.exe">🪟 ويندوز</a>
          </div>
        </section>

        <section className="card privacy" aria-label="الخصوصية">
          <h2>🔒 إيه اللي بيحصل لبياناتك هنا؟</h2>
          <ul>
            <li><b>مفيش سيرفر.</b> الرسائل بتتألّف بكود شغّال في متصفحك، مفيش أي طلب شبكة بيتبعت.</li>
            <li><b>مفيش ذكاء اصطناعي في الصفحة دي.</b> الصياغة من بنك جُمل محلي — عشان كده شغّالة من غير مفتاح ومن غير نت.</li>
            <li><b>اللي بتكتبه</b> (الاسم، المناسبات، المفضّلة) بيتخزّن في متصفحك بس، وبيتمسح لو مسحت بيانات الموقع.</li>
            <li><b>الإرسال بإيدك.</b> زرار واتساب بيفتح المحادثة والرسالة جاهزة — إنت اللي بتدوس Send.</li>
          </ul>
        </section>
      </main>

      <footer className="wrap foot">
        <p>وصال — مساحة خاصة لأقرب ناس. <a href="https://github.com/ahmadzayan-hub/Maktab-">المصدر على GitHub</a></p>
      </footer>
    </>
  );
}
