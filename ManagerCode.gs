/**
 * ═══════════════════════════════════════════════════════════════
 * ManagerCode.gs — ZingoVingo Executive Command Center V2
 * دسترسی: Manager (مدیر کل) و Administrator
 * ═══════════════════════════════════════════════════════════════
 * ماژول‌ها: قراردادها + ظرفیت قرارداد · پروژه‌ها و مایلستون ·
 * دفتر مالی · سود و زیان · جریان نقد · سرمایه‌گذاری · سهام شرکت ·
 * اهداف و شاخص‌ها · یادداشت‌ها · تصمیمات · مشاوره هوشمند · نمودارها
 * وابسته به SchemaCore.gs (scRead_/text_/number_/getSpreadsheet_)
 * ═══════════════════════════════════════════════════════════════
 */

const MGR_VERSION = 'V2';
const MGR_TRASH = '__ZV_MGR_TRASH__';
const MGR_TTL = 30 * 24 * 3600 * 1000;

const MGR_DEF = {
  contracts: {
    sheet:'Contracts', id:'Contract-ID', prefix:'CON',
    headers:['Contract-ID','Code','Title','Type','PartyType','PartyName','PartyId','PartyPhone','PartyEmail',
      'Branch-ID','ServiceScope','StartDate','EndDate','Value','Currency','BillingCycle','Status','AutoRenew',
      'NoticeDays','OwnerName','SignedAt','DocumentUrl','Description','Notes','CreatedAt','UpdatedAt','CreatedBy','UpdatedBy'],
    req:['Title','Type','PartyName','StartDate','EndDate','Value'],
    nums:['Value','NoticeDays'],
    dates:['StartDate','EndDate','SignedAt'],
    enums:{ Type:['خدماتی','پیمانکاری','تأمین نیرو','فروش','اجاره','مشارکت','سایر'],
      PartyType:['کارفرما','پیمانکار','تأمین‌کننده','شریک','سایر'],
      Currency:['ریال','تومان','دلار','یورو'],
      BillingCycle:['یکجا','ماهانه','فصلی','سالانه','بر اساس مصرف'],
      Status:['پیش‌نویس','در مذاکره','فعال','در حال انقضا','منقضی','فسخ شده','تسویه شده'],
      AutoRenew:['بله','خیر'] },
    search:['Contract-ID','Code','Title','PartyName','Branch-ID','ServiceScope']
  },
  capacity: {
    sheet:'ContractCapacity', id:'Capacity-ID', prefix:'CAP',
    headers:['Capacity-ID','Contract-ID','Title','Service-ID','ServiceName','Unit','TotalQty','UsedQty','ReservedQty',
      'UnitPrice','PeriodType','PeriodKey','Branch-ID','Group-ID','StartDate','EndDate','Status','Notes','CreatedAt','UpdatedAt'],
    req:['Contract-ID','Title','Unit','TotalQty','UnitPrice'],
    nums:['TotalQty','UsedQty','ReservedQty','UnitPrice'],
    dates:['StartDate','EndDate'],
    enums:{ PeriodType:['کل قرارداد','ماهانه','فصلی','سالانه'], Status:['فعال','تکمیل شده','معلق','لغو شده'] },
    search:['Capacity-ID','Contract-ID','Title','ServiceName','Branch-ID']
  },
  usage: {
    sheet:'ContractUsage', id:'Usage-ID', prefix:'USE',
    headers:['Usage-ID','Capacity-ID','Contract-ID','Qty','RefType','RefId','Branch-ID','Date','Note','CreatedBy','CreatedAt'],
    req:['Capacity-ID','Qty'], nums:['Qty'], dates:['Date'],
    enums:{ RefType:['سفارش','کارت عملیاتی','دستی','فاکتور','سایر'] },
    search:['Usage-ID','Capacity-ID','Contract-ID','RefId']
  },
  projects: {
    sheet:'Projects', id:'Project-ID', prefix:'PRJ',
    headers:['Project-ID','Code','Name','Type','Branch-ID','Contract-ID','ManagerName','TeamIds','StartDate','DueDate',
      'Budget','Spent','Progress','Priority','Status','Health','Description','Notes','CreatedAt','UpdatedAt','CreatedBy','UpdatedBy'],
    req:['Name','StartDate','DueDate','Budget'],
    nums:['Budget','Spent','Progress'],
    dates:['StartDate','DueDate'],
    enums:{ Type:['توسعه','زیرساخت','بازاریابی','عملیاتی','تحقیق','سایر'],
      Priority:['عادی','مهم','فوری','بحرانی'],
      Status:['ایده','برنامه‌ریزی','در حال اجرا','متوقف','تکمیل شده','لغو شده'],
      Health:['سبز','زرد','قرمز'] },
    search:['Project-ID','Code','Name','ManagerName','Branch-ID']
  },
  ptasks: {
    sheet:'ProjectTasks', id:'Task-ID', prefix:'PTS',
    headers:['Task-ID','Project-ID','Title','Assignee','StartDate','DueDate','Weight','Progress','Status','DependsOn','Notes','CreatedAt','UpdatedAt'],
    req:['Project-ID','Title','DueDate'], nums:['Weight','Progress'], dates:['StartDate','DueDate'],
    enums:{ Status:['در انتظار','در حال انجام','تکمیل شده','مسدود','لغو شده'] },
    search:['Task-ID','Project-ID','Title','Assignee']
  },
  finance: {
    sheet:'FinanceEntries', id:'Entry-ID', prefix:'FIN',
    headers:['Entry-ID','Date','Type','Category','SubCategory','Branch-ID','Project-ID','Contract-ID','Amount',
      'CostType','Payee','Method','RefId','Status','DueDate','Note','CreatedBy','CreatedAt','UpdatedAt'],
    req:['Date','Type','Category','Amount'], nums:['Amount'], dates:['Date','DueDate'],
    enums:{ Type:['درآمد','هزینه'], CostType:['ثابت','متغیر','سرمایه‌ای'],
      Method:['نقد','کارت','حواله','چک','تهاتر','سایر'],
      Status:['پرداخت شده','در انتظار','معوق','لغو شده'] },
    search:['Entry-ID','Category','SubCategory','Payee','RefId','Branch-ID']
  },
  investments: {
    sheet:'Investments', id:'Investment-ID', prefix:'INV',
    headers:['Investment-ID','Title','Kind','Symbol','Issuer','Units','BuyPrice','BuyDate','CurrentPrice','PriceUpdatedAt',
      'TargetPrice','StopLoss','OwnershipPct','TotalShares','Branch-ID','Risk','Status','Note','CreatedBy','CreatedAt','UpdatedAt'],
    req:['Title','Kind','Units','BuyPrice'], nums:['Units','BuyPrice','CurrentPrice','TargetPrice','StopLoss','OwnershipPct','TotalShares'],
    dates:['BuyDate','PriceUpdatedAt'],
    enums:{ Kind:['سهام شرکت','سهام سایر شرکت‌ها','صندوق','ملک','طلا','ارز','کسب‌وکار','اوراق','سایر'],
      Risk:['کم','متوسط','زیاد'], Status:['فعال','واگذار شده','تسویه شده'] },
    search:['Investment-ID','Title','Symbol','Issuer','Kind']
  },
  holders: {
    sheet:'EquityHolders', id:'Holder-ID', prefix:'SHR',
    headers:['Holder-ID','Name','Type','NationalId','Phone','Shares','SharePct','PaidCapital','JoinDate','Status','Note','CreatedAt','UpdatedAt'],
    req:['Name','Shares'], nums:['Shares','SharePct','PaidCapital'], dates:['JoinDate'],
    enums:{ Type:['حقیقی','حقوقی'], Status:['فعال','واگذار کرده','معلق'] },
    search:['Holder-ID','Name','NationalId','Phone']
  },
  notes: {
    sheet:'Notes', id:'Note-ID', prefix:'NTE',
    headers:['Note-ID','Title','Body','Category','Color','Pinned','Tags','RelatedType','RelatedId','ReminderAt','Done','OwnerUsername','CreatedAt','UpdatedAt'],
    req:['Title'], nums:[], dates:['ReminderAt'],
    enums:{ Category:['عمومی','ایده','پیگیری','ریسک','جلسه','تصمیم'],
      Color:['زرد','آبی','سبز','قرمز','بنفش','خاکستری'], Pinned:['بله','خیر'], Done:['بله','خیر'],
      RelatedType:['—','قرارداد','پروژه','سرمایه‌گذاری','شعبه','سفارش'] },
    search:['Note-ID','Title','Body','Tags','Category']
  },
  decisions: {
    sheet:'Decisions', id:'Decision-ID', prefix:'DEC',
    headers:['Decision-ID','Title','Context','Options','Choice','Rationale','Impact','Risk','Owner','DueDate','Status','ReviewAt','RelatedType','RelatedId','CreatedBy','CreatedAt','UpdatedAt'],
    req:['Title','Context','Choice'], nums:[], dates:['DueDate','ReviewAt'],
    enums:{ Status:['پیشنهادی','در بررسی','تصویب شده','در حال اجرا','اجرا شده','رد شده'],
      Risk:['کم','متوسط','زیاد'], RelatedType:['—','قرارداد','پروژه','سرمایه‌گذاری','شعبه','مالی'] },
    search:['Decision-ID','Title','Context','Choice','Owner']
  },
  targets: {
    sheet:'KpiTargets', id:'Target-ID', prefix:'TGT',
    headers:['Target-ID','Metric','Scope','ScopeId','Period','TargetValue','Note','CreatedAt','UpdatedAt'],
    req:['Metric','Scope','Period','TargetValue'], nums:['TargetValue'], dates:[],
    enums:{ Metric:['درآمد','سود خالص','تعداد سفارش','نرخ تکمیل','حاشیه سود','مشتری جدید','ارزش قرارداد','کاهش هزینه'],
      Scope:['کل سامانه','شعبه','پروژه'], Period:['ماهانه','فصلی','سالانه'] },
    search:['Target-ID','Metric','Scope','ScopeId','Period']
  }
};

/* ═════════ ابزارها ═════════ */
function mgrTxt_(v){ try{ return text_(v); }catch(e){ return v==null?'':String(v).trim(); } }
function mgrNum_(v){ try{ return number_(v); }catch(e){ const n=Number(String(v==null?'':v).replace(/[^\d.\-]/g,'')); return isFinite(n)?n:0; } }
function mgrIso_(v){ if(!v)return ''; if(v instanceof Date) return isNaN(v.getTime())?'':v.toISOString(); const d=new Date(v); return isNaN(d.getTime())?String(v):d.toISOString(); }
function mgrLock_(){ const l=LockService.getScriptLock(); l.waitLock(20000); return l; }
function mgrRead_(e){ try{ return scRead_(e); }catch(err){ return []; } }
function mgrLog_(s,a,d,r){ try{ if(typeof scLog_==='function') scLog_(s,a,d,r||'success'); }catch(e){} }
function mgrCache_(){ try{ schemaInvalidate_(); }catch(e){} }
function mgrKey_(v){
  if(!v) return '';
  if(v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, Session.getScriptTimeZone()||'Asia/Tehran','yyyy-MM-dd');
  const s=String(v).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim();
  const m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m){
    const y=+m[1],mo=+m[2],d=+m[3];
    if(y>=1300&&y<=1500&&typeof scJ2G_==='function'){ const g=scJ2G_(y,mo,d); return g[0]+'-'+String(g[1]).padStart(2,'0')+'-'+String(g[2]).padStart(2,'0'); }
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  }
  const dt=new Date(s);
  return isNaN(dt.getTime())?'':Utilities.formatDate(dt, Session.getScriptTimeZone()||'Asia/Tehran','yyyy-MM-dd');
}
function mgrToday_(){ return mgrKey_(new Date()); }
function mgrDays_(a,b){ const x=new Date(mgrKey_(a)),y=new Date(mgrKey_(b)); if(isNaN(x)||isNaN(y))return 0; return Math.round((y-x)/864e5); }
function mgrName_(r){ return r?([mgrTxt_(r.firstName),mgrTxt_(r.lastName)].filter(Boolean).join(' ')||mgrTxt_(r.name)||mgrTxt_(r.username)):''; }

