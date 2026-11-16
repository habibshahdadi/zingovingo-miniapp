/**
* ZingoVingo — Supervisor Panel Backend
* سوپروایزر در شیت Workers با Operations=Supervisor ثبت شده
* مدیریت گروه‌ها و اعضای گروه از طریق شیت groupMembers
*/

// ==================== احراز هویت ====================
function supervisorLogin(username, password) {
  try {
    const u = String(username).trim().toLowerCase();
    const rows = scRead_('workers');
    const found = rows.find(r => 
      (text_(r.username).toLowerCase() === u || text_(r.email).toLowerCase() === u) && 
      text_(r.password) === String(password) && 
      /^(فعال|active)$/i.test(text_(r.status)) &&
      /supervisor|سرپرست/i.test(text_(r.operations))
    );
    if (!found) throw new Error('نام کاربری یا رمز عبور اشتباه است، یا حساب غیرفعال است.');
    
    const token = Utilities.getUuid();
    const session = {
      token: token, role: 'Supervisor', panel: 'supervisor',
      empId: text_(found.workerId), workerId: text_(found.workerId), username: text_(found.username),
      name: [text_(found.firstName), text_(found.lastName)].filter(Boolean).join(' '),
      branchId: text_(found.branchId), groupId: text_(found.groupId),
      avatar: text_(found.photo)
    };
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    scLog_(session, 'ورود به پنل', 'سوپروایزر', 'success');
    return { success: true, token: token, user: { 
      name: session.name, workerId: session.workerId, username: session.username,
      branchId: session.branchId, groupId: session.groupId, avatar: session.avatar 
    }};
  } catch (err) { throw new Error('خطای ورود: ' + err.message); }
}

function supervisorLogout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty('session_' + token); } catch (e) {}
  return { success: true };
}

function checkSupervisorAuth(token) {
  if (!token) throw new Error('لطفاً ابتدا وارد شوید');
  const raw = PropertiesService.getScriptProperties().getProperty('session_' + token);
  if (!raw) throw new Error('نشست منقضی شده است.');
  let s; 
  try { s = JSON.parse(raw); } catch (e) { throw new Error('خطا در خواندن نشست.'); }
  if (s.role !== 'Supervisor') throw new Error('دسترسی غیرمجاز.');
  if (!s.workerId) throw new Error('شناسه سوپروایزر تعریف نشده است.');
  return s;
}

// ==================== توابع کمکی و کنترل محدوده ====================
function supervisorMyGroups_(session) {
  return scRead_('groups').filter(g => {
    const isMine = text_(g.supervisorName) === session.username || text_(g.workerId) === session.workerId;
    const sameBranch = !!text_(session.branchId) && text_(g.branchId) === text_(session.branchId);
    return isMine && sameBranch;
  });
}
function supervisorGroupIds_(session) { return supervisorMyGroups_(session).map(g => text_(g.groupId)); }
function supervisorAssertGroup_(session, groupId) {
  if (!supervisorGroupIds_(session).includes(String(groupId || ''))) throw new Error('دسترسی به این گروه مجاز نیست.');
}
function supervisorMemberRow_(session, rowIndex) {
  const row = scRead_('groupMembers').find(m => Number(m._rowIndex) === Number(rowIndex));
  if (!row || !supervisorGroupIds_(session).includes(text_(row.groupId))) throw new Error('عضویت موردنظر یافت نشد یا خارج از محدوده شماست.');
  return row;
}
function supervisorCardsForSession_(session) {
  const groups = supervisorMyGroups_(session), groupIds = groups.map(g => text_(g.groupId));
  const members = scRead_('groupMembers').filter(m => groupIds.includes(text_(m.groupId)));
  const usernames = members.map(m => text_(m.username));
  const workers = scRead_('workers').filter(w => usernames.includes(text_(w.username)) &&
    (!text_(session.branchId) || text_(w.branchId) === text_(session.branchId)));
  const workerIds = workers.map(w => text_(w.workerId));
  const cards = scRead_('cards').filter(c => workerIds.includes(text_(c.workerId)) || (text_(c.branchId) === session.branchId && !text_(c.workerId)));
  return {groups:groups,members:members,workers:workers,cards:cards,workerIds:workerIds};
}
function supervisorAssertCard_(session, card) {
  const data = supervisorCardsForSession_(session);
  if (!data.cards.some(c => text_(c.cardId) === text_(card.cardId))) throw new Error('کارت خارج از محدوده گروه‌های شماست.');
  return data;
}
function supervisorDateKey_(v) {
  const s = text_(v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9]/g, '');
  return s ? Number(s) : 0;
}
function supervisorStatusList_() {
  const rows = scRead_('statusRoles');
  const seen = {};
  rows.forEach(r => { 
    const s = text_(r.cardStatus); // خواندن از ستون Card-status
    if (s) seen[s] = true; 
  });
  return Object.keys(seen);
}


// ==================== گروه‌های تحت مدیریت ====================
function getSupervisorGroups(token) {
  const session = checkSupervisorAuth(token);
  const allGroups = supervisorMyGroups_(session);
  return allGroups.map(g => ({
    rowIndex: g._rowIndex, groupId: text_(g.groupId), name: text_(g.name),
    branchId: text_(g.branchId), area: text_(g.area),
    totalMembers: scRead_('groupMembers').filter(m => text_(m.groupId) === text_(g.groupId)).length, groupType: text_(g.groupType),
    status: text_(g.status), description: text_(g.description)
  }));
}

