#!/usr/bin/env node
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000, ROOT=__dirname, PUB=path.join(ROOT,'public'), DATA=path.join(ROOT,'data'), DBF=path.join(DATA,'db.json');
const VERSION='ZV-FULLSTACK-1.0.0';
const now=()=>new Date().toISOString();
const uid=p=>p+'_'+crypto.randomBytes(5).toString('hex');
const gk=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const day=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString()};
const dayKey=n=>gk(day(n));
const num=v=>{const n=Number(String(v??'').replace(/[۰-۹]/g,d=>'۰۱۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٬,\s]/g,''));return Number.isFinite(n)?n:0};
const txt=v=>String(v??'').trim();
const phone=v=>txt(v).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'').replace(/^98/,'0');
const err=(m,status=400)=>Object.assign(new Error(m),{status});
const fullName=r=>r?([r.firstName,r.lastName].filter(Boolean).join(' ')||r.name||r.username||'—'):'—';
function readJSON(f,fb){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){return fb}}
function atomicWrite(f,obj){fs.mkdirSync(path.dirname(f),{recursive:true});const t=f+'.tmp';fs.writeFileSync(t,JSON.stringify(obj,null,2));fs.renameSync(t,f)}
function seed(){
const db={sessions:{},trash:{},views:{},branches:[],groups:[],employees:[],workers:[],branchManagers:[],customers:[],services:[],sides:[],questions:[],levels:[],rules:{},offers:[],redemptions:[],orders:[],cards:[],cardHistory:[],tasks:[],applicants:[],logs:[],threads:[],messages:[],support:[],settings:{brand:'ZingoVingo',currency:'ریال',logo:'',primary:'#0B1736',accent:'#FF6B1A'}};
db.rules={CM:480000,CF:450000,AR:18000,RO:300000,AP:200000,JH:700000,IN:.02,UR:15,TA:9,VAT:9,CA:3500000};
db.branches=[
{id:'br1',code:'BR-001',name:'تهران مرکزی',province:'تهران',city:'تهران',manager:'نگار احمدی',phone:'02188776655',address:'تهران، ولیعصر، بالاتر از ونک',status:'فعال',createdAt:day(-320)},
{id:'br2',code:'BR-002',name:'تهران غرب',province:'تهران',city:'تهران',manager:'حامد کریمی',phone:'02144556677',address:'تهران، صادقیه',status:'فعال',createdAt:day(-280)},
{id:'br3',code:'BR-003',name:'کرج',province:'البرز',city:'کرج',manager:'مریم نادری',phone:'02634455667',address:'کرج، عظیمیه',status:'فعال',createdAt:day(-210)},
{id:'br4',code:'BR-004',name:'اصفهان',province:'اصفهان',city:'اصفهان',manager:'علی شریفی',phone:'03136677889',address:'اصفهان، چهارباغ',status:'فعال',createdAt:day(-150)},
{id:'br5',code:'BR-005',name:'مشهد',province:'خراسان رضوی',city:'مشهد',manager:'الهام رحیمی',phone:'05138677889',address:'مشهد، وکیل‌آباد',status:'فعال',createdAt:day(-120)}];
db.groups=[
{id:'g1',code:'GRP-001',name:'نظافت مرکز',branchId:'br1',supervisor:'امیر تهرانی',area:'مناطق ۱ تا ۳',type:'نظافت',status:'فعال'},
{id:'g2',code:'GRP-002',name:'بار مرکز',branchId:'br1',supervisor:'کاوه جباری',area:'مناطق ۱ تا ۶',type:'باربری',status:'فعال'},
{id:'g3',code:'GRP-003',name:'نظافت غرب',branchId:'br2',supervisor:'سعید برزگر',area:'مناطق ۲،۵،۲۲',type:'نظافت',status:'فعال'},
{id:'g4',code:'GRP-004',name:'خدمات کرج',branchId:'br3',supervisor:'بابک فرهادی',area:'کرج و حومه',type:'خدمات',status:'فعال'}];
const E=[['e1','admin','آرمان','راد','Administrator','مدیرعامل','br1'],['e2','manager','نگار','احمدی','Manager','مدیر کل عملیات','br1'],['e3','employee','سارا','محمدی','Employee','کارشناس ثبت سفارش','br1'],['e4','employee2','رضا','قاسمی','Employee','کارشناس عملیات','br2'],['e5','employee3','مریم','نادری','Employee','کارشناس شعبه','br3']];
db.employees=E.map((e,i)=>({id:e[0],code:'EMP-'+String(i+1).padStart(3,'0'),username:e[1],password:'1234',firstName:e[2],lastName:e[3],role:e[4],jobTitle:e[5],branchId:e[6],phone:'0912123456'+i,email:e[1]+'@zingovingo.ir',specialty:e[5],status:'فعال',hireDate:dayKey(-400+i*40),avatar:'',address:'تهران'}));
db.branchManagers=[{id:'bm1',code:'BNM-001',username:'branch',password:'1234',firstName:'حامد',lastName:'کریمی',branchId:'br2',phone:'09125556677',email:'branch@zingovingo.ir',status:'فعال',hireDate:dayKey(-300),avatar:''}];
const W=[['w1','worker','مهدی','عباسی','worker','br1','g1','نظافت','مرد'],['w2','worker2','زهرا','کاظمی','worker','br1','g1','نظافت','زن'],['w3','worker3','حسین','موسوی','worker','br1','g2','حمل‌ونقل','مرد'],['w4','worker4','فاطمه','عزیزی','worker','br2','g3','نظافت','زن'],['w5','supervisor','امیر','تهرانی','Supervisor','br1','g1','سرپرستی نظافت','مرد'],['w6','supervisor2','سعید','برزگر','Supervisor','br2','g3','سرپرستی نظافت','مرد'],['w7','worker5','محمد','حیدری','worker','br3','g4','حمل‌ونقل','مرد'],['w8','worker6','شیما','رستمی','worker','br3','g4','نظافت','زن'],['w9','supervisor3','بابک','فرهادی','Supervisor','br3','g4','سرپرستی','مرد'],['w10','supervisor4','کاوه','جباری','Supervisor','br1','g2','سرپرستی بار','مرد'],['w11','operator','سعید','رحمانی','operator','br1','g2','ثبت تلفنی','مرد']];
db.workers=W.map((w,i)=>({id:w[0],code:'WRK-'+String(i+1).padStart(3,'0'),username:w[1],password:'1234',firstName:w[2],lastName:w[3],type:w[4],branchId:w[5],groupId:w[6],specialty:w[7],gender:w[8],phone:'0912'+String(2000000+i*111111).slice(0,7),email:'',status:'فعال',hireDate:dayKey(-300+i*18),avatar:'',address:''}));
const C=[['c1','customer','نیلوفر','سهرابی','تهران','تهران','طلایی'],['c2','customer2','بهرام','دهقان','تهران','تهران','عادی'],['c3','customer3','ترانه','ویسی','تهران','تهران','نقره‌ای'],['c4','customer4','کامران','بخشایش','تهران','تهران','عادی'],['c5','customer5','گیسو','مرادی','تهران','تهران','پلاتینیوم'],['c6','customer6','پویا','افشار','کرج','البرز','عادی'],['c7','customer7','شیدا','نیک‌پور','کرج','البرز','نقره‌ای'],['c8','customer8','فرهاد','سلطانی','اصفهان','اصفهان','طلایی'],['c9','customer9','مینا','کشاورز','مشهد','خراسان رضوی','عادی'],['c10','customer10','آرش','دولتی','تهران','تهران','نقره‌ای']];
const AB='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const code=i=>Array.from({length:9},(_,k)=>AB[(i*17+k*7)%AB.length]).join('');
db.customers=C.map((c,i)=>({id:c[0],code:code(i),username:c[1],password:'1234',firstName:c[2],lastName:c[3],city:c[4],province:c[5],level:c[6],phone:'0912'+String(3000000+i*123457).slice(0,7),email:'',address:c[4]+'، خیابان مرکزی، پلاک '+(10+i),postal:'100000000'+i,status:'فعال',joinDate:dayKey(-220+i*10),avatar:'',notes:'',subStart:dayKey(-100),subEnd:dayKey(265)}));
db.services=[
{id:'sv1',code:'SVC-01',name:'نظافت منزل و دفتر',nameEn:'Home / Office Cleaning',rate:2900000,unit:'ساعت',min:1},
{id:'sv2',code:'SVC-02',name:'نظافت راه‌پله و مشاعات',nameEn:'Stairwell Cleaning',rate:950000,unit:'طبقه',min:1},
{id:'sv3',code:'SVC-03',name:'حمل‌ونقل درون‌شهری',nameEn:'Local Transport',rate:4800000,unit:'سرویس',min:1},
{id:'sv4',code:'SVC-04',name:'حمل‌ونقل برون‌شهری',nameEn:'Long-Distance Transport',rate:13500000,unit:'سرویس',min:1},
{id:'sv5',code:'SVC-05',name:'جابجایی اثاثیه',nameEn:'Furniture Moving',rate:3900000,unit:'سرویس',min:1}];
db.sides=[
{id:'sd1',code:'SIDE-01',name:'بسته‌بندی و چیدمان',rate:650000,unit:'واحد',related:['sv5','sv3'],desc:'کارتن و چیدمان'},
{id:'sd2',code:'SIDE-02',name:'نظافت پس از جابجایی',rate:850000,unit:'سرویس',related:['sv5','sv3'],desc:'نظافت مبدأ/مقصد'},
{id:'sd3',code:'SIDE-03',name:'کارگر کمکی اضافه',rate:900000,unit:'نفر',related:['sv5','sv3','sv1'],desc:'نیروی مازاد'},
{id:'sd4',code:'SIDE-04',name:'محافظ اثاثیه',rate:400000,unit:'سرویس',related:['sv5','sv3','sv4'],desc:'پتو و فوم'},
{id:'sd5',code:'SIDE-05',name:'ضدعفونی سطوح',rate:550000,unit:'سرویس',related:['sv1','sv2'],desc:'ضدعفونی کامل'}];
const Q=[['sv1','مدت زمان (ساعت)','number',1,1],['sv1','مساحت','number',0,2],['sv1','تعداد اتاق','number',0,3],['sv1','تعداد نیروی آقا','number',0,4],['sv1','تعداد نیروی خانم','number',0,5],['sv2','تعداد طبقات','number',1,1],['sv2','تعداد واحد','number',1,2],['sv2','تعداد نیروی آقا','number',0,3],['sv3','تعداد نیروی آقا','number',0,1],['sv3','تعداد طبقات','number',0,2],['sv3','ارزش کالا','number',0,3],['sv3','نوع خودرو','select',0,4],['sv4','ارزش کالا','number',0,1],['sv4','نوع خودرو','select',0,2],['sv5','تعداد نیروی آقا','number',1,1],['sv5','تعداد طبقات','number',0,2],['sv5','مدت زمان (ساعت)','number',0,3]];
db.questions=Q.map((q,i)=>({id:'q'+(i+1),serviceId:q[0],question:q[1],inputType:q[2],required:!!q[3],position:q[4],options:q[1]==='نوع خودرو'?'وانت,نیسان,خاور,تریلی':'',help:'',column:q[1]}));
db.levels=[{id:'lv1',name:'عادی',rate:0,type:'percent',status:'فعال'},{id:'lv2',name:'نقره‌ای',rate:5,type:'percent',status:'فعال'},{id:'lv3',name:'طلایی',rate:10,type:'percent',status:'فعال'},{id:'lv4',name:'پلاتینیوم',rate:15,type:'percent',status:'فعال'}];
db.offers=[
{id:'of1',code:'ZV.140507',rate:15,start:dayKey(-40),end:dayKey(20),indLimit:2,totalLimit:50,status:'فعال'},
{id:'of2',code:'VIP10',rate:10,start:dayKey(-100),end:dayKey(60),indLimit:0,totalLimit:0,status:'فعال'},
{id:'of3',code:'NOROUZ1406',rate:20,start:dayKey(100),end:dayKey(130),indLimit:1,totalLimit:200,status:'فعال'}];
const pick=(a,i)=>a[i%a.length],svIds=['sv1','sv1','sv2','sv3','sv5','sv1','sv4','sv2','sv5','sv3','sv1','sv2','sv3','sv5','sv1','sv4','sv2','sv1'];
const st=['جدید','جدید','ثبت اولیه','در حال انجام','در حال انجام','تکمیل شده','تکمیل شده','تکمیل شده','لغو شده','در حال انجام','تکمیل شده','تکمیل شده','ثبت اولیه','در حال انجام','تکمیل شده','لغو شده','جدید','تکمیل شده'];
for(let i=0;i<18;i++){
const cu=db.customers[i%db.customers.length],sid=svIds[i],sv=db.services.find(x=>x.id===sid),a={};
if(sid==='sv1'){a['مدت زمان (ساعت)']=2+(i%4);a['مساحت']=70+i*8;a['تعداد اتاق']=1+(i%3);if(i%2)a['تعداد نیروی خانم']=1;if(i%3===0)a['تعداد نیروی آقا']=1}
if(sid==='sv2'){a['تعداد طبقات']=3+(i%4);a['تعداد واحد']=2+(i%3);a['تعداد نیروی آقا']=1}
if(sid==='sv3'||sid==='sv5'){a['تعداد نیروی آقا']=2+(i%2);a['تعداد طبقات']=1+(i%4);if(i%2)a['ارزش کالا']=300000000+i*50000000}
if(sid==='sv4'){a['ارزش کالا']=600000000+i*80000000;a['نوع خودرو']='نیسان'}
const sides=db.sides.filter(s=>s.related.includes(sid)&&(i%3===0)).slice(0,1).map(s=>({id:s.id,quantity:1}));
const p={serviceId:sid,quantity:sid==='sv1'?a['مدت زمان (ساعت)']:1,answers:a,sideServices:sides,actionType:i%6===0?'فوری':'عادی',membershipCode:cu.code,offerCode:i%7===0?'ZV.140507':''};
const pr=price(db,p),br=db.branches.find(b=>b.city===cu.city&&b.province===cu.province)||db.branches[0];
const o={id:'o'+(i+1),requestId:'ZV-'+String(1001+i),createdAt:day(-90+i*5),customerId:cu.id,customerCode:cu.code,customerName:fullName(cu),phone:cu.phone,serviceId:sid,service:sv.name,qty:p.quantity,answers:a,sides:sides.map(x=>{const sd=db.sides.find(s=>s.id===x.id);return{id:sd.id,name:sd.name,qty:x.quantity,rate:sd.rate,total:sd.rate*x.quantity}}),actionType:p.actionType,execDate:dayKey(-88+i*5),execTime:String(8+(i%9)).padStart(2,'0')+':00',address:cu.address,province:cu.province,city:cu.city,notes:'هماهنگی تلفنی قبل از حضور انجام شود.',status:st[i],verifier:'سارا محمدی',operator:i%4===0?'w11':'',branchId:br.id,groupId:'',cardId:'',basePrice:pr.basePrice,sideTotal:pr.SI,discount:pr.FD,tax:pr.FT,urgent:pr.FU,finalPrice:pr.finalPrice,price:pr,cancelFee:0,dispatched:0,freightFinal:0,settled:false};
db.orders.push(o);if(pr.offerCode)db.redemptions.push({id:uid('rd'),code:pr.offerCode,customerId:cu.id,customerCode:cu.code,requestId:o.requestId,amount:pr.offerPart,status:'استفاده شد',at:o.createdAt});
}
let ci=0;
db.orders.forEach((o,i)=>{if(o.status==='جدید'&&i%4)return;ci++;const cs=o.status==='تکمیل شده'?'تکمیل شده':o.status==='لغو شده'?'لغو شده':o.status==='در حال انجام'?'در حال انجام':'تخصیص به گروه';const pool=db.workers.filter(w=>w.type==='worker'&&w.branchId===o.branchId),w=['در حال انجام','تکمیل شده'].includes(cs)?pool[i%pool.length]:null;const c={id:'k'+ci,cardId:'CRD-'+(4201+ci),orderId:o.id,requestId:o.requestId,customerId:o.customerId,customerName:o.customerName,phone:o.phone,service:o.service,details:o.service+(o.sides.length?' + '+o.sides.map(s=>s.name).join('، '):''),branchId:o.branchId,groupId:w?w.groupId:'',workerId:w?w.id:'',status:cs,execDate:o.execDate,execTime:o.execTime,address:o.address,amount:o.finalPrice,duration:num(o.answers['مدت زمان (ساعت)'])||3,notes:o.notes,createdAt:o.createdAt,updatedAt:now(),order:ci};db.cards.push(c);o.cardId=c.id;o.groupId=c.groupId;if(!['تکمیل شده','لغو شده'].includes(o.status))o.status='تبدیل به کارت';['جدید','تخصیص به شعبه','تخصیص به گروه','تخصیص به کارگر','در حال انجام','تکمیل شده'].slice(0,cs==='تکمیل شده'?6:cs==='در حال انجام'?5:3).forEach((s,si)=>db.cardHistory.push({id:uid('ch'),cardId:c.cardId,from:si?['جدید','تخصیص به شعبه','تخصیص به گروه','تخصیص به کارگر','در حال انجام'][si-1]:'',to:s,by:si?'نگار احمدی':'سیستم',at:o.createdAt,note:si===0?'ایجاد از سفارش '+o.requestId:''}));});
const A=[['پیمان','زارعی','نظافت','۳ سال','تهران','نظافتکار','جدید'],['شکوه','امینی','نظافت','۵ سال','تهران','نظافتکار ارشد','در حال بررسی'],['فرزاد','کمالی','حمل بار','۲ سال','کرج','کارگر بار','در انتظار مصاحبه'],['مهسا','پورمند','اداری','۴ سال','تهران','کارشناس ثبت','تأیید شده'],['بهنام','رجبی','رانندگی','۸ سال','تهران','راننده','در انتظار مصاحبه'],['رها','سعادت','اداری','۳ سال','کرج','اپراتور','تأیید شده']];
db.applicants=A.map((a,i)=>({id:'a'+(i+1),caseNumber:'JA.'+String(i+1).padStart(6,'0'),createdAt:day(-20+i*3),createdBy:'سارا محمدی',firstName:a[0],lastName:a[1],gender:i%2?'زن':'مرد',birthDate:dayKey(-9000-i*300),age:25+i,maritalStatus:i%2?'متأهل':'مجرد',specialty:a[2],experience:a[3],otherSkills:'',education:'دیپلم',fieldOfStudy:'',residence:a[4],phone:'0912555000'+i,messenger:'بله',messengerId:'',source:'دیوار',referrer:'',requestedPosition:a[5],initialReview:i>2?'تأیید اولیه':'بررسی نشده',phoneInterviewDate:i%2?dayKey(-2):'',inPersonInterviewDate:i>2?dayKey(3):'',phoneInterviewResult:i%2?'تأیید':'انجام نشده',inPersonInterviewResult:'انجام نشده',notes:'',status:a[6]}));
db.tasks=Array.from({length:6},(_,i)=>{const c=db.customers[i];return{id:'t'+(i+1),code:'TSK-'+(701+i),customerId:c.id,customerName:fullName(c),createdAt:dayKey(-10),execDate:dayKey(i+1),execTime:['09:00','11:00','14:00','16:00'][i%4],recType:i%2?'هفتگی':'ماهانه',status:i%3?'جدید':'در حال انجام',notes:'سرویس دوره‌ای نظافت',branchId:'br1'}});
db.threads=[{id:'th1',threadId:'THR-001',cardId:db.cards[0]?.cardId||'CRD-4201',workerId:'w1',workerUsername:'worker',supervisorId:'w5',supervisorUsername:'supervisor',groupId:'g1',branchId:'br1',subject:'پیگیری زمان اجرای کارت',status:'OPEN',lastAt:day(-1),createdAt:day(-2)}];
db.messages=[{id:'m1',threadId:'THR-001',role:'worker',senderId:'w1',senderUsername:'worker',body:'سلام، مشتری درخواست جابه‌جایی ساعت اجرا را دارد.',at:day(-2),readAt:day(-2)},{id:'m2',threadId:'THR-001',role:'supervisor',senderId:'w5',senderUsername:'supervisor',body:'با شعبه هماهنگ شد؛ ساعت جدید را در کارت ثبت کنید.',at:day(-1),readAt:''}];
db.support=[{id:'cn1',conversationId:'MSG-7001',customerId:'c1',customerName:'نیلوفر سهرابی',subject:'سؤال درباره فاکتور',message:'لطفاً تخفیف اشتراک فاکتور آخر را بررسی کنید.',createdAt:day(-2),status:'unread',reply:'',repliedBy:''},{id:'cn2',conversationId:'MSG-7002',customerId:'c2',customerName:'بهرام دهقان',subject:'تغییر زمان اجرا',message:'امکان جابه‌جایی زمان به پنجشنبه وجود دارد؟',createdAt:day(-1),status:'answered',reply:'زمان اجرا با شعبه هماهنگ و به پنجشنبه ۱۰:۰ تغییر کرد.',repliedBy:'سارا محمدی'}];
db.logs=[{id:uid('lg'),at:now(),user:'سیستم',action:'راه‌اندازی',details:'Seed اولیه از اسکیمای ZingoVingo ساخته شد',result:'success'}];
return db;
}
function levelOf(db,p){const c=db.customers.find(x=>(p.membershipCode&&x.code.toLowerCase()===txt(p.membershipCode).toLowerCase())||(p.phone&&x.phone===phone(p.phone)));const l=db.levels.find(x=>x.status==='فعال'&&x.name===(c?c.level:'عادی'));return l||{name:'عادی',rate:0}}
function validateOffer(db,code,customerCode){
code=txt(code).replace(/\s+/g,'').toUpperCase();if(!code)return{valid:false,message:'کد تخفیف را وارد کنید.'};
const o=db.offers.find(x=>x.code.toUpperCase()===code);if(!o)return{valid:false,message:'کد تخفیف معتبر نیست.'};
if(o.status!=='فعال')return{valid:false,message:'این کد تخفیف غیرفعال است.'};
const t=gk(new Date());if(o.start&&t<o.start)return{valid:false,message:'زمان شروع اعتبار این کد نرسیده است.'};if(o.end&&t>o.end)return{valid:false,message:'اعتبار این کد تخفیف پایان یافته است.'};
const used=db.redemptions.filter(r=>r.code.toUpperCase()===code&&r.status==='استفاده شد');
if(o.totalLimit>0&&used.length>=o.totalLimit)return{valid:false,message:'ظرفیت استفاده از این کد تکمیل شده است.'};
if(o.indLimit>0&&customerCode&&used.filter(r=>r.customerCode===customerCode).length>=o.indLimit)return{valid:false,message:'سقف استفاده فردی از این کد تکمیل شده است.'};
return{valid:true,code:o.code,rate:o.rate,message:'کد تخفیف معتبر است — '+o.rate+'٪'};
}
function price(db,p){
const sv=db.services.find(s=>s.id===p.serviceId);if(!sv)throw err('خدمت انتخاب‌شده معتبر نیست.');
const a=p.answers||{},R=db.rules,q=Math.max(0,num(p.quantity)),pos=arr=>{for(const v of arr){const n=num(v);if(n>0)return n}return 0};
const H=pos([a['مدت زمان (ساعت)'],a['ساعت'],/ساعت/.test(sv.unit)?q:0]),area=num(a['مساحت']),rooms=num(a['تعداد اتاق']),N=num(a['تعداد واحد']),NF=num(a['تعداد طبقات']),NM=num(a['تعداد نیروی آقا']),NFM=num(a['تعداد نیروی خانم']),VG=num(a['ارزش کالا']);
const nme=(sv.nameEn||'').toLowerCase(),isStair=/stairwell/.test(nme),isLocal=/local\s*transport/.test(nme),isInter=/long[-\s]?distance/.test(nme),isFurn=/furniture|moving|freight/.test(nme);
let FS=0,FC=0,FSTC=0,FFRS=0,FICS=0,FOCS=0;
if(!isStair&&!isLocal&&!isInter&&!isFurn){FS=sv.rate*(H>0?H:q);if(area>0)FS+=R.AR*area;if(rooms>0)FS+=R.RO*rooms;FS=Math.round(FS)}
if(NM>0||NFM>0){const h=H>0?H:q;FC=Math.round(R.CM*h*NM+R.CF*h*NFM)}
if(isStair){const nf=NF>0?NF:1;FSTC=Math.round(R.AP*N*nf+sv.rate*nf+R.CM*NM);FS=0;FC=0}
if(isFurn||(isLocal&&(NM>0||NF>0))){const nf=NF>0?NF:1;FFRS=Math.round(((R.JH+R.CM)*NM+sv.rate)*nf);FC=0}else if(isLocal)FICS=Math.round(sv.rate);
if(isInter){FOCS=Math.round(sv.rate);FC=0}
let FI=0;if(VG>0&&R.IN>0)FI=Math.round(R.IN*VG*(1+R.VAT/100));
let SI=0;const sb=[];(p.sideServices||[]).forEach(it=>{const s=db.sides.find(x=>x.id===it.id);if(!s)return;const n=num(it.quantity);if(n<=0)return;const line=Math.round(s.rate*n);SI+=line;sb.push({name:s.name,qty:n,unit:s.unit,total:line})});
const lv=levelOf(db,p),DS=lv.rate/100,off=p.offerCode?validateOffer(db,p.offerCode,p.membershipCode):null,DC=off&&off.valid?off.rate/100:0;
if(p.offerCode&&off&&!off.valid&&p.strictOffer)throw err(off.message);
const FD=Math.round((DS+DC)*(FS+SI+FICS+FOCS)),memberPart=Math.round(DS*(FS+SI+FICS+FOCS)),offerPart=FD-memberPart,gross=FS+FC+FSTC+FFRS+FI+FICS+FOCS+SI,TOII=Math.max(0,gross-FD),SB=Math.max(0,FS+SI+FICS+FOCS-FD),FU=p.actionType==='فوری'?Math.round((SB+FC)*R.UR/100):0,FT=Math.round(TOII*R.TA/100),FCN=num(p.cancelFee)||0,FPA=TOII+FT+FU+FCN;
return{serviceName:sv.name,FS,FC,FSTC,FFRS,FI,FICS,FOCS,SI,sideBreakdown:sb,basePrice:FS+FC+FSTC+FFRS+FICS+FOCS,level:lv.name,discountRate:lv.rate,memberPart,offerCode:off&&off.valid?off.code:'',offerRate:off&&off.valid?off.rate:0,offerPart,offerMessage:off?off.message:'',FD,TOII,FU,FT,FCN,finalPrice:FPA,currency:db.settings.currency};
}
const PERM={
Administrator:{scope:'all',write:'*'},Manager:{scope:'all',write:[]},
'Branch Manager':{scope:'branch',write:['orders','cards','employees','workers','groups','tasks']},
Employee:{scope:'branch',write:['orders','cards','groups','workers','tasks','applicants','support']},
Supervisor:{scope:'group',write:['cards','groups','workers','threads','messages']},
worker:{scope:'own',write:['cards','threads','messages']},operator:{scope:'mine',write:['orders']},
Customer:{scope:'customer',write:['orders','support']}
};
const ENTITIES=new Set(['orders','cards','customers','applicants','employees','workers','branchManagers','branches','groups','services','sides','questions','offers','tasks','logs','threads','messages','support']);
function canWrite(s,e){const p=PERM[s.role];return p&&(p.write==='*'||p.write.includes(e))}
function groupIds(db,s){return db.groups.filter(g=>g.supervisor===s.username||g.supervisorId===s.userId).map(g=>g.id)}
function scopeRows(db,s,e,rows){
const p=PERM[s.role];if(!p)return[];if(p.scope==='all')return rows;
if(p.scope==='branch'){
if(['orders','cards','tasks'].includes(e))return rows.filter(r=>r.branchId===s.branchId);
if(['employees','workers','groups','branchManagers'].includes(e))return rows.filter(r=>r.branchId===s.branchId);
if(e==='customers'){const ids=new Set(db.orders.filter(o=>o.branchId===s.branchId).map(o=>o.customerId));return rows.filter(r=>ids.has(r.id))}
return rows;
}
if(p.scope==='group'){const gs=groupIds(db,s),ws=new Set(db.workers.filter(w=>gs.includes(w.groupId)).map(w=>w.id));
if(e==='cards')return rows.filter(r=>ws.has(r.workerId)||(r.branchId===s.branchId&&!r.workerId));
if(e==='workers')return rows.filter(r=>ws.has(r.id));
if(e==='groups')return rows.filter(r=>gs.includes(r.id));
if(e==='threads')return rows.filter(r=>gs.includes(r.groupId));
if(e==='messages'){const ts=new Set(scopeRows(db,s,'threads',db.threads).map(t=>t.threadId));return rows.filter(r=>ts.has(r.threadId))}
return rows;
}
if(p.scope==='own'){if(e==='cards')return rows.filter(r=>r.workerId===s.userId);if(e==='threads')return rows.filter(r=>r.workerId===s.userId);if(e==='messages'){const ts=new Set(scopeRows(db,s,'threads',db.threads).map(t=>t.threadId));return rows.filter(r=>ts.has(r.threadId))}return[]}
if(p.scope==='mine')return e==='orders'?rows.filter(r=>r.operator===s.userId||r.verifier===s.name):[];
if(p.scope==='customer'){if(['orders','cards'].includes(e))return rows.filter(r=>r.customerId===s.userId);if(e==='support')return rows.filter(r=>r.customerId===s.userId);if(e==='customers')return rows.filter(r=>r.id===s.userId);return[]}
return rows;
}
function assertRow(s,e,r){if(!scopeRows(db,s,e,[r]).length)throw err('دسترسی به این رکورد مجاز نیست.',403)}
function publicUser(s){return{id:s.userId,role:s.role,name:s.name,username:s.username,branchId:s.branchId||'',groupId:s.groupId||'',customerId:s.role==='Customer'?s.userId:'',kind:s.kind,avatar:s.avatar||''}}
function bootstrap(s){
const data={};['orders','cards','customers','applicants','employees','workers','branchManagers','branches','groups','services','sides','questions','offers','tasks','logs','threads','messages','support','redemptions','cardHistory'].forEach(e=>{data[e]=scopeRows(db,s,e,db[e]||[])});
if(s.role==='Customer'){data.employees=[];data.workers=[];data.branchManagers=[];data.applicants=[];data.logs=[];data.redemptions=[];}
data.rules=db.rules;data.settings=db.settings;data.levels=db.levels;data.views=db.views[s.userId]||{};
return{user:publicUser(s),data,meta:{version:VERSION,entities:[...ENTITIES],perms:PERM[s.role],statuses:{orders:['جدید','ثبت اولیه','تبدیل به کارت','در حال انجام','تکمیل شده','لغو شده'],cards:['جدید','تخصیص به شعبه','تخصیص به گروه','تخصیص به کارگر','در حال انجام','تکمیل شده','تعلیق','لغو شده','ارجاع به سرپرست'],applicants:['جدید','در حال بررسی','در انتظار مصاحبه','تأیید شده','رد شده','استخدام شده','بایگانی']}}};
}
function audit(s,action,details,result='success'){db.logs.unshift({id:uid('lg'),at:now(),user:s.name,userId:s.userId,role:s.role,action,details,result})}
function login(body){
const u=txt(body.username).toLowerCase(),p=txt(body.password);if(!u||!p)throw err('نام کاربری و رمز عبور را وارد کنید.');
let user=null,kind='',role='';
user=db.employees.find(r=>(r.username.toLowerCase()===u||r.email.toLowerCase()===u)&&r.password===p&&r.status==='فعال');if(user){kind='employees';role=user.role}
if(!user){user=db.branchManagers.find(r=>r.username.toLowerCase()===u&&r.password===p&&r.status==='فعال');if(user){kind='branchManagers';role='Branch Manager'}}
if(!user){user=db.workers.find(r=>r.username.toLowerCase()===u&&r.password===p&&r.status==='فعال');if(user){kind='workers';role=user.type==='Supervisor'?'Supervisor':user.type}}
if(!user){user=db.customers.find(r=>r.username.toLowerCase()===u&&r.password===p&&r.status==='فعال');if(user){kind='customers';role='Customer'}}
if(!user)throw err('نام کاربری یا رمز عبور اشتباه است.',401);
const token=crypto.randomBytes(24).toString('hex'),s={token,role,kind,userId:user.id,username:user.username,name:fullName(user),branchId:user.branchId||'',groupId:user.groupId||'',avatar:user.avatar||'',exp:Date.now()+7*864e5};
db.sessions[token]=s;audit(s,'ورود به سیستم','نقش: '+role);return{token,user:publicUser(s)};
}
function auth(req){const h=req.headers.authorization||'';const t=h.startsWith('Bearer ')?h.slice(7):h;if(!t||!db.sessions[t])throw err('نشست معتبر نیست؛ دوباره وارد شوید.',401);const s=db.sessions[t];if(s.exp<Date.now()){delete db.sessions[t];throw err('نشست منقضی شده است.',401)}return s}
function routeBranch(db,cu){return db.branches.find(b=>b.city===cu.city&&b.province===cu.province)||db.branches.find(b=>b.province===cu.province)||db.branches[0]}
function genCustomerCode(){const AB='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';let c;do{c=Array.from({length:9},()=>AB[crypto.randomInt(AB.length)]).join('')}while(db.customers.some(x=>x.code===c));return c}
function createOrder(s,p){
let cu=p.customerId?db.customers.find(c=>c.id===p.customerId):null;
if(s.role==='Customer')cu=db.customers.find(c=>c.id===s.userId);
if(!cu){const ph=phone(p.phone);if(!/^09\d{9}$/.test(ph))throw err('شماره موبایل معتبر نیست.');if(!txt(p.firstName)||!txt(p.lastName))throw err('نام و نام خانوادگی مشتری جدید الزامی است.');cu={id:uid('c'),code:genCustomerCode(),username:'',password:'',firstName:txt(p.firstName),lastName:txt(p.lastName),phone:ph,city:txt(p.city)||'تهران',province:txt(p.province)||'تهران',level:'عادی',status:'فعال',joinDate:gk(new Date()),address:txt(p.address),email:'',postal:'',avatar:'',notes:'',subStart:gk(new Date()),subEnd:dayKey(365)};db.customers.unshift(cu);audit(s,'افزودن مشتری',fullName(cu)+' — '+cu.code)}
if(!p.serviceId)throw err('یک خدمت انتخاب کنید.');
const pr=price(db,Object.assign({},p,{membershipCode:cu.code,phone:cu.phone,strictOffer:true}));
const sv=db.services.find(x=>x.id===p.serviceId),br=routeBranch(db,cu),reqId='ZV-'+Date.now().toString(36).toUpperCase();
const o={id:uid('o'),requestId:reqId,createdAt:now(),customerId:cu.id,customerCode:cu.code,customerName:fullName(cu),phone:cu.phone,serviceId:sv.id,service:sv.name,qty:num(p.quantity)||1,answers:p.answers||{},sides:(p.sideServices||[]).map(x=>{const sd=db.sides.find(s=>s.id===x.id);return sd?{id:sd.id,name:sd.name,qty:num(x.quantity)||1,rate:sd.rate,total:sd.rate*(num(x.quantity)||1)}:null}).filter(Boolean),actionType:p.actionType||'عادی',execDate:p.execDate||gk(new Date()),execTime:p.execTime||'10:00',address:txt(p.address)||cu.address,province:cu.province,city:cu.city,notes:txt(p.notes),status:'جدید',verifier:s.name,operator:s.role==='operator'?s.userId:'',branchId:br?br.id:'',groupId:'',cardId:'',basePrice:pr.basePrice,sideTotal:pr.SI,discount:pr.FD,tax:pr.FT,urgent:pr.FU,finalPrice:pr.finalPrice,price:pr,cancelFee:0,dispatched:0,freightFinal:0,settled:false};
db.orders.unshift(o);if(pr.offerCode&&pr.offerPart>0)db.redemptions.unshift({id:uid('rd'),code:pr.offerCode,customerId:cu.id,customerCode:cu.code,requestId:o.requestId,amount:pr.offerPart,status:'استفاده شد',at:o.createdAt});audit(s,'ثبت سفارش',o.requestId+' | '+o.customerName+' | '+o.finalPrice);return o;
}
function updateOrder(s,id,p){
const o=db.orders.find(x=>x.id===id);if(!o)throw err('سفارش یافت نشد.',404);assertRow(s,'orders',o);
if(p.serviceId){const cu=db.customers.find(c=>c.id===(p.customerId||o.customerId))||db.customers.find(c=>c.id===o.customerId);const pr=price(db,Object.assign({},o,p,{membershipCode:cu.code,phone:cu.phone,strictOffer:true}));Object.assign(o,p,{service:db.services.find(x=>x.id===p.serviceId).name,basePrice:pr.basePrice,sideTotal:pr.SI,discount:pr.FD,tax:pr.FT,urgent:pr.FU,finalPrice:pr.finalPrice,price:pr,customerName:fullName(cu),phone:cu.phone,customerCode:cu.code});}
else Object.assign(o,p);
o.updatedAt=now();audit(s,'ویرایش سفارش',o.requestId);return o;
}
function convertOrder(s,id){
const o=db.orders.find(x=>x.id===id);if(!o)throw err('سفارش یافت نشد.',404);assertRow(s,'orders',o);if(o.cardId)throw err('این سفارش قبلاً کارت شده است.');
const c={id:uid('k'),cardId:'CRD-'+(4300+db.cards.length),orderId:o.id,requestId:o.requestId,customerId:o.customerId,customerName:o.customerName,phone:o.phone,service:o.service,details:o.service+(o.sides.length?' + '+o.sides.map(x=>x.name).join('، '):''),branchId:o.branchId,groupId:o.groupId||'',workerId:'',status:'جدید',execDate:o.execDate,execTime:o.execTime,address:o.address,amount:o.finalPrice,duration:num(o.answers['مدت زمان (ساعت)'])||3,notes:o.notes,createdAt:now(),updatedAt:now(),order:db.cards.length+1};
db.cards.unshift(c);o.cardId=c.id;o.status='تبدیل به کارت';db.cardHistory.unshift({id:uid('ch'),cardId:c.cardId,from:'',to:'جدید',by:s.name,at:now(),note:'ایجاد از سفارش '+o.requestId});audit(s,'تبدیل سفارش به کارت',c.cardId+' ← '+o.requestId);return c;
}
const TRANS={
'جدید':['تخصیص به شعبه','تخصیص به گروه','لغو شده'],'تخصیص به شعبه':['تخصیص به گروه','لغو شده'],'تخصیص به گروه':['تخصیص به کارگر','لغو شده'],'تخصیص به کارگر':['در حال انجام','تعلیق','لغو شده'],'در حال انجام':['تکمیل شده','تعلیق','ارجاع به سرپرست','لغو شده'],'تعلیق':['در حال انجام','لغو شده'],'ارجاع به سرپرست':['تخصیص به کارگر','لغو شده'],'تکمیل شده':[],'لغو شده':[]};
function setCardStatus(s,id,status,workerId){
const c=db.cards.find(x=>x.id===id);if(!c)throw err('کارت یافت نشد.',404);assertRow(s,'cards',c);
if(!TRANS[c.status]?.includes(status)&&s.role!=='Administrator')throw err('انتقال «'+c.status+' → '+status+'» مجاز نیست.');
if(status==='تخصیص به کارگر'&&!c.workerId&&!workerId)throw err('برای این وضعیت، ابتدا نیرو انتخاب کنید.');
const from=c.status;c.status=status;c.updatedAt=now();if(workerId){const w=db.workers.find(x=>x.id===workerId);if(!w)throw err('نیرو یافت نشد.');c.workerId=w.id;c.groupId=w.groupId}
db.cardHistory.unshift({id:uid('ch'),cardId:c.cardId,from,to:status,by:s.name,at:c.updatedAt,note:workerId?'اجراکننده: '+workerName(db,workerId):''});
const o=db.orders.find(x=>x.id===c.orderId);if(o){if(status==='تکمیل شده')o.status='تکمیل شده';if(status==='لغو شده')o.status='لغو شده';if(status==='در حال انجام')o.status='در حال انجام'}
audit(s,'تغییر وضعیت کارت',c.cardId+': '+from+' → '+status);return c;
}
function assignCard(s,id,workerId){const c=db.cards.find(x=>x.id===id);if(!c)throw err('کارت یافت نشد.',404);assertRow(s,'cards',c);if(workerId){const w=db.workers.find(x=>x.id===workerId);if(!w)throw err('نیرو یافت نشد.');c.workerId=w.id;c.groupId=w.groupId;c.status='تخصیص به کارگر'}else{c.workerId='';c.status='تخصیص به گروه'}c.updatedAt=now();db.cardHistory.unshift({id:uid('ch'),cardId:c.cardId,from:'تخصیص',to:c.status,by:s.name,at:now(),note:workerId?'اجراکننده: '+workerName(db,workerId):'بازگشت به استخر'});audit(s,'تخصیص کارت',c.cardId+' → '+(workerId||'استخر'));return c}
function workerName(db,id){const w=db.workers.find(x=>x.id===id);return w?fullName(w):''}
const REQUIRED={customers:['firstName','lastName','phone'],employees:['firstName','lastName','username','role'],workers:['firstName','lastName','username','type'],branchManagers:['firstName','lastName','username','branchId'],branches:['name','province','city'],groups:['name','branchId'],services:['name','nameEn','rate','unit'],sides:['name','rate','unit'],questions:['serviceId','question','inputType'],offers:['code','rate','start','end'],tasks:['customerId','execDate','execTime'],applicants:['firstName','lastName','phone','specialty','requestedPosition']};
function defaults(e,r){
const n=db[e].length+1;
if(e==='customers'&&!r.code)r.code=genCustomerCode();
if(e==='employees'&&!r.code)r.code='EMP-'+String(n).padStart(3,'0');
if(e==='workers'&&!r.code)r.code='WRK-'+String(n).padStart(3,'0');
if(e==='branchManagers'&&!r.code)r.code='BNM-'+String(n).padStart(3,'0');
if(e==='branches'&&!r.code)r.code='BR-'+String(n).padStart(3,'0');
if(e==='groups'&&!r.code)r.code='GRP-'+String(n).padStart(3,'0');
if(e==='services'&&!r.code)r.code='SVC-'+String(n).padStart(2,'0');
if(e==='sides'&&!r.code)r.code='SIDE-'+String(n).padStart(2,'0');
if(e==='offers')r.code=txt(r.code).toUpperCase();
if(e==='applicants'&&!r.caseNumber)r.caseNumber='JA.'+String(n).padStart(6,'0');
if(e==='tasks'&&!r.code)r.code='TSK-'+(700+n);
if(!r.status)r.status=['applicants','tasks','offers'].includes(e)?(e==='offers'?'فعال':'جدید'):(['services','sides','questions'].includes(e)?'': 'فعال');
if(!r.createdAt)r.createdAt=now();
if(e==='customers'&&!r.joinDate)r.joinDate=gk(new Date());
if(['employees','workers','branchManagers'].includes(e)&&!r.hireDate)r.hireDate=gk(new Date());
if(e==='applicants'){r.createdBy=r.createdBy||'سیستم';r.initialReview=r.initialReview||'بررسی نشده'}
if(e==='tasks'&&r.customerId){const c=db.customers.find(x=>x.id===r.customerId);r.customerName=c?fullName(c):''}
}
function validate(e,r){
(REQUIRED[e]||[]).forEach(k=>{if(r[k]===undefined||r[k]==='')throw err('فیلد «'+k+'» الزامی است.')});
if(r.phone&&!/^09\d{9}$/.test(phone(r.phone)))throw err('شماره موبایل معتبر نیست.');
if(e==='offers'&&!(num(r.rate)>0&&num(r.rate)<=100))throw err('درصد تخفیف باید بین ۱ تا ۱۰ باشد.');
if(['customers','employees','workers','branchManagers'].includes(e)&&r.username&&db[e].some(x=>x.username===r.username&&x.id!==r.id))throw err('این نام کاربری تکراری است.');
}
function removeRows(s,e,ids){
const parts=[{entity:e,items:[]}];if(e==='orders'){const cids=db.cards.filter(c=>ids.includes(c.orderId)).map(c=>c.id);if(cids.length)parts.push({entity:'cards',items:[]});ids=ids.concat([]);}
const token=uid('trash');const trash={at:now(),parts:[]};
for(const part of parts){const set=new Set(part.entity===e?ids:db.cards.filter(c=>ids.includes(c.orderId)).map(c=>c.id));part.items=[];db[part.entity]=db[part.entity].filter((r,idx)=>{if(set.has(r.id)){trash.parts.push({entity:part.entity,index:idx,item:r});return false}return true})}
db.trash[token]=trash;audit(s,'حذف '+e,ids.join(', '));return{deleted:trash.parts.length,trashToken:token};
}
function undo(s,token){const t=db.trash[token];if(!t)throw err('مورد قابل بازگردانی یافت نشد.',404);t.parts.sort((a,b)=>a.index-b.index).forEach(p=>db[p.entity].splice(Math.min(p.index,db[p.entity].length),0,p.item));delete db.trash[token];audit(s,'بازگردانی حذف',token);return{restored:t.parts.length}}
function reports(s,q){
let os=scopeRows(db,s,'orders',db.orders);const from=q.get('from'),to=q.get('to'),sid=q.get('serviceId'),city=q.get('city');
if(from)os=os.filter(o=>gk(o.createdAt)>=from);if(to)os=os.filter(o=>gk(o.createdAt)<=to);if(sid)os=os.filter(o=>o.serviceId===sid);if(city)os=os.filter(o=>o.city===city);
const valid=os.filter(o=>o.status!=='لغو شده'),rev=valid.reduce((a,o)=>a+o.finalPrice,0);
const byStatus={},byService={},byCity={};os.forEach(o=>{byStatus[o.status]=(byStatus[o.status]||0)+1;byService[o.service]=(byService[o.service]||0)+1;const c=o.city||'نامشخص';byCity[c]=(byCity[c]||0)+o.finalPrice});
return{count:os.length,totalRevenue:rev,totalDiscount:os.reduce((a,o)=>a+o.discount,0),totalTax:os.reduce((a,o)=>a+o.tax,0),averageOrder:os.length?Math.round(rev/os.length):0,byStatus,byService,byCity,transactions:os.slice(0,200)};
}
function csvExport(s,e){const rows=scopeRows(db,s,e,db[e]||[]);const cols={orders:['requestId','createdAt','customerName','phone','service','city','execDate','execTime','finalPrice','status'],cards:['cardId','requestId','customerName','service','workerId','execDate','amount','status'],customers:['code','firstName','lastName','phone','city','level','status'],applicants:['caseNumber','firstName','lastName','phone','specialty','requestedPosition','status'],employees:['code','firstName','lastName','username','role','branchId','phone','status'],workers:['code','firstName','lastName','username','type','branchId','groupId','phone','status'],branches:['code','name','province','city','manager','status'],groups:['code','name','branchId','supervisor','area','status'],offers:['code','rate','start','end','status'],services:['code','name','nameEn','rate','unit','min'],sides:['code','name','rate','unit'],questions:['serviceId','question','inputType','required','position'],tasks:['code','customerName','execDate','execTime','recType','status'],logs:['at','user','action','details','result']}[e]||Object.keys(rows[0]||{});
const head={requestId:'شناسه سفارش',createdAt:'تاریخ ثبت',customerName:'مشتری',phone:'تماس',service:'خدمت',city:'شهر',execDate:'تاریخ اجرا',execTime:'ساعت اجرا',finalPrice:'مبلغ نهایی',status:'وضعیت',cardId:'کارت',code:'کد',firstName:'نام',lastName:'نام خانوادگی',level:'سطح',caseNumber:'پرونده',specialty:'تخصص',requestedPosition:'موقعیت',username:'نام کاربری',role:'نقش',branchId:'شعبه',type:'نوع',groupId:'گروه',name:'نام',nameEn:'نام انگلیسی',rate:'نرخ',unit:'واحد',min:'حداقل',province:'استان',manager:'مدیر',supervisor:'سرپرست',area:'منطقه',start:'شروع',end:'پایان',serviceId:'خدمت',question:'پرسش',inputType:'نوع ورودی',required:'اجباری',position:'جایگاه',recType:'تکرار',at:'زمان',user:'کاربر',action:'عملیات',details:'جزئیات',result:'نتیجه',amount:'مبلغ',workerId:'نیرو',discount:'تخفیف',tax:'مالیات'};
const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return'\uFEFF'+[cols.map(c=>esc(head[c]||c)).join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');
}
function importRows(s,e,rows){
if(!canWrite(s,e))throw err('دسترسی Import ندارید.',403);let ok=0;const errors=[];
(rows||[]).forEach((r,i)=>{try{const obj={id:uid(e.slice(0,2)),...r};defaults(e,obj);validate(e,obj);db[e].unshift(obj);ok++}catch(e){errors.push({row:i+1,error:e.message})}});
audit(s,'Import '+e,ok+' موفق / '+errors.length+' خطا');return{inserted:ok,errors};
}
async function readBody(req){if(req.method==='GET')return{};return new Promise((resolve,reject)=>{let b='',n=0;req.on('data',c=>{n+=c.length;if(n>8e6){reject(err('حجم درخواست بیش از حد مجاز است.',413));req.destroy()}else b+=c});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(err('JSON نامعتبر است.'))}});req.on('error',reject)})}
function send(res,status,obj,type='application/json;charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(type.startsWith('application/json')?JSON.stringify(obj):obj)}
function staticServe(req,res,u){let f=u.pathname==='/'?'/index.html':u.pathname;f=path.normalize(f).replace(/^(\.\.[\/\\])+/,'');const full=path.join(PUB,f);if(!full.startsWith(PUB))return send(res,403,'Forbidden','text/plain;charset=utf-8');fs.readFile(full,(e,b)=>{if(e)return send(res,404,'Not found','text/plain;charset=utf-8');const ext=path.extname(full);const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'}[ext]||'application/octet-stream';send(res,200,b,mime)})}
async function route(req,u,body){
const p=u.pathname.replace(/^\/api\//,'');
if(p==='health')return{version:VERSION,time:now()};
if(p==='login'&&req.method==='POST')return login(body);
const s=auth(req);
if(p==='logout'&&req.method==='POST'){delete db.sessions[s.token];audit(s,'خروج','');return{success:true}}
if(p==='bootstrap'&&req.method==='GET')return bootstrap(s);
if(p==='quote'&&req.method==='POST')return price(db,body);
if(p==='offers/validate'&&req.method==='POST')return validateOffer(db,body.code,body.customerCode);
if(p==='reports'&&req.method==='GET')return reports(s,u.searchParams);
if(p==='settings'&&req.method==='PATCH'){if(s.role!=='Administrator')throw err('فقط ادمین ارشد مجاز است.',403);if(body.rules)Object.assign(db.rules,body.rules);if(body.settings)Object.assign(db.settings,body.settings);audit(s,'تغییر تنظیمات','rules/settings');return{rules:db.rules,settings:db.settings}}
if(p==='profile'&&req.method==='PATCH'){const arr=db[s.kind],r=arr.find(x=>x.id===s.userId);if(!r)throw err('کاربر یافت نشد.',404);['firstName','lastName','phone','email','address','avatar','username','password'].forEach(k=>{if(body[k]!==undefined)r[k]=body[k]});s.name=fullName(r);s.username=r.username;s.avatar=r.avatar||'';audit(s,'ویرایش پروفایل',s.username);return publicUser(s)}
if(p==='views'&&req.method==='POST'){const key=s.userId;db.views[key]=db.views[key]||{};db.views[key][body.entity]=db.views[key][body.entity]||[];const v={id:uid('vw'),name:txt(body.name),state:body.state||{}};db.views[key][body.entity].push(v);return v}
if(p.startsWith('views/')&&req.method==='DELETE'){const [,entity,id]=p.split('/');const arr=(db.views[s.userId]||{})[entity]||[];db.views[s.userId][entity]=arr.filter(x=>x.id!==id);return{success:true}}
if(p.startsWith('export/')&&req.method==='GET'){const e=p.split('/')[1];if(!ENTITIES.has(e))throw err('موجودیت نامعتبر است.');return{__csv:csvExport(s,e),filename:'zingovingo-'+e+'.csv'}}
if(p.startsWith('import/')&&req.method==='POST'){return importRows(s,p.split('/')[1],body.rows)}
if(p.startsWith('undo/')&&req.method==='POST')return undo(s,p.split('/')[1]);
if(p==='bulk'&&req.method==='POST'){const {entity,ids,action,value}=body;if(!canWrite(s,entity))throw err('دسترسی ندارید.',403);if(action==='delete')return removeRows(s,entity,ids||[]);if(action==='status'){(ids||[]).forEach(id=>{const r=db[entity].find(x=>x.id===id);if(r){assertRow(s,entity,r);r.status=value;r.updatedAt=now()}});audit(s,'تغییر وضعیت گروهی',entity+' → '+value);return{updated:(ids||[]).length}}throw err('اکشن گروهی نامعتبر است.')}
if(p==='threads'&&req.method==='POST'){const c=db.cards.find(x=>x.id===body.cardId||x.cardId===body.cardId);if(!c)throw err('کارت یافت نشد.',404);assertRow(s,'cards',c);const w=db.workers.find(x=>x.id===(c.workerId||s.userId)),sup=db.workers.find(x=>x.id===w?.groupId&&x.type==='Supervisor')||db.workers.find(x=>x.groupId===w?.groupId&&x.type==='Supervisor');if(!sup)throw err('سرپرست گروه یافت نشد.');const tid='THR-'+(1000+db.threads.length),t={id:uid('th'),threadId:tid,cardId:c.cardId,workerId:w.id,workerUsername:w.username,supervisorId:sup.id,supervisorUsername:sup.username,groupId:w.groupId,branchId:c.branchId,subject:txt(body.subject)||'پیگیری کارت '+c.cardId,status:'OPEN',lastAt:now(),createdAt:now()};db.threads.unshift(t);db.messages.unshift({id:uid('m'),threadId:tid,role:'worker',senderId:s.userId,senderUsername:s.username,body:txt(body.body),at:now(),readAt:''});audit(s,'ایجاد مکاتبه',tid);return t}
if(/^threads\/[^/]+\/reply$/.test(p)&&req.method==='POST'){const tid=p.split('/')[1],t=db.threads.find(x=>x.threadId===tid||x.id===tid);if(!t)throw err('مکاتبه یافت نشد.',404);assertRow(s,'threads',t);if(t.status==='CLOSED')throw err('مکاتبه بسته است.');const m={id:uid('m'),threadId:t.threadId,role:s.role==='Supervisor'?'supervisor':'worker',senderId:s.userId,senderUsername:s.username,body:txt(body.body),at:now(),readAt:''};db.messages.unshift(m);t.lastAt=now();audit(s,'پاسخ مکاتبه',t.threadId);return m}
if(/^threads\/[^/]+$/.test(p)&&req.method==='PATCH'){const tid=p.split('/')[1],t=db.threads.find(x=>x.threadId===tid||x.id===tid);if(!t)throw err('مکاتبه یافت نشد.',404);assertRow(s,'threads',t);t.status=body.status||t.status;audit(s,'وضعیت مکاتبه',t.threadId+' → '+t.status);return t}
if(p==='support'&&req.method==='POST'){if(s.role!=='Customer')throw err('فقط مشتری می‌تواند پیام پشتیبانی جدید ثبت کند.',403);const cu=db.customers.find(x=>x.id===s.userId),m={id:uid('cn'),conversationId:'MSG-'+(7000+db.support.length+1),customerId:cu.id,customerName:fullName(cu),subject:txt(body.subject)||'بدون موضوع',message:txt(body.message),createdAt:now(),status:'unread',reply:'',repliedBy:''};if(!m.message)throw err('متن پیام الزامی است.');db.support.unshift(m);audit(s,'پیام جدید مشتری',m.conversationId);return m}
if(/^orders\/[^/]+\/convert$/.test(p)&&req.method==='POST')return convertOrder(s,p.split('/')[1]);
if(/^cards\/[^/]+\/status$/.test(p)&&req.method==='POST')return setCardStatus(s,p.split('/')[1],body.status,body.workerId);
if(/^cards\/[^/]+\/assign$/.test(p)&&req.method==='POST')return assignCard(s,p.split('/')[1],body.workerId);
let m=p.match(/^([a-zA-Z]+)(?:\/([^/]+))?$/);if(m&&ENTITIES.has(m[1])){
const e=m[1],id=m[2];if(req.method==='GET')return scopeRows(db,s,e,db[e]||[]);
if(!canWrite(s,e))throw err('شما دسترسی نوشتن به این بخش را ندارید.',403);
if(e==='orders'&&req.method==='POST')return createOrder(s,body);
if(req.method==='POST'){const r={id:uid(e.slice(0,2)),...body};defaults(e,r);validate(e,r);db[e].unshift(r);audit(s,'افزودن '+e,r.code||r.caseNumber||r.id);return r}
const r=db[e].find(x=>x.id===id);if(!r)throw err('رکورد یافت نشد.',404);assertRow(s,e,r);
if(req.method==='PATCH'){if(e==='orders')return updateOrder(s,id,body);Object.assign(r,body,{updatedAt:now()});validate(e,r);audit(s,'ویرایش '+e,r.code||r.id);return r}
if(req.method==='DELETE')return removeRows(s,e,[id]);
}
throw err('مسیر نامعتبر: '+p,404);
}
let db=readJSON(DBF,null);if(!db||!db.orders){db=seed();atomicWrite(DBF,db)}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/')){const body=await readBody(req);const r=await route(req,u,body);if(req.method!=='GET')atomicWrite(DBF,db);if(r&&r.__csv){res.writeHead(200,{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="'+r.filename+'"'});return res.end(r.__csv)}return send(res,200,{ok:true,data:r})}return staticServe(req,res,u)}catch(e){return send(res,e.status||400,{ok:false,error:e.message||String(e)})}});
server.listen(PORT,()=>{console.log('\n  '+VERSION+'\n  ▶ http://localhost:'+PORT+'\n  داده‌ها: '+DBF+'\n  ورود نمونه: admin / 1234 — worker / 1234 — customer / 1234\n')});
