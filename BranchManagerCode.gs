/**
 * ═══════════════════════════════════════════════════════════════
 * BranchManagerCode.gs — ZingoVingo Branch Command Center V2
 * جایگزین کامل فایل قبلی.
 * ═══════════════════════════════════════════════════════════════
 * وابسته به: SchemaCore.gs ، Code.gs
 * اختیاری: Job_Application_Form.gs (کارجویان) ، ProfileCode.gs (عکس)
 *
 * تغییرات V2:
 *  • bnmCCBootstrap : بارگذاری یکجای همه داده‌های «فقط این شعبه»
 *  • موتور گفتگوی رشته‌ای سه‌کاناله (مشتری / سازمانی / پشتیبانی سامانه)
 *  • CRUD یکپارچه + حذف با بازگردانی + تغییر وضعیت گروهی
 *  • تسک‌ها، اعضای گروه، تاریخچه کارت، کارجویان شعبه، استخدام کارجو
 *  • بخش «در حال توسعه» با ثبت واقعی درخواست توسعه برای مدیر سامانه
 *  • نمای ذخیره‌شده، خروجی CSV، سلامت سامانه، اعلان‌ها
 *  • همه نام‌های تابع نسخه قبل حفظ شده‌اند (سازگاری کامل)
 * ═══════════════════════════════════════════════════════════════
 */

const BNM_VERSION = 'V2';
const BNM_TRASH = '__ZV_BNM_TRASH__';
const BNM_SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const BNM_CARD_STATUSES = ['جدید','تخصیص به شعبه','تخصیص به گروه','تخصیص به کارگر','در حال انجام','تکمیل شده','تعلیق','ارجاع به سرپرست','لغو شده'];
const BNM_ORDER_STATUSES = ['جدید','ثبت اولیه','در حال بررسی','تبدیل به کارت','در حال انجام','تکمیل شده','لغو شده'];
const BNM_AP_STATUS = ['جدید','در حال بررسی','در انتظار مصاحبه','تأیید شده','رد شده','استخدام شده','بایگانی'];
const BNM_SOON = ['finance','branchServices','marketing','workforce','inventory'];
const BNM_SOON_FA = {
  finance:'امور مالی شعبه', branchServices:'خدمات و نرخ‌گذاری شعبه',
  marketing:'بازاریابی محلی', workforce:'شیفت و حضور و غیاب', inventory:'انبار و تجهیزات'
};
const BNM_ID_RULES = {
  employees:{ field:'empId', prefix:'EMP', block:'333', pad:8 },
  workers:{ field:'workerId', prefix:'W', block:'444', pad:8 },
  groups:{ field:'groupId', prefix:'GRP', block:'', pad:3 }
};
const BNM_PERMISSIONS = {
  pages:['dashboard','orders','cards','planner','tasks','applicants','employees','groups','members',
         'workers','support','threads','adminSupport','reports','roadmap','profile'].concat(BNM_SOON),
  canEdit:true, canDelete:true, canManageStaff:true, canHire:true, scope:'BRANCH'
};

/* ==================== ابزارهای پایه ==================== */
function bnm_lock_() { const l = LockService.getScriptLock(); l.waitLock(20000); return l; }
function bnm_txt_(v) { try { return text_(v); } catch (e) { return v == null ? '' : String(v).trim(); } }
function bnm_num_(v) { try { return number_(v); } catch (e) { const n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g,'')); return isFinite(n) ? n : 0; } }
function bnm_iso_(v) { if (!v) return ''; if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString(); const d = new Date(v); return isNaN(d.getTime()) ? String(v) : d.toISOString(); }
function bnm_key_(s) { return String(s == null ? '' : s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)); }
function bnm_dateKey_(v) {
  if (v == null || v === '') return '';
  const tz = Session.getScriptTimeZone() || 'Asia/Tehran';
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = bnm_key_(v).trim();
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y >= 1300 && y <= 1500 && typeof scJ2G_ === 'function') { const g = scJ2G_(y, mo, d); return g[0]+'-'+String(g[1]).padStart(2,'0')+'-'+String(g[2]).padStart(2,'0'); }
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? '' : Utilities.formatDate(d2, tz, 'yyyy-MM-dd');
}
function bnm_name_(r) { if (!r) return ''; return bnm_txt_(r.fullName) || [bnm_txt_(r.firstName), bnm_txt_(r.lastName)].filter(Boolean).join(' ') || bnm_txt_(r.username); }
function bnm_read_(e) { try { return scRead_(e); } catch (err) { return []; } }
function bnm_log_(s, a, d, r) { try { scLog_(s, a, d, r); } catch (e) {} }
function bnm_cache_() { try { schemaInvalidate_(); } catch (e) {} }
function bnm_entity_(e) { return e === 'members' ? 'groupMembers' : e; }
function bnm_today_() { try { return scStoreDate_(jalaliToday_()); } catch (e) { return bnm_dateKey_(new Date()); } }
function bnm_store_(v) { if (!v) return ''; try { return scStoreDate_(v); } catch (e) { return bnm_dateKey_(v); } }

function bnmNextId_(entity) {
  const rule = BNM_ID_RULES[bnm_entity_(entity)];
  if (!rule) return '';
  const re = new RegExp('^' + rule.prefix + '-' + rule.block + '(\\d+)$', 'i');
  let max = 0;
  bnm_read_(entity).forEach(r => { const m = bnm_txt_(r[rule.field]).match(re); if (m) max = Math.max(max, Number(m[1])); });
  return rule.prefix + '-' + rule.block + String(max + 1).padStart(rule.pad, '0');
}

/* ==================== نشست ==================== */
function branchManagerLogin(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '');
  if (!u || !p) throw new Error('نام کاربری و رمز عبور را وارد کنید.');
  const found = bnm_read_('branchManagers').find(r =>
    (bnm_txt_(r.username).toLowerCase() === u || bnm_txt_(r.email).toLowerCase() === u) &&
    bnm_txt_(r.password) === p && /^(فعال|active)$/i.test(bnm_txt_(r.status)));
  if (!found) throw new Error('نام کاربری یا رمز عبور اشتباه است، یا حساب غیرفعال است.');
  const branchId = bnm_txt_(found.branchId);
  if (!branchId) throw new Error('شعبه‌ای برای این حساب تعریف نشده است؛ با مدیر سامانه تماس بگیرید.');
  const token = Utilities.getUuid();
  const session = {
    token, role:'Branch Manager', panel:'branchManager', userType:'branchManager',
    permissions: BNM_PERMISSIONS,
    bnmId: bnm_txt_(found.bnmId), username: bnm_txt_(found.username),
    email: bnm_txt_(found.email), name: bnm_name_(found) || bnm_txt_(found.username),
    branchId, avatar: bnm_txt_(found.photo), phone: bnm_txt_(found.contact),
    createdAt: new Date().toISOString(), exp: Date.now() + BNM_SESSION_TTL_MS
  };
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
  bnm_log_(session, 'ورود به پنل مدیر شعبه', 'شعبه ' + branchId, 'success');
  return { success:true, token, role:'Branch Manager', panel:'branchManager', user: bnmCCUser_(session) };
}
function branchManagerLogout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty('session_' + token); } catch (e) {}
  return { success:true };
}
function checkBranchManagerAuth(token) {
  if (!token) { const e = new Error('لطفاً ابتدا وارد شوید.'); e.code = 'NO_SESSION'; throw e; }
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('session_' + token);
  if (!raw) { const e = new Error('نشست منقضی شده است؛ دوباره وارد شوید.'); e.code = 'NO_SESSION'; throw e; }
  let s;
  try { s = JSON.parse(raw); } catch (err) { props.deleteProperty('session_' + token); const e = new Error('نشست نامعتبر است.'); e.code = 'NO_SESSION'; throw e; }
  if (s.role !== 'Branch Manager') { const e = new Error('دسترسی غیرمجاز.'); e.code = 'FORBIDDEN'; throw e; }
  if (!s.branchId) throw new Error('شعبه‌ای برای حساب شما تعریف نشده است.');
  if (s.exp && Date.now() > s.exp) { props.deleteProperty('session_' + token); const e = new Error('نشست منقضی شده است.'); e.code = 'NO_SESSION'; throw e; }
  s.token = token; s.permissions = s.permissions || BNM_PERMISSIONS;
  s.exp = Date.now() + BNM_SESSION_TTL_MS;
  try { props.setProperty('session_' + token, JSON.stringify(s)); } catch (err) {}
  return s;
}
function bnmPerm_(token, perm) {
  const s = checkBranchManagerAuth(token);
  if (!(s.permissions || BNM_PERMISSIONS)[perm]) { const e = new Error('دسترسی به این بخش را ندارید.'); e.code='FORBIDDEN'; throw e; }
  return s;
}
function bnmCCUser_(s) {
  return {
    name:s.name, role:'Branch Manager', roleFa:'مدیر شعبه', bnmId:s.bnmId,
    username:s.username, email:s.email || '', phone:s.phone || '',
    branchId:s.branchId, avatar:s.avatar || '', permissions:s.permissions || BNM_PERMISSIONS
  };
}
function bnmCCSession(token) { const s = checkBranchManagerAuth(token); return { success:true, user: bnmCCUser_(s) }; }

/* ==================== محدوده شعبه ==================== */
function bnmScope_(branchId) {
  const b = bnm_txt_(branchId);
  const orders = bnm_read_('orders').filter(r => bnm_txt_(r.branchId) === b);
  const cards = bnm_read_('cards').filter(r => bnm_txt_(r.branchId) === b);
  const groups = bnm_read_('groups').filter(r => bnm_txt_(r.branchId) === b);
  const gids = {}; groups.forEach(g => gids[bnm_txt_(g.groupId)] = true);
  const cuIds = {}; orders.forEach(o => { const c = bnm_txt_(o.customerId); if (c) cuIds[c] = true; });
  cards.forEach(c => { const x = bnm_txt_(c.customerId); if (x) cuIds[x] = true; });
  return { b, orders, cards, groups, gids, cuIds };
}
function bnmAssertRow_(entity, rowIndex, s) {
  const real = bnm_entity_(entity);
  const row = bnm_read_(real).find(r => Number(r._rowIndex) === Number(rowIndex));
  if (!row) throw new Error('رکورد یافت نشد.');
  const sc = bnmScope_(s.branchId);
  if (real === 'groupMembers') { if (!sc.gids[bnm_txt_(row.groupId)]) throw new Error('این عضو متعلق به شعبه شما نیست.'); }
  else if (real === 'tasks') { if (!sc.cuIds[bnm_txt_(row.customerId)] && bnm_txt_(row.branchId) !== sc.b) throw new Error('این تسک متعلق به شعبه شما نیست.'); }
  else if (bnm_txt_(row.branchId) !== sc.b) throw new Error('این رکورد متعلق به شعبه شما نیست.');
  return row;
}

/* ══════════════════════════════════════════════════════════════
   موتور گفتگوی رشته‌ای (سه کانال) — نمای مدیر شعبه
   ══════════════════════════════════════════════════════════════ */