// ==================== اعضای گروه ====================
function getGroupMembers(groupId, token) {
  const session = checkSupervisorAuth(token); supervisorAssertGroup_(session, groupId);
  const members = scRead_('groupMembers').filter(m => text_(m.groupId) === String(groupId));
  const workers = scRead_('workers').filter(w => /^(فعال|active)$/i.test(text_(w.status)) &&
    (!text_(session.branchId) || text_(w.branchId) === text_(session.branchId)));
  return members.map(m => {
    const w = workers.find(x => text_(x.username) === text_(m.username));
    return { rowIndex:m._rowIndex, groupId:text_(m.groupId), username:text_(m.username), role:text_(m.role),
      status:text_(m.status), joinDate:scDispDate_(m.joinDate), workerId:w?text_(w.workerId):'',
      fullName:w?[text_(w.firstName),text_(w.lastName)].filter(Boolean).join(' '):text_(m.username),
      phone:w?text_(w.contact):'', operations:w?text_(w.operations):'' };
  });
}

function addGroupMember(groupId, workerId, role, token) {
  const session = checkSupervisorAuth(token); supervisorAssertGroup_(session, groupId);
  const id = text_(workerId); if (!id) throw new Error('شناسه یکتا الزامی است.');
  const group = supervisorMyGroups_(session).find(g => text_(g.groupId) === String(groupId));
  if (!group) throw new Error('گروه یافت نشد.');
  if (!['operator','worker'].includes(String(role))) throw new Error('نقش عضو معتبر نیست.');
  const worker = scRead_('workers').find(w => text_(w.workerId) === id);
  if (!worker) throw new Error('شناسه یکتا در شیت Workers یافت نشد.');
  if (!/^(فعال|active)$/i.test(text_(worker.status))) throw new Error('عضو انتخاب‌شده غیرفعال است.');
  if (text_(group.branchId) && text_(worker.branchId) !== text_(group.branchId)) throw new Error('عضو انتخاب‌شده متعلق به شعبه این گروه نیست.');
  if (!/^(operator|worker)$/i.test(text_(worker.operations))) throw new Error('این کاربر در Workers نقش operator یا worker ندارد.');
  const username = text_(worker.username); if (!username) throw new Error('برای این عضو نام کاربری ثبت نشده است.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const existing = scRead_('groupMembers').find(m => text_(m.groupId) === String(groupId) && text_(m.username) === username);
    if (existing) throw new Error('این کاربر قبلاً عضو گروه است.');
    scAppend_('groupMembers', {groupId:String(groupId),username:username,workerId: id,role:role,joinDate:scStoreDate_(jalaliToday_()),status:'فعال'});
    scLog_(session,'افزودن عضو به گروه',String(groupId)+' ← '+id,'success');
    return {success:true,workerId:id,fullName:[text_(worker.firstName),text_(worker.lastName)].filter(Boolean).join(' ')};
  } finally { lock.releaseLock(); }
}

