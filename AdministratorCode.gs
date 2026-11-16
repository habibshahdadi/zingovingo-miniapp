/**
 * ═══════════════════════════════════════════════════════════════
 * AdministratorCode.gs — ZingoVingo Command Center Backend V10
 * ═══════════════════════════════════════════════════════════════
 * وابسته به: SchemaCore.gs ، Code.gs ، Job_Application_Form.gs ، ProfileCode.gs
 * اختیاری: PhotoEditor.html
 *
 * تغییرات V9:
 *  • موتور گفتگوی یکپارچه برای سه کانال (سازمانی / مشتری / کارمند)
 *  • پشتیبانی‌ها از «تک‌پاسخ قابل‌بازنویسی» به «رشته‌پیام چندگانه» تبدیل شد
 *  • بخش جدید: پشتیبانی کارکنان (تیکت‌های ارسالی از شعب)
 *  • ستون‌های جدید به‌صورت خودکار و غیرمخرب به شیت‌ها اضافه می‌شوند
 *  • خواندن/نوشتن بر اساس نام هدر (مستقل از ترتیب ستون)
 *  • مهاجرت idempotent داده‌های قدیمی (admCCMigrateMessaging)
 *  • رفع باگ: پرونده کارجو ۳۱ ستونی (قبلاً ۲۸ ستونی خوانده می‌شد)
 *  • رفع باگ: شکستگی رشته در exportOrdersToCSV
 *  • همه نام‌های تابع قبلی حفظ شده‌اند
 * ═══════════════════════════════════════════════════════════════
 */

const ADMINISTRATOR_PERMISSIONS = {
  pages: ['dashboard','orders','cards','planner','tasks','applicants','customers','services','offers',
          'branches','groups','members','employees','workers','bnms','support','threads','adminSupport',
          'reports','logs','settings','profile'],
  canEdit: true, canDelete: true, canManageEmployees: true, canManageSettings: true,
  canViewLogs: true, seeAllOrders: true, scope: 'ALL'
};
const ADMINISTRATOR_ROLES = ['Administrator'];
const ADM_PANEL_ROUTE = {
  'Administrator':'administrator','Manager':'manager','Admin':'admin','Branch Manager':'branch',
  'Employee':'employee','operator':'operator','Supervisor':'supervisor','worker':'worker','Customer':'customer'
};
const ADM_SESSION_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const ADM_CC_TRASH = '__ZV_ADMIN_TRASH__';
const ADM_CARD_STATUSES = ['جدید','تخصیص به شعبه','تخصیص به گروه','تخصیص به کارگر','در حال انجام','تکمیل شده','تعلیق','لغو شده','ارجاع به سرپرست'];
const ADM_ID_RULES = {
  employees:      { field:'empId',    prefix:'EMP', block:'333', pad:8 },
  workers:        { field:'workerId', prefix:'W',   block:'444', pad:8 },
  branchManagers: { field:'bnmId',    prefix:'BNM', block:'222', pad:8 },
  branches:       { field:'branchId', prefix:'BR',  block:'',    pad:3 },
  groups:         { field:'groupId',  prefix:'GRP', block:'',    pad:3 }
};

function admEntity_(e) {
  if (e === 'bnms') return 'branchManagers';
  if (e === 'members') return 'groupMembers';
  return e;
}
function admNextId_(entity) {
  entity = admEntity_(entity);
  const rule = ADM_ID_RULES[entity];
  if (!rule) return '';
  let rows = [];
  try { rows = scRead_(entity); } catch (e) { rows = []; }
  const head = rule.prefix + '-' + rule.block;
  const re = new RegExp('^' + rule.prefix + '-' + rule.block + '(\\d+)$', 'i');
  let max = 0;
  rows.forEach(r => {
    const m = text_(r[rule.field]).match(re);
    if (m) { const n = Number(m[1]); if (n > max) max = n; }
  });
  return head + String(max + 1).padStart(rule.pad, '0');
}
function admCCPeekId(entity, token) {
  checkAdminAuth(token);
  const real = admEntity_(entity);
  if (!ADM_ID_RULES[real]) throw new Error('این موجودیت شناسه خودکار ندارد.');
  return { success:true, id: admNextId_(real) };
}

/* ==================== نشست ==================== */
function adm_normalizeRole_(role) {
  const map = {'admin':'Administrator','administrator':'Administrator','manager':'Manager',
    'website administrator':'Admin','branch manager':'Branch Manager','employee':'Employee',
    'operator':'operator','supervisor':'Supervisor','worker':'worker','customer':'Customer'};
  const k = String(role || '').trim().toLowerCase();
  return map[k] || String(role || '').trim();
}
function adm_key_(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}
function adm_dateKey_(v) {
  if (v == null || v === '') return '';
  const tz = Session.getScriptTimeZone() || 'Asia/Tehran';
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = adm_key_(v).trim();
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y >= 1300 && y <= 1500) { const g = scJ2G_(y, mo, d); return g[0]+'-'+String(g[1]).padStart(2,'0')+'-'+String(g[2]).padStart(2,'0'); }
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  const d2 = new Date(s);
  return isNaN(d2.getTime()) ? '' : Utilities.formatDate(d2, tz, 'yyyy-MM-dd');
}
function adm_iso_(v) { return v instanceof Date && !isNaN(v.getTime()) ? v.toISOString() : (v || ''); }
function adm_name_(r) {
  if (!r) return '';
  return text_(r.fullName) || [text_(r.firstName), text_(r.lastName)].filter(Boolean).join(' ') || text_(r.username);
}
function adm_cityMap_() {
  const m = {};
  scRead_('customers').forEach(c => { m[text_(c.customerId)] = {city:text_(c.city), province:text_(c.province), name:adm_name_(c)}; });
  return m;
}
function logAdminAction_(session, action, details, result) { try { scLog_(session, action, details, result); } catch (e) {} }
function adm_lock_() { const l = LockService.getScriptLock(); l.waitLock(20000); return l; }
function adm_readSession_(token) {
  if (!token) { const e = new Error('نشست یافت نشد.'); e.code = 'NO_SESSION'; throw e; }
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('session_' + token);
  if (!raw) { const e = new Error('نشست منقضی شده است؛ دوباره وارد شوید.'); e.code = 'NO_SESSION'; throw e; }
  let s;
  try { s = JSON.parse(raw); } catch (err) { props.deleteProperty('session_' + token); const e = new Error('نشست نامعتبر است.'); e.code = 'NO_SESSION'; throw e; }
  s.role = adm_normalizeRole_(s.role);
  if (s.exp && Date.now() > s.exp) { props.deleteProperty('session_' + token); const e = new Error('نشست منقضی شده است.'); e.code = 'NO_SESSION'; throw e; }
  s.token = token;
  s.exp = Date.now() + ADM_SESSION_TTL_MS;
  try { props.setProperty('session_' + token, JSON.stringify(s)); } catch (err) {}
  return s;
}
function checkAdminAuth(token) {
  const s = adm_readSession_(token);
  if (ADMINISTRATOR_ROLES.indexOf(s.role) < 0) { const e = new Error('فقط ادمین ارشد دسترسی دارد.'); e.code = 'FORBIDDEN'; throw e; }
  return s;
}
function checkPermission(token, perm) {
  const s = checkAdminAuth(token);
  const p = s.permissions || ADMINISTRATOR_PERMISSIONS;
  if (!p[perm]) { const e = new Error('دسترسی به این بخش را ندارید.'); e.code = 'FORBIDDEN'; throw e; }
  return s;
}
function admCCUser_(s) {
  return {
    name: s.name, role: s.role, roleFa: 'ادمین ارشد', avatar: s.avatar || '', email: s.email || '',
    employeeId: s.empId || s.employeeId || '', username: s.username || '',
    branch: s.branch || '', position: s.position || '', specialty: s.specialty || '',
    permissions: s.permissions || ADMINISTRATOR_PERMISSIONS, expiresAt: s.exp || 0
  };
}
function adminLogin(username, password) {
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '');
  if (!u || !p) throw new Error('نام کاربری و رمز عبور را وارد کنید.');
  const found = scRead_('employees').find(r =>
    (text_(r.username).toLowerCase() === u || text_(r.email).toLowerCase() === u) &&
    text_(r.password) === p && /^(فعال|active)$/i.test(text_(r.status)));
  if (!found) throw new Error('نام کاربری یا رمز عبور اشتباه است، یا حساب غیرفعال است.');
  const role = adm_normalizeRole_(text_(found.operations));
  if (role !== 'Administrator') throw new Error('این حساب ادمین ارشد نیست. پنل شما: ?page=' + (ADM_PANEL_ROUTE[role] || 'landing'));
  const token = Utilities.getUuid();
  const session = {
    token, role, userType:'employee', panel:'administrator', permissions: ADMINISTRATOR_PERMISSIONS,
    username: text_(found.username), email: text_(found.email) || text_(found.username),
    name: adm_name_(found) || text_(found.username),
    empId: text_(found.empId), employeeId: text_(found.empId),
    branch: text_(found.branchId), group: text_(found.groupId),
    position: text_(found.jobTitle), specialty: text_(found.specialization),
    avatar: text_(found.photo), createdAt: new Date().toISOString(),
    exp: Date.now() + ADM_SESSION_TTL_MS
  };
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
  logAdminAction_(session, 'ورود به مرکز مدیریت سامانه', 'نقش: Administrator', 'success');
  return { success:true, token, role, panel:'administrator', user: admCCUser_(session) };
}
function adminLogout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty('session_' + token); } catch (e) {}
  return { success:true };
}
function admCCSession(token) {
  const s = checkAdminAuth(token);
  return { success:true, user: admCCUser_(s) };
}

/* ══════════════════════════════════════════════════════════════
   موتور گفتگوی یکپارچه (خودبسنده)
   سه کانال: INTERNAL / CUSTOMER_SUPPORT / EMPLOYEE_SUPPORT
   ══════════════════════════════════════════════════════════════ */
const ADM_MSG_TH = 'ConversationThreads';
const ADM_MSG_MS = 'ConversationMessages';
const ADM_CH_INTERNAL = 'INTERNAL';
const ADM_CH_CUSTOMER = 'CUSTOMER_SUPPORT';
const ADM_CH_EMPLOYEE = 'EMPLOYEE_SUPPORT';
const ADM_MSG_CHANNELS = [ADM_CH_INTERNAL, ADM_CH_CUSTOMER, ADM_CH_EMPLOYEE];

const ADM_TH_H = [
  'Thread-ID','Card-ID','Worker-ID','WorkerUsername','Supervisor-ID','SupervisorUsername',
  'Group-ID','Branch-ID','Subject','Status','LastMessageAt','LastMessageBy','CreatedAt','UpdatedAt',
  'Channel','TicketNo','OwnerRole','Owner-ID','OwnerUsername','OwnerName',
  'PeerRole','Peer-ID','PeerUsername','Priority','MessageCount','UnreadOwner','UnreadPeer',
  'ClosedAt','ClosedBy','LastMessagePreview','LegacyRef'
];
const ADM_MS_H = [
  'Message-ID','Thread-ID','SenderRole','Sender-ID','SenderUsername','Body','CreatedAt',
  'ReadAt','ReadBy','MessageType','RelatedCard-ID',
  'SenderName','Channel','Branch-ID','Visibility','EditedAt','DeletedAt','Attachments'
];

function admMsgTxt_(v) { try { return text_(v); } catch (e) { return v == null ? '' : String(v).trim(); } }
function admMsgNum_(v) { try { return number_(v); } catch (e) { const n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g,'')); return isFinite(n) ? n : 0; } }
function admMsgIso_(v) {
  if (!v) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}
function admMsgUid_(p) { return p + '-' + Utilities.getUuid().replace(/-/g,'').slice(0,18).toUpperCase(); }

