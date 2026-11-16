/**
 * ═══════════════════════════════════════════════════════════════
 * ZingoVingo — Employee Panel Backend (Unified V3 · Threaded Messaging)
 * فایل: EmpolyeeCode.gs
 * ═══════════════════════════════════════════════════════════════
 * وابسته به: SchemaCore.gs (scRead_, scAppend_, scUpdate_, scDelete_, text_, number_, getSpreadsheet_)
 *            Job_Application_Form.gs (searchEmployeeJobApplicants, updateEmployeeJobApplicantFull)
 *
 * ⚠️ اگر فایل Messaging.gs یا EmployeePanelV2.gs را جداگانه اضافه کرده‌اید، حذف کنید.
 *
 * تغییرات V3:
 *  • یک موتور گفتگو برای سه کانال: INTERNAL / CUSTOMER_SUPPORT / EMPLOYEE_SUPPORT
 *  • پشتیبانی‌ها از «تک‌پاسخ قابل‌بازنویسی» به «رشته‌پیام چندگانه» تبدیل شدند
 *  • ستون‌های جدید به‌صورت خودکار و غیرمخرب به شیت‌های موجود اضافه می‌شوند
 *  • خواندن/نوشتن بر اساس نام هدر (مستقل از ترتیب ستون‌ها)
 *  • مهاجرت idempotent داده‌های قدیمی با LegacyRef
 *  • همه نام‌های تابع قبلی حفظ شده‌اند → فرانت‌اند فعلی نمی‌شکند
 *
 * قاعده طلایی: هر تابع فقط داده‌های شعبهٔ خودِ کارمند را می‌خواند/می‌نویسد.
 * ═══════════════════════════════════════════════════════════════
 */

/* ═════════ 1) CONSTANTS ═════════ */
var EMP_THREAD_SHEET = 'ConversationThreads';
var EMP_MSG_SHEET    = 'ConversationMessages';
var EMP_CUST_SHEET   = 'Customer_Conversations';   // legacy archive
var EMP_SUPPORT_SHEET= 'Employee_Support';         // legacy archive

var EMP_TH_HEADERS = [
  'Thread-ID','Card-ID','Worker-ID','WorkerUsername','Supervisor-ID','SupervisorUsername',
  'Group-ID','Branch-ID','Subject','Status','LastMessageAt','LastMessageBy','CreatedAt','UpdatedAt',
  'Channel','TicketNo','OwnerRole','Owner-ID','OwnerUsername','OwnerName',
  'PeerRole','Peer-ID','PeerUsername','Priority','MessageCount','UnreadOwner','UnreadPeer',
  'ClosedAt','ClosedBy','LastMessagePreview','LegacyRef'
];
var EMP_MS_HEADERS = [
  'Message-ID','Thread-ID','SenderRole','Sender-ID','SenderUsername','Body','CreatedAt',
  'ReadAt','ReadBy','MessageType','RelatedCard-ID',
  'SenderName','Channel','Branch-ID','Visibility','EditedAt','DeletedAt','Attachments'
];
var EMP_CUST_HEADERS = ['conversationId','customerId','subject','message','sender','senderName','createdAt','status','reply'];
var EMP_SUPPORT_HEADERS = ['Message-ID','Branch-ID','Emp-ID','Username','Subject','Body','CreatedAt','Status','Reply','RepliedAt','RepliedBy'];

var EMP_CH_INTERNAL = 'INTERNAL';
var EMP_CH_CUSTOMER = 'CUSTOMER_SUPPORT';
var EMP_CH_EMPLOYEE = 'EMPLOYEE_SUPPORT';

var EMP_ORDER_STATUS = ['جدید','ثبت اولیه','در حال بررسی','تبدیل به کارت','در حال انجام','تکمیل شده','لغو شده'];
var EMP_CARD_STATUS  = ['جدید','تخصیص به شعبه','تخصیص به گروه','تخصیص به کارگر','در حال انجام','تکمیل شده','تعلیق','ارجاع به سرپرست','لغو شده'];
var EMP_TASK_STATUS  = ['جدید','در حال انجام','تکمیل شده','لغو شده'];
var EMP_AP_STATUS    = ['جدید','در حال بررسی','در انتظار مصاحبه','تأیید شده','رد شده','استخدام شده','بایگانی'];
var EMP_MEMBER_ROLES = ['member','supervisor','operator'];
var EMP_ACTIVE_RX    = /^(فعال|active)$/i;

/* ═════════ 2) LOW-LEVEL SAFE HELPERS ═════════ */
function empTxt_(v) {
  try { if (typeof text_ === 'function') return text_(v); } catch (e) {}
  return v == null ? '' : String(v).trim();
}
function empNum_(v) {
  try { if (typeof number_ === 'function') return number_(v); } catch (e) {}
  var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, ''));
  return isFinite(n) ? n : 0;
}
function empRead_(name) {
  try { return scRead_(name) || []; } catch (e) { return []; }
}
function empIso_(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  var d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toISOString();
}
function empDispDate_(v) {
  if (!v) return '';
  try { if (typeof scDispDate_ === 'function') return scDispDate_(v); } catch (e) {}
  return String(v);
}
function empDispDateTime_(v) {
  if (!v) return '';
  try { if (typeof scDispDateTime_ === 'function') return scDispDateTime_(v); } catch (e) {}
  return empDispDate_(v);
}
function empDispTime_(v) {
  if (!v) return '';
  try { if (typeof scDispTime_ === 'function') return scDispTime_(v); } catch (e) {}
  return String(v);
}
function empLog_(session, action, details, result) {
  try { if (typeof scLog_ === 'function') scLog_(session, action, details, result || 'success'); } catch (e) {}
}
function empSetting_(key, def) {
  try { if (typeof getSetting_ === 'function') return getSetting_(key, def); } catch (e) {}
  return def;
}
function empKey_(v) {
  var s = empTxt_(v);
  if (!s) return '';
  var m = s.replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return m[1] + String(m[2]).padStart(2, '0') + String(m[3]).padStart(2, '0');
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return '';
}
function empUid_(p) {
  return p + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 18).toUpperCase();
}
function empBranchOf_(session) { return empTxt_(session.branchId); }

/* ═════════ 3) HEADER-BASED SHEET ACCESS (auto-extend, order-safe) ═════════ */
function empHead_(sh) {
  var n = sh.getLastColumn();
  if (n < 1) return [];
  return sh.getRange(1, 1, 1, n).getDisplayValues()[0].map(function (x) { return String(x).trim(); });
}
function empStyleHeader_(sh, col, count, bg) {
  sh.getRange(1, col, 1, count).setFontWeight('bold').setBackground(bg || '#0B1736').setFontColor('#FFFFFF');
}
function empSheet_(name, headers) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    empStyleHeader_(sh, 1, headers.length);
    return sh;
  }
  var cur = empHead_(sh);
  var hasHeader = cur.some(function (x) { return x !== ''; });
  if (!hasHeader) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    empStyleHeader_(sh, 1, headers.length);
    return sh;
  }
  var missing = headers.filter(function (h) { return cur.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
    empStyleHeader_(sh, cur.length + 1, missing.length, '#13234D');
  }
  return sh;
}
function empSheetRows_(name, headers) {
  var sh = empSheet_(name, headers);
  if (sh.getLastRow() < 2) return [];
  var head = empHead_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return vals.map(function (r, i) {
    var o = { _rowIndex: i + 2 };
    head.forEach(function (h, j) { if (h) o[h] = r[j]; });
    return o;
  });
}
function empAppendRow_(name, headers, obj) {
  var sh = empSheet_(name, headers);
  var head = empHead_(sh);
  sh.appendRow(head.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; }));
  return sh.getLastRow();
}
function empPatchRow_(name, headers, rowIndex, obj) {
  var sh = empSheet_(name, headers);
  var head = empHead_(sh);
  Object.keys(obj).forEach(function (k) {
    var c = head.indexOf(k);
    if (c >= 0) sh.getRange(rowIndex, c + 1).setValue(obj[k]);
  });
}
/** یک‌بار اجرا: ساخت/تکمیل ستون‌های موتور پیام */
function empEnsureMessaging_() {
  empSheet_(EMP_THREAD_SHEET, EMP_TH_HEADERS);
  empSheet_(EMP_MSG_SHEET, EMP_MS_HEADERS);
  return { success: true, message: 'ساختار شیت‌های گفتگو آماده است.' };
}

/* ═════════ 4) AUTH & SESSION ═════════ */
function employeeLogin(username, password) {
  try {
    var u = String(username || '').trim().toLowerCase();
    var found = empRead_('employees').find(function (r) {
      return (empTxt_(r.username).toLowerCase() === u || empTxt_(r.email).toLowerCase() === u) &&
        empTxt_(r.password) === String(password) &&
        EMP_ACTIVE_RX.test(empTxt_(r.status)) &&
        /employee|کارمند/i.test(empTxt_(r.operations));
    });
    if (!found) throw new Error('نام کاربری یا رمز عبور اشتباه است، حساب غیرفعال است، یا نقش شما «کارمند» نیست.');

    var branchId = empTxt_(found.branchId);
    if (!branchId) throw new Error('شعبه‌ای برای حساب شما تعریف نشده است. با مدیر سامانه تماس بگیرید.');

    var token = Utilities.getUuid();
    var session = {
      token: token, role: 'Employee', panel: 'employee',
      empId: empTxt_(found.empId), username: empTxt_(found.username),
      name: [empTxt_(found.firstName), empTxt_(found.lastName)].filter(Boolean).join(' '),
      branchId: branchId, avatar: empTxt_(found.photo),
      contact: empTxt_(found.contact), email: empTxt_(found.email),
      loginAt: new Date().toISOString()
    };
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    empLog_(session, 'ورود به پنل کارمند', session.username, 'success');
    return { success: true, token: token, user: empUser_(session) };
  } catch (err) {
    throw new Error('خطای ورود: ' + err.message);
  }
}
function employeeLogout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty('session_' + token); } catch (e) {}
  return { success: true };
}
function checkEmployeeAuth(token) {
  if (!token) throw new Error('لطفاً ابتدا وارد شوید');
  var raw = PropertiesService.getScriptProperties().getProperty('session_' + token);
  if (!raw) throw new Error('نشست منقضی شده است. دوباره وارد شوید.');
  var s;
  try { s = JSON.parse(raw); } catch (e) { throw new Error('خطا در خواندن نشست.'); }
  if (s.role !== 'Employee') throw new Error('دسترسی غیرمجاز.');
  if (!s.branchId) throw new Error('شعبه‌ای برای حساب شما تعریف نشده است.');
  return s;
}
function empUser_(s) {
  return {
    name: s.name, empId: s.empId, employeeId: s.empId, username: s.username,
    branchId: s.branchId, role: 'Employee', roleFa: 'کارمند شعبه',
    avatar: s.avatar || '', contact: s.contact || '', email: s.email || ''
  };
}

