/**
 * ZingoVingo — Core Engine V13 (COMPLETE & CLOSED)
 * - موتور محاسبات: دقیقاً مطابق «سند نهایی فرمول‌ها» (FS,FC,FSTC,FFRS,FI,FICS,FOCS,FD,TOII,FT,FU,FCN,FPA)
 * - مقادیر متغیرها زنده از PricingRules (ستون Variable) و داده‌های درخواست
 * - نوشتن/تأیید سفارش و مشتری با هدرهای زنده (بدون وابستگی به کش SchemaCore)
 * - کد اشتراک ۹ کاراکتری | قانون تاریخ: ذخیره میلادی، نمایش شمسی
 */

function codeVersion() { return 'V13-COMPLETE-FORMULAS-CLOSED'; }

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) ? String(e.parameter.page).toLowerCase() : 'user';
  
  // عنوان‌های اختصاصی برای صفحات خاص
  const customTitles = {
    'portal': 'درگاه ورود به پنل‌ها | ZingoVingo',
    'jobform': 'ثبت درخواست همکاری | ZingoVingo',
    'customer': 'پنل مشتریان | ZingoVingo'
  };
  
  const map = { 
    'administrator': 'Administrator', 
    'admin': 'Administrator',
    'manager': 'Manager',
    'branchmanager': 'BranchManager',
    'employee': 'Employee', 
    'worker': 'Worker',
    'supervisor': 'Supervisor',
    'operator': 'Operator',
    'customer': 'Customer',
    'portal': 'Portal',
    'jobform': 'JobForm' 
  };
  
  if (map[page]) {
    const title = customTitles[page] || ('پنل ' + map[page] + ' | ZingoVingo');
    return HtmlService.createTemplateFromFile(map[page]).evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  if (page === 'landing') {
    return HtmlService.createHtmlOutputFromFile('Landing')
      .setTitle('ZingoVingo')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  return HtmlService.createTemplateFromFile('customerform').evaluate()
    .setTitle('ثبت درخواست خدمات | ZingoVingo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
/* ==================== توابع کمکی پایه ==================== */
function text_(value) { return value == null ? '' : String(value).trim(); }
function number_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value == null ? '' : value)
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[٬،]/g, '').replace(/,/g, '').trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function normalizePhone_(value) {
  let s = String(value == null ? '' : value).replace(/[۰-۹]/g, d => '۱۲۳۴۵۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  s = s.replace(/\D/g, '');
  if (s.startsWith('98') && s.length === 12) s = '0' + s.slice(2);
  return s;
}
function normalizeDigits_(value) { return String(value == null ? '' : value).replace(/[-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '١٢٣٤٥٦٧٨٩'.indexOf(d)); }
function getSetting_(key, fallback) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return fallback;
    const sheet = ss.getSheetByName('Settings');
    if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 2) return fallback;
    const values = sheet.getDataRange().getDisplayValues();
    const first = values[0].map(v => String(v).trim().toLowerCase());
    let ki = first.indexOf('key'); if (ki < 0) ki = first.indexOf('کلید');
    let vi = first.indexOf('value'); if (vi < 0) vi = first.indexOf('مقدار');
    if (ki < 0 || vi < 0) { ki = 0; vi = 1; }
    const target = normalizeSettingKey_(key);
    for (let i = 1; i < values.length; i++) {
      if (normalizeSettingKey_(values[i][ki]) === target) return String(values[i][vi]);
    }
    return fallback;
  } catch (e) { return fallback; }
}
function normalizeSettingKey_(value) {
  const s = String(value == null ? '' : value).trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const aliases = {
    'trello api key': 'TRELLO_API_KEY', 'trello token': 'TRELLO_TOKEN', 'trello list id': 'TRELLO_LIST_ID',
    'رنگ اصلی': 'PRIMARY_COLOR', 'رنگ دوم': 'SECONDARY_COLOR', 'نام برند': 'BRAND_NAME', 'لوگو': 'LOGO_URL'
  };
  return aliases[s] || s.toUpperCase().replace(/\s+/g, '_');
}
function getSpreadsheet_() {
  const id = getSetting_('SPREADSHEET_ID', '');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('فایل Google Sheets مشخص نیست. SPREADSHEET_ID را در Settings تنظیم کنید.');
  return ss;
}
function readObjects_(sheet) {
  const lastRow = sheet.getLastRow(); const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h).trim());
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map(row => { const obj = {}; headers.forEach((h, i) => obj[h] = row[i]); return obj; });
}
function jalaliToday_() {
  const d = new Date();
  const j = gregorianToJalali_(d.getFullYear(), d.getMonth() + 1, d.getDate());
  return j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0');
}
function gregorianToJalali_(gy, gm, gd) {
  const gdm = [0,31,((gy%4===0&&gy%100!==0)||gy%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365*gy + Math.floor((gy2+3)/4) - Math.floor((gy2+99)/100) + Math.floor((gy2+399)/400) + gd;
  for (let i = 1; i < gm; i++) days += gdm[i];
  let jy = -1595 + 33*Math.floor(days/12053); days %= 12053;
  jy += 4*Math.floor(days/1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days-1)/365); days = (days-1)%365; }
  let jm, jd;
  if (days < 186) { jm = 1 + Math.floor(days/31); jd = 1 + days%31; }
  else { jm = 7 + Math.floor((days-186)/30); jd = 1 + (days-186)%30; }
  return [jy, jm, jd];
}
function schemaInvalidate_() {
  try { _SC_CACHE = null; _SC_MAP = {}; } catch (e) {}
}
function safeSetTextFormat_(sheet, rowIndex, colIndex) {
  try { sheet.getRange(rowIndex, colIndex).setNumberFormat('@'); } catch (e) { /* typed column — skip */ }
}