/* ═════════ شیت (هدر‌محور) ═════════ */
function mgrHead_(sh){ const n=sh.getLastColumn(); return n<1?[]:sh.getRange(1,1,1,n).getDisplayValues()[0].map(x=>String(x).trim()); }
function mgrSheet_(name,headers){
  const ss=getSpreadsheet_();
  let sh=ss.getSheetByName(name);
  if(!sh){
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0B1736').setFontColor('#FFFFFF');
    return sh;
  }
  const cur=mgrHead_(sh);
  if(!cur.some(x=>x!=='')){
    sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#0B1736').setFontColor('#FFFFFF');
    return sh;
  }
  const miss=headers.filter(h=>cur.indexOf(h)<0);
  if(miss.length){
    sh.getRange(1,cur.length+1,1,miss.length).setValues([miss]);
    sh.getRange(1,cur.length+1,1,miss.length).setFontWeight('bold').setBackground('#13234D').setFontColor('#FFFFFF');
  }
  return sh;
}
function mgrRows_(name,headers){
  const sh=mgrSheet_(name,headers);
  if(sh.getLastRow()<2) return [];
  const head=mgrHead_(sh);
  return sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues()
    .map((r,i)=>{ const o={_row:i+2}; head.forEach((h,j)=>{ if(h)o[h]=r[j]; }); return o; });
}
function mgrAppend_(name,headers,obj){
  const sh=mgrSheet_(name,headers), head=mgrHead_(sh), n=sh.getLastRow()+1;
  sh.getRange(n,1).setNumberFormat('@');
  sh.appendRow(head.map(h=>obj.hasOwnProperty(h)?obj[h]:''));
  return sh.getLastRow();
}
function mgrPatch_(name,headers,row,obj){
  const sh=mgrSheet_(name,headers), head=mgrHead_(sh);
  Object.keys(obj).forEach(k=>{ const c=head.indexOf(k); if(c>=0) sh.getRange(row,c+1).setValue(obj[k]); });
}
function mgrDef_(e){ const d=MGR_DEF[e]; if(!d) throw new Error('موجودیت «'+e+'» شناخته نشده است.'); return d; }
function mgrEntityRows_(e){
  const d=mgrDef_(e);
  return mgrRows_(d.sheet,d.headers).map(r=>{
    const o={rowIndex:r._row,id:mgrTxt_(r[d.id])};
    d.headers.forEach(h=>{
      let v=r[h];
      if(d.nums.indexOf(h)>=0) v=mgrNum_(v);
      else if(d.dates.indexOf(h)>=0) v=mgrKey_(v);
      else v=(v instanceof Date)?mgrIso_(v):mgrTxt_(v);
      o[h]=v;
    });
    return o;
  });
}
function mgrNextId_(e){
  const d=mgrDef_(e);
  const rows=mgrRows_(d.sheet,d.headers);
  const re=new RegExp('^'+d.prefix+'-(\\d+)$','i');
  let mx=0;
  rows.forEach(r=>{ const m=mgrTxt_(r[d.id]).match(re); if(m) mx=Math.max(mx,+m[1]); });
  return d.prefix+'-'+String(mx+1).padStart(6,'0');
}
function mgrEnsureSheets(token){
  if(token) checkManagerAuth(token);
  Object.keys(MGR_DEF).forEach(e=>{ const d=MGR_DEF[e]; mgrSheet_(d.sheet,d.headers); });
  return {success:true,sheets:Object.keys(MGR_DEF).map(e=>MGR_DEF[e].sheet)};
}

/* ═════════ نشست ═════════ */
function managerLogin(username,password){
  const u=String(username||'').trim().toLowerCase(), p=String(password||'');
  if(!u||!p) throw new Error('نام کاربری و رمز عبور را وارد کنید.');
  const found=mgrRead_('employees').find(r=>
    (mgrTxt_(r.username).toLowerCase()===u||mgrTxt_(r.email).toLowerCase()===u) &&
    mgrTxt_(r.password)===p && /^(فعال|active)$/i.test(mgrTxt_(r.status)) &&
    /^(Manager|Administrator|مدیر کل)$/i.test(mgrTxt_(r.operations)));
  if(!found) throw new Error('نام کاربری یا رمز اشتباه است، حساب غیرفعال است، یا نقش مدیر کل ندارید.');
  const token=Utilities.getUuid();
  const role=/^Administrator$/i.test(mgrTxt_(found.operations))?'Administrator':'Manager';
  const s={ token, role, panel:'manager', userType:'manager',
    username:mgrTxt_(found.username), employeeId:mgrTxt_(found.empId), empId:mgrTxt_(found.empId),
    name:mgrName_(found)||mgrTxt_(found.username), branch:mgrTxt_(found.branchId),
    email:mgrTxt_(found.email), phone:mgrTxt_(found.contact), avatar:mgrTxt_(found.photo),
    position:mgrTxt_(found.jobTitle), specialty:mgrTxt_(found.specialization),
    createdAt:new Date().toISOString(), exp:Date.now()+MGR_TTL };
  PropertiesService.getScriptProperties().setProperty('session_'+token,JSON.stringify(s));
  mgrLog_(s,'ورود به مرکز فرمان مدیر کل','نقش: '+role);
  return {success:true,token,role,user:mgrUser_(s)};
}
function managerLogout(token){ try{ if(token) PropertiesService.getScriptProperties().deleteProperty('session_'+token); }catch(e){} return {success:true}; }
function checkManagerAuth(token){
  if(!token){ const e=new Error('لطفاً ابتدا وارد شوید.'); e.code='NO_SESSION'; throw e; }
  const props=PropertiesService.getScriptProperties();
  const raw=props.getProperty('session_'+token);
  if(!raw){ const e=new Error('نشست منقضی شده است؛ دوباره وارد شوید.'); e.code='NO_SESSION'; throw e; }
  let s; try{ s=JSON.parse(raw); }catch(err){ props.deleteProperty('session_'+token); throw new Error('نشست نامعتبر است.'); }
  if(['Manager','Administrator'].indexOf(s.role)<0){ const e=new Error('فقط مدیر کل دسترسی دارد.'); e.code='FORBIDDEN'; throw e; }
  s.token=token; s.exp=Date.now()+MGR_TTL;
  try{ props.setProperty('session_'+token,JSON.stringify(s)); }catch(err){}
  return s;
}
function mgrUser_(s){
  return { name:s.name, role:s.role, roleFa:s.role==='Administrator'?'ادمین ارشد':'مدیر کل',
    username:s.username, employeeId:s.employeeId||s.empId, branch:s.branch||'', email:s.email||'',
    phone:s.phone||'', avatar:s.avatar||'', position:s.position||'', specialty:s.specialty||'',
    permissions:{scope:'ALL',canEdit:true,canDelete:true,canFinance:true,canEquity:true,canSettings:true} };
}
function mgrCCSession(token){ return {success:true,user:mgrUser_(checkManagerAuth(token))}; }

/* ═════════ تنظیمات شرکت ═════════ */
function mgrSettings_(){
  const o={};
  mgrRead_('settings').forEach(r=>{ o[mgrTxt_(r.key)]=mgrTxt_(r.value); });
  return o;
}
function mgrSaveSettings(obj,token){
  const s=checkManagerAuth(token), lock=mgrLock_();
  try{
    const rows=mgrRead_('settings');
    Object.keys(obj||{}).forEach(k=>{
      const hit=rows.find(r=>mgrTxt_(r.key).toLowerCase()===String(k).toLowerCase());
      if(hit) scUpdate_('settings',hit._rowIndex,{value:String(obj[k])});
      else scAppend_('settings',{key:k,value:String(obj[k]),usage:'پیکربندی مرکز فرمان مدیر کل'});
    });
    mgrLog_(s,'تغییر تنظیمات شرکت',Object.keys(obj||{}).join(', '));
    mgrCache_();
    return {success:true};
  } finally { lock.releaseLock(); }
}
function mgrCompany_(){
  const s=mgrSettings_();
  return {
    name:s.COMPANY_NAME||'ZingoVingo',
    regNo:s.COMPANY_REG_NO||'',
    totalShares:mgrNum_(s.COMPANY_TOTAL_SHARES)||10000,
    parValue:mgrNum_(s.COMPANY_PAR_VALUE)||1000,
    fiscalStart:s.FISCAL_YEAR_START||'01-01',
    targetMargin:mgrNum_(s.TARGET_MARGIN)||25,
    currency:s.CURRENCY_LABEL||'ریال',
    logoUrl:s.LOGO_URL||'', faviconUrl:s.FAVICON_URL||'',
    brand:s.BRAND_NAME||'ZingoVingo'
  };
}