const BNM_MSG_TH = 'ConversationThreads';
const BNM_MSG_MS = 'ConversationMessages';
const BNM_CH_INT = 'INTERNAL', BNM_CH_CUS = 'CUSTOMER_SUPPORT', BNM_CH_ADM = 'EMPLOYEE_SUPPORT';
const BNM_TH_H = ['Thread-ID','Card-ID','Worker-ID','WorkerUsername','Supervisor-ID','SupervisorUsername',
  'Group-ID','Branch-ID','Subject','Status','LastMessageAt','LastMessageBy','CreatedAt','UpdatedAt',
  'Channel','TicketNo','OwnerRole','Owner-ID','OwnerUsername','OwnerName','PeerRole','Peer-ID','PeerUsername',
  'Priority','MessageCount','UnreadOwner','UnreadPeer','ClosedAt','ClosedBy','LastMessagePreview','LegacyRef'];
const BNM_MS_H = ['Message-ID','Thread-ID','SenderRole','Sender-ID','SenderUsername','Body','CreatedAt',
  'ReadAt','ReadBy','MessageType','RelatedCard-ID','SenderName','Channel','Branch-ID','Visibility','EditedAt','DeletedAt','Attachments'];

function bnmMsgHead_(sh) { const n = sh.getLastColumn(); return n < 1 ? [] : sh.getRange(1,1,1,n).getDisplayValues()[0].map(x => String(x).trim()); }
function bnmMsgSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0B1736').setFontColor('#FFFFFF');
    return sh;
  }
  const cur = bnmMsgHead_(sh);
  if (!cur.some(x => x !== '')) {
    sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0B1736').setFontColor('#FFFFFF');
    return sh;
  }
  const missing = headers.filter(h => cur.indexOf(h) < 0);
  if (missing.length) {
    sh.getRange(1, cur.length+1, 1, missing.length).setValues([missing]);
    sh.getRange(1, cur.length+1, 1, missing.length).setFontWeight('bold').setBackground('#13234D').setFontColor('#FFFFFF');
  }
  return sh;
}
function bnmMsgRows_(name, headers) {
  const sh = bnmMsgSheet_(name, headers);
  if (sh.getLastRow() < 2) return [];
  const head = bnmMsgHead_(sh);
  return sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues()
    .map((r,i) => { const o = { _row:i+2 }; head.forEach((h,j) => { if (h) o[h] = r[j]; }); return o; });
}
function bnmMsgAppend_(name, headers, obj) {
  const sh = bnmMsgSheet_(name, headers);
  sh.appendRow(bnmMsgHead_(sh).map(h => obj.hasOwnProperty(h) ? obj[h] : ''));
  return sh.getLastRow();
}
function bnmMsgPatch_(name, headers, rowIndex, obj) {
  const sh = bnmMsgSheet_(name, headers), head = bnmMsgHead_(sh);
  Object.keys(obj).forEach(k => { const c = head.indexOf(k); if (c >= 0) sh.getRange(rowIndex, c+1).setValue(obj[k]); });
}
function bnmMsgUid_(p) { return p + '-' + Utilities.getUuid().replace(/-/g,'').slice(0,18).toUpperCase(); }
function bnmMsgCh_(t) { return bnm_txt_(t.Channel) || BNM_CH_INT; }
function bnmMsgState_(v) {
  const s = bnm_txt_(v).toLowerCase();
  if (!s) return 'OPEN';
  if (/closed|بسته/.test(s)) return 'CLOSED';
  if (/answered|پاسخ داده/.test(s)) return 'ANSWERED';
  return 'OPEN';
}
function bnmMsgStateOut_(ch, v) {
  const s = bnmMsgState_(v);
  if (ch === BNM_CH_CUS) return s === 'CLOSED' ? 'closed' : s === 'ANSWERED' ? 'answered' : 'unread';
  return s === 'CLOSED' ? 'بسته' : s === 'ANSWERED' ? 'پاسخ داده شده' : 'در انتظار پاسخ';
}
function bnmMsgOwnerRole_(t) {
  const r = bnm_txt_(t.OwnerRole); if (r) return r;
  const c = bnmMsgCh_(t);
  return c === BNM_CH_CUS ? 'customer' : c === BNM_CH_ADM ? 'employee' : 'worker';
}
function bnmMsgGroup_(msgs) {
  const g = {};
  msgs.forEach(m => { if (bnm_txt_(m.DeletedAt)) return; const k = bnm_txt_(m['Thread-ID']); (g[k] = g[k] || []).push(m); });
  Object.keys(g).forEach(k => g[k].sort((a,b) => String(bnm_iso_(a.CreatedAt)).localeCompare(String(bnm_iso_(b.CreatedAt)))));
  return g;
}
function bnmMsgMsgView_(m) {
  let att = []; try { att = JSON.parse(bnm_txt_(m.Attachments) || '[]'); } catch (e) {}
  return {
    messageId:bnm_txt_(m['Message-ID']), threadId:bnm_txt_(m['Thread-ID']),
    senderRole:bnm_txt_(m.SenderRole), senderId:bnm_txt_(m['Sender-ID']),
    senderUsername:bnm_txt_(m.SenderUsername), senderName:bnm_txt_(m.SenderName) || bnm_txt_(m.SenderUsername),
    body:bnm_txt_(m.Body), createdAt:bnm_iso_(m.CreatedAt), readAt:bnm_iso_(m.ReadAt), readBy:bnm_txt_(m.ReadBy),
    messageType:bnm_txt_(m.MessageType) || 'TEXT', visibility:bnm_txt_(m.Visibility) || 'ALL',
    cardId:bnm_txt_(m['RelatedCard-ID']), editedAt:bnm_iso_(m.EditedAt), attachments:att
  };
}
function bnmMsgView_(t, list, ctx) {
  const ch = bnmMsgCh_(t), or = bnmMsgOwnerRole_(t), vis = list || [];
  let lastPublic = null, firstOwner = null, lastStaff = null;
  for (let i = vis.length-1; i >= 0; i--) if (bnm_txt_(vis[i].Visibility) !== 'STAFF') { lastPublic = vis[i]; break; }
  for (let j = 0; j < vis.length; j++) if (bnm_txt_(vis[j].SenderRole) === or) { firstOwner = vis[j]; break; }
  for (let k = vis.length-1; k >= 0; k--) { const r = bnm_txt_(vis[k].SenderRole); if (r !== or && r !== 'system') { lastStaff = vis[k]; break; } }
  const bid = bnm_txt_(t['Branch-ID']), tid = bnm_txt_(t['Thread-ID']);
  return {
    threadId:tid, ticketNo:bnm_txt_(t.TicketNo), channel:ch,
    subject:bnm_txt_(t.Subject) || 'بدون موضوع',
    state:bnmMsgState_(t.Status), status:bnmMsgStateOut_(ch, t.Status),
    priority:bnm_txt_(t.Priority) || 'عادی',
    branchId:bid, branchName:(ctx && ctx.branchName) || bid,
    groupId:bnm_txt_(t['Group-ID']), cardId:bnm_txt_(t['Card-ID']),
    ownerRole:or, ownerId:bnm_txt_(t['Owner-ID']) || bnm_txt_(t['Worker-ID']),
    ownerUsername:bnm_txt_(t.OwnerUsername) || bnm_txt_(t.WorkerUsername),
    ownerName:bnm_txt_(t.OwnerName) || bnm_txt_(t.OwnerUsername) || bnm_txt_(t['Owner-ID']),
    peerRole:bnm_txt_(t.PeerRole), peerUsername:bnm_txt_(t.PeerUsername) || bnm_txt_(t.SupervisorUsername),
    messageCount:vis.length,
    unread: ch === BNM_CH_ADM ? bnm_num_(t.UnreadOwner) : bnm_num_(t.UnreadPeer),
    preview:bnm_txt_(t.LastMessagePreview) || (lastPublic ? bnm_txt_(lastPublic.Body).slice(0,140) : ''),
    lastMessageAt:bnm_iso_(t.LastMessageAt) || (lastPublic ? bnm_iso_(lastPublic.CreatedAt) : bnm_iso_(t.CreatedAt)),
    lastMessageBy:bnm_txt_(t.LastMessageBy), createdAt:bnm_iso_(t.CreatedAt), updatedAt:bnm_iso_(t.UpdatedAt),
    closedAt:bnm_iso_(t.ClosedAt), closedBy:bnm_txt_(t.ClosedBy),
    rowIndex:t._row, id:tid, conversationId:tid,
    customerId: ch === BNM_CH_CUS ? (bnm_txt_(t['Owner-ID'])) : '',
    senderName:bnm_txt_(t.OwnerName) || bnm_txt_(t.OwnerUsername),
    username:bnm_txt_(t.OwnerUsername),
    message:firstOwner ? bnm_txt_(firstOwner.Body) : '',
    reply:lastStaff ? bnm_txt_(lastStaff.Body) : '',
    repliedAt:lastStaff ? bnm_iso_(lastStaff.CreatedAt) : '',
    workerUsername:bnm_txt_(t.WorkerUsername) || (ch === BNM_CH_INT ? bnm_txt_(t.OwnerUsername) : ''),
    supervisorUsername:bnm_txt_(t.SupervisorUsername) || (ch === BNM_CH_INT ? bnm_txt_(t.PeerUsername) : '')
  };
}
function bnmMsgList_(s, channel, opts) {
  const o = opts || {};
  const branch = bnm_read_('branches').find(x => bnm_txt_(x.branchId) === s.branchId);
  const ctx = { branchName: branch ? bnm_txt_(branch.name) : s.branchId };
  const ths = bnmMsgRows_(BNM_MSG_TH, BNM_TH_H);
  const g = bnmMsgGroup_(bnmMsgRows_(BNM_MSG_MS, BNM_MS_H));
  let out = ths.filter(t => {
    if (bnm_txt_(t['Branch-ID']) !== s.branchId) return false;
    if (channel && bnmMsgCh_(t) !== channel) return false;
    if (o.status && bnmMsgState_(t.Status) !== bnmMsgState_(o.status)) return false;
    return true;
  }).map(t => bnmMsgView_(t, g[bnm_txt_(t['Thread-ID'])] || [], ctx));
  if (o.unreadOnly) out = out.filter(v => v.unread > 0 && v.state !== 'CLOSED');
  out.sort((a,b) => String(b.lastMessageAt || b.createdAt).localeCompare(String(a.lastMessageAt || a.createdAt)));
  return out;
}
function bnmMsgResolve_(s, id) {
  const key = bnm_txt_(id);
  if (!key) throw new Error('شناسه گفتگو مشخص نیست.');
  const ths = bnmMsgRows_(BNM_MSG_TH, BNM_TH_H);
  let t = ths.find(x => bnm_txt_(x['Thread-ID']) === key);
  if (!t) t = ths.find(x => { const lr = bnm_txt_(x.LegacyRef); return lr === 'CC:'+key || lr === 'ES:'+key; });
  if (!t) throw new Error('گفتگو یافت نشد. اگر داده قدیمی دارید، از پنل ادمین یک‌بار مهاجرت گفتگوها را اجرا کنید.');
  if (bnm_txt_(t['Branch-ID']) !== s.branchId) throw new Error('این گفتگو متعلق به شعبه شما نیست.');
  return t;
}
function bnmMsgNextTicket_(ch, ths) {
  const p = ch === BNM_CH_CUS ? 'TC' : ch === BNM_CH_ADM ? 'TE' : 'TI';
  return p + '-' + String(ths.filter(t => bnmMsgCh_(t) === ch).length + 1).padStart(6, '0');
}
function bnmMsgCustName_(cid, cuIds) {
  const c = bnm_read_('customers').find(x => bnm_txt_(x.customerId) === bnm_txt_(cid));
  if (c) { const n = bnm_name_(c); if (n) return n; }
  const o = bnm_read_('orders').find(x => bnm_txt_(x.customerId) === bnm_txt_(cid));
  return o ? bnm_name_(o) : bnm_txt_(cid);
}
function bnmCCEnsureMessaging(token) {
  if (token) checkBranchManagerAuth(token);
  bnmMsgSheet_(BNM_MSG_TH, BNM_TH_H); bnmMsgSheet_(BNM_MSG_MS, BNM_MS_H);
  return { success:true, message:'ساختار شیت‌های گفتگو آماده است.' };
}
function bnmCCMessages(channel, opts, token) {
  const s = checkBranchManagerAuth(token);
  const items = bnmMsgList_(s, bnm_txt_(channel), opts || {});
  return { success:true, total:items.length, items };
}
function bnmCCMessageGet(id, token) {
  const s = checkBranchManagerAuth(token);
  const t = bnmMsgResolve_(s, id), tid = bnm_txt_(t['Thread-ID']);
  const all = bnmMsgRows_(BNM_MSG_MS, BNM_MS_H).filter(m => bnm_txt_(m['Thread-ID']) === tid && !bnm_txt_(m.DeletedAt));
  all.sort((a,b) => String(bnm_iso_(a.CreatedAt)).localeCompare(String(bnm_iso_(b.CreatedAt))));
  const now = new Date(), who = bnm_txt_(s.username), ch = bnmMsgCh_(t);
  const ownSide = ch === BNM_CH_ADM ? ['employee','manager','operator'] : ['customer','worker'];
  all.forEach(m => {
    if (ownSide.indexOf(bnm_txt_(m.SenderRole)) < 0 && !bnm_txt_(m.ReadAt)) {
      bnmMsgPatch_(BNM_MSG_MS, BNM_MS_H, m._row, { ReadAt:now, ReadBy:who }); m.ReadAt = now; m.ReadBy = who;
    }
  });
  bnmMsgPatch_(BNM_MSG_TH, BNM_TH_H, t._row, ch === BNM_CH_ADM ? { UnreadOwner:0 } : { UnreadPeer:0 });
  if (ch === BNM_CH_ADM) t.UnreadOwner = 0; else t.UnreadPeer = 0;
  const branch = bnm_read_('branches').find(x => bnm_txt_(x.branchId) === s.branchId);
  return { success:true, thread:bnmMsgView_(t, all, { branchName: branch ? bnm_txt_(branch.name) : s.branchId }), messages:all.map(bnmMsgMsgView_) };
}
function bnmCCMessageReply(id, body, opts, token) {
  const s = bnmPerm_(token, 'canEdit');
  const o = opts || {}, txt = bnm_txt_(body);
  if (!txt) throw new Error('متن پیام الزامی است.');
  const lock = bnm_lock_();
  try {
    const t = bnmMsgResolve_(s, id), tid = bnm_txt_(t['Thread-ID']), ch = bnmMsgCh_(t);
    const vis = (o.internalNote && ch !== BNM_CH_ADM) ? 'STAFF' : 'ALL';
    const now = new Date(), who = bnm_txt_(s.username);
    const count = bnmMsgRows_(BNM_MSG_MS, BNM_MS_H).filter(m => bnm_txt_(m['Thread-ID']) === tid && !bnm_txt_(m.DeletedAt)).length + 1;
    bnmMsgAppend_(BNM_MSG_MS, BNM_MS_H, {
      'Message-ID':bnmMsgUid_('MSG'), 'Thread-ID':tid, SenderRole:'manager', 'Sender-ID':s.bnmId,
      SenderUsername:who, SenderName:s.name || who, Body:txt, CreatedAt:now,
      MessageType: vis === 'STAFF' ? 'NOTE' : 'TEXT', 'RelatedCard-ID':bnm_txt_(t['Card-ID']),
      Channel:ch, 'Branch-ID':s.branchId, Visibility:vis, Attachments:JSON.stringify(o.attachments || [])
    });
    const isOwnerSide = ch === BNM_CH_ADM;
    const patch = {
      UpdatedAt:now, LastMessageAt:now, LastMessageBy:who,
      LastMessagePreview: vis === 'STAFF' ? '🔒 یادداشت داخلی' : txt.slice(0,140),
      MessageCount:count,
      UnreadOwner: isOwnerSide ? 0 : bnm_num_(t.UnreadOwner) + (vis === 'ALL' ? 1 : 0),
      UnreadPeer:  isOwnerSide ? bnm_num_(t.UnreadPeer) + (vis === 'ALL' ? 1 : 0) : 0
    };
    if (bnmMsgState_(t.Status) !== 'CLOSED') patch.Status = 'ANSWERED';
    if (isOwnerSide && !bnm_txt_(t.OwnerName)) { patch.OwnerName = s.name || who; patch.OwnerUsername = who; patch['Owner-ID'] = s.bnmId; patch.OwnerRole = 'manager'; }
    bnmMsgPatch_(BNM_MSG_TH, BNM_TH_H, t._row, patch);
    bnm_log_(s, 'پاسخ در گفتگو', (bnm_txt_(t.TicketNo) || tid) + ' · ' + ch, 'success');
    return { success:true, threadId:tid, state:patch.Status || bnmMsgState_(t.Status), message:'پاسخ ثبت شد.' };
  } finally { lock.releaseLock(); }
}
function bnmCCMessageStatus(id, state, token) {
  const s = bnmPerm_(token, 'canEdit');
  const st = bnmMsgState_(state), lock = bnm_lock_();
  try {
    const t = bnmMsgResolve_(s, id), tid = bnm_txt_(t['Thread-ID']), now = new Date();
    const patch = { Status:st, UpdatedAt:now };
    if (st === 'CLOSED') { patch.ClosedAt = now; patch.ClosedBy = bnm_txt_(s.username); } else { patch.ClosedAt = ''; patch.ClosedBy = ''; }
    bnmMsgPatch_(BNM_MSG_TH, BNM_TH_H, t._row, patch);
    bnmMsgAppend_(BNM_MSG_MS, BNM_MS_H, {
      'Message-ID':bnmMsgUid_('MSG'), 'Thread-ID':tid, SenderRole:'system', 'Sender-ID':s.bnmId,
      SenderUsername:bnm_txt_(s.username), SenderName:s.name || 'سامانه',
      Body: st === 'CLOSED' ? 'گفتگو توسط مدیر شعبه بسته شد.' : st === 'ANSWERED' ? 'وضعیت: پاسخ داده شده.' : 'گفتگو باز شد.',
      CreatedAt:now, MessageType:'SYSTEM', Channel:bnmMsgCh_(t), 'Branch-ID':s.branchId, Visibility:'ALL'
    });
    bnm_log_(s, 'تغییر وضعیت گفتگو', (bnm_txt_(t.TicketNo) || tid) + ' → ' + st, 'success');
    return { success:true, state:st };
  } finally { lock.releaseLock(); }
}
function bnmCCMessageCreate(payload, token) {
  const s = bnmPerm_(token, 'canEdit');
  const p = payload || {}, body = bnm_txt_(p.body);
  if (!body) throw new Error('متن پیام الزامی است.');
  const ch = bnm_txt_(p.channel) || BNM_CH_INT;
  if ([BNM_CH_INT, BNM_CH_CUS, BNM_CH_ADM].indexOf(ch) < 0) throw new Error('کانال گفتگو معتبر نیست.');
  const lock = bnm_lock_();
  try {
    const ths = bnmMsgRows_(BNM_MSG_TH, BNM_TH_H);
    const now = new Date(), tid = bnmMsgUid_('THR'), who = bnm_txt_(s.username);
    const sc = bnmScope_(s.branchId);
    const th = {
      'Thread-ID':tid, Channel:ch, TicketNo:bnmMsgNextTicket_(ch, ths),
      Subject:bnm_txt_(p.subject) || 'بدون موضوع', Status:'OPEN', Priority:bnm_txt_(p.priority) || 'عادی',
      'Branch-ID':s.branchId, CreatedAt:now, UpdatedAt:now, LastMessageAt:now, LastMessageBy:who,
      LastMessagePreview:body.slice(0,140), MessageCount:1, UnreadOwner:0, UnreadPeer:1, 'Card-ID':bnm_txt_(p.cardId)
    };
    if (ch === BNM_CH_INT) {
      const card = sc.cards.find(c => bnm_txt_(c.cardId) === bnm_txt_(p.cardId));
      if (!card) throw new Error('کارت انتخاب‌شده متعلق به شعبه شما نیست.');
      const ws = bnm_read_('workers');
      const w = ws.find(x => bnm_txt_(x.workerId) === bnm_txt_(card.workerId)) || {};
      const g = sc.groups.find(x => bnm_txt_(x.groupId) === bnm_txt_(w.groupId)) || sc.groups[0] || {};
      const sup = ws.find(x => (bnm_txt_(g.supervisorName) && bnm_txt_(x.username) === bnm_txt_(g.supervisorName)) ||
                               (bnm_txt_(g.workerId) && bnm_txt_(x.workerId) === bnm_txt_(g.workerId))) || {};
      th.OwnerRole = 'worker'; th['Owner-ID'] = bnm_txt_(w.workerId); th.OwnerUsername = bnm_txt_(w.username);
      th.OwnerName = bnm_name_(w) || bnm_txt_(w.username) || 'نیروی شعبه';
      th['Worker-ID'] = th['Owner-ID']; th.WorkerUsername = th.OwnerUsername;
      th['Supervisor-ID'] = bnm_txt_(sup.workerId); th.SupervisorUsername = bnm_txt_(sup.username);
      th.PeerRole = 'supervisor'; th.PeerUsername = bnm_txt_(sup.username); th['Peer-ID'] = bnm_txt_(sup.workerId);
      th['Group-ID'] = bnm_txt_(g.groupId); th['Card-ID'] = bnm_txt_(card.cardId);
      th.UnreadOwner = 1; th.UnreadPeer = 0;
      if (!bnm_txt_(p.subject)) th.Subject = 'پیگیری کارت ' + bnm_txt_(card.cardId);
    } else if (ch === BNM_CH_CUS) {
      const cid = bnm_txt_(p.customerId);
      if (!cid) throw new Error('شناسه مشتری الزامی است.');
      if (!sc.cuIds[cid]) throw new Error('این مشتری در شعبه شما سابقه ندارد.');
      th.OwnerRole = 'customer'; th['Owner-ID'] = cid; th.OwnerUsername = cid;
      th.OwnerName = bnmMsgCustName_(cid); th.PeerRole = 'manager'; th.PeerUsername = who; th['Peer-ID'] = s.bnmId;
      th.UnreadOwner = 1; th.UnreadPeer = 0;
    } else {
      th.OwnerRole = 'manager'; th['Owner-ID'] = s.bnmId; th.OwnerUsername = who; th.OwnerName = s.name || who;
      th.PeerRole = 'admin'; th.PeerUsername = ''; th['Peer-ID'] = '';
      th.UnreadOwner = 0; th.UnreadPeer = 1;
    }
    bnmMsgAppend_(BNM_MSG_TH, BNM_TH_H, th);
    bnmMsgAppend_(BNM_MSG_MS, BNM_MS_H, {
      'Message-ID':bnmMsgUid_('MSG'), 'Thread-ID':tid, SenderRole:'manager', 'Sender-ID':s.bnmId,
      SenderUsername:who, SenderName:s.name || who, Body:body, CreatedAt:now, MessageType:'TEXT',
      'RelatedCard-ID':bnm_txt_(th['Card-ID']), Channel:ch, 'Branch-ID':s.branchId, Visibility:'ALL',
      Attachments:JSON.stringify(p.attachments || [])
    });
    bnm_log_(s, 'ایجاد گفتگو', th.TicketNo + ' · ' + ch, 'success');
    return { success:true, threadId:tid, ticketNo:th.TicketNo, id:tid };
  } finally { lock.releaseLock(); }
}
function bnmCCMessageUnread(token) {
  const s = checkBranchManagerAuth(token);
  const o = { success:true, INTERNAL:0, CUSTOMER_SUPPORT:0, EMPLOYEE_SUPPORT:0, total:0 };
  bnmMsgList_(s, '', {}).forEach(v => { if (v.state === 'CLOSED' || v.unread <= 0) return; o[v.channel] = (o[v.channel]||0)+1; o.total++; });
  return o;
}