/* ==================== نوشتن سفارش با هدرهای زنده ==================== */
const ORDERS_ALIAS = {
  createdAt: ['Creation-Time', 'تاریخ و ساعت ثبت', 'تاریخ ثبت'], requestId: ['Request-ID', 'RequestID'], branchId: ['Branch-ID', 'شعبه'], province: ['Province', 'استان', 'province'], city: ['City', 'شهر', 'city'], 
  verifier: ['Verifier', 'کارمند مسئول'], operator: ['operator'], customerId: ['Customers-ID', 'کد اشتراک'],
  firstName: ['First-Name', 'نام'], lastName: ['Last-Name', 'نام خانوادگی'], contact: ['Contact-Number', 'شماره تماس', 'تلفن'],
  overtimeHours: ['ساعت اضافه کاری'], overtimeCost: ['هزینه اضافه کاری'], basePrice: ['قیمت پایه'],
  discount: ['مقدار تخفیف'], tax: ['مالیات برارزش افزوده'], finalPrice: ['قیمت نهایی'],
  status: ['وضعیت', 'Status'], service: ['نوع -خدمات', 'خدمت اصلی'], qty: ['مقدار'],
  location: ['محل اجرا'], area: ['مساحت'], rooms: ['تعداد اتاق'], forceGender: ['جنسیت نیرو'],
  womenCount: ['تعداد نیروی خانم'], menCount: ['تعداد نیروی آقا'], floors: ['تعداد طبقات'], units: ['تعداد واحد'],
  packing: ['بسته بندی وچیدمان'], addrFrom: ['آدرس مبدا', 'آدرس'], addrTo: ['آدرس مقصد'],
  cargoType: ['نوع بار'], cargoDims: ['ابعاد بار'], cargoWeight: ['وزن بار'], goodsValue: ['ارزش کالا'],
  insurance: ['مقدار بیمه'], vehicle: ['نوع خودرو'], tractorType: ['نوع کشنده'], trailerType: ['نوع بارگیر'],
  sideServices: ['خدمات جانبی'], actionType: ['نوع اقدام'], execDate: ['تاریخ اجرا'], execTime: ['ساعت اجرا'], notes: ['توضیحات']
};
function ordersSheet_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName('Orders') || ss.getSheetByName(schemaSheetName_('orders'));
}
function liveHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0].map(h => String(h).trim());
}
function ordersWrite_(data) {
  const sh = ordersSheet_();
  const headers = liveHeaders_(sh);
  const row = headers.map(() => '');
  Object.keys(data).forEach(logical => {
    const aliases = ORDERS_ALIAS[logical] || [logical];
    for (let i = 0; i < aliases.length; i++) {
      const idx = headers.indexOf(aliases[i]);
      if (idx >= 0) { row[idx] = data[logical]; break; }
    }
  });
  const rowIndex = sh.getLastRow() + 1;
  ['Request-ID', 'Contact-Number', 'Customers-ID'].forEach(h => {
    const i = headers.indexOf(h);
    if (i >= 0) safeSetTextFormat_(sh, rowIndex, i + 1);
  });
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  return { sheet: sh, headers: headers, rowIndex: rowIndex };
}
function ordersVerify_(written, requestId) {
  const i = written.headers.indexOf('Request-ID');
  if (i < 0) return true;
  const saved = String(written.sheet.getRange(written.rowIndex, i + 1).getValue() || '').trim();
  return !requestId || saved === requestId;
}
function writeRawAnswersLive_(written, answers) {
  const keys = Object.keys(answers || {});
  if (!keys.length) return;
  keys.forEach(col => {
    const idx = written.headers.indexOf(String(col).trim());
    if (idx >= 0) written.sheet.getRange(written.rowIndex, idx + 1).setValue(answers[col]);
  });
}

/* ==================== نوشتن مشتری با هدرهای زنده ==================== */
const CUSTOMER_REGEX = {
  customerId: /customers-id|کد اشتراک/i, contact: /contact-number|شماره تماس/i,
  fullName: /full-name|نام کامل/i, firstName: /first-name|^نام$/i, lastName: /last-name|نام خانوادگی/i,
  joinDate: /تاریخ عضویت|join-date/i, level: /subscription_level|^سطح$/i, status: /^status$|وضعیت/i,
  province: /^province$|استان/i, city: /^city$|شهر/i, address: /^address$|آدرس/i,
  email: /^email$|ایمیل/i, postal: /postal-code|کد پستی/i, rowNo: /^ردیف$|^row$/i
};
function customersSheet_() {
  const ss = getSpreadsheet_();
  return ss.getSheetByName('Customers_DB') || ss.getSheetByName(schemaSheetName_('customers'));
}
function customersWrite_(data) {
  const sh = customersSheet_();
  const headers = liveHeaders_(sh);
  const row = headers.map(() => '');
  Object.keys(data).forEach(logical => {
    const re = CUSTOMER_REGEX[logical];
    if (!re) return;
    const idx = headers.findIndex(h => re.test(h));
    if (idx >= 0) row[idx] = data[logical];
  });
  const rowIndex = sh.getLastRow() + 1;
  ['Customers-ID', 'Contact-Number'].forEach(h => {
    const i = headers.indexOf(h);
    if (i >= 0) safeSetTextFormat_(sh, rowIndex, i + 1);
  });
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  return { sheet: sh, headers: headers, rowIndex: rowIndex };
}
function customersVerify_(written, code) {
  const idx = written.headers.findIndex(h => /customers-id|کد اشتراک/i.test(h));
  if (idx < 0) return true;
  const saved = String(written.sheet.getRange(written.rowIndex, idx + 1).getValue() || '').trim();
  return saved === code;
}