/* ═════════ محاسبات مالی ═════════ */
function mgrFinance_(filters){
  const f=filters||{};
  let rows=mgrEntityRows_('finance');
  if(f.from) rows=rows.filter(r=>r.Date>=mgrKey_(f.from));
  if(f.to) rows=rows.filter(r=>r.Date<=mgrKey_(f.to));
  if(f.type) rows=rows.filter(r=>r.Type===f.type);
  if(f.branchId) rows=rows.filter(r=>r['Branch-ID']===f.branchId);
  if(f.projectId) rows=rows.filter(r=>r['Project-ID']===f.projectId);
  if(f.status) rows=rows.filter(r=>r.Status===f.status);
  const paid=rows.filter(r=>r.Status==='پرداخت شده');
  const rev=paid.filter(r=>r.Type==='درآمد').reduce((a,r)=>a+r.Amount,0);
  const cost=paid.filter(r=>r.Type==='هزینه').reduce((a,r)=>a+r.Amount,0);
  const fixed=paid.filter(r=>r.Type==='هزینه'&&r.CostType==='ثابت').reduce((a,r)=>a+r.Amount,0);
  const variable=paid.filter(r=>r.Type==='هزینه'&&r.CostType==='متغیر').reduce((a,r)=>a+r.Amount,0);
  const capex=paid.filter(r=>r.Type==='هزینه'&&r.CostType==='سرمایه‌ای').reduce((a,r)=>a+r.Amount,0);
  const receivable=rows.filter(r=>r.Type==='درآمد'&&r.Status!=='پرداخت شده'&&r.Status!=='لغو شده').reduce((a,r)=>a+r.Amount,0);
  const payable=rows.filter(r=>r.Type==='هزینه'&&r.Status!=='پرداخت شده'&&r.Status!=='لغو شده').reduce((a,r)=>a+r.Amount,0);
  const overdue=rows.filter(r=>r.Status==='معوق'||(r.DueDate&&r.DueDate<mgrToday_()&&r.Status==='در انتظار'));
  const byCat={},byBranch={},byMonth={};
  paid.forEach(r=>{
    const k=r.Type+' / '+(r.Category||'—');
    byCat[k]=(byCat[k]||0)+r.Amount;
    const b=r['Branch-ID']||'ستاد';
    byBranch[b]=byBranch[b]||{rev:0,cost:0};
    if(r.Type==='درآمد') byBranch[b].rev+=r.Amount; else byBranch[b].cost+=r.Amount;
    const m=(r.Date||'').slice(0,7);
    byMonth[m]=byMonth[m]||{rev:0,cost:0};
    if(r.Type==='درآمد') byMonth[m].rev+=r.Amount; else byMonth[m].cost+=r.Amount;
  });
  const opCost=fixed+variable;
  const gross=rev-variable;
  const operating=gross-fixed;
  return { rows, total:rows.length, revenue:rev, cost:cost, fixed, variable, capex,
    grossProfit:gross, operatingProfit:operating, netProfit:rev-opCost,
    margin: rev?Math.round((rev-opCost)/rev*1000)/10:0,
    grossMargin: rev?Math.round(gross/rev*1000)/10:0,
    receivable, payable, overdueCount:overdue.length,
    overdueAmount:overdue.reduce((a,r)=>a+r.Amount,0),
    byCat, byBranch, byMonth,
    breakEven: (rev&&gross>0)?Math.round(fixed/(gross/rev)):0 };
}
function mgrCashflow_(days){
  const horizon=mgrDays_(mgrToday_(), new Date(Date.now()+(days||30)*864e5));
  const end=mgrKey_(new Date(Date.now()+(days||30)*864e5));
  const rows=mgrEntityRows_('finance').filter(r=>r.Status!=='پرداخت شده'&&r.Status!=='لغو شده'&&r.DueDate&&r.DueDate<=end);
  const inflow=rows.filter(r=>r.Type==='درآمد').reduce((a,r)=>a+r.Amount,0);
  const outflow=rows.filter(r=>r.Type==='هزینه').reduce((a,r)=>a+r.Amount,0);
  return { days:days||30, horizon, inflow, outflow, net:inflow-outflow, items:rows.length };
}
function mgrInvestStats_(){
  const rows=mgrEntityRows_('investments');
  const active=rows.filter(r=>r.Status==='فعال');
  let cost=0,value=0;
  const byKind={},items=active.map(r=>{
    const c=r.Units*r.BuyPrice, v=r.Units*(r.CurrentPrice||r.BuyPrice);
    cost+=c; value+=v;
    byKind[r.Kind]=(byKind[r.Kind]||0)+v;
    return Object.assign({},r,{cost:c,value:v,pl:v-c,plPct:c?Math.round((v-c)/c*1000)/10:0});
  });
  items.sort((a,b)=>b.value-a.value);
  const top=items[0];
  return { items, count:active.length, cost, value, pl:value-cost,
    plPct:cost?Math.round((value-cost)/cost*1000)/10:0, byKind,
    concentration: value&&top?Math.round(top.value/value*1000)/10:0, topTitle:top?top.Title:'' };
}
function mgrEquity_(){
  const c=mgrCompany_();
  const rows=mgrEntityRows_('holders').filter(r=>r.Status!=='واگذار کرده');
  const shares=rows.reduce((a,r)=>a+r.Shares,0);
  const paid=rows.reduce((a,r)=>a+r.PaidCapital,0);
  const list=rows.map(r=>Object.assign({},r,{
    calcPct: shares?Math.round(r.Shares/shares*10000)/100:0,
    bookValue: shares?Math.round(paid*r.Shares/shares):0
  })).sort((a,b)=>b.Shares-a.Shares);
  return { company:c, holders:list, totalShares:shares||c.totalShares, declaredShares:c.totalShares,
    paidCapital:paid, mismatch: c.totalShares>0 && shares>0 && Math.abs(shares-c.totalShares)>0.5,
    topHolder:list[0]?list[0].Name:'', topPct:list[0]?list[0].calcPct:0 };
}
function mgrContractStats_(){
  const cs=mgrEntityRows_('contracts'), caps=mgrEntityRows_('capacity'), us=mgrEntityRows_('usage');
  const today=mgrToday_();
  const usedMap={};
  us.forEach(u=>{ usedMap[u['Capacity-ID']]=(usedMap[u['Capacity-ID']]||0)+u.Qty; });
  const capList=caps.map(c=>{
    const used=usedMap[c['Capacity-ID']]||c.UsedQty||0;
    const remain=Math.max(0,c.TotalQty-used-c.ReservedQty);
    const pct=c.TotalQty?Math.round(used/c.TotalQty*1000)/10:0;
    return Object.assign({},c,{used,remain,utilPct:pct,revenue:used*c.UnitPrice,potential:c.TotalQty*c.UnitPrice});
  });
  const byContract={};
  capList.forEach(c=>{
    const k=c['Contract-ID'];
    byContract[k]=byContract[k]||{caps:0,total:0,used:0,revenue:0,potential:0};
    byContract[k].caps++; byContract[k].total+=c.TotalQty; byContract[k].used+=c.used;
    byContract[k].revenue+=c.revenue; byContract[k].potential+=c.potential;
  });
  const list=cs.map(c=>{
    const agg=byContract[c['Contract-ID']]||{caps:0,total:0,used:0,revenue:0,potential:0};
    const left=c.EndDate?mgrDays_(today,c.EndDate):9999;
    return Object.assign({},c,{daysLeft:left,capCount:agg.caps,capTotal:agg.total,capUsed:agg.used,
      capRevenue:agg.revenue,capPotential:agg.potential,
      utilPct:agg.total?Math.round(agg.used/agg.total*1000)/10:0,
      expiring: c.Status==='فعال'&&left>=0&&left<=Math.max(15,c.NoticeDays||30)});
  });
  const active=list.filter(c=>c.Status==='فعال');
  return { list, caps:capList, usage:us,
    activeCount:active.length, totalValue:active.reduce((a,c)=>a+c.Value,0),
    expiring:list.filter(c=>c.expiring),
    expired:list.filter(c=>c.Status==='فعال'&&c.EndDate&&c.EndDate<today),
    capRevenue:capList.reduce((a,c)=>a+c.revenue,0),
    capPotential:capList.reduce((a,c)=>a+c.potential,0),
    lowUtil:capList.filter(c=>c.Status==='فعال'&&c.utilPct<25),
    highUtil:capList.filter(c=>c.Status==='فعال'&&c.utilPct>=85) };
}
function mgrProjectStats_(){
  const ps=mgrEntityRows_('projects'), ts=mgrEntityRows_('ptasks');
  const today=mgrToday_(), byProj={};
  ts.forEach(t=>{ (byProj[t['Project-ID']]=byProj[t['Project-ID']]||[]).push(t); });
  const list=ps.map(p=>{
    const tasks=byProj[p['Project-ID']]||[];
    let w=0,acc=0;
    tasks.forEach(t=>{ const wt=t.Weight||1; w+=wt; acc+=wt*(t.Status==='تکمیل شده'?100:(t.Progress||0)); });
    const calc=tasks.length?Math.round(acc/w):p.Progress;
    const left=p.DueDate?mgrDays_(today,p.DueDate):9999;
    const burn=p.Budget?Math.round(p.Spent/p.Budget*1000)/10:0;
    const late=left<0&&calc<100;
    const risk=(burn>90&&calc<70)||late||(left<=7&&calc<80);
    return Object.assign({},p,{tasks:tasks.length,doneTasks:tasks.filter(t=>t.Status==='تکمیل شده').length,
      calcProgress:calc,daysLeft:left,burnPct:burn,late:late,health: risk?'قرمز':(left<=14&&calc<90?'زرد':'سبز')});
  });
  return { list, tasks:ts, active:list.filter(p=>['برنامه‌ریزی','در حال اجرا'].indexOf(p.Status)>=0).length,
    budget:list.reduce((a,p)=>a+p.Budget,0), spent:list.reduce((a,p)=>a+p.Spent,0),
    late:list.filter(p=>p.late), risky:list.filter(p=>p.health==='قرمز') };
}