function admMsgHead_(sh) {
  const n = sh.getLastColumn();
  if (n < 1) return [];
  return sh.getRange(1,1,1,n).getDisplayValues()[0].map(x => String(x).trim());
}
function admMsgSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0B1736').setFontColor('#FFFFFF');
    return sh;
  }
  const cur = admMsgHead_(sh);
  if (!cur.some(x => x !== '')) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
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
function admMsgRows_(name, headers) {
  const sh = admMsgSheet_(name, headers);
  if (sh.getLastRow() < 2) return [];
  const head = admMsgHead_(sh);
  const vals = sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  return vals.map((r,i) => { const o = { _row:i+2 }; head.forEach((h,j) => { if (h) o[h] = r[j]; }); return o; });
}
function admMsgAppend_(name, headers, obj) {
  const sh = admMsgSheet_(name, headers);
  const head = admMsgHead_(sh);
  sh.appendRow(head.map(h => obj.hasOwnProperty(h) ? obj[h] : ''));
  return sh.getLastRow();
}
function admMsgPatch_(name, headers, rowIndex, obj) {
  const sh = admMsgSheet_(name, headers);
  const head = admMsgHead_(sh);
  Object.keys(obj).forEach(k => {
    const c = head.indexOf(k);
    if (c >= 0) sh.getRange(rowIndex, c+1).setValue(obj[k]);
  });
}
function admCCEnsureMessaging(token) {
  if (token) checkAdminAuth(token);
  admMsgSheet_(ADM_MSG_TH, ADM_TH_H);
  admMsgSheet_(ADM_MSG_MS, ADM_MS_H);
  return { success:true, message:'ساختار شیت‌های گفتگو آماده است.' };
}

/* ── نرمال‌سازی ── */
function admMsgChannel_(t) { return admMsgTxt_(t.Channel) || ADM_CH_INTERNAL; }
function admMsgOwnerRole_(t) {
  const r = admMsgTxt_(t.OwnerRole);
  if (r) return r;
  const c = admMsgChannel_(t);
  return c === ADM_CH_CUSTOMER ? 'customer' : c === ADM_CH_EMPLOYEE ? 'employee' : 'worker';
}
function admMsgOwnerId_(t)   { return admMsgTxt_(t['Owner-ID']) || admMsgTxt_(t['Worker-ID']); }
function admMsgOwnerUser_(t) { return admMsgTxt_(t.OwnerUsername) || admMsgTxt_(t.WorkerUsername); }
function admMsgOwnerName_(t) { return admMsgTxt_(t.OwnerName) || admMsgOwnerUser_(t) || admMsgOwnerId_(t); }
function admMsgPeerUser_(t)  { return admMsgTxt_(t.PeerUsername) || admMsgTxt_(t.SupervisorUsername); }
function admMsgState_(v) {
  const s = admMsgTxt_(v).toLowerCase();
  if (!s) return 'OPEN';
  if (/closed|بسته/.test(s)) return 'CLOSED';
  if (/answered|پاسخ داده/.test(s)) return 'ANSWERED';
  return 'OPEN';
}
function admMsgStateOut_(ch, v) {
  const s = admMsgState_(v);
  if (ch === ADM_CH_EMPLOYEE) return s === 'CLOSED' ? 'بسته' : s === 'ANSWERED' ? 'پاسخ داده شده' : 'در انتظار پاسخ';
  if (ch === ADM_CH_CUSTOMER) return s === 'CLOSED' ? 'closed' : s === 'ANSWERED' ? 'answered' : 'unread';
  return s;
}
function admMsgGroup_(msgs) {
  const g = {};
  msgs.forEach(m => {
    if (admMsgTxt_(m.DeletedAt)) return;
    const k = admMsgTxt_(m['Thread-ID']);
    (g[k] = g[k] || []).push(m);
  });
  Object.keys(g).forEach(k => g[k].sort((a,b) => String(admMsgIso_(a.CreatedAt)).localeCompare(String(admMsgIso_(b.CreatedAt)))));
  return g;
}
function admMsgMsgView_(m) {
  let att = [];
  try { att = JSON.parse(admMsgTxt_(m.Attachments) || '[]'); } catch (e) { att = []; }
  return {
    messageId: admMsgTxt_(m['Message-ID']), threadId: admMsgTxt_(m['Thread-ID']),
    senderRole: admMsgTxt_(m.SenderRole), senderId: admMsgTxt_(m['Sender-ID']),
    senderUsername: admMsgTxt_(m.SenderUsername), senderName: admMsgTxt_(m.SenderName) || admMsgTxt_(m.SenderUsername),
    body: admMsgTxt_(m.Body), createdAt: admMsgIso_(m.CreatedAt),
    readAt: admMsgIso_(m.ReadAt), readBy: admMsgTxt_(m.ReadBy),
    messageType: admMsgTxt_(m.MessageType) || 'TEXT', visibility: admMsgTxt_(m.Visibility) || 'ALL',
    cardId: admMsgTxt_(m['RelatedCard-ID']), editedAt: admMsgIso_(m.EditedAt), attachments: att
  };
}
/** نمای ادمین: ادمین همیشه طرفِ پاسخ‌دهنده است → unread = UnreadPeer */
function admMsgView_(t, list, bmap) {
  const ch = admMsgChannel_(t), or = admMsgOwnerRole_(t);
  const vis = list || [];
  let lastPublic = null, firstOwner = null, lastStaff = null;
  for (let i = vis.length - 1; i >= 0; i--) { if (admMsgTxt_(vis[i].Visibility) !== 'STAFF') { lastPublic = vis[i]; break; } }
  for (let j = 0; j < vis.length; j++) { if (admMsgTxt_(vis[j].SenderRole) === or) { firstOwner = vis[j]; break; } }
  for (let k = vis.length - 1; k >= 0; k--) {
    const r = admMsgTxt_(vis[k].SenderRole);
    if (r !== or && r !== 'system') { lastStaff = vis[k]; break; }
  }
  const bid = admMsgTxt_(t['Branch-ID']);
  const tid = admMsgTxt_(t['Thread-ID']);
  return {
    threadId: tid, ticketNo: admMsgTxt_(t.TicketNo), channel: ch,
    subject: admMsgTxt_(t.Subject) || 'بدون موضوع',
    state: admMsgState_(t.Status), status: admMsgStateOut_(ch, t.Status),
    priority: admMsgTxt_(t.Priority) || 'عادی',
    branchId: bid, branchName: (bmap && bmap[bid]) || bid || '—',
    groupId: admMsgTxt_(t['Group-ID']), cardId: admMsgTxt_(t['Card-ID']),
    ownerRole: or, ownerId: admMsgOwnerId_(t), ownerUsername: admMsgOwnerUser_(t), ownerName: admMsgOwnerName_(t),
    peerRole: admMsgTxt_(t.PeerRole), peerUsername: admMsgPeerUser_(t),
    messageCount: vis.length, unread: admMsgNum_(t.UnreadPeer),
    preview: admMsgTxt_(t.LastMessagePreview) || (lastPublic ? admMsgTxt_(lastPublic.Body).slice(0,140) : ''),
    lastMessageAt: admMsgIso_(t.LastMessageAt) || (lastPublic ? admMsgIso_(lastPublic.CreatedAt) : admMsgIso_(t.CreatedAt)),
    lastMessageBy: admMsgTxt_(t.LastMessageBy),
    createdAt: admMsgIso_(t.CreatedAt), updatedAt: admMsgIso_(t.UpdatedAt),
    closedAt: admMsgIso_(t.ClosedAt), closedBy: admMsgTxt_(t.ClosedBy),
    /* سازگاری با فرانت قدیمی */
    rowIndex: t._row, id: tid, conversationId: tid,
    customerId: ch === ADM_CH_CUSTOMER ? admMsgOwnerId_(t) : '',
    senderName: admMsgOwnerName_(t), username: admMsgOwnerUser_(t),
    message: firstOwner ? admMsgTxt_(firstOwner.Body) : '',
    body: firstOwner ? admMsgTxt_(firstOwner.Body) : '',
    reply: lastStaff ? admMsgTxt_(lastStaff.Body) : '',
    repliedAt: lastStaff ? admMsgIso_(lastStaff.CreatedAt) : '',
    workerUsername: admMsgTxt_(t.WorkerUsername) || (ch === ADM_CH_INTERNAL ? admMsgOwnerUser_(t) : ''),
    supervisorUsername: admMsgTxt_(t.SupervisorUsername) || (ch === ADM_CH_INTERNAL ? admMsgPeerUser_(t) : ''),
    lastAt: admMsgIso_(t.LastMessageAt), isAdminSide: true
  };
}
function admMsgBranchMap_() {
  const m = {};
  try { scRead_('branches').forEach(b => { m[text_(b.branchId)] = text_(b.name); }); } catch (e) {}
  return m;
}
function admMsgNextTicket_(ch, ths) {
  const p = ch === ADM_CH_CUSTOMER ? 'TC' : ch === ADM_CH_EMPLOYEE ? 'TE' : 'TI';
  const n = ths.filter(t => admMsgChannel_(t) === ch).length + 1;
  return p + '-' + String(n).padStart(6, '0');
}
function admMsgCustBranch_(cid, orders) {
  const id = admMsgTxt_(cid);
  if (!id) return '';
  const os = (orders || scRead_('orders')).filter(o => text_(o.customerId) === id && text_(o.branchId));
  if (os.length) {
    os.sort((a,b) => String(admMsgIso_(b.createdAt)).localeCompare(String(admMsgIso_(a.createdAt))));
    return text_(os[0].branchId);
  }
  const c = scRead_('customers').find(x => text_(x.customerId) === id);
  if (c && text_(c.branchId)) return text_(c.branchId);
  if (c) {
    const bs = scRead_('branches');
    const b = bs.find(x => text_(x.province) === text_(c.province) && text_(x.city) === text_(c.city))
           || bs.find(x => text_(x.province) === text_(c.province));
    if (b) return text_(b.branchId);
  }
  return '';
}
function admMsgCustName_(cid, fallback) {
  const c = scRead_('customers').find(x => text_(x.customerId) === admMsgTxt_(cid));
  if (c) { const n = adm_name_(c); if (n) return n; }
  return admMsgTxt_(fallback) || admMsgTxt_(cid);
}
function admMsgList_(channel, opts) {
  const o = opts || {}, bmap = admMsgBranchMap_();
  const ths = admMsgRows_(ADM_MSG_TH, ADM_TH_H);
  const g = admMsgGroup_(admMsgRows_(ADM_MSG_MS, ADM_MS_H));
  let out = ths.filter(t => {
    if (channel && admMsgChannel_(t) !== channel) return false;
    if (o.branchId && admMsgTxt_(t['Branch-ID']) !== admMsgTxt_(o.branchId)) return false;
    if (o.status && admMsgState_(t.Status) !== admMsgState_(o.status)) return false;
    return true;
  }).map(t => admMsgView_(t, g[admMsgTxt_(t['Thread-ID'])] || [], bmap));

  if (o.unreadOnly) out = out.filter(v => v.unread > 0 && v.state !== 'CLOSED');
  if (o.q) {
    const q = admMsgTxt_(o.q).toLowerCase();
    out = out.filter(v => [v.subject,v.ticketNo,v.ownerName,v.ownerUsername,v.preview,v.threadId,v.cardId,v.branchName]
      .some(x => String(x || '').toLowerCase().indexOf(q) >= 0));
  }
  out.sort((a,b) => String(b.lastMessageAt || b.createdAt).localeCompare(String(a.lastMessageAt || a.createdAt)));
  const lim = Number(o.limit || 0);
  return lim > 0 ? out.slice(Number(o.offset || 0), Number(o.offset || 0) + lim) : out;
}
/** پذیرش Thread-ID، شناسه قدیمی، یا شماره ردیف شیت قدیمی */
function admMsgResolve_(id) {
  const key = admMsgTxt_(id);
  if (!key) throw new Error('شناسه گفتگو مشخص نیست.');
  const ths = admMsgRows_(ADM_MSG_TH, ADM_TH_H);
  let t = ths.find(x => admMsgTxt_(x['Thread-ID']) === key);
  if (!t) t = ths.find(x => { const lr = admMsgTxt_(x.LegacyRef); return lr === 'CC:' + key || lr === 'ES:' + key; });
  if (!t && /^\d+$/.test(key)) {
    const ss = getSpreadsheet_(), n = Number(key);
    let ref = '';
    const csh = ss.getSheetByName('Customer_Conversations');
    if (csh && n >= 2 && n <= csh.getLastRow()) ref = 'CC:' + admMsgTxt_(csh.getRange(n,1).getValue());
    if (ref.length <= 3) {
      const esh = ss.getSheetByName('Employee_Support');
      if (esh && n >= 2 && n <= esh.getLastRow()) ref = 'ES:' + admMsgTxt_(esh.getRange(n,1).getValue());
    }
    if (ref.length > 3) t = ths.find(x => admMsgTxt_(x.LegacyRef) === ref);
  }
  if (!t) throw new Error('گفتگو یافت نشد. اگر داده قدیمی دارید، یک‌بار admCCMigrateMessaging() را اجرا کنید.');
  return t;
}

