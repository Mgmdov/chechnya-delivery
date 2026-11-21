'use strict';
// ====== Настройки ======
const SUPABASE_URL = 'https://btcdcdpuerpjrkqemvif.supabase.co';
const SUPABASE_KEY = 'sb_publishable_eWqls3fiJTTGvCyuBCnONQ_kCVqCff7';
const DAY_PRICE = 100;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ====== Утилиты ======
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2 = (s) => esc(s).replace(/\n/g, '<br>');
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function fmt(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
function errText(e) {
  const m = (e && e.message) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Неверный номер или пароль';
  if (/already registered|already been registered/i.test(m)) return 'Этот номер уже зарегистрирован';
  if (/at least 6|Password should/i.test(m)) return 'Пароль должен быть не короче 6 символов';
  if (/Email not confirmed/i.test(m)) return 'Вход пока закрыт настройкой Supabase: отключите подтверждение почты (Auth → Sign In / Providers → Email → Confirm email).';
  if (/rate limit/i.test(m)) return 'Слишком много попыток, подождите немного';
  return m;
}
const I = {
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bag: '<path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  med: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M12 8.5v7M8.5 12h7"/>',
  box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  dots: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/>',
  stats: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
};
const ico = (n, size = 22, color = 'currentColor') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const MOUNTAINS = '<svg class="mt" viewBox="0 0 390 90" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,70 60,30 110,58 170,12 240,60 300,28 390,66 390,90 0,90" fill="rgba(255,255,255,0.16)"/><polygon points="0,82 80,50 140,72 220,40 290,74 350,52 390,70 390,90 0,90" fill="rgba(255,255,255,0.28)"/></svg>';
const STATUS = {
  new: ['Ищем курьера', 'warn'],
  accepted: ['Принят', ''],
  done: ['Доставлен', 'ok'],
  cancelled: ['Отменён', 'bad'],
};
const statusChip = (s) => `<span class="chip ${STATUS[s]?.[1] || ''}">${STATUS[s]?.[0] || esc(s)}</span>`;
const CATS = [['Продукты', 'bag'], ['Лекарства', 'med'], ['Посылка', 'box'], ['Другое', 'dots']];

// ====== Состояние ======
const S = {
  profile: null,
  settlements: [],
  tab: 'home',
  view: null,
  cat: 'Продукты',
  authMode: 'login',
  authRole: 'customer',
  ordersSeg: 'active',
  orders: [],
  cOrders: [],
  today: null,
  shiftToday: false,
  payToday: null,
  payInfo: '',
  adm: { payFilter: 'pending', payments: [], orders: [], people: [], stats: null },
};
const village = {
  get() {
    const v = Number(localStorage.getItem('village'));
    if (v && S.settlements.some((s) => s.id === v)) return v;
    const d = S.settlements.find((s) => s.name === 'Бено-Юрт') || S.settlements[0];
    return d ? d.id : null;
  },
  set(id) { localStorage.setItem('village', String(id)); },
};
const sName = (id) => S.settlements.find((s) => s.id === Number(id))?.name || '';
const villageOptions = (sel, onlyActive = true) =>
  S.settlements.filter((s) => !onlyActive || s.is_active || s.id === sel)
    .map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');

// ====== Вход / регистрация ======
function phoneToEmail(raw) {
  let d = String(raw).replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  if (d.length !== 11) return null;
  return d + '@dostavka-chr.app';
}
function renderAuth() {
  const signup = S.authMode === 'signup';
  $('#app').className = '';
  $('#app').innerHTML = `
  <div class="screen auth">
    <div class="sub strong" style="color:var(--accent)">Сельская доставка</div>
    <h1 class="title">${signup ? 'Регистрация' : 'Вход'}</h1>
    <div class="seg"><button data-act="authMode" data-m="login" class="${signup ? '' : 'on'}">Вход</button><button data-act="authMode" data-m="signup" class="${signup ? 'on' : ''}">Регистрация</button></div>
    <form id="authForm" class="card" autocomplete="on">
      ${signup ? `
      <div class="field"><label for="a-name">Имя</label><input id="a-name" autocomplete="name" required></div>
      <div class="field"><label>Я</label><div class="chips">
        <button type="button" data-act="authRole" data-r="customer" class="${S.authRole === 'customer' ? 'on' : ''}">Заказчик</button>
        <button type="button" data-act="authRole" data-r="courier" class="${S.authRole === 'courier' ? 'on' : ''}">Курьер</button></div></div>` : ''}
      <div class="field"><label for="a-phone">Номер телефона</label><input id="a-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" required></div>
      <div class="field"><label for="a-pass">Пароль</label><input id="a-pass" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="6" required></div>
      <button class="btn" type="submit">${signup ? 'Создать аккаунт' : 'Войти'}</button>
    </form>
    ${signup && S.authRole === 'courier' ? `<div class="info">${ico('info', 20, 'var(--accent)')}<div>Первые 7 календарных дней после регистрации работа бесплатная. Дальше ${DAY_PRICE} ₽ за каждый рабочий день.</div></div>` : ''}
  </div>`;
}
async function submitAuth(form) {
  const phone = $('#a-phone').value;
  const pass = $('#a-pass').value;
  const email = phoneToEmail(phone);
  if (!email) return toast('Введите номер телефона полностью');
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    if (S.authMode === 'signup') {
      const name = $('#a-name').value.trim();
      if (!name) throw new Error('Введите имя');
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { role: S.authRole, full_name: name, phone: phone.trim() } } });
      if (error) throw error;
      if (!data.session) {
        const r = await sb.auth.signInWithPassword({ email, password: pass });
        if (r.error) throw r.error;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    }
    await boot();
  } catch (e) {
    toast(errText(e));
  } finally {
    btn.disabled = false;
  }
}

