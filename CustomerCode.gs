/**
 * ZingoVingo — Customer Panel Backend V3
 * روش‌های ورود:
 *   ۱. نام کاربری + رمز عبور (از شیت Customers_DB)
 *   ۲. شماره موبایل + OTP یکبار مصرف (پیام بله)
 */

// ==================== روش ۱: ورود با نام کاربری و رمز عبور ====================
function customerLogin(username, password) {
  try {
    const u = String(username || '').trim().toLowerCase();
    const p = String(password || '');
    
    if (!u || !p) throw new Error('نام کاربری و رمز عبور را وارد کنید.');
    
    const rows = scRead_('customers');
    const found = rows.find(r => 
      text_(r.username).toLowerCase() === u &&
      text_(r.password) === p &&
      /^(فعال|active)$/i.test(text_(r.status))
    );
    
    if (!found) throw new Error('نام کاربری یا رمز عبور اشتباه است، یا حساب غیرفعال می‌باشد.');
    
    const level = getCustomerLevelInfo_(text_(found.level) || 'عادی');
    const token = Utilities.getUuid();
    
    const session = {
      token: token,
      role: 'Customer',
      panel: 'customer',
      customerId: text_(found.customerId),
      username: text_(found.username),
      fullName: text_(found.fullName) || [text_(found.firstName), text_(found.lastName)].filter(Boolean).join(' '),
      firstName: text_(found.firstName),
      lastName: text_(found.lastName),
      phone: normalizePhone_(found.contact),
      email: text_(found.email),
      level: level.name,
      discountRate: level.discountRate,
      province: text_(found.province),
      city: text_(found.city),
      address: text_(found.address),
      postalCode: text_(found.postal),
      avatar: text_(found.photo) || '',
      joinDate: text_(found.joinDate)
    };
    
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    
    try {
      if (typeof scLog_ === 'function') {
        scLog_(session, 'ورود به پنل مشتری', 'username: ' + u, 'success');
      }
    } catch (e) {}
    
    return { 
      success: true, 
      token: token, 
      user: {
        customerId: session.customerId,
        username: session.username,
        fullName: session.fullName,
        firstName: session.firstName,
        lastName: session.lastName,
        phone: session.phone,
        email: session.email,
        level: session.level,
        discountRate: session.discountRate,
        province: session.province,
        city: session.city,
        address: session.address,
        postalCode: session.postalCode,
        avatar: session.avatar,
        joinDate: session.joinDate
      }
    };
  } catch (err) { 
    throw new Error('خطای ورود: ' + err.message); 
  }
}

function customerLogout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty('session_' + token); } catch (e) {}
  return { success: true };
}

function checkCustomerAuth(token) {
  if (!token) throw new Error('لطفاً ابتدا وارد شوید');
  const raw = PropertiesService.getScriptProperties().getProperty('session_' + token);
  if (!raw) throw new Error('نشست منقضی شده است.');
  let s;
  try { s = JSON.parse(raw); } catch (e) { throw new Error('خطا در خواندن نشست.'); }
  if (s.role !== 'Customer') throw new Error('دسترسی غیرمجاز.');
  if (!s.customerId) throw new Error('کد اشتراک در نشست موجود نیست.');
  return s;
}

// ==================== روش ۲: سیستم OTP (کد یکبار مصرف) ====================
const OTP_TTL_SECONDS = 300;
const OTP_COOLDOWN_SECONDS = 60;

