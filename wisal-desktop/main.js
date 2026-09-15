'use strict';
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const core = require('./lib/core');

// حالة النافذة (مقاس/مكان/مكبّرة) بتتحفظ بين التشغيلات — توقّع أساسي في أي
// تطبيق ديسكتوب: بتفتح تاني زي ما سبتها، مش بمقاس افتراضي كل مرة.
function windowStateFile() { return path.join(app.getPath('userData'), 'window-state.json'); }
function readWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    if (typeof s.width === 'number' && typeof s.height === 'number') return s;
  } catch (e) { /* أول تشغيل أو ملف تالف — الافتراضي تحت */ }
  return null;
}
function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds(); // getNormalBounds: مقاس ما قبل التكبير
    fs.writeFileSync(windowStateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }, null, 2));
  } catch (e) { /* التخزين مش حرج — ما نوقّفش الإغلاق عشانه */ }
}
// النافذة لازم تفضل داخل شاشة موجودة فعلًا: لو المستخدم فصل شاشة تانية،
// الإحداثيات المحفوظة ممكن تبقى بره أي شاشة والنافذة تختفي.
function isOnSomeDisplay(b) {
  const { screen } = require('electron');
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y;
  });
}

function createWindow() {
  const saved = readWindowState();
  const dark = (() => { try { return core.getSettings().theme === 'dark'; } catch (e) { return false; } })();
  const opts = {
    width: (saved && saved.width) || 1280,
    height: (saved && saved.height) || 820,
    minWidth: 860,
    minHeight: 600,
    // خلفية ما قبل الرسم بلون الثيم المحفوظ — من غير كده بتلمع أبيض قبل ما
    // الواجهة الغامقة تترسم.
    backgroundColor: dark ? '#061827' : '#F8F5EF',
    title: 'وصال — Wisal',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false, // نعرضها بعد ready-to-show عشان ما تظهرش فاضية
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };
  if (saved && typeof saved.x === 'number' && isOnSomeDisplay(saved)) { opts.x = saved.x; opts.y = saved.y; }

  const win = new BrowserWindow(opts);
  win.once('ready-to-show', () => { if (saved && saved.maximized) win.maximize(); win.show(); });
  ['resize', 'move', 'close'].forEach((ev) => win.on(ev, () => saveWindowState(win)));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

// قائمة التطبيق: أدوار Electron الجاهزة بتدّي اختصارات ويندوز المتوقّعة
// (نسخ/لصق/تراجع في الحقول، تكبير/تصغير الخط، ملء الشاشة). مخفية افتراضيًا
// (autoHideMenuBar) وبتظهر بـ Alt — الاختصارات شغالة سواء ظهرت أو لأ.
function buildMenu() {
  const { Menu } = require('electron');
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ملف', submenu: [{ role: 'quit', label: 'خروج' }] },
    {
      label: 'تحرير',
      submenu: [
        { role: 'undo', label: 'تراجع' }, { role: 'redo', label: 'إعادة' }, { type: 'separator' },
        { role: 'cut', label: 'قص' }, { role: 'copy', label: 'نسخ' }, { role: 'paste', label: 'لصق' },
        { role: 'selectAll', label: 'تحديد الكل' },
      ],
    },
    {
      label: 'عرض',
      submenu: [
        // مهم على لابتوبات الشاشات الصغيرة/الدقّة العالية.
        { role: 'resetZoom', label: 'حجم عادي' }, { role: 'zoomIn', label: 'تكبير' }, { role: 'zoomOut', label: 'تصغير' },
        { type: 'separator' }, { role: 'togglefullscreen', label: 'ملء الشاشة' },
        { type: 'separator' }, { role: 'reload', label: 'إعادة تحميل' },
      ],
    },
  ]));
}

app.whenReady().then(() => {
  core.init(app.getPath('userData'));
  buildMenu();
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function registerIpc() {
  const handlers = {
    'settings:get': () => core.getSettings(),
    'settings:set': (patch) => core.setSettings(patch),
    'people:get': () => core.getPeople(),
    'people:set': (list) => core.setPeople(list),
    'meta:get': () => ({ relations: core.RELATIONS, dialects: core.DIALECTS, intents: core.INTENTS, groupKinds: core.GROUP_KINDS }),
    'stats:get': () => core.stats(),
    // المجموعات + الاستيراد + التحليل + التوليد الجماعي
    'groups:get': () => core.getGroups(),
    'groups:set': (list) => core.setGroups(list),
    'persona:analyze': ({ info, url }) => core.analyzePersona(info, url),
    'group:one': ({ member, intentId, context }) => core.generateOneFor(member, { intentId, context }),
    'csv:pick': async () => {
      const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'جهات اتصال', extensions: ['csv', 'txt'] }] });
      if (r.canceled || !r.filePaths[0]) return null;
      return core.parseContactsCSV(fs.readFileSync(r.filePaths[0], 'utf8'));
    },
    'export:save': async ({ filename, content }) => {
      const r = await dialog.showSaveDialog({ defaultPath: filename || 'wisal-messages.txt' });
      if (r.canceled || !r.filePath) return false;
      fs.writeFileSync(r.filePath, String(content == null ? '' : content), 'utf8');
      return true;
    },
    'store:get': () => core.getStore(),
    'recipient:current': () => core.currentRecipient(),
    'generate': (opts) => core.generate(opts || {}),
    'refine': ({ text, styleId }) => core.refine(text, styleId),
    'giftIdeas': ({ occasionLabel }) => core.giftIdeas(occasionLabel),
    'favorite:toggle': ({ text }) => core.toggleFavorite(text),
    'history:delete': ({ date, text }) => { core.deleteHistory(date, text); return true; },
    'openExternal': ({ url }) => { shell.openExternal(url); return true; },
    // التعلّم عند اختيار/تعديل اقتراح
    'learn:choose': ({ text, theme, recipientId, slot, themesShown }) => {
      core.addStyleExample(text, theme, recipientId);
      core.bumpTheme(theme, 0.3);
      core.addFeedback({ date: core.todayISO(), slot: slot || 'manual', themesShown: themesShown || [], choice: 'pick', finalText: text, recipientId: recipientId || '' });
      core.markContacted(recipientId);
      return true;
    },
    'learn:edit': ({ text, theme, recipientId, slot, themesShown }) => {
      core.addStyleExample(text, theme, recipientId);
      core.addFeedback({ date: core.todayISO(), slot: slot || 'manual', themesShown: themesShown || [], choice: 'edited', finalText: text, recipientId: recipientId || '' });
      core.markContacted(recipientId);
      return true;
    },
  };
  Object.keys(handlers).forEach((ch) => {
    ipcMain.handle(ch, async (_e, payload) => {
      try { return { ok: true, data: await handlers[ch](payload) }; }
      catch (err) { return { ok: false, error: String(err && err.message ? err.message : err) }; }
    });
  });
}