/* ── فهرست‌های سه کانال ── */
function admCCReadSupport_()          { try { return admMsgList_(ADM_CH_CUSTOMER); } catch (e) { return []; } }
function admCCReadThreads_()         { try { return admMsgList_(ADM_CH_INTERNAL); } catch (e) { return []; } }
function admCCReadEmployeeSupport_() { try { return admMsgList_(ADM_CH_EMPLOYEE); } catch (e) { return []; } }

/* ── API عمومی گفتگو ── */
function admCCMessages(channel, opts, token) {
  checkAdminAuth(token);
  const items = admMsgList_(admMsgTxt_(channel), opts || {});
  return { success:true, total:items.length, items };
}
function admCCMessageGet(id, token) {
  const s = checkAdminAuth(token);
  const t = admMsgResolve_(id);
  const tid = admMsgTxt_(t['Thread-ID']);
  const all = admMsgRows_(ADM_MSG_MS, ADM_MS_H)
    .filter(m => admMsgTxt_(m['Thread-ID']) === tid && !admMsgTxt_(m.DeletedAt));
  all.sort((a,b) => String(admMsgIso_(a.CreatedAt)).localeCompare(String(admMsgIso_(b.CreatedAt))));
  const now = new Date(), who = admMsgTxt_(s.username || 'admin');
  all.forEach(m => {
    if (admMsgTxt_(m.SenderRole) !== 'admin' && !admMsgTxt_(m.ReadAt)) {
      admMsgPatch_(ADM_MSG_MS, ADM_MS_H, m._row, { ReadAt: now, ReadBy: who });
      m.ReadAt = now; m.ReadBy = who;
    }
  });
  admMsgPatch_(ADM_MSG_TH, ADM_TH_H, t._row, { UnreadPeer: 0 });
  t.UnreadPeer = 0;
  return { success:true, thread: admMsgView_(t, all, admMsgBranchMap_()), messages: all.map(admMsgMsgView_) };
}
function admCCMessageReply(id, body, opts, token) {
  const s = checkPermission(token, 'canEdit');
  const o = opts || {}, txt = admMsgTxt_(body);
  if (!txt) throw new Error('متن پیام الزامی است.');
  const lock = adm_lock_();
  try {
    const t = admMsgResolve_(id);
    const tid = admMsgTxt_(t['Thread-ID']), ch = admMsgChannel_(t);
    const vis = (o.internalNote && ch !== ADM_CH_EMPLOYEE) ? 'STAFF' : 'ALL';
    const now = new Date(), who = admMsgTxt_(s.username || 'admin');
    const count = admMsgRows_(ADM_MSG_MS, ADM_MS_H)
      .filter(m => admMsgTxt_(m['Thread-ID']) === tid && !admMsgTxt_(m.DeletedAt)).length + 1;

    admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
      'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid,
      SenderRole:'admin', 'Sender-ID': admMsgTxt_(s.empId || s.employeeId),
      SenderUsername: who, SenderName: admMsgTxt_(s.name) || 'پشتیبانی سامانه',
      Body: txt, CreatedAt: now, MessageType: vis === 'STAFF' ? 'NOTE' : 'TEXT',
      'RelatedCard-ID': admMsgTxt_(t['Card-ID']), Channel: ch, 'Branch-ID': admMsgTxt_(t['Branch-ID']),
      Visibility: vis, Attachments: JSON.stringify(o.attachments || [])
    });

    const patch = {
      UpdatedAt: now, LastMessageAt: now, LastMessageBy: who,
      LastMessagePreview: vis === 'STAFF' ? '🔒 یادداشت داخلی' : txt.slice(0,140),
      MessageCount: count,
      UnreadOwner: admMsgNum_(t.UnreadOwner) + (vis === 'ALL' ? 1 : 0),
      UnreadPeer: 0
    };
    if (ch !== ADM_CH_INTERNAL) {
      patch.PeerRole = 'admin'; patch.PeerUsername = who;
      patch['Peer-ID'] = admMsgTxt_(s.empId || s.employeeId);
    }
    if (admMsgState_(t.Status) !== 'CLOSED') patch.Status = 'ANSWERED';
    admMsgPatch_(ADM_MSG_TH, ADM_TH_H, t._row, patch);
    logAdminAction_(s, 'پاسخ در گفتگو', (admMsgTxt_(t.TicketNo) || tid) + ' · ' + ch, 'success');
    schemaInvalidate_();
    return { success:true, threadId: tid, state: patch.Status || admMsgState_(t.Status), message:'پاسخ ثبت شد.' };
  } finally { lock.releaseLock(); }
}
function admCCMessageStatus(id, state, token) {
  const s = checkPermission(token, 'canEdit');
  const st = admMsgState_(state);
  const lock = adm_lock_();
  try {
    const t = admMsgResolve_(id), tid = admMsgTxt_(t['Thread-ID']), now = new Date();
    const patch = { Status: st, UpdatedAt: now };
    if (st === 'CLOSED') { patch.ClosedAt = now; patch.ClosedBy = admMsgTxt_(s.username || 'admin'); }
    else { patch.ClosedAt = ''; patch.ClosedBy = ''; }
    admMsgPatch_(ADM_MSG_TH, ADM_TH_H, t._row, patch);
    admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
      'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid, SenderRole:'system',
      'Sender-ID': admMsgTxt_(s.empId || s.employeeId), SenderUsername: admMsgTxt_(s.username || 'admin'),
      SenderName: admMsgTxt_(s.name) || 'سامانه',
      Body: st === 'CLOSED' ? 'گفتگو توسط پشتیبانی بسته شد.' : st === 'ANSWERED' ? 'وضعیت: پاسخ داده شده.' : 'گفتگو باز شد.',
      CreatedAt: now, MessageType:'SYSTEM', Channel: admMsgChannel_(t),
      'Branch-ID': admMsgTxt_(t['Branch-ID']), Visibility:'ALL'
    });
    logAdminAction_(s, 'تغییر وضعیت گفتگو', (admMsgTxt_(t.TicketNo) || tid) + ' → ' + st, 'success');
    return { success:true, state: st };
  } finally { lock.releaseLock(); }
}
function admCCMessageCreate(payload, token) {
  const s = checkPermission(token, 'canEdit');
  const p = payload || {}, body = admMsgTxt_(p.body);
  if (!body) throw new Error('متن پیام الزامی است.');
  const ch = admMsgTxt_(p.channel) || ADM_CH_INTERNAL;
  if (ADM_MSG_CHANNELS.indexOf(ch) < 0) throw new Error('کانال گفتگو معتبر نیست.');
  const lock = adm_lock_();
  try {
    const ths = admMsgRows_(ADM_MSG_TH, ADM_TH_H);
    const now = new Date(), tid = admMsgUid_('THR'), who = admMsgTxt_(s.username || 'admin');
    const th = {
      'Thread-ID': tid, Channel: ch, TicketNo: admMsgNextTicket_(ch, ths),
      Subject: admMsgTxt_(p.subject) || 'بدون موضوع', Status:'OPEN',
      Priority: admMsgTxt_(p.priority) || 'عادی',
      CreatedAt: now, UpdatedAt: now, LastMessageAt: now, LastMessageBy: who,
      LastMessagePreview: body.slice(0,140), MessageCount: 1, UnreadOwner: 1, UnreadPeer: 0,
      'Card-ID': admMsgTxt_(p.cardId),
      PeerRole:'admin', PeerUsername: who, 'Peer-ID': admMsgTxt_(s.empId || s.employeeId)
    };

    if (ch === ADM_CH_INTERNAL) {
      const card = scRead_('cards').find(c => text_(c.cardId) === admMsgTxt_(p.cardId));
      if (!card) throw new Error('کارت انتخاب‌شده معتبر نیست.');
      const ws = scRead_('workers');
      const w = ws.find(x => text_(x.workerId) === text_(card.workerId)) || {};
      const g = scRead_('groups').find(x => text_(x.groupId) === text_(w.groupId)) || {};
      const sup = ws.find(x =>
        (text_(g.supervisorName) && text_(x.username) === text_(g.supervisorName)) ||
        (text_(g.workerId) && text_(x.workerId) === text_(g.workerId))) || {};
      th['Branch-ID'] = text_(card.branchId);
      th.OwnerRole = 'worker'; th['Owner-ID'] = text_(w.workerId);
      th.OwnerUsername = text_(w.username); th.OwnerName = adm_name_(w) || text_(w.username);
      th['Worker-ID'] = th['Owner-ID']; th.WorkerUsername = th.OwnerUsername;
      th['Supervisor-ID'] = text_(sup.workerId); th.SupervisorUsername = text_(sup.username);
      th['Group-ID'] = text_(g.groupId); th['Card-ID'] = text_(card.cardId);
      th.PeerRole = 'supervisor'; th.PeerUsername = text_(sup.username); th['Peer-ID'] = text_(sup.workerId);
      if (!admMsgTxt_(p.subject)) th.Subject = 'پیگیری کارت ' + text_(card.cardId);

    } else if (ch === ADM_CH_CUSTOMER) {
      const cid = admMsgTxt_(p.customerId);
      if (!cid) throw new Error('شناسه مشتری الزامی است.');
      const orders = scRead_('orders');
      const cu = scRead_('customers').find(x => text_(x.customerId) === cid);
      th['Branch-ID'] = admMsgCustBranch_(cid, orders) || admMsgTxt_(p.branchId);
      th.OwnerRole = 'customer'; th['Owner-ID'] = cid;
      th.OwnerUsername = cu ? text_(cu.username) : cid;
      th.OwnerName = admMsgCustName_(cid, cu ? adm_name_(cu) : '');

    } else {
      const b = admMsgTxt_(p.branchId);
      if (!b) throw new Error('شعبه مقصد الزامی است.');
      th['Branch-ID'] = b;
      const emp = admMsgTxt_(p.empId)
        ? scRead_('employees').find(x => text_(x.empId) === admMsgTxt_(p.empId)) : null;
      th.OwnerRole = 'employee';
      th['Owner-ID'] = emp ? text_(emp.empId) : '';
      th.OwnerUsername = emp ? text_(emp.username) : '';
      th.OwnerName = emp ? (adm_name_(emp) || text_(emp.username)) : ('کارکنان شعبه ' + b);
    }

    admMsgAppend_(ADM_MSG_TH, ADM_TH_H, th);
    admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
      'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid, SenderRole:'admin',
      'Sender-ID': admMsgTxt_(s.empId || s.employeeId), SenderUsername: who,
      SenderName: admMsgTxt_(s.name) || 'پشتیبانی سامانه',
      Body: body, CreatedAt: now, MessageType:'TEXT',
      'RelatedCard-ID': admMsgTxt_(th['Card-ID']), Channel: ch,
      'Branch-ID': admMsgTxt_(th['Branch-ID']), Visibility:'ALL',
      Attachments: JSON.stringify(p.attachments || [])
    });
    logAdminAction_(s, 'ایجاد گفتگو', th.TicketNo + ' · ' + ch, 'success');
    schemaInvalidate_();
    return { success:true, threadId: tid, ticketNo: th.TicketNo, id: tid };
  } finally { lock.releaseLock(); }
}
function admCCMessageUnread(token) {
  checkAdminAuth(token);
  const o = { success:true, INTERNAL:0, CUSTOMER_SUPPORT:0, EMPLOYEE_SUPPORT:0, total:0 };
  admMsgList_('', {}).forEach(v => {
    if (v.state === 'CLOSED' || v.unread <= 0) return;
    o[v.channel] = (o[v.channel] || 0) + 1; o.total++;
  });
  return o;
}
function admCCMessageEdit(messageId, body, token) {
  const s = checkAdminAuth(token);
  const txt = admMsgTxt_(body);
  if (!txt) throw new Error('متن پیام الزامی است.');
  const m = admMsgRows_(ADM_MSG_MS, ADM_MS_H).find(x => admMsgTxt_(x['Message-ID']) === admMsgTxt_(messageId));
  if (!m) throw new Error('پیام یافت نشد.');
  if (admMsgTxt_(m.SenderRole) !== 'admin') throw new Error('فقط پیام‌های پشتیبانی قابل ویرایش است.');
  admMsgPatch_(ADM_MSG_MS, ADM_MS_H, m._row, { Body: txt, EditedAt: new Date() });
  logAdminAction_(s, 'ویرایش پیام گفتگو', admMsgTxt_(m['Message-ID']), 'success');
  return { success:true };
}
function admCCMessageDelete(messageId, token) {
  const s = checkPermission(token, 'canDelete');
  const m = admMsgRows_(ADM_MSG_MS, ADM_MS_H).find(x => admMsgTxt_(x['Message-ID']) === admMsgTxt_(messageId));
  if (!m) throw new Error('پیام یافت نشد.');
  admMsgPatch_(ADM_MSG_MS, ADM_MS_H, m._row, { DeletedAt: new Date(), Body: '' });
  logAdminAction_(s, 'حذف پیام گفتگو', admMsgTxt_(m['Message-ID']), 'success');
  return { success:true };
}