/* ==================== کارجویان شعبه ==================== */
function bnmJaCols_() { try { if (typeof JA_HEADERS !== 'undefined' && JA_HEADERS.length) return JA_HEADERS.length; } catch (e) {} return 31; }
function bnmJaText_(v) { return v == null ? '' : String(v).trim(); }
function bnmReadApplicants_(branchId) {
  try {
    if (typeof jaSheet_ !== 'function') return [];
    const sh = jaSheet_(), last = sh.getLastRow();
    if (last < 2) return [];
    const N = bnmJaCols_();
    return sh.getRange(2,1,last-1,N).getValues().map((r,i) => ({
      rowIndex:i+2, createdAt:bnm_iso_(r[0]), caseNumber:bnmJaText_(r[1]),
      branchId:bnmJaText_(r[2]), createdBy:bnmJaText_(r[3]),
      firstName:bnmJaText_(r[4]), lastName:bnmJaText_(r[5]), gender:bnmJaText_(r[6]),
      birthDate:bnm_dateKey_(r[7]), age:bnmJaText_(r[8]), maritalStatus:bnmJaText_(r[9]),
      specialty:bnmJaText_(r[10]), experience:bnmJaText_(r[11]), otherSkills:bnmJaText_(r[12]),
      education:bnmJaText_(r[13]), fieldOfStudy:bnmJaText_(r[14]),
      province:bnmJaText_(r[15]), city:bnmJaText_(r[16]), address:bnmJaText_(r[17]),
      phone:bnmJaText_(r[18]), messenger:bnmJaText_(r[19]), messengerId:bnmJaText_(r[20]),
      source:bnmJaText_(r[21]), referrer:bnmJaText_(r[22]), requestedPosition:bnmJaText_(r[23]),
      initialReview:bnmJaText_(r[24]), phoneInterviewDate:bnm_dateKey_(r[25]),
      inPersonInterviewDate:bnm_dateKey_(r[26]), phoneInterviewResult:bnmJaText_(r[27]),
      inPersonInterviewResult:bnmJaText_(r[28]), notes:bnmJaText_(r[29]), status:bnmJaText_(r[30])
    })).filter(a => a.branchId === branchId).reverse();
  } catch (e) { return []; }
}
function bnmCCApplicants(token) { const s = checkBranchManagerAuth(token); return bnmReadApplicants_(s.branchId); }
function bnmCCApplicantStatus(caseNumber, status, token) {
  const s = bnmPerm_(token, 'canEdit');
  if (BNM_AP_STATUS.indexOf(String(status)) < 0) throw new Error('وضعیت معتبر نیست.');
  if (typeof jaSheet_ !== 'function') throw new Error('ماژول کارجویان در پروژه نصب نیست.');
  const lock = bnm_lock_();
  try {
    const sh = jaSheet_(), last = sh.getLastRow();
    if (last < 2) throw new Error('پرونده‌ای یافت نشد.');
    const vals = sh.getRange(2,1,last-1,3).getValues();
    let rowNo = -1;
    vals.forEach((r,i) => { if (bnmJaText_(r[1]) === bnm_txt_(caseNumber) && bnmJaText_(r[2]) === s.branchId) rowNo = i+2; });
    if (rowNo < 0) throw new Error('پرونده در شعبه شما یافت نشد.');
    sh.getRange(rowNo, 31).setValue(status);
    bnm_log_(s, 'تغییر وضعیت پرونده کارجو', caseNumber + ' → ' + status, 'success');
    return { success:true };
  } finally { lock.releaseLock(); }
}
function bnmCCHireApplicant(caseNumber, token) {
  const s = bnmPerm_(token, 'canHire');
  if (typeof jaSheet_ !== 'function') throw new Error('ماژول کارجویان در پروژه نصب نیست.');
  const lock = bnm_lock_();
  try {
    const sh = jaSheet_(), last = sh.getLastRow(), N = bnmJaCols_();
    if (last < 2) throw new Error('پرونده‌ای یافت نشد.');
    const rows = sh.getRange(2,1,last-1,N).getValues();
    let idx = -1;
    rows.forEach((r,i) => { if (bnmJaText_(r[1]) === bnm_txt_(caseNumber) && bnmJaText_(r[2]) === s.branchId) idx = i; });
    if (idx < 0) throw new Error('پرونده در شعبه شما یافت نشد.');
    const r = rows[idx], rowNo = idx + 2;
    if (bnmJaText_(r[30]) === 'استخدام شده') throw new Error('این پرونده قبلاً استخدام شده است.');
    const pos = bnmJaText_(r[23]);
    const ops = /سرپرست|supervisor/i.test(pos) ? 'Supervisor' : /اپراتور|operator|اداری/i.test(pos) ? 'operator' : 'worker';
    const wid = bnmNextId_('workers');
    const uname = 'w' + wid.replace(/\D/g,'').slice(-6);
    const pass = String(Math.floor(100000 + Math.random()*900000));
    scAppend_('workers', {
      workerId:wid, username:uname, password:pass,
      firstName:bnmJaText_(r[4]), lastName:bnmJaText_(r[5]), gender:bnmJaText_(r[6]), birthday:bnmJaText_(r[7]),
      operations:ops, jobTitle:pos, specialization:bnmJaText_(r[10]), contact:bnmJaText_(r[18]),
      province:bnmJaText_(r[15]), city:bnmJaText_(r[16]), address:bnmJaText_(r[17]),
      description:bnmJaText_(r[29]), branchId:s.branchId, hireDate:bnm_today_(), status:'فعال'
    });
    sh.getRange(rowNo, 31).setValue('استخدام شده');
    bnm_log_(s, 'استخدام کارجو', caseNumber + ' → ' + wid, 'success');
    bnm_cache_();
    return { success:true, workerId:wid, username:uname, password:pass };
  } finally { lock.releaseLock(); }
}

