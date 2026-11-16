/**
* ZingoVingo — Worker (Specialist) Panel Backend
* کارگران در شیت Workers با Operations=worker ثبت شده
*/


function zvWorkerBranchName_(branchId) {
  const id = String(branchId || '').trim();
  if (!id) return '';
  try {
    const rows = scRead_('branches');
    const branch = rows.find(r => String(r.branchId || '').trim() === id);
    return branch ? String(branch.name || '').trim() : '';
  } catch (e) {
    console.warn('Branch name lookup failed:', e);
    return '';
  }
}

function workerLogin(username, password) {
  try {
    const u = String(username).trim().toLowerCase();
    const rows = scRead_('workers');
    const found = rows.find(r => 
      (text_(r.username).toLowerCase() === u || text_(r.email).toLowerCase() === u) && 
      text_(r.password) === String(password) && 
      /^(فعال|active)$/i.test(text_(r.status)) &&
      /worker|کارگر|متخصص/i.test(text_(r.operations))
    );
    if (!found) throw new Error('نام کاربری یا رمز عبور اشتباه است.');
    
    const token = Utilities.getUuid();
    const session = {
      token: token, role: 'worker', panel: 'worker',
      workerId: text_(found.workerId), username: text_(found.username),
      name: [text_(found.firstName), text_(found.lastName)].filter(Boolean).join(' '),
      branchId: text_(found.branchId), branchName: zvWorkerBranchName_(found.branchId), groupId: text_(found.groupId),
      avatar: text_(found.photo)
    };
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    return { success: true, token: token, user: { 
      name: session.name, workerId: session.workerId, username: session.username,
      branchId: session.branchId, branchName: session.branchName, avatar: session.avatar 
    }};
  } catch (err) { throw new Error('خطای ورود: ' + err.message); }
}

function workerLogout(token) {
  try { if (token) PropertiesService.getScriptProperties().deleteProperty('session_' + token); } catch (e) {}
  return { success: true };
}

function checkWorkerAuth(token) {
  if (!token) throw new Error('لطفاً ابتدا وارد شوید');
  const raw = PropertiesService.getScriptProperties().getProperty('session_' + token);
  if (!raw) throw new Error('نشست منقضی شده است.');
  let s; 
  try { s = JSON.parse(raw); } catch (e) { throw new Error('خطا در خواندن نشست.'); }
  if (s.role !== 'worker') throw new Error('دسترسی غیرمجاز.');
  return s;
}

// ==================== کارت‌های من ====================
function getWorkerCards(filters, token) {
  const session = checkWorkerAuth(token);
  let cards = scRead_('cards').filter(c => text_(c.workerId) === session.workerId);
  
  const f = filters || {};
  if (f.status && f.status !== 'همه') cards = cards.filter(r => text_(r.status) === f.status);
  
  return cards.map(c => ({
    rowIndex: c._rowIndex, cardId: text_(c.cardId), requestId: text_(c.requestId),
    customer: text_(c.customerName), details: text_(c.details),
    amount: number_(c.total), executeDateTime: scDispDate_(c.execDate) + (text_(c.execTime) ? ' ' + scDispTime_(c.execTime) : ''),
    status: text_(c.status), description: text_(c.description),
    updatedAt: scDispDateTime_(c.updatedAt)
  })).reverse();
}

