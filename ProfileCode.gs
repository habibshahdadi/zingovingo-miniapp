/**
* ZingoVingo — Profile Photos (Drive upload) - FIXED VERSION
* - عکس با نام «شناسه_یوزرنیم» در پوشه نقش + یک کپی در پوشه مرکزی User Profiles
* - لینک قابل‌نمایش (thumbnail) در ستون Profile ذخیره می‌شود
*/

const PROFILE_FOLDER_IDS = {
  central:   '1wcCBzi-w9tNcN3qu7_YuSmw8AxHSotLU',   // User Profiles
  employees: '19vQ6MEKA6wHxFBlWZU2xu51rzc8WErr8',   // Employee Profiles
  workers:   '1PCCErxaXsgZkg7BecjxULV39UfOsKM2j',   // Workers Profiles
  customers: '1ckWp0d91C-qQehTKMrgklXcNdMaTJC7u'    // Customer Profiles
};

const PROFILE_ENTITY_SHEET = { 
  employees: 'Employees', 
  branchManagers: 'Branchs_managers', 
  workers: 'Workers', 
  customers: 'Customers_DB' 
};

const PROFILE_ENTITY_IDKEY = { 
  employees: 'empId', 
  branchManagers: 'bnmId', 
  workers: 'workerId', 
  customers: 'customerId' 
};

const PROFILE_ENTITY_FOLDER = { 
  employees: 'employees', 
  branchManagers: 'employees', 
  workers: 'workers', 
  customers: 'customers' 
};

const PROFILE_ENTITY_PREFIX = { 
  employees: 'EMP-', 
  branchManagers: 'BNM-', 
  workers: 'WRK-', 
  customers: 'CUS-' 
};

function profileFolderId_(kind) {
  const fromSettings = getSetting_('PROFILE_FOLDER_' + kind.toUpperCase(), '');
  return text_(fromSettings) || PROFILE_FOLDER_IDS[kind] || '';
}

function profileSanitize_(s) { 
  return String(s || '').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); 
}

function profileThumbUrl_(id) { 
  return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w800'; 
}

/** هسته ذخیره: برش‌خورده از سمت کلاینت می‌رسد؛ در Drive ثبت و لینک در شیت نوشته می‌شود */
function storeProfilePhoto_(entity, userId, username, dataUrl) {
  try {
    // بررسی فرمت dataUrl
    const m = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) {
      Logger.log('Invalid dataUrl format: ' + dataUrl.substring(0, 50));
      throw new Error('فرمت تصویر معتبر نیست؛ خروجی باید image باشد.');
    }
    
    const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'tmp.jpg');
    const kind = PROFILE_ENTITY_FOLDER[entity] || 'employees';
    const name = profileSanitize_(userId || username) + (username ? '_' + profileSanitize_(username) : '') + '.jpg';
    
    Logger.log('Attempting to access folder: ' + profileFolderId_(kind));
    
    // دسترسی به پوشه‌ها با بررسی خطا
    let roleFolder, centralFolder;
    try {
      roleFolder = DriveApp.getFolderById(profileFolderId_(kind));
    } catch (e) {
      Logger.log('Error accessing role folder: ' + e.message);
      throw new Error('دسترسی به پوشه پروفایل‌ها امکان‌پذیر نیست. لطفاً مجوزهای Drive را بررسی کنید.');
    }
    
    try {
      centralFolder = DriveApp.getFolderById(profileFolderId_('central'));
    } catch (e) {
      Logger.log('Error accessing central folder: ' + e.message);
      throw new Error('دسترسی به پوشه مرکزی پروفایل‌ها امکان‌پذیر نیست.');
    }
    
    // حذف نسخه‌های قدیمی با همان نام (در هر دو پوشه)
    [roleFolder, centralFolder].forEach(f => {
      try {
        const it = f.getFilesByName(name);
        while (it.hasNext()) it.next().setTrashed(true);
        
        if (f !== roleFolder) {
          const it2 = f.getFilesByName((PROFILE_ENTITY_PREFIX[entity] || '') + name);
          while (it2.hasNext()) it2.next().setTrashed(true);
        }
      } catch (e) {
        Logger.log('Warning: Could not delete old files: ' + e.message);
      }
    });
    
    // ایجاد فایل جدید
    const file = roleFolder.createFile(blob.setName(name));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const centralCopy = centralFolder.createFile(blob.setName((PROFILE_ENTITY_PREFIX[entity] || '') + name));
    centralCopy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const url = profileThumbUrl_(file.getId());
    
    // نوشتن لینک در ستون Profile (هدر زنده)
    const sh = getSpreadsheet_().getSheetByName(PROFILE_ENTITY_SHEET[entity]);
    if (sh) {
      const headers = liveHeaders_(sh);
      const pIdx = headers.findIndex(h => /^profile(-hoto)?$/i.test(h) || h === 'عکس پروفایل');
      if (pIdx >= 0) {
        const rows = scRead_(entity);
        const row = rows.find(r => 
          text_(r[PROFILE_ENTITY_IDKEY[entity]]) === text_(userId) || 
          text_(r.username) === text_(username)
        );
        if (row) {
          sh.getRange(row._rowIndex, pIdx + 1).setValue(url);
          Logger.log('Profile photo updated for user: ' + userId);
        } else {
          Logger.log('Warning: User not found in sheet: ' + userId);
        }
      }
    }
    
    return { url: url, fileId: file.getId(), centralId: centralCopy.getId(), name: name };
    
  } catch (e) {
    Logger.log('Error in storeProfilePhoto_: ' + e.message);
    throw e;
  }
}