/* ── سازگاری با نام‌های قبلی ── */
function admCCReplySupport(id, reply, token) { return admCCMessageReply(id, reply, {}, token); }
function admCCGetThread(id, token)           { return admCCMessageGet(id, token); }
function admCCReplyThread(id, body, token)   { return admCCMessageReply(id, body, {}, token); }

/* ── مهاجرت داده‌های قدیمی (یک‌بار اجرا · idempotent) ── */
function admCCMigrateMessaging(token) {
  if (token) checkAdminAuth(token);
  admCCEnsureMessaging();
  const lock = adm_lock_();
  const rep = { internalTagged:0, customerThreads:0, customerMessages:0, employeeThreads:0, employeeMessages:0, skipped:0 };
  try {
    let ths = admMsgRows_(ADM_MSG_TH, ADM_TH_H);
    const refs = {};
    ths.forEach(t => { const r = admMsgTxt_(t.LegacyRef); if (r) refs[r] = true; });

    ths.forEach(t => {
      if (admMsgTxt_(t.Channel)) return;
      admMsgPatch_(ADM_MSG_TH, ADM_TH_H, t._row, {
        Channel: ADM_CH_INTERNAL, TicketNo: admMsgNextTicket_(ADM_CH_INTERNAL, ths),
        OwnerRole:'worker', 'Owner-ID': admMsgTxt_(t['Worker-ID']),
        OwnerUsername: admMsgTxt_(t.WorkerUsername), OwnerName: admMsgTxt_(t.WorkerUsername),
        PeerRole:'supervisor', 'Peer-ID': admMsgTxt_(t['Supervisor-ID']), PeerUsername: admMsgTxt_(t.SupervisorUsername),
        Status: admMsgState_(t.Status), Priority:'عادی'
      });
      rep.internalTagged++;
    });
    admMsgRows_(ADM_MSG_MS, ADM_MS_H).forEach(m => {
      if (admMsgTxt_(m.Channel)) return;
      admMsgPatch_(ADM_MSG_MS, ADM_MS_H, m._row, {
        Channel: ADM_CH_INTERNAL, Visibility:'ALL', SenderName: admMsgTxt_(m.SenderUsername)
      });
    });

    const orders = scRead_('orders');
    const ss = getSpreadsheet_();

    const csh = ss.getSheetByName('Customer_Conversations');
    if (csh && csh.getLastRow() > 1) {
      const cvals = csh.getRange(2,1,csh.getLastRow()-1,Math.max(csh.getLastColumn(),9)).getValues();
      const groups = {};
      cvals.forEach(r => { const id = admMsgTxt_(r[0]); if (id) (groups[id] = groups[id] || []).push(r); });
      Object.keys(groups).forEach(cid => {
        if (refs['CC:' + cid]) { rep.skipped++; return; }
        const rows = groups[cid].sort((x,y) => new Date(x[6]) - new Date(y[6]));
        const first = rows[0];
        const customerId = admMsgTxt_(first[1]);
        const branch = admMsgCustBranch_(customerId, orders);
        const created = first[6] instanceof Date ? first[6] : new Date(first[6]);
        const last = rows[rows.length-1];
        const lastAt = last[6] instanceof Date ? last[6] : new Date(last[6]);
        const replied = rows.some(r => admMsgTxt_(r[8]));
        const tid = admMsgUid_('THR');
        const cur = admMsgRows_(ADM_MSG_TH, ADM_TH_H);
        admMsgAppend_(ADM_MSG_TH, ADM_TH_H, {
          'Thread-ID': tid, Channel: ADM_CH_CUSTOMER, TicketNo: admMsgNextTicket_(ADM_CH_CUSTOMER, cur),
          Subject: admMsgTxt_(first[2]) || 'پشتیبانی مشتری', Status: replied ? 'ANSWERED' : 'OPEN',
          'Branch-ID': branch, OwnerRole:'customer', 'Owner-ID': customerId,
          OwnerUsername: customerId, OwnerName: admMsgCustName_(customerId, admMsgTxt_(first[5])),
          PeerRole:'employee', Priority:'عادی',
          CreatedAt: created, UpdatedAt: lastAt, LastMessageAt: lastAt, LastMessageBy: admMsgTxt_(first[5]),
          LastMessagePreview: admMsgTxt_(last[3]).slice(0,140),
          MessageCount: 0, UnreadOwner: 0, UnreadPeer: replied ? 0 : 1, LegacyRef: 'CC:' + cid
        });
        rep.customerThreads++;
        let n = 0; const seen = {};
        rows.forEach(r => {
          const at = r[6] instanceof Date ? r[6] : new Date(r[6]);
          if (admMsgTxt_(r[3])) {
            admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
              'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid, SenderRole:'customer',
              'Sender-ID': customerId, SenderUsername: customerId, SenderName: admMsgTxt_(r[5]),
              Body: admMsgTxt_(r[3]), CreatedAt: at, MessageType:'TEXT',
              Channel: ADM_CH_CUSTOMER, 'Branch-ID': branch, Visibility:'ALL'
            });
            n++; rep.customerMessages++;
          }
          const rp = admMsgTxt_(r[8]);
          if (rp && !seen[rp]) {
            seen[rp] = true;
            admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
              'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid, SenderRole:'employee',
              'Sender-ID':'', SenderUsername:'پشتیبانی', SenderName:'پشتیبانی شعبه',
              Body: rp, CreatedAt: new Date(at.getTime()+1000), MessageType:'TEXT',
              Channel: ADM_CH_CUSTOMER, 'Branch-ID': branch, Visibility:'ALL'
            });
            n++; rep.customerMessages++;
          }
        });
        const made = admMsgRows_(ADM_MSG_TH, ADM_TH_H).find(x => admMsgTxt_(x['Thread-ID']) === tid);
        if (made) admMsgPatch_(ADM_MSG_TH, ADM_TH_H, made._row, { MessageCount: n });
      });
    }

    const esh = ss.getSheetByName('Employee_Support');
    if (esh && esh.getLastRow() > 1) {
      const evals = esh.getRange(2,1,esh.getLastRow()-1,Math.max(esh.getLastColumn(),11)).getValues();
      evals.forEach(r => {
        const mid = admMsgTxt_(r[0]);
        if (!mid) return;
        if (refs['ES:' + mid]) { rep.skipped++; return; }
        const created = r[6] instanceof Date ? r[6] : new Date(r[6]);
        const replied = !!admMsgTxt_(r[8]);
        const repliedAt = r[9] instanceof Date ? r[9] : (admMsgTxt_(r[9]) ? new Date(r[9]) : created);
        const branch = admMsgTxt_(r[1]);
        const tid = admMsgUid_('THR');
        const cur = admMsgRows_(ADM_MSG_TH, ADM_TH_H);
        admMsgAppend_(ADM_MSG_TH, ADM_TH_H, {
          'Thread-ID': tid, Channel: ADM_CH_EMPLOYEE, TicketNo: admMsgNextTicket_(ADM_CH_EMPLOYEE, cur),
          Subject: admMsgTxt_(r[4]) || 'پشتیبانی کارمند', Status: replied ? 'ANSWERED' : 'OPEN',
          'Branch-ID': branch, OwnerRole:'employee', 'Owner-ID': admMsgTxt_(r[2]),
          OwnerUsername: admMsgTxt_(r[3]), OwnerName: admMsgTxt_(r[3]),
          PeerRole:'admin', PeerUsername: replied ? admMsgTxt_(r[10]) : '', Priority:'عادی',
          CreatedAt: created, UpdatedAt: repliedAt, LastMessageAt: repliedAt,
          LastMessageBy: replied ? admMsgTxt_(r[10]) : admMsgTxt_(r[3]),
          LastMessagePreview: (replied ? admMsgTxt_(r[8]) : admMsgTxt_(r[5])).slice(0,140),
          MessageCount: replied ? 2 : 1, UnreadOwner: replied ? 1 : 0, UnreadPeer: replied ? 0 : 1,
          LegacyRef: 'ES:' + mid
        });
        rep.employeeThreads++;
        admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
          'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid, SenderRole:'employee',
          'Sender-ID': admMsgTxt_(r[2]), SenderUsername: admMsgTxt_(r[3]), SenderName: admMsgTxt_(r[3]),
          Body: admMsgTxt_(r[5]), CreatedAt: created, MessageType:'TEXT',
          Channel: ADM_CH_EMPLOYEE, 'Branch-ID': branch, Visibility:'ALL'
        });
        rep.employeeMessages++;
        if (replied) {
          admMsgAppend_(ADM_MSG_MS, ADM_MS_H, {
            'Message-ID': admMsgUid_('MSG'), 'Thread-ID': tid, SenderRole:'admin',
            'Sender-ID':'', SenderUsername: admMsgTxt_(r[10]) || 'admin', SenderName:'پشتیبانی سامانه',
            Body: admMsgTxt_(r[8]), CreatedAt: repliedAt, MessageType:'TEXT',
            Channel: ADM_CH_EMPLOYEE, 'Branch-ID': branch, Visibility:'ALL'
          });
          rep.employeeMessages++;
        }
      });
    }
    schemaInvalidate_();
    return { success:true, report: rep };
  } finally { lock.releaseLock(); }
}