/* ==================== بارگذاری یکجا ==================== */
function bnmCCBootstrap(token) {
  const s = checkBranchManagerAuth(token);
  bnm_cache_();
  return { success:true, user:bnmCCUser_(s), data:bnmCCData_(s), meta:{ version:BNM_VERSION, statuses:{ cards:BNM_CARD_STATUSES, orders:BNM_ORDER_STATUSES, applicants:BNM_AP_STATUS }, soon:BNM_SOON } };
}
function bnmCCData_(s) {
  const D = {}, sc = bnmScope_(s.branchId);
  const branch = bnm_read_('branches').find(b => bnm_txt_(b.branchId) === s.branchId) || {};
  const workers = bnm_read_('workers').filter(w => bnm_txt_(w.branchId) === s.branchId);
  const wMap = {}; workers.forEach(w => wMap[bnm_txt_(w.workerId)] = w);
  const allCustomers = bnm_read_('customers');
  const cMap = {}; allCustomers.forEach(c => cMap[bnm_txt_(c.customerId)] = c);
  const cardByReq = {}; sc.cards.forEach(c => cardByReq[bnm_txt_(c.requestId)] = c);
  const services = bnm_read_('services');
  const svcByName = {}; services.forEach(v => { svcByName[bnm_txt_(v.nameFa)] = bnm_txt_(v.id); svcByName[bnm_txt_(v.nameEn)] = bnm_txt_(v.id); });

  D.branch = {
    branchId:s.branchId, name:bnm_txt_(branch.name) || ('شعبه ' + s.branchId),
    province:bnm_txt_(branch.province), city:bnm_txt_(branch.city), area:bnm_txt_(branch.area),
    address:bnm_txt_(branch.address), managerName:bnm_txt_(branch.managerName) || s.name,
    description:bnm_txt_(branch.description), established:bnm_dateKey_(branch.established), status:bnm_txt_(branch.status)
  };
  D.branches = [D.branch];

  D.orders = sc.orders.map(r => {
    const c = cMap[bnm_txt_(r.customerId)] || {};
    const card = cardByReq[bnm_txt_(r.requestId)];
    return {
      rowIndex:r._rowIndex, requestId:bnm_txt_(r.requestId), createdAt:bnm_iso_(r.createdAt),
      customerName:bnm_name_(r) || bnm_name_(c), phone:bnm_txt_(r.contact), service:bnm_txt_(r.service),
      serviceId:svcByName[bnm_txt_(r.service)] || '', qty:bnm_num_(r.qty), actionType:bnm_txt_(r.actionType),
      execDate:bnm_dateKey_(r.execDate), execTime:bnm_txt_(r.execTime),
      addrFrom:bnm_txt_(r.addrFrom) || bnm_txt_(r.addrTo), notes:bnm_txt_(r.notes), status:bnm_txt_(r.status),
      verifier:bnm_txt_(r.verifier), operator:bnm_txt_(r.operator), branchId:bnm_txt_(r.branchId), groupId:bnm_txt_(r.groupId),
      customerId:bnm_txt_(r.customerId), province:bnm_txt_(c.province) || D.branch.province, city:bnm_txt_(c.city) || D.branch.city,
      basePrice:bnm_num_(r.basePrice), discount:bnm_num_(r.discount), tax:bnm_num_(r.tax), finalPrice:bnm_num_(r.finalPrice),
      sideServices:bnm_txt_(r.sideServices), cardId:card ? bnm_txt_(card.cardId) : ''
    };
  }).reverse();

  const cardIds = {};
  D.cards = sc.cards.map(r => {
    cardIds[bnm_txt_(r.cardId)] = true;
    const w = wMap[bnm_txt_(r.workerId)] || {};
    const o = sc.orders.find(x => bnm_txt_(x.requestId) === bnm_txt_(r.requestId)) || {};
    return {
      rowIndex:r._rowIndex, cardId:bnm_txt_(r.cardId), requestId:bnm_txt_(r.requestId), customerId:bnm_txt_(r.customerId),
      customerName:bnm_txt_(r.customerName), phone:bnm_txt_(r.contact), service:bnm_txt_(r.serviceType),
      details:bnm_txt_(r.details), branchId:bnm_txt_(r.branchId), groupId:bnm_txt_(w.groupId) || bnm_txt_(o.groupId),
      workerId:bnm_txt_(r.workerId), status:bnm_txt_(r.status), execDate:bnm_dateKey_(r.execDate),
      execTime:bnm_txt_(r.execTime), address:bnm_txt_(r.address), amount:bnm_num_(r.total),
      duration:bnm_num_(r.duration), notes:bnm_txt_(r.description), actionType:bnm_txt_(r.actionType),
      createdAt:bnm_iso_(r.createdAt), updatedAt:bnm_iso_(r.updatedAt)
    };
  }).reverse();

  D.cardHistory = bnm_read_('cardHistory').filter(h => cardIds[bnm_txt_(h.cardId)])
    .map(h => ({ rowIndex:h._rowIndex, cardId:bnm_txt_(h.cardId), from:bnm_txt_(h.from), to:bnm_txt_(h.to),
      userId:bnm_txt_(h.userId), at:bnm_iso_(h.date), desc:bnm_txt_(h.desc) })).reverse();

  const person = (r, entity) => {
    const idField = entity === 'employees' ? 'empId' : entity === 'workers' ? 'workerId' : 'bnmId';
    return {
      rowIndex:r._rowIndex, id:bnm_txt_(r[idField]), empId:bnm_txt_(r.empId), workerId:bnm_txt_(r.workerId), bnmId:bnm_txt_(r.bnmId),
      username:bnm_txt_(r.username), firstName:bnm_txt_(r.firstName), lastName:bnm_txt_(r.lastName),
      fatherName:bnm_txt_(r.fatherName), gender:bnm_txt_(r.gender), nationalId:bnm_txt_(r.nationalId),
      birthCert:bnm_txt_(r.birthCert), birthday:bnm_dateKey_(r.birthday), branchId:bnm_txt_(r.branchId),
      groupId:bnm_txt_(r.groupId), jobTitle:bnm_txt_(r.jobTitle), operations:bnm_txt_(r.operations),
      specialization:bnm_txt_(r.specialization), email:bnm_txt_(r.email), contact:bnm_txt_(r.contact),
      photo:bnm_txt_(r.photo), province:bnm_txt_(r.province), city:bnm_txt_(r.city), address:bnm_txt_(r.address),
      emergencyName:bnm_txt_(r.emergencyName), emergency:bnm_txt_(r.emergency), hireDate:bnm_dateKey_(r.hireDate),
      description:bnm_txt_(r.description), notes:bnm_txt_(r.notes), status:bnm_txt_(r.status)
    };
  };
  D.employees = bnm_read_('employees').filter(r => bnm_txt_(r.branchId) === s.branchId).map(r => person(r, 'employees'));
  D.workers = workers.map(r => person(r, 'workers'));

  D.groups = sc.groups.map(r => ({
    rowIndex:r._rowIndex, groupId:bnm_txt_(r.groupId), branchId:bnm_txt_(r.branchId), workerId:bnm_txt_(r.workerId),
    supervisorName:bnm_txt_(r.supervisorName), name:bnm_txt_(r.name), province:bnm_txt_(r.province), city:bnm_txt_(r.city),
    area:bnm_txt_(r.area), totalMembers:bnm_num_(r.totalMembers), groupType:bnm_txt_(r.groupType),
    description:bnm_txt_(r.description), established:bnm_dateKey_(r.established), notes:bnm_txt_(r.notes), status:bnm_txt_(r.status)
  }));

  D.groupMembers = bnm_read_('groupMembers').filter(m => sc.gids[bnm_txt_(m.groupId)])
    .map(m => ({ rowIndex:m._rowIndex, groupId:bnm_txt_(m.groupId), workerId:bnm_txt_(m.workerId),
      username:bnm_txt_(m.username), role:bnm_txt_(m.role), joinDate:bnm_dateKey_(m.joinDate), status:bnm_txt_(m.status) }));
  D.members = D.groupMembers;

  D.customers = Object.keys(sc.cuIds).map(id => {
    const c = cMap[id] || {};
    const os = D.orders.filter(o => o.customerId === id);
    return { rowIndex:c._rowIndex || 0, customerId:id, firstName:bnm_txt_(c.firstName), lastName:bnm_txt_(c.lastName),
      username:bnm_txt_(c.username), phone:bnm_txt_(c.contact), contact:bnm_txt_(c.contact), email:bnm_txt_(c.email),
      city:bnm_txt_(c.city), province:bnm_txt_(c.province), address:bnm_txt_(c.address), photo:bnm_txt_(c.photo),
      level:bnm_txt_(c.level), status:bnm_txt_(c.status) || 'فعال',
      totalOrders:os.length, totalPayments:os.reduce((a,o) => a + o.finalPrice, 0) };
  });

  D.tasks = bnm_read_('tasks').filter(t => sc.cuIds[bnm_txt_(t.customerId)] || bnm_txt_(t.branchId) === s.branchId)
    .map(t => {
      const c = cMap[bnm_txt_(t.customerId)] || {};
      return { rowIndex:t._rowIndex, taskId:bnm_txt_(t.taskId), customerId:bnm_txt_(t.customerId),
        customerName:bnm_name_(c) || bnm_txt_(t.customerId), createdAt:bnm_dateKey_(t.createdAt),
        execDate:bnm_dateKey_(t.execDate), recDate:bnm_dateKey_(t.recDate), recType:bnm_txt_(t.recType),
        execTime:bnm_txt_(t.execTime), status:bnm_txt_(t.status), notes:bnm_txt_(t.notes) };
    }).reverse();

  D.services = services.map(v => ({ id:bnm_txt_(v.id), nameFa:bnm_txt_(v.nameFa), nameEn:bnm_txt_(v.nameEn), rate:bnm_num_(v.rate), unit:bnm_txt_(v.unit) }));
  D.applicants = bnmReadApplicants_(s.branchId);
  D.support = bnmMsgList_(s, BNM_CH_CUS);
  D.threads = bnmMsgList_(s, BNM_CH_INT);
  D.adminSupport = bnmMsgList_(s, BNM_CH_ADM);
  D.messageStats = (function () {
    const o = { INTERNAL:0, CUSTOMER_SUPPORT:0, EMPLOYEE_SUPPORT:0, total:0 };
    [].concat(D.support, D.threads, D.adminSupport).forEach(v => { if (v.state === 'CLOSED' || !(v.unread > 0)) return; o[v.channel] = (o[v.channel]||0)+1; o.total++; });
    return o;
  })();

  const settings = {};
  bnm_read_('settings').forEach(r => { const k = bnm_txt_(r.key); if (['FAVICON_URL','BRAND_NAME','CURRENCY_LABEL','LOGO_URL'].indexOf(k) >= 0) settings[k] = bnm_txt_(r.value); });
  D.settings = settings;
  D.views = bnmCCViews_(s.username);
  D.nextIds = { employees:bnmNextId_('employees'), workers:bnmNextId_('workers'), groups:bnmNextId_('groups') };
  D.notifications = bnmCCNotifications_(D);
  D.soon = BNM_SOON.map(k => ({ id:k, name:BNM_SOON_FA[k] }));
  return D;
}
function bnmCCNotifications_(D) {
  const out = [];
  (D.orders||[]).filter(o => /^(جدید|ثبت اولیه)$/.test(o.status)).slice(0,6).forEach(o => {
    out.push({ id:'n-o-'+o.rowIndex, kind:'orders', title:'سفارش در انتظار بررسی', body:(o.customerName||'—')+' · '+(o.requestId||''), at:o.createdAt, entityId:o.rowIndex });
  });
  const push = (arr, kind, title) => (arr||[]).filter(x => x.unread > 0 && x.state !== 'CLOSED').slice(0,5).forEach(x => {
    out.push({ id:'n-t-'+x.threadId, kind, threadId:x.threadId, entityId:x.threadId, title,
      body:(x.subject||'بدون موضوع')+' · '+(x.ownerName||''), at:x.lastMessageAt || x.createdAt });
  });
  push(D.support, 'support', 'پیام پاسخ‌داده‌نشده مشتری');
  push(D.adminSupport, 'adminSupport', 'پاسخ پشتیبانی سامانه');
  push(D.threads, 'threads', 'مکاتبه سازمانی خوانده‌نشده');
  (D.applicants||[]).filter(a => a.status === 'جدید').slice(0,5).forEach(a => {
    out.push({ id:'n-a-'+a.rowIndex, kind:'applicants', title:'پرونده جدید کارجو', body:(a.firstName+' '+a.lastName)+' · '+(a.requestedPosition||''), at:a.createdAt, entityId:a.rowIndex });
  });
  (D.cards||[]).filter(c => c.status === 'ارجاع به سرپرست').slice(0,5).forEach(c => {
    out.push({ id:'n-c-'+c.rowIndex, kind:'cards', title:'کارت ارجاع‌شده به سرپرست', body:c.cardId+' · '+(c.customerName||''), at:c.updatedAt, entityId:c.rowIndex });
  });
  return out.sort((a,b) => String(b.at).localeCompare(String(a.at))).slice(0,25);
}