/* ═════════ بارگذاری یکجا ═════════ */
function mgrCCBootstrap(token){
  const s=checkManagerAuth(token);
  mgrCache_();
  Object.keys(MGR_DEF).forEach(e=>{ const d=MGR_DEF[e]; mgrSheet_(d.sheet,d.headers); });
  const D={};
  Object.keys(MGR_DEF).forEach(e=>{ D[e]=mgrEntityRows_(e); });
  D.orders=mgrRead_('orders').map(r=>({rowIndex:r._rowIndex,requestId:mgrTxt_(r.requestId),createdAt:mgrIso_(r.createdAt),
    customerName:mgrName_(r),phone:mgrTxt_(r.contact),service:mgrTxt_(r.service),branchId:mgrTxt_(r.branchId),
    groupId:mgrTxt_(r.groupId),customerId:mgrTxt_(r.customerId),execDate:mgrKey_(r.execDate),
    finalPrice:mgrNum_(r.finalPrice),status:mgrTxt_(r.status),actionType:mgrTxt_(r.actionType)})).reverse();
  D.cards=mgrRead_('cards').map(r=>({rowIndex:r._rowIndex,cardId:mgrTxt_(r.cardId),requestId:mgrTxt_(r.requestId),
    customerName:mgrTxt_(r.customerName),service:mgrTxt_(r.serviceType),branchId:mgrTxt_(r.branchId),
    workerId:mgrTxt_(r.workerId),status:mgrTxt_(r.status),amount:mgrNum_(r.total),
    execDate:mgrKey_(r.execDate),updatedAt:mgrIso_(r.updatedAt),createdAt:mgrIso_(r.createdAt)})).reverse();
  D.branches=mgrRead_('branches').map(r=>({rowIndex:r._rowIndex,branchId:mgrTxt_(r.branchId),name:mgrTxt_(r.name),
    province:mgrTxt_(r.province),city:mgrTxt_(r.city),managerName:mgrTxt_(r.managerName),status:mgrTxt_(r.status)}));
  D.employees=mgrRead_('employees').map(r=>({rowIndex:r._rowIndex,empId:mgrTxt_(r.empId),name:mgrName_(r),
    username:mgrTxt_(r.username),operations:mgrTxt_(r.operations),branchId:mgrTxt_(r.branchId),
    jobTitle:mgrTxt_(r.jobTitle),contact:mgrTxt_(r.contact),photo:mgrTxt_(r.photo),status:mgrTxt_(r.status)}));
  D.workers=mgrRead_('workers').map(r=>({rowIndex:r._rowIndex,workerId:mgrTxt_(r.workerId),name:mgrName_(r),
    operations:mgrTxt_(r.operations),branchId:mgrTxt_(r.branchId),groupId:mgrTxt_(r.groupId),
    specialization:mgrTxt_(r.specialization),contact:mgrTxt_(r.contact),photo:mgrTxt_(r.photo),status:mgrTxt_(r.status)}));
  D.groups=mgrRead_('groups').map(r=>({rowIndex:r._rowIndex,groupId:mgrTxt_(r.groupId),name:mgrTxt_(r.name),
    branchId:mgrTxt_(r.branchId),supervisorName:mgrTxt_(r.supervisorName),status:mgrTxt_(r.status)}));
  D.customers=mgrRead_('customers').map(r=>({rowIndex:r._rowIndex,customerId:mgrTxt_(r.customerId),name:mgrName_(r),
    phone:mgrTxt_(r.contact),city:mgrTxt_(r.city),level:mgrTxt_(r.level),status:mgrTxt_(r.status),
    totalOrders:mgrNum_(r.totalOrders),totalPayments:mgrNum_(r.totalPayments)}));
  D.services=mgrRead_('services').map(r=>({id:mgrTxt_(r.id),nameFa:mgrTxt_(r.nameFa),nameEn:mgrTxt_(r.nameEn),rate:mgrNum_(r.rate),unit:mgrTxt_(r.unit)}));
  D.applicants=(function(){ try{
    if(typeof jaSheet_!=='function') return [];
    const sh=jaSheet_(), last=sh.getLastRow(); if(last<2) return [];
    const N=(typeof JA_HEADERS!=='undefined'&&JA_HEADERS.length)||31;
    return sh.getRange(2,1,last-1,N).getValues().map((r,i)=>({rowIndex:i+2,caseNumber:mgrTxt_(r[1]),
      branchId:mgrTxt_(r[2]),firstName:mgrTxt_(r[4]),lastName:mgrTxt_(r[5]),phone:mgrTxt_(r[18]),
      specialty:mgrTxt_(r[10]),requestedPosition:mgrTxt_(r[23]),status:mgrTxt_(r[30])})).reverse();
  }catch(e){ return []; }})();
  D.messages=(function(){ try{
    const H=['Thread-ID','Card-ID','Worker-ID','WorkerUsername','Supervisor-ID','SupervisorUsername','Group-ID','Branch-ID',
      'Subject','Status','LastMessageAt','LastMessageBy','CreatedAt','UpdatedAt','Channel','TicketNo','OwnerRole','Owner-ID',
      'OwnerUsername','OwnerName','PeerRole','Peer-ID','PeerUsername','Priority','MessageCount','UnreadOwner','UnreadPeer',
      'ClosedAt','ClosedBy','LastMessagePreview','LegacyRef'];
    return mgrRows_('ConversationThreads',H).map(r=>({threadId:mgrTxt_(r['Thread-ID']),channel:mgrTxt_(r.Channel)||'INTERNAL',
      ticketNo:mgrTxt_(r.TicketNo),subject:mgrTxt_(r.Subject),status:mgrTxt_(r.Status),branchId:mgrTxt_(r['Branch-ID']),
      ownerName:mgrTxt_(r.OwnerName)||mgrTxt_(r.OwnerUsername),ownerRole:mgrTxt_(r.OwnerRole),
      messageCount:mgrNum_(r.MessageCount),unreadOwner:mgrNum_(r.UnreadOwner),unreadPeer:mgrNum_(r.UnreadPeer),
      preview:mgrTxt_(r.LastMessagePreview),lastMessageAt:mgrIso_(r.LastMessageAt),createdAt:mgrIso_(r.CreatedAt)}))
      .sort((a,b)=>String(b.lastMessageAt||b.createdAt).localeCompare(String(a.lastMessageAt||a.createdAt)));
  }catch(e){ return []; }})();
  D.devRequests=(function(){ try{
    if(typeof devList==='function'){ const r=devList({},token); return r.items||[]; }
    return [];
  }catch(e){ return []; }})();
  D.settings=mgrSettings_();
  D.company=mgrCompany_();
  D.finance=mgrFinance_({});
  D.cash=mgrCashflow_(30);
  D.invest=mgrInvestStats_();
  D.equity=mgrEquity_();
  D.contractStats=mgrContractStats_();
  D.projectStats=mgrProjectStats_();
  D.defs={};
  Object.keys(MGR_DEF).forEach(e=>{ const d=MGR_DEF[e];
    D.defs[e]={sheet:d.sheet,id:d.id,req:d.req,nums:d.nums,dates:d.dates,enums:d.enums,search:d.search,headers:d.headers}; });
  D.views=mgrViews_(s.username);
  D.nextIds={}; Object.keys(MGR_DEF).forEach(e=>{ D.nextIds[e]=mgrNextId_(e); });
  const adv=mgrAdvisorBuild_(D);
  D.advisor=adv;
  D.notifications=mgrNotifications_(D,adv);
  return {success:true,user:mgrUser_(s),data:D,meta:{version:MGR_VERSION,today:mgrToday_()}};
}
function mgrNotifications_(D,adv){
  const out=[];
  (adv.insights||[]).filter(i=>i.severity==='critical'||i.severity==='warning').slice(0,8).forEach(i=>{
    out.push({id:'n-a-'+i.id,kind:'advisor',title:i.title,body:i.domainLabel+' · '+i.recommendation,at:new Date().toISOString()});
  });
  (D.contractStats.expiring||[]).slice(0,4).forEach(c=>{
    out.push({id:'n-c-'+c.id,kind:'contracts',title:'قرارداد در آستانه انقضا',body:c.Title+' · '+fa_(c.daysLeft)+' روز',at:new Date().toISOString()});
  });
  (D.projectStats.late||[]).slice(0,4).forEach(p=>{
    out.push({id:'n-p-'+p.id,kind:'projects',title:'پروژه عقب‌افتاده',body:p.Name+' · '+fa_(p.calcProgress)+'٪',at:new Date().toISOString()});
  });
  (D.notes||[]).filter(n=>n.ReminderAt&&n.ReminderAt<=mgrToday_()&&n.Done!=='بله').slice(0,5).forEach(n=>{
    out.push({id:'n-n-'+n.id,kind:'notes',title:'یادآوری یادداشت',body:n.Title,at:n.ReminderAt});
  });
  return out.slice(0,25);
}
function fa_(v){ return String(v==null?'':v).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[+d]); }