/* ==================== بارگذاری یکجای داده ==================== */
function admCCBootstrap(token) {
  const s = checkAdminAuth(token);
  schemaInvalidate_();
  return { success:true, user: admCCUser_(s), data: admCCData_(s), meta: { version:'V9', statuses:{ cards: ADM_CARD_STATUSES } } };
}
function admCCData_(s) {
  const D = {};
  const customers = scRead_('customers'), workers = scRead_('workers'), cards = scRead_('cards');
  const services = scRead_('services'), questions = scRead_('questions'), groups = scRead_('groups');
  const cMap = {}; customers.forEach(c => cMap[text_(c.customerId)] = c);
  const wMap = {}; workers.forEach(w => wMap[text_(w.workerId)] = w);
  const cardByReq = {}; cards.forEach(c => cardByReq[text_(c.requestId)] = c);
  const svcByName = {}; services.forEach(v => { svcByName[text_(v.nameFa)] = text_(v.id); svcByName[text_(v.nameEn)] = text_(v.id); });
  const answerCols = Array.from(new Set(questions.map(q => text_(q.column)).filter(Boolean)));

  D.orders = scRead_('orders').map(r => {
    const c = cMap[text_(r.customerId)] || {};
    const answers = {};
    answerCols.forEach(col => { if (r._raw[col] !== undefined && r._raw[col] !== '') answers[col] = r._raw[col]; });
    const card = cardByReq[text_(r.requestId)];
    return {
      rowIndex:r._rowIndex, requestId:text_(r.requestId), createdAt:adm_iso_(r.createdAt),
      customerName: adm_name_(r) || adm_name_(c), phone:text_(r.contact), service:text_(r.service),
      serviceId: svcByName[text_(r.service)] || '', qty:number_(r.qty), actionType:text_(r.actionType),
      execDate:adm_dateKey_(r.execDate), execTime:text_(r.execTime),
      addrFrom:text_(r.addrFrom) || text_(r.addrTo), notes:text_(r.notes), status:text_(r.status),
      verifier:text_(r.verifier), operator:text_(r.operator), branchId:text_(r.branchId), groupId:text_(r.groupId),
      customerId:text_(r.customerId), province:text_(c.province), city:text_(c.city),
      basePrice:number_(r.basePrice), discount:number_(r.discount), tax:number_(r.tax), finalPrice:number_(r.finalPrice),
      sideServices:text_(r.sideServices), cardId: card ? text_(card.cardId) : '', answers
    };
  }).reverse();

  D.cards = cards.map(r => {
    const w = wMap[text_(r.workerId)] || {};
    return { rowIndex:r._rowIndex, cardId:text_(r.cardId), requestId:text_(r.requestId), customerId:text_(r.customerId),
      customerName:text_(r.customerName), phone:text_(r.contact), service:text_(r.serviceType), details:text_(r.details),
      branchId:text_(r.branchId), groupId:text_(w.groupId), workerId:text_(r.workerId), status:text_(r.status),
      execDate:adm_dateKey_(r.execDate), execTime:text_(r.execTime), address:text_(r.address),
      amount:number_(r.total), duration:number_(r.duration), notes:text_(r.description),
      actionType:text_(r.actionType), createdAt:adm_iso_(r.createdAt), updatedAt:adm_iso_(r.updatedAt) };
  }).reverse();

  D.cardHistory = scRead_('cardHistory').map(r => ({ rowIndex:r._rowIndex, cardId:text_(r.cardId),
    from:text_(r.from), to:text_(r.to), userId:text_(r.userId), at:adm_iso_(r.date), desc:text_(r.desc) })).reverse();

  const person = (r, entity) => {
    const idField = entity === 'employees' ? 'empId' : entity === 'workers' ? 'workerId' : 'bnmId';
    return {
      rowIndex:r._rowIndex, id:text_(r[idField]),
      empId:text_(r.empId), workerId:text_(r.workerId), bnmId:text_(r.bnmId),
      username:text_(r.username), firstName:text_(r.firstName), lastName:text_(r.lastName),
      fatherName:text_(r.fatherName), gender:text_(r.gender), nationalId:text_(r.nationalId),
      birthCert:text_(r.birthCert), birthday:adm_dateKey_(r.birthday),
      branchId:text_(r.branchId), groupId:text_(r.groupId), jobTitle:text_(r.jobTitle),
      operations: entity === 'employees' ? adm_normalizeRole_(text_(r.operations)) : text_(r.operations),
      specialization:text_(r.specialization), email:text_(r.email), contact:text_(r.contact),
      photo:text_(r.photo), province:text_(r.province), city:text_(r.city), address:text_(r.address),
      emergencyName:text_(r.emergencyName), emergency:text_(r.emergency),
      hireDate:adm_dateKey_(r.hireDate), description:text_(r.description), notes:text_(r.notes),
      status:text_(r.status)
    };
  };
  D.employees = scRead_('employees').map(r => person(r, 'employees'));
  D.workers = scRead_('workers').map(r => person(r, 'workers'));
  D.bnms = scRead_('branchManagers').map(r => person(r, 'branchManagers'));
  D.branchManagers = D.bnms;

  D.customers = customers.map(r => ({ rowIndex:r._rowIndex, customerId:text_(r.customerId),
    firstName:text_(r.firstName), lastName:text_(r.lastName), username:text_(r.username),
    contact:text_(r.contact), phone:text_(r.contact), email:text_(r.email), gender:text_(r.gender),
    province:text_(r.province), city:text_(r.city), address:text_(r.address), postal:text_(r.postal),
    level:text_(r.level), photo:text_(r.photo), totalOrders:number_(r.totalOrders), totalPayments:number_(r.totalPayments),
    status:text_(r.status), joinDate:adm_dateKey_(r.joinDate), subStart:adm_dateKey_(r.subStart),
    subEnd:adm_dateKey_(r.subEnd), notes:text_(r.notes) }));

  D.branches = scRead_('branches').map(r => ({ rowIndex:r._rowIndex, branchId:text_(r.branchId),
    bnmId:text_(r.bnmId), managerName:text_(r.managerName), name:text_(r.name),
    province:text_(r.province), city:text_(r.city), area:text_(r.area), address:text_(r.address),
    description:text_(r.description), established:adm_dateKey_(r.established), notes:text_(r.notes), status:text_(r.status) }));

  D.groups = groups.map(r => ({ rowIndex:r._rowIndex, groupId:text_(r.groupId), branchId:text_(r.branchId),
    workerId:text_(r.workerId), supervisorName:text_(r.supervisorName), name:text_(r.name),
    province:text_(r.province), city:text_(r.city), area:text_(r.area), totalMembers:number_(r.totalMembers),
    groupType:text_(r.groupType), description:text_(r.description), established:adm_dateKey_(r.established),
    notes:text_(r.notes), status:text_(r.status) }));

  D.groupMembers = scRead_('groupMembers').map(r => ({ rowIndex:r._rowIndex, groupId:text_(r.groupId),
    workerId:text_(r.workerId), username:text_(r.username), role:text_(r.role),
    joinDate:adm_dateKey_(r.joinDate), status:text_(r.status) }));
  D.members = D.groupMembers;

  D.services = services.map(r => ({ rowIndex:r._rowIndex, id:text_(r.id), nameFa:text_(r.nameFa),
    nameEn:text_(r.nameEn), rate:number_(r.rate), unit:text_(r.unit), minOrder:number_(r.minOrder) }));

  D.sides = scRead_('sides').map(r => ({ rowIndex:r._rowIndex, id:text_(r.id), nameFa:text_(r.nameFa),
    nameEn:text_(r.nameEn), rate:number_(r.rate), unit:text_(r.unit), serviceEn:text_(r.serviceEn), notes:text_(r.notes) }));

  D.questions = questions.map(r => ({ rowIndex:r._rowIndex, serviceEn:text_(r.serviceEn), serviceFa:text_(r.serviceFa),
    question:text_(r.question), position:number_(r.position), inputType:text_(r.inputType),
    options:text_(r.options), fieldType:text_(r.fieldType), help:text_(r.help), column:text_(r.column) }));

  D.offers = scRead_('offers').map(r => ({ rowIndex:r._rowIndex, code:text_(r.code), rate:number_(r.percent),
    start:adm_dateKey_(r.start), end:adm_dateKey_(r.end), indLimit:number_(r.individualLimit),
    totalLimit:number_(r.totalLimit), status:text_(r.status) }));

  D.redemptions = scRead_('redemptions').map(r => ({ rowIndex:r._rowIndex, code:text_(r.code),
    customerId:text_(r.customerId), requestId:text_(r.requestId), amount:number_(r.amount),
    usageStatus:text_(r.usageStatus), regTime:adm_iso_(r.regTime) }));

  D.tasks = scRead_('tasks').map(r => ({ rowIndex:r._rowIndex, taskId:text_(r.taskId), customerId:text_(r.customerId),
    createdAt:adm_dateKey_(r.createdAt), execDate:adm_dateKey_(r.execDate), recDate:adm_dateKey_(r.recDate),
    recType:text_(r.recType), execTime:text_(r.execTime), status:text_(r.status) }));

  D.logs = scRead_('logs').map(r => ({ rowIndex:r._rowIndex, empId:text_(r.empId), user:text_(r.name),
    action:text_(r.action), details:text_(r.details), result:text_(r.result), at:adm_iso_(r.date) })).reverse();

  D.applicants = admCCReadApplicants_();
  D.support = admCCReadSupport_();
  D.threads = admCCReadThreads_();
  D.adminSupport = admCCReadEmployeeSupport_();
  D.messageStats = (function () {
    const o = { INTERNAL:0, CUSTOMER_SUPPORT:0, EMPLOYEE_SUPPORT:0, total:0 };
    [].concat(D.support || [], D.threads || [], D.adminSupport || []).forEach(v => {
      if (v.state === 'CLOSED' || !(v.unread > 0)) return;
      o[v.channel] = (o[v.channel] || 0) + 1; o.total++;
    });
    return o;
  })();

  const settings = {}; scRead_('settings').forEach(r => settings[text_(r.key)] = text_(r.value));
  const rules = {}; scRead_('rules').forEach(r => { const v = text_(r.variable); if (v) rules[v] = { rowIndex:r._rowIndex, value:number_(r.value), unit:text_(r.unit), keyFa:text_(r.keyFa) }; });
  D.settings = settings; D.rules = rules;
  D.levels = scRead_('levels').map(r => ({ id:text_(r.id), name:text_(r.name), discountType:text_(r.discountType), discountValue:number_(r.discountValue), status:text_(r.status) }));
  D.views = admCCViews_(s.username);
  D.nextIds = {};
  Object.keys(ADM_ID_RULES).forEach(e => { D.nextIds[e] = admNextId_(e); });
  D.nextIds.bnms = D.nextIds.branchManagers;
  D.notifications = admCCNotifications_(D);
  return D;
}
function admCCNotifications_(D) {
  const out = [];
  (D.orders || []).filter(o => /^(جدید|ثبت اولیه)$/.test(o.status)).slice(0, 6).forEach(o => {
    out.push({ id:'n-o-'+o.rowIndex, kind:'orders', title:'سفارش در انتظار بررسی',
      body:(o.customerName||'—')+' · '+(o.requestId||''), at:o.createdAt, entityId:o.rowIndex });
  });
  const pushMsg = (arr, kind, title) => (arr || [])
    .filter(x => x.unread > 0 && x.state !== 'CLOSED').slice(0, 5).forEach(x => {
      out.push({ id:'n-t-'+x.threadId, kind, threadId:x.threadId, entityId:x.threadId,
        title, body:(x.subject||'بدون موضوع')+' · '+(x.ownerName||x.branchName||''),
        at:x.lastMessageAt || x.createdAt });
    });
  pushMsg(D.support, 'support', 'پیام پاسخ‌داده‌نشده مشتری');
  pushMsg(D.adminSupport, 'adminSupport', 'تیکت جدید از کارکنان شعب');
  pushMsg(D.threads, 'threads', 'مکاتبه سازمانی خوانده‌نشده');
  (D.applicants || []).filter(a => a.status === 'جدید').slice(0, 5).forEach(a => {
    out.push({ id:'n-a-'+a.rowIndex, kind:'applicants', title:'پرونده جدید کارجو',
      body:(a.firstName+' '+a.lastName)+' · '+(a.requestedPosition||''), at:a.createdAt, entityId:a.rowIndex });
  });
  (D.cards || []).filter(c => c.status === 'ارجاع به سرپرست').slice(0, 5).forEach(c => {
    out.push({ id:'n-c-'+c.rowIndex, kind:'cards', title:'کارت ارجاع‌شده به سرپرست',
      body:c.cardId+' · '+(c.customerName||''), at:c.updatedAt, entityId:c.rowIndex });
  });
  return out.sort((a,b) => String(b.at).localeCompare(String(a.at))).slice(0, 25);
}

/* ==================== کارجویان (۳۱ ستونی) ==================== */
function admJaCols_() {
  try { if (typeof JA_HEADERS !== 'undefined' && JA_HEADERS.length) return JA_HEADERS.length; } catch (e) {}
  return 31;
}
function admCCReadApplicants_() {
  try {
    const sh = jaSheet_(); const last = sh.getLastRow(); if (last < 2) return [];
    const N = admJaCols_();
    return sh.getRange(2,1,last-1,N).getValues().map((r,i) => ({
      rowIndex:i+2, createdAt:adm_iso_(r[0]), caseNumber:jaText_(r[1]),
      branchId:jaText_(r[2]), createdBy:jaText_(r[3]),
      firstName:jaText_(r[4]), lastName:jaText_(r[5]), gender:jaText_(r[6]),
      birthDate:adm_dateKey_(r[7]), age:jaText_(r[8]), maritalStatus:jaText_(r[9]),
      specialty:jaText_(r[10]), experience:jaText_(r[11]), otherSkills:jaText_(r[12]),
      education:jaText_(r[13]), fieldOfStudy:jaText_(r[14]),
      province:jaText_(r[15]), city:jaText_(r[16]), address:jaText_(r[17]), residence:jaText_(r[17]),
      phone:jaText_(r[18]), messenger:jaText_(r[19]), messengerId:jaText_(r[20]),
      source:jaText_(r[21]), referrer:jaText_(r[22]), requestedPosition:jaText_(r[23]),
      initialReview:jaText_(r[24]),
      phoneInterviewDate:adm_dateKey_(r[25]), inPersonInterviewDate:adm_dateKey_(r[26]),
      phoneInterviewResult:jaText_(r[27]), inPersonInterviewResult:jaText_(r[28]),
      notes:jaText_(r[29]), status:jaText_(r[30])
    })).reverse();
  } catch (e) { return []; }
}