/* ═════════ 5) BRANCH SCOPE HELPERS ═════════ */
function empCustomerIds_(orders, branchId) {
  var m = {};
  orders.forEach(function (o) {
    if (empTxt_(o.branchId) === branchId) {
      var id = empTxt_(o.customerId);
      if (id) m[id] = true;
    }
  });
  return m;
}
function empCustomerNames_(orders, branchId) {
  var m = {};
  orders.forEach(function (o) {
    if (empTxt_(o.branchId) !== branchId) return;
    var id = empTxt_(o.customerId);
    if (id && !m[id]) m[id] = [empTxt_(o.firstName), empTxt_(o.lastName)].filter(Boolean).join(' ');
  });
  return m;
}
function empCustomerBranch_(customerId, orders) {
  var cid = empTxt_(customerId);
  if (!cid) return '';
  var os = (orders || empRead_('orders')).filter(function (o) { return empTxt_(o.customerId) === cid && empTxt_(o.branchId); });
  if (os.length) {
    os.sort(function (a, b) { return String(empIso_(b.createdAt)).localeCompare(String(empIso_(a.createdAt))); });
    return empTxt_(os[0].branchId);
  }
  var c = empRead_('customers').find(function (x) { return empTxt_(x.customerId) === cid; });
  if (c && empTxt_(c.branchId)) return empTxt_(c.branchId);
  if (c) {
    var bs = empRead_('branches');
    var b = bs.find(function (x) { return empTxt_(x.province) === empTxt_(c.province) && empTxt_(x.city) === empTxt_(c.city); })
         || bs.find(function (x) { return empTxt_(x.province) === empTxt_(c.province); });
    if (b) return empTxt_(b.branchId);
  }
  return '';
}
function empCustomerName_(customerId, fallback, orders) {
  var cid = empTxt_(customerId);
  var nm = empCustomerNames_(orders || empRead_('orders'), empCustomerBranch_(cid, orders));
  if (nm[cid]) return nm[cid];
  var c = empRead_('customers').find(function (x) { return empTxt_(x.customerId) === cid; });
  if (c) { var n = [empTxt_(c.firstName), empTxt_(c.lastName)].filter(Boolean).join(' '); if (n) return n; }
  return empTxt_(fallback) || cid;
}
function empTaskRows_(tasks, custIds, nameMap) {
  return tasks.filter(function (t) { return custIds[empTxt_(t.customerId)]; }).map(function (t) {
    var cid = empTxt_(t.customerId);
    return {
      rowIndex: t._rowIndex, taskId: empTxt_(t.taskId) || empTxt_(t.id),
      customerId: cid, customerName: nameMap[cid] || cid,
      execDate: empTxt_(t.execDate), execTime: empTxt_(t.execTime),
      recType: empTxt_(t.recType), status: empTxt_(t.status), notes: empTxt_(t.notes)
    };
  });
}

/* ═════════ 6) UNIFIED Messaging — NORMALIZERS ═════════ */
function empChannel_(t) { return empTxt_(t.Channel) || EMP_CH_INTERNAL; }
function empOwnerRole_(t) {
  var r = empTxt_(t.OwnerRole);
  if (r) return r;
  var c = empChannel_(t);
  return c === EMP_CH_CUSTOMER ? 'customer' : c === EMP_CH_EMPLOYEE ? 'employee' : 'worker';
}
function empOwnerId_(t)   { return empTxt_(t['Owner-ID']) || empTxt_(t['Worker-ID']); }
function empOwnerUser_(t) { return empTxt_(t.OwnerUsername) || empTxt_(t.WorkerUsername); }
function empOwnerName_(t) { return empTxt_(t.OwnerName) || empOwnerUser_(t) || empOwnerId_(t); }
function empPeerUser_(t)  { return empTxt_(t.PeerUsername) || empTxt_(t.SupervisorUsername); }
function empState_(v) {
  var s = empTxt_(v).toLowerCase();
  if (!s) return 'OPEN';
  if (/closed|بسته/.test(s)) return 'CLOSED';
  if (/answered|پاسخ داده/.test(s)) return 'ANSWERED';
  return 'OPEN';
}
function empStateLegacy_(v) { var s = empState_(v); return s === 'CLOSED' ? 'closed' : s === 'ANSWERED' ? 'answered' : 'unread'; }
function empStateFa_(v) { var s = empState_(v); return s === 'CLOSED' ? 'بسته' : s === 'ANSWERED' ? 'پاسخ داده شده' : 'در انتظار پاسخ'; }
function empStateOut_(channel, v) {
  if (channel === EMP_CH_EMPLOYEE) return empStateFa_(v);
  if (channel === EMP_CH_CUSTOMER) return empStateLegacy_(v);
  return empState_(v);
}
function empThreadInBranch_(t, b, custIds) {
  if (empTxt_(t['Branch-ID']) === b) return true;
  if (empChannel_(t) === EMP_CH_CUSTOMER && custIds[empOwnerId_(t)]) return true;
  return false;
}
function empGroupMsgs_(msgs) {
  var g = {};
  msgs.forEach(function (m) {
    if (empTxt_(m.DeletedAt)) return;
    var k = empTxt_(m['Thread-ID']);
    (g[k] = g[k] || []).push(m);
  });
  Object.keys(g).forEach(function (k) {
    g[k].sort(function (a, b) { return String(empIso_(a.CreatedAt)).localeCompare(String(empIso_(b.CreatedAt))); });
  });
  return g;
}
function empMsgView_(m) {
  return {
    messageId: empTxt_(m['Message-ID']), threadId: empTxt_(m['Thread-ID']),
    senderRole: empTxt_(m.SenderRole), senderId: empTxt_(m['Sender-ID']),
    senderUsername: empTxt_(m.SenderUsername), senderName: empTxt_(m.SenderName) || empTxt_(m.SenderUsername),
    body: empTxt_(m.Body), createdAt: empIso_(m.CreatedAt),
    readAt: empIso_(m.ReadAt), readBy: empTxt_(m.ReadBy),
    messageType: empTxt_(m.MessageType) || 'TEXT', visibility: empTxt_(m.Visibility) || 'ALL',
    cardId: empTxt_(m['RelatedCard-ID']), editedAt: empIso_(m.EditedAt),
    attachments: (function () { try { return JSON.parse(empTxt_(m.Attachments) || '[]'); } catch (e) { return []; } })()
  };
}
function empThreadView_(t, list, session) {
  var ch = empChannel_(t);
  var or = empOwnerRole_(t);
  var visible = list || [];
  var lastPublic = null, firstOwner = null, lastStaff = null;
  for (var i = visible.length - 1; i >= 0; i--) {
    if (empTxt_(visible[i].Visibility) !== 'STAFF') { lastPublic = visible[i]; break; }
  }
  for (var j = 0; j < visible.length; j++) {
    if (empTxt_(visible[j].SenderRole) === or) { firstOwner = visible[j]; break; }
  }
  for (var k = visible.length - 1; k >= 0; k--) {
    var r = empTxt_(visible[k].SenderRole);
    if (r !== or && r !== 'system') { lastStaff = visible[k]; break; }
  }
  var isOwnerSide = (ch === EMP_CH_EMPLOYEE);
  var unread = isOwnerSide ? empNum_(t.UnreadOwner) : empNum_(t.UnreadPeer);
  var tid = empTxt_(t['Thread-ID']);
  var preview = empTxt_(t.LastMessagePreview) || (lastPublic ? empTxt_(lastPublic.Body).slice(0, 140) : '');
  var lastAt = empIso_(t.LastMessageAt) || (lastPublic ? empIso_(lastPublic.CreatedAt) : empIso_(t.CreatedAt));

  return {
    /* canonical */
    threadId: tid, ticketNo: empTxt_(t.TicketNo), channel: ch,
    subject: empTxt_(t.Subject) || 'بدون موضوع',
    state: empState_(t.Status), status: empStateOut_(ch, t.Status), statusFa: empStateFa_(t.Status),
    priority: empTxt_(t.Priority) || 'عادی',
    branchId: empTxt_(t['Branch-ID']), groupId: empTxt_(t['Group-ID']), cardId: empTxt_(t['Card-ID']),
    ownerRole: or, ownerId: empOwnerId_(t), ownerUsername: empOwnerUser_(t), ownerName: empOwnerName_(t),
    peerRole: empTxt_(t.PeerRole), peerUsername: empPeerUser_(t),
    messageCount: visible.length, unread: unread, preview: preview,
    lastMessageAt: lastAt, lastMessageBy: empTxt_(t.LastMessageBy),
    createdAt: empIso_(t.CreatedAt), updatedAt: empIso_(t.UpdatedAt),
    closedAt: empIso_(t.ClosedAt), closedBy: empTxt_(t.ClosedBy),
    /* legacy aliases — فرانت‌اند فعلی بدون تغییر کار می‌کند */
    rowIndex: t._rowIndex,
    id: tid, conversationId: tid,
    customerId: ch === EMP_CH_CUSTOMER ? empOwnerId_(t) : '',
    senderName: empOwnerName_(t),
    message: firstOwner ? empTxt_(firstOwner.Body) : preview,
    body: firstOwner ? empTxt_(firstOwner.Body) : preview,
    reply: lastStaff ? empTxt_(lastStaff.Body) : '',
    repliedAt: lastStaff ? empIso_(lastStaff.CreatedAt) : '',
    username: empOwnerUser_(t),
    workerUsername: empTxt_(t.WorkerUsername) || (ch === EMP_CH_INTERNAL ? empOwnerUser_(t) : ''),
    supervisorUsername: empTxt_(t.SupervisorUsername) || (ch === EMP_CH_INTERNAL ? empPeerUser_(t) : '')
  };
}
function empNextTicket_(channel, ths) {
  var p = channel === EMP_CH_CUSTOMER ? 'TC' : channel === EMP_CH_EMPLOYEE ? 'TE' : 'TI';
  var n = ths.filter(function (t) { return empChannel_(t) === channel; }).length + 1;
  return p + '-' + String(n).padStart(6, '0');
}

/* ═════════ 7) UNIFIED MESSAGING — CORE OPS ═════════ */
function empMsgList_(session, channel, opts) {
  var b = empBranchOf_(session);
  var o = opts || {};
  var custIds = empCustomerIds_(empRead_('orders'), b);
  var ths = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);
  var g = empGroupMsgs_(empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS));

  var rows = ths.filter(function (t) {
    if (!empThreadInBranch_(t, b, custIds)) return false;
    if (channel && empChannel_(t) !== channel) return false;
    if (o.status && empState_(t.Status) !== empState_(o.status)) return false;
    return true;
  });

  var out = rows.map(function (t) { return empThreadView_(t, g[empTxt_(t['Thread-ID'])] || [], session); });
  if (o.unreadOnly) out = out.filter(function (v) { return v.unread > 0; });
  if (o.q) {
    var q = empTxt_(o.q).toLowerCase();
    out = out.filter(function (v) {
      return [v.subject, v.ticketNo, v.ownerName, v.ownerUsername, v.threadId, v.preview]
        .some(function (x) { return String(x || '').toLowerCase().indexOf(q) >= 0; });
    });
  }
  out.sort(function (a, b2) { return String(b2.lastMessageAt || b2.createdAt).localeCompare(String(a.lastMessageAt || a.createdAt)); });
  var limit = Number(o.limit || 0);
  return limit > 0 ? out.slice(Number(o.offset || 0), Number(o.offset || 0) + limit) : out;
}

function empMsgFind_(threadId, session) {
  var b = empBranchOf_(session);
  var key = empTxt_(threadId);
  if (!key) throw new Error('شناسه گفتگو مشخص نیست.');
  var ths = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);
  var t = ths.find(function (x) { return empTxt_(x['Thread-ID']) === key; });
  if (!t) t = ths.find(function (x) {
    var lr = empTxt_(x.LegacyRef);
    return lr === 'CC:' + key || lr === 'ES:' + key;
  });
  if (!t) throw new Error('گفتگو یافت نشد.');
  var custIds = empCustomerIds_(empRead_('orders'), b);
  if (!empThreadInBranch_(t, b, custIds)) throw new Error('این گفتگو متعلق به شعبه شما نیست.');
  return t;
}

function empMsgGet_(threadId, session) {
  var t = empMsgFind_(threadId, session);
  var tid = empTxt_(t['Thread-ID']);
  var all = empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS)
    .filter(function (m) { return empTxt_(m['Thread-ID']) === tid && !empTxt_(m.DeletedAt); });
  all.sort(function (a, b) { return String(empIso_(a.CreatedAt)).localeCompare(String(empIso_(b.CreatedAt))); });

  var now = new Date();
  all.forEach(function (m) {
    var mine = empTxt_(m.SenderUsername) === empTxt_(session.username);
    if (!mine && !empTxt_(m.ReadAt)) {
      empPatchRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, m._rowIndex, { ReadAt: now, ReadBy: empTxt_(session.username) });
      m.ReadAt = now; m.ReadBy = empTxt_(session.username);
    }
  });
  var patch = empChannel_(t) === EMP_CH_EMPLOYEE ? { UnreadOwner: 0 } : { UnreadPeer: 0 };
  empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, t._rowIndex, patch);
  if (patch.UnreadOwner !== undefined) t.UnreadOwner = 0; else t.UnreadPeer = 0;

  return {
    thread: empThreadView_(t, all, session),
    messages: all.map(empMsgView_)
  };
}