function requestCustomerOtp(phone) {
  try {
    const ph = normalizePhone_(phone);
    if (!/^09\d{9}$/.test(ph)) throw new Error('شماره موبایل معتبر نیست.');

    const rows = scRead_('customers');
    const customer = rows.find(r =>
      normalizePhone_(r.contact) === ph && /^(فعال|active)$/i.test(text_(r.status))
    );
    if (!customer) throw new Error('این شماره موبایل در سیستم ثبت نشده است.');

    const props = PropertiesService.getScriptProperties();
    const lastSent = props.getProperty('otp_last_' + ph);
    if (lastSent) {
      const elapsed = (Date.now() - Number(lastSent)) / 1000;
      if (elapsed < OTP_COOLDOWN_SECONDS) {
        throw new Error('لطفاً ' + Math.ceil(OTP_COOLDOWN_SECONDS - elapsed) + ' ثانیه صبر کنید.');
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + (OTP_TTL_SECONDS * 1000);

    props.setProperty('otp_' + ph, JSON.stringify({ 
      code: otp, 
      expiresAt: expiresAt, 
      customerId: text_(customer.customerId) 
    }));
    props.setProperty('otp_last_' + ph, String(Date.now()));

    const sent = sendOtpViaBale_(ph, otp);
    if (!sent) {
      props.deleteProperty('otp_' + ph);
      throw new Error('ارسال پیام ناموفق بود. لطفاً دوباره تلاش کنید.');
    }

    return { success: true, message: 'کد تأیید به شماره بله شما ارسال شد.' };
  } catch (err) { 
    throw new Error('خطا: ' + err.message); 
  }
}

function verifyCustomerOtp(phone, otp) {
  try {
    const ph = normalizePhone_(phone);
    const otpCode = String(otp || '').trim();
    if (!/^09\d{9}$/.test(ph)) throw new Error('شماره موبایل معتبر نیست.');
    if (!/^\d{6}$/.test(otpCode)) throw new Error('کد تأیید باید ۶ رقم باشد.');

    const props = PropertiesService.getScriptProperties();
    const stored = props.getProperty('otp_' + ph);
    if (!stored) throw new Error('کد تأیید منقضی یا نامعتبر است.');

    const data = JSON.parse(stored);
    if (Date.now() > data.expiresAt) {
      props.deleteProperty('otp_' + ph);
      throw new Error('کد تأیید منقضی شده است.');
    }
    if (data.code !== otpCode) {
      throw new Error('کد تأیید اشتباه است.');
    }

    props.deleteProperty('otp_' + ph);

    const rows = scRead_('customers');
    const customer = rows.find(r => text_(r.customerId) === data.customerId);
    if (!customer) throw new Error('مشتری یافت نشد.');

    const level = getCustomerLevelInfo_(text_(customer.level) || 'عادی');
    const token = Utilities.getUuid();
    
    const session = {
      token: token, role: 'Customer', panel: 'customer',
      customerId: text_(customer.customerId),
      username: text_(customer.username),
      fullName: text_(customer.fullName) || [text_(customer.firstName), text_(customer.lastName)].filter(Boolean).join(' '),
      firstName: text_(customer.firstName), lastName: text_(customer.lastName),
      phone: normalizePhone_(customer.contact), email: text_(customer.email),
      level: level.name, discountRate: level.discountRate,
      province: text_(customer.province), city: text_(customer.city),
      address: text_(customer.address), postalCode: text_(customer.postal),
      avatar: text_(customer.photo) || '', joinDate: text_(customer.joinDate)
    };
    
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    return { success: true, token: token, user: session };
  } catch (err) { 
    throw new Error('خطا: ' + err.message); 
  }
}

function sendOtpViaBale_(phone, otp) {
  try {
    const accessKey = getSetting_('BALE_API_ACCESS_KEY', '');
    const botId = Number(getSetting_('BALE_CUSTOMER_BOT_ID', getSetting_('BALE_BRANCH_BOT_ID', '0')));
    if (!accessKey || !botId) {
      console.warn('تنظیمات سفیر بله برای OTP کامل نیست.');
      return false;
    }

    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '98' + normalizedPhone.substring(1);

    const payload = {
      request_id: 'otp-' + Date.now(),
      bot_id: botId,
      phone_number: normalizedPhone,
      message_data: {
        message: {
          text: '🔐 کد تأیید ورود به ZingoVingo\n\nکد شما: <b>' + otp + '</b>\n\nاین کد تا ۵ دقیقه معتبر است.\nدر صورتی که شما این درخواست را نداده‌اید، این پیام را نادیده بگیرید.'
        }
      }
    };

    const response = UrlFetchApp.fetch('https://safir.bale.ai/api/v3/send_message', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'api-access-key': accessKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());
    return result && result.message_id ? true : false;
  } catch (e) {
    console.error('OTP send error:', e.message);
    return false;
  }
}

// ==================== داشبورد ====================
function getCustomerDashboard(token) {
  const session = checkCustomerAuth(token);
  const cid = session.customerId.toLowerCase();
  const orders = scRead_('orders').filter(r => text_(r.customerId).toLowerCase() === cid);
  const cards = scRead_('cards').filter(r => text_(r.customerId).toLowerCase() === cid);
  return {
    totalOrders: orders.length,
    activeOrders: orders.filter(r => !/تکمیل|لغو/.test(text_(r.status))).length,
    completedOrders: orders.filter(r => /تکمیل/.test(text_(r.status))).length,
    totalSpent: orders.reduce((s, r) => s + number_(r.finalPrice), 0),
    activeCards: cards.filter(r => !/تکمیل|لغو/.test(text_(r.status))).length,
    level: session.level, discountRate: session.discountRate
  };
}

// ==================== سفارشات ====================
function getCustomerOrders(filters, token) {
  const session = checkCustomerAuth(token);
  let rows = scRead_('orders').filter(r => text_(r.customerId).toLowerCase() === session.customerId.toLowerCase());
  const f = filters || {};
  if (f.fromDate) {
    const k = scParseJalali_(f.fromDate);
    if (k) rows = rows.filter(r => { const d = scParseJalali_(scDispDate_(r.createdAt)); return d && d[0]*10000+d[1]*100+d[2] >= k[0]*10000+k[1]*100+k[2]; });
  }
  if (f.toDate) {
    const k = scParseJalali_(f.toDate);
    if (k) rows = rows.filter(r => { const d = scParseJalali_(scDispDate_(r.createdAt)); return d && d[0]*10000+d[1]*100+d[2] <= k[0]*10000+k[1]*100+k[2]; });
  }
  if (f.requestId) rows = rows.filter(r => text_(r.requestId).toLowerCase().includes(text_(f.requestId).toLowerCase()));
  if (f.status && f.status !== 'همه') rows = rows.filter(r => text_(r.status) === f.status);
  return rows.map(r => ({
    requestId: text_(r.requestId), date: scDispDateTime_(r.createdAt),
    service: text_(r.service), status: text_(r.status),
    finalPrice: number_(r.finalPrice), execDate: scDispDate_(r.execDate),
    execTime: text_(r.execTime), address: text_(r.addrFrom), branchId: text_(r.branchId)
  })).reverse();
}

// ==================== کارت‌ها ====================
function getCustomerCards(filters, token) {
  const session = checkCustomerAuth(token);
  let rows = scRead_('cards').filter(r => text_(r.customerId).toLowerCase() === session.customerId.toLowerCase());
  const f = filters || {};
  if (f.fromDate) {
    const k = scParseJalali_(f.fromDate);
    if (k) rows = rows.filter(r => { const d = scParseJalali_(scDispDate_(r.createdAt)); return d && d[0]*10000+d[1]*100+d[2] >= k[0]*10000+k[1]*100+k[2]; });
  }
  if (f.toDate) {
    const k = scParseJalali_(f.toDate);
    if (k) rows = rows.filter(r => { const d = scParseJalali_(scDispDate_(r.createdAt)); return d && d[0]*10000+d[1]*100+d[2] <= k[0]*10000+k[1]*100+k[2]; });
  }
  if (f.cardId) rows = rows.filter(r => text_(r.cardId).toLowerCase().includes(text_(f.cardId).toLowerCase()));
  if (f.status && f.status !== 'همه') rows = rows.filter(r => text_(r.status) === f.status);
  const workers = scRead_('workers'), orders = scRead_('orders');
  return rows.map(r => {
    const w = workers.find(x => text_(x.workerId) === text_(r.workerId));
    const o = orders.find(x => text_(x.requestId) === text_(r.requestId));
    return {
      cardId: text_(r.cardId), requestId: text_(r.requestId),
      service: text_(r.serviceType) || (o ? text_(o.service) : ''),
      details: text_(r.details), amount: number_(r.total),
      workerName: w ? [text_(w.firstName), text_(w.lastName)].filter(Boolean).join(' ') : '—',
      status: text_(r.status), execDate: scDispDate_(r.execDate),
      execTime: text_(r.execTime), createdAt: scDispDate_(r.createdAt)
    };
  }).reverse();
}

// ==================== فاکتور ====================
function getCustomerOrderInvoice(requestId, token) {
  const session = checkCustomerAuth(token);
  const order = scRead_('orders').find(r =>
    text_(r.requestId) === text_(requestId) &&
    text_(r.customerId).toLowerCase() === session.customerId.toLowerCase());
  if (!order) throw new Error('سفارش یافت نشد یا متعلق به شما نیست.');
  const cards = scRead_('cards').filter(c => text_(c.requestId) === text_(requestId));
  const workers = scRead_('workers');
  const aw = cards.length ? workers.find(w => text_(w.workerId) === text_(cards[0].workerId)) : null;
  return {
    requestId: text_(order.requestId), customerName: session.fullName,
    customerCode: session.customerId, phone: session.phone,
    address: text_(order.addrFrom), service: text_(order.service),
    basePrice: number_(order.basePrice), discount: number_(order.discount),
    tax: number_(order.tax), finalPrice: number_(order.finalPrice),
    execDate: scDispDate_(order.execDate), execTime: text_(order.execTime),
    status: text_(order.status), createdAt: scDispDateTime_(order.createdAt),
    branchId: text_(order.branchId),
    workerName: aw ? [text_(aw.firstName), text_(aw.lastName)].filter(Boolean).join(' ') : '—',
    cardId: cards.length ? text_(cards[0].cardId) : '',
    notes: text_(order.notes), level: session.level, discountRate: session.discountRate
  };
}

// ==================== پروفایل ====================
function getCustomerProfile(token) { return checkCustomerAuth(token); }

function updateCustomerProfile(updates, token) {
  const session = checkCustomerAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const rows = scRead_('customers');
    const row = rows.find(r => text_(r.customerId).toLowerCase() === session.customerId.toLowerCase());
    if (!row) throw new Error('رکورد مشتری یافت نشد.');
    const payload = {};
    if (updates.phone) payload.contact = normalizePhone_(updates.phone);
    if (updates.email) payload.email = text_(updates.email);
    if (updates.address) payload.address = text_(updates.address);
    if (updates.province) payload.province = text_(updates.province);
    if (updates.city) payload.city = text_(updates.city);
    if (updates.postalCode) payload.postal = text_(updates.postalCode);
    if (updates.avatar) payload.photo = text_(updates.avatar);
    scUpdate_('customers', row._rowIndex, payload);
    Object.assign(session, payload);
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ==================== پیام‌رسانی ====================
const CONV_SHEET = 'Customer_Conversations';
const CONV_HEADERS = ['conversationId','customerId','subject','message','sender','senderName','createdAt','status','reply'];

function ensureConvSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(CONV_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONV_SHEET);
    sh.getRange(1, 1, 1, CONV_HEADERS.length).setValues([CONV_HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, CONV_HEADERS.length).setFontWeight('bold').setBackground('#0B1736').setFontColor('#FFFFFF');
  }
  return sh;
}

function createCustomerConversation(subject, message, token) {
  const session = checkCustomerAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = ensureConvSheet_();
    const convId = 'MSG-' + Date.now().toString(36).toUpperCase();
    sh.appendRow([convId, session.customerId, text_(subject), text_(message), 'customer', session.fullName, new Date(), 'unread', '']);
    return { success: true, conversationId: convId };
  } finally { lock.releaseLock(); }
}

function getCustomerConversations(token) {
  const session = checkCustomerAuth(token);
  const sh = ensureConvSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, CONV_HEADERS.length).getValues();
  return rows.filter(r => text_(r[1]).toLowerCase() === session.customerId.toLowerCase())
    .map(r => ({
      conversationId: text_(r[0]), subject: text_(r[2]), message: text_(r[3]),
      sender: text_(r[4]), senderName: text_(r[5]),
      createdAt: scDispDateTime_(r[6]), status: text_(r[7]), reply: text_(r[8])
    })).reverse();
}