/* ==================== ذخیره یکپارچه ==================== */
function bnmCCSave(entity, record, token) {
  const s = bnmPerm_(token, 'canEdit');
  const real = bnm_entity_(entity);
  if (['employees','workers','groups','groupMembers','tasks'].indexOf(real) < 0) throw new Error('این بخش از پنل مدیر شعبه قابل ویرایش نیست.');
  const lock = bnm_lock_();
  try {
    const sc = bnmScope_(s.branchId);
    const isNew = !record.rowIndex;
    const p = {};
    const fields = (typeof SCHEMA_FIELDS !== 'undefined' && SCHEMA_FIELDS[real]) || {};
    Object.keys(record || {}).forEach(k => {
      if (k === 'rowIndex' || k === 'id' || k === '_raw') return;
      if (Object.keys(fields).length && !fields[k]) return;
      let v = record[k];
      const dOnly = (typeof SCHEMA_DATEONLY !== 'undefined' && SCHEMA_DATEONLY[real]) || [];
      if (dOnly.indexOf(k) >= 0 && typeof v === 'string') v = v ? bnm_store_(v) : '';
      const money = (typeof SCHEMA_MONEY !== 'undefined' && SCHEMA_MONEY[real]) || [];
      if (money.indexOf(k) >= 0) v = bnm_num_(v);
      if (k === 'contact' || k === 'emergency' || k === 'phone') v = v ? String(v).replace(/[^\d]/g,'') : '';
      p[k] = v;
    });
    if (real !== 'tasks' && real !== 'groupMembers') p.branchId = s.branchId;
    if (real === 'employees') p.operations = 'Employee';
    if (real === 'tasks' && fields.branchId) p.branchId = s.branchId;

    if (real === 'groupMembers') {
      if (!sc.gids[bnm_txt_(p.groupId)]) throw new Error('گروه انتخاب‌شده متعلق به شعبه شما نیست.');
      const w = sc.cards && bnm_read_('workers').find(x => bnm_txt_(x.workerId) === bnm_txt_(p.workerId));
      if (!w || bnm_txt_(w.branchId) !== s.branchId) throw new Error('نیروی انتخاب‌شده متعلق به شعبه شما نیست.');
      if (!p.username) p.username = bnm_txt_(w.username);
      if (!p.joinDate) p.joinDate = bnm_today_();
      const dup = bnm_read_('groupMembers').find(m => bnm_txt_(m.groupId) === bnm_txt_(p.groupId) &&
        bnm_txt_(m.workerId) === bnm_txt_(p.workerId) && Number(m._rowIndex) !== Number(record.rowIndex));
      if (dup) throw new Error('این نیرو قبلاً عضو همین گروه است.');
    }
    if (real === 'tasks') {
      if (!sc.cuIds[bnm_txt_(p.customerId)]) throw new Error('مشتری انتخاب‌شده در شعبه شما سابقه ندارد.');
      if (!p.taskId) p.taskId = 'TSK-' + Date.now().toString(36).toUpperCase();
      if (!p.createdAt) p.createdAt = bnm_today_();
      if (!p.execDate) throw new Error('تاریخ اجرا الزامی است.');
    }
    if (real === 'groups') {
      if (!bnm_txt_(p.name)) throw new Error('نام گروه الزامی است.');
      if (isNew) { p.groupId = bnmNextId_('groups'); if (!p.established) p.established = bnm_today_(); }
      else { const old = bnmAssertRow_('groups', record.rowIndex, s); p.groupId = bnm_txt_(old.groupId); }
      if (p.workerId) {
        const w = bnm_read_('workers').find(x => bnm_txt_(x.workerId) === bnm_txt_(p.workerId) && bnm_txt_(x.branchId) === s.branchId);
        if (!w) throw new Error('سرپرست انتخاب‌شده متعلق به شعبه شما نیست.');
        if (!p.supervisorName) p.supervisorName = bnm_txt_(w.username);
      }
    }
    if (real === 'employees' || real === 'workers') {
      ['firstName','lastName','username'].forEach(k => { if (!bnm_txt_(p[k])) throw new Error('فیلد «'+k+'» الزامی است.'); });
      if (real === 'workers' && !bnm_txt_(p.operations)) p.operations = 'worker';
      if (p.contact && !/^09\d{9}$/.test(bnm_key_(p.contact))) throw new Error('شماره تماس باید ۱۱ رقم و با 09 شروع شود.');
      const idField = BNM_ID_RULES[real].field;
      if (isNew) {
        if (!bnm_txt_(record.password)) throw new Error('رمز عبور برای حساب جدید الزامی است.');
        p[idField] = bnmNextId_(real);
        if (!p.hireDate) p.hireDate = bnm_today_();
      } else {
        const old = bnmAssertRow_(real, record.rowIndex, s);
        p[idField] = bnm_txt_(old[idField]);
        if (!bnm_txt_(record.password)) delete p.password;
      }
      const dup = bnm_read_(real).find(r => bnm_txt_(r.username).toLowerCase() === bnm_txt_(p.username).toLowerCase() &&
        Number(r._rowIndex) !== Number(record.rowIndex));
      if (dup) throw new Error('این نام کاربری قبلاً ثبت شده است.');
      if (p.groupId && !sc.gids[bnm_txt_(p.groupId)]) throw new Error('گروه انتخاب‌شده متعلق به شعبه شما نیست.');
    }
    if (!p.status) p.status = real === 'tasks' ? 'جدید' : 'فعال';

    let rowIndex;
    if (isNew) rowIndex = scAppend_(real, p);
    else { bnmAssertRow_(real, record.rowIndex, s); rowIndex = Number(record.rowIndex); scUpdate_(real, rowIndex, p); }
    bnm_log_(s, (isNew?'افزودن ':'ویرایش ') + entity, p.taskId || p.groupId || p.empId || p.workerId || ('ردیف '+rowIndex), 'success');
    bnm_cache_();
    return { success:true, rowIndex, id:p.taskId || p.groupId || p.empId || p.workerId || '' };
  } finally { lock.releaseLock(); }
}
function bnmCCBulkStatus(entity, ids, status, token) {
  const s = bnmPerm_(token, 'canEdit'), lock = bnm_lock_();
  try {
    (ids || []).forEach(i => { bnmAssertRow_(entity, i, s); scUpdate_(bnm_entity_(entity), Number(i), { status }); });
    bnm_log_(s, 'تغییر وضعیت گروهی', entity + ' → ' + status + ' (' + (ids||[]).length + ')', 'success');
    bnm_cache_();
    return { success:true, count:(ids||[]).length };
  } finally { lock.releaseLock(); }
}