/* ==================== اندپوینت‌های فرم مشتری ==================== */
function getServices() {
  const services = scRead_('services').map(r => ({
    id: text_(r.id), nameEn: text_(r.nameEn), name: text_(r.nameFa) || text_(r.nameEn),
    rate: number_(r.rate), unit: text_(r.unit) || 'واحد', minimum: Math.max(0, number_(r.minOrder))
  })).filter(s => s.id && s.name);
  const alias = {};
  services.forEach(s => {
    alias[s.id.toLowerCase()] = s.id;
    if (s.nameEn) alias[s.nameEn.toLowerCase()] = s.id;
    if (s.name) alias[s.name.toLowerCase()] = s.id;
  });
  const cleaningId = (services.find(s => /home\s*\/\s*office\s*cleaning/i.test(s.nameEn || '') || /نظافت منزل/.test(s.name || '')) || {}).id || '';
  alias['cleaning_m'] = cleaningId; alias['cleaning_f'] = cleaningId;
  const resolveToken = t => alias[String(t || '').trim().toLowerCase()] || '';
  const seen = {};
  const sideServices = scRead_('sides').map((r, i) => {
    const rawId = text_(r.id) || ('ROW_SIDE_' + (i + 2));
    const id = seen[rawId] ? rawId + '__ROW_' + (i + 2) : rawId;
    seen[rawId] = true;
    const related = (text_(r.serviceEn) || '').split(/[,،;؛]/).map(x => resolveToken(x)).filter(Boolean);
    return { id: id, name: text_(r.nameFa) || text_(r.nameEn), rate: number_(r.rate), unit: text_(r.unit) || 'واحد', relatedService: Array.from(new Set(related)).join(','), description: text_(r.notes) };
  }).filter(s => s.name);
  let questions = [];
  try {
    questions = scRead_('questions').map(q => {
      const sid = resolveToken(q.serviceEn) || text_(q.serviceEn);
      return { serviceId: sid, serviceName: text_(q.serviceFa), question: text_(q.question), position: number_(q.position), inputType: text_(q.inputType) || 'text', options: text_(q.options), fieldType: text_(q.fieldType), help: text_(q.help), answerColumn: text_(q.column) };
    }).filter(q => q.serviceId && q.question);
  } catch (e) { questions = []; }
  return { services: services, sideServices: sideServices, questions: questions, defaultCustomerLevel: getCustomerLevelInfo_('عادی') };
}

function getPriceEstimate(payload) {
  const calculated = calculatePrice_(payload);
  return Object.assign({}, calculated, {
    currency: getSetting_('CURRENCY_LABEL', 'ریال'),
    disclaimer: 'این پیش‌فاکتور بر اساس نرخ‌های فعلی شیت‌ها محاسبه شده است؛ مبلغ هنگام ثبت دوباره در سرور محاسبه می‌شود.'
  });
}

//پیدا کردن شعبه بر اساس شهر و استان 

// پیدا کردن شعبه بر اساس شهر و استان (اصلاح‌شده)
function findBranchForCity_(province, city) {
  try {
    const branches = scRead_('branches');
    const p = text_(province).trim();
    const c = text_(city).trim();
    if (!p || !c) return null;
    
    // اولویت ۱: تطابق دقیق شهر و استان
    const matchCity = branches.find(b => text_(b.province) === p && text_(b.city) === c && /^(فعال|active)$/i.test(text_(b.status)));
    if (matchCity) return { id: text_(matchCity.branchId), name: text_(matchCity.name) };
    
    // اولویت ۲: تطابق فقط با استان (اگر شهر دقیق پیدا نشد)
    const matchProvince = branches.find(b => text_(b.province) === p && /^(فعال|active)$/i.test(text_(b.status)));
    if (matchProvince) return { id: text_(matchProvince.branchId), name: text_(matchProvince.name) };
    
    return null;
  } catch (e) { 
    console.error('Branch routing error:', e);
    return null; 
  }
}