function getCustomerUnreadCount(token) {
  const session = checkCustomerAuth(token);
  try {
    const sh = getSpreadsheet_().getSheetByName(CONV_SHEET);
    if (!sh || sh.getLastRow() < 2) return 0;
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, CONV_HEADERS.length).getValues();
    return rows.filter(r => text_(r[1]).toLowerCase() === String(session.customerId).toLowerCase() && text_(r[7]) === 'unread').length;
  } catch (e) { return 0; }
}

function replyCustomerConversation(conversationId, message, token) {
  const session = checkCustomerAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = ensureConvSheet_();
    const last = sh.getLastRow();
    if (last < 2) throw new Error('گفتگویی یافت نشد.');
    const ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
    let rowNo = -1;
    for (let i = 0; i < ids.length; i++) if (text_(ids[i][0]) === text_(conversationId)) { rowNo = i + 2; break; }
    if (rowNo < 0) throw new Error('گفتگو یافت نشد.');
    if (text_(sh.getRange(rowNo, 2).getValue()).toLowerCase() !== session.customerId.toLowerCase()) throw new Error('دسترسی غیرمجاز.');
    sh.appendRow([conversationId, session.customerId, text_(sh.getRange(rowNo, 3).getValue()), text_(message), 'customer', session.fullName, new Date(), 'open', '']);
    sh.getRange(rowNo, 8).setValue('open');
    return { success: true };
  } finally { lock.releaseLock(); }
}


function testCustomerLogin() {
  // این تابع را مستقیماً در Apps Script اجرا کنید (Run)
  const result = customerLogin('habib17', '123456'); // نام کاربری و رمز واقعی یکی از مشتریان را بگذارید
  console.log(JSON.stringify(result, null, 2));
  return result;
}
