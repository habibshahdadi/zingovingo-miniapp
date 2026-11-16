/**
 * ZingoVingo — API Dispatch V4 (Complete)
 */

const API_WHITELIST = [
  // عمومی
  'codeVersion', 'formSmokeTest', 'schemaTest',
  'getServices', 'getPriceEstimate', 'processOrder', 'validateMembershipCode', 'validateOfferCode',
  
  // ادمین
  'adminLogin', 'adminLogout', 'getDashboardData', 'getOrdersList', 'updateOrder', 'deleteOrders',
  'getOrderInvoice', 'exportOrdersToCSV', 'getServicesList', 'saveService', 'deleteServices',
  'getSideServicesList', 'saveSideService', 'deleteSideServices', 'getQuestionsList', 'saveQuestion',
  'deleteQuestions', 'getOrdersColumns', 'getCustomersList', 'updateCustomer', 'deleteCustomers',
  'getCustomerLevels', 'getCustomerHistory', 'getOfferCodesList', 'saveOfferCode', 'deleteOfferCodes',
  'getOfferRedemptions', 'getEmployeesList', 'saveEmployee', 'deleteEmployees', 'getEmployeeLogs',
  'adm_getBranches', 'adm_saveBranch', 'adm_deleteBranches', 'getBranchesForDropdown',
  'adm_getGroups', 'adm_saveGroup', 'adm_deleteGroups', 'getGroupsForDropdown', 'adm_getGroupMembers',
  'adm_addGroupMember', 'adm_removeGroupMember', 'adm_getWorkers', 'adm_saveWorker', 'adm_deleteWorkers',
  'adm_getWorkersForDropdown', 'adm_getCards', 'adm_convertOrderToCard', 'adm_updateCardStatus',
  'adm_getCardHistory', 'adm_deleteCards', 'adm_getTasks', 'adm_updateTaskStatus', 'getFinancialReport',
  'getSystemSettings', 'updateSetting', 'uploadImage', 'getUserProfile', 'updateUserProfile',

  // مدیر شعبه
  'branchManagerLogin', 'branchManagerLogout', 'getBranchManagerDashboard', 'getBranchManagerOrders',
  'updateBranchManagerOrderStatus', 'branchManagerConvertOrderToCard', 'getBranchManagerCards',
  'updateBranchManagerCardStatus', 'getBranchManagerEmployees', 'saveBranchManagerEmployee',
  'deleteBranchManagerEmployee', 'getBranchManagerGroups', 'saveBranchManagerGroup', 'deleteBranchManagerGroup',
  'getBranchManagerWorkers', 'saveBranchManagerWorker', 'deleteBranchManagerWorker', 'getBranchManagerWorkersForDropdown',
  'getBranchManagerReports', 'getBranchManagerProfile', 'updateBranchManagerProfile',

  // کارمند
  'employeeLogin', 'employeeLogout', 'getEmployeeDashboard', 'getEmployeeOrders', 'updateEmployeeOrderStatus',
  'employeeConvertOrderToCard', 'getEmployeeWorkersForDropdown', 'getEmployeeGroups', 'getEmployeeWorkers',
  'getEmployeeReports', 'getEmployeeProfile', 'updateEmployeeProfile', 'getEmployeeCards','getGroupsForDropdownEmp','getWorkersByGroupEmp' ,

// جذب و استخدام
'saveEmployeeJobApplicant',
'getEmployeeJobApplicants',

// جستجو و بروزرسانی کارجویان
'searchEmployeeJobApplicants',
'updateEmployeeJobApplicantOperations',
'updateEmployeeJobApplicantFull',

// فرم عمومی کارجو (بدون لاگین)
'submitPublicJobApplication',


  // سوپروایزر (کامل)
  'supervisorLogin', 'supervisorLogout', 'getSupervisorDashboard', 'getSupervisorGroups', 'getGroupMembers',
  'addGroupMember', 'removeGroupMember', 'toggleMemberStatus', 'getSupervisorCards', 'getSupervisorWorkersForDropdown',
  'assignCardToWorker', 'updateSupervisorCardStatus', 'getSupervisorOrderInvoice', 'getSupervisorReturnedCards',
  'getSupervisorReports', 'getSupervisorProfile', 'updateSupervisorProfile', 'getSupervisorBrandSettings',
  'getSupervisorWorkerById', 'getSupervisorMemberStatuses', 'getSupervisorCardStatuses', 'submitSupervisorRecord',
  'getMySupervisorSubmissions', 'updateSupervisorGroup',

  // کارگر
  'workerLogin', 'workerLogout', 'getWorkerCards', 'updateWorkerCardStatus', 'referCardToSupervisor',
  'getWorkerReports', 'getWorkerProfile', 'updateWorkerProfile', 'uploadWorkerProfilePhotoV2',

  // پیام‌رسانی
  'workerCreateConversation', 'workerReplyConversation', 'workerGetConversations', 'workerGetConversation',
  'workerGetUnreadConversationCount', 'supervisorCreateConversationReply', 'supervisorGetConversations',
  'supervisorGetConversation', 'supervisorSetConversationStatus', 'supervisorGetUnreadConversationCount',
  
  // مشتری
'customerLogin', 'customerLogout', 'requestCustomerOtp', 'verifyCustomerOtp',
'getCustomerDashboard', 'getCustomerOrders', 'getCustomerCards', 'getCustomerOrderInvoice',
'getCustomerProfile', 'updateCustomerProfile',
'createCustomerConversation', 'getCustomerConversations', 'getCustomerUnreadCount', 'replyCustomerConversation',

// پشتیبانی مشتریان (کارمند)
'getCustomerConversationsForEmployee', 'replyToCustomerConversation', 'getUnansweredCustomerCount',

  // آپلود عکس پروفایل
  'uploadMyProfilePhotoV2'
];

