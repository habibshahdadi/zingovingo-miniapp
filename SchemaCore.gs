/**
 * ZingoVingo — SchemaCore V6
 * - هدرها «زنده» و در هر اجرا خوانده می‌شوند (بدون کش چنددقیقه‌ای) → تغییر ستون‌ها فوراً اعمال می‌شود.
 * - هر فیلد منطقی با لیست Alias به هدر واقعی نگاشت می‌شود (انگلیسی جدید اول، فارسی قدیمی بعد).
 * - پشتیبانی از هدر «Profile»، شیت «GroupMembers» و شیت «Calculation_formula».
 * - قانون تاریخ: ذخیره = میلادی | نمایش = شمسی فارسی. ساعت = ۲۴ ساعته فارسی.
 * - مجوزها زنده از شیت User_Roles خوانده می‌شوند (ALL / Owner / ❌).
 */

// ==================== نگاشت موجودیت → نام شیت ====================
const SCHEMA_ENTITY_SHEETS = {
  orders: ['Orders'], cards: ['Cards'], tasks: ['Task_Lists'], cardHistory: ['CardHistory'],
  statusRoles: ['status_Roles'], employees: ['Employees'], workers: ['Workers'],
  branchManagers: ['Branchs_managers'], branches: ['Branches'], groups: ['Groups'],
  groupMembers: ['GroupMembers'],
  wallets: ['Wallets', 'Wallets '], offers: ['offer-cods'], redemptions: ['Offer-Redemptions'],
  customers: ['Customers_DB'], services: ['Services'], sides: ['SideServices'],
  questions: ['Service-related questions'], rules: ['PricingRules'], formulas: ['Calculation_formula'],
  levels: ['Subscription_Level'], settings: ['Settings'], logs: ['EmployeeLogs'], userRoles: ['User_Roles'],
  smsTemplates: ['SMS_Templates'], smsLogs: ['SMS_Logs']
};