/* ==================== حذف با بازگردانی ==================== */
function bnmTrashSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(BNM_TRASH);
  if (!sh) { sh = ss.insertSheet(BNM_TRASH); sh.getRange(1,1,1,6).setValues([['Token','CreatedAt','ExpiresAt','ChunkIndex','ChunkCount','Payload']]); sh.setFrozenRows(1); }
  return sh;
}
function bnmCCDelete(parts, token) {
  const s = bnmPerm_(token, 'canDelete'), lock = bnm_lock_();
  try {
    const t = 'BNMTRASH-' + Utilities.getUuid();
    const trash = { at:new Date().toISOString(), branchId:s.branchId, parts:[] };
    (parts || []).forEach(part => {
      const real = bnm_entity_(part.entity);
      const sh = schemaSheetObj_(real), headers = schemaHeaders_(real);
      const idx = Array.from(new Set((part.ids||[]).map(Number).filter(n => n >= 2))).sort((a,b) => a-b);
      idx.forEach(i => { bnmAssertRow_(real, i, s); trash.parts.push({ entity:real, index:i, headers, values:sh.getRange(i,1,1,headers.length).getValues()[0] }); });
      idx.slice().sort((a,b) => b-a).forEach(i => sh.deleteRow(i));
    });
    const payload = JSON.stringify(trash);
    const chunks = payload.match(/[\s\S]{1,40000}/g) || [];
    const ts = bnmTrashSheet_(), now = new Date(), exp = new Date(Date.now() + 7*864e5);
    chunks.forEach((c,i) => ts.appendRow([t, now, exp, i, chunks.length, c]));
    bnm_log_(s, 'حذف', t + ' | ' + trash.parts.length + ' ردیف', 'success');
    bnm_cache_();
    return { success:true, trashToken:t, count:trash.parts.length };
  } finally { lock.releaseLock(); }
}
function bnmCCRestore(trashToken, token) {
  const s = bnmPerm_(token, 'canDelete'), lock = bnm_lock_();
  try {
    const sh = bnmTrashSheet_();
    if (sh.getLastRow() < 2) throw new Error('موردی برای بازگردانی نیست.');
    const rows = sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
    const parts = [], del = [];
    rows.forEach((r,i) => { if (bnm_txt_(r[0]) === bnm_txt_(trashToken)) { parts.push({ idx:Number(r[3]), payload:bnm_txt_(r[5]) }); del.push(i+2); } });
    if (!parts.length) throw new Error('توکن بازگردانی معتبر نیست.');
    const trash = JSON.parse(parts.sort((a,b) => a.idx-b.idx).map(p => p.payload).join(''));
    if (trash.branchId !== s.branchId) throw new Error('این حذف متعلق به شعبه شما نیست.');
    trash.parts.sort((a,b) => a.index-b.index).forEach(p => {
      const info = { sh:schemaSheetObj_(p.entity), headers:schemaHeaders_(p.entity) };
      const row = info.headers.map(h => { const i = p.headers.indexOf(h); return i >= 0 ? p.values[i] : ''; });
      info.sh.getRange(info.sh.getLastRow()+1,1,1,info.headers.length).setValues([row]);
    });
    del.sort((a,b) => b-a).forEach(r => sh.deleteRow(r));
    bnm_log_(s, 'بازگردانی حذف', trashToken, 'success');
    bnm_cache_();
    return { success:true, count:trash.parts.length };
  } finally { lock.releaseLock(); }
}