/* ==================== ذخیره عمومی ==================== */
function admCCSave(entity, record, token) {
  const session = checkPermission(token, 'canEdit');
  const lock = adm_lock_();
  try {
    if (entity === 'applicants') return admCCSaveApplicant_(record, session);
    const real = admEntity_(entity);
    if (real === 'orders') return updateOrder(record.rowIndex, record, token);
    const payload = admCCPayload_(real, record);
    const isNew = !record.rowIndex;
    if (isNew && (real === 'employees' || real === 'workers' || real === 'branchManagers') && !text_(record.password))
      throw new Error('رمز عبور برای حساب جدید الزامی است.');
    if (isNew && ADM_ID_RULES[real]) payload[ADM_ID_RULES[real].field] = admNextId_(real);
    if (isNew && real === 'customers' && !payload.customerId) payload.customerId = generateUniqueMembershipCode_(scRead_('customers'));
    if (isNew && real === 'tasks' && !payload.taskId) payload.taskId = 'TSK-' + Date.now().toString(36).toUpperCase();
    if (isNew && real === 'services' && !payload.id) payload.id = 'SVC-' + Date.now().toString(36).toUpperCase();
    if (isNew && real === 'sides' && !payload.id) payload.id = 'SIDE-' + Date.now().toString(36).toUpperCase();
    if (real === 'groupMembers' && payload.workerId && !payload.username) {
      const w = scRead_('workers').find(x => text_(x.workerId) === text_(payload.workerId));
      if (w) payload.username = text_(w.username);
    }
    if (!payload.status) payload.status = real === 'tasks' ? 'جدید' : 'فعال';
    if (real === 'customers' && !payload.joinDate) payload.joinDate = scStoreDate_(jalaliToday_());
    if ((real === 'employees' || real === 'workers' || real === 'branchManagers') && !payload.hireDate) payload.hireDate = scStoreDate_(jalaliToday_());
    if ((real === 'branches' || real === 'groups') && !payload.established) payload.established = scStoreDate_(jalaliToday_());
    if (real === 'groupMembers' && !payload.joinDate) payload.joinDate = scStoreDate_(jalaliToday_());
    admCCValidate_(real, payload, isNew);
    let rowIndex;
    if (!isNew) { rowIndex = Number(record.rowIndex); scUpdate_(real, rowIndex, payload); }
    else { rowIndex = scAppend_(real, payload); }
    logAdminAction_(session, (isNew?'افزودن ':'ویرایش ') + entity, payload[ADM_ID_RULES[real] ? ADM_ID_RULES[real].field : ''] || ('ردیف ' + rowIndex), 'success');
    schemaInvalidate_();
    return { success:true, rowIndex, id: payload[ADM_ID_RULES[real] ? ADM_ID_RULES[real].field : ''] || '' };
  } finally { lock.releaseLock(); }
}
function admCCPayload_(entity, record) {
  const fields = SCHEMA_FIELDS[entity] || {};
  const payload = {};
  Object.keys(record || {}).forEach(k => {
    if (k === 'rowIndex' || k === 'id' || k === '_raw') return;
    if (!fields[k]) return;
    let v = record[k];
    if ((SCHEMA_DATEONLY[entity] || []).indexOf(k) >= 0 && typeof v === 'string') v = v ? scCoerce_(entity, k, v) : '';
    if ((SCHEMA_MONEY[entity] || []).indexOf(k) >= 0) v = number_(v);
    if (k === 'contact' || k === 'emergency') v = v ? normalizePhone_(v) : '';
    payload[k] = v;
  });
  if (entity === 'customers' && (payload.firstName || payload.lastName))
    payload.fullName = [text_(payload.firstName), text_(payload.lastName)].filter(Boolean).join(' ');
  if (entity === 'offers' && payload.code) payload.code = text_(payload.code).toUpperCase().replace(/\s+/g,'');
  if (['employees','workers','branchManagers','customers'].indexOf(entity) >= 0 && !text_(record.password)) delete payload.password;
  if (entity === 'groups' && payload.totalMembers !== undefined) payload.totalMembers = number_(payload.totalMembers);
  return payload;
}
function admCCValidate_(entity, p, isNew) {
  const req = {
    employees:['firstName','lastName','username','operations'],
    workers:['firstName','lastName','username','operations'],
    branchManagers:['firstName','lastName','username','branchId'],
    branches:['name'], groups:['name','branchId'],
    groupMembers:['groupId','workerId'],
    customers:['firstName','lastName','contact'],
    services:['id','nameFa','rate'], sides:['id','nameFa','rate'],
    questions:['question'], offers:['code','percent'],
    tasks:['customerId','execDate']
  }[entity] || [];
  req.forEach(k => { if (p[k] === undefined || text_(p[k]) === '') throw new Error('فیلد «' + k + '» الزامی است.'); });
  if (p.contact && !/^09\d{9}$/.test(normalizePhone_(p.contact))) throw new Error('شماره تماس باید ۱۱ رقم و با 09 شروع شود.');
  if (entity === 'offers' && !(number_(p.percent) > 0 && number_(p.percent) <= 100)) throw new Error('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
  if (['employees','workers','branchManagers','customers'].indexOf(entity) >= 0 && p.username) {
    const idField = entity === 'employees' ? 'empId' : entity === 'workers' ? 'workerId' : entity === 'branchManagers' ? 'bnmId' : 'customerId';
    const dup = scRead_(entity).find(r => text_(r.username).toLowerCase() === text_(p.username).toLowerCase() && text_(r[idField]) !== text_(p[idField]));
    if (dup && isNew) throw new Error('این نام کاربری قبلاً ثبت شده است.');
  }
}
function admCCSaveApplicant_(record, session) {
  const sh = jaSheet_();
  const N = admJaCols_();
  const firstName = jaText_(record.firstName), lastName = jaText_(record.lastName);
  const phone = jaDigits_(record.phone).replace(/[\s-]/g,'');
  if (!firstName || !lastName) throw new Error('نام و نام خانوادگی الزامی است.');
  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره تماس معتبر نیست.');
  const bd = record.birthDate ? scStoreDate_(record.birthDate) : '';
  const province = jaText_(record.province);
  const city = jaText_(record.city);
  const address = jaText_(record.address) || jaText_(record.residence);
  let branchId = jaText_(record.branchId);
  if (!branchId && typeof jaFindBranchForCity_ === 'function') {
    const bi = jaFindBranchForCity_(province, city);
    branchId = bi ? jaText_(bi.id) : '';
  }
  const row = [
    record.rowIndex ? sh.getRange(Number(record.rowIndex),1).getValue() : new Date(),
    record.caseNumber || jaNextCaseNumber_(sh),
    branchId,
    record.rowIndex ? sh.getRange(Number(record.rowIndex),4).getValue() : (session.empId || session.username),
    firstName, lastName, jaText_(record.gender), bd, jaAge_(bd), jaText_(record.maritalStatus),
    jaText_(record.specialty), jaText_(record.experience), jaText_(record.otherSkills),
    jaText_(record.education), jaText_(record.fieldOfStudy),
    province, city, address,
    phone, jaText_(record.messenger), jaText_(record.messengerId),
    jaText_(record.source), jaText_(record.referrer), jaText_(record.requestedPosition),
    jaText_(record.initialReview) || 'بررسی نشده',
    record.phoneInterviewDate ? scStoreDate_(record.phoneInterviewDate) : '',
    record.inPersonInterviewDate ? scStoreDate_(record.inPersonInterviewDate) : '',
    jaText_(record.phoneInterviewResult) || 'انجام نشده',
    jaText_(record.inPersonInterviewResult) || 'انجام نشده',
    jaText_(record.notes), jaText_(record.status) || 'جدید'
  ];
  while (row.length < N) row.push('');
  if (record.rowIndex) sh.getRange(Number(record.rowIndex),1,1,N).setValues([row.slice(0,N)]);
  else {
    const t = sh.getLastRow()+1;
    [2,3,4,19,21].forEach(c => sh.getRange(t,c).setNumberFormat('@'));
    sh.getRange(t,1,1,N).setValues([row.slice(0,N)]);
  }
  logAdminAction_(session, record.rowIndex ? 'ویرایش پرونده کارجو' : 'ثبت پرونده کارجو', row[1], 'success');
  return { success:true, id: row[1] };
}
function admCCHireApplicant(rowIndex, token) {
  const session = checkPermission(token, 'canManageEmployees');
  const lock = adm_lock_();
  try {
    const sh = jaSheet_();
    const N = admJaCols_();
    const r = sh.getRange(Number(rowIndex),1,1,N).getValues()[0];
    const pos = jaText_(r[23]);
    const ops = /سرپرست|supervisor/i.test(pos) ? 'Supervisor' : /اپراتور|operator|اداری/i.test(pos) ? 'operator' : 'worker';
    const wid = admNextId_('workers');
    const branchId = jaText_(r[2]);
    scAppend_('workers', {
      workerId:wid, username:'w' + wid.replace(/\D/g,'').slice(-6),
      firstName:jaText_(r[4]), lastName:jaText_(r[5]), gender:jaText_(r[6]), birthday:jaText_(r[7]),
      operations:ops, jobTitle:pos, specialization:jaText_(r[10]), contact:jaText_(r[18]),
      province:jaText_(r[15]), city:jaText_(r[16]), address:jaText_(r[17]),
      description:jaText_(r[29]), branchId:branchId,
      hireDate:scStoreDate_(jalaliToday_()), status:'فعال', password:'123456'
    });
    sh.getRange(Number(rowIndex),31).setValue('استخدام شده');
    logAdminAction_(session, 'استخدام کارجو', jaText_(r[1]) + ' → ' + wid, 'success');
    schemaInvalidate_();
    return { success:true, workerId:wid };
  } finally { lock.releaseLock(); }
}
function admCCBulkStatus(entity, rowIndices, status, token) {
  const session = checkPermission(token, 'canEdit');
  const lock = adm_lock_();
  try {
    const real = admEntity_(entity);
    if (entity === 'applicants') { const sh = jaSheet_(); rowIndices.forEach(i => sh.getRange(Number(i),31).setValue(status)); }
    else rowIndices.forEach(i => scUpdate_(real, Number(i), { status }));
    logAdminAction_(session, 'تغییر وضعیت گروهی', entity + ' → ' + status + ' (' + rowIndices.length + ')', 'success');
    schemaInvalidate_();
    return { success:true, count: rowIndices.length };
  } finally { lock.releaseLock(); }
}

/* ==================== حذف با بازگردانی ==================== */
function admCCSheetInfo_(entity) {
  const real = admEntity_(entity);
  if (real === 'applicants') return { sh: jaSheet_(), headers: (typeof JA_HEADERS !== 'undefined' ? JA_HEADERS : []) };
  return { sh: schemaSheetObj_(real), headers: schemaHeaders_(real) };
}
function admCCTrashSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(ADM_CC_TRASH);
  if (!sh) { sh = ss.insertSheet(ADM_CC_TRASH); sh.getRange(1,1,1,6).setValues([['Token','CreatedAt','ExpiresAt','ChunkIndex','ChunkCount','Payload']]); sh.setFrozenRows(1); }
  return sh;
}
function admCCDelete(parts, token) {
  const session = checkPermission(token, 'canDelete');
  const lock = adm_lock_();
  try {
    const t = 'TRASH-' + Utilities.getUuid();
    const trash = { at:new Date().toISOString(), parts:[] };
    (parts || []).forEach(part => {
      const real = admEntity_(part.entity);
      const info = admCCSheetInfo_(real);
      const idx = Array.from(new Set((part.ids||[]).map(Number).filter(n => n >= 2))).sort((a,b) => a-b);
      idx.forEach(i => trash.parts.push({ entity:real, index:i, headers:info.headers, values:info.sh.getRange(i,1,1,info.headers.length).getValues()[0] }));
      idx.slice().sort((a,b) => b-a).forEach(i => info.sh.deleteRow(i));
    });
    const payload = JSON.stringify(trash);
    const chunks = payload.match(/[\s\S]{1,40000}/g) || [];
    const ts = admCCTrashSheet_(), now = new Date(), exp = new Date(Date.now() + 7*864e5);
    chunks.forEach((c,i) => ts.appendRow([t, now, exp, i, chunks.length, c]));
    logAdminAction_(session, 'حذف', t + ' | ' + trash.parts.length + ' ردیف', 'success');
    schemaInvalidate_();
    return { success:true, trashToken:t, count:trash.parts.length };
  } finally { lock.releaseLock(); }
}
function admCCRestore(trashToken, token) {
  const session = checkPermission(token, 'canDelete');
  const lock = adm_lock_();
  try {
    const sh = admCCTrashSheet_();
    if (sh.getLastRow() < 2) throw new Error('موردی برای بازگردانی نیست.');
    const rows = sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
    const parts = [], del = [];
    rows.forEach((r,i) => { if (text_(r[0]) === text_(trashToken)) { parts.push({ idx:Number(r[3]), payload:text_(r[5]) }); del.push(i+2); } });
    if (!parts.length) throw new Error('توکن بازگردانی معتبر نیست.');
    const trash = JSON.parse(parts.sort((a,b) => a.idx-b.idx).map(p => p.payload).join(''));
    trash.parts.sort((a,b) => a.index-b.index).forEach(p => {
      const info = admCCSheetInfo_(p.entity);
      const row = info.headers.map(h => { const i = p.headers.indexOf(h); return i >= 0 ? p.values[i] : ''; });
      info.sh.getRange(info.sh.getLastRow()+1,1,1,info.headers.length).setValues([row]);
    });
    del.sort((a,b) => b-a).forEach(r => sh.deleteRow(r));
    logAdminAction_(session, 'بازگردانی حذف', trashToken, 'success');
    schemaInvalidate_();
    return { success:true, count:trash.parts.length };
  } finally { lock.releaseLock(); }
}
function admCCImport(entity, rows, token) {
  const session = checkPermission(token, 'canEdit');
  let ok = 0; const errors = [];
  (rows || []).forEach((r,i) => { try { admCCSave(entity, r, token); ok++; } catch (e) { errors.push({ row:i+1, error:e.message }); } });
  logAdminAction_(session, 'Import ' + entity, ok + ' موفق / ' + errors.length + ' خطا', 'success');
  return { success:true, inserted:ok, errors };
}