// ==================== فیلد منطقی → هدرهای مجاز (به ترتیب اولویت) ====================
const SCHEMA_FIELDS = {
  orders: {
    createdAt: ['Creation-Time', 'تاریخ و ساعت ثبت', 'تاریخ ثبت'], requestId: ['Request-ID', 'RequestID'],branchId: ['Branch-ID', 'شعبه'],
    verifier: ['Verifier', 'کارمند مسئول'], groupId: ['Group-ID', 'گروه'], operator: ['operator', 'اپراتور'], customerId: ['Customers-ID', 'کد اشتراک'],
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
  },
  cards: {
    cardId: ['Card-ID'], listId: ['Lists-ID'], requestId: ['Request-ID', 'RequestID'], customerId: ['Customers-ID'],
    branchId: ['Branch-ID'], verifier: ['Verifier'], workerId: ['Worker-ID'], customerName: ['نام_ مشتری'],
    serviceType: ['نوع_خدمات'], actionType: ['نوع-اقدام'], duration: ['مدت اجرا'], recDate: ['Recurrence-Date'],
    recType: ['Recurrence-Type'], execDate: ['Execution-Date'], execTime: ['Execution-Time'], contact: ['Contact-Number'],
    address: ['Address'], details: ['Request-Details'], description: ['Description'], total: ['Total-Payments'],
    createdAt: ['Creation-Time'], updatedAt: ['Last-updated -time'], status: ['Status']
  },
  tasks: {
    taskId: ['Lists-ID'], customerId: ['Customers-ID'], createdAt: ['Creation-Date'], execDate: ['Execution-Date'],
    recDate: ['Recurrence-Date'], recType: ['Recurrence-Type'], execTime: ['Execution-Time'], status: ['Status']
  },
  cardHistory: { cardId: ['Card-ID'], fixType: ['نوع اصلاحیه'], from: ['From-status'], to: ['to-status'], userId: ['user-ID'], date: ['Date'], desc: ['Description'] },
statusRoles: { 
  cardStatus: ['Card-status'], 
  recType: ['Recurrence-Type'], 
  actionType: ['نوع-اقدام'], 
  userStatus: ['User-Status'] 
},
  employees: {
    empId: ['Employee-ID', 'کد پرسنلی'], username: ['username'], password: ['password'],
    firstName: ['First-Name', 'نام'], lastName: ['Last-Name', 'نام خانوادگی'], fatherName: ['Father-Name'],
    gender: ['Gender', 'جنسیت'], nationalId: ['National-ID', 'کد ملی'], birthCert: ['Birth-Certificate-Number'],
    birthday: ['Birthday', 'تاریخ تولد'], branchId: ['Branch-ID', 'شعبه'], groupId: ['Group-ID', 'گروه'],
    jobTitle: ['Job-Title', 'سمت'], operations: ['Operations', 'سطح دسترسی'], specialization: ['Specialization', 'تخصص'],
    email: ['Email', 'email'], contact: ['Contact-Number', 'شماره تماس'],
    photo: ['Profile', 'Profile-hoto', 'عکس پروفایل'],
    province: ['Province', 'استان'], city: ['City', 'شهر'], address: ['Address', 'آدرس'],
    emergencyName: ['Emergency-Contact-Name'], emergency: ['Emergency-Contact', 'تماس اضطراری'],
    hireDate: ['Date-Hire', 'تاریخ استخدام'], description: ['Description'], completed: ['Completed'],
    inProgress: ['In-Progress'], cancelled: ['Cancelled'], rank: ['Rank'], notes: ['Notes'], status: ['Status', 'وضعیت']
  },
  workers: {
    workerId: ['Worker-ID', 'کد کارگر'], username: ['username'], password: ['password'],
    firstName: ['First-Name'], lastName: ['Last-Name'], fatherName: ['Father-Name'], gender: ['Gender'],
    nationalId: ['National-ID'], birthCert: ['Birth-Certificate-Number'], birthday: ['Birthday'],
    branchId: ['Branch-ID'], groupId: ['Group-ID'], jobTitle: ['Job-Title'], operations: ['Operations'],
    specialization: ['Specialization'], email: ['Email'], contact: ['Contact-Number'],
    photo: ['Profile', 'Profile-hoto', 'عکس پروفایل'],
    province: ['Province'], city: ['City'], address: ['Address'], emergencyName: ['Emergency-Contact-Name'],
    emergency: ['Emergency-Contact'], hireDate: ['Date-Hire'], description: ['Description'],
    totalRevenue: ['Total-Revenue'], totalOrders: ['Total-Orders'], completed: ['Completed'],
    inProgress: ['In-Progress'], cancelled: ['Cancelled'], rank: ['Rank'], notes: ['Notes'], status: ['Status']
  },
  branchManagers: {
    bnmId: ['BNM-ID'], username: ['username'], password: ['password'], firstName: ['First-Name'], lastName: ['Last-Name'],
    fatherName: ['Father-Name'], gender: ['Gender'], nationalId: ['National-ID'], birthCert: ['Birth-Certificate-Number'],
    birthday: ['Birthday'], branchId: ['Branch-ID'], groupId: ['Group-ID'], jobTitle: ['Job-Title'], operations: ['Operations'],
    specialization: ['Specialization'], email: ['Email'], contact: ['Contact-Number'],
    photo: ['Profile', 'Profile-hoto', 'عکس پروفایل'],
    province: ['Province'], city: ['City'], address: ['Address'], emergencyName: ['Emergency-Contact-Name'],
    emergency: ['Emergency-Contact'], hireDate: ['Date-Hire'], description: ['Description'], completed: ['Completed'],
    inProgress: ['In-Progress'], cancelled: ['Cancelled'], rank: ['Rank'], notes: ['Notes'], status: ['Status']
  },
  branches: {
    branchId: ['Branch-ID', 'کد شعبه'], bnmId: ['BNM-ID'], managerName: ['Manager-Name', 'مدیر شعبه'],
    name: ['Branch-Name', 'نام شعبه'], province: ['Province', 'استان'], city: ['City', 'شهر'], area: ['Area-Activity'],
    address: ['Address', 'آدرس'], totalEmployees: ['Total-Employees'], totalGroups: ['Total-Groups'],
    totalRevenue: ['Total-Revenue'], totalOrders: ['Total-Orders'], completed: ['Completed'], inProgress: ['In-Progress'],
    cancelled: ['Cancelled'], description: ['Description', 'توضیحات'], established: ['Date-Established', 'تاریخ ایجاد'],
    updated: ['Last-Updated'], rank: ['Rank'], notes: ['Notes'], status: ['Status', 'وضعیت']
  },
  groups: {
    groupId: ['Group-ID', 'کد گروه'], branchId: ['Branch-ID', 'شعبه'], workerId: ['Worker-ID'],
    supervisorName: ['Supervisor-Name', 'سرپرست'], name: ['Group-Name', 'نام گروه'], province: ['Province'], city: ['City'],
    area: ['Area-Activity', 'منطقه'], totalMembers: ['Total-Members'], groupType: ['Group-Type'],
    totalRevenue: ['Total-Revenue'], totalOrders: ['Total-Orders'], completed: ['Completed'], inProgress: ['In-Progress'],
    cancelled: ['Cancelled'], description: ['Description'], established: ['Date-Established', 'تاریخ ایجاد'],
    updated: ['Last-Updated'], rank: ['Rank'], notes: ['Notes'], status: ['Status', 'وضعیت']
  },
  groupMembers: {
    groupId: ['Group-ID', 'کد گروه'], username: ['username'], workerId: ['Worker-ID', 'شناسه یکتا'], role: ['Role', 'نقش در گروه'],
    joinDate: ['Join-Date', 'تاریخ عضویت'], status: ['Status', 'وضعیت']
  },
  wallets: { customerId: ['Customers-ID', 'کد اشتراک'], balance: ['Balance', 'موجودی'], lastDeposit: ['Last-Deposit'], depositDate: ['Deposit-Date'], lastWithdrawal: ['Last-Withdrawal'], withdrawalDate: ['Withdrawal-Date'], status: ['Status', 'وضعیت'] },
  offers: { code: ['offer-cod', 'کد'], percent: ['Percentage', 'درصد تخفیف'], start: ['Start-Offer', 'تاریخ شروع'], end: ['End-Offer', 'تاریخ پایان'], individualLimit: ['Individual-Limit', 'محدودیت فردی'], totalLimit: ['Total-Code-Limit', 'تعداد کد'], status: ['Status', 'وضعیت'] },
  redemptions: { code: ['offer-cod', 'کد تخفیف'], customerId: ['Customers-ID', 'کد اشتراک مشتری'], requestId: ['Request-ID', 'RequestID'], amount: ['Discount-Amount', 'مبلغ تخفیف'], usageStatus: ['Usage-Status', 'وضعیت استفاده'], regTime: ['Registration-Time', 'زمان ثبت'], date: ['Date', 'تاریخ نهایی‌سازی'] },
  customers: {
    rowNo: ['ردیف', 'Row', 'Row-No'], fullName: ['Full-Name', 'نام کامل'],
    joinDate: ['تاریخ عضویت', 'Join-Date'], customerId: ['Customers-ID', 'کد اشتراک'], firstName: ['First-Name', 'نام'],
    lastName: ['Last-Name', 'نام خانوادگی'], username: ['username', 'نام کاربری'], password: ['password', 'رمز عبور'], fatherName: ['Father-Name'],
    gender: ['Gender', 'جنسیت'], nationalId: ['National-ID'], birthday: ['Birthday', 'تاریخ تولد'],
    contact: ['Contact-Number', 'شماره تماس', 'تلفن'], email: ['Email', 'ایمیل'],
    photo: ['Profile', 'Profile-hoto', 'عکس پروفایل'],
    province: ['Province', 'استان'], city: ['City', 'شهر'], address: ['Address', 'آدرس'], postal: ['Postal-Code', 'کد پستی'],
    level: ['Subscription_Level', 'سطح'], totalOrders: ['Total -Orders', 'کل سفارشات'], totalPayments: ['Total-Payments', 'مبلغ کل'],
    settled: ['Settled', 'تسویه شده'], credit: ['Credit', 'بستانکار'], debit: ['Debit', 'بدهکار'],
    validity: ['Validity-Period', 'مدت اعتبار اشتراک'], subStart: ['Subscription-Start', 'تاریخ شروع / تمدید اشتراک'],
    subEnd: ['Subscription-End', 'تاریخ پایان / تمدید اشتراک'], status: ['Status', 'وضعیت'], notes: ['Notes', 'توضیحات']
  },
  services: { id: ['Service-ID', 'کد خدمت'], nameEn: ['Service-Name-EN'], nameFa: ['Service-Name-FA', 'نام خدمت'], rate: ['Base-Rate', 'نرخ پایه'], unit: ['Unit', 'واحد'], minOrder: ['Minimum-Order', 'حداقل سفارش'] },
  sides: { id: ['Side-ID', 'کد خدمت جانبی'], nameEn: ['Side-Name-EN'], nameFa: ['Side-Name-FA', 'نام خدمت'], rate: ['Base-Rate', 'نرخ پایه'], unit: ['Unit', 'واحد'], serviceEn: ['Service-Name-EN', 'خدمت اصلی مرتبط'], notes: ['Notes', 'توضیحات'] },
  questions: { serviceEn: ['Service-Name-EN', 'کد خدمت'], serviceFa: ['Service-Name-FA', 'نام فارسی'], question: ['Question', 'پرسش'], position: ['Position', 'جایگاه پرسش'], inputType: ['Input-Type', 'نوع ورودی'], options: ['Options', 'گزینه ها'], fieldType: ['Field-Type', 'نوع فیلد'], help: ['Help-Text', 'متن راهنما'], column: ['Column-Name', 'نام ستون قرار گیری پاسخ'] },
  rules: { keyEn: ['Condition-Key-EN', 'کلید_شرط'], keyFa: ['Condition-Key-FA'], value: ['Value', 'مقدار'], unit: ['Unit', 'واحد'], variable: ['Variable'], guide: ['Guide'] },
  formulas: { name: ['formula-Name'], formula: ['Calculation-formula'], keyEn: ['Condition-Key-EN'], keyFa: ['Condition-Key-FA'], variable: ['Variable'], guide: ['Guide'] },
  levels: { id: ['Sub-id', 'level_id'], name: ['Sub-name', 'level_name'], discountType: ['discount-type'], discountValue: ['discount-value'], minOrders: ['min-orders'], minAmount: ['min-amount'], validity: ['Validity-Period'], monthly: ['Monthly-amount'], status: ['status'] },
  settings: { key: ['Key', 'کلید'], value: ['Value', 'مقدار'], usage: ['Usage'] },
  logs: { empId: ['کد پرسنلی'], name: ['نام'], action: ['عملیات'], details: ['جزئیات'], result: ['نتیجه'], date: ['تاریخ'] },
  userRoles: { operation: ['Operations'], operationFa: ['Operations-FA-Name'], roleFa: ['Roles-FA-Name'], roleEn: ['Roles-EN-Name'], panelEn: ['Panel-EN-Name'], panelFa: ['Panel-FA-Name'] }
};