/* ==================== کارت / سفارش ==================== */
function bnmCCConvertOrder(requestId, groupId, workerId, token) {
  return branchManagerConvertOrderToCard(requestId, groupId, workerId, token);
}
function branchManagerConvertOrderToCard(requestId, groupId, workerId, token) {
  const s = bnmPerm_(token, 'canEdit'), lock = bnm_lock_();
  try {
    const sc = bnmScope_(s.branchId);
    const order = sc.orders.find(r => bnm_txt_(r.requestId) === bnm_txt_(requestId));
    if (!order) throw new Error('سفارش یافت نشد یا متعلق به شعبه شما نیست.');
    if (sc.cards.some(c => bnm_txt_(c.requestId) === bnm_txt_(requestId))) throw new Error('این سفارش قبلاً کارت شده است.');
    const group = sc.groups.find(g => bnm_txt_(g.groupId) === bnm_txt_(groupId));
    if (!group) throw new Error('گروه انتخاب‌شده متعلق به شعبه شما نیست.');
    if (workerId) {
      const w = bnm_read_('workers').find(x => bnm_txt_(x.workerId) === bnm_txt_(workerId));
      if (!w || bnm_txt_(w.branchId) !== s.branchId) throw new Error('نیروی انتخاب‌شده متعلق به شعبه شما نیست.');
      const member = bnm_read_('groupMembers').some(m => bnm_txt_(m.groupId) === bnm_txt_(groupId) &&
        (bnm_txt_(m.workerId) === bnm_txt_(workerId) || bnm_txt_(m.username) === bnm_txt_(w.username)));
      if (!member) throw new Error('نیروی انتخاب‌شده عضو این گروه نیست.');
    }
    const cardId = 'CRD-' + Date.now().toString(36).toUpperCase();
    const status = workerId ? 'تخصیص به کارگر' : 'تخصیص به گروه';
    scAppend_('cards', {
      cardId, requestId:bnm_txt_(requestId), listId:'', customerId:bnm_txt_(order.customerId),
      branchId:s.branchId, verifier:s.username, workerId:bnm_txt_(workerId),
      customerName:bnm_name_(order), serviceType:bnm_txt_(order.service),
      actionType:bnm_txt_(order.actionType) || 'عادی', total:bnm_num_(order.finalPrice),
      execDate:order.execDate, execTime:bnm_txt_(order.execTime), contact:bnm_txt_(order.contact),
      address:bnm_txt_(order.addrFrom) || bnm_txt_(order.addrTo),
      details:bnm_txt_(order.service) + (bnm_txt_(order.sideServices) ? ' + ' + bnm_txt_(order.sideServices) : ''),
      description:bnm_txt_(order.notes), status, createdAt:new Date(), updatedAt:new Date()
    });
    scAppend_('cardHistory', { cardId, from:'', to:status, userId:s.bnmId || s.username, date:new Date(), desc:'ایجاد از سفارش ' + requestId + ' · گروه ' + bnm_txt_(group.name) });
    scUpdate_('orders', order._rowIndex, { status:'تبدیل به کارت', groupId:bnm_txt_(groupId) });
    if (workerId) { try { bnmNotifyWorker_(workerId, cardId, order); } catch (e) {} }
    bnm_log_(s, 'تبدیل سفارش به کارت', cardId + ' ← ' + requestId, 'success');
    bnm_cache_();
    return { success:true, cardId, message:'کارت ایجاد و تخصیص داده شد.' };
  } finally { lock.releaseLock(); }
}
function bnmNotifyWorker_(workerId, cardId, order) {
  if (typeof notifyWorkerCardAssigned === 'function') {
    const w = bnm_read_('workers').find(x => bnm_txt_(x.workerId) === bnm_txt_(workerId));
    if (w && bnm_txt_(w.contact)) notifyWorkerCardAssigned(bnm_txt_(w.contact), {
      cardId, customerName:bnm_name_(order), service:bnm_txt_(order.service), amount:bnm_num_(order.finalPrice),
      execDate:bnm_dateKey_(order.execDate), execTime:bnm_txt_(order.execTime) });
    return;
  }
  const w = bnm_read_('workers').find(x => bnm_txt_(x.workerId) === bnm_txt_(workerId));
  if (!w || !bnm_txt_(w.contact)) return;
  let phone = String(bnm_txt_(w.contact)).replace(/\D/g,'');
  if (phone.indexOf('0') === 0) phone = '98' + phone.substring(1);
  const key = getSetting_('BALE_API_ACCESS_KEY',''), bot = Number(getSetting_('BALE_WORKER_BOT_ID','0'));
  if (!key || !bot) return;
  UrlFetchApp.fetch('https://safir.bale.ai/api/v3/send_message', {
    method:'post', contentType:'application/json', headers:{ 'api-access-key':key }, muteHttpExceptions:true,
    payload: JSON.stringify({ request_id:'bnm-assign-'+Date.now(), bot_id:bot, phone_number:phone,
      message_data:{ message:{ text:'🎫 <b>کارت جدید به شما تخصیص یافت</b>\n🆔 کارت: <code>'+cardId+'</code>\n👤 مشتری: '+bnm_name_(order)+'\n🛠 خدمت: '+bnm_txt_(order.service) } } })
  });
}
function bnmCCCardStatus(cardId, status, workerId, token) { return updateBranchManagerCardStatus(cardId, status, workerId, token); }
function updateBranchManagerCardStatus(cardId, newStatus, workerId, token) {
  const s = bnmPerm_(token, 'canEdit'), lock = bnm_lock_();
  try {
    const card = bnm_read_('cards').find(c => bnm_txt_(c.cardId) === bnm_txt_(cardId) && bnm_txt_(c.branchId) === s.branchId);
    if (!card) throw new Error('کارت یافت نشد یا متعلق به شعبه شما نیست.');
    if (BNM_CARD_STATUSES.indexOf(String(newStatus)) < 0) throw new Error('وضعیت معتبر نیست.');
    const payload = { status:newStatus, updatedAt:new Date() };
    if (workerId) {
      const w = bnm_read_('workers').find(x => bnm_txt_(x.workerId) === bnm_txt_(workerId) && bnm_txt_(x.branchId) === s.branchId);
      if (!w) throw new Error('نیروی انتخاب‌شده متعلق به شعبه شما نیست.');
      payload.workerId = bnm_txt_(workerId);
    } else if (workerId === '' && String(newStatus) === 'تخصیص به گروه') payload.workerId = '';
    scUpdate_('cards', card._rowIndex, payload);
    scAppend_('cardHistory', { cardId:bnm_txt_(cardId), from:bnm_txt_(card.status), to:newStatus,
      userId:s.bnmId || s.username, date:new Date(), desc: workerId ? ('اجراکننده: ' + workerId) : '' });
    const order = bnm_read_('orders').find(o => bnm_txt_(o.requestId) === bnm_txt_(card.requestId));
    if (order && ['تکمیل شده','لغو شده','در حال انجام'].indexOf(newStatus) >= 0) scUpdate_('orders', order._rowIndex, { status:newStatus });
    if (workerId) { try { bnmNotifyWorker_(workerId, cardId, order || card); } catch (e) {} }
    bnm_log_(s, 'تغییر وضعیت کارت', cardId + ': ' + card.status + ' → ' + newStatus, 'success');
    bnm_cache_();
    return { success:true };
  } finally { lock.releaseLock(); }
}
function updateBranchManagerOrderStatus(requestId, newStatus, token) {
  const s = bnmPerm_(token, 'canEdit'), lock = bnm_lock_();
  try {
    if (BNM_ORDER_STATUSES.indexOf(String(newStatus)) < 0) throw new Error('وضعیت معتبر نیست.');
    const order = bnm_read_('orders').find(r => bnm_txt_(r.requestId) === bnm_txt_(requestId) && bnm_txt_(r.branchId) === s.branchId);
    if (!order) throw new Error('سفارش یافت نشد یا متعلق به شعبه شما نیست.');
    scUpdate_('orders', order._rowIndex, { status:newStatus });
    const card = bnm_read_('cards').find(c => bnm_txt_(c.requestId) === bnm_txt_(requestId));
    if (card && ['تکمیل شده','لغو شده','در حال انجام'].indexOf(newStatus) >= 0) {
      scUpdate_('cards', card._rowIndex, { status:newStatus, updatedAt:new Date() });
      scAppend_('cardHistory', { cardId:bnm_txt_(card.cardId), from:bnm_txt_(card.status), to:newStatus, userId:s.bnmId || s.username, date:new Date(), desc:'همگام با سفارش' });
    }
    bnm_log_(s, 'تغییر وضعیت سفارش', requestId + ' → ' + newStatus, 'success');
    bnm_cache_();
    return { success:true, message:'وضعیت تغییر یافت.' };
  } finally { lock.releaseLock(); }
}
function bnmCCBulkOrderStatus(requestIds, status, token) {
  const s = bnmPerm_(token, 'canEdit'), lock = bnm_lock_();
  try {
    if (BNM_ORDER_STATUSES.indexOf(String(status)) < 0) throw new Error('وضعیت معتبر نیست.');
    let n = 0;
    (requestIds || []).forEach(id => {
      const o = bnm_read_('orders').find(r => bnm_txt_(r.requestId) === bnm_txt_(id) && bnm_txt_(r.branchId) === s.branchId);
      if (o) { scUpdate_('orders', o._rowIndex, { status }); n++; }
    });
    bnm_log_(s, 'تغییر وضعیت گروهی سفارش', status + ' (' + n + ')', 'success');
    bnm_cache_();
    return { success:true, count:n };
  } finally { lock.releaseLock(); }
}

/* ==================== در حال توسعه ==================== */
function bnmCCSoonRequest(kind, note, token) {
  const s = bnmPerm_(token, 'canEdit');
  const name = BNM_SOON_FA[bnm_txt_(kind)] || 'ماژول جدید';
  const body = 'شعبه: ' + s.branchId + '\nدرخواست‌کننده: ' + (s.name || s.username) +
    '\nماژول: ' + name + '\n\n' + (bnm_txt_(note) || 'لطفاً هنگام فعال‌سازی این بخش، شعبه ما را مطلع کنید.');
  return bnmCCMessageCreate({ channel:BNM_CH_ADM, subject:'درخواست توسعه — ' + name, body:body, priority:'عادی' }, token);
}

/* ==================== نماها / خروجی / سلامت ==================== */
function bnmCCViews_(username) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BNM_VIEWS_' + username) || '{}'); } catch (e) { return {}; } }
function bnmCCSaveView(page, name, state, token) {
  const s = checkBranchManagerAuth(token), v = bnmCCViews_(s.username);
  v[page] = v[page] || [];
  const id = 'VIEW-' + Utilities.getUuid().slice(0,8);
  v[page].push({ id, name:bnm_txt_(name), state:state || {} });
  PropertiesService.getScriptProperties().setProperty('BNM_VIEWS_' + s.username, JSON.stringify(v));
  return { success:true, id };
}
function bnmCCDeleteView(page, viewId, token) {
  const s = checkBranchManagerAuth(token), v = bnmCCViews_(s.username);
  v[page] = (v[page] || []).filter(x => x.id !== viewId);
  PropertiesService.getScriptProperties().setProperty('BNM_VIEWS_' + s.username, JSON.stringify(v));
  return { success:true };
}
function bnmCCExportCSV(entity, token) {
  const s = checkBranchManagerAuth(token), D = bnmCCData_(s);
  const rows = D[entity] || [];
  if (!rows.length) return '\uFEFF' + 'داده‌ای موجود نیست';
  const cols = Object.keys(rows[0]).filter(k => k !== 'rowIndex' && k !== '_raw');
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
  const lines = [cols.map(q).join(',')];
  rows.forEach(r => lines.push(cols.map(c => q(r[c])).join(',')));
  bnm_log_(s, 'خروجی CSV', entity + ' (' + rows.length + ')', 'success');
  return '\uFEFF' + lines.join('\n');
}
function bnmCCSystemHealth(token) {
  const s = checkBranchManagerAuth(token), D = bnmCCData_(s);
  const counts = {};
  ['orders','cards','cardHistory','employees','workers','groups','members','tasks','customers','applicants','support','threads','adminSupport']
    .forEach(k => counts[k] = (D[k] || []).length);
  return { success:true, version:BNM_VERSION, branch:D.branch, counts, messaging:D.messageStats,
    nextIds:D.nextIds, time:new Date().toISOString() };
}
function bnmCCPing() {
  const need = ['branchManagerLogin','branchManagerLogout','checkBranchManagerAuth','bnmCCSession','bnmCCBootstrap',
    'bnmCCSave','bnmCCDelete','bnmCCRestore','bnmCCBulkStatus','bnmCCBulkOrderStatus','bnmCCConvertOrder','bnmCCCardStatus',
    'bnmCCMessages','bnmCCMessageGet','bnmCCMessageReply','bnmCCMessageCreate','bnmCCMessageStatus','bnmCCMessageUnread',
    'bnmCCEnsureMessaging','bnmCCApplicants','bnmCCApplicantStatus','bnmCCHireApplicant','bnmCCSoonRequest',
    'bnmCCSaveView','bnmCCDeleteView','bnmCCExportCSV','bnmCCSystemHealth','bnmCCPhotoTarget','bnmCCUploadPhoto',
    'getBranchManagerDashboard','getBranchManagerOrders','getBranchManagerCards','getBranchManagerReports',
    'getGroupsForDropdown','getWorkersByGroup','getBranchManagerProfile','updateBranchManagerProfile'];
  const missing = need.filter(n => typeof globalThis[n] !== 'function');
  return { ok:!missing.length, version:BNM_VERSION, missing, time:new Date().toISOString() };
}