function empMsgCreate_(session, payload) {
  var p = payload || {};
  var body = empTxt_(p.body);
  if (!body) throw new Error('متن پیام الزامی است.');
  var ch = empTxt_(p.channel) || EMP_CH_INTERNAL;
  var b = empBranchOf_(session);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var ths = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);
    var now = new Date();
    var tid = empUid_('THR');
    var th = {
      'Thread-ID': tid, Channel: ch, TicketNo: empNextTicket_(ch, ths),
      Subject: empTxt_(p.subject) || 'بدون موضوع', Status: 'OPEN',
      Priority: empTxt_(p.priority) || 'عادی', 'Branch-ID': b,
      CreatedAt: now, UpdatedAt: now, LastMessageAt: now, LastMessageBy: empTxt_(session.username),
      LastMessagePreview: body.slice(0, 140), MessageCount: 1, UnreadOwner: 0, UnreadPeer: 1,
      'Card-ID': empTxt_(p.cardId)
    };

    if (ch === EMP_CH_INTERNAL) {
      var card = empRead_('cards').find(function (c) { return empTxt_(c.cardId) === empTxt_(p.cardId) && empTxt_(c.branchId) === b; });
      if (!card) throw new Error('کارت متعلق به شعبه شما نیست.');
      var workers = empRead_('workers');
      var worker = workers.find(function (w) { return empTxt_(w.workerId) === empTxt_(card.workerId); }) || {};
      var group = empRead_('groups').find(function (g) { return empTxt_(g.groupId) === empTxt_(worker.groupId); }) || {};
      var sup = workers.find(function (w) {
        return (empTxt_(group.supervisorName) && empTxt_(w.username) === empTxt_(group.supervisorName)) ||
               (empTxt_(group.workerId) && empTxt_(w.workerId) === empTxt_(group.workerId));
      }) || {};
      th.OwnerRole = 'worker'; th['Owner-ID'] = empTxt_(worker.workerId);
      th.OwnerUsername = empTxt_(worker.username);
      th.OwnerName = [empTxt_(worker.firstName), empTxt_(worker.lastName)].filter(Boolean).join(' ') || empTxt_(worker.username);
      th.PeerRole = 'supervisor'; th['Peer-ID'] = empTxt_(sup.workerId); th.PeerUsername = empTxt_(sup.username);
      th['Worker-ID'] = th['Owner-ID']; th.WorkerUsername = th.OwnerUsername;
      th['Supervisor-ID'] = th['Peer-ID']; th.SupervisorUsername = th.PeerUsername;
      th['Group-ID'] = empTxt_(group.groupId);
      th['Card-ID'] = empTxt_(card.cardId);
      if (!empTxt_(p.subject)) th.Subject = 'پیگیری کارت ' + empTxt_(card.cardId);

    } else if (ch === EMP_CH_EMPLOYEE) {
      th.OwnerRole = 'employee'; th['Owner-ID'] = empTxt_(session.empId);
      th.OwnerUsername = empTxt_(session.username); th.OwnerName = empTxt_(session.name) || empTxt_(session.username);
      th.PeerRole = 'admin'; th['Peer-ID'] = ''; th.PeerUsername = '';

    } else if (ch === EMP_CH_CUSTOMER) {
      var cid = empTxt_(p.customerId);
      if (!cid) throw new Error('شناسه مشتری مشخص نیست.');
      var orders = empRead_('orders');
      var cb = empCustomerBranch_(cid, orders);
      if (cb && cb !== b) throw new Error('این مشتری متعلق به شعبه شما نیست.');
      th.OwnerRole = 'customer'; th['Owner-ID'] = cid;
      var cu = empRead_('customers').find(function (x) { return empTxt_(x.customerId) === cid; });
      th.OwnerUsername = cu ? empTxt_(cu.username) : cid;
      th.OwnerName = empCustomerName_(cid, '', orders);
      th.PeerRole = 'employee'; th['Branch-ID'] = cb || b;

    } else throw new Error('کانال ناشناخته است.');

    empAppendRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, th);
    empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
      'Message-ID': empUid_('MSG'), 'Thread-ID': tid,
      SenderRole: 'employee', 'Sender-ID': empTxt_(session.empId),
      SenderUsername: empTxt_(session.username), SenderName: empTxt_(session.name) || empTxt_(session.username),
      Body: body, CreatedAt: now, MessageType: 'TEXT', 'RelatedCard-ID': empTxt_(th['Card-ID']),
      Channel: ch, 'Branch-ID': empTxt_(th['Branch-ID']), Visibility: 'ALL',
      Attachments: JSON.stringify(p.attachments || [])
    });
    empLog_(session, 'ایجاد گفتگو', th.TicketNo + ' · ' + ch, 'success');
    return { success: true, threadId: tid, ticketNo: th.TicketNo, id: tid };
  } finally { lock.releaseLock(); }
}

function empMsgReply_(session, threadId, body, opts) {
  var o = opts || {};
  var txt = empTxt_(body);
  if (!txt) throw new Error('متن پیام الزامی است.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var t = empMsgFind_(threadId, session);
    var tid = empTxt_(t['Thread-ID']);
    var ch = empChannel_(t);
    var isOwnerSide = (ch === EMP_CH_EMPLOYEE);
    var vis = (o.internalNote && ch !== EMP_CH_EMPLOYEE) ? 'STAFF' : 'ALL';
    var now = new Date();
    var count = empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS)
      .filter(function (m) { return empTxt_(m['Thread-ID']) === tid && !empTxt_(m.DeletedAt); }).length + 1;

    empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
      'Message-ID': empUid_('MSG'), 'Thread-ID': tid,
      SenderRole: 'employee', 'Sender-ID': empTxt_(session.empId),
      SenderUsername: empTxt_(session.username), SenderName: empTxt_(session.name) || empTxt_(session.username),
      Body: txt, CreatedAt: now, MessageType: vis === 'STAFF' ? 'NOTE' : 'TEXT',
      'RelatedCard-ID': empTxt_(t['Card-ID']), Channel: ch, 'Branch-ID': empTxt_(t['Branch-ID']),
      Visibility: vis, Attachments: JSON.stringify(o.attachments || [])
    });

    var patch = {
      UpdatedAt: now, LastMessageAt: now, LastMessageBy: empTxt_(session.username),
      LastMessagePreview: vis === 'STAFF' ? '🔒 یادداشت داخلی' : txt.slice(0, 140),
      MessageCount: count,
      UnreadOwner: isOwnerSide ? 0 : empNum_(t.UnreadOwner) + (vis === 'ALL' ? 1 : 0),
      UnreadPeer:  isOwnerSide ? empNum_(t.UnreadPeer) + 1 : 0
    };
    if (empState_(t.Status) !== 'CLOSED') patch.Status = isOwnerSide ? 'OPEN' : 'ANSWERED';
    if (!empPeerUser_(t) && !isOwnerSide) {
      patch.PeerUsername = empTxt_(session.username);
      patch['Peer-ID'] = empTxt_(session.empId);
      patch.PeerRole = 'employee';
    }
    empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, t._rowIndex, patch);
    empLog_(session, 'پاسخ در گفتگو', empTxt_(t.TicketNo) || tid, 'success');
    return { success: true, threadId: tid, state: patch.Status || empState_(t.Status), message: 'پاسخ ثبت شد.' };
  } finally { lock.releaseLock(); }
}

function empMsgSetStatus_(session, threadId, state) {
  var st = empState_(state);
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var t = empMsgFind_(threadId, session);
    var tid = empTxt_(t['Thread-ID']);
    var now = new Date();
    var patch = { Status: st, UpdatedAt: now };
    if (st === 'CLOSED') { patch.ClosedAt = now; patch.ClosedBy = empTxt_(session.username); }
    else { patch.ClosedAt = ''; patch.ClosedBy = ''; }
    empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, t._rowIndex, patch);
    empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
      'Message-ID': empUid_('MSG'), 'Thread-ID': tid,
      SenderRole: 'system', 'Sender-ID': empTxt_(session.empId),
      SenderUsername: empTxt_(session.username), SenderName: empTxt_(session.name) || empTxt_(session.username),
      Body: st === 'CLOSED' ? 'گفتگو بسته شد.' : st === 'ANSWERED' ? 'وضعیت: پاسخ داده شده.' : 'گفتگو باز شد.',
      CreatedAt: now, MessageType: 'SYSTEM', Channel: empChannel_(t),
      'Branch-ID': empTxt_(t['Branch-ID']), Visibility: 'ALL'
    });
    empLog_(session, 'تغییر وضعیت گفتگو', (empTxt_(t.TicketNo) || tid) + ' → ' + st, 'success');
    return { success: true, state: st };
  } finally { lock.releaseLock(); }
}

function empMsgUnread_(session) {
  var out = { INTERNAL: 0, CUSTOMER_SUPPORT: 0, EMPLOYEE_SUPPORT: 0, total: 0 };
  empMsgList_(session, '').forEach(function (v) {
    if (v.state === 'CLOSED' || v.unread <= 0) return;
    out[v.channel] = (out[v.channel] || 0) + 1;
    out.total++;
  });
  return out;
}