// ==================== فیلدهای تاریخی / مالی / جستجو ====================
const SCHEMA_DATETIME = { orders: ['createdAt'], cards: ['createdAt', 'updatedAt'], redemptions: ['regTime'], logs: ['date'], cardHistory: ['date'] };
const SCHEMA_DATEONLY = {
  orders: ['execDate'], cards: ['execDate', 'recDate'], tasks: ['createdAt', 'execDate', 'recDate'],
  customers: ['joinDate', 'birthday', 'subStart', 'subEnd'], employees: ['hireDate', 'birthday'],
  workers: ['hireDate', 'birthday'], branchManagers: ['hireDate', 'birthday'], branches: ['established', 'updated'],
  groups: ['established', 'updated'], groupMembers: ['joinDate'],
  offers: ['start', 'end'], wallets: ['depositDate', 'withdrawalDate']
};
const SCHEMA_MONEY = {
  orders: ['overtimeCost', 'basePrice', 'discount', 'tax', 'finalPrice'], cards: ['total'],
  customers: ['totalPayments', 'credit', 'debit'], wallets: ['balance'], redemptions: ['amount'],
  workers: ['totalRevenue'], branches: ['totalRevenue'], groups: ['totalRevenue']
};
const SCHEMA_SEARCH = {
  orders: ['requestId', 'firstName', 'lastName', 'contact', 'service'], cards: ['cardId', 'requestId', 'customerName', 'contact'],
  tasks: ['taskId', 'customerId'], customers: ['customerId', 'firstName', 'lastName', 'contact', 'username'],
  employees: ['empId', 'username', 'firstName', 'lastName'], workers: ['workerId', 'username', 'firstName', 'lastName'],
  branches: ['branchId', 'name', 'city'], groups: ['groupId', 'name'], groupMembers: ['username', 'groupId'],
  offers: ['code'], services: ['id', 'nameFa'], sides: ['id', 'nameFa']
};
const SCHEMA_PRIMARY_DATE = { orders: 'createdAt', cards: 'createdAt', tasks: 'createdAt', customers: 'joinDate', employees: 'hireDate', workers: 'hireDate', branches: 'established', groups: 'established', offers: 'start', logs: 'date' };
const SCHEMA_ROLE_COLS = ['Administrator', 'Admin', 'Manager', 'Branch Manager', 'Employee', 'operator', 'Supervisor', 'worker', 'Customer'];