/* ==================== عکس پروفایل ==================== */
function bnmCCPhotoTarget(target, token) {
  const s = checkBranchManagerAuth(token);
  s.photoTarget = target && target.entity ? target : null;
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(s));
  return { success:true };
}
function bnmCCUploadPhoto(dataUrl, token) {
  const s = checkBranchManagerAuth(token);
  if (typeof storeProfilePhoto_ !== 'function') throw new Error('ماژول عکس پروفایل (ProfileCode.gs) در پروژه نصب نیست.');
  const t = s.photoTarget;
  let entity, id, username;
  if (t && t.entity) {
    entity = bnm_entity_(t.entity);
    const row = bnm_read_(entity).find(r => bnm_txt_(r[entity === 'employees' ? 'empId' : 'workerId']) === bnm_txt_(t.id));
    if (!row || bnm_txt_(row.branchId) !== s.branchId) throw new Error('این کاربر متعلق به شعبه شما نیست.');
    id = t.id; username = t.username || bnm_txt_(row.username);
  } else { entity = 'branchManagers'; id = s.bnmId; username = s.username; }
  const res = storeProfilePhoto_(entity, id, username || '', dataUrl);
  if (!t) s.avatar = res.url;
  s.photoTarget = null;
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(s));
  bnm_log_(s, 'بارگذاری عکس پروفایل', entity + ' · ' + id, 'success');
  bnm_cache_();
  return { success:true, url:res.url };
}

/* ==================== سازگاری با API نسخه قبل ==================== */
function getBranchManagerDashboard(token) {
  const s = checkBranchManagerAuth(token), sc = bnmScope_(s.branchId);
  return {
    totalOrders:sc.orders.length,
    pendingOrders:sc.orders.filter(r => /جدید|ثبت اولیه/.test(bnm_txt_(r.status))).length,
    completedOrders:sc.orders.filter(r => /تکمیل/.test(bnm_txt_(r.status))).length,
    totalRevenue:sc.orders.reduce((a,r) => a + bnm_num_(r.finalPrice), 0),
    activeCards:sc.cards.filter(r => !/تکمیل|لغو/.test(bnm_txt_(r.status))).length
  };
}
function getBranchManagerOrders(filters, token) {
  const s = checkBranchManagerAuth(token), D = bnmCCData_(s), f = filters || {};
  let rows = D.orders.slice();
  const fk = f.fromDate ? bnm_dateKey_(f.fromDate) : '', tk = f.toDate ? bnm_dateKey_(f.toDate) : '';
  if (fk) rows = rows.filter(r => bnm_dateKey_(r.createdAt) >= fk);
  if (tk) rows = rows.filter(r => bnm_dateKey_(r.createdAt) <= tk);
  if (f.customerId) rows = rows.filter(r => r.customerId.toLowerCase().indexOf(String(f.customerId).toLowerCase()) >= 0);
  if (f.requestId) rows = rows.filter(r => r.requestId.toLowerCase().indexOf(String(f.requestId).toLowerCase()) >= 0);
  if (f.groupId) rows = rows.filter(r => r.groupId === bnm_txt_(f.groupId));
  if (f.status && f.status !== 'همه') rows = rows.filter(r => r.status === f.status);
  const gm = {}; D.groups.forEach(g => gm[g.groupId] = g.name);
  return rows.map(r => ({
    rowIndex:r.rowIndex, requestId:r.requestId, date:r.createdAt, customer:r.customerName, phone:r.phone,
    service:r.service, status:r.status, finalPrice:r.finalPrice, execDate:r.execDate,
    groupId:r.groupId, groupName:gm[r.groupId] || '—', operatorId:r.operator, operatorName:r.verifier || r.operator || 'مشتری'
  }));
}
function getBranchManagerCards(filters, token) {
  const s = checkBranchManagerAuth(token), D = bnmCCData_(s), f = filters || {};
  let rows = D.cards.slice();
  const fk = f.fromDate ? bnm_dateKey_(f.fromDate) : '', tk = f.toDate ? bnm_dateKey_(f.toDate) : '';
  if (fk) rows = rows.filter(r => bnm_dateKey_(r.createdAt) >= fk);
  if (tk) rows = rows.filter(r => bnm_dateKey_(r.createdAt) <= tk);
  if (f.cardId) rows = rows.filter(r => r.cardId.toLowerCase().indexOf(String(f.cardId).toLowerCase()) >= 0);
  if (f.customerId) rows = rows.filter(r => r.customerId.toLowerCase().indexOf(String(f.customerId).toLowerCase()) >= 0);
  if (f.groupId) rows = rows.filter(r => r.groupId === bnm_txt_(f.groupId));
  if (f.status && f.status !== 'همه') rows = rows.filter(r => r.status === f.status);
  const wm = {}; D.workers.forEach(w => wm[w.workerId] = (w.firstName+' '+w.lastName).trim());
  const gm = {}; D.groups.forEach(g => gm[g.groupId] = g.name);
  return rows.map(r => ({
    rowIndex:r.rowIndex, cardId:r.cardId, requestId:r.requestId, customer:r.customerName,
    details:r.details || r.service, amount:r.amount, worker:wm[r.workerId] || '—', workerName:wm[r.workerId] || '—',
    groupName:gm[r.groupId] || '—', status:r.status, execDate:r.execDate, execTime:r.execTime
  }));
}
function getBranchManagerEmployees(token) {
  const s = checkBranchManagerAuth(token);
  return bnmCCData_(s).employees.map(e => ({ rowIndex:e.rowIndex, empId:e.empId,
    fullName:(e.firstName+' '+e.lastName).trim(), username:e.username, jobTitle:e.jobTitle,
    phone:e.contact, status:e.status, avatar:e.photo }));
}
function saveBranchManagerEmployee(data, token) { return bnmCCSave('employees', data || {}, token); }
function deleteBranchManagerEmployee(rowIndex, token) { return bnmCCDelete([{ entity:'employees', ids:[rowIndex] }], token); }
function getBranchManagerGroups(token) { return bnmCCData_(token && checkBranchManagerAuth(token)).groups; }
function saveBranchManagerGroup(data, token) { return bnmCCSave('groups', data || {}, token); }
function deleteBranchManagerGroup(rowIndex, token) { return bnmCCDelete([{ entity:'groups', ids:[rowIndex] }], token); }
function getBranchManagerWorkers(token) { return bnmCCData_(checkBranchManagerAuth(token)).workers; }
function saveBranchManagerWorker(data, token) { return bnmCCSave('workers', data || {}, token); }
function deleteBranchManagerWorker(rowIndex, token) { return bnmCCDelete([{ entity:'workers', ids:[rowIndex] }], token); }
function getGroupsForDropdown(token) {
  const s = checkBranchManagerAuth(token);
  return bnmScope_(s.branchId).groups.filter(g => /^(فعال|active)$/i.test(bnm_txt_(g.status)))
    .map(g => ({ groupId:bnm_txt_(g.groupId), name:bnm_txt_(g.name) }));
}
function getWorkersByGroup(groupId, token) {
  const s = checkBranchManagerAuth(token);
  const g = bnmScope_(s.branchId).groups.find(x => bnm_txt_(x.groupId) === bnm_txt_(groupId));
  if (!g) throw new Error('گروه یافت نشد یا متعلق به شعبه شما نیست.');
  const members = bnm_read_('groupMembers').filter(m => bnm_txt_(m.groupId) === bnm_txt_(groupId) && /^(فعال|active)$/i.test(bnm_txt_(m.status)));
  return bnm_read_('workers').filter(w => bnm_txt_(w.branchId) === s.branchId && /^(فعال|active)$/i.test(bnm_txt_(w.status)) &&
    members.some(m => bnm_txt_(m.workerId) === bnm_txt_(w.workerId) || bnm_txt_(m.username) === bnm_txt_(w.username)))
    .map(w => ({ id:bnm_txt_(w.workerId), name:bnm_name_(w), operations:bnm_txt_(w.operations) }));
}
function getBranchManagerWorkersForDropdown(token) {
  const s = checkBranchManagerAuth(token);
  return bnm_read_('workers').filter(w => bnm_txt_(w.branchId) === s.branchId && /^(فعال|active)$/i.test(bnm_txt_(w.status)))
    .map(w => ({ id:bnm_txt_(w.workerId), name:bnm_name_(w) + ' (' + bnm_txt_(w.operations) + ')', type:bnm_txt_(w.operations) }));
}
function getBranchManagerReports(token, fromDate, toDate) {
  const s = checkBranchManagerAuth(token);
  let rows = bnmCCData_(s).orders;
  const fk = fromDate ? bnm_dateKey_(fromDate) : '', tk = toDate ? bnm_dateKey_(toDate) : '';
  if (fk) rows = rows.filter(r => bnm_dateKey_(r.createdAt) >= fk);
  if (tk) rows = rows.filter(r => bnm_dateKey_(r.createdAt) <= tk);
  return {
    count:rows.length, totalRevenue:rows.reduce((a,r) => a + r.finalPrice, 0),
    byStatus:rows.reduce((m,r) => { const k = r.status || 'نامشخص'; m[k] = (m[k]||0)+1; return m; }, {}),
    transactions:rows.map(r => ({ date:r.createdAt, requestId:r.requestId, service:r.service, amount:r.finalPrice, status:r.status }))
  };
}
function getBranchManagerProfile(token) {
  const s = checkBranchManagerAuth(token);
  const row = bnm_read_('branchManagers').find(r => bnm_txt_(r.bnmId) === s.bnmId) || {};
  const b = bnm_read_('branches').find(x => bnm_txt_(x.branchId) === s.branchId) || {};
  return { bnmId:s.bnmId, name:s.name, username:s.username, role:'مدیر شعبه', branchId:s.branchId,
    branchName:bnm_txt_(b.name) || s.branchId, avatar:bnm_txt_(row.photo) || s.avatar,
    phone:bnm_txt_(row.contact), email:bnm_txt_(row.email), address:bnm_txt_(row.address),
    nationalId:bnm_txt_(row.nationalId), hireDate:bnm_dateKey_(row.hireDate) };
}
function updateBranchManagerProfile(updates, token) {
  const s = checkBranchManagerAuth(token), lock = bnm_lock_();
  try {
    const row = bnm_read_('branchManagers').find(r => bnm_txt_(r.bnmId) === s.bnmId);
    if (!row) throw new Error('رکورد کاربر یافت نشد.');
    const u = updates || {}, p = {};
    if (u.fullName) { const a = String(u.fullName).trim().split(/\s+/); p.firstName = a[0] || ''; p.lastName = a.slice(1).join(' '); }
    ['email','address','nationalId','password'].forEach(k => { if (u[k]) p[k] = u[k]; });
    if (u.phone) p.contact = String(u.phone).replace(/[^\d]/g,'');
    if (u.avatar) p.photo = u.avatar;
    if (Object.keys(p).length) scUpdate_('branchManagers', row._rowIndex, p);
    if (p.firstName || p.lastName) s.name = [p.firstName || row.firstName, p.lastName || row.lastName].filter(Boolean).join(' ');
    if (p.photo) s.avatar = p.photo;
    if (p.contact) s.phone = p.contact;
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(s));
    bnm_log_(s, 'ویرایش پروفایل مدیر شعبه', Object.keys(p).join(', '), 'success');
    bnm_cache_();
    return { success:true };
  } finally { lock.releaseLock(); }
}