/* ═════════ 8) BOOTSTRAP ═════════ */
function employeeBootstrap(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);

  var ordersAll = empRead_('orders');
  var orders    = ordersAll.filter(function (r) { return empTxt_(r.branchId) === b; });
  var cards     = empRead_('cards').filter(function (r) { return empTxt_(r.branchId) === b; });
  var groups    = empRead_('groups').filter(function (r) { return empTxt_(r.branchId) === b; });
  var workers   = empRead_('workers').filter(function (r) { return empTxt_(r.branchId) === b; });
  var branches  = empRead_('branches').filter(function (r) { return empTxt_(r.branchId) === b; });
  var gids      = groups.map(function (g) { return empTxt_(g.groupId); });
  var members   = empRead_('groupMembers').filter(function (m) { return gids.indexOf(empTxt_(m.groupId)) >= 0; });
  var tasksAll  = empRead_('tasks');

  var custIds   = empCustomerIds_(ordersAll, b);
  var custNames = empCustomerNames_(ordersAll, b);

  var gmap = {}, omap = {};
  groups.forEach(function (g) { gmap[empTxt_(g.groupId)] = empTxt_(g.name); });
  orders.forEach(function (o) { omap[empTxt_(o.requestId)] = o; });

  var cardIds = cards.map(function (c) { return empTxt_(c.cardId); });
  var hist = empRead_('cardHistory').filter(function (h) { return cardIds.indexOf(empTxt_(h.cardId)) >= 0; });

  var applicants = [];
  try {
    if (typeof searchEmployeeJobApplicants === 'function') applicants = searchEmployeeJobApplicants({ branchId: b }, token) || [];
  } catch (e) { applicants = []; }

  var services = empRead_('services');

  return {
    success: true,
    user: empUser_(s),
    data: {
      orders: orders.map(function (r) {
        return {
          rowIndex: r._rowIndex, requestId: empTxt_(r.requestId), createdAt: empIso_(r.createdAt),
          customerId: empTxt_(r.customerId),
          customerName: [empTxt_(r.firstName), empTxt_(r.lastName)].filter(Boolean).join(' ') || empTxt_(r.customerName),
          phone: empTxt_(r.contact), service: empTxt_(r.service), serviceId: empTxt_(r.serviceId),
          city: empTxt_(r.city), province: empTxt_(r.province), branchId: b,
          groupId: empTxt_(r.groupId), groupName: gmap[empTxt_(r.groupId)] || '',
          execDate: empTxt_(r.execDate), execTime: empTxt_(r.execTime),
          finalPrice: empNum_(r.finalPrice), basePrice: empNum_(r.basePrice),
          discount: empNum_(r.discount), tax: empNum_(r.tax),
          status: empTxt_(r.status), actionType: empTxt_(r.actionType),
          verifier: empTxt_(r.verifier), operator: empTxt_(r.operator),
          notes: empTxt_(r.notes), addrFrom: empTxt_(r.addrFrom), cardId: ''
        };
      }).reverse(),
      cards: cards.map(function (c) {
        var o = omap[empTxt_(c.requestId)] || {};
        return {
          rowIndex: c._rowIndex, cardId: empTxt_(c.cardId), requestId: empTxt_(c.requestId),
          customerId: empTxt_(c.customerId), customerName: empTxt_(c.customerName),
          service: empTxt_(c.serviceType), branchId: b,
          groupId: empTxt_(c.groupId) || empTxt_(o.groupId),
          workerId: empTxt_(c.workerId), status: empTxt_(c.status),
          execDate: empTxt_(c.execDate), execTime: empTxt_(c.execTime),
          amount: empNum_(c.total), duration: empTxt_(c.duration),
          address: empTxt_(c.address), notes: empTxt_(c.details),
          createdAt: empIso_(c.createdAt), updatedAt: empIso_(c.updatedAt)
        };
      }).reverse(),
      groups: groups.map(function (g) {
        return {
          rowIndex: g._rowIndex, groupId: empTxt_(g.groupId), branchId: b, name: empTxt_(g.name),
          supervisorName: empTxt_(g.supervisorName), workerId: empTxt_(g.workerId),
          province: empTxt_(g.province), city: empTxt_(g.city), area: empTxt_(g.area),
          groupType: empTxt_(g.groupType), totalMembers: empNum_(g.totalMembers),
          rank: empTxt_(g.rank), status: empTxt_(g.status),
          description: empTxt_(g.description), notes: empTxt_(g.notes)
        };
      }),
      workers: workers.map(function (w) {
        return {
          rowIndex: w._rowIndex, workerId: empTxt_(w.workerId), username: empTxt_(w.username),
          firstName: empTxt_(w.firstName), lastName: empTxt_(w.lastName), branchId: b,
          groupId: empTxt_(w.groupId), jobTitle: empTxt_(w.jobTitle), operations: empTxt_(w.operations),
          specialization: empTxt_(w.specialization), contact: empTxt_(w.contact), email: empTxt_(w.email),
          photo: empTxt_(w.photo), status: empTxt_(w.status), hireDate: empTxt_(w.hireDate),
          birthday: empTxt_(w.birthday), gender: empTxt_(w.gender), nationalId: empTxt_(w.nationalId),
          province: empTxt_(w.province), city: empTxt_(w.city), address: empTxt_(w.address),
          emergencyName: empTxt_(w.emergencyName), emergency: empTxt_(w.emergency),
          fatherName: empTxt_(w.fatherName), birthCert: empTxt_(w.birthCert),
          description: empTxt_(w.description), notes: empTxt_(w.notes)
        };
      }),
      members: members.map(function (m) {
        return {
          rowIndex: m._rowIndex, groupId: empTxt_(m.groupId), workerId: empTxt_(m.workerId),
          username: empTxt_(m.username), role: empTxt_(m.role),
          joinDate: empTxt_(m.joinDate), status: empTxt_(m.status)
        };
      }),
      branches: branches.map(function (x) {
        return {
          rowIndex: x._rowIndex, branchId: empTxt_(x.branchId), name: empTxt_(x.name),
          province: empTxt_(x.province), city: empTxt_(x.city), area: empTxt_(x.area),
          managerName: empTxt_(x.managerName), status: empTxt_(x.status)
        };
      }),
      applicants: applicants,
      support: empMsgList_(s, EMP_CH_CUSTOMER),
      tasks: empTaskRows_(tasksAll, custIds, custNames),
      threads: empMsgList_(s, EMP_CH_INTERNAL),
      adminSupport: empMsgList_(s, EMP_CH_EMPLOYEE),
      messageStats: empMsgUnread_(s),
      cardHistory: hist.map(function (h) {
        return {
          cardId: empTxt_(h.cardId), from: empTxt_(h.from), to: empTxt_(h.to),
          userId: empTxt_(h.userId), at: empIso_(h.date), desc: empTxt_(h.desc)
        };
      }),
      services: services.map(function (v) {
        return { id: empTxt_(v.id), nameFa: empTxt_(v.nameFa), nameEn: empTxt_(v.nameEn), rate: empNum_(v.rate), unit: empTxt_(v.unit) };
      })
    }
  };
}

/* ═════════ 9) DASHBOARD ═════════ */
function getEmployeeDashboard(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var orders = empRead_('orders').filter(function (r) { return empTxt_(r.branchId) === b; });
  var cards  = empRead_('cards').filter(function (r) { return empTxt_(r.branchId) === b; });
  return {
    totalOrders: orders.length,
    pendingOrders: orders.filter(function (r) { return /جدید|ثبت اولیه/.test(empTxt_(r.status)); }).length,
    completedOrders: orders.filter(function (r) { return /تکمیل/.test(empTxt_(r.status)); }).length,
    totalRevenue: orders.reduce(function (sum, r) { return sum + empNum_(r.finalPrice); }, 0),
    activeCards: cards.filter(function (r) { return !/تکمیل|لغو/.test(empTxt_(r.status)); }).length,
    messages: empMsgUnread_(s)
  };
}

/* ═════════ 10) ORDERS ═════════ */
function getEmployeeOrders(filters, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var rows = empRead_('orders').filter(function (r) { return empTxt_(r.branchId) === b; });
  var f = filters || {};

  if (f.fromDate) { var k1 = empKey_(f.fromDate); if (k1) rows = rows.filter(function (r) { var k = empKey_(empDispDate_(r.createdAt)); return k && k >= k1; }); }
  if (f.toDate)   { var k2 = empKey_(f.toDate);   if (k2) rows = rows.filter(function (r) { var k = empKey_(empDispDate_(r.createdAt)); return k && k <= k2; }); }
  if (f.customerId) rows = rows.filter(function (r) { return empTxt_(r.customerId).toLowerCase().indexOf(empTxt_(f.customerId).toLowerCase()) >= 0; });
  if (f.requestId)  rows = rows.filter(function (r) { return empTxt_(r.requestId).toLowerCase().indexOf(empTxt_(f.requestId).toLowerCase()) >= 0; });
  if (f.groupId)    rows = rows.filter(function (r) { return empTxt_(r.groupId).toLowerCase().indexOf(empTxt_(f.groupId).toLowerCase()) >= 0; });
  if (f.status && f.status !== 'همه') rows = rows.filter(function (r) { return empTxt_(r.status) === f.status; });

  var groups = empRead_('groups'), workers = empRead_('workers');
  var cmap = {};
  empRead_('cards').forEach(function (c) { cmap[empTxt_(c.requestId)] = empTxt_(c.cardId); });

  return rows.map(function (r) {
    var g = groups.find(function (x) { return empTxt_(x.groupId) === empTxt_(r.groupId); });
    var w = workers.find(function (x) { return empTxt_(x.workerId) === empTxt_(r.operator); });
    return {
      rowIndex: r._rowIndex, requestId: empTxt_(r.requestId),
      date: empDispDateTime_(r.createdAt), createdAt: empIso_(r.createdAt),
      customer: [empTxt_(r.firstName), empTxt_(r.lastName)].filter(Boolean).join(' '),
      customerName: [empTxt_(r.firstName), empTxt_(r.lastName)].filter(Boolean).join(' '),
      customerId: empTxt_(r.customerId), phone: empTxt_(r.contact), service: empTxt_(r.service),
      status: empTxt_(r.status), finalPrice: empNum_(r.finalPrice),
      basePrice: empNum_(r.basePrice), discount: empNum_(r.discount), tax: empNum_(r.tax),
      execDate: empTxt_(r.execDate), execTime: empTxt_(r.execTime),
      city: empTxt_(r.city), addrFrom: empTxt_(r.addrFrom), notes: empTxt_(r.notes),
      actionType: empTxt_(r.actionType), verifier: empTxt_(r.verifier),
      groupId: empTxt_(r.groupId), groupName: g ? empTxt_(g.name) : '—',
      cardId: cmap[empTxt_(r.requestId)] || '',
      operatorId: empTxt_(r.operator),
      operatorName: w ? [empTxt_(w.firstName), empTxt_(w.lastName)].filter(Boolean).join(' ') : (empTxt_(r.operator) ? 'اپراتور' : 'مشتری')
    };
  }).reverse();
}

function updateEmployeeOrderStatus(requestId, newStatus, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var st = empTxt_(newStatus);
  if (EMP_ORDER_STATUS.indexOf(st) < 0) throw new Error('وضعیت انتخاب‌شده معتبر نیست.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var order = empRead_('orders').find(function (r) { return empTxt_(r.requestId) === empTxt_(requestId) && empTxt_(r.branchId) === b; });
    if (!order) throw new Error('سفارش یافت نشد یا متعلق به شعبه شما نیست.');
    scUpdate_('orders', order._rowIndex, { status: st });
    empLog_(s, 'تغییر وضعیت سفارش', requestId + ' → ' + st, 'success');
    return { success: true, message: 'وضعیت تغییر یافت.' };
  } finally { lock.releaseLock(); }
}

/* ═════════ 11) CONVERT ORDER → CARD ═════════ */
function getGroupsForDropdownEmp(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  return empRead_('groups')
    .filter(function (g) { return empTxt_(g.branchId) === b && EMP_ACTIVE_RX.test(empTxt_(g.status)); })
    .map(function (g) { return { groupId: empTxt_(g.groupId), name: empTxt_(g.name) }; });
}

function getWorkersByGroupEmp(groupId, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var group = empRead_('groups').find(function (g) { return empTxt_(g.groupId) === empTxt_(groupId) && empTxt_(g.branchId) === b; });
  if (!group) throw new Error('گروه یافت نشد یا متعلق به شعبه شما نیست.');
  var members = empRead_('groupMembers').filter(function (m) { return empTxt_(m.groupId) === empTxt_(groupId) && EMP_ACTIVE_RX.test(empTxt_(m.status)); });
  return empRead_('workers')
    .filter(function (w) { return empTxt_(w.branchId) === b && EMP_ACTIVE_RX.test(empTxt_(w.status)) && members.some(function (m) { return empTxt_(m.username) === empTxt_(w.username); }); })
    .map(function (w) { return { id: empTxt_(w.workerId), name: [empTxt_(w.firstName), empTxt_(w.lastName)].filter(Boolean).join(' '), operations: empTxt_(w.operations) }; });
}

function employeeConvertOrderToCard(requestId, groupId, workerId, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var order = empRead_('orders').find(function (r) { return empTxt_(r.requestId) === empTxt_(requestId); });
    if (!order) throw new Error('سفارش یافت نشد.');
    if (empTxt_(order.branchId) !== b) throw new Error('این سفارش متعلق به شعبه شما نیست.');

    var group = empRead_('groups').find(function (g) { return empTxt_(g.groupId) === empTxt_(groupId); });
    if (!group || empTxt_(group.branchId) !== b) throw new Error('گروه انتخاب‌شده معتبر نیست.');

    var workers = empRead_('workers');
    if (workerId) {
      var w = workers.find(function (x) { return empTxt_(x.workerId) === empTxt_(workerId); });
      if (!w || empTxt_(w.branchId) !== b) throw new Error('نیروی انتخاب‌شده متعلق به شعبه شما نیست.');
      var inGroup = empRead_('groupMembers').some(function (m) { return empTxt_(m.groupId) === empTxt_(groupId) && empTxt_(m.username) === empTxt_(w.username); });
      if (!inGroup) throw new Error('نیروی انتخاب‌شده عضو این گروه نیست.');
    }

    var newCardId = 'CRD-' + Date.now().toString(36).toUpperCase();
    scAppend_('cards', {
      cardId: newCardId, requestId: empTxt_(order.requestId), listId: '',
      customerId: empTxt_(order.customerId), branchId: b, verifier: s.username,
      workerId: empTxt_(workerId) || '',
      customerName: [empTxt_(order.firstName), empTxt_(order.lastName)].filter(Boolean).join(' '),
      serviceType: empTxt_(order.service), actionType: empTxt_(order.actionType) || 'عادی',
      total: empNum_(order.finalPrice), execDate: empTxt_(order.execDate), execTime: empTxt_(order.execTime),
      address: empTxt_(order.addrFrom), details: empTxt_(order.notes),
      status: workerId ? 'تخصیص به کارگر' : 'تخصیص به گروه', createdAt: new Date()
    });
    scUpdate_('orders', order._rowIndex, { status: 'تبدیل به کارت', groupId: empTxt_(groupId) });
    try { scAppend_('cardHistory', { cardId: newCardId, from: '', to: 'ایجاد', userId: s.username, date: new Date(), desc: 'ایجاد از سفارش ' + requestId }); } catch (e) {}
    empLog_(s, 'تبدیل سفارش به کارت', requestId + ' → ' + newCardId, 'success');

    if (workerId) empNotifyWorker_(workers, workerId, newCardId, order);
    return { success: true, message: 'کارت با موفقیت ایجاد و تخصیص داده شد.', cardId: newCardId };
  } finally { lock.releaseLock(); }
}