/* ═════════ ذخیره عمومی ═════════ */
function mgrCCSave(entity,record,token){
  const s=checkManagerAuth(token), d=mgrDef_(entity), r=record||{};
  const lock=mgrLock_();
  try{
    const obj={};
    d.headers.forEach(h=>{
      if(h===d.id||h==='CreatedAt'||h==='UpdatedAt'||h==='CreatedBy'||h==='UpdatedBy') return;
      if(!r.hasOwnProperty(h)) return;
      let v=r[h];
      if(d.nums.indexOf(h)>=0) v=mgrNum_(v);
      else if(d.dates.indexOf(h)>=0) v=v?mgrKey_(v):'';
      else v=mgrTxt_(v);
      obj[h]=v;
    });
    const isNew=!r.rowIndex;
    const merged=isNew?obj:Object.assign({},mgrEntityRows_(entity).find(x=>x.rowIndex===Number(r.rowIndex))||{},obj);
    d.req.forEach(k=>{
      const v=merged[k];
      if(v===undefined||v===null||String(v).trim()==='') throw new Error('فیلد «'+k+'» الزامی است.');
    });
    Object.keys(d.enums||{}).forEach(k=>{
      const v=mgrTxt_(merged[k]);
      if(v && d.enums[k].indexOf(v)<0) throw new Error('مقدار «'+k+'» معتبر نیست: '+v);
    });
    if(entity==='contracts'){
      if(merged.EndDate && merged.StartDate && merged.EndDate<merged.StartDate) throw new Error('تاریخ پایان نمی‌تواند قبل از شروع باشد.');
      if(merged.Value<0) throw new Error('مبلغ قرارداد منفی است.');
    }
    if(entity==='capacity'){
      if(merged.TotalQty<=0) throw new Error('ظرفیت کل باید بزرگ‌تر از صفر باشد.');
      const con=mgrEntityRows_('contracts').find(c=>c.id===merged['Contract-ID']);
      if(!con) throw new Error('قرارداد انتخاب‌شده معتبر نیست.');
      if(!merged.PeriodType) obj.PeriodType='کل قرارداد';
    }
    if(entity==='finance'&&merged.Amount<=0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد.');
    if(entity==='projects'&&merged.DueDate<merged.StartDate) throw new Error('مهلت پروژه قبل از شروع است.');
    if(entity==='ptasks'){
      const pr=mgrEntityRows_('projects').find(p=>p.id===merged['Project-ID']);
      if(!pr) throw new Error('پروژه انتخاب‌شده معتبر نیست.');
    }
    if(entity==='investments'&&merged.Units<=0) throw new Error('تعداد واحد باید بزرگ‌تر از صفر باشد.');
    if(entity==='holders'&&merged.Shares<=0) throw new Error('تعداد سهام باید بزرگ‌تر از صفر باشد.');
    const now=new Date();
    obj.UpdatedAt=now; obj.UpdatedBy=s.username;
    let rowIndex;
    if(isNew){
      obj[d.id]=mgrNextId_(entity);
      if(d.headers.indexOf('CreatedAt')>=0) obj.CreatedAt=now;
      if(d.headers.indexOf('CreatedBy')>=0) obj.CreatedBy=s.username;
      if(entity==='notes'&&!obj.OwnerUsername) obj.OwnerUsername=s.username;
      if(entity==='capacity'&&!obj.UsedQty) obj.UsedQty=0;
      if(entity==='projects'&&!obj.Status) obj.Status='برنامه‌ریزی';
      if(entity==='contracts'&&!obj.Status) obj.Status='پیش‌نویس';
      rowIndex=mgrAppend_(d.sheet,d.headers,obj);
    } else {
      rowIndex=Number(r.rowIndex);
      const exist=mgrRows_(d.sheet,d.headers).find(x=>x._row===rowIndex);
      if(!exist) throw new Error('رکورد یافت نشد.');
      mgrPatch_(d.sheet,d.headers,rowIndex,obj);
    }
    if(entity==='ptasks') mgrRecalcProject_(merged['Project-ID'],s);
    if(entity==='holders') mgrRecalcShares_(s);
    if(entity==='usage') mgrRecalcCapacity_(merged['Capacity-ID'],s);
    mgrLog_(s,(isNew?'افزودن ':'ویرایش ')+entity,obj[d.id]||('ردیف '+rowIndex));
    mgrCache_();
    return {success:true,rowIndex,id:obj[d.id]||mgrTxt_(mgrRows_(d.sheet,d.headers).find(x=>x._row===rowIndex)[d.id])};
  } finally { lock.releaseLock(); }
}
function mgrRecalcProject_(projectId,s){
  try{
    const ts=mgrEntityRows_('ptasks').filter(t=>t['Project-ID']===projectId);
    if(!ts.length) return;
    let w=0,acc=0;
    ts.forEach(t=>{ const wt=t.Weight||1; w+=wt; acc+=wt*(t.Status==='تکمیل شده'?100:(t.Progress||0)); });
    const p=mgrEntityRows_('projects').find(x=>x.id===projectId);
    if(!p) return;
    const prog=Math.round(acc/w);
    const patch={Progress:prog};
    if(prog>=100&&p.Status!=='لغو شده') patch.Status='تکمیل شده';
    mgrPatch_(MGR_DEF.projects.sheet,MGR_DEF.projects.headers,p.rowIndex,patch);
  }catch(e){}
}
function mgrRecalcShares_(s){
  try{
    const rows=mgrEntityRows_('holders');
    const total=rows.filter(r=>r.Status!=='واگذار کرده').reduce((a,r)=>a+r.Shares,0);
    if(!total) return;
    rows.forEach(r=>{
      const pct=r.Status==='واگذار کرده'?0:Math.round(r.Shares/total*10000)/100;
      mgrPatch_(MGR_DEF.holders.sheet,MGR_DEF.holders.headers,r.rowIndex,{SharePct:pct});
    });
  }catch(e){}
}
function mgrRecalcCapacity_(capId,s){
  try{
    const used=mgrEntityRows_('usage').filter(u=>u['Capacity-ID']===capId).reduce((a,u)=>a+u.Qty,0);
    const c=mgrEntityRows_('capacity').find(x=>x.id===capId);
    if(!c) return;
    const patch={UsedQty:used};
    if(c.TotalQty&&used>=c.TotalQty) patch.Status='تکمیل شده';
    mgrPatch_(MGR_DEF.capacity.sheet,MGR_DEF.capacity.headers,c.rowIndex,patch);
  }catch(e){}
}
function mgrCCBulkStatus(entity,ids,status,token){
  const s=checkManagerAuth(token), d=mgrDef_(entity), lock=mgrLock_();
  try{
    const key=d.headers.indexOf('Status')>=0?'Status':(d.headers.indexOf('Done')>=0?'Done':null);
    if(!key) throw new Error('این موجودیت وضعیت ندارد.');
    if(d.enums&&d.enums[key]&&d.enums[key].indexOf(status)<0) throw new Error('وضعیت معتبر نیست.');
    (ids||[]).forEach(i=>mgrPatch_(d.sheet,d.headers,Number(i),{[key]:status,UpdatedAt:new Date(),UpdatedBy:s.username}));
    mgrLog_(s,'تغییر وضعیت گروهی',entity+' → '+status+' ('+(ids||[]).length+')');
    mgrCache_();
    return {success:true,count:(ids||[]).length};
  } finally { lock.releaseLock(); }
}
function mgrTrashSheet_(){
  const ss=getSpreadsheet_();
  let sh=ss.getSheetByName(MGR_TRASH);
  if(!sh){ sh=ss.insertSheet(MGR_TRASH); sh.getRange(1,1,1,5).setValues([['Token','CreatedAt','ChunkIndex','ChunkCount','Payload']]); sh.setFrozenRows(1); }
  return sh;
}
function mgrCCDelete(parts,token){
  const s=checkManagerAuth(token), lock=mgrLock_();
  try{
    const t='MTRASH-'+Utilities.getUuid();
    const trash={at:new Date().toISOString(),parts:[]};
    (parts||[]).forEach(p=>{
      const d=mgrDef_(p.entity), sh=mgrSheet_(d.sheet,d.headers);
      const idx=Array.from(new Set((p.ids||[]).map(Number).filter(n=>n>=2))).sort((a,b)=>a-b);
      idx.forEach(i=>trash.parts.push({entity:p.entity,index:i,headers:d.headers,values:sh.getRange(i,1,1,d.headers.length).getValues()[0]}));
      idx.slice().sort((a,b)=>b-a).forEach(i=>sh.deleteRow(i));
    });
    const chunks=(JSON.stringify(trash).match(/[\s\S]{1,40000}/g)||[]);
    const ts=mgrTrashSheet_(), now=new Date();
    chunks.forEach((c,i)=>ts.appendRow([t,now,i,chunks.length,c]));
    mgrLog_(s,'حذف',t+' | '+trash.parts.length+' ردیف');
    mgrCache_();
    return {success:true,trashToken:t,count:trash.parts.length};
  } finally { lock.releaseLock(); }
}
function mgrCCRestore(trashToken,token){
  const s=checkManagerAuth(token), lock=mgrLock_();
  try{
    const sh=mgrTrashSheet_();
    if(sh.getLastRow()<2) throw new Error('موردی برای بازگردانی نیست.');
    const rows=sh.getRange(2,1,sh.getLastRow()-1,5).getValues();
    const parts=[],del=[];
    rows.forEach((r,i)=>{ if(mgrTxt_(r[0])===mgrTxt_(trashToken)){ parts.push({idx:Number(r[2]),payload:mgrTxt_(r[4])}); del.push(i+2); } });
    if(!parts.length) throw new Error('توکن بازگردانی معتبر نیست.');
    const trash=JSON.parse(parts.sort((a,b)=>a.idx-b.idx).map(p=>p.payload).join(''));
    trash.parts.sort((a,b)=>a.index-b.index).forEach(p=>{
      const d=mgrDef_(p.entity), target=mgrSheet_(d.sheet,d.headers);
      target.getRange(target.getLastRow()+1,1,1,d.headers.length).setValues([d.headers.map(h=>{ const i=p.headers.indexOf(h); return i>=0?p.values[i]:''; })]);
    });
    del.sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r));
    mgrLog_(s,'بازگردانی حذف',trashToken);
    mgrCache_();
    return {success:true,count:trash.parts.length};
  } finally { lock.releaseLock(); }
}

/* ═════════ مصرف ظرفیت قرارداد ═════════ */
function mgrContractUse(capacityId,qty,refType,refId,note,token){
  const s=checkManagerAuth(token);
  const cap=mgrEntityRows_('capacity').find(c=>c.id===mgrTxt_(capacityId));
  if(!cap) throw new Error('ظرفیت یافت نشد.');
  const q=mgrNum_(qty);
  if(q<=0) throw new Error('مقدار مصرف باید بزرگ‌تر از صفر باشد.');
  const used=mgrEntityRows_('usage').filter(u=>u['Capacity-ID']===cap.id).reduce((a,u)=>a+u.Qty,0);
  if(used+q>cap.TotalQty) throw new Error('مصرف از ظرفیت کل بیشتر است. باقی‌مانده: '+fa_(Math.max(0,cap.TotalQty-used)));
  const r=mgrCCSave('usage',{ 'Capacity-ID':cap.id,'Contract-ID':cap['Contract-ID'],Qty:q,
    RefType:refType||'دستی',RefId:refId||'','Branch-ID':cap['Branch-ID']||'',Date:mgrToday_(),Note:note||'' },token);
  return {success:true,id:r.id,remaining:Math.max(0,cap.TotalQty-used-q)};
}
function mgrContractRenew(contractId,newEnd,newValue,token){
  const s=checkManagerAuth(token);
  const c=mgrEntityRows_('contracts').find(x=>x.id===mgrTxt_(contractId));
  if(!c) throw new Error('قرارداد یافت نشد.');
  if(!newEnd) throw new Error('تاریخ پایان جدید الزامی است.');
  if(mgrKey_(newEnd)<=c.EndDate) throw new Error('تاریخ پایان جدید باید بعد از تاریخ فعلی باشد.');
  return mgrCCSave('contracts',{rowIndex:c.rowIndex,EndDate:mgrKey_(newEnd),
    Value:newValue?mgrNum_(newValue):c.Value,Status:'فعال'},token);
}
function mgrInvestPrice(id,price,token){
  const s=checkManagerAuth(token);
  const iv=mgrEntityRows_('investments').find(x=>x.id===mgrTxt_(id));
  if(!iv) throw new Error('سرمایه‌گذاری یافت نشد.');
  if(mgrNum_(price)<0) throw new Error('قیمت معتبر نیست.');
  return mgrCCSave('investments',{rowIndex:iv.rowIndex,CurrentPrice:mgrNum_(price),PriceUpdatedAt:mgrToday_()},token);
}
function mgrEquitySimulate(payload,token){
  checkManagerAuth(token);
  const p=payload||{}, eq=mgrEquity_();
  const mode=mgrTxt_(p.mode)||'افزایش سرمایه';
  const newShares=Math.max(0,mgrNum_(p.newShares));
  const amount=Math.max(0,mgrNum_(p.amount));
  const valuation=Math.max(0,mgrNum_(p.valuation));
  const total=eq.totalShares;
  let issued=newShares, pricePerShare=0, postVal=valuation;
  if(mode==='سرمایه‌گذار جدید'&&valuation>0&&amount>0){
    pricePerShare=valuation/total;
    issued=Math.round(amount/pricePerShare);
    postVal=valuation+amount;
  } else if(newShares>0&&valuation>0){ pricePerShare=valuation/total; postVal=valuation+newShares*pricePerShare; }
  const newTotal=total+issued;
  const rows=eq.holders.map(h=>({name:h.Name,shares:h.Shares,
    beforePct:total?Math.round(h.Shares/total*10000)/100:0,
    afterPct:newTotal?Math.round(h.Shares/newTotal*10000)/100:0}));
  if(mode==='سرمایه‌گذار جدید'&&issued>0) rows.push({name:mgrTxt_(p.investorName)||'سرمایه‌گذار جدید',shares:issued,
    beforePct:0,afterPct:Math.round(issued/newTotal*10000)/100});
  rows.forEach(r=>{ r.dilution=Math.round((r.beforePct-r.afterPct)*100)/100; });
  return {success:true,mode,totalBefore:total,issued,totalAfter:newTotal,pricePerShare:Math.round(pricePerShare),
    preValuation:valuation,postValuation:Math.round(postVal),rows};
}
function mgrWhatIf(payload,token){
  checkManagerAuth(token);
  const p=payload||{}, F=mgrFinance_({from:p.from,to:p.to});
  const price=mgrNum_(p.priceChange)/100, vol=mgrNum_(p.volumeChange)/100,
        varCost=mgrNum_(p.varCostChange)/100, fixedAdd=mgrNum_(p.fixedAdd),
        newRev=mgrNum_(p.newContractRevenue), hire=mgrNum_(p.hireCount), hireCost=mgrNum_(p.hireCost);
  const rev=F.revenue*(1+price)*(1+vol)+newRev;
  const variable=F.variable*(1+vol)*(1+varCost);
  const fixed=F.fixed+fixedAdd+hire*hireCost;
  const net=rev-variable-fixed;
  const margin=rev?Math.round(net/rev*1000)/10:0;
  const gm=rev?(rev-variable)/rev:0;
  return {success:true,base:{revenue:F.revenue,variable:F.variable,fixed:F.fixed,net:F.netProfit,margin:F.margin},
    scenario:{revenue:Math.round(rev),variable:Math.round(variable),fixed:Math.round(fixed),net:Math.round(net),margin,
      breakEven:gm>0?Math.round(fixed/gm):0,deltaNet:Math.round(net-F.netProfit),deltaMargin:Math.round((margin-F.margin)*10)/10},
    inputs:{price,vol,varCost,fixedAdd,newRev,hire,hireCost}};
}