function processOrder(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const requestId = text_(payload && payload.requestId);
    if (requestId && hasRequestId_(requestId)) {
      return { success: true, duplicate: true, message: 'این درخواست قبلاً ثبت شده است.', orderId: requestId };
    }
    let customer = null;
    try { customer = resolveOrCreateCustomer_(payload); } catch (e) { return { success: false, message: 'خطا در ثبت مشتری: ' + e.message }; }
    if (!customer || !customer.code) return { success: false, message: 'ثبت مشتری تأیید نشد؛ عملیات متوقف شد.' };
    payload = Object.assign({}, payload, {
      name: customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(' '),
      firstName: customer.firstName || '', lastName: customer.lastName || '',
      phone: customer.phone || '', address: text_(payload.address).trim() || customer.address || '',
      province: text_(payload.province) || customer.province || '',
       city: text_(payload.city) || customer.city || ''
    });
    validateOrderPayload_(payload);
    const price = calculatePrice_(payload);

        // مسیریابی هوشمند به شعبه
    const branchInfo = findBranchForCity_(text_(payload.province), text_(payload.city));
    const targetBranchId = branchInfo ? text_(branchInfo.id) : 'بدون شعبه';
    const targetBranchName = branchInfo ? text_(branchInfo.name) : 'تعیین نشده';
    
      // تشخیص اپراتور (اگر از پنل اپراتور ثبت شده)
  const operatorId = text_(payload.operatorId) || '';
  let groupId = '';
  
  if (operatorId) {
    // پیدا کردن گروه اپراتور از شیت GroupMembers
    const members = scRead_('groupMembers');
    const member = members.find(m => text_(m.workerId) === operatorId);
    if (member) {
      groupId = text_(member.groupId);
    }
  }
    const createdAt = new Date();
    const customerName = text_(payload.name).trim() || text_(customer.fullName);
    const phone = normalizePhone_(payload.phone) || normalizePhone_(customer.phone);
    const service = getServiceById_(text_(payload.serviceId));
    const sideNames = getSelectedSideServices_(payload).map(x => x.name + ' × ' + x.quantity).join('، ');
    const notes = text_(payload.notes).trim();

    const written = ordersWrite_({
      createdAt: createdAt, requestId: requestId, branchId: targetBranchId, province: text_(payload.province) || customer.province || '', city: text_(payload.city) || customer.city || '', operator: operatorId,
    groupId: groupId, customerId: customer.code || '',
      firstName: text_(payload.firstName) || customer.firstName || customerName,
      lastName: text_(payload.lastName) || customer.lastName || '',
      contact: phone, service: service.name, qty: number_(payload.quantity),
      sideServices: sideNames, actionType: text_(payload.actionType) || 'عادی',
      execDate: scStoreDate_(normalizeDigits_(payload.requestDate)),
      execTime: text_(payload.requestTime),
      addrFrom: text_(payload.address).trim() || customer.address || '', addrTo: text_(payload.destinationAddress),
      cargoType: text_(payload.cargoType), cargoWeight: text_(payload.cargoWeight),
      goodsValue: text_(payload.goodsValue), insurance: text_(payload.insuranceAmount), vehicle: text_(payload.vehicleType),
      overtimeHours: 0, overtimeCost: 0,
      basePrice: price.basePrice, discount: price.totalDiscountAmount,
      tax: price.taxAmount, finalPrice: price.finalPrice,
      status: 'جدید', notes: notes,
      operator: text_(payload.operatorId) || ''
    });

        // ===== اعلان بله: سفارش جدید به شعبه =====
    try {
      notifyBranchNewOrder(targetBranchId, {
        requestId: requestId || ('ROW-' + written.rowIndex),
        customerName: customerName,
        phone: phone,
        service: service.name,
        finalPrice: price.finalPrice,
        execDate: scDispDate_(scStoreDate_(normalizeDigits_(payload.requestDate))),
        execTime: text_(payload.requestTime),
        address: text_(payload.address).trim() || customer.address || ''
      });
    } catch (e) {
      console.error('Bale notification error (new order):', e.message);
    }
    
    if (!ordersVerify_(written, requestId)) {
      throw new Error('ذخیره‌سازی سفارش تأیید نشد؛ عملیات متوقف شد.');
    }
    const answers = payload.answers && typeof payload.answers === 'object' ? payload.answers : {};
    writeRawAnswersLive_(written, answers);
    if (price.offerCode && price.offerDiscountAmount > 0) {
      recordOfferRedemption_({ code: price.offerCode, customerCode: customer.code || '', requestId: requestId || ('ROW-' + written.rowIndex), discountAmount: price.offerDiscountAmount });
    }
    let trello = { attempted: false, success: false };
    try {
      trello = createTrelloCard_({
        orderId: requestId || ('ROW-' + written.rowIndex), name: customerName, phone: phone,
        serviceName: service.name, quantity: number_(payload.quantity), sideNames: sideNames,
        requestDate: text_(payload.requestDate), requestTime: text_(payload.requestTime),
        address: text_(payload.address), notes: notes, basePrice: price.basePrice,
        finalPrice: price.finalPrice, discountAmount: price.totalDiscountAmount,
        subscriptionDiscountAmount: price.discountAmount, offerCode: price.offerCode,
        offerDiscountAmount: price.offerDiscountAmount, taxAmount: price.taxAmount
      });
    } catch (err) { trello = { attempted: true, success: false, error: String(err && err.message || err) }; }
    return {
      success: true, duplicate: false, orderId: requestId || ('ROW-' + written.rowIndex),
      finalPrice: price.finalPrice, customerCode: customer.code || '',
      currency: getSetting_('CURRENCY_LABEL', 'ریال'), trello: trello,
      message: 'درخواست شما با موفقیت ثبت شد.'
    };
  } finally { lock.releaseLock(); }
}

function hasRequestId_(requestId) {
  if (!requestId) return false;
  const sh = ordersSheet_();
  const headers = liveHeaders_(sh);
  const i = headers.indexOf('Request-ID') >= 0 ? headers.indexOf('Request-ID') : headers.indexOf('RequestID');
  if (i < 0 || sh.getLastRow() < 2) return false;
  const vals = sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getDisplayValues();
  if (vals.some(r => String(r[0]).trim() === requestId)) return true;
  const ni = headers.indexOf('توضیحات');
  if (ni < 0) return false;
  return sh.getRange(2, ni + 1, sh.getLastRow() - 1, 1).getDisplayValues().some(r => String(r[0]).includes('RequestID:' + requestId));
}