// ==================== دیکشنری زنده (بدون کش چنددقیقه‌ای) ====================
var _SC_CACHE = null, _SC_MAP = {};
function schemaCache_() {
  if (_SC_CACHE) return _SC_CACHE;
  const out = {};
  getSpreadsheet_().getSheets().forEach(sh => {
    const lc = sh.getLastColumn();
    out[sh.getName()] = lc ? sh.getRange(1, 1, 1, lc).getDisplayValues()[0].map(h => String(h).trim()) : [];
  });
  _SC_CACHE = out;
  return out;
}
/** ابطال کش حافظه‌ای؛ بعد از هر تغییر ساختاری یا نوشتن صدا زده می‌شود */
function schemaInvalidate_() { _SC_CACHE = null; _SC_MAP = {}; }
function schemaSheetName_(entity) {
  const names = SCHEMA_ENTITY_SHEETS[entity] || [];
  const sch = schemaCache_();
  for (let i = 0; i < names.length; i++) {
    if (sch[names[i]]) return names[i];
    const t = names[i].trim();
    const found = Object.keys(sch).find(k => k.trim() === t);
    if (found) return found;
  }
  return null;
}
function schemaHeaders_(entity) {
  const n = schemaSheetName_(entity);
  return n ? schemaCache_()[n] : [];
}
function schemaMap_(entity) {
  if (_SC_MAP[entity]) return _SC_MAP[entity];
  const headers = schemaHeaders_(entity);
  const aliases = SCHEMA_FIELDS[entity] || {};
  const map = {};
  Object.keys(aliases).forEach(logical => {
    const list = aliases[logical];
    for (let i = 0; i < list.length; i++) {
      const wanted = String(list[i]).trim().toLowerCase();
      const idx = headers.findIndex(h => String(h).trim().toLowerCase() === wanted);
      if (idx >= 0) { map[logical] = { header: headers[idx], idx: idx }; break; }
    }
  });
  _SC_MAP[entity] = map;
  return map;
}
function schemaSheetObj_(entity) {
  const n = schemaSheetName_(entity);
  if (!n) throw new Error('شیت مربوط به «' + entity + '» پیدا نشد.');
  return getSpreadsheet_().getSheetByName(n);
}