/* ═════════ مشاوره هوشمند ═════════ */
function mgrAdvisorBuild_(D){
  const today=mgrToday_(), out=[], C=D.company, F=D.finance, CS=D.contractStats, PS=D.projectStats, IV=D.invest, EQ=D.equity;
  const push=(o)=>{ out.push(Object.assign({id:'INS-'+(out.length+1),actions:[]},o)); };
  const money=(n)=>new Intl.NumberFormat('fa-IR').format(Math.round(n))+' '+C.currency;

  CS.expiring.forEach(c=>push({severity:'critical',domain:'contracts',domainLabel:'قراردادها',
    title:'قرارداد «'+c.Title+'» تا '+fa_(c.daysLeft)+' روز دیگر منقضی می‌شود',
    evidence:['پایان: '+c.EndDate,'مبلغ: '+money(c.Value),'طرف: '+c.PartyName,'تمدید خودکار: '+(c.AutoRenew||'خیر')],
    impact:c.Value,recommendation:'مذاکره تمدید را همین هفته آغاز کنید؛ در صورت عدم تمدید، درآمد سالانه این قرارداد از دست می‌رود.',
    score:90+Math.min(20,c.Value/1e7),
    actions:[{label:'تمدید قرارداد',act:'renew',entity:'contracts',id:c.id},{label:'ثبت تصمیم',act:'decision',title:'تمدید قرارداد '+c.Title}]}));
  CS.expired.forEach(c=>push({severity:'critical',domain:'contracts',domainLabel:'قراردادها',
    title:'قرارداد «'+c.Title+'» منقضی شده ولی وضعیت آن «فعال» است',
    evidence:['پایان: '+c.EndDate,'مبلغ: '+money(c.Value)],impact:c.Value,
    recommendation:'وضعیت را به «منقضی» تغییر دهید یا تمدید کنید تا گزارش درآمد اشتباه نشود.',score:95,
    actions:[{label:'ویرایش قرارداد',act:'edit',entity:'contracts',id:c.id}]}));
  CS.highUtil.forEach(c=>push({severity:'warning',domain:'capacity',domainLabel:'ظرفیت قرارداد',
    title:'ظرفیت «'+c.Title+'» به '+fa_(c.utilPct)+'٪ رسیده است',
    evidence:['مصرف: '+fa_(c.used)+' از '+fa_(c.TotalQty)+' '+c.Unit,'باقی‌مانده: '+fa_(c.remain),'درآمد تحقق: '+money(c.revenue)],
    impact:c.remain*c.UnitPrice,
    recommendation:'پیش از اتمام ظرفیت، الحاقیه افزایش ظرفیت صادر کنید تا خدمت‌رسانی متوقف نشود.',score:75,
    actions:[{label:'افزایش ظرفیت',act:'edit',entity:'capacity',id:c.id},{label:'ثبت مصرف',act:'use',entity:'capacity',id:c.id}]}));
  CS.lowUtil.forEach(c=>{
    const span=c.StartDate&&c.EndDate?mgrDays_(c.StartDate,c.EndDate):0;
    const gone=c.StartDate?mgrDays_(c.StartDate,today):0;
    if(span>0&&gone/span>0.5) push({severity:'warning',domain:'capacity',domainLabel:'ظرفیت قرارداد',
      title:'ظرفیت «'+c.Title+'» کم‌مصرف است ('+fa_(c.utilPct)+'٪ در '+fa_(Math.round(gone/span*100))+'٪ دوره)',
      evidence:['مصرف: '+fa_(c.used)+' از '+fa_(c.TotalQty),'درآمد از دست رفته احتمالی: '+money((c.TotalQty-c.used)*c.UnitPrice)],
      impact:(c.TotalQty-c.used)*c.UnitPrice,
      recommendation:'با کارفرما برای فعال‌سازی مصرف یا تبدیل ظرفیت به خدمت دیگر مذاکره کنید.',score:70,
      actions:[{label:'جزئیات ظرفیت',act:'view',entity:'capacity',id:c.id}]});
  });
  PS.late.forEach(p=>push({severity:'critical',domain:'projects',domainLabel:'پروژه‌ها',
    title:'پروژه «'+p.Name+'» '+fa_(Math.abs(p.daysLeft))+' روز تأخیر دارد',
    evidence:['پیشرفت: '+fa_(p.calcProgress)+'٪','مهلت: '+p.DueDate,'بودجه مصرف: '+fa_(p.burnPct)+'٪','مدیر: '+(p.ManagerName||'—')],
    impact:p.Budget,recommendation:'جلسه بازبینی فوری، بازتعریف مایلستون‌ها و تخصیص منابع اضافی یا اصلاح دامنه پروژه.',score:88,
    actions:[{label:'بازبینی پروژه',act:'view',entity:'projects',id:p.id},{label:'ثبت تصمیم',act:'decision',title:'نجات پروژه '+p.Name}]}));
  PS.list.filter(p=>p.burnPct>90&&p.calcProgress<70&&p.Status==='در حال اجرا').forEach(p=>push({severity:'warning',
    domain:'projects',domainLabel:'پروژه‌ها',title:'انحراف بودجه در «'+p.Name+'»',
    evidence:['بودجه: '+money(p.Budget),'هزینه: '+money(p.Spent),'پیشرفت: '+fa_(p.calcProgress)+'٪'],
    impact:p.Spent-p.Budget*p.calcProgress/100,
    recommendation:'نسبت هزینه به پیشرفت نامتوازن است؛ هزینه‌های باقی‌مانده را قفل و بازبرآورد کنید.',score:78,
    actions:[{label:'ثبت تصمیم',act:'decision',title:'کنترل بودجه '+p.Name}]}));
  Object.keys(F.byBranch).forEach(b=>{
    const v=F.byBranch[b];
    if(v.rev>0){
      const m=Math.round((v.rev-v.cost)/v.rev*1000)/10;
      if(m<0) push({severity:'critical',domain:'finance',domainLabel:'مالی',
        title:'شعبه/واحد «'+b+'» زیان‌ده است',evidence:['درآمد: '+money(v.rev),'هزینه: '+money(v.cost),'حاشیه: '+fa_(m)+'٪'],
        impact:Math.abs(v.rev-v.cost),recommendation:'بازنگری قیمت‌گذاری، کاهش هزینه ثابت یا ادغام عملیات این واحد.',score:92,
        actions:[{label:'ثبت تصمیم',act:'decision',title:'اصلاح سودآوری '+b}]});
      else if(m<C.targetMargin) push({severity:'warning',domain:'finance',domainLabel:'مالی',
        title:'حاشیه سود «'+b+'» زیر هدف است',evidence:['حاشیه: '+fa_(m)+'٪','هدف: '+fa_(C.targetMargin)+'٪'],
        impact:v.rev*(C.targetMargin-m)/100,recommendation:'افزایش سهم خدمات پرحاشیه یا کاهش هزینه متغیر این واحد.',score:64});
    }
  });
  const custRev={};
  (D.orders||[]).filter(o=>o.status!=='لغو شده').forEach(o=>{ const k=o.customerId||o.customerName; custRev[k]=(custRev[k]||0)+o.finalPrice; });
  const totRev=Object.keys(custRev).reduce((a,k)=>a+custRev[k],0);
  const topCust=Object.keys(custRev).sort((a,b)=>custRev[b]-custRev[a])[0];
  if(totRev&&topCust&&custRev[topCust]/totRev>0.4){
    const pct=Math.round(custRev[topCust]/totRev*100);
    push({severity:'warning',domain:'strategy',domainLabel:'راهبرد',
      title:'تمرکز درآمد: '+fa_(pct)+'٪ از یک مشتری',evidence:['مشتری: '+topCust,'درآمد: '+money(custRev[topCust])],
      impact:custRev[topCust],recommendation:'ریسک وابستگی بالاست؛ برنامه جذب مشتری سازمانی جدید و قرارداد بلندمدت با این مشتری تنظیم کنید.',score:72,
      actions:[{label:'ثبت تصمیم',act:'decision',title:'کاهش تمرکز درآمد'}]});
  }
  const months=Object.keys(F.byMonth).sort();
  if(months.length>=2){
    const a=F.byMonth[months[months.length-2]],b=F.byMonth[months[months.length-1]];
    const rg=a.rev?(b.rev-a.rev)/a.rev:0, cg=a.cost?(b.cost-a.cost)/a.cost:0;
    if(cg>rg+0.1) push({severity:'warning',domain:'finance',domainLabel:'مالی',
      title:'رشد هزینه از رشد درآمد پیشی گرفته است',
      evidence:['رشد درآمد: '+fa_(Math.round(rg*100))+'٪','رشد هزینه: '+fa_(Math.round(cg*100))+'٪','ماه: '+months[months.length-1]],
      impact:(b.cost-a.cost)-(b.rev-a.rev),recommendation:'هزینه‌های ثابت جدید را تا تثبیت درآمد متوقف کنید.',score:74,
      actions:[{label:'تحلیل هزینه',act:'go',page:'pnl'}]});
  }
  if(F.overdueAmount>0) push({severity:F.overdueAmount>F.revenue*0.15?'critical':'warning',domain:'finance',domainLabel:'مالی',
    title:'مطالبات معوق: '+money(F.overdueAmount),evidence:['تعداد اقلام: '+fa_(F.overdueCount),'درآمد وصول‌شده: '+money(F.revenue)],
    impact:F.overdueAmount,recommendation:'پیگیری وصول اولویت‌دار؛ برای اقلام بالای ۳۰ روز، توقف خدمت یا تضمین دریافت کنید.',score:80,
    actions:[{label:'مشاهده دفتر مالی',act:'go',page:'finance'}]});
  if(D.cash.net<0) push({severity:'critical',domain:'finance',domainLabel:'جریان نقد',
    title:'کسری جریان نقد در '+fa_(D.cash.days)+' روز آینده',
    evidence:['ورودی مورد انتظار: '+money(D.cash.inflow),'خروجی مورد انتظار: '+money(D.cash.outflow),'خالص: '+money(D.cash.net)],
    impact:Math.abs(D.cash.net),recommendation:'تعویق هزینه‌های غیرضروری، تسریع وصول یا تأمین مالی کوتاه‌مدت.',score:93,
    actions:[{label:'ثبت تصمیم',act:'decision',title:'مدیریت کسری نقدینگی'}]});
  IV.items.forEach(i=>{
    if(i.StopLoss&&i.CurrentPrice&&i.CurrentPrice<=i.StopLoss) push({severity:'critical',domain:'invest',domainLabel:'سرمایه‌گذاری',
      title:'«'+i.Title+'» به حد ضرر رسیده است',evidence:['قیمت خرید: '+money(i.BuyPrice),'قیمت جاری: '+money(i.CurrentPrice),'حد ضرر: '+money(i.StopLoss),'زیان: '+money(i.pl)],
      impact:Math.abs(i.pl),recommendation:'طبق سیاست سرمایه‌گذاری، خروج یا کاهش موقعیت را بررسی کنید.',score:86,
      actions:[{label:'به‌روزرسانی قیمت',act:'price',entity:'investments',id:i.id}]});
    else if(i.plPct<=-20) push({severity:'warning',domain:'invest',domainLabel:'سرمایه‌گذاری',
      title:'افت '+fa_(Math.abs(i.plPct))+'٪ در «'+i.Title+'»',evidence:['زیان: '+money(i.pl),'ریسک: '+i.Risk],
      impact:Math.abs(i.pl),recommendation:'بازبینی فرضیات سرمایه‌گذاری و تعیین حد ضرر مشخص.',score:68});
    if(i.TargetPrice&&i.CurrentPrice>=i.TargetPrice) push({severity:'good',domain:'invest',domainLabel:'سرمایه‌گذاری',
      title:'«'+i.Title+'» به هدف قیمتی رسیده است',evidence:['سود: '+money(i.pl),'بازده: '+fa_(i.plPct)+'٪'],
      impact:i.pl,recommendation:'سیب‌سیوی سود یا خروج پله‌ای را بررسی کنید.',score:50,
      actions:[{label:'ثبت تصمیم',act:'decision',title:'سیب‌سود '+i.Title}]});
  });
  if(IV.concentration>50) push({severity:'warning',domain:'invest',domainLabel:'سرمایه‌گذاری',
    title:'تمرکز پرتفوی: '+fa_(IV.concentration)+'٪ در «'+IV.topTitle+'»',
    evidence:['ارزش پرتفوی: '+money(IV.value)],impact:IV.value*IV.concentration/100,
    recommendation:'تنوع‌بخشی بین طبقات دارایی برای کاهش ریسک غیرسیستماتیک.',score:66});
  if(EQ.mismatch) push({severity:'critical',domain:'equity',domainLabel:'سهام شرکت',
    title:'عدم تطابق تعداد سهام ثبت‌شده با سرمایه اعلامی',
    evidence:['سهام سهامداران: '+fa_(EQ.totalShares),'سهام اعلامی شرکت: '+fa_(EQ.declaredShares)],
    recommendation:'جدول سهام (Cap Table) را اصلاح کنید؛ این اختلاف در حسابرسی و جذب سرمایه‌گذار مشکل‌ساز است.',score:90,
    actions:[{label:'اصلاح سهام',act:'go',page:'equity'}]});
  if(EQ.topPct>60) push({severity:'info',domain:'equity',domainLabel:'سهام شرکت',
    title:'تمرکز مالکیت: '+fa_(EQ.topPct)+'٪ در اختیار «'+EQ.topHolder+'»',
    evidence:['تعداد سهامداران: '+fa_(EQ.holders.length)],
    recommendation:'برای جذب سرمایه و حاکمیت شرکتی، ساختار سهامداری و اختیار تصمیم را مستند کنید.',score:45});
  const cancel=(D.orders||[]).filter(o=>/لغو/.test(o.status)).length;
  const cancelRate=(D.orders||[]).length?Math.round(cancel/(D.orders||[]).length*100):0;
  if(cancelRate>15) push({severity:'warning',domain:'operations',domainLabel:'عملیات',
    title:'نرخ لغو سفارش '+fa_(cancelRate)+'٪ است',evidence:['لغو: '+fa_(cancel),'کل: '+fa_((D.orders||[]).length)],
    recommendation:'علت‌یابی لغو (قیمت، تأخیر، کیفیت) و اصلاح فرآیند پذیرش.',score:62,
    actions:[{label:'بررسی سفارش‌ها',act:'go',page:'operations'}]});
  const stale=(D.cards||[]).filter(c=>!/تکمیل|لغو/.test(c.status)&&c.updatedAt&&mgrDays_(mgrKey_(c.updatedAt),today)>7).length;
  if(stale>0) push({severity:'warning',domain:'operations',domainLabel:'عملیات',
    title:fa_(stale)+' کارت عملیاتی بیش از ۷ روز بی‌تغییر مانده',evidence:['کل کارت‌ها: '+fa_((D.cards||[]).length)],
    recommendation:'از مدیران شعب گزارش وضعیت روزانه بخواهید و کارت‌های معلق را تعیین تکلیف کنید.',score:60});
  const approved=(D.applicants||[]).filter(a=>a.status==='تأیید شده').length;
  if(approved>0) push({severity:'info',domain:'people',domainLabel:'سرمایه انسانی',
    title:fa_(approved)+' کارجوی تأییدشده در انتظار استخدام',evidence:['کل پرونده‌ها: '+fa_((D.applicants||[]).length)],
    recommendation:'تأییدشده‌ها را به نیروی فعال تبدیل کنید تا ظرفیت عملیاتی افزایش یابد.',score:40});
  const unanswered=(D.messages||[]).filter(m=>String(m.status).toUpperCase()!=='CLOSED'&&m.unreadPeer>0&&m.lastMessageAt&&mgrDays_(mgrKey_(m.lastMessageAt),today)>2).length;
  if(unanswered>0) push({severity:'warning',domain:'support',domainLabel:'پشتیبانی',
    title:fa_(unanswered)+' گفتگو بیش از ۴۸ ساعت بی‌پاسخ مانده',evidence:['کل گفتگوها: '+fa_((D.messages||[]).length)],
    recommendation:'SLA پاسخ‌گویی ۲۴ ساعته تعیین و به شعب ابلاغ کنید.',score:58,
    actions:[{label:'مشاهده گفتگوها',act:'go',page:'messages'}]});
  (D.targets||[]).forEach(t=>{
    const act=mgrTargetActual_(t,D);
    const pct=t.TargetValue?Math.round(act/t.TargetValue*100):0;
    if(pct<70) push({severity:pct<40?'critical':'warning',domain:'targets',domainLabel:'اهداف',
      title:'هدف «'+t.Metric+'» ('+t.Period+') در '+fa_(pct)+'٪ تحقق',
      evidence:['هدف: '+fa_(t.TargetValue),'محقق: '+fa_(act),'دامنه: '+(t.ScopeId||t.Scope)],
      recommendation:'برنامه اصلاحی کوتاه‌مدت با مسئول مشخص و بازبینی هفتگی تعریف کنید.',score:pct<40?82:65,
      actions:[{label:'ثبت تصمیم',act:'decision',title:'تحقق هدف '+t.Metric}]});
    else if(pct>=100) push({severity:'good',domain:'targets',domainLabel:'اهداف',
      title:'هدف «'+t.Metric+'» محقق شد ('+fa_(pct)+'٪)',evidence:['هدف: '+fa_(t.TargetValue),'محقق: '+fa_(act)],
      recommendation:'هدف بعدی را ارتقا دهید و عوامل موفقیت را مستند کنید.',score:35});
  });
  if(F.netProfit>0&&F.margin>=C.targetMargin) push({severity:'good',domain:'finance',domainLabel:'مالی',
    title:'سودآوری بالای هدف',evidence:['سود خالص: '+money(F.netProfit),'حاشیه: '+fa_(F.margin)+'٪ (هدف '+fa_(C.targetMargin)+'٪)'],
    impact:F.netProfit,recommendation:'ظرفیت سرمایه‌گذاری مازاد نقد را طبق سیاست پرتفوی تخصیص دهید.',score:30,
    actions:[{label:'بررسی سرمایه‌گذاری',act:'go',page:'investments'}]});
  if(!out.length) push({severity:'good',domain:'general',domainLabel:'سامانه',title:'هیچ ریسک فعالی شناسایی نشد',
    evidence:['قراردادها، پروژه‌ها، مالی و پرتفوی در محدوده سالم هستند'],
    recommendation:'برای دقت بیشتر مشاوره، دفتر مالی و ظرفیت قراردادها را کامل ثبت کنید.',score:10});
  const w={critical:40,warning:18,info:6,good:0};
  const penalty=out.reduce((a,i)=>a+(w[i.severity]||0),0);
  const health=Math.max(0,Math.min(100,100-Math.round(penalty/2)));
  const order={critical:0,warning:1,info:2,good:3};
  out.sort((a,b)=>(order[a.severity]-order[b.severity])||(b.score-a.score));
  const counts={critical:0,warning:0,info:0,good:0};
  out.forEach(i=>counts[i.severity]++);
  return {insights:out,health,counts,generatedAt:new Date().toISOString(),
    headline: counts.critical?fa_(counts.critical)+' ریسک بحرانی نیازمند تصمیم فوری':
      counts.warning?fa_(counts.warning)+' هشدار قابل پیگیری':'وضعیت سامانه سالم است'};
}
function mgrTargetActual_(t,D){
  const F=D.finance||{}, os=D.orders||[];
  const scope=t.Scope, id=mgrTxt_(t.ScopeId);
  const inScope=(r)=>scope==='کل سامانه'||!id||(r.branchId===id||r['Branch-ID']===id||r['Project-ID']===id);
  switch(t.Metric){
    case 'درآمد': return Object.keys(F.byBranch||{}).reduce((a,b)=>a+((scope==='کل سامانه'||b===id)?F.byBranch[b].rev:0),0)||F.revenue||0;
    case 'سود خالص': return F.netProfit||0;
    case 'تعداد سفارش': return os.filter(o=>inScope(o)).length;
    case 'نرخ تکمیل': { const f=os.filter(o=>inScope(o)); return f.length?Math.round(f.filter(o=>/تکمیل/.test(o.status)).length/f.length*100):0; }
    case 'حاشیه سود': return F.margin||0;
    case 'مشتری جدید': return (D.customers||[]).length;
    case 'ارزش قرارداد': return (D.contractStats&&D.contractStats.totalValue)||0;
    case 'کاهش هزینه': return F.cost||0;
    default: return 0;
  }
}
function mgrAdvisor(token){ const s=checkManagerAuth(token); const D=mgrCCBootstrap(token).data; return {success:true,advisor:D.advisor}; }
function mgrDecisionFromInsight(insight,token){
  const s=checkManagerAuth(token), i=insight||{};
  return mgrCCSave('decisions',{ Title:i.title||'تصمیم مدیریتی',
    Context:(i.evidence||[]).join(' | '), Options:'۱) اقدام فوری ۲) اقدام مرحله‌ای ۳) پذیرش ریسک',
    Choice:i.recommendation||'', Rationale:i.title||'', Impact:i.impact?String(Math.round(i.impact)):'',
    Risk:i.severity==='critical'?'زیاد':i.severity==='warning'?'متوسط':'کم',
    Owner:s.name||s.username, Status:'پیشنهادی', DueDate:mgrKey_(new Date(Date.now()+7*864e5)),
    RelatedType:'—' },token);
}