/* ==================== عکس پروفایل ==================== */
function admCCPhotoTarget(target, token) {
  const s = checkAdminAuth(token);
  s.photoTarget = target && target.entity ? target : null;
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(s));
  return { success:true };
}
function admCCUploadPhoto(dataUrl, token) {
  const s = checkAdminAuth(token);
  const t = s.photoTarget;
  let entity, id, username;
  if (t && t.entity) { entity = admEntity_(t.entity); id = t.id; username = t.username; }
  else { entity = 'employees'; id = s.empId || s.employeeId; username = s.username; }
  if (!entity || !id) throw new Error('شناسه کاربر برای ذخیره عکس مشخص نیست.');
  const res = storeProfilePhoto_(entity, id, username || '', dataUrl);
  if (!t) { s.avatar = res.url; }
  else { s.photoTarget = null; }
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(s));
  logAdminAction_(s, 'بارگذاری عکس پروفایل', entity + ' · ' + id, 'success');
  schemaInvalidate_();
  return { success:true, url: res.url };
}
function admCCGetPhoto(entity, rowIndex, token) {
  checkAdminAuth(token);
  const real = admEntity_(entity);
  const rows = scRead_(real);
  const r = rows.find(x => Number(x._rowIndex) === Number(rowIndex));
  if (!r) throw new Error('رکورد یافت نشد.');
  return { success:true, url: text_(r.photo), name: adm_name_(r) };
}
function admCCPhotoEditorHtml() {
  return HtmlService.createHtmlOutputFromFile('PhotoEditor').getContent();
}

/* ==================== کارت / سفارش ==================== */
function admCCConvertOrder(requestId, token) {
  const session = checkPermission(token, 'canEdit');
  const lock = adm_lock_();
  try {
    const order = scRead_('orders').find(r => text_(r.requestId) === text_(requestId));
    if (!order) throw new Error('سفارش یافت نشد.');
    if (scRead_('cards').some(c => text_(c.requestId) === text_(requestId))) throw new Error('این سفارش قبلاً کارت شده است.');
    const cardId = 'CRD-' + Date.now().toString(36).toUpperCase();
    scAppend_('cards', { cardId, requestId:text_(requestId), customerId:text_(order.customerId),
      branchId:text_(order.branchId), verifier:session.username, workerId:'', customerName:adm_name_(order),
      serviceType:text_(order.service), actionType:text_(order.actionType) || 'عادی',
      execDate:order.execDate, execTime:order.execTime, contact:text_(order.contact),
      address:text_(order.addrFrom) || text_(order.addrTo),
      details:text_(order.service) + (text_(order.sideServices) ? ' + ' + text_(order.sideServices) : ''),
      description:text_(order.notes), total:number_(order.finalPrice),
      createdAt:new Date(), updatedAt:new Date(), status:'جدید' });
    scAppend_('cardHistory', { cardId, from:'', to:'جدید', userId:session.empId || session.username, date:new Date(), desc:'ایجاد از سفارش ' + requestId });
    scUpdate_('orders', order._rowIndex, { status:'تبدیل به کارت' });
    logAdminAction_(session, 'تبدیل سفارش به کارت', cardId + ' ← ' + requestId, 'success');
    schemaInvalidate_();
    return { success:true, cardId };
  } finally { lock.releaseLock(); }
}
function admCCCardStatus(cardId, status, workerId, token) {
  const session = checkPermission(token, 'canEdit');
  const lock = adm_lock_();
  try {
    const card = scRead_('cards').find(c => text_(c.cardId) === text_(cardId));
    if (!card) throw new Error('کارت یافت نشد.');
    if (ADM_CARD_STATUSES.indexOf(String(status)) < 0) throw new Error('وضعیت معتبر نیست.');
    const payload = { status, updatedAt:new Date() };
    if (workerId !== undefined && workerId !== null && workerId !== '') payload.workerId = workerId;
    scUpdate_('cards', card._rowIndex, payload);
    scAppend_('cardHistory', { cardId:text_(cardId), from:text_(card.status), to:status,
      userId:session.empId || session.username, date:new Date(), desc: workerId ? ('اجراکننده: ' + workerId) : '' });
    const order = scRead_('orders').find(o => text_(o.requestId) === text_(card.requestId));
    if (order) {
      if (status === 'تکمیل شده') scUpdate_('orders', order._rowIndex, { status:'تکمیل شده' });
      if (status === 'لغو شده') scUpdate_('orders', order._rowIndex, { status:'لغو شده' });
      if (status === 'در حال انجام') scUpdate_('orders', order._rowIndex, { status:'در حال انجام' });
    }
    if (workerId) {
      try {
        const w = scRead_('workers').find(x => text_(x.workerId) === text_(workerId));
        if (w && text_(w.contact)) notifyWorkerCardAssigned(text_(w.contact), { cardId, customerName:text_(card.customerName), service:text_(card.serviceType), amount:number_(card.total), execDate:scDispDate_(card.execDate), execTime:scDispTime_(card.execTime) });
      } catch (e) {}
    }
    logAdminAction_(session, 'تغییر وضعیت کارت', cardId + ': ' + card.status + ' → ' + status, 'success');
    schemaInvalidate_();
    return { success:true };
  } finally { lock.releaseLock(); }
}
function admCCCreateOrder(payload, token) {
  const session = checkAdminAuth(token);
  const res = processOrder(payload);
  if (res && res.success && res.orderId) {
    const o = scRead_('orders').find(x => text_(x.requestId) === text_(res.orderId));
    if (o) scUpdate_('orders', o._rowIndex, { verifier: session.username });
  }
  logAdminAction_(session, 'ثبت سفارش از مرکز مدیریت', res && res.orderId, 'success');
  schemaInvalidate_();
  return res;
}
function updateOrder(rowIndex, updates, token) {
  const session = checkPermission(token, 'canEdit');
  const lock = adm_lock_();
  try {
    const p = admCCPayload_('orders', updates);
    scUpdate_('orders', Number(rowIndex), p);
    logAdminAction_(session, 'ویرایش سفارش', 'ردیف ' + rowIndex, 'success');
    schemaInvalidate_();
    return { success:true, message:'سفارش بروزرسانی شد' };
  } finally { lock.releaseLock(); }
}

/* ==================== تنظیمات / نماها / سلامت ==================== */
function admCCSaveSettings(settings, token) {
  const session = checkPermission(token, 'canManageSettings');
  const lock = adm_lock_();
  try {
    const rows = scRead_('settings');
    Object.keys(settings || {}).forEach(k => {
      const hit = rows.find(r => text_(r.key).toLowerCase() === String(k).toLowerCase());
      if (hit) scUpdate_('settings', hit._rowIndex, { value: settings[k] });
      else scAppend_('settings', { key:k, value:settings[k], usage:'' });
    });
    logAdminAction_(session, 'تغییر تنظیمات', Object.keys(settings||{}).join(', '), 'success');
    schemaInvalidate_();
    return { success:true };
  } finally { lock.releaseLock(); }
}
function admCCSavePricingRules(rules, token) {
  const session = checkPermission(token, 'canManageSettings');
  const lock = adm_lock_();
  try {
    const rows = scRead_('rules');
    Object.keys(rules || {}).forEach(k => {
      const hit = rows.find(r => text_(r.variable).toUpperCase() === String(k).toUpperCase());
      if (hit) scUpdate_('rules', hit._rowIndex, { value:number_(rules[k]) });
      else scAppend_('rules', { variable:k, value:number_(rules[k]), unit:'', keyEn:k, keyFa:k });
    });
    logAdminAction_(session, 'تغییر نرخ‌های قیمت‌گذاری', Object.keys(rules||{}).join(', '), 'success');
    schemaInvalidate_();
    return { success:true };
  } finally { lock.releaseLock(); }
}
function admCCViews_(username) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('ADM_CC_VIEWS_' + username) || '{}'); }
  catch (e) { return {}; }
}
function admCCSaveView(page, name, state, token) {
  const s = checkAdminAuth(token);
  const v = admCCViews_(s.username);
  v[page] = v[page] || [];
  const id = 'VIEW-' + Utilities.getUuid().slice(0,8);
  v[page].push({ id, name:text_(name), state: state || {} });
  PropertiesService.getScriptProperties().setProperty('ADM_CC_VIEWS_' + s.username, JSON.stringify(v));
  return { success:true, id };
}
function admCCDeleteView(page, viewId, token) {
  const s = checkAdminAuth(token);
  const v = admCCViews_(s.username);
  v[page] = (v[page] || []).filter(x => x.id !== viewId);
  PropertiesService.getScriptProperties().setProperty('ADM_CC_VIEWS_' + s.username, JSON.stringify(v));
  return { success:true };
}
function admCCSystemHealth(token) {
  checkAdminAuth(token);
  const counts = {};
  ['orders','cards','customers','employees','workers','branchManagers','branches','groups','groupMembers','services','sides','questions','offers','tasks','logs']
    .forEach(e => { try { counts[e] = scRead_(e).length; } catch (err) { counts[e] = 'ERR'; } });
  let messaging = {};
  try {
    messaging = {
      threads: admMsgRows_(ADM_MSG_TH, ADM_TH_H).length,
      messages: admMsgRows_(ADM_MSG_MS, ADM_MS_H).length,
      unread: admCCMessageUnread(token)
    };
  } catch (e) { messaging = { error: e.message }; }
  return { success:true, version:'V9',
    schema: schemaTest(), counts, messaging,
    nextIds: (function(){ const o = {}; Object.keys(ADM_ID_RULES).forEach(e => o[e] = admNextId_(e)); return o; })(),
    time: new Date().toISOString() };
}

function admCCPing() {
  const need = ['adminLogin','admCCSession','admCCBootstrap','admCCSave','admCCDelete','admCCRestore',
  'admCCBulkStatus','admCCPeekId','admCCUploadPhoto','admCCPhotoTarget','admCCGetPhoto','admCCConvertOrder',
  'admCCCardStatus','admCCCreateOrder','admCCHireApplicant','admCCReplySupport','admCCGetThread',
  'admCCReplyThread','admCCMessages','admCCMessageGet','admCCMessageReply','admCCMessageCreate',
  'admCCMessageStatus','admCCMessageUnread','admCCMessageEdit','admCCMessageDelete',
  'admCCEnsureMessaging','admCCMigrateMessaging','admCCSaveSettings','admCCSavePricingRules',
  'admCCSaveView','admCCDeleteView','admCCSystemHealth',
  'admCCUploadLogo','admCCSaveLogoUrl','admCCResetLogo','admCCLogoStatus','getPublicBranding',
  'admCCSoonRequest','admCCDevRequests','admCCDevRequestStatus','admCCDevRequestDelete'];
  const missing = need.filter(n => typeof globalThis[n] !== 'function');
  return { ok: !missing.length, version:'V10', missing, time:new Date().toISOString() };
}