function empNotifyWorker_(workers, workerId, cardId, order) {
  try {
    var w = workers.find(function (x) { return empTxt_(x.workerId) === empTxt_(workerId); });
    if (!w || !empTxt_(w.contact)) return;
    var phone = String(empTxt_(w.contact)).replace(/\D/g, '');
    if (phone.indexOf('0') === 0) phone = '98' + phone.substring(1);
    if (phone.indexOf('9') === 0 && phone.length === 10) phone = '98' + phone;
    var accessKey = empSetting_('BALE_API_ACCESS_KEY', '');
    var botId = Number(empSetting_('BALE_WORKER_BOT_ID', '0'));
    if (!accessKey || !botId) return;
    var text = '🎫 <b>کارت جدید به شما تخصیص یافت</b>\n\n' +
      '🆔 کارت: <code>' + cardId + '</code>\n' +
      '👤 مشتری: ' + [empTxt_(order.firstName), empTxt_(order.lastName)].filter(Boolean).join(' ') + '\n' +
      '🛠 خدمت: ' + empTxt_(order.service) + '\n' +
      '💰 مبلغ: ' + new Intl.NumberFormat('fa-IR').format(empNum_(order.finalPrice)) + ' ریال';
    UrlFetchApp.fetch('https://safir.bale.ai/api/v3/send_message', {
      method: 'post', contentType: 'application/json',
      headers: { 'api-access-key': accessKey },
      payload: JSON.stringify({
        request_id: 'assign-' + Date.now(), bot_id: botId, phone_number: phone,
        message_data: { message: { text: text } }
      }),
      muteHttpExceptions: true
    });
  } catch (e) { console.error('Bale notification error:', e.message); }
}

/* ═════════ 12) CARDS ═════════ */
function getEmployeeCards(filters, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var rows = empRead_('cards').filter(function (r) { return empTxt_(r.branchId) === b; });
  var f = filters || {};

  if (f.fromDate) { var k1 = empKey_(f.fromDate); if (k1) rows = rows.filter(function (r) { var k = empKey_(empDispDate_(r.createdAt)); return k && k >= k1; }); }
  if (f.toDate)   { var k2 = empKey_(f.toDate);   if (k2) rows = rows.filter(function (r) { var k = empKey_(empDispDate_(r.createdAt)); return k && k <= k2; }); }
  if (f.customerId) rows = rows.filter(function (r) { return empTxt_(r.customerId).toLowerCase().indexOf(empTxt_(f.customerId).toLowerCase()) >= 0; });
  if (f.cardId)     rows = rows.filter(function (r) { return empTxt_(r.cardId).toLowerCase().indexOf(empTxt_(f.cardId).toLowerCase()) >= 0; });
  if (f.status && f.status !== 'همه') rows = rows.filter(function (r) { return empTxt_(r.status) === f.status; });

  var orders = empRead_('orders'), groups = empRead_('groups'), workers = empRead_('workers');
  var omap = {}; orders.forEach(function (o) { omap[empTxt_(o.requestId)] = o; });
  var gmap = {}; groups.forEach(function (g) { gmap[empTxt_(g.groupId)] = empTxt_(g.name); });

  if (f.groupId) {
    var q = empTxt_(f.groupId).toLowerCase();
    var allowed = orders.filter(function (o) { return empTxt_(o.groupId).toLowerCase().indexOf(q) >= 0; }).map(function (o) { return empTxt_(o.requestId); });
    rows = rows.filter(function (r) { return allowed.indexOf(empTxt_(r.requestId)) >= 0; });
  }

  return rows.map(function (r) {
    var w = workers.find(function (x) { return empTxt_(x.workerId) === empTxt_(r.workerId); });
    var o = omap[empTxt_(r.requestId)] || {};
    var gid = empTxt_(r.groupId) || empTxt_(o.groupId);
    return {
      rowIndex: r._rowIndex, cardId: empTxt_(r.cardId), requestId: empTxt_(r.requestId),
      customer: empTxt_(r.customerName), customerName: empTxt_(r.customerName),
      details: empTxt_(r.details) || empTxt_(r.serviceType), service: empTxt_(r.serviceType),
      amount: empNum_(r.total), workerId: empTxt_(r.workerId),
      workerName: w ? [empTxt_(w.firstName), empTxt_(w.lastName)].filter(Boolean).join(' ') : '—',
      groupId: gid, groupName: gmap[gid] || '—', status: empTxt_(r.status),
      execDate: empTxt_(r.execDate), execTime: empTxt_(r.execTime),
      address: empTxt_(r.address), createdAt: empIso_(r.createdAt)
    };
  }).reverse();
}

function employeeUpdateCardStatus(cardId, newStatus, workerId, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var st = empTxt_(newStatus);
  if (EMP_CARD_STATUS.indexOf(st) < 0) throw new Error('وضعیت کارت معتبر نیست.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var card = empRead_('cards').find(function (c) { return empTxt_(c.cardId) === empTxt_(cardId); });
    if (!card) throw new Error('کارت یافت نشد.');
    if (empTxt_(card.branchId) !== b) throw new Error('این کارت متعلق به شعبه شما نیست.');

    var payload = { status: st, updatedAt: new Date() };
    var note = '';
    if (workerId) {
      var w = empRead_('workers').find(function (x) { return empTxt_(x.workerId) === empTxt_(workerId) && empTxt_(x.branchId) === b; });
      if (!w) throw new Error('نیرو متعلق به شعبه شما نیست.');
      payload.workerId = empTxt_(workerId);
      note = 'اجراکننده: ' + [empTxt_(w.firstName), empTxt_(w.lastName)].filter(Boolean).join(' ');
    }
    var old = empTxt_(card.status);
    scUpdate_('cards', card._rowIndex, payload);
    try { scAppend_('cardHistory', { cardId: empTxt_(cardId), from: old, to: st, userId: s.username, date: new Date(), desc: note || 'تغییر توسط کارمند شعبه' }); } catch (e) {}

    if (st === 'تکمیل شده' || st === 'لغو شده') {
      var o = empRead_('orders').find(function (x) { return empTxt_(x.requestId) === empTxt_(card.requestId) && empTxt_(x.branchId) === b; });
      if (o) { try { scUpdate_('orders', o._rowIndex, { status: st }); } catch (e) {} }
    }
    empLog_(s, 'تغییر وضعیت کارت', cardId + ': ' + old + ' → ' + st, 'success');
    return { success: true, message: 'وضعیت کارت ثبت شد.' };
  } finally { lock.releaseLock(); }
}

/* ═════════ 13) GROUPS ═════════ */
function getEmployeeGroups(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  return empRead_('groups').filter(function (r) { return empTxt_(r.branchId) === b; }).map(function (r) {
    return {
      rowIndex: r._rowIndex, groupId: empTxt_(r.groupId), branchId: b, workerId: empTxt_(r.workerId),
      supervisorName: empTxt_(r.supervisorName), name: empTxt_(r.name), province: empTxt_(r.province),
      city: empTxt_(r.city), area: empTxt_(r.area), groupType: empTxt_(r.groupType),
      totalMembers: empNum_(r.totalMembers), rank: empTxt_(r.rank),
      description: empTxt_(r.description), notes: empTxt_(r.notes), status: empTxt_(r.status)
    };
  });
}