/* ═════════ گزارش‌ها / نمودارها ═════════ */
function mgrFinanceReport(filters,token){
  checkManagerAuth(token);
  const F=mgrFinance_(filters||{});
  return {success:true,summary:{revenue:F.revenue,cost:F.cost,grossProfit:F.grossProfit,operatingProfit:F.operatingProfit,
    netProfit:F.netProfit,margin:F.margin,grossMargin:F.grossMargin,fixed:F.fixed,variable:F.variable,capex:F.capex,
    receivable:F.receivable,payable:F.payable,breakEven:F.breakEven},
    byCat:F.byCat,byBranch:F.byBranch,byMonth:F.byMonth,rows:F.rows};
}
function mgrCharts(token,filters){
  checkManagerAuth(token);
  const D=mgrCCBootstrap(token).data, F=mgrFinance_(filters||{});
  const months=Object.keys(F.byMonth).sort();
  const orders=D.orders||[];
  const byStatus={},byService={},byBranchRev={},byCity={},custRev={};
  orders.forEach(o=>{
    byStatus[o.status]=(byStatus[o.status]||0)+1;
    byService[o.service]=(byService[o.service]||0)+1;
    byBranchRev[o.branchId||'ستاد']=(byBranchRev[o.branchId||'ستاد']||0)+o.finalPrice;
    const c=(D.customers||[]).find(x=>x.customerId===o.customerId);
    const city=(c&&c.city)||'نامشخص';
    byCity[city]=(byCity[city]||0)+o.finalPrice;
    const k=o.customerName||o.customerId;
    custRev[k]=(custRev[k]||0)+o.finalPrice;
  });
  const topCust=Object.keys(custRev).sort((a,b)=>custRev[b]-custRev[a]).slice(0,8).map(k=>({name:k,value:custRev[k]}));
  const cardsByStatus={};
  (D.cards||[]).forEach(c=>{ cardsByStatus[c.status]=(cardsByStatus[c.status]||0)+1; });
  const workerPerf={};
  (D.cards||[]).filter(c=>c.status==='تکمیل شده').forEach(c=>{
    const w=(D.workers||[]).find(x=>x.workerId===c.workerId);
    const n=w?w.name:(c.workerId||'نامشخص');
    workerPerf[n]=(workerPerf[n]||0)+1;
  });
  const topWorkers=Object.keys(workerPerf).sort((a,b)=>workerPerf[b]-workerPerf[a]).slice(0,8).map(k=>({name:k,value:workerPerf[k]}));
  return {success:true,
    revenueTrend:{labels:months,rev:months.map(m=>F.byMonth[m].rev),cost:months.map(m=>F.byMonth[m].cost),net:months.map(m=>F.byMonth[m].rev-F.byMonth[m].cost)},
    expenseMix:F.byCat, branchProfit:F.byBranch, orderStatus:byStatus, cardStatus:cardsByStatus,
    serviceMix:byService, branchRevenue:byBranchRev, cityRevenue:byCity, topCustomers:topCust, topWorkers,
    investAllocation:D.invest.byKind, contractUtil:(D.contractStats.caps||[]).slice(0,10).map(c=>({name:c.Title,util:c.utilPct})),
    projectProgress:(D.projectStats.list||[]).slice(0,10).map(p=>({name:p.Name,progress:p.calcProgress,burn:p.burnPct})),
    equitySplit:(D.equity.holders||[]).map(h=>({name:h.Name,value:h.Shares})),
    cash:D.cash};
}
function mgrCCExport(entity,token){
  const s=checkManagerAuth(token), d=mgrDef_(entity);
  const rows=mgrEntityRows_(entity);
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  const cols=d.headers.filter(h=>h!==d.id).concat([]);
  const lines=[[d.id].concat(cols).map(q).join(',')];
  rows.forEach(r=>lines.push([r.id].concat(cols.map(c=>r[c])).map(q).join(',')));
  mgrLog_(s,'خروجی CSV',entity+' ('+rows.length+')');
  return '\uFEFF'+lines.join('\n');
}
function mgrViews_(u){ try{ return JSON.parse(PropertiesService.getScriptProperties().getProperty('MGR_VIEWS_'+u)||'{}'); }catch(e){ return {}; } }
function mgrSaveView(page,name,state,token){
  const s=checkManagerAuth(token), v=mgrViews_(s.username);
  v[page]=v[page]||[];
  const id='V-'+Utilities.getUuid().slice(0,8);
  v[page].push({id,name:mgrTxt_(name),state:state||{}});
  PropertiesService.getScriptProperties().setProperty('MGR_VIEWS_'+s.username,JSON.stringify(v));
  return {success:true,id};
}
function mgrDeleteView(page,id,token){
  const s=checkManagerAuth(token), v=mgrViews_(s.username);
  v[page]=(v[page]||[]).filter(x=>x.id!==id);
  PropertiesService.getScriptProperties().setProperty('MGR_VIEWS_'+s.username,JSON.stringify(v));
  return {success:true};
}