/* ==================== پروفایل ==================== */
function getUserProfile(token) {
  const s = checkAdminAuth(token);
  const row = scRead_('employees').find(r => text_(r.empId) === (s.empId || s.employeeId) || text_(r.username) === s.username);
  if (!row) return { employeeId:s.empId || s.employeeId, fullName:s.name, username:s.username, email:s.email,
    phone:'', position:s.position, role:s.role, specialty:s.specialty, avatar:s.avatar, joinDate:'', address:'',
    nationalCode:'', emergencyContact:'', branch:s.branch, permissions:s.permissions };
  return { employeeId:text_(row.empId), fullName:adm_name_(row), username:text_(row.username), email:text_(row.email),
    phone:text_(row.contact), position:text_(row.jobTitle), role:s.role, specialty:text_(row.specialization),
    avatar:text_(row.photo), joinDate:scDispDate_(row.hireDate), address:text_(row.address),
    nationalCode:text_(row.nationalId), emergencyContact:text_(row.emergency), branch:text_(row.branchId), permissions:s.permissions };
}
function updateUserProfile(updates, token) {
  const s = checkAdminAuth(token);
  const lock = adm_lock_();
  try {
    const row = scRead_('employees').find(r => text_(r.empId) === (s.empId || s.employeeId) || text_(r.username) === s.username);
    if (!row) throw new Error('کاربر یافت نشد.');
    const p = {};
    if (updates.fullName) { const a = String(updates.fullName).trim().split(/\s+/); p.firstName = a[0] || ''; p.lastName = a.slice(1).join(' '); }
    ['contact','email','specialization','nationalId','emergency','address','password','photo'].forEach(k => {
      if (updates[k] !== undefined && updates[k] !== '') p[k] = updates[k];
    });
    if (updates.phone) p.contact = normalizePhone_(updates.phone);
    if (updates.specialty) p.specialization = updates.specialty;
    if (updates.nationalCode) p.nationalId = updates.nationalCode;
    if (updates.emergencyContact) p.emergency = updates.emergencyContact;
    if (updates.avatar) p.photo = updates.avatar;
    if (Object.keys(p).length) scUpdate_('employees', row._rowIndex, p);
    if (p.firstName || p.lastName) s.name = [p.firstName || row.firstName, p.lastName || row.lastName].filter(Boolean).join(' ');
    if (p.photo) s.avatar = p.photo;
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(s));
    logAdminAction_(s, 'ویرایش پروفایل', Object.keys(p).join(', '), 'success');
    schemaInvalidate_();
    return { success:true };
  } finally { lock.releaseLock(); }
}

/* ==================== سازگاری با APIهای قبلی ==================== */
function getDashboardData(token) {
  const d = admCCBootstrap(token).data, os = d.orders;
  const today = adm_dateKey_(new Date()), month = today.slice(0,7);
  return { totalOrders:os.length, todayOrders:os.filter(o => adm_dateKey_(o.createdAt) === today).length,
    monthOrders:os.filter(o => adm_dateKey_(o.createdAt).slice(0,7) === month).length,
    totalRevenue:os.reduce((s,o) => s + number_(o.finalPrice), 0),
    monthRevenue:os.filter(o => adm_dateKey_(o.createdAt).slice(0,7) === month).reduce((s,o) => s + number_(o.finalPrice), 0),
    pendingOrders:os.filter(o => /^(جدید|ثبت اولیه)$/.test(o.status)).length,
    completedOrders:os.filter(o => /تکمیل/.test(o.status)).length,
    cancelledOrders:os.filter(o => /لغو/.test(o.status)).length,
    activeCustomers:d.customers.filter(c => c.status === 'فعال').length,
    statusDistribution:os.reduce((m,o) => { m[o.status] = (m[o.status]||0)+1; return m; }, {}),
    topServices:[], topEmployees:[], topWorkers:[], topCities:[], topCustomers:[] };
}
function getOrdersList(f, token) { return { data: admCCBootstrap(token).data.orders, permissions: checkAdminAuth(token).permissions }; }
function deleteOrders(ids, token) { return admCCDelete([{entity:'orders', ids}], token); }
function getOrderInvoice(requestId, token) {
  checkAdminAuth(token);
  const r = scRead_('orders').find(x => text_(x.requestId) === text_(requestId));
  if (!r) throw new Error('سفارش یافت نشد.');
  return { requestId:text_(r.requestId), customer:adm_name_(r), phone:text_(r.contact), service:text_(r.service),
    qty:number_(r.qty), executeDate:scDispDate_(r.execDate), executeTime:scDispTime_(r.execTime),
    address:text_(r.addrFrom) || text_(r.addrTo), basePrice:number_(r.basePrice), discount:number_(r.discount),
    tax:number_(r.tax), finalPrice:number_(r.finalPrice), status:text_(r.status), date:scDispDateTime_(r.createdAt) };
}
function exportOrdersToCSV(f, token) {
  const rows = admCCBootstrap(token).data.orders;
  const head = ['تاریخ','شناسه','مشتری','موبایل','خدمت','مبلغ','وضعیت'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
  const lines = [head.map(q).join(',')];
  rows.forEach(r => lines.push([scDispDateTime_(r.createdAt), r.requestId, r.customerName, r.phone, r.service, r.finalPrice, r.status].map(q).join(',')));
  return '\uFEFF' + lines.join('\n');
}
function getSystemSettings(token) { checkPermission(token,'canManageSettings'); return scRead_('settings').map(r => ({ key:text_(r.key), value:text_(r.value), usage:text_(r.usage) })); }
function updateSetting(key, value, token) { const o = {}; o[key] = value; return admCCSaveSettings(o, token); }
function getFinancialReport(from, to, svc, city, token) {
  checkAdminAuth(token);
  let rows = scRead_('orders'); const cm = adm_cityMap_();
  if (from) rows = rows.filter(r => adm_dateKey_(r.createdAt) >= adm_dateKey_(from));
  if (to) rows = rows.filter(r => adm_dateKey_(r.createdAt) <= adm_dateKey_(to));
  if (svc) rows = rows.filter(r => text_(r.service) === svc);
  if (city) rows = rows.filter(r => (cm[text_(r.customerId)] || {}).city === city);
  const rev = rows.reduce((s,r) => s + number_(r.finalPrice), 0);
  return { count:rows.length, totalRevenue:rev, totalDiscount:rows.reduce((s,r) => s + number_(r.discount), 0),
    totalTax:rows.reduce((s,r) => s + number_(r.tax), 0), averageOrder: rows.length ? Math.round(rev/rows.length) : 0,
    byService:Object.entries(rows.reduce((m,r) => { m[text_(r.service)] = (m[text_(r.service)]||0)+1; return m; }, {})).map(([name,count]) => ({name,count})),
    byStatus:rows.reduce((m,r) => { m[text_(r.status)] = (m[text_(r.status)]||0)+1; return m; }, {}),
    byMonth:[], byCity:[], transactions:rows.map(r => ({ date:scDispDateTime_(r.createdAt), requestId:text_(r.requestId), customer:adm_name_(r), service:text_(r.service), amount:number_(r.finalPrice), status:text_(r.status) })) };
}

/* ═══════════════════════════════════════════════════════════════
   AdministratorCode.gs — افزونه V10 (لوگوی برند + نقشه راه توسعه)
   ═══════════════════════════════════════════════════════════════ */

const ZV_LOGO_SETTING   = 'LOGO_URL';
const ZV_LOGO_FILE_NAME = 'ZingoVingo-LOGO.png';
const ZV_LOGO_MAX_BYTES = 4 * 1024 * 1024;


/* ─────────── ابزارهای لوگو ─────────── */
function zvLogoTxt_(v) { try { return text_(v); } catch (e) { return v == null ? '' : String(v).trim(); } }
function zvLogoSettings_() {
  const o = {};
  try { scRead_('settings').forEach(r => { o[zvLogoTxt_(r.key)] = zvLogoTxt_(r.value); }); } catch (e) {}
  return o;
}
function zvLogoParse_(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
  if (!m) throw new Error('داده تصویر معتبر نیست.');
  const mime = m[1] || 'image/png';
  if (!/^image\//i.test(mime)) throw new Error('فقط فایل تصویری مجاز است.');
  const bytes = m[2] ? Utilities.base64Decode(m[3]) : Utilities.newBlob(decodeURIComponent(m[3])).getBytes();
  if (bytes.length > ZV_LOGO_MAX_BYTES) throw new Error('حجم لوگو باید کمتر از ۴ مگابایت باشد.');
  const ext = /svg/i.test(mime) ? 'svg' : /jpeg|jpg/i.test(mime) ? 'jpg' : /webp/i.test(mime) ? 'webp' : 'png';
  return { blob: Utilities.newBlob(bytes, mime, ZV_LOGO_FILE_NAME.replace(/\.png$/, '.' + ext)), mime };
}
function zvLogoFolder_() {
  const s = zvLogoSettings_();
  const id = s.DRIVE_FOLDER_ID || s.PROFILE_FOLDER_ID || s.UPLOAD_FOLDER_ID || '';
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const cached = PropertiesService.getScriptProperties().getProperty('ZV_ASSETS_FOLDER');
  if (cached) { try { return DriveApp.getFolderById(cached); } catch (e) {} }
  const it = DriveApp.getFoldersByName('ZingoVingo Assets');
  const f = it.hasNext() ? it.next() : DriveApp.createFolder('ZingoVingo Assets');
  PropertiesService.getScriptProperties().setProperty('ZV_ASSETS_FOLDER', f.getId());
  return f;
}
function zvLogoStore_(dataUrl, token) {
  if (typeof uploadImage === 'function') {
    try { const r = uploadImage(dataUrl, 'LOGO.png', token); if (r && r.url) return { url:String(r.url), via:'uploadImage' }; } catch (e) {}
  }
  const p = zvLogoParse_(dataUrl), folder = zvLogoFolder_(), name = p.blob.getName();
  const it = folder.getFilesByName(name);
  let file;
  if (it.hasNext()) {
    file = it.next();
    file.setContent(p.blob.getBytes());
    try { file.setMimeType(p.mime); } catch (e) {}
    while (it.hasNext()) { try { it.next().setTrashed(true); } catch (e) {} }
  } else file = folder.createFile(p.blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return { url:'https://lh3.googleusercontent.com/d/' + file.getId() + '=w512', via:'DriveApp', fileId:file.getId() };
}

/* ─────────── API لوگو ─────────── */
function admCCUploadLogo(dataUrl, token) {
  const s = checkPermission(token, 'canManageSettings');
  const lock = adm_lock_();
  try {
    const st = zvLogoStore_(dataUrl, token);
    if (!st || !st.url) throw new Error('بارگذاری لوگو ناموفق بود.');
    admCCSaveSettings({ LOGO_URL: st.url }, token);
    logAdminAction_(s, 'بارگذاری لوگوی سامانه', st.via + ' · ' + st.url, 'success');
    schemaInvalidate_();
    return { success:true, url:st.url, fileId:st.fileId || '', message:'لوگوی سامانه به‌روزرسانی شد.' };
  } finally { lock.releaseLock(); }
}
function admCCSaveLogoUrl(url, token) {
  const s = checkPermission(token, 'canManageSettings');
  const v = zvLogoTxt_(url);
  if (v && !/^https?:\/\//i.test(v) && !/^data:image\//i.test(v)) throw new Error('نشانی لوگو باید با http(s) شروع شود.');
  admCCSaveSettings({ LOGO_URL: v }, token);
  logAdminAction_(s, 'تغییر نشانی لوگو', v || '(LOGO.png مخزن)', 'success');
  schemaInvalidate_();
  return { success:true, url:v };
}
function admCCResetLogo(token) {
  const s = checkPermission(token, 'canManageSettings');
  admCCSaveSettings({ LOGO_URL: '' }, token);
  logAdminAction_(s, 'بازنشانی لوگو', 'بازگشت به LOGO.png مخزن', 'success');
  schemaInvalidate_();
  return { success:true, url:'', message:'لوگو به LOGO.png مخزن بازگشت.' };
}
function admCCLogoStatus(token) {
  checkAdminAuth(token);
  const s = zvLogoSettings_();
  let exists = false, fileId = '';
  try {
    const it = zvLogoFolder_().getFilesByName(ZV_LOGO_FILE_NAME);
    if (it.hasNext()) { const f = it.next(); exists = true; fileId = f.getId(); }
  } catch (e) {}
  return { success:true, settingKey:ZV_LOGO_SETTING, LOGO_URL:s.LOGO_URL || '',
    source: s.LOGO_URL ? 'drive' : 'repository', repositoryFallback:'LOGO.png',
    driveFileExists:exists, driveFileId:fileId, time:new Date().toISOString() };
}
/** برندینگ عمومی — بدون لاگین، برای صفحه ورود همه پنل‌ها */
function getPublicBranding() {
  const s = zvLogoSettings_();
  return { success:true, LOGO_URL:s.LOGO_URL || '', FAVICON_URL:s.FAVICON_URL || '',
    BRAND_NAME:s.BRAND_NAME || 'ZingoVingo', CURRENCY_LABEL:s.CURRENCY_LABEL || 'ریال',
    time:new Date().toISOString() };
}