/* ==================== مشتریان ==================== */
function generateUniqueMembershipCode_(customerRows) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789.-_@';
  const existing = new Set((customerRows || []).map(r => text_(r.customerId).toLowerCase()).filter(Boolean));
  for (let attempt = 0; attempt < 100; attempt++) {
    const seed = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    let code = '';
    for (let i = 0; i < 9; i++) {
      const pair = seed.substring(i * 2, i * 2 + 2);
      code += alphabet[parseInt(pair, 16) % alphabet.length];
    }
    if (!existing.has(code.toLowerCase())) return code;
  }
  throw new Error('تولید کد اشتراک یکتا ممکن نشد؛ دوباره تلاش کنید.');
}
function customerPublicRecord_(row) {
  if (!row) return null;
  const firstName = text_(row.firstName); const lastName = text_(row.lastName);
  return {
    code: text_(row.customerId),
    fullName: text_(row.fullName) || [firstName, lastName].filter(Boolean).join(' '),
    firstName: firstName, lastName: lastName,
    phone: normalizePhone_(row.contact), email: text_(row.email),
    province: text_(row.province), city: text_(row.city), address: text_(row.address),
    postalCode: text_(row.postal), level: getCustomerLevelInfo_(text_(row.level) || 'عادی')
  };
}
function resolveOrCreateCustomer_(p) {
  const rows = scRead_('customers');
  const membershipCode = text_(p && p.membershipCode);
  if (membershipCode) {
    const hit = rows.find(r => text_(r.customerId).toLowerCase() === membershipCode.toLowerCase());
    if (!hit) throw new Error('کد اشتراک واردشده معتبر نیست.');
    return customerPublicRecord_(hit);
  }
  const phone = normalizePhone_(p && p.phone);
  const byPhone = rows.find(r => phone && normalizePhone_(r.contact) === phone);
  if (byPhone) {
    const updates = {};
    const incomingFirst = text_(p.firstName) || text_(p.name);
    const incomingLast = text_(p.lastName);
    if (!text_(byPhone.firstName) && incomingFirst) updates.firstName = incomingFirst;
    if (!text_(byPhone.lastName) && incomingLast) updates.lastName = incomingLast;
    if (!text_(byPhone.fullName) && (incomingFirst || incomingLast)) updates.fullName = [incomingFirst, incomingLast].filter(Boolean).join(' ');
    if (!text_(byPhone.province) && text_(p.province)) updates.province = text_(p.province);
    if (!text_(byPhone.city) && text_(p.city)) updates.city = text_(p.city);
    if (!text_(byPhone.address) && text_(p.address)) updates.address = text_(p.address);
    if (Object.keys(updates).length) scUpdate_('customers', byPhone._rowIndex, updates);
    return customerPublicRecord_(Object.assign({}, byPhone, updates));
  }
  const first = text_(p && p.firstName) || text_(p && p.name);
  const last = text_(p && p.lastName);
  if (!first || !last) throw new Error('برای ثبت مشتری جدید، نام و نام خانوادگی الزامی است.');
  if (!phone) throw new Error('شماره تماس مشتری معتبر نیست.');
  const newCode = generateUniqueMembershipCode_(rows);
  const fullName = [first, last].filter(Boolean).join(' ');
  const written = customersWrite_({
    rowNo: rows.length + 1, joinDate: scStoreDate_(jalaliToday_()), customerId: newCode, fullName: fullName,
    firstName: first, lastName: last, contact: phone, email: text_(p.email),
    province: text_(p.province), city: text_(p.city), address: text_(p.address),
    postal: text_(p.postalCode), level: 'عادی', status: 'فعال'
  });
  if (!customersVerify_(written, newCode)) throw new Error('مشتری در Customers_DB ذخیره و تأیید نشد.');
  const saved = scRead_('customers').find(r => Number(r._rowIndex) === Number(written.rowIndex));
  return customerPublicRecord_(saved || { customerId: newCode, fullName: fullName, firstName: first, lastName: last, contact: phone, email: text_(p.email), province: text_(p.province), city: text_(p.city), address: text_(p.address), postal: text_(p.postalCode), level: 'عادی' });
}
function validateMembershipCode(code) {
  const value = text_(code);
  if (!value) return { valid: false, message: 'کد اشتراک را وارد کنید.' };
  let rows = [];
  try { rows = scRead_('customers'); } catch (e) { return { valid: false, message: 'شیت Customers_DB پیدا نشد.' }; }
  const row = rows.find(r => text_(r.customerId).toLowerCase() === value.toLowerCase());
  if (!row) return { valid: false, message: 'کد اشتراک معتبر نیست.' };
  return {
    valid: true,
    customer: {
      fullName: text_(row.fullName) || [text_(row.firstName), text_(row.lastName)].filter(Boolean).join(' '),
      firstName: text_(row.firstName), lastName: text_(row.lastName),
      phone: normalizePhone_(row.contact), email: text_(row.email), province: text_(row.province),
      city: text_(row.city), address: text_(row.address), postalCode: text_(row.postal),
      level: getCustomerLevelInfo_(text_(row.level) || 'عادی')
    }
  };
}

/* ==================== کدهای تخفیف ==================== */
function normalizeOfferCode_(v) { return text_(v).replace(/\s+/g, '').toUpperCase(); }
function validateOfferCode(code) {
  const result = validateOfferCode_(normalizeOfferCode_(code), {}, false);
  return { valid: !!result.valid, code: result.code || '', discountRate: result.discountRate || 0, message: result.message || '' };
}
function validateOfferCode_(code, payload, forRedemption) {
  if (!code) return { valid: false, message: 'کد تخفیف را وارد کنید.' };
  let offers = [];
  try { offers = scRead_('offers'); } catch (e) { return { valid: false, message: 'شیت offer-cods پیدا نشد.' }; }
  const row = offers.find(r => normalizeOfferCode_(r.code) === code);
  if (!row) return { valid: false, message: 'کد تخفیف معتبر نیست.' };
  if (!/^(فعال|active|1|true|بله)$/i.test(text_(row.status))) return { valid: false, message: 'این کد تخفیف غیرفعال است.' };
  const rate = number_(row.percent);
  if (!(rate > 0 && rate <= 100)) return { valid: false, message: 'درصد تخفیف این کد معتبر نیست.' };
  const tz = Session.getScriptTimeZone() || 'Asia/Tehran';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const start = offerDateKey_(row.start, tz);
  const end = offerDateKey_(row.end, tz);
  if (start && today < start) return { valid: false, message: 'زمان شروع اعتبار این کد نرسیده است.' };
  if (end && today > end) return { valid: false, message: 'اعتبار این کد تخفیف پایان یافته است.' };
  let redemptions = [];
  try { redemptions = scRead_('redemptions').filter(r => /^(استفاده شد|USED)$/i.test(text_(r.usageStatus))); } catch (e) { return { valid: false, message: 'شیت Offer-Redemptions هنوز آماده نشده است.' }; }
  const totalLimit = number_(row.totalLimit);
  if (totalLimit > 0 && redemptions.filter(r => normalizeOfferCode_(r.code) === code).length >= totalLimit) return { valid: false, message: 'ظرفیت استفاده از این کد تکمیل شده است.' };
  const customerCode = text_(payload && payload.membershipCode);
  const individualLimit = number_(row.individualLimit);
  if (individualLimit > 0 && customerCode) {
    const used = redemptions.filter(r => normalizeOfferCode_(r.code) === code && text_(r.customerId).toLowerCase() === customerCode.toLowerCase()).length;
    if (used >= individualLimit) return { valid: false, message: 'سقف استفاده فردی از این کد برای این اشتراک تکمیل شده است.' };
  }
  return { valid: true, code: code, discountRate: rate, message: 'کد تخفیف معتبر است.' };
}
function offerDateKey_(value, tz) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  const s = text_(value);
  if (!s) return '';
  const p = scParseJalali_(s);
  if (p) { const g = scJ2G_(p[0], p[1], p[2]); return g[0] + '-' + String(g[1]).padStart(2,'0') + '-' + String(g[2]).padStart(2,'0'); }
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return m[1] + '-' + String(m[2]).padStart(2,'0') + '-' + String(m[3]).padStart(2,'0');
  const d = new Date(s);
  return !isNaN(d.getTime()) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
}
function recordOfferRedemption_(data) {
  scAppend_('redemptions', { code: data.code, customerId: data.customerCode, requestId: data.requestId, amount: data.discountAmount, usageStatus: 'استفاده شد', regTime: new Date() });
}