/* ═════════ لوگو / نماد ═════════ */
function mgrUploadAsset(dataUrl,kind,token){
  const s=checkManagerAuth(token);
  const key=kind==='favicon'?'FAVICON_URL':'LOGO_URL';
  const name=kind==='favicon'?'favicon.png':'LOGO.png';
  let url='';
  if(typeof uploadImage==='function'){ const r=uploadImage(dataUrl,name,token); url=r&&r.url?r.url:''; }
  if(!url){
    const m=String(dataUrl||'').match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
    if(!m) throw new Error('داده تصویر معتبر نیست.');
    const bytes=m[2]?Utilities.base64Decode(m[3]):Utilities.newBlob(decodeURIComponent(m[3])).getBytes();
    if(bytes.length>4*1024*1024) throw new Error('حجم تصویر باید کمتر از ۴ مگابایت باشد.');
    const blob=Utilities.newBlob(bytes,m[1]||'image/png','ZingoVingo-'+name);
    const cached=PropertiesService.getScriptProperties().getProperty('ZV_ASSETS_FOLDER');
    let folder;
    try{ folder=cached?DriveApp.getFolderById(cached):null; }catch(e){ folder=null; }
    if(!folder){ const it=DriveApp.getFoldersByName('ZingoVingo Assets'); folder=it.hasNext()?it.next():DriveApp.createFolder('ZingoVingo Assets');
      PropertiesService.getScriptProperties().setProperty('ZV_ASSETS_FOLDER',folder.getId()); }
    const fit=folder.getFilesByName(blob.getName());
    let file;
    if(fit.hasNext()){ file=fit.next(); file.setContent(bytes); } else file=folder.createFile(blob);
    try{ file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW); }catch(e){}
    url='https://lh3.googleusercontent.com/d/'+file.getId()+'=w512';
  }
  mgrSaveSettings({[key]:url},token);
  return {success:true,url,key};
}
function getPublicBranding(){
  const s=mgrSettings_();
  return {success:true,LOGO_URL:s.LOGO_URL||'',FAVICON_URL:s.FAVICON_URL||'',
    BRAND_NAME:s.BRAND_NAME||'ZingoVingo',CURRENCY_LABEL:s.CURRENCY_LABEL||'ریال',time:new Date().toISOString()};
}

/* ═════════ سازگاری با API قبلی ═════════ */
function getManagerDashboard(token){
  const D=mgrCCBootstrap(token).data, os=D.orders||[];
  return { totalOrders:os.length,
    todayOrders:os.filter(o=>mgrKey_(o.createdAt)===mgrToday_()).length,
    monthOrders:os.filter(o=>mgrKey_(o.createdAt).slice(0,7)===mgrToday_().slice(0,7)).length,
    totalRevenue:os.reduce((a,o)=>a+o.finalPrice,0),
    pendingOrders:os.filter(o=>/جدید|ثبت اولیه/.test(o.status)).length,
    completedOrders:os.filter(o=>/تکمیل/.test(o.status)).length,
    cancelledOrders:os.filter(o=>/لغو/.test(o.status)).length,
    netProfit:D.finance.netProfit, contractValue:D.contractStats.totalValue, health:D.advisor.health };
}
function getManagerOrders(token){
  const D=mgrCCBootstrap(token).data;
  return (D.orders||[]).map(o=>({rowIndex:o.rowIndex,requestId:o.requestId,date:o.createdAt,customer:o.customerName,
    phone:o.phone,service:o.service,quantity:1,finalPrice:o.finalPrice,status:o.status,operator:o.branchId}));
}
function getManagerProfile(token){
  const s=checkManagerAuth(token);
  const row=mgrRead_('employees').find(r=>mgrTxt_(r.username)===s.username||mgrTxt_(r.empId)===(s.empId||s.employeeId))||{};
  return {employeeId:s.empId||s.employeeId,fullName:mgrName_(row)||s.name,username:mgrTxt_(row.username)||s.username,
    email:mgrTxt_(row.email)||s.email,phone:mgrTxt_(row.contact)||s.phone,avatar:mgrTxt_(row.photo)||s.avatar,
    role:s.role==='Administrator'?'ادمین ارشد':'مدیر کل',branch:mgrTxt_(row.branchId)||s.branch,
    position:mgrTxt_(row.jobTitle)||s.position,specialty:mgrTxt_(row.specialization)||s.specialty,
    address:mgrTxt_(row.address),nationalId:mgrTxt_(row.nationalId)};
}
function updateManagerProfile(updates,token){
  const s=checkManagerAuth(token), u=updates||{}, lock=mgrLock_();
  try{
    const row=mgrRead_('employees').find(r=>mgrTxt_(r.username)===s.username||mgrTxt_(r.empId)===(s.empId||s.employeeId));
    if(!row) throw new Error('رکورد کاربر یافت نشد.');
    const p={};
    if(u.fullName){ const a=String(u.fullName).trim().split(/\s+/); p.firstName=a[0]||''; p.lastName=a.slice(1).join(' '); }
    ['email','address','nationalId','password','specialization'].forEach(k=>{ if(u[k]) p[k]=u[k]; });
    if(u.phone) p.contact=String(u.phone).replace(/[^\d]/g,'');
    if(u.avatar) p.photo=u.avatar;
    if(Object.keys(p).length) scUpdate_('employees',row._rowIndex,p);
    if(p.firstName||p.lastName) s.name=[p.firstName||row.firstName,p.lastName||row.lastName].filter(Boolean).join(' ');
    if(p.photo) s.avatar=p.photo;
    if(p.contact) s.phone=p.contact;
    PropertiesService.getScriptProperties().setProperty('session_'+token,JSON.stringify(s));
    mgrLog_(s,'ویرایش پروفایل مدیر کل',Object.keys(p).join(', '));
    mgrCache_();
    return {success:true,message:'پروفایل بروزرسانی شد'};
  } finally { lock.releaseLock(); }
}
function mgrCCPing(){
  const need=['managerLogin','managerLogout','checkManagerAuth','mgrCCSession','mgrCCBootstrap','mgrCCSave','mgrCCDelete',
    'mgrCCRestore','mgrCCBulkStatus','mgrEnsureSheets','mgrContractUse','mgrContractRenew','mgrInvestPrice',
    'mgrEquitySimulate','mgrWhatIf','mgrAdvisor','mgrDecisionFromInsight','mgrFinanceReport','mgrCharts','mgrCCExport',
    'mgrSaveView','mgrDeleteView','mgrSaveSettings','mgrUploadAsset','getPublicBranding',
    'getManagerDashboard','getManagerOrders','getManagerProfile','updateManagerProfile'];
  const missing=need.filter(n=>typeof globalThis[n]!=='function');
  const sheets={};
  Object.keys(MGR_DEF).forEach(e=>{ try{ const d=MGR_DEF[e]; sheets[d.sheet]=Math.max(0,mgrSheet_(d.sheet,d.headers).getLastRow()-1); }catch(err){ sheets[e]='ERR'; } });
  return {ok:!missing.length,version:MGR_VERSION,missing,sheets,time:new Date().toISOString()};
}