/** آپلود عکس خودِ کاربر واردشده (اپراتور یا ادمین) */
function uploadMyProfilePhoto(dataUrl, token) {
  let session = null, entity = null;
  try { 
    session = checkOperatorAuth(token); 
    entity = 'workers'; 
  } catch (e) { 
    try {
      session = checkAdminAuth(token); 
      entity = 'employees'; 
    } catch (e2) {
      throw new Error('کاربر یافت نشد. لطفاً مجدداً وارد شوید.');
    }
  }
  
  Logger.log('Uploading photo for: ' + session.username + ' (entity: ' + entity + ')');
  
  const res = storeProfilePhoto_(entity, session.employeeId, session.username, dataUrl);
  
  // بروزرسانی avatar داخل session تا منو فوراً عکس جدید را نشان دهد
  ['operator_session_', 'session_'].forEach(prefix => {
    const raw = PropertiesService.getScriptProperties().getProperty(prefix + token);
    if (raw) { 
      try { 
        const s = JSON.parse(raw); 
        s.avatar = res.url; 
        PropertiesService.getScriptProperties().setProperty(prefix + token, JSON.stringify(s)); 
      } catch (e) {
        Logger.log('Warning: Could not update session: ' + e.message);
      }
    }
  });
  
  scLog_(session, 'بارگذاری عکس پروفایل', res.name, 'success');
  return { success: true, url: res.url };
}

/** آپلود عکس برای هر کاربر (فقط ادمین ارشد) */
function uploadProfilePhotoFor(dataUrl, target, token) {
  const session = checkAdminAuth(token);
  const entity = String(target && target.entity || '');
  if (!PROFILE_ENTITY_SHEET[entity]) throw new Error('نوع کاربر معتبر نیست (employees / workers / customers).');
  
  const userId = target.id || '';
  const username = target.username || '';
  
  Logger.log('Admin uploading photo for: ' + username + ' (entity: ' + entity + ')');
  
  const res = storeProfilePhoto_(entity, userId, username, dataUrl);
  scLog_(session, 'بارگذاری عکس برای ' + entity, res.name, 'success');
  return { success: true, url: res.url };
}

/** تست دسترسی Drive و صحت آی‌دی پوشه‌ها — یک‌بار از ادیتور اجرا و اجازه بده */
function profileDriveSelfTest() {
  const out = {};
  ['central', 'employees', 'workers', 'customers'].forEach(k => {
    try { 
      const folder = DriveApp.getFolderById(profileFolderId_(k));
      out[k] = 'OK: ' + folder.getName() + ' (ID: ' + profileFolderId_(k) + ')'; 
    } catch (e) { 
      out[k] = 'ERR: ' + e.message + ' (ID: ' + profileFolderId_(k) + ')'; 
    }
  });
  console.log(JSON.stringify(out, null, 2));
  return out;
}