function saveEmployeeGroup(data, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var d = data || {};
  if (!empTxt_(d.name)) throw new Error('نام گروه الزامی است.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var payload = {
      name: empTxt_(d.name), supervisorName: empTxt_(d.supervisorName), workerId: empTxt_(d.workerId),
      province: empTxt_(d.province), city: empTxt_(d.city), area: empTxt_(d.area),
      groupType: empTxt_(d.groupType), totalMembers: empNum_(d.totalMembers), rank: empTxt_(d.rank),
      status: empTxt_(d.status) || 'فعال', description: empTxt_(d.description), notes: empTxt_(d.notes),
      branchId: b
    };
    if (d.rowIndex) {
      var g = empRead_('groups').find(function (x) { return Number(x._rowIndex) === Number(d.rowIndex); });
      if (!g || empTxt_(g.branchId) !== b) throw new Error('گروه متعلق به شعبه شما نیست.');
      scUpdate_('groups', d.rowIndex, payload);
    } else {
      payload.groupId = empTxt_(d.groupId) || ('GRP-' + Date.now().toString(36).toUpperCase());
      scAppend_('groups', payload);
    }
    empLog_(s, 'ذخیره گروه', payload.groupId || payload.name, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function deleteEmployeeGroup(rowIndex, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var g = empRead_('groups').find(function (x) { return Number(x._rowIndex) === Number(rowIndex); });
  if (!g || empTxt_(g.branchId) !== b) throw new Error('گروه متعلق به شعبه شما نیست.');
  scDelete_('groups', [Number(rowIndex)]);
  empLog_(s, 'حذف گروه', empTxt_(g.groupId), 'success');
  return { success: true };
}

/* ═════════ 14) GROUP MEMBERS ═════════ */
function getEmployeeGroupMembers(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var gids = empRead_('groups').filter(function (g) { return empTxt_(g.branchId) === b; }).map(function (g) { return empTxt_(g.groupId); });
  return empRead_('groupMembers').filter(function (m) { return gids.indexOf(empTxt_(m.groupId)) >= 0; }).map(function (m) {
    return {
      rowIndex: m._rowIndex, groupId: empTxt_(m.groupId), workerId: empTxt_(m.workerId),
      username: empTxt_(m.username), role: empTxt_(m.role),
      joinDate: empTxt_(m.joinDate), status: empTxt_(m.status)
    };
  });
}

function employeeSaveGroupMember(data, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var d = data || {};
  var g = empRead_('groups').find(function (x) { return empTxt_(x.groupId) === empTxt_(d.groupId) && empTxt_(x.branchId) === b; });
  if (!g) throw new Error('گروه متعلق به شعبه شما نیست.');
  var w = empRead_('workers').find(function (x) { return empTxt_(x.workerId) === empTxt_(d.workerId) && empTxt_(x.branchId) === b; });
  if (!w) throw new Error('نیرو متعلق به شعبه شما نیست.');
  var role = empTxt_(d.role) || 'member';
  if (EMP_MEMBER_ROLES.indexOf(role) < 0) throw new Error('نقش عضو معتبر نیست.');

  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var payload = {
      groupId: empTxt_(d.groupId), workerId: empTxt_(w.workerId), username: empTxt_(w.username),
      role: role, joinDate: empTxt_(d.joinDate), status: empTxt_(d.status) || 'فعال'
    };
    var gids = empRead_('groups').filter(function (x) { return empTxt_(x.branchId) === b; }).map(function (x) { return empTxt_(x.groupId); });
    if (d.rowIndex) {
      var m = empRead_('groupMembers').find(function (x) { return Number(x._rowIndex) === Number(d.rowIndex); });
      if (!m || gids.indexOf(empTxt_(m.groupId)) < 0) throw new Error('عضویت متعلق به شعبه شما نیست.');
      scUpdate_('groupMembers', d.rowIndex, payload);
    } else {
      var dup = empRead_('groupMembers').some(function (x) { return empTxt_(x.groupId) === payload.groupId && empTxt_(x.username) === payload.username; });
      if (dup) throw new Error('این نیرو قبلاً عضو همین گروه است.');
      scAppend_('groupMembers', payload);
    }
    empLog_(s, 'ذخیره عضو گروه', payload.groupId + ' ← ' + payload.workerId, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function employeeDeleteGroupMember(rowIndex, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var m = empRead_('groupMembers').find(function (x) { return Number(x._rowIndex) === Number(rowIndex); });
  if (!m) throw new Error('عضویت یافت نشد.');
  var g = empRead_('groups').find(function (x) { return empTxt_(x.groupId) === empTxt_(m.groupId); });
  if (!g || empTxt_(g.branchId) !== b) throw new Error('دسترسی غیرمجاز.');
  scDelete_('groupMembers', [Number(rowIndex)]);
  empLog_(s, 'حذف عضو گروه', String(rowIndex), 'success');
  return { success: true };
}

/* ═════════ 15) WORKERS ═════════ */
function getEmployeeWorkers(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  return empRead_('workers').filter(function (r) { return empTxt_(r.branchId) === b; }).map(function (r) {
    return {
      rowIndex: r._rowIndex, workerId: empTxt_(r.workerId), username: empTxt_(r.username),
      firstName: empTxt_(r.firstName), lastName: empTxt_(r.lastName), branchId: b,
      groupId: empTxt_(r.groupId), jobTitle: empTxt_(r.jobTitle), operations: empTxt_(r.operations),
      specialization: empTxt_(r.specialization), contact: empTxt_(r.contact), email: empTxt_(r.email),
      photo: empTxt_(r.photo), status: empTxt_(r.status), hireDate: empTxt_(r.hireDate),
      birthday: empTxt_(r.birthday), gender: empTxt_(r.gender), nationalId: empTxt_(r.nationalId),
      province: empTxt_(r.province), city: empTxt_(r.city), address: empTxt_(r.address),
      emergencyName: empTxt_(r.emergencyName), emergency: empTxt_(r.emergency),
      fatherName: empTxt_(r.fatherName), birthCert: empTxt_(r.birthCert),
      description: empTxt_(r.description), notes: empTxt_(r.notes)
    };
  });
}

function saveEmployeeWorker(data, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var d = data || {};
  if (!empTxt_(d.firstName) || !empTxt_(d.lastName)) throw new Error('نام و نام خانوادگی الزامی است.');
  if (!empTxt_(d.username)) throw new Error('نام کاربری الزامی است.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var payload = {
      firstName: empTxt_(d.firstName), lastName: empTxt_(d.lastName), fatherName: empTxt_(d.fatherName),
      gender: empTxt_(d.gender), nationalId: empTxt_(d.nationalId), birthCert: empTxt_(d.birthCert),
      birthday: empTxt_(d.birthday), username: empTxt_(d.username), operations: empTxt_(d.operations),
      jobTitle: empTxt_(d.jobTitle), specialization: empTxt_(d.specialization), email: empTxt_(d.email),
      contact: empTxt_(d.contact), photo: empTxt_(d.photo), province: empTxt_(d.province),
      city: empTxt_(d.city), hireDate: empTxt_(d.hireDate), status: empTxt_(d.status) || 'فعال',
      emergencyName: empTxt_(d.emergencyName), emergency: empTxt_(d.emergency), address: empTxt_(d.address),
      description: empTxt_(d.description), notes: empTxt_(d.notes), groupId: empTxt_(d.groupId), branchId: b
    };
    if (empTxt_(d.password)) payload.password = empTxt_(d.password);

    if (d.rowIndex) {
      var w = empRead_('workers').find(function (x) { return Number(x._rowIndex) === Number(d.rowIndex); });
      if (!w || empTxt_(w.branchId) !== b) throw new Error('نیرو متعلق به شعبه شما نیست.');
      scUpdate_('workers', d.rowIndex, payload);
    } else {
      if (!empTxt_(d.password)) throw new Error('رمز عبور برای نیروی جدید الزامی است.');
      var dup = empRead_('workers').some(function (x) { return empTxt_(x.username).toLowerCase() === payload.username.toLowerCase(); });
      if (dup) throw new Error('این نام کاربری قبلاً ثبت شده است.');
      payload.workerId = empTxt_(d.workerId) || ('WRK-' + Date.now().toString(36).toUpperCase());
      scAppend_('workers', payload);
    }
    empLog_(s, 'ذخیره نیرو', payload.workerId || payload.username, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function deleteEmployeeWorker(rowIndex, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var w = empRead_('workers').find(function (x) { return Number(x._rowIndex) === Number(rowIndex); });
  if (!w || empTxt_(w.branchId) !== b) throw new Error('نیرو متعلق به شعبه شما نیست.');
  scDelete_('workers', [Number(rowIndex)]);
  empLog_(s, 'حذف نیرو', empTxt_(w.workerId), 'success');
  return { success: true };
}

/* ═════════ 16) TASKS ═════════ */
function getEmployeeTasks(token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var orders = empRead_('orders');
  return empTaskRows_(empRead_('tasks'), empCustomerIds_(orders, b), empCustomerNames_(orders, b));
}

function employeeSaveTask(data, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var d = data || {};
  var orders = empRead_('orders');
  var custIds = empCustomerIds_(orders, b);
  if (!custIds[empTxt_(d.customerId)]) throw new Error('مشتری متعلق به شعبه شما نیست.');
  if (!empTxt_(d.execDate)) throw new Error('تاریخ اجرا الزامی است.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var payload = {
      customerId: empTxt_(d.customerId), execDate: empTxt_(d.execDate), execTime: empTxt_(d.execTime),
      recType: empTxt_(d.recType) || 'بدون تکرار', status: empTxt_(d.status) || 'جدید', notes: empTxt_(d.notes)
    };
    if (EMP_TASK_STATUS.indexOf(payload.status) < 0) throw new Error('وضعیت تسک معتبر نیست.');
    if (d.rowIndex) {
      var t = empRead_('tasks').find(function (x) { return Number(x._rowIndex) === Number(d.rowIndex); });
      if (!t || !custIds[empTxt_(t.customerId)]) throw new Error('دسترسی غیرمجاز.');
      scUpdate_('tasks', d.rowIndex, payload);
    } else {
      payload.taskId = empTxt_(d.taskId) || ('TSK-' + Date.now().toString(36).toUpperCase());
      scAppend_('tasks', payload);
    }
    empLog_(s, 'ذخیره تسک', payload.taskId || String(d.rowIndex), 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function employeeDeleteTask(rowIndex, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var custIds = empCustomerIds_(empRead_('orders'), b);
  var t = empRead_('tasks').find(function (x) { return Number(x._rowIndex) === Number(rowIndex); });
  if (!t || !custIds[empTxt_(t.customerId)]) throw new Error('دسترسی غیرمجاز.');
  scDelete_('tasks', [Number(rowIndex)]);
  empLog_(s, 'حذف تسک', String(rowIndex), 'success');
  return { success: true };
}

/* ═════════ 17) HIRE APPLICANT ═════════ */
function employeeHireApplicant(caseNumber, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var id = empTxt_(caseNumber);
  if (!id) throw new Error('شماره پرونده مشخص نیست.');
  if (typeof searchEmployeeJobApplicants !== 'function') throw new Error('ماژول کارجو در پروژه نصب نیست.');

  var list = searchEmployeeJobApplicants({ branchId: b, caseNumber: id }, token) || [];
  var a = list.find(function (x) { return empTxt_(x.caseNumber) === id; });
  if (!a) throw new Error('پرونده یافت نشد یا متعلق به شعبه شما نیست.');
  if (empTxt_(a.status) === 'استخدام شده') throw new Error('این پرونده قبلاً استخدام شده است.');

  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var base = (empTxt_(a.firstName) + empTxt_(a.lastName)).toLowerCase().replace(/[^a-z0-9]/g, '') || 'worker';
    var username = base + Math.floor(100 + Math.random() * 900);
    var pass = 'ZV' + Math.floor(100000 + Math.random() * 900000);
    var workerId = 'WRK-' + Date.now().toString(36).toUpperCase();

    scAppend_('workers', {
      workerId: workerId, firstName: empTxt_(a.firstName), lastName: empTxt_(a.lastName),
      username: username, password: pass, operations: 'worker',
      jobTitle: empTxt_(a.requestedPosition) || 'نیروی خدمات', specialization: empTxt_(a.specialty),
      contact: empTxt_(a.phone), gender: empTxt_(a.gender), birthday: empTxt_(a.birthDate),
      province: empTxt_(a.province), city: empTxt_(a.city), address: empTxt_(a.address),
      hireDate: new Date().toISOString().slice(0, 10), status: 'فعال', branchId: b,
      notes: 'ایجاد خودکار از پرونده جذب ' + id
    });

    if (typeof updateEmployeeJobApplicantFull === 'function') {
      var changes = {};
      Object.keys(a).forEach(function (k) { if (k !== 'rowIndex') changes[k] = a[k]; });
      changes.status = 'استخدام شده';
      updateEmployeeJobApplicantFull(id, changes, token);
    }
    empLog_(s, 'استخدام کارجو', id + ' → ' + workerId, 'success');
    return { success: true, workerId: workerId, username: username, password: pass, message: 'کارجو استخدام و نیروی جدید ایجاد شد.' };
  } finally { lock.releaseLock(); }
}

/* ═════════ 18) CUSTOMER SUPPORT — رشته‌پیام (سازگار با نام‌های قبلی) ═════════ */
function getEmployeeCustomerSupport(token) {
  return empMsgList_(checkEmployeeAuth(token), EMP_CH_CUSTOMER);
}
function getCustomerConversationsForEmployee(token) {
  return getEmployeeCustomerSupport(token);
}
/** پاسخ جدید اضافه می‌شود (نه بازنویسی) — چندبار پاسخ پشتیبانی می‌شود */
function replyToCustomerConversation(conversationId, replyText, token) {
  var s = checkEmployeeAuth(token);
  return empMsgReply_(s, conversationId, replyText, {});
}
function getUnansweredCustomerCount(token) {
  return getEmployeeCustomerSupport(token).filter(function (m) { return m.state === 'OPEN'; }).length;
}
function employeeCustomerSupportClose(conversationId, token) {
  return empMsgSetStatus_(checkEmployeeAuth(token), conversationId, 'CLOSED');
}
function employeeCustomerSupportReopen(conversationId, token) {
  return empMsgSetStatus_(checkEmployeeAuth(token), conversationId, 'OPEN');
}

/* ═════════ 19) ORGANIZATIONAL THREADS — سازگار با نام‌های قبلی ═════════ */
function getEmployeeThreads(token) {
  return empMsgList_(checkEmployeeAuth(token), EMP_CH_INTERNAL);
}
function employeeGetThread(threadId, token) {
  return empMsgGet_(threadId, checkEmployeeAuth(token));
}
function employeeReplyThread(threadId, body, token) {
  return empMsgReply_(checkEmployeeAuth(token), threadId, body, {});
}
function employeeCreateThread(cardId, subject, body, token) {
  return empMsgCreate_(checkEmployeeAuth(token), { channel: EMP_CH_INTERNAL, cardId: cardId, subject: subject, body: body });
}
function employeeThreadStatus(threadId, state, token) {
  return empMsgSetStatus_(checkEmployeeAuth(token), threadId, state);
}

/* ═════════ 20) SUPPORT → ADMIN — رشته‌پیام ═════════ */
function employeeSendSupportMessage(subject, body, token) {
  var r = empMsgCreate_(checkEmployeeAuth(token), { channel: EMP_CH_EMPLOYEE, subject: subject, body: body });
  return { success: true, id: r.threadId, threadId: r.threadId, ticketNo: r.ticketNo, message: 'پیام شما به پشتیبانی ارسال شد.' };
}
function employeeGetSupportMessages(token) {
  return empMsgList_(checkEmployeeAuth(token), EMP_CH_EMPLOYEE);
}
/** ادامه گفتگو با پشتیبانی — پیام جدید در همان تیکت */
function employeeSupportReply(threadId, body, token) {
  return empMsgReply_(checkEmployeeAuth(token), threadId, body, {});
}
function employeeSupportClose(threadId, token) {
  return empMsgSetStatus_(checkEmployeeAuth(token), threadId, 'CLOSED');
}

/* ═════════ 21) PUBLIC THREADED API (برای UI چت مشترک) ═════════ */
function employeeMessages(token, channel, opts) {
  var s = checkEmployeeAuth(token);
  var items = empMsgList_(s, empTxt_(channel), opts || {});
  return { success: true, total: items.length, items: items };
}
function employeeMessageGet(token, threadId) {
  var r = empMsgGet_(threadId, checkEmployeeAuth(token));
  return { success: true, thread: r.thread, messages: r.messages };
}
function employeeMessageReply(token, threadId, body, opts) {
  return empMsgReply_(checkEmployeeAuth(token), threadId, body, opts || {});
}
function employeeMessageCreate(token, payload) {
  var p = payload || {};
  var ch = empTxt_(p.channel) || EMP_CH_INTERNAL;
  if (ch === EMP_CH_CUSTOMER && !empTxt_(p.customerId)) throw new Error('شناسه مشتری الزامی است.');
  return empMsgCreate_(checkEmployeeAuth(token), p);
}
function employeeMessageStatus(token, threadId, state) {
  return empMsgSetStatus_(checkEmployeeAuth(token), threadId, state);
}
function employeeMessageUnread(token) {
  return empMsgUnread_(checkEmployeeAuth(token));
}
/** ویرایش پیام خود (تا ۱۵ دقیقه) */
function employeeMessageEdit(token, messageId, body) {
  var s = checkEmployeeAuth(token);
  var txt = empTxt_(body);
  if (!txt) throw new Error('متن پیام الزامی است.');
  var m = empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS).find(function (x) { return empTxt_(x['Message-ID']) === empTxt_(messageId); });
  if (!m) throw new Error('پیام یافت نشد.');
  if (empTxt_(m.SenderUsername) !== empTxt_(s.username)) throw new Error('فقط پیام خودتان قابل ویرایش است.');
  if ((Date.now() - new Date(m.CreatedAt).getTime()) / 60000 > 15) throw new Error('مهلت ویرایش این پیام گذشته است.');
  empPatchRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, m._rowIndex, { Body: txt, EditedAt: new Date() });
  return { success: true };
}
/** حذف نرم پیام خود */
function employeeMessageDelete(token, messageId) {
  var s = checkEmployeeAuth(token);
  var m = empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS).find(function (x) { return empTxt_(x['Message-ID']) === empTxt_(messageId); });
  if (!m) throw new Error('پیام یافت نشد.');
  if (empTxt_(m.SenderUsername) !== empTxt_(s.username)) throw new Error('فقط پیام خودتان قابل حذف است.');
  empMsgFind_(empTxt_(m['Thread-ID']), s); // بررسی تعلق به شعبه
  empPatchRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, m._rowIndex, { DeletedAt: new Date(), Body: '' });
  return { success: true };
}

/* ═════════ 22) BULK STATUS ═════════ */
function employeeBulkStatus(entity, ids, status, token) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var list = ids || [];
  var st = empTxt_(status);
  if (!list.length) throw new Error('هیچ موردی انتخاب نشده است.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var done = 0;
    if (entity === 'orders') {
      if (EMP_ORDER_STATUS.indexOf(st) < 0) throw new Error('وضعیت معتبر نیست.');
      var os = empRead_('orders');
      list.forEach(function (id) {
        var r = os.find(function (x) { return Number(x._rowIndex) === Number(id) && empTxt_(x.branchId) === b; });
        if (r) { scUpdate_('orders', r._rowIndex, { status: st }); done++; }
      });
    } else if (entity === 'cards') {
      if (EMP_CARD_STATUS.indexOf(st) < 0) throw new Error('وضعیت معتبر نیست.');
      var cs = empRead_('cards');
      list.forEach(function (id) {
        var r = cs.find(function (x) { return Number(x._rowIndex) === Number(id) && empTxt_(x.branchId) === b; });
        if (r) {
          scUpdate_('cards', r._rowIndex, { status: st, updatedAt: new Date() });
          try { scAppend_('cardHistory', { cardId: empTxt_(r.cardId), from: empTxt_(r.status), to: st, userId: s.username, date: new Date(), desc: 'تغییر گروهی' }); } catch (e) {}
          done++;
        }
      });
    } else if (entity === 'tasks') {
      if (EMP_TASK_STATUS.indexOf(st) < 0) throw new Error('وضعیت معتبر نیست.');
      var cust = empCustomerIds_(empRead_('orders'), b);
      var ts = empRead_('tasks');
      list.forEach(function (id) {
        var r = ts.find(function (x) { return Number(x._rowIndex) === Number(id) && cust[empTxt_(x.customerId)]; });
        if (r) { scUpdate_('tasks', r._rowIndex, { status: st }); done++; }
      });
    } else if (entity === 'members') {
      var gids = empRead_('groups').filter(function (g) { return empTxt_(g.branchId) === b; }).map(function (g) { return empTxt_(g.groupId); });
      var ms = empRead_('groupMembers');
      list.forEach(function (id) {
        var r = ms.find(function (x) { return Number(x._rowIndex) === Number(id) && gids.indexOf(empTxt_(x.groupId)) >= 0; });
        if (r) { scUpdate_('groupMembers', r._rowIndex, { status: st }); done++; }
      });
    } else if (entity === 'workers') {
      var ws = empRead_('workers');
      list.forEach(function (id) {
        var r = ws.find(function (x) { return Number(x._rowIndex) === Number(id) && empTxt_(x.branchId) === b; });
        if (r) { scUpdate_('workers', r._rowIndex, { status: st }); done++; }
      });
    } else if (entity === 'applicants') {
      if (EMP_AP_STATUS.indexOf(st) < 0) throw new Error('وضعیت پرونده معتبر نیست.');
      var sh = getSpreadsheet_().getSheetByName('Job_Application_Form');
      if (sh && sh.getLastRow() > 1) {
        var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 31).getValues();
        list.forEach(function (id) {
          var i = Number(id) - 2;
          if (i >= 0 && i < vals.length && empTxt_(vals[i][2]) === b) { sh.getRange(Number(id), 31).setValue(st); done++; }
        });
      }
    } else {
      throw new Error('نوع رکورد پشتیبانی نمی‌شود.');
    }
    empLog_(s, 'تغییر وضعیت گروهی', entity + ' → ' + st + ' (' + done + ')', 'success');
    return { success: true, updated: done };
  } finally { lock.releaseLock(); }
}

/* ═════════ 23) REPORTS ═════════ */
function getEmployeeReports(token, fromDate, toDate) {
  var s = checkEmployeeAuth(token);
  var b = empBranchOf_(s);
  var orders = empRead_('orders').filter(function (r) { return empTxt_(r.branchId) === b; });
  if (fromDate) { var k1 = empKey_(fromDate); if (k1) orders = orders.filter(function (r) { var k = empKey_(empDispDate_(r.createdAt)); return k && k >= k1; }); }
  if (toDate)   { var k2 = empKey_(toDate);   if (k2) orders = orders.filter(function (r) { var k = empKey_(empDispDate_(r.createdAt)); return k && k <= k2; }); }
  return {
    count: orders.length,
    totalRevenue: orders.reduce(function (sum, r) { return sum + empNum_(r.finalPrice); }, 0),
    byStatus: orders.reduce(function (acc, r) { var k = empTxt_(r.status) || 'نامشخص'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
    transactions: orders.map(function (r) {
      return {
        date: empDispDateTime_(r.createdAt), requestId: empTxt_(r.requestId),
        customer: [empTxt_(r.firstName), empTxt_(r.lastName)].filter(Boolean).join(' '),
        service: empTxt_(r.service), amount: empNum_(r.finalPrice), status: empTxt_(r.status)
      };
    }).reverse()
  };
}

/* ═════════ 24) PROFILE ═════════ */
function getEmployeeProfile(token) {
  var s = checkEmployeeAuth(token);
  var row = empRead_('employees').find(function (r) { return empTxt_(r.empId) === empTxt_(s.empId); }) || {};
  return {
    empId: s.empId, employeeId: s.empId, name: s.name, fullName: s.name, username: s.username,
    role: 'کارمند', roleFa: 'کارمند شعبه', branchId: s.branchId, avatar: s.avatar || '',
    phone: empTxt_(row.contact), email: empTxt_(row.email), jobTitle: empTxt_(row.jobTitle),
    specialty: empTxt_(row.specialization), nationalCode: empTxt_(row.nationalId),
    emergencyContact: empTxt_(row.emergency), address: empTxt_(row.address)
  };
}

function updateEmployeeProfile(updates, token) {
  var s = checkEmployeeAuth(token);
  var u = updates || {};
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var row = empRead_('employees').find(function (r) { return empTxt_(r.empId) === empTxt_(s.empId); });
    if (!row) throw new Error('رکورد کاربر یافت نشد.');
    var payload = {};
    if (u.phone !== undefined)            payload.contact = empTxt_(u.phone);
    if (u.avatar !== undefined)           payload.photo = empTxt_(u.avatar);
    if (u.email !== undefined)            payload.email = empTxt_(u.email);
    if (u.address !== undefined)          payload.address = empTxt_(u.address);
    if (u.specialty !== undefined)        payload.specialization = empTxt_(u.specialty);
    if (u.nationalCode !== undefined)     payload.nationalId = empTxt_(u.nationalCode);
    if (u.emergencyContact !== undefined) payload.emergency = empTxt_(u.emergencyContact);
    if (empTxt_(u.password))              payload.password = empTxt_(u.password);
    if (!Object.keys(payload).length) return { success: true, message: 'تغییری اعمال نشد.' };
    scUpdate_('employees', row._rowIndex, payload);
    if (payload.photo !== undefined) {
      s.avatar = payload.photo;
      PropertiesService.getScriptProperties().setProperty('session_' + s.token, JSON.stringify(s));
    }
    empLog_(s, 'ویرایش پروفایل کارمند', s.username, 'success');
    return { success: true, message: 'پروفایل به‌روزرسانی شد.' };
  } finally { lock.releaseLock(); }
}

/* ═════════ 25) ADMIN SIDE ═════════ */
function empAdmin_(token) {
  if (!token) throw new Error('لطفاً ابتدا وارد شوید');
  var raw = PropertiesService.getScriptProperties().getProperty('session_' + token);
  if (!raw) throw new Error('نشست منقضی شده است.');
  var s = JSON.parse(raw);
  if (s.role !== 'Administrator') throw new Error('فقط ادمین ارشد دسترسی دارد.');
  return s;
}
function empAdminFindThread_(id) {
  var key = empTxt_(id);
  var ths = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);
  var t = ths.find(function (x) { return empTxt_(x['Thread-ID']) === key; })
       || ths.find(function (x) { var lr = empTxt_(x.LegacyRef); return lr === 'ES:' + key || lr === 'CC:' + key; });
  if (!t) throw new Error('گفتگو یافت نشد.');
  return t;
}

function adminListEmployeeSupport(token) {
  empAdmin_(token);
  var g = empGroupMsgs_(empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS));
  return empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS)
    .filter(function (t) { return empChannel_(t) === EMP_CH_EMPLOYEE; })
    .map(function (t) { return empThreadView_(t, g[empTxt_(t['Thread-ID'])] || [], { username: 'admin', empId: '' }); })
    .sort(function (a, b) { return String(b.lastMessageAt || b.createdAt).localeCompare(String(a.lastMessageAt || a.createdAt)); });
}