const API_DENY = ['doGet', 'doPost', 'include'];

function apiIsAllowed_(action) {
  if (API_WHITELIST.indexOf(action) >= 0) return true;
  if (API_DENY.indexOf(action) >= 0) return false;
  if (/_$/.test(action)) return false;
  return typeof globalThis[action] === 'function';
}

function apiJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const params = e.parameter || {};
    const role = String(params.role || '').toLowerCase();
    
    if (['branch', 'supervisor', 'worker', 'employee'].includes(role)) {
      return handleBaleWebhook_(e, role);
    }
    
    return handleApiCall_(e);
  } catch (err) {
    console.error('doPost error:', err.message);
    return apiJson_({ __ok: false, error: err.message });
  }
}

function handleBaleWebhook_(e, role) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const chatId = String(payload.chat_id || '');
    const messageText = String(payload.message && payload.message.text || '').trim();
    const from = payload.message && payload.message.from;
    const username = from ? String(from.username || from.first_name || '').trim() : '';
    const firstName = from ? String(from.first_name || '') : '';
    const lastName = from ? String(from.last_name || '') : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    
    if (!chatId) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, description: 'No chat_id' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    let responseText = '';
    
    if (messageText === '/start' || messageText === '/استارت') {
      const result = registerBaleSubscriber_(username, chatId, role, fullName);
      responseText = result.success 
        ? '✅ سلام ' + (fullName || username) + ' عزیز!\n\nchatId شما ثبت شد.' 
        : '❌ خطا: ' + result.error;
    } else if (messageText === '/help' || messageText === '/راهنما') {
      responseText = '📖 راهنما:\n/start — ثبت chatId\n/help — راهنما';
    } else {
      responseText = '🤖 سلام! برای شروع /start را بفرستید.';
    }
    
    sendBaleReply_(role, chatId, responseText);
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('Bale webhook error:', err.message);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, description: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleApiCall_(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = String(body.action || '');
    var args = Array.isArray(body.args) ? body.args : [];
    
    if (!apiIsAllowed_(action)) throw new Error('درخواست مجاز نیست: ' + action);
    
    var result = globalThis[action].apply(null, args);
    var out = { __ok: true, result: result === undefined ? null : result };
    
    return apiJson_(out);
  } catch (err) {
    return apiJson_({ __ok: false, error: String((err && err.message) || err) });
  }
}

function registerBaleSubscriber_(username, chatId, role, fullName) {
  try {
    const ss = getSpreadsheet_();
    let sh = ss.getSheetByName('BaleSubscribers');
    
    if (!sh) {
      sh = ss.insertSheet('BaleSubscribers');
      sh.getRange(1, 1, 1, 6).setValues([['username', 'chatId', 'role', 'fullName', 'branchId', 'status']]);
    }
    
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(h => String(h).trim().toLowerCase());
    const iUser = headers.indexOf('username');
    const iChat = headers.indexOf('chatid');
    const iRole = headers.indexOf('role');
    const iName = headers.indexOf('fullname');
    const iBranch = headers.indexOf('branchid');
    const iStatus = headers.indexOf('status');
    
    if (iUser < 0 || iChat < 0) {
      return { success: false, error: 'ستون‌ها یافت نشد' };
    }
    
    let existingRow = null;
    if (iUser >= 0 && sh.getLastRow() >= 2 && username) {
      const existing = sh.getRange(2, iUser + 1, sh.getLastRow() - 1, 1).getDisplayValues();
      for (let i = 0; i < existing.length; i++) {
        if (String(existing[i][0]).trim().toLowerCase() === username.toLowerCase()) {
          existingRow = i + 2;
          break;
        }
      }
    }
    
    if (existingRow) {
      if (iChat >= 0) sh.getRange(existingRow, iChat + 1).setValue(chatId);
      if (iRole >= 0) sh.getRange(existingRow, iRole + 1).setValue(role);
      if (iName >= 0 && fullName) sh.getRange(existingRow, iName + 1).setValue(fullName);
      if (iStatus >= 0) sh.getRange(existingRow, iStatus + 1).setValue('فعال');
      return { success: true, action: 'updated' };
    } else {
      const row = headers.map(() => '');
      if (iUser >= 0) row[iUser] = username;
      if (iChat >= 0) row[iChat] = chatId;
      if (iRole >= 0) row[iRole] = role;
      if (iName >= 0) row[iName] = fullName;
      if (iStatus >= 0) row[iStatus] = 'فعال';
      sh.getRange(sh.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
      return { success: true, action: 'created' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function sendBaleReply_(role, chatId, text) {
  const accessKey = getSetting_('BALE_API_ACCESS_KEY', '');
  const botId = getBaleBotIdByRole_(role);
  
  if (!accessKey || !botId) {
    console.warn('تنظیمات سفیر بله (Access Key یا Bot ID) کامل نیست.');
    return;
  }
  
  try {
    const payload = {
      request_id: 'webhook-' + Date.now(),
      bot_id: botId,
      phone_number: chatId, // در وب‌هوک بله، chatId همان شماره با پیش‌شماره 98 است
      message_data: {
        message: { text: text }
      }
    };
    
    UrlFetchApp.fetch('https://safir.bale.ai/api/v3/send_message', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'api-access-key': accessKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error('sendBaleReply (Safir) error:', err.message);
  }
}


function getBaleBotIdByRole_(role) {
  const keyMap = {
    'branch': 'BALE_BRANCH_BOT_ID',
    'supervisor': 'BALE_SUPERVISOR_BOT_ID',
    'worker': 'BALE_WORKER_BOT_ID',
    'employee': 'BALE_BRANCH_BOT_ID'
  };
  return Number(getSetting_(keyMap[role] || '', '0')) || 0;
}