// ==================== تغییر وضعیت کارت ====================
function updateWorkerCardStatus(cardId, newStatus, notes, token) {
  const session = checkWorkerAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const cards = scRead_('cards');
    const card = cards.find(c => text_(c.cardId) === cardId);
    if (!card) throw new Error('کارت یافت نشد.');
    if (text_(card.workerId) !== session.workerId) throw new Error('این کارت به شما تخصیص داده نشده است.');
    
    const old = text_(card.status);
    const payload = { status: newStatus, updatedAt: new Date() };
    if (notes) payload.description = (text_(card.description) ? text_(card.description) + '\n' : '') + notes;
    
    scUpdate_('cards', card._rowIndex, payload);
    scAppend_('cardHistory', { cardId: cardId, from: old, to: newStatus, userId: session.username, date: new Date(), desc: notes || 'تغییر وضعیت' });
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ==================== ارجاع به سرپرست ====================
function referCardToSupervisor(cardId, reason, token) {
  const session = checkWorkerAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const cards = scRead_('cards');
    const card = cards.find(c => text_(c.cardId) === cardId);
    if (!card) throw new Error('کارت یافت نشد.');
    
    const old = text_(card.status);
    scUpdate_('cards', card._rowIndex, { 
      status: 'ارجاع به سرپرست', updatedAt: new Date(),
      description: (text_(card.description) ? text_(card.description) + '\n' : '') + 'ارجاع: ' + reason
    });
        // ===== اعلان بله: ارجاع کارت به سرپرست =====
    try {
      // پیدا کردن سرپرست گروه کارگر
      const myGroups = scRead_('groups').filter(g => text_(g.workerId) === session.workerId);
      if (myGroups.length) {
        const supervisorUsername = text_(myGroups[0].supervisorName);
        if (supervisorUsername) {
          notifySupervisorCardReferred(supervisorUsername, {
            cardId: cardId,
            customerName: text_(card.customerName)
          }, reason);
        }
      }
    } catch (e) {
      console.error('Bale notification error (refer):', e.message);
    }
    scAppend_('cardHistory', { cardId: cardId, from: old, to: 'ارجاع به سرپرست', userId: session.username, date: new Date(), desc: 'ارجاع: ' + reason });
    scLog_(session, 'ارجاع کارت به سرپرست', cardId + ': ' + reason, 'success');
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ==================== گزارشات ====================
function getWorkerReports(token, fromDate, toDate) {
  const session = checkWorkerAuth(token);
  let cards = scRead_('cards').filter(c => text_(c.workerId) === session.workerId);
  
  if (fromDate) cards = cards.filter(r => adm_key_(scDispDate_(r.createdAt)) >= adm_key_(fromDate));
  if (toDate) cards = cards.filter(r => adm_key_(scDispDate_(r.createdAt)) <= adm_key_(toDate));
  
  const byStatus = {};
  cards.forEach(c => {
    const s = text_(c.status) || 'نامشخص';
    byStatus[s] = (byStatus[s] || 0) + 1;
  });
  
  return {
    totalCards: cards.length,
    completedCards: cards.filter(c => /تکمیل|completed/i.test(text_(c.status))).length,
    inProgressCards: cards.filter(c => /در حال|progress/i.test(text_(c.status))).length,
    totalRevenue: cards.reduce((s, c) => s + number_(c.total), 0),
    byStatus: byStatus,
    transactions: cards.map(c => ({
      date: scDispDateTime_(c.createdAt), cardId: text_(c.cardId),
      customer: text_(c.customerName), amount: number_(c.total), status: text_(c.status)
    })).reverse()
  };
}

// ==================== پروفایل ====================
function getWorkerProfile(token) {
  const session = checkWorkerAuth(token);
  return {
    workerId: session.workerId, name: session.name, username: session.username,
    role: 'متخصص', branchId: session.branchId, groupId: session.groupId, avatar: session.avatar
  };
}

function updateWorkerProfile(updates, token) {
  const session = checkWorkerAuth(token);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const rows = scRead_('workers');
    const row = rows.find(r => text_(r.workerId) === session.workerId);
    if (!row) throw new Error('رکورد کاربر یافت نشد.');
    const payload = {};
    if (updates.username) payload.username = updates.username;
    if (updates.password) payload.password = updates.password;
    if (updates.avatar) payload.photo = updates.avatar;
    scUpdate_('workers', row._rowIndex, payload);
    if (updates.username) session.username = updates.username;
    if (updates.avatar) session.avatar = updates.avatar;
    PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
    return { success: true };
  } finally { lock.releaseLock(); }
}
/** بارگذاری عکس پروفایل از ویرایشگر مشترک؛ دسترسی محدود به نشست همان کاربر */
function uploadWorkerProfilePhotoV2(dataUrl, token) {
  const session = checkWorkerAuth(token);
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('فرمت تصویر معتبر نیست.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('حجم تصویر بیش از ۸ مگابایت است.');
  const mime = match[1];
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  const folderIt = DriveApp.getFoldersByName('ZingoVingo_Profile_Photos');
  const folder = folderIt.hasNext() ? folderIt.next() : DriveApp.createFolder('ZingoVingo_Profile_Photos');
  const blob = Utilities.newBlob(bytes, mime, String(session.workerId || session.username) + '_profile.' + ext);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';
  const rows = scRead_('workers');
  const row = rows.find(r => text_(r.workerId) === text_(session.workerId));
  if (!row) throw new Error('رکورد کاربر یافت نشد.');
  scUpdate_('workers', row._rowIndex, { photo: url });
  session.avatar = url;
  PropertiesService.getScriptProperties().setProperty('session_' + token, JSON.stringify(session));
  return { success: true, url: url };
}