function removeGroupMember(rowIndex, token) {
  const session = checkSupervisorAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    supervisorMemberRow_(session, rowIndex);
    scDelete_('groupMembers', [rowIndex]);
    scLog_(session, 'حذف عضو از گروه', 'Row: ' + rowIndex, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function toggleMemberStatus(rowIndex, newStatus, token) {
  const session = checkSupervisorAuth(token);
  const allowed = supervisorStatusList_();
  if (!allowed.includes(String(newStatus))) throw new Error('وضعیت انتخاب‌شده در status_Roles تعریف نشده است.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    supervisorMemberRow_(session, rowIndex);
    scUpdate_('groupMembers', rowIndex, { status: newStatus });
    scLog_(session, 'تغییر وضعیت عضو', 'Row: ' + rowIndex + ' → ' + newStatus, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ==================== استخر سفارشات گروه‌ ====================

function getSupervisorOrders(token) {
  const session = checkSupervisorAuth(token);
  
  // ۱. پیدا کردن تمام گروه‌هایی که این سوپروایزر مدیر آن‌هاست
  const myGroups = scRead_('groups').filter(g => 
    text_(g.supervisorName) === session.username || text_(g.workerId) === session.workerId
  );
  const myGroupIds = myGroups.map(g => text_(g.groupId));
  
  // ۲. فیلتر کردن سفارشات: فقط آن‌هایی که groupId آن‌ها در لیست گروه‌های من است
  let rows = scRead_('orders').filter(r => myGroupIds.includes(text_(r.groupId)));
  
  // اختیاری: اگر می‌خواهید سوپروایزر فقط سفارشات "جدید" (تبدیل نشده به کارت) را ببیند، خط زیر را از کامنت خارج کنید:
  // rows = rows.filter(r => text_(r.status) === 'جدید');

  return rows.map(r => {
    const groupName = myGroups.find(g => text_(g.groupId) === text_(r.groupId)) ? text_(myGroups.find(g => text_(g.groupId) === text_(r.groupId)).name) : 'نامشخص';
    
    return {
      rowIndex: r._rowIndex, 
      requestId: text_(r.requestId),
      date: scDispDateTime_(r.createdAt), 
      customer: text_(r.firstName) + ' ' + text_(r.lastName),
      phone: text_(r.contact), 
      service: text_(r.service), 
      status: text_(r.status),
      finalPrice: number_(r.finalPrice), 
      execDate: scDispDate_(r.execDate),
      // فیلدهای جدید برای سوپروایزر
      groupId: text_(r.groupId),
      groupName: groupName,
      operatorId: text_(r.operator)
    };
  }).reverse();
}
// ==================== کارت‌های گروه ====================
function getSupervisorCards(filters, token) {
  const session = checkSupervisorAuth(token);
  const scoped = supervisorCardsForSession_(session), workers = scoped.workers;
  let cards = scoped.cards;
  const f = filters || {};
  if (f.status && f.status !== 'همه') cards = cards.filter(r => text_(r.status) === f.status);
  if (f.search) {
    const q = f.search.toLowerCase();
    cards = cards.filter(r => text_(r.customerName).toLowerCase().includes(q) || text_(r.cardId).toLowerCase().includes(q));
  }
  
  return cards.map(c => ({
    rowIndex: c._rowIndex, cardId: text_(c.cardId), requestId: text_(c.requestId),
    customer: text_(c.customerName), details: text_(c.details),
    amount: number_(c.total), executeDateTime: scDispDate_(c.execDate) + (text_(c.execTime) ? ' ' + scDispTime_(c.execTime) : ''),
    workerId: text_(c.workerId), workerName: workers.find(w => text_(w.workerId) === text_(c.workerId)) ? 
      [text_(workers.find(w => text_(w.workerId) === text_(c.workerId)).firstName), text_(workers.find(w => text_(w.workerId) === text_(c.workerId)).lastName)].filter(Boolean).join(' ') : '—',
    status: text_(c.status), branchId: text_(c.branchId)
  })).reverse();
}

function getSupervisorWorkersForDropdown(token) {
  const session = checkSupervisorAuth(token);
  const myGroups = supervisorMyGroups_(session);
  const groupIds = myGroups.map(g => text_(g.groupId));
  const members = scRead_('groupMembers').filter(m => groupIds.includes(text_(m.groupId)) && /^(فعال|active)$/i.test(text_(m.status)));
  const workers = scRead_('workers').filter(w => /^(فعال|active)$/i.test(text_(w.status)));
  return members.map(m => {
    const w = workers.find(x => text_(x.username) === text_(m.username));
    return {
      id: w ? text_(w.workerId) : '',
      username: text_(m.username),
      name: w ? [text_(w.firstName), text_(w.lastName)].filter(Boolean).join(' ') : text_(m.username),
      operations: w ? text_(w.operations) : ''
    };
  }).filter(w => w.id);
}

function assignCardToWorker(cardId, workerId, token) {
  const session = checkSupervisorAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const cards = scRead_('cards');
    const card = cards.find(c => text_(c.cardId) === cardId);
    if (!card) throw new Error('کارت یافت نشد.');
    const scope = supervisorAssertCard_(session, card);
    if (workerId && !scope.members.some(m => /^(فعال|active)$/i.test(text_(m.status)) && scope.workers.some(w => text_(w.workerId) === String(workerId) && text_(w.username) === text_(m.username)))) throw new Error('اجراکننده انتخاب‌شده عضو فعال گروه‌های شما نیست.');
    
    const oldWorker = text_(card.workerId);
    const payload = { workerId: workerId, updatedAt: new Date() };
    if (!workerId) payload.status = 'جدید'; // بازگشت به استخر
    
    scUpdate_('cards', card._rowIndex, payload);

        // ===== اعلان بله: تخصیص کارت به کارگر =====
    try {
      if (workerId) {
        notifyWorkerCardAssigned(workerId, {
          cardId: cardId,
          requestId: text_(card.requestId),
          customerName: text_(card.customerName),
          service: text_(card.serviceType),
          amount: number_(card.total),
          execDate: scDispDate_(card.execDate),
          execTime: scDispTime_(card.execTime)
        });
      }
    } catch (e) {
      console.error('Bale notification error (card assign):', e.message);
    }
    
    scAppend_('cardHistory', { 
      cardId: cardId, from: oldWorker || 'استخر', to: workerId || 'استخر', 
      userId: session.username, date: new Date(), 
      desc: 'تخصیص توسط سوپروایزر' + (workerId ? ' به ' + workerId : '')
    });
    scLog_(session, 'تخصیص کارت', cardId + ' → ' + (workerId || 'استخر'), 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

function updateSupervisorCardStatus(cardId, newStatus, token) {
  const session = checkSupervisorAuth(token);
  const allowed = supervisorStatusList_();
  if (!allowed.includes(String(newStatus))) throw new Error('وضعیت انتخاب‌شده در status_Roles تعریف نشده است.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const cards = scRead_('cards');
    const card = cards.find(c => text_(c.cardId) === cardId);
    if (!card) throw new Error('کارت یافت نشد.');
    supervisorAssertCard_(session, card);
    const old = text_(card.status);
    // حذف بررسی adm_checkTransition_
    scUpdate_('cards', card._rowIndex, { status: newStatus, updatedAt: new Date() });
    scAppend_('cardHistory', { cardId: cardId, from: old, to: newStatus, userId: session.username, date: new Date(), desc: 'تغییر وضعیت توسط سوپروایزر' });
    scLog_(session, 'تغییر وضعیت کارت', cardId + ': ' + old + ' → ' + newStatus, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ==================== ویرایش درخواست و فاکتور ====================
function getSupervisorOrderInvoice(requestId, token) {
  const session = checkSupervisorAuth(token);
  const linkedCard = scRead_('cards').find(c => text_(c.requestId) === String(requestId));
  if (!linkedCard) throw new Error('کارت مرتبط با این درخواست یافت نشد.');
  supervisorAssertCard_(session, linkedCard);
  const r = scRead_('orders').find(x => text_(x.requestId) === requestId);
  if (!r) throw new Error('سفارش یافت نشد');
  return {
    requestId: text_(r.requestId), date: scDispDateTime_(r.createdAt),
    customer: [text_(r.firstName), text_(r.lastName)].filter(Boolean).join(' '),
    phone: text_(r.contact), service: text_(r.service), qty: number_(r.qty),
    executeDate: scDispDate_(r.execDate), executeTime: scDispTime_(r.execTime),
    address: text_(r.addrFrom) || text_(r.addrTo), sideServices: text_(r.sideServices), notes: text_(r.notes),
    basePrice: number_(r.basePrice), discount: number_(r.discount), tax: number_(r.tax), finalPrice: number_(r.finalPrice),
    status: text_(r.status), actionType: text_(r.actionType), operator: text_(r.operator)
  };
}

function updateSupervisorOrder(rowIndex, updates, token) {
  const session = checkSupervisorAuth(token);
  const order = scRead_('orders').find(r => Number(r._rowIndex) === Number(rowIndex));
  if (!order) throw new Error('سفارش یافت نشد.');
  const card = scRead_('cards').find(c => text_(c.requestId) === text_(order.requestId));
  if (!card) throw new Error('کارت مرتبط با سفارش یافت نشد.');
  supervisorAssertCard_(session, card);
  throw new Error('ویرایش مستقیم سفارش از پنل سوپروایزر در این نسخه غیرفعال است؛ از گردش کارت استفاده کنید.');
}

// ==================== کارت‌های مرجوعی ====================
function getSupervisorReturnedCards(token) {
  const session = checkSupervisorAuth(token), scoped = supervisorCardsForSession_(session);
  const workers = scoped.workers;
  return scoped.cards.filter(c => text_(c.status) === 'ارجاع به سرپرست').map(c => ({
    rowIndex:c._rowIndex, cardId:text_(c.cardId), requestId:text_(c.requestId), customer:text_(c.customerName),
    details:text_(c.details), workerId:text_(c.workerId), status:text_(c.status), updatedAt:scDispDateTime_(c.updatedAt)
  })).reverse();
}

// ==================== گزارشات ====================
function getSupervisorReports(token, fromDate, toDate) {
  const session = checkSupervisorAuth(token);
  const scoped = supervisorCardsForSession_(session), workers = scoped.workers;
  let cards = scoped.cards.filter(c => !!text_(c.workerId));
  if (fromDate) cards = cards.filter(r => supervisorDateKey_(scDispDate_(r.createdAt)) >= supervisorDateKey_(fromDate));
  if (toDate) cards = cards.filter(r => supervisorDateKey_(scDispDate_(r.createdAt)) <= supervisorDateKey_(toDate));
  
  const byWorker = {};
  cards.forEach(c => {
    const w = workers.find(x => text_(x.workerId) === text_(c.workerId));
    const name = w ? [text_(w.firstName), text_(w.lastName)].filter(Boolean).join(' ') : text_(c.workerId);
    byWorker[name] = byWorker[name] || { total: 0, completed: 0, revenue: 0 };
    byWorker[name].total++;
    if (/تکمیل|completed/i.test(text_(c.status))) byWorker[name].completed++;
    byWorker[name].revenue += number_(c.total);
  });
  
  return {
    totalCards: cards.length,
    completedCards: cards.filter(c => /تکمیل|completed/i.test(text_(c.status))).length,
    inProgressCards: cards.filter(c => /در حال|progress/i.test(text_(c.status))).length,
    totalRevenue: cards.reduce((s, c) => s + number_(c.total), 0),
    byWorker: Object.entries(byWorker).map(([name, v]) => ({ name: name, ...v })),
    transactions: cards.map(c => ({
      date: scDispDateTime_(c.createdAt), cardId: text_(c.cardId),
      customer: text_(c.customerName), amount: number_(c.total), status: text_(c.status)
    })).reverse()
  };
}

// ==================== پروفایل ====================
function getSupervisorProfile(token) {
  const session = checkSupervisorAuth(token);
  const worker = scRead_('workers').find(r => text_(r.workerId) === session.workerId);
  const branch = scRead_('branches').find(r => text_(r.branchId) === session.branchId);
  return {
    workerId: session.workerId, name: session.name, username: session.username,
    role: 'سوپروایزر', branchId: session.branchId, branchName: branch ? text_(branch.name) : '',
    groupId: session.groupId, avatar: session.avatar, description: worker ? text_(worker.description) : ''
  };
}

function updateSupervisorProfile(updates, token) {
  const session = checkSupervisorAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const rows = scRead_('workers');
    const row = rows.find(r => text_(r.workerId) === session.workerId);
    if (!row) throw new Error('رکورد کاربر یافت نشد.');
    const payload = {};
    if (updates.username) payload.username = updates.username;
    if (updates.password) payload.password = updates.password;
    if (updates.avatar !== undefined) payload.photo = updates.avatar;
    if (updates.description !== undefined) payload.description = updates.description;
    scUpdate_('workers', row._rowIndex, payload);
    if (updates.username) session.username = updates.username;
    if (updates.avatar !== undefined) session.avatar = updates.avatar;
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ==================== APIهای تکمیلی پنل سوپروایزر ====================
function getSupervisorBrandSettings(token) {
  checkSupervisorAuth(token);
  let logoUrl = '';
  try { logoUrl = text_(getSetting_('LOGO_URL', '')); } catch (e) {}
  if (!logoUrl) {
    const row = scRead_('settings').find(r => /^(LOGO_URL|لوگو)$/i.test(text_(r.key)));
    if (row) logoUrl = text_(row.value);
  }
  return { logoUrl: logoUrl };
}
function getSupervisorWorkerById(workerId, token) {
  const session = checkSupervisorAuth(token); supervisorGroupIds_(session);
  const w = scRead_('workers').find(r => text_(r.workerId) === text_(workerId));
  if (!w || (text_(session.branchId) && text_(w.branchId) !== text_(session.branchId))) return null;
  if (!/^(operator|worker)$/i.test(text_(w.operations))) return null;
  return {workerId:text_(w.workerId),username:text_(w.username),fullName:[text_(w.firstName),text_(w.lastName)].filter(Boolean).join(' '),operations:text_(w.operations),status:text_(w.status)};
}
function getSupervisorMemberStatuses(token) { checkSupervisorAuth(token); return supervisorStatusList_(); }
function getSupervisorCardStatuses(token) { 
  checkSupervisorAuth(token); 
  return supervisorStatusList_(); 
}
function getSupervisorDashboard(token) {
  const session = checkSupervisorAuth(token), d = supervisorCardsForSession_(session);
  const activeMembers = d.members.filter(m => /^(فعال|active)$/i.test(text_(m.status))).length;
  const busyIds = {};
  d.cards.forEach(c => { if (text_(c.workerId) && /در حال|اجرا|progress/i.test(text_(c.status))) busyIds[text_(c.workerId)] = true; });
  const statuses = d.cards.map(c => text_(c.status));
  const count = re => statuses.filter(s => re.test(s)).length;
  return {
    groups:d.groups.length, activeMembers:activeMembers, busyMembers:Object.keys(busyIds).length,
    newCards:count(/جدید|new/i), inProgressCards:count(/در حال|اجرا|progress/i),
    completedCards:count(/تکمیل|completed/i), cancelledCards:count(/لغو|cancel/i),
    groupRows:d.groups.map(g=>({groupId:text_(g.groupId),name:text_(g.name),area:text_(g.area),status:text_(g.status),members:d.members.filter(m=>text_(m.groupId)===text_(g.groupId)).length}))
  };
}
function submitSupervisorRecord(payload, token) {
  const session = checkSupervisorAuth(token), p = payload || {};
  const allowed = ['performance','misconduct','damage','branch_request','technical_issue'];
  if (!allowed.includes(String(p.type))) throw new Error('نوع گزارش معتبر نیست.');
  if (p.groupId) supervisorAssertGroup_(session,p.groupId);
  if (p.workerId) {
    const target = scRead_('workers').find(w => text_(w.workerId) === text_(p.workerId));
    if (!target || (text_(p.groupId) && !scRead_('groupMembers').some(m => text_(m.groupId) === text_(p.groupId) && text_(m.username) === text_(target.username)))) throw new Error('عضو گزارش خارج از گروه انتخاب‌شده است.');
  }
  if (p.cardId) { const card = scRead_('cards').find(c => text_(c.cardId) === text_(p.cardId)); if (!card) throw new Error('کارت موردنظر یافت نشد.'); supervisorAssertCard_(session,card); }
  if (!text_(p.title) || !text_(p.details)) throw new Error('عنوان و شرح گزارش الزامی است.');
  const labels = {performance:'گزارش عملکرد عضو',misconduct:'گزارش تخلف عضو',damage:'گزارش خسارت',branch_request:'درخواست بررسی شعبه',technical_issue:'مشکل فنی پنل'};
  const record = {type:p.type,groupId:text_(p.groupId),branchId:session.branchId,workerId:text_(p.workerId),cardId:text_(p.cardId),title:text_(p.title),details:text_(p.details),amount:number_(p.amount),submittedAt:new Date().toISOString()};
  scLog_(session,labels[p.type],JSON.stringify(record),'success');
  return {success:true,message:'گزارش در سابقه رویدادهای سیستم ثبت شد.'};
}
function getMySupervisorSubmissions(token) {
  const session = checkSupervisorAuth(token), labels = ['گزارش عملکرد عضو','گزارش تخلف عضو','گزارش خسارت','درخواست بررسی شعبه','مشکل فنی پنل'];
  return scRead_('logs').filter(r => text_(r.empId) === session.workerId && labels.includes(text_(r.action))).map(r=>{
    let p={};try{p=JSON.parse(text_(r.details));}catch(e){}
    return {date:scDispDateTime_(r.date),type:labels[labels.indexOf(text_(r.action))],title:text_(p.title)||text_(r.details),result:text_(r.result)};
  }).reverse();
}

function updateSupervisorGroup(groupId, updates, token) {
  const session = checkSupervisorAuth(token); supervisorAssertGroup_(session, groupId);
  const p = updates || {}; if (!text_(p.name)) throw new Error('نام گروه الزامی است.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const row = scRead_('groups').find(g => text_(g.groupId) === String(groupId));
    if (!row) throw new Error('گروه یافت نشد.');
    scUpdate_('groups', row._rowIndex, {name:text_(p.name),area:text_(p.area),groupType:text_(p.groupType),description:text_(p.description)});
    scLog_(session, 'ویرایش اطلاعات گروه', String(groupId), 'success');
    return {success:true};
  } finally { lock.releaseLock(); }
}


// ==================== تبدیل سفارش به کارت توسط سوپروایزر ====================
function supervisorConvertOrderToCard(requestId, workerId, token) {
  const session = checkSupervisorAuth(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // قفل برای جلوگیری از تکرار همزمان
  
  try {
    // ۱. یافتن سفارش
    const orders = scRead_('orders');
    const order = orders.find(r => text_(r.requestId) === text_(requestId));
    if (!order) throw new Error('سفارش مورد نظر یافت نشد.');
    
    // ۲. بررسی دسترسی: آیا این سفارش متعلق به گروه‌های این سوپروایزر است؟
    const myGroups = supervisorMyGroups_(session);
    const myGroupIds = myGroups.map(g => text_(g.groupId));
    if (!myGroupIds.includes(text_(order.groupId))) {
      throw new Error('شما مجاز به تبدیل این سفارش نیستید (خارج از محدوده گروه‌های شماست).');
    }
    
    // ۳. بررسی نیروی انتخابی (اگر انتخاب شده باشد)
    if (workerId) {
      const isWorkerInGroup = scRead_('groupMembers').some(m => 
        myGroupIds.includes(text_(m.groupId)) && text_(m.workerId) === text_(workerId)
      );
      if (!isWorkerInGroup) {
        throw new Error('نیروی انتخاب شده متعلق به گروه‌های تحت مدیریت شما نیست.');
      }
    }
    
    // ۴. تولید شناسه یکتا برای کارت
    const newCardId = 'CRD-' + Date.now().toString(36).toUpperCase();
    
    // ۵. آماده‌سازی داده‌های کارت بر اساس اطلاعات سفارش
    const cardData = {
      cardId: newCardId,
      requestId: text_(order.requestId),
      customerId: text_(order.customerId),
      branchId: text_(order.branchId),
      workerId: text_(workerId) || '', // اگر خالی باشد، در استخر گروه می‌ماند
      customerName: [text_(order.firstName), text_(order.lastName)].filter(Boolean).join(' '),
      serviceType: text_(order.service),
      total: number_(order.finalPrice),
      execDate: text_(order.execDate),
      execTime: text_(order.execTime),
      address: text_(order.addrFrom),
      status: 'جدید',
      createdAt: new Date()
    };
    
    // ۶. ثبت کارت جدید در شیت Cards
    scAppend_('cards', cardData);
    
    // ۷. به‌روزرسانی وضعیت سفارش اصلی
    scUpdate_('orders', order._rowIndex, { status: 'تبدیل به کارت' });
    
    // ۸. ارسال اعلان بله به نیروی تخصیص‌یافته (اختیاری اما توصیه‌شده)
    if (workerId) {
      try {
        const workers = scRead_('workers');
        const worker = workers.find(w => text_(w.workerId) === text_(workerId));
        if (worker && text_(worker.contact)) {
          notifyWorkerCardAssigned(text_(worker.contact), {
            cardId: newCardId,
            requestId: text_(order.requestId),
            customerName: cardData.customerName,
            service: text_(order.service),
            amount: number_(order.finalPrice),
            execDate: scDispDate_(text_(order.execDate)),
            execTime: scDispTime_(text_(order.execTime))
          });
        }
      } catch (e) {
        console.error('Bale notification error in supervisorConvert:', e.message);
        // خطای اعلان نباید فرآیند اصلی ساخت کارت را متوقف کند
      }
    }
    
    scLog_(session, 'تبدیل سفارش به کارت', 'Request: ' + requestId + ' -> Card: ' + newCardId, 'success');
    return { success: true, message: 'کارت با موفقیت ایجاد و ثبت شد.', cardId: newCardId };
    
  } catch (err) {
    throw new Error('خطا در تبدیل سفارش: ' + err.message);
  } finally {
    lock.releaseLock();
  }
}

/* ==================== ZV-WORKER-001: پیام‌رسانی موجود ==================== */
/**
 * ZingoVingo — ZV-WORKER-001 Messaging Backend
 * Requires existing checkWorkerAuth(), checkSupervisorAuth(), scRead_(), getSpreadsheet_().
 * Sheet headers are validated exactly before reads/writes.
 */
const ZV_MSG = {
  THREADS:'ConversationThreads', MESSAGES:'ConversationMessages',
  TH:['Thread-ID','Card-ID','Worker-ID','WorkerUsername','Supervisor-ID','SupervisorUsername','Group-ID','Branch-ID','Subject','Status','LastMessageAt','LastMessageBy','CreatedAt','UpdatedAt'],
  MS:['Message-ID','Thread-ID','SenderRole','Sender-ID','SenderUsername','Body','CreatedAt','ReadAt','ReadBy','MessageType','RelatedCard-ID'],
  MAX:4000
};
function zvmt_(v){return v==null?'':String(v).trim();}
function zvmSheet_(name,headers){
  const sh=getSpreadsheet_().getSheetByName(name);
  if(!sh)throw new Error('شیت '+name+' پیدا نشد.');
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim());
  if(JSON.stringify(h)!==JSON.stringify(headers))throw new Error('هدر یا ترتیب ستون‌های '+name+' متفاوت است؛ عملیات متوقف شد.');
  return sh;
}
function zvmRows_(sh){
  if(sh.getLastRow()<2)return [];
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim());
  return sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues().map((r,i)=>{const o={_rowIndex:i+2};h.forEach((k,j)=>o[k]=r[j]);return o;});
}
function zvmAppend_(sh,h,o){sh.appendRow(h.map(k=>o[k]==null?'':o[k]));}
function zvmSet_(sh,h,row,o){Object.keys(o).forEach(k=>sh.getRange(row,h.indexOf(k)+1).setValue(o[k]));}
function zvmId_(p){return p+'.'+Utilities.getUuid().replace(/-/g,'').slice(0,20).toUpperCase();}
function zvmWorker_(token){
  const s=checkWorkerAuth(token), w=scRead_('workers').find(x=>zvmt_(x.workerId)===zvmt_(s.workerId));
  if(!w)throw new Error('متخصص پیدا نشد.');
  const gid=zvmt_(w.groupId||s.groupId), g=scRead_('groups').find(x=>zvmt_(x.groupId)===gid);
  if(!g)throw new Error('گروه متخصص پیدا نشد.');
  const su=zvmt_(g.supervisorName);
  const sup=scRead_('workers').find(x=>(zvmt_(x.username)===su||zvmt_(x.workerId)===zvmt_(g.workerId))&&/supervisor|سرپرست/i.test(zvmt_(x.operations)));
  if(!sup)throw new Error('سرپرست گروه پیدا نشد.');
  return {s,w,g,sup,gid};
}
function zvmSupervisor_(token){
  const s=checkSupervisorAuth(token);
  const gs=scRead_('groups').filter(g=>zvmt_(g.supervisorName)===zvmt_(s.username)||zvmt_(g.workerId)===zvmt_(s.workerId));
  if(!gs.length)throw new Error('گروهی تحت مدیریت شما وجود ندارد.');
  return {s,gs,gids:gs.map(g=>zvmt_(g.groupId))};
}
function zvmParticipant_(t,c,role){
  if(!t)throw new Error('مکاتبه پیدا نشد.');
  if(role==='worker'&&zvmt_(t['Worker-ID'])!==zvmt_(c.s.workerId))throw new Error('دسترسی غیرمجاز.');
  if(role==='supervisor'&&(c.gids.indexOf(zvmt_(t['Group-ID']))<0||zvmt_(t['Supervisor-ID'])!==zvmt_(c.s.workerId)))throw new Error('این مکاتبه متعلق به گروه شما نیست.');
}
function zvmNewMessage_(threadId,role,s,body,cardId){
  const ms=zvmSheet_(ZV_MSG.MESSAGES,ZV_MSG.MS), now=new Date();
  zvmAppend_(ms,ZV_MSG.MS,{'Message-ID':zvmId_('MSG'),'Thread-ID':threadId,SenderRole:role,'Sender-ID':zvmt_(s.workerId),SenderUsername:zvmt_(s.username),Body:body,CreatedAt:now,ReadAt:'',ReadBy:'',MessageType:'TEXT','RelatedCard-ID':cardId});
  return now;
}
function workerCreateConversation(cardId,subject,body,token){
  const c=zvmWorker_(token), card=scRead_('cards').find(x=>zvmt_(x.cardId)===zvmt_(cardId)), b=zvmt_(body);
  if(!card||zvmt_(card.workerId)!==zvmt_(c.s.workerId))throw new Error('کارت متعلق به شما نیست.');
  if(!b||b.length>ZV_MSG.MAX)throw new Error('متن پیام باید بین ۱ تا ۴۰۰۰ کاراکتر باشد.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const ts=zvmSheet_(ZV_MSG.THREADS,ZV_MSG.TH), ms=zvmSheet_(ZV_MSG.MESSAGES,ZV_MSG.MS), now=new Date(), id=zvmId_('THR');
    zvmAppend_(ts,ZV_MSG.TH,{'Thread-ID':id,'Card-ID':zvmt_(card.cardId),'Worker-ID':zvmt_(c.w.workerId),WorkerUsername:zvmt_(c.w.username),'Supervisor-ID':zvmt_(c.sup.workerId),SupervisorUsername:zvmt_(c.sup.username),'Group-ID':c.gid,'Branch-ID':zvmt_(card.branchId||c.w.branchId),Subject:zvmt_(subject).slice(0,160)||('پیگیری کارت '+cardId),Status:'OPEN',LastMessageAt:now,LastMessageBy:zvmt_(c.s.username),CreatedAt:now,UpdatedAt:now});
    zvmNewMessage_(id,'worker',c.s,b,zvmt_(card.cardId));return {success:true,threadId:id};
  }finally{lock.releaseLock();}
}
function zvmReply_(threadId,body,token,role){
  const c=role==='worker'?zvmWorker_(token):zvmSupervisor_(token), b=zvmt_(body);
  if(!b||b.length>ZV_MSG.MAX)throw new Error('متن پیام باید بین ۱ تا ۴۰۰۰ کاراکتر باشد.');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const ts=zvmSheet_(ZV_MSG.THREADS,ZV_MSG.TH), t=zvmRows_(ts).find(x=>zvmt_(x['Thread-ID'])===zvmt_(threadId));
    zvmParticipant_(t,c,role);if(zvmt_(t.Status)==='CLOSED')throw new Error('مکاتبه بسته است.');
    const now=zvmNewMessage_(threadId,role,c.s,b,zvmt_(t['Card-ID']));
    zvmSet_(ts,ZV_MSG.TH,t._rowIndex,{LastMessageAt:now,LastMessageBy:zvmt_(c.s.username),UpdatedAt:now});return {success:true};
  }finally{lock.releaseLock();}
}
function workerReplyConversation(id,body,token){return zvmReply_(id,body,token,'worker');}
function supervisorCreateConversationReply(id,body,token){return zvmReply_(id,body,token,'supervisor');}
function zvmList_(token,role){
  const c=role==='worker'?zvmWorker_(token):zvmSupervisor_(token), ts=zvmSheet_(ZV_MSG.THREADS,ZV_MSG.TH), ms=zvmSheet_(ZV_MSG.MESSAGES,ZV_MSG.MS);
  const msgs=zvmRows_(ms), threads=zvmRows_(ts).filter(t=>role==='worker'?zvmt_(t['Worker-ID'])===zvmt_(c.s.workerId):(c.gids.includes(zvmt_(t['Group-ID']))&&zvmt_(t['Supervisor-ID'])===zvmt_(c.s.workerId)));
  return threads.map(t=>{const a=msgs.filter(m=>zvmt_(m['Thread-ID'])===zvmt_(t['Thread-ID'])), last=a[a.length-1];return {threadId:zvmt_(t['Thread-ID']),cardId:zvmt_(t['Card-ID']),subject:zvmt_(t.Subject),status:zvmt_(t.Status),workerUsername:zvmt_(t.WorkerUsername),supervisorUsername:zvmt_(t.SupervisorUsername),lastMessageAt:t.LastMessageAt,unreadCount:a.filter(m=>zvmt_(m['Sender-ID'])!==zvmt_(c.s.workerId)&&!m.ReadAt).length,preview:last?zvmt_(last.Body).slice(0,140):''};}).sort((a,b)=>new Date(b.lastMessageAt)-new Date(a.lastMessageAt));
}
function workerGetConversations(token){return zvmList_(token,'worker');}
function supervisorGetConversations(token){return zvmList_(token,'supervisor');}
function zvmGetThread_(id,token,role){
  const c=role==='worker'?zvmWorker_(token):zvmSupervisor_(token),ts=zvmSheet_(ZV_MSG.THREADS,ZV_MSG.TH),ms=zvmSheet_(ZV_MSG.MESSAGES,ZV_MSG.MS);
  const t=zvmRows_(ts).find(x=>zvmt_(x['Thread-ID'])===zvmt_(id));zvmParticipant_(t,c,role);
  const rows=zvmRows_(ms).filter(m=>zvmt_(m['Thread-ID'])===zvmt_(id)), now=new Date();
  rows.forEach(m=>{if(zvmt_(m['Sender-ID'])!==zvmt_(c.s.workerId)&&!m.ReadAt)zvmSet_(ms,ZV_MSG.MS,m._rowIndex,{ReadAt:now,ReadBy:zvmt_(c.s.username)});});
  return {thread:{threadId:zvmt_(t['Thread-ID']),cardId:zvmt_(t['Card-ID']),subject:zvmt_(t.Subject),status:zvmt_(t.Status)},messages:rows.map(m=>({messageId:zvmt_(m['Message-ID']),senderRole:zvmt_(m.SenderRole),senderId:zvmt_(m['Sender-ID']),senderUsername:zvmt_(m.SenderUsername),body:zvmt_(m.Body),createdAt:m.CreatedAt,readAt:m.ReadAt}))};
}
function workerGetConversation(id,token){return zvmGetThread_(id,token,'worker');}
function supervisorGetConversation(id,token){return zvmGetThread_(id,token,'supervisor');}
function supervisorSetConversationStatus(id,status,token){
  const c=zvmSupervisor_(token),s=zvmt_(status);if(!['OPEN','CLOSED'].includes(s))throw new Error('وضعیت نامعتبر است.');
  const sh=zvmSheet_(ZV_MSG.THREADS,ZV_MSG.TH),t=zvmRows_(sh).find(x=>zvmt_(x['Thread-ID'])===zvmt_(id));zvmParticipant_(t,c,'supervisor');
  zvmSet_(sh,ZV_MSG.TH,t._rowIndex,{Status:s,UpdatedAt:new Date()});return {success:true};
}
function workerGetUnreadConversationCount(token){return workerGetConversations(token).reduce((n,t)=>n+t.unreadCount,0);}
function supervisorGetUnreadConversationCount(token){return supervisorGetConversations(token).reduce((n,t)=>n+t.unreadCount,0);}
function zvMessagingDispatch_(action,args){
  const routes={workerCreateConversation,workerReplyConversation,workerGetConversations,workerGetConversation,workerGetUnreadConversationCount,supervisorCreateConversationReply,supervisorGetConversations,supervisorGetConversation,supervisorSetConversationStatus,supervisorGetUnreadConversationCount};
  if(!Object.prototype.hasOwnProperty.call(routes,action))return {handled:false};
  return {handled:true,result:routes[action].apply(null,args||[])};
}