/** پاسخ ادمین — به رشته‌پیام اضافه می‌شود، پاسخ قبلی پاک نمی‌شود */
function adminReplyEmployeeSupport(id, reply, token) {
  var a = empAdmin_(token);
  var txt = empTxt_(reply);
  if (!txt) throw new Error('متن پاسخ الزامی است.');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var t = empAdminFindThread_(id);
    var tid = empTxt_(t['Thread-ID']);
    var now = new Date();
    var count = empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS)
      .filter(function (m) { return empTxt_(m['Thread-ID']) === tid && !empTxt_(m.DeletedAt); }).length + 1;

    empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
      'Message-ID': empUid_('MSG'), 'Thread-ID': tid,
      SenderRole: 'admin', 'Sender-ID': empTxt_(a.empId || a.employeeId),
      SenderUsername: empTxt_(a.username || 'admin'), SenderName: empTxt_(a.name) || 'پشتیبانی سامانه',
      Body: txt, CreatedAt: now, MessageType: 'TEXT', 'RelatedCard-ID': empTxt_(t['Card-ID']),
      Channel: empChannel_(t), 'Branch-ID': empTxt_(t['Branch-ID']), Visibility: 'ALL'
    });
    empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, t._rowIndex, {
      Status: 'ANSWERED', UpdatedAt: now, LastMessageAt: now,
      LastMessageBy: empTxt_(a.username || 'admin'), LastMessagePreview: txt.slice(0, 140),
      MessageCount: count, UnreadOwner: empNum_(t.UnreadOwner) + 1, UnreadPeer: 0,
      PeerRole: 'admin', PeerUsername: empTxt_(a.username || 'admin'), 'Peer-ID': empTxt_(a.empId || a.employeeId)
    });
    return { success: true, threadId: tid, message: 'پاسخ ثبت شد.' };
  } finally { lock.releaseLock(); }
}