// ====== Загрузка данных ======
async function loadSettlements() {
  const { data } = await sb.from('settlements').select('*').order('name');
  S.settlements = data || [];
}
async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  for (let i = 0; i < 5; i++) {
    const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}
async function loadPayInfo() {
  const { data } = await sb.from('app_settings').select('key,value').in('key', ['pay_info', 'pay_phone']);
  const m = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
  S.payInfo = m.pay_info || '';
  S.payPhone = m.pay_phone || '';
}
const BANKS = [
  ['Сбербанк', 'sberbankonline://'],
  ['Т-Банк', 'tinkoffbank://'],
  ['Альфа-Банк', 'alfabank://'],
  ['ВТБ', ''],
  ['Газпромбанк', ''],
  ['Райффайзен', ''],
  ['Открытие', ''],
  ['Россельхозбанк', ''],
  ['Почта Банк', ''],
  ['Другой банк', ''],
];
function fmtPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 11 ? `${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : p;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const i = document.createElement('input'); i.value = t; document.body.appendChild(i); i.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* нет */ }
    i.remove(); return ok;
  }
}
function payModal() {
  if (!S.payModal) return '';
  return `<div class="modal" data-act="closePay"><div class="box" role="dialog" aria-modal="true" aria-label="Оплата дня" onclick="event.stopPropagation()">
    <div class="row"><h2 class="h2">Оплата дня: ${DAY_PRICE} ₽</h2><button class="btn sm ghost" data-act="closePay" aria-label="Закрыть">✕</button></div>
    ${S.payPhone ? `<div class="card" style="background:var(--tint)"><div class="muted">Переведите по номеру телефона (СБП)</div><div class="code" style="font-size:24px;letter-spacing:1px">${esc(fmtPhone(S.payPhone))}</div><button class="btn sm" data-act="copyNum">Скопировать номер</button></div>` : '<div class="info">Номер для оплаты пока не указан. Спросите у администратора.</div>'}
    ${S.payInfo ? `<p class="muted">${nl2(S.payInfo)}</p>` : ''}
    <div class="strong" style="font-size:14px">Выберите свой банк</div>
    <div class="list">${BANKS.map(([n], i) => `<button data-act="bank" data-i="${i}"><span style="flex:1">${esc(n)}</span>${ico('chev', 16, '#A89A8A')}</button>`).join('')}</div>
    <p class="muted">Номер скопируется, откроется приложение банка. Переведите ${DAY_PRICE} ₽ и вернитесь сюда.</p>
    <button class="btn" data-act="paid">Я оплатил(а) ${DAY_PRICE} ₽</button></div></div>`;
}
async function loadCustomer() {
  const { data } = await sb.rpc('get_my_orders');
  S.orders = data || [];
}
async function loadCourier() {
  const t = await sb.rpc('server_today');
  S.today = t.data;
  const [{ data: sh }, { data: pay }, { data: co }, { data: p }] = await Promise.all([
    sb.from('shifts').select('id').eq('work_date', S.today).limit(1),
    sb.from('payments').select('id,work_date,amount,status,code_used_at').eq('work_date', S.today).maybeSingle(),
    sb.rpc('get_courier_orders'),
    sb.from('profiles').select('*').eq('id', S.profile.id).maybeSingle(),
  ]);
  S.shiftToday = !!(sh && sh.length);
  S.payToday = pay || null;
  S.cOrders = co || [];
  if (p) S.profile = p;
}
async function loadAdmin() {
  const a = S.adm;
  const t = await sb.rpc('server_today');
  S.today = t.data;
  if (S.tab === 'pay') {
    a.payments = (await sb.rpc('admin_payments', { p_status: a.payFilter })).data || [];
  } else if (S.tab === 'aorders') {
    a.orders = (await sb.from('orders').select('*, customer:profiles!orders_customer_id_fkey(full_name,phone), courier:profiles!orders_courier_id_fkey(full_name), settlement:settlements(name)').order('id', { ascending: false }).limit(100)).data || [];
  } else if (S.tab === 'people') {
    a.people = (await sb.from('profiles').select('*').neq('role', 'admin').order('created_at', { ascending: false }).limit(200)).data || [];
  } else if (S.tab === 'stats') {
    const cnt = async (q) => (await q).count || 0;
    a.stats = {
      newO: await cnt(sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'new')),
      accO: await cnt(sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'accepted')),
      doneO: await cnt(sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'done')),
      couriers: await cnt(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'courier')),
      working: await cnt(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_working', true)),
      customers: await cnt(sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer')),
      pending: await cnt(sb.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending')),
    };
  } else if (S.tab === 'settings') {
    await loadPayInfo();
  }
}
async function refresh() {
  if (!S.profile) return;
  const r = S.profile.role;
  try {
    if (r === 'customer') await loadCustomer();
    else if (r === 'courier') await loadCourier();
    else await loadAdmin();
  } catch (e) { /* сеть пропала: оставляем старые данные */ }
}

// ====== Каркас ======
function tabsFor(role) {
  if (role === 'customer') return [['home', 'Главная', 'home'], ['orders', 'Заказы', 'list'], ['profile', 'Профиль', 'user']];
  if (role === 'courier') return [['work', 'Заказы', 'box'], ['mine', 'Мои', 'check'], ['profile', 'Профиль', 'user']];
  return [['pay', 'Оплаты', 'card'], ['aorders', 'Заказы', 'list'], ['people', 'Люди', 'user'], ['villages', 'Сёла', 'pin'], ['stats', 'Итоги', 'stats'], ['settings', 'Настройки', 'info']];
}
function render() {
  const p = S.profile;
  if (!p) return renderAuth();
  if (p.is_blocked) {
    $('#app').className = '';
    $('#app').innerHTML = `<div class="screen auth"><h1 class="title">Аккаунт заблокирован</h1><p class="sub">Обратитесь к администратору.</p><button class="btn ghost" data-act="logout">Выйти</button></div>`;
    return;
  }
  $('#app').className = p.role === 'admin' ? 'wide' : '';
  let body = '';
  if (p.role === 'customer') body = S.view === 'new' ? vNewOrder() : ({ home: vHome, orders: vOrders, profile: vProfile }[S.tab] || vHome)();
  else if (p.role === 'courier') body = ({ work: vWork, mine: vMine, profile: vProfile }[S.tab] || vWork)();
  else body = ({ pay: vAPay, aorders: vAOrders, people: vAPeople, villages: vAVillages, stats: vAStats, settings: vASettings }[S.tab] || vAPay)();
  const tabs = S.view === 'new' ? '' : `<nav class="tabs" aria-label="Разделы">${tabsFor(p.role).map(([k, l, i]) => `<button data-act="tab" data-t="${k}" class="${S.tab === k ? 'on' : ''}" ${S.tab === k ? 'aria-current="page"' : ''}>${ico(i, 26)}<span>${l}</span></button>`).join('')}</nav>`;
  $('#app').innerHTML = body + (p.role === 'courier' ? payModal() : '');
  let nav = document.getElementById('nav');
  if (!nav) { nav = document.createElement('div'); nav.id = 'nav'; document.body.insertBefore(nav, $('#toast')); }
  nav.innerHTML = tabs;
}

// ====== Заказчик ======
function villagePill(attrAct) {
  const id = village.get();
  return `<label class="pill" aria-label="Выбрать село">${ico('pin', 18, '#fff')}<select data-change="${attrAct}">${villageOptions(id)}</select></label>`;
}
function orderCard(o, mode) {
  return `<div class="card">
    <div class="row"><div class="strong" style="font-size:17px">${esc(o.details.split(':')[0])}</div>${statusChip(o.status)}</div>
    <div class="muted">${nl2(o.details.includes(':') ? o.details.slice(o.details.indexOf(':') + 1).trim() : o.details)}</div>
    <div class="row" style="justify-content:flex-start;gap:8px;font-size:14px">${ico('pin', 18, 'var(--muted)')}<span>${esc(o.settlement_name)}, ${esc(o.address)}</span></div>
    ${mode === 'customer' && o.status === 'accepted' ? `<div class="strong" style="font-size:14px;border-top:1px solid var(--line);padding-top:12px">Заказ принят, ожидайте курьера · ${esc(o.courier_name || '')}</div>` : ''}
    ${mode === 'customer' && o.status === 'new' ? `<button class="btn sm danger" data-act="cancel" data-id="${o.id}">Отменить заказ</button>` : ''}
    <div class="muted" style="font-size:12px">${fmt(o.created_at)}</div>
  </div>`;
}
function vHome() {
  const cur = S.orders.find((o) => o.status === 'new' || o.status === 'accepted');
  return `<div class="screen">
    <div class="hero">${MOUNTAINS}${villagePill('village')}<h1 class="title">Что привезти?</h1><p style="font-size:15px">Доставка по селам Чечни</p></div>
    <div class="sheet">
      <button class="btn" data-act="newOrder" data-c="Продукты">${ico('plus', 22, '#fff')}Создать заказ</button>
      <div><div class="sub strong" style="margin:0 4px 8px">Быстрый заказ</div>
        <div class="list">${CATS.map(([n, i]) => `<button data-act="newOrder" data-c="${n}"><span class="ico">${ico(i, 20, 'var(--accent)')}</span><span style="flex:1">${n}</span>${ico('chev', 16, '#A89A8A')}</button>`).join('')}</div></div>
      ${cur ? `<div><div class="row" style="margin-bottom:8px"><h2 class="h2">Текущий заказ</h2></div><div class="dark"><div class="ico" style="background:var(--accent);border-radius:20px;width:40px;height:40px">${ico('check', 22, '#fff')}</div><div><div class="strong">${cur.status === 'accepted' ? 'Заказ принят, ожидайте курьера' : 'Ищем курьера'}</div><div class="muted">${cur.status === 'accepted' ? 'Курьер: ' + esc(cur.courier_name || '') : esc(cur.settlement_name) + ', ' + esc(cur.address)}</div></div></div></div>` : ''}
    </div></div>`;
}
function vNewOrder() {
  return `<div class="screen" style="padding-bottom:40px">
    <button class="btn sm ghost" data-act="back" style="align-self:flex-start;border:0;color:var(--accent);padding:0">${ico('back', 22, 'var(--accent)')} Назад</button>
    <h1 class="title">Новый заказ</h1>
    <div class="chips" role="group" aria-label="Категория">${CATS.map(([n]) => `<button data-act="cat" data-c="${n}" class="${S.cat === n ? 'on' : ''}">${n}</button>`).join('')}</div>
    <form id="orderForm" style="display:flex;flex-direction:column;gap:14px">
      <div class="field"><label for="o-s">Село</label><select id="o-s">${villageOptions(village.get())}</select></div>
      <div class="field"><label for="o-a">Улица и дом</label><input id="o-a" placeholder="Например, ул. Центральная, 12" required></div>
      <div class="field"><label for="o-l">Ориентир</label><input id="o-l" placeholder="Рядом с мечетью, синие ворота"></div>
      <div class="field"><label for="o-t">Что привезти</label><textarea id="o-t" placeholder="Опишите заказ" required></textarea></div>
      <div class="info">${ico('info', 20, 'var(--accent)')}<div>Оплата курьеру напрямую: наличными или переводом. Комиссии нет.</div></div>
      <button class="btn" type="submit">Отправить заказ</button>
    </form></div>`;
}
function vOrders() {
  const act = S.orders.filter((o) => o.status === 'new' || o.status === 'accepted');
  const hist = S.orders.filter((o) => o.status === 'done' || o.status === 'cancelled');
  const list = S.ordersSeg === 'active' ? act : hist;
  return `<div class="screen"><h1 class="title">Мои заказы</h1>
    <div class="seg"><button data-act="seg" data-s="active" class="${S.ordersSeg === 'active' ? 'on' : ''}">Активные</button><button data-act="seg" data-s="hist" class="${S.ordersSeg === 'hist' ? 'on' : ''}">История</button></div>
    ${list.length ? list.map((o) => orderCard(o, 'customer')).join('') : '<div class="empty">Здесь пока пусто</div>'}</div>`;
}
function vProfile() {
  const p = S.profile;
  const c = p.role === 'courier';
  const left = c && S.today && p.free_until >= S.today ? Math.floor((new Date(p.free_until) - new Date(S.today)) / 864e5) + 1 : 0;
  return `<div class="screen"><h1 class="title">Профиль</h1>
    <div class="card"><div class="row"><span class="muted">Имя</span><span class="strong">${esc(p.full_name)}</span></div>
    <div class="row"><span class="muted">Телефон</span><span class="strong">${esc(p.phone || '')}</span></div>
    <div class="row"><span class="muted">Роль</span><span class="strong">${c ? 'Курьер' : 'Заказчик'}</span></div>
    ${c ? `<div class="row"><span class="muted">Бесплатный период</span><span class="strong">${left > 0 ? 'осталось дней: ' + left : 'закончился'}</span></div>` : ''}</div>
    <button class="btn ghost" data-act="logout">Выйти</button></div>`;
}

// ====== Курьер ======
function freeLeft() {
  const p = S.profile;
  if (!S.today || !p.free_until || p.free_until < S.today) return 0;
  return Math.floor((new Date(p.free_until) - new Date(S.today)) / 864e5) + 1;
}
function payBlock() {
  const pay = S.payToday;
  if (!pay) return `<div class="card"><div class="strong">Оплата дня: ${DAY_PRICE} ₽</div><p class="muted">Первые 7 дней были бесплатными. Теперь работа на линии стоит ${DAY_PRICE} ₽ в день.</p><button class="btn" data-act="openPay">Оплатить ${DAY_PRICE} ₽</button></div>`;
  if (pay.status === 'pending') return `<div class="card"><div class="row"><div class="strong">Оплата дня: ${DAY_PRICE} ₽</div><span class="chip warn">Ждём подтверждения</span></div><p class="muted">Администратор проверит перевод и подтвердит. Потом здесь появится код.</p><button class="btn sm ghost" data-act="reload">Проверить</button></div>`;
  if (pay.status === 'confirmed' && !pay.code_used_at) return `<div class="card"><div class="row"><div class="strong">Оплата подтверждена</div><span class="chip ok">Готово</span></div><p class="muted">Администратор назовёт вам код по телефону. Введите его выше и нажмите «Работать».</p></div>`;
  return '';
}
function startCard() {
  const p = S.profile;
  const sel = p.work_settlement_id || village.get();
  const left = freeLeft();
  const free = left > 0;
  const needPay = !S.shiftToday && !free;
  const confirmed = !!(S.payToday && S.payToday.status === 'confirmed' && !S.payToday.code_used_at);
  const ready = S.shiftToday || free || confirmed;
  return `<div class="card"><div class="field"><label for="w-s">Село, в котором работаете</label><select id="w-s">${villageOptions(sel)}</select></div>
    ${S.shiftToday ? '<div class="info">Сегодняшний день уже оплачен или бесплатный.</div>' : free ? `<div class="info">${ico('info', 20, 'var(--accent)')}<div>Бесплатный период: осталось дней ${left}.</div></div>` : ''}
    ${needPay && confirmed ? '<div class="field"><label for="w-code">Код от администратора</label><input id="w-code" autocomplete="off" autocapitalize="characters" placeholder="Например, 7K4M9QXA"></div>' : ''}
    <button class="btn" data-act="startWork" ${ready ? '' : 'disabled'}>Работать</button></div>${needPay ? payBlock() : ''}`;
}
function vWork() {
  const p = S.profile;
  const open = S.cOrders.filter((o) => o.status === 'new');
  if (!p.is_working) {
    return `<div class="screen"><div class="hero">${MOUNTAINS}<h1 class="title">Вы не на линии</h1><p style="font-size:15px">Выберите село и нажмите «Работать»</p></div><div class="sheet">${startCard()}</div></div>`;
  }
  return `<div class="screen"><div class="hero" style="min-height:170px">${MOUNTAINS}
    <label class="pill" aria-label="Сменить село">${ico('pin', 18, '#fff')}<select data-change="workVillage">${villageOptions(p.work_settlement_id)}</select></label>
    <h1 class="title">Вы на линии</h1></div>
    <div class="sheet">
      <div class="row"><h2 class="h2">Заказы в селе: ${esc(sName(p.work_settlement_id))}</h2><button class="btn sm ghost" data-act="stopWork">Уйти с линии</button></div>
      ${open.length ? open.map((o) => `<div class="card">
        <div class="row"><div class="strong" style="font-size:17px">${esc(o.details.split(':')[0])}</div><span class="muted" style="font-size:13px">${fmt(o.created_at)}</span></div>
        <div class="muted">${nl2(o.details.includes(':') ? o.details.slice(o.details.indexOf(':') + 1).trim() : o.details)}</div>
        <div class="row" style="justify-content:flex-start;gap:8px;font-size:14px">${ico('pin', 18, 'var(--muted)')}<span>${esc(o.address)}</span></div>
        <button class="btn" style="height:48px;border-radius:14px;font-size:16px" data-act="accept" data-id="${o.id}">Принять заказ</button></div>`).join('') : '<div class="empty">Новых заказов пока нет. Список обновляется сам.</div>'}
    </div></div>`;
}
function vMine() {
  const mine = S.cOrders.filter((o) => o.status !== 'new');
  return `<div class="screen"><h1 class="title">Мои заказы</h1>
    ${mine.length ? mine.map((o) => `<div class="card">
      <div class="row"><div class="strong" style="font-size:17px">${esc(o.details.split(':')[0])}</div>${statusChip(o.status)}</div>
      <div class="muted">${nl2(o.details.includes(':') ? o.details.slice(o.details.indexOf(':') + 1).trim() : o.details)}</div>
      <div class="row" style="justify-content:flex-start;gap:8px;font-size:14px">${ico('pin', 18, 'var(--muted)')}<span>${esc(o.settlement_name)}, ${esc(o.address)}</span></div>
      <div class="row wrap"><span class="strong">${esc(o.customer_name || '')}</span>${o.customer_phone ? `<a href="tel:${esc(o.customer_phone.replace(/[^\d+]/g, ''))}" style="color:var(--accent);font-weight:600">${esc(o.customer_phone)}</a>` : ''}</div>
      ${o.status === 'accepted' ? `<button class="btn sm ok" data-act="done" data-id="${o.id}">Доставлено</button>` : ''}</div>`).join('') : '<div class="empty">Вы ещё не приняли ни одного заказа</div>'}</div>`;
}

// ====== Админ ======
const adminHead = (t, extra = '') => `<div class="row wrap" style="align-items:flex-end"><div><h1 class="title">${t}</h1></div>${extra}</div>`;
function vAPay() {
  const a = S.adm;
  const rows = a.payments.map((p) => `<tr><td class="strong">${esc(p.courier_name || '')}<div class="muted" style="font-size:12px">${esc(p.courier_phone || '')}</div></td><td>${fmtDate(p.work_date)}</td><td>${p.amount} ₽</td>
    <td>${p.status === 'pending' ? '<span class="chip warn">Ждёт подтверждения</span>' : `<span class="chip ok">Подтверждено</span>${p.code_used_at ? ' <span class="chip">код использован</span>' : ''}`}</td>
    <td>${p.status === 'pending' ? `<button class="btn sm" data-act="confirmPay" data-id="${p.id}">Подтвердить</button>` : `<span class="strong" style="letter-spacing:2px;font-size:20px;color:var(--accent)">${esc(p.code || '')}</span>${p.code_used_at ? '' : '<div class="muted" style="font-size:12px">Назовите курьеру</div>'}`}</td></tr>`).join('');
  return `<div class="screen">${adminHead('Оплаты курьеров')}
    <p class="sub">Подтвердите оплату, и курьер получит одноразовый код на этот день.</p>
    <div class="chips">${[['pending', 'Ждут подтверждения'], ['confirmed', 'Подтверждены'], ['all', 'Все']].map(([k, l]) => `<button data-act="payFilter" data-f="${k}" class="${a.payFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="scroll"><table class="table"><thead><tr><th>Курьер</th><th>День</th><th>Сумма</th><th>Статус</th><th>Действие</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Нет записей</td></tr>'}</tbody></table></div></div>`;
}
function vAOrders() {
  const rows = S.adm.orders.map((o) => `<tr><td>#${o.id}</td><td>${statusChip(o.status)}</td><td>${esc(o.settlement?.name || '')}<div class="muted" style="font-size:12px">${esc(o.address)}</div></td><td>${nl2(o.details)}</td><td>${esc(o.customer?.full_name || '')}<div class="muted" style="font-size:12px">${esc(o.customer?.phone || '')}</div></td><td>${esc(o.courier?.full_name || '—')}</td><td>${fmt(o.created_at)}</td></tr>`).join('');
  return `<div class="screen">${adminHead('Заказы')}<div class="scroll"><table class="table"><thead><tr><th>№</th><th>Статус</th><th>Адрес</th><th>Заказ</th><th>Заказчик</th><th>Курьер</th><th>Создан</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Заказов пока нет</td></tr>'}</tbody></table></div></div>`;
}
function vAPeople() {
  const rows = S.adm.people.map((u) => `<tr><td class="strong">${esc(u.full_name)}<div class="muted" style="font-size:12px">${esc(u.phone || '')}</div></td>
    <td>${u.role === 'courier' ? 'Курьер' : 'Заказчик'}${u.role === 'courier' && u.is_working ? ' <span class="chip ok">на линии</span>' : ''}</td>
    <td>${u.role === 'courier' ? (u.free_until >= S.today ? 'бесплатно до ' + fmtDate(u.free_until) : 'платный') : ''}</td>
    <td>${u.is_blocked ? '<span class="chip bad">заблокирован</span>' : ''}</td>
    <td><div class="row" style="justify-content:flex-start;gap:6px;flex-wrap:wrap"><button class="btn sm ghost" data-act="block" data-id="${u.id}" data-v="${u.is_blocked ? 0 : 1}">${u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button>${u.role === 'courier' ? `<button class="btn sm ghost" data-act="free7" data-id="${u.id}" data-d="${u.free_until || ''}">+7 дней бесплатно</button><button class="btn sm ghost" data-act="freeEnd" data-id="${u.id}">Убрать бесплатные дни</button>` : ''}<button class="btn sm ghost" data-act="makeAdmin" data-id="${u.id}" data-n="${esc(u.full_name)}">Сделать админом</button></div></td></tr>`).join('');
  return `<div class="screen">${adminHead('Люди')}<div class="scroll"><table class="table"><thead><tr><th>Имя</th><th>Роль</th><th>Период</th><th></th><th>Действия</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Пока никого</td></tr>'}</tbody></table></div></div>`;
}
function vAVillages() {
  return `<div class="screen">${adminHead('Сёла')}
    <form id="villageForm" class="card"><div class="field"><label for="v-n">Новое село</label><input id="v-n" required></div><button class="btn sm" type="submit">Добавить</button></form>
    <div class="list">${S.settlements.map((s) => `<button data-act="toggleVillage" data-id="${s.id}" data-v="${s.is_active ? 0 : 1}"><span style="flex:1">${esc(s.name)}</span><span class="chip ${s.is_active ? 'ok' : 'bad'}">${s.is_active ? 'доступно' : 'скрыто'}</span></button>`).join('')}</div></div>`;
}
function vAStats() {
  const s = S.adm.stats;
  if (!s) return '<div class="screen"><div class="empty">Загрузка…</div></div>';
  const t = [['Новых заказов', s.newO], ['В работе', s.accO], ['Доставлено', s.doneO], ['Курьеров', s.couriers], ['На линии сейчас', s.working], ['Заказчиков', s.customers], ['Оплат ждут подтверждения', s.pending]];
  return `<div class="screen">${adminHead('Итоги')}<div class="card">${t.map(([l, v]) => `<div class="row"><span class="muted">${l}</span><span class="strong" style="font-size:20px">${v}</span></div>`).join('')}</div></div>`;
}
function vASettings() {
  return `<div class="screen">${adminHead('Настройки')}
    <form id="settingsForm" class="card"><div class="field"><label for="s-phone">Номер телефона для оплаты (СБП)</label><input id="s-phone" type="tel" value="${esc(S.payPhone)}"></div>
    <div class="field"><label for="s-pay">Подпись для курьеров (необязательно)</label><textarea id="s-pay" placeholder="Например: получатель, имя">${esc(S.payInfo)}</textarea></div>
    <p class="muted">Это увидят курьеры на экране оплаты.</p><button class="btn sm" type="submit">Сохранить</button></form>
    <button class="btn ghost" data-act="logout">Выйти</button></div>`;
}

// ====== Действия ======
const acts = {
  async authMode(d) { S.authMode = d.m; renderAuth(); },
  async authRole(d) { S.authRole = d.r; const n = $('#a-name')?.value, ph = $('#a-phone')?.value; renderAuth(); if ($('#a-name')) $('#a-name').value = n || ''; $('#a-phone').value = ph || ''; },
  async tab(d) { S.tab = d.t; S.view = null; render(); await refresh(); render(); },
  async logout() { await sb.auth.signOut(); S.profile = null; S.tab = 'home'; S.view = null; const n = document.getElementById('nav'); if (n) n.innerHTML = ''; render(); },
  async newOrder(d) { S.cat = d.c; S.view = 'new'; render(); window.scrollTo(0, 0); },
  async back() { S.view = null; render(); },
  async cat(d) { S.cat = d.c; const v = ['o-s', 'o-a', 'o-l', 'o-t'].map((i) => $('#' + i)?.value); render(); ['o-s', 'o-a', 'o-l', 'o-t'].forEach((i, k) => { if ($('#' + i) && v[k] != null) $('#' + i).value = v[k]; }); },
  async seg(d) { S.ordersSeg = d.s; render(); },
  async cancel(d) {
    if (!confirm('Отменить заказ?')) return;
    const { data, error } = await sb.rpc('cancel_order', { p_order: Number(d.id) });
    if (error) return toast(errText(error));
    toast(data ? 'Заказ отменён' : 'Заказ уже принял курьер, отменить нельзя');
    await refresh(); render();
  },
  async reload() { await refresh(); render(); },
  async openPay() { S.payModal = true; render(); },
  async closePay() { S.payModal = false; render(); },
  async copyNum() { toast((await copyText(S.payPhone)) ? 'Номер скопирован' : 'Не удалось скопировать, введите номер вручную'); },
  async bank(d) {
    const [name, scheme] = BANKS[Number(d.i)];
    const ok = await copyText(S.payPhone);
    toast(ok ? `Номер скопирован. Откройте ${name} и переведите по номеру телефона` : 'Введите номер вручную в приложении банка');
    if (scheme) setTimeout(() => { window.location.href = scheme; }, 500);
  },
  async paid() {
    const { error } = await sb.rpc('request_payment');
    if (error) return toast(errText(error));
    S.payModal = false;
    toast('Отправлено администратору');
    await refresh(); render();
  },
  async startWork() {
    const sel = Number($('#w-s').value);
    const code = ($('#w-code')?.value || '').trim() || null;
    const { error } = await sb.rpc('start_work', { p_settlement: sel, p_code: code });
    if (error) return toast(errText(error));
    village.set(sel);
    await refresh(); render();
  },
  async stopWork() { const { error } = await sb.rpc('stop_work'); if (error) return toast(errText(error)); await refresh(); render(); },
  async accept(d) {
    const { data, error } = await sb.rpc('accept_order', { p_order: Number(d.id) });
    if (error) return toast(errText(error));
    toast(data ? 'Заказ ваш! Он во вкладке «Мои»' : 'Этот заказ уже принял другой курьер');
    await refresh(); render();
  },
  async done(d) {
    const { error } = await sb.rpc('complete_order', { p_order: Number(d.id) });
    if (error) return toast(errText(error));
    await refresh(); render();
  },
  async payFilter(d) { S.adm.payFilter = d.f; await refresh(); render(); },
  async confirmPay(d) {
    const { data, error } = await sb.rpc('confirm_payment', { p_id: Number(d.id) });
    if (error) return toast(errText(error));
    S.adm.payFilter = 'confirmed';
    toast('Код: ' + data + '. Назовите его курьеру');
    await refresh(); render();
  },
  async block(d) {
    const { error } = await sb.from('profiles').update({ is_blocked: d.v === '1', ...(d.v === '1' ? { is_working: false } : {}) }).eq('id', d.id);
    if (error) return toast(errText(error));
    await refresh(); render();
  },
  async free7(d) {
    const base = d.d && d.d > S.today ? d.d : S.today;
    const nd = new Date(base + 'T00:00:00'); nd.setDate(nd.getDate() + 7);
    const val = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0') + '-' + String(nd.getDate()).padStart(2, '0');
    const { error } = await sb.from('profiles').update({ free_until: val }).eq('id', d.id);
    if (error) return toast(errText(error));
    toast('Бесплатно до ' + fmtDate(val));
    await refresh(); render();
  },
  async freeEnd(d) {
    const y = new Date(S.today + 'T00:00:00'); y.setDate(y.getDate() - 1);
    const val = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    const { error } = await sb.from('profiles').update({ free_until: val }).eq('id', d.id);
    if (error) return toast(errText(error));
    toast('Бесплатный период снят');
    await refresh(); render();
  },
  async makeAdmin(d) {
    if (!confirm('Сделать администратором: ' + d.n + '? Он увидит оплаты, коды и всех людей.')) return;
    const { error } = await sb.from('profiles').update({ role: 'admin', is_working: false }).eq('id', d.id);
    if (error) return toast(errText(error));
    toast('Теперь администратор: ' + d.n);
    await refresh(); render();
  },
  async toggleVillage(d) {
    const { error } = await sb.from('settlements').update({ is_active: d.v === '1' }).eq('id', Number(d.id));
    if (error) return toast(errText(error));
    await loadSettlements(); render();
  },
};
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t || !acts[t.dataset.act]) return;
  acts[t.dataset.act](t.dataset, t);
});
document.addEventListener('change', async (e) => {
  const k = e.target.dataset && e.target.dataset.change;
  if (!k) return;
  const id = Number(e.target.value);
  if (k === 'village') { village.set(id); render(); }
  if (k === 'workVillage') {
    const { error } = await sb.rpc('start_work', { p_settlement: id, p_code: null });
    if (error) toast(errText(error));
    await refresh(); render();
  }
});
document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'authForm') return submitAuth(f);
  const btn = f.querySelector('button[type=submit]');
  if (btn) btn.disabled = true;
  try {
    if (f.id === 'orderForm') {
      const street = $('#o-a').value.trim(), land = $('#o-l').value.trim(), text = $('#o-t').value.trim();
      if (!street || !text) return toast('Заполните адрес и что привезти');
      const sid = Number($('#o-s').value);
      const { error } = await sb.from('orders').insert({ customer_id: S.profile.id, settlement_id: sid, address: street + (land ? ' (' + land + ')' : ''), details: S.cat + ': ' + text });
      if (error) throw error;
      village.set(sid);
      S.view = null; S.tab = 'home';
      await refresh(); render();
      toast('Заказ отправлен');
    } else if (f.id === 'villageForm') {
      const name = $('#v-n').value.trim();
      if (!name) return;
      const { error } = await sb.from('settlements').insert({ name });
      if (error) throw error;
      await loadSettlements(); render(); toast('Село добавлено');
    } else if (f.id === 'settingsForm') {
      const { error } = await sb.from('app_settings').upsert([{ key: 'pay_info', value: $('#s-pay').value.trim() }, { key: 'pay_phone', value: $('#s-phone').value.trim() }]);
      if (error) throw error;
      S.payInfo = $('#s-pay').value.trim(); S.payPhone = $('#s-phone').value.trim(); toast('Сохранено');
    }
  } catch (err) {
    toast(/duplicate key/i.test(err.message) ? 'Такое село уже есть' : errText(err));
  } finally {
    if (btn) btn.disabled = false;
  }
});

// ====== Запуск ======
async function boot() {
  await loadSettlements();
  S.profile = await loadProfile();
  if (S.profile) {
    S.tab = S.profile.role === 'courier' ? 'work' : S.profile.role === 'admin' ? 'pay' : 'home';
    if (S.profile.role !== 'admin') await loadPayInfo();
    await refresh();
  }
  render();
}
setInterval(async () => {
  if (!S.profile || document.hidden) return;
  const a = document.activeElement;
  if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) return;
  if (S.view === 'new') return;
  if ($('#w-code')?.value) return;
  await refresh();
  render();
}, 10000);
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) await boot();
  else { await loadSettlements(); render(); }
})();