// ==================== خواندن / نوشتن عمومی ====================
function scRead_(entity) {
  const sh = schemaSheetObj_(entity);
  const lastRow = sh.getLastRow();
  const headers = schemaHeaders_(entity);
  if (lastRow < 2 || !headers.length) return [];
  const map = schemaMap_(entity);
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map((row, i) => {
    const obj = { _rowIndex: i + 2, _raw: {} };
    headers.forEach((h, idx) => { obj._raw[h] = row[idx]; });
    Object.keys(map).forEach(logical => { obj[logical] = row[map[logical].idx]; });
    return obj;
  });
}
function scAppend_(entity, data) {
  const sh = schemaSheetObj_(entity);
  const headers = schemaHeaders_(entity);
  const map = schemaMap_(entity);
  if (entity === 'customers' && (!map.customerId || !map.contact)) {
    throw new Error('ستون‌های «کد اشتراک» و/یا «شماره تماس» در Customers_DB با SchemaCore تطبیق ندارند.');
  }
  const row = headers.map(() => '');
  Object.keys(data || {}).forEach(logical => { if (map[logical]) row[map[logical].idx] = data[logical]; });
  const rowIndex = sh.getLastRow() + 1;
  if ((entity === 'customers' || entity === 'orders') && map.contact) sh.getRange(rowIndex, map.contact.idx + 1).setNumberFormat('@');
  if ((entity === 'customers' || entity === 'orders') && map.customerId) sh.getRange(rowIndex, map.customerId.idx + 1).setNumberFormat('@');
  sh.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  return rowIndex;
}
function scUpdate_(entity, rowIndex, data) {
  const sh = schemaSheetObj_(entity);
  const map = schemaMap_(entity);
  Object.keys(data).forEach(logical => { if (map[logical]) sh.getRange(rowIndex, map[logical].idx + 1).setValue(data[logical]); });
}
function scDelete_(entity, rowIndices) {
  const sh = schemaSheetObj_(entity);
  [...rowIndices].sort((a, b) => b - a).forEach(idx => sh.deleteRow(idx));
}
/** تبدیل مقدار ورودی پیش از ذخیره: فیلد تاریخی شمسی → میلادی */
function scCoerce_(entity, logical, value) {
  if ((SCHEMA_DATEONLY[entity] || []).includes(logical) && typeof value === 'string' && scParseJalali_(value)) return scStoreDate_(value);
  return value;
}
/** آماده‌سازی ردیف برای نمایش: تاریخ‌ها شمسی فارسی */
function scDisplay_(entity, row) {
  const out = { _rowIndex: row._rowIndex };
  Object.keys(row).forEach(k => { if (k !== '_raw') out[k] = row[k]; });
  (SCHEMA_DATETIME[entity] || []).forEach(f => { if (out[f] !== undefined) out[f] = scDispDateTime_(out[f]); });
  (SCHEMA_DATEONLY[entity] || []).forEach(f => { if (out[f] !== undefined) out[f] = scDispDate_(out[f]); });
  return out;
}