/* ==================== موتور قیمت V13 — سند نهایی فرمول‌ها ==================== */
function normKey_(s) {
  return String(s || '').toLowerCase()
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۶۷۸۹'.indexOf(d))
    .replace(/[\(\)«»\[\]:*\/\\|،,;؛!؟?]+/g, ' ')
    .replace(/ساعتی|هر\s*ساعت|ریال|تومان|درصد|%|rate|hourly/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function readRulesRaw_() {
  const sh = getSpreadsheet_().getSheetByName('PricingRules');
  if (!sh || sh.getLastRow() < 2) return [];
  const headers = liveHeaders_(sh);
  const iVar = headers.findIndex(h => /^variable$/i.test(h));
  const iVal = headers.findIndex(h => /^value$/i.test(h));
  const iUnit = headers.findIndex(h => /^unit$/i.test(h));
  const iFa = headers.findIndex(h => h === 'Condition-Key-FA' || h === 'کلید_شرط');
  const iEn = headers.findIndex(h => h === 'Condition-Key-EN');
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
  return vals.map(r => ({
    variable: iVar >= 0 ? text_(r[iVar]) : '',
    value: iVal >= 0 ? r[iVal] : '',
    unit: iUnit >= 0 ? text_(r[iUnit]) : '',
    keyFa: iFa >= 0 ? text_(r[iFa]) : '',
    keyEn: iEn >= 0 ? text_(r[iEn]) : ''
  }));
}
function getPricingRules_() {
  const out = {};
  readRulesRaw_().forEach(r => {
    let v = number_(r.value);
    if (/درصد|%|percent/i.test(r.unit) && v > 0 && v <= 1) v *= 100;
    if (r.variable) out[r.variable.toUpperCase()] = v;
    if (r.keyFa) { out[r.keyFa] = v; out[normKey_(r.keyFa)] = v; }
    if (r.keyEn) { out[r.keyEn] = v; out[r.keyEn.toLowerCase()] = v; out[normKey_(r.keyEn)] = v; }
  });
  return out;
}
function ruleVar_(rules, varCode, matcher, label, required) {
  if (rules[varCode] !== undefined && number_(rules[varCode]) > 0) return number_(rules[varCode]);
  const keys = Object.keys(rules);
  for (const k of keys) {
    if (matcher && matcher(normKey_(k)) && number_(rules[k]) > 0) return number_(rules[k]);
  }
  if (required) throw new Error('نرخ «' + label + '» (' + varCode + ') در شیت PricingRules پیدا نشد یا صفر است.');
  return 0;
}
function firstPositive_(values) {
  for (const v of values) { const n = number_(v); if (n > 0) return n; }
  return 0;
}

function calculatePrice_(payload) {
  validatePricingPayload_(payload);
  const service = getServiceById_(text_(payload.serviceId));
  const answers = payload.answers && typeof payload.answers === 'object' ? payload.answers : {};
  const rules = getPricingRules_();
  const quantity = Math.max(0, number_(answers['مقدار'] || answers['تعداد طبقات'] || payload.quantity));
  if (quantity <= 0) throw new Error('مقدار سفارش باید بیشتر از صفر باشد.');
  if (quantity < service.minimum) throw new Error('حداقل مقدار مجاز برای این خدمت ' + service.minimum + ' است.');

  const SE = number_(service.rate);
  const hourlyUnit = /ساعت|hour/i.test(service.unit || '');
  const H = firstPositive_([answers['زمان موردنیاز (ساعت)'], answers['مدت زمان (ساعت)'], answers['مدت اجرا (ساعت)'], answers['ساعت'], hourlyUnit ? quantity : 0]);
  const area = Math.max(0, number_(answers['مساحت']));
  const rooms = Math.max(0, number_(answers['تعداد اتاق']));
  const N = Math.max(0, number_(answers['تعداد واحد']));
  const NF = Math.max(0, number_(answers['تعداد طبقات']));
  const N_M = Math.max(0, number_(answers['تعداد نیروی آقا']));
  const N_FM = Math.max(0, number_(answers['تعداد نیروی خانم']));
  const VG = Math.max(0, number_(answers['ارزش کالا']));
  const CM = ruleVar_(rules, 'CM', k => /آقا|مرد|male|man|men/.test(k) && /دستمزد|نرخ|نیرو|نظافت|labor|wage|clean|worker/.test(k), 'دستمزد ساعتی نیروی آقا', false);
  const CF = ruleVar_(rules, 'CF', k => /خانم|خانوم|زن|female|woman|women/.test(k) && /دستمزد|نرخ|نیرو|نظافت|labor|wage|clean|worker/.test(k), 'دستمزد ساعتی نیروی خانم', false);
  const AR = ruleVar_(rules, 'AR', k => /مساحت|متراژ|area/.test(k), 'نرخ مساحت', false);
  const RO = ruleVar_(rules, 'RO', k => /اتاق|room/.test(k), 'نرخ اتاق', false);
  const AP = ruleVar_(rules, 'AP', k => /واحد|unit/.test(k), 'نرخ هر واحد', false);
  const JH = ruleVar_(rules, 'JH', k => /سختی|difficulty|hard/.test(k), 'نرخ سختی کار', false);
  const IN = ruleVar_(rules, 'IN', k => /بیمه/.test(k) && /ضریب|درصد|نرخ|insurance/.test(k), 'ضریب بیمه', false);
  const UR = ruleVar_(rules, 'UR', k => /فوری|urgent/.test(k), 'نرخ اقدام فوری', false);
  const TA = ruleVar_(rules, 'TA', k => /مالیات|ارزش\s*افزوده|vat|tax/.test(k), 'نرخ مالیات', false);
  const VAT = ruleVar_(rules, 'VAT', k => /بیمه/.test(k) && /ارزش\s*افزوده/.test(k), 'ارزش افزوده بیمه', false) || TA;
  const CA = ruleVar_(rules, 'CA', k => /کنسلی|cancel/.test(k), 'نرخ کنسلی', false);

  const nme = (service.nameEn || '').toLowerCase();
  const nmf = service.name || '';
  const isCleaning = /home\s*\/\s*office\s*cleaning/.test(nme) || /نظافت منزل|نظافت \/ دفتر/.test(nmf);
  const isStair = /stairwell/.test(nme) || /راه پله|مشاعات/.test(nmf);
  const isLocal = /local\s*transport/.test(nme) || /درون\s*شهری/.test(nmf);
  const isInter = /long[-\s]?distance/.test(nme) || /برون\s*شهری/.test(nmf);
  const isFurn = /furniture|moving|freight/.test(nme) || /جابجایی اثاثیه/.test(nmf);

  let FS = 0;
  if (!isStair && !isLocal && !isInter && !isFurn) {
    FS = SE * (H > 0 ? H : quantity);
    if (area > 0 && AR > 0) FS += AR * area;
    if (rooms > 0 && RO > 0) FS += RO * rooms;
    FS = Math.round(FS);
  }
  let FC = 0;
  if (N_M > 0 || N_FM > 0) {
    const hLab = H > 0 ? H : quantity;
    if (N_M > 0) CM > 0 || (() => { throw new Error('نرخ دستمزد ساعتی نیروی آقا (CM) در PricingRules تعریف نشده است.'); })();
    if (N_FM > 0) CF > 0 || (() => { throw new Error('نرخ دستمزد ساعتی نیروی خانم (CF) در PricingRules تعریف نشده است.'); })();
    FC = Math.round((CM * hLab * N_M) + (CF * hLab * N_FM));
  }
  let FSTC = 0;
  if (isStair) {
    const nf = NF > 0 ? NF : 1;
    FSTC = Math.round(((AP * N) * nf) + (SE * nf) + (CM * N_M));
    FS = 0; FC = 0;
  }
  let FFRS = 0, FICS = 0, FOCS = 0;
  if (isFurn || (isLocal && (N_M > 0 || NF > 0))) {
    const nf = NF > 0 ? NF : 1;
    FFRS = Math.round((((JH + CM) * N_M) + SE) * nf);
    FC = 0;
  } else if (isLocal) {
    FICS = Math.round(SE);
  }
  if (isInter) { FOCS = Math.round(SE); FC = 0; }
  let FI = 0;
  if (VG > 0 && IN > 0) FI = Math.round((IN * VG) * (1 + (VAT > 0 ? VAT / 100 : 0)));
  let SI = 0; const sideBreakdown = [];
  getSelectedSideServices_(payload).forEach(item => {
    const side = getSideServiceById_(item.id);
    const line = Math.round(side.rate * item.quantity);
    SI += line;
    sideBreakdown.push({ name: side.name, quantity: item.quantity, unit: side.unit, total: line });
  });
  const level = resolveCustomerLevel_(payload);
  const DS = level.discountRate / 100;
  const offerCode = normalizeOfferCode_(payload.offerCode);
  let offer = { valid: false, code: '', discountRate: 0, message: '' };
  if (offerCode) {
    offer = validateOfferCode_(offerCode, payload, false);
    if (!offer.valid) throw new Error(offer.message || 'کد تخفیف معتبر نیست.');
  }
  const DC = offer.valid ? offer.discountRate / 100 : 0;
  const FD = Math.round((DS + DC) * (FS + SI + FICS + FOCS));
  const membershipPart = Math.round(DS * (FS + SI + FICS + FOCS));
  const offerPart = FD - membershipPart;
  const gross = FS + FC + FSTC + FFRS + FI + FICS + FOCS + SI;
  const TOII = Math.max(0, gross - FD);
  const actionType = text_(payload.actionType) || 'عادی';
  const ur = actionType === 'فوری' ? (UR > 0 ? UR / 100 : 0) : 0;
  const SB = Math.max(0, (FS + SI + FICS + FOCS) - FD);
  const FU = Math.round((SB + FC) * ur);
  const FT = Math.round(TOII * (TA > 0 ? TA / 100 : 0));
  const FCN = 0;
  const FPA = TOII + FT + FU + FCN;

  return {
    serviceName: service.name,
    basePrice: FS + FC + FSTC + FFRS + FICS + FOCS,
    FS: FS, FC: FC, FSTC: FSTC, FFRS: FFRS, FI: FI, FICS: FICS, FOCS: FOCS,
    sideServicesTotal: SI, SI: SI, sideBreakdown: sideBreakdown,
    overtimeHours: 0, overtimeAmount: 0,
    urgentAmount: FU, subtotal: TOII,
    customerLevel: level.name, discountRate: level.discountRate,
    discountAmount: membershipPart, offerCode: offer.valid ? offer.code : '',
    offerDiscountRate: offer.valid ? offer.discountRate : 0, offerDiscountAmount: offerPart,
    totalDiscountAmount: FD, offerMessage: offer.message || '',
    taxRate: TA, taxAmount: FT, cancellationAmount: FCN, cancellationRate: CA,
    finalPrice: FPA
  };
}

function getCustomerLevelInfo_(name) {
  let rows = [];
  try { rows = scRead_('levels'); } catch (e) { return { name: 'عادی', discountRate: 0, id: '' }; }
  if (!rows.length) return { name: 'عادی', discountRate: 0, id: '' };
  const row = rows.find(r => (text_(r.name) === (name || 'عادی') || text_(r.id) === (name || '')) && /^(فعال|active)$/i.test(text_(r.status)));
  if (!row) return { name: 'عادی', discountRate: 0, id: '' };
  return { name: text_(row.name) || 'عادی', discountRate: text_(row.discountType) === 'percent' ? number_(row.discountValue) : 0, id: text_(row.id) };
}
function resolveCustomerLevel_(payload) {
  let rows = [];
  try { rows = scRead_('customers'); } catch (e) { return getCustomerLevelInfo_('عادی'); }
  if (rows.length) {
    const code = text_(payload.membershipCode).toLowerCase();
    const phone = normalizePhone_(payload.phone);
    const row = rows.find(r => (code && text_(r.customerId).toLowerCase() === code) || (!code && phone && normalizePhone_(r.contact) === phone));
    if (row) return getCustomerLevelInfo_(text_(row.level) || 'عادی');
  }
  return getCustomerLevelInfo_('عادی');
}
function getServiceById_(id) {
  const service = getServices().services.find(s => s.id === id);
  if (!service) throw new Error('خدمت انتخاب‌شده معتبر نیست.');
  return service;
}
function getSideServiceById_(id) {
  const side = getServices().sideServices.find(s => s.id === id);
  if (!side) throw new Error('خدمت جانبی معتبر نیست.');
  return side;
}
function getSelectedSideServices_(payload) {
  const raw = Array.isArray(payload.sideServices) ? payload.sideServices : [];
  const seen = {};
  return raw.map(item => {
    const id = text_(item && item.id);
    const quantity = number_(item && item.quantity);
    if (!id || quantity <= 0 || quantity > 10000) throw new Error('مقدار خدمت جانبی نامعتبر است.');
    if (seen[id]) throw new Error('خدمت جانبی تکراری.');
    seen[id] = true;
    return { id: id, quantity: quantity, name: getSideServiceById_(id).name };
  });
}
function validatePricingPayload_(p) {
  if (!p || typeof p !== 'object') throw new Error('اطلاعات قیمت‌گذاری معتبر نیست.');
  if (!text_(p.serviceId)) throw new Error('یک خدمت انتخاب کنید.');
  const quantity = number_(p.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) throw new Error('مقدار سفارش نامعتبر است.');
  if (p.sideServices != null && !Array.isArray(p.sideServices)) throw new Error('ساختار خدمات جانبی معتبر نیست.');
}
function validateOrderPayload_(p) {
  if (!p || typeof p !== 'object') throw new Error('اطلاعات درخواست معتبر نیست.');
  if (!text_(p.name).trim() || text_(p.name).trim().length > 120) throw new Error('نام و نام خانوادگی را وارد کنید.');
  const phone = normalizePhone_(p.phone);
  if (!/^09\d{9}$/.test(phone)) throw new Error('شماره موبایل باید ۱۱ رقم و با 09 شروع شود.');
  if (!text_(p.serviceId)) throw new Error('یک خدمت انتخاب کنید.');
  const quantity = number_(p.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) throw new Error('مقدار سفارش نامعتبر است.');
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalizeDigits_(p.requestDate))) throw new Error('تاریخ شمسی را با قالب ۱۴۰۵/۰۷/۲۳ وارد کنید.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text_(p.requestTime))) throw new Error('ساعت را دقیقاً مانند ۱۷:۳۰ وارد کنید.');
  if (!text_(p.address).trim() || text_(p.address).trim().length < 5) throw new Error('نشانی کامل را وارد کنید.');
  if (text_(p.notes).length > 2000) throw new Error('توضیحات بیش از حد مجاز است.');
  const qs = getServices().questions.filter(q => q.serviceId === text_(p.serviceId));
  const answers = p.answers && typeof p.answers === 'object' ? p.answers : {};
  qs.forEach(q => {
    const required = /اجباری|required/i.test(q.fieldType);
    if (required && q.answerColumn && !text_(answers[q.answerColumn])) throw new Error('پاسخ «' + q.question + '» الزامی است.');
  });
}

function createTrelloCard_(data) {
  const key = getSetting_('TRELLO_API_KEY', '');
  const token = getSetting_('TRELLO_TOKEN', '');
  const listId = getSetting_('TRELLO_LIST_ID', '');
  if (!key || !token || !listId) return { attempted: false, success: false, skipped: true };
  const description = [
    'کد سفارش: ' + data.orderId, 'نام: ' + data.name, 'تلفن: ' + data.phone,
    'خدمت: ' + data.serviceName, 'مقدار: ' + data.quantity, 'خدمات جانبی: ' + (data.sideNames || 'ندارد'),
    'زمان درخواست: ' + data.requestDate + ' ' + data.requestTime, 'نشانی: ' + data.address,
    'قیمت پایه: ' + data.basePrice, 'تخفیف کل: ' + (data.discountAmount || 0),
    'تخفیف اشتراک: ' + (data.subscriptionDiscountAmount || 0), 'کد تخفیف: ' + (data.offerCode || 'ندارد'),
    'مبلغ تخفیف کد: ' + (data.offerDiscountAmount || 0), 'مالیات: ' + (data.taxAmount || 0),
    'قیمت نهایی: ' + data.finalPrice, 'توضیحات: ' + (data.notes || 'ندارد')
  ].join('\n');
  const response = UrlFetchApp.fetch('https://api.trello.com/1/cards', {
    method: 'post',
    payload: { key: key, token: token, idList: listId, name: 'سفارش ' + data.orderId + ' — ' + data.name, desc: description },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) return { attempted: true, success: false, error: 'Trello HTTP ' + code };
  return { attempted: true, success: true };
}

function auditWebAppStructure() { return schemaTest(); }
function formSmokeTest() {
  const t0 = new Date();
  const out = {};
  try { const s = getServices(); out.services = s.services.length; out.sides = s.sideServices.length; out.questions = s.questions.length; }
  catch (e) { out.servicesError = e.message; }
  try { out.offer = validateOfferCode('zv.140507'); } catch (e) { out.offerError = e.message; }
  try { out.rules = Object.keys(getPricingRules_()).length; } catch (e) { out.rulesError = e.message; }
  out.seconds = Math.round((new Date() - t0) / 1000);
  console.log(JSON.stringify(out, null, 1));
  return out;
}