function adminGetSupportThread(token, id) {
  empAdmin_(token);
  var t = empAdminFindThread_(id);
  var tid = empTxt_(t['Thread-ID']);
  var all = empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS)
    .filter(function (m) { return empTxt_(m['Thread-ID']) === tid && !empTxt_(m.DeletedAt); });
  all.sort(function (x, y) { return String(empIso_(x.CreatedAt)).localeCompare(String(empIso_(y.CreatedAt))); });
  return { success: true, thread: empThreadView_(t, all, { username: 'admin', empId: '' }), messages: all.map(empMsgView_) };
}

function adminSetSupportStatus(token, id, state) {
  empAdmin_(token);
  var t = empAdminFindThread_(id);
  var st = empState_(state);
  var now = new Date();
  var patch = { Status: st, UpdatedAt: now };
  if (st === 'CLOSED') { patch.ClosedAt = now; patch.ClosedBy = 'admin'; } else { patch.ClosedAt = ''; patch.ClosedBy = ''; }
  empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, t._rowIndex, patch);
  return { success: true, state: st };
}

/* ═════════ 26) MIGRATION (یک‌بار اجرا · idempotent) ═════════ */
/**
 * داده‌های قدیمی را به موتور رشته‌پیام منتقل می‌کند.
 * شیت‌های Customer_Conversations و Employee_Support دست‌نخورده می‌مانند (آرشیو).
 * اجرای دوباره رکورد تکراری نمی‌سازد (LegacyRef).
 */
function empMigrateMessaging() {
  empEnsureMessaging_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var rep = { customerThreads: 0, customerMessages: 0, employeeThreads: 0, employeeMessages: 0, internalTagged: 0, skipped: 0 };
  try {
    var ths = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);
    var refs = {};
    ths.forEach(function (t) { var r = empTxt_(t.LegacyRef); if (r) refs[r] = true; });

    /* الف) برچسب‌گذاری مکاتبات سازمانی موجود */
    ths.forEach(function (t) {
      if (empTxt_(t.Channel)) return;
      var tid = empTxt_(t['Thread-ID']);
      var st = empState_(t.Status);
      empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, t._rowIndex, {
        Channel: EMP_CH_INTERNAL, TicketNo: empNextTicket_(EMP_CH_INTERNAL, ths),
        OwnerRole: 'worker', 'Owner-ID': empTxt_(t['Worker-ID']),
        OwnerUsername: empTxt_(t.WorkerUsername), OwnerName: empTxt_(t.WorkerUsername),
        PeerRole: 'supervisor', 'Peer-ID': empTxt_(t['Supervisor-ID']), PeerUsername: empTxt_(t.SupervisorUsername),
        Status: st, Priority: 'عادی'
      });
      rep.internalTagged++;
    });
    empSheetRows_(EMP_MSG_SHEET, EMP_MS_HEADERS).forEach(function (m) {
      if (empTxt_(m.Channel)) return;
      empPatchRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, m._rowIndex, {
        Channel: EMP_CH_INTERNAL, Visibility: 'ALL', SenderName: empTxt_(m.SenderUsername)
      });
    });

    var orders = empRead_('orders');
    var ss = getSpreadsheet_();

    /* ب) پشتیبانی مشتریان */
    var csh = ss.getSheetByName(EMP_CUST_SHEET);
    if (csh && csh.getLastRow() > 1) {
      var cvals = csh.getRange(2, 1, csh.getLastRow() - 1, Math.max(csh.getLastColumn(), 9)).getValues();
      var groups = {};
      cvals.forEach(function (r) { var id = empTxt_(r[0]); if (id) (groups[id] = groups[id] || []).push(r); });
      Object.keys(groups).forEach(function (cid) {
        if (refs['CC:' + cid]) { rep.skipped++; return; }
        var rows = groups[cid].sort(function (x, y) { return new Date(x[6]) - new Date(y[6]); });
        var first = rows[0];
        var customerId = empTxt_(first[1]);
        var branch = empCustomerBranch_(customerId, orders);
        var created = first[6] instanceof Date ? first[6] : new Date(first[6]);
        var last = rows[rows.length - 1];
        var lastAt = last[6] instanceof Date ? last[6] : new Date(last[6]);
        var replied = rows.some(function (r) { return empTxt_(r[8]); });
        var tid = empUid_('THR');
        var cur = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);

        empAppendRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, {
          'Thread-ID': tid, Channel: EMP_CH_CUSTOMER, TicketNo: empNextTicket_(EMP_CH_CUSTOMER, cur),
          Subject: empTxt_(first[2]) || 'پشتیبانی مشتری', Status: replied ? 'ANSWERED' : 'OPEN',
          'Branch-ID': branch, OwnerRole: 'customer', 'Owner-ID': customerId,
          OwnerUsername: customerId, OwnerName: empCustomerName_(customerId, empTxt_(first[5]), orders),
          PeerRole: 'employee', Priority: 'عادی',
          CreatedAt: created, UpdatedAt: lastAt, LastMessageAt: lastAt, LastMessageBy: empTxt_(first[5]),
          LastMessagePreview: empTxt_(last[3]).slice(0, 140),
          MessageCount: 0, UnreadOwner: 0, UnreadPeer: replied ? 0 : 1, LegacyRef: 'CC:' + cid
        });
        rep.customerThreads++;

        var n = 0, seen = {};
        rows.forEach(function (r) {
          var at = r[6] instanceof Date ? r[6] : new Date(r[6]);
          if (empTxt_(r[3])) {
            empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
              'Message-ID': empUid_('MSG'), 'Thread-ID': tid, SenderRole: 'customer',
              'Sender-ID': customerId, SenderUsername: customerId, SenderName: empTxt_(r[5]),
              Body: empTxt_(r[3]), CreatedAt: at, MessageType: 'TEXT',
              Channel: EMP_CH_CUSTOMER, 'Branch-ID': branch, Visibility: 'ALL'
            });
            n++; rep.customerMessages++;
          }
          var rp = empTxt_(r[8]);
          if (rp && !seen[rp]) {
            seen[rp] = true;
            empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
              'Message-ID': empUid_('MSG'), 'Thread-ID': tid, SenderRole: 'employee',
              'Sender-ID': '', SenderUsername: 'پشتیبانی', SenderName: 'پشتیبانی شعبه',
              Body: rp, CreatedAt: new Date(at.getTime() + 1000), MessageType: 'TEXT',
              Channel: EMP_CH_CUSTOMER, 'Branch-ID': branch, Visibility: 'ALL'
            });
            n++; rep.customerMessages++;
          }
        });
        var made = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS).find(function (x) { return empTxt_(x['Thread-ID']) === tid; });
        if (made) empPatchRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, made._rowIndex, { MessageCount: n });
      });
    }

    /* ج) پشتیبانی کارکنان */
    var esh = ss.getSheetByName(EMP_SUPPORT_SHEET);
    if (esh && esh.getLastRow() > 1) {
      var evals = esh.getRange(2, 1, esh.getLastRow() - 1, Math.max(esh.getLastColumn(), 11)).getValues();
      evals.forEach(function (r) {
        var mid = empTxt_(r[0]);
        if (!mid) return;
        if (refs['ES:' + mid]) { rep.skipped++; return; }
        var created = r[6] instanceof Date ? r[6] : new Date(r[6]);
        var replied = !!empTxt_(r[8]);
        var repliedAt = r[9] instanceof Date ? r[9] : (empTxt_(r[9]) ? new Date(r[9]) : created);
        var branch = empTxt_(r[1]);
        var tid = empUid_('THR');
        var cur = empSheetRows_(EMP_THREAD_SHEET, EMP_TH_HEADERS);

        empAppendRow_(EMP_THREAD_SHEET, EMP_TH_HEADERS, {
          'Thread-ID': tid, Channel: EMP_CH_EMPLOYEE, TicketNo: empNextTicket_(EMP_CH_EMPLOYEE, cur),
          Subject: empTxt_(r[4]) || 'پشتیبانی کارمند', Status: replied ? 'ANSWERED' : 'OPEN',
          'Branch-ID': branch, OwnerRole: 'employee', 'Owner-ID': empTxt_(r[2]),
          OwnerUsername: empTxt_(r[3]), OwnerName: empTxt_(r[3]),
          PeerRole: 'admin', PeerUsername: replied ? empTxt_(r[10]) : '', Priority: 'عادی',
          CreatedAt: created, UpdatedAt: repliedAt, LastMessageAt: repliedAt,
          LastMessageBy: replied ? empTxt_(r[10]) : empTxt_(r[3]),
          LastMessagePreview: (replied ? empTxt_(r[8]) : empTxt_(r[5])).slice(0, 140),
          MessageCount: replied ? 2 : 1, UnreadOwner: replied ? 1 : 0, UnreadPeer: replied ? 0 : 1,
          LegacyRef: 'ES:' + mid
        });
        rep.employeeThreads++;

        empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
          'Message-ID': empUid_('MSG'), 'Thread-ID': tid, SenderRole: 'employee',
          'Sender-ID': empTxt_(r[2]), SenderUsername: empTxt_(r[3]), SenderName: empTxt_(r[3]),
          Body: empTxt_(r[5]), CreatedAt: created, MessageType: 'TEXT',
          Channel: EMP_CH_EMPLOYEE, 'Branch-ID': branch, Visibility: 'ALL'
        });
        rep.employeeMessages++;
        if (replied) {
          empAppendRow_(EMP_MSG_SHEET, EMP_MS_HEADERS, {
            'Message-ID': empUid_('MSG'), 'Thread-ID': tid, SenderRole: 'admin',
            'Sender-ID': '', SenderUsername: empTxt_(r[10]) || 'admin', SenderName: 'پشتیبانی سامانه',
            Body: empTxt_(r[8]), CreatedAt: repliedAt, MessageType: 'TEXT',
            Channel: EMP_CH_EMPLOYEE, 'Branch-ID': branch, Visibility: 'ALL'
          });
          rep.employeeMessages++;
        }
      });
    }
    return { success: true, report: rep };
  } finally { lock.releaseLock(); }
}