// ==================== تاریخ و نمایش فارسی ====================
function scFa_(s) { return String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function scMoney_(n) { return scFa_(new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0))) + ' ریال'; }
function scJ2G_(jy, jm, jd) {
  jy += 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let gd = days + 1;
  const leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const months = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  while (gm <= 12 && gd > months[gm]) { gd -= months[gm]; gm++; }
  return [gy, gm, gd];
}
function scParseJalali_(s) {
  const m = String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
/** شمسی → رشته میلادی برای ذخیره */
function scStoreDate_(jalaliStr) {
  const p = scParseJalali_(jalaliStr);
  if (!p) return text_(jalaliStr);
  const g = scJ2G_(p[0], p[1], p[2]);
  return g[0] + '-' + String(g[1]).padStart(2, '0') + '-' + String(g[2]).padStart(2, '0');
}
/** شمسی + ساعت → Date میلادی برای ذخیره */
function scStoreDateTime_(jalaliStr, timeStr) {
  const p = scParseJalali_(jalaliStr);
  if (!p) return null;
  const g = scJ2G_(p[0], p[1], p[2]);
  const t = String(timeStr || '00:00').match(/^(\d{1,2}):(\d{2})/);
  return new Date(g[0], g[1] - 1, g[2], t ? Number(t[1]) : 0, t ? Number(t[2]) : 0);
}
/** هر مقدار (Date / میلادی / شمسی قدیمی) → نمایش شمسی فارسی */
function scDispDate_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) { const j = gregorianToJalali_(v.getFullYear(), v.getMonth() + 1, v.getDate()); return scFa_(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0')); }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    if (y >= 1400 && y <= 1500) return scFa_(y + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0'));
    const j = gregorianToJalali_(y, Number(m[2]), Number(m[3]));
    return scFa_(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0'));
  }
  const d = new Date(s);
  if (!isNaN(d)) { const j = gregorianToJalali_(d.getFullYear(), d.getMonth() + 1, d.getDate()); return scFa_(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0')); }
  return scFa_(s);
}
function scDispDateTime_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) {
    const j = gregorianToJalali_(v.getFullYear(), v.getMonth() + 1, v.getDate());
    return scFa_(j[0] + '/' + String(j[1]).padStart(2, '0') + '/' + String(j[2]).padStart(2, '0') + ' ساعت ' + String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0'));
  }
  return scDispDate_(v);
}
function scDispTime_(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return scFa_(String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0'));
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? scFa_(String(m[1]).padStart(2, '0') + ':' + m[2]) : scFa_(v);
}

// ==================== ماتریس نقش (زنده از User_Roles) ====================
function scRoleMatrix_() {
  const c = CacheService.getScriptCache();
  const hit = c.get('ZV_ROLES_V6');
  if (hit) return JSON.parse(hit);
  const rows = scRead_('userRoles');
  const matrix = {}, meta = {};
  rows.forEach(r => {
    const op = text_(r.operation);
    if (op) {
      SCHEMA_ROLE_COLS.forEach(rc => {
        const cell = String(r._raw[rc] || '');
        let lvl = false;
        if (/ALL/i.test(cell)) lvl = 'ALL'; else if (/Owner/i.test(cell)) lvl = 'Owner';
        (matrix[rc] = matrix[rc] || {})[op] = lvl;
      });
    }
    const roleEn = text_(r.roleEn);
    if (roleEn) meta[roleEn] = { fa: text_(r.roleFa), panelEn: text_(r.panelEn), panelFa: text_(r.panelFa) };
  });
  const payload = { matrix: matrix, meta: meta };
  try { c.put('ZV_ROLES_V6', JSON.stringify(payload), 300); } catch (e) {}
  return payload;
}
function scAccess_(session, operation, action) {
  const key = ['Logs', 'Reports', 'Settings'].includes(operation) ? operation : operation + ' (' + action + ')';
  const m = scRoleMatrix_().matrix[session.role] || {};
  return m[key] || false;
}

// ==================== فیلتر Owner (پویا) ====================
function scOwnerScope_(entity, rows, session) {
  const role = session.role;
  if (['Administrator', 'Admin', 'Manager'].includes(role)) return rows;
  const u = session.username || session.email; const id = session.empId; const br = session.branch;
  const cardsAll = () => scRead_('cards');
  if (role === 'Branch Manager' || role === 'Employee') {
    if (['branches', 'cards', 'employees', 'workers', 'groups'].includes(entity)) return rows.filter(r => text_(r.branchId) === br);
    if (entity === 'orders') {
      const reqs = {}; cardsAll().filter(cd => text_(cd.branchId) === br).forEach(cd => { reqs[text_(cd.requestId)] = 1; });
      return rows.filter(r => reqs[text_(r.requestId)] || text_(r.verifier) === u || text_(r.operator) === u);
    }
    if (entity === 'tasks') {
      const ls = {}; cardsAll().filter(cd => text_(cd.branchId) === br).forEach(cd => { ls[text_(cd.listId)] = 1; });
      return rows.filter(r => ls[text_(r.taskId)]);
    }
    if (entity === 'customers') {
      const cids = {}; cardsAll().filter(cd => text_(cd.branchId) === br).forEach(cd => { cids[text_(cd.customerId)] = 1; });
      return rows.filter(r => cids[text_(r.customerId)]);
    }
    return rows;
  }
  if (role === 'Supervisor') {
    const myG = {}; scRead_('groups').filter(g => text_(g.supervisorName) === session.name || text_(g.workerId) === id).forEach(g => { myG[text_(g.groupId)] = 1; });
    if (entity === 'groups') return rows.filter(r => myG[text_(r.groupId)]);
    if (entity === 'workers') return rows.filter(r => myG[text_(r.groupId)]);
    if (entity === 'groupMembers') {
      const names = {}; scRead_('workers').filter(w => myG[text_(w.groupId)]).forEach(w => { names[text_(w.username)] = 1; });
      return rows.filter(r => names[text_(r.username)]);
    }
    if (entity === 'cards') { const ws = {}; scRead_('workers').filter(w => myG[text_(w.groupId)]).forEach(w => { ws[text_(w.workerId)] = 1; }); return rows.filter(r => ws[text_(r.workerId)]); }
    if (entity === 'tasks') { const ls = {}; cardsAll().filter(cd => { const w = scRead_('workers').find(x => text_(x.workerId) === text_(cd.workerId)); return w && myG[text_(w.groupId)]; }).forEach(cd => { ls[text_(cd.listId)] = 1; }); return rows.filter(r => ls[text_(r.taskId)]); }
    return rows;
  }
  if (role === 'worker') {
    if (entity === 'cards') return rows.filter(r => text_(r.workerId) === id);
    if (entity === 'tasks') { const ls = {}; cardsAll().filter(cd => text_(cd.workerId) === id).forEach(cd => { ls[text_(cd.listId)] = 1; }); return rows.filter(r => ls[text_(r.taskId)]); }
    return rows;
  }
  if (role === 'operator') {
    if (entity === 'orders') return rows.filter(r => text_(r.verifier) === u || text_(r.operator) === u);
    if (entity === 'cards') return rows.filter(r => text_(r.verifier) === u);
    return rows;
  }
  if (role === 'Customer') return rows.filter(r => text_(r.customerId) === id);
  return rows;
}

// ==================== لاگ ممیزی ====================
function scLog_(session, action, details, result) {
  try {
    scAppend_('logs', { empId: (session && session.empId) || '', name: (session && session.name) || '', action: action, details: details || '', result: result || 'success', date: new Date() });
  } catch (e) {}
}

// ==================== تست و تشخیص ====================
function schemaTest() {
  schemaInvalidate_();
  const report = [];
  Object.keys(SCHEMA_ENTITY_SHEETS).forEach(entity => {
    const sheet = schemaSheetName_(entity);
    if (!sheet) { report.push({ entity: entity, sheet: 'MISSING', resolved: 0, missing: Object.keys(SCHEMA_FIELDS[entity] || {}) }); return; }
    const map = schemaMap_(entity);
    const all = Object.keys(SCHEMA_FIELDS[entity] || {});
    const missing = all.filter(k => !map[k]);
    report.push({ entity: entity, sheet: sheet, resolved: all.length - missing.length, missing: missing });
  });
  console.log(JSON.stringify(report, null, 1));
  return report;
}
/** پاک‌سازی کش دیکشنری؛ اجرای دستی در صورت نیاز */
function schemaRefreshCache() {
  schemaInvalidate_();
  return schemaTest();
}
