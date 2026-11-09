const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const context={
  Live:{active:true,user:{id:1,role:'department_user',department_code:'FINANCE'},csrf:'first-session'},
  current:'finance',URLSearchParams,render(){},
  escapeHtml:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  heading:(title,description,actions='')=>title+description+actions,panel:(title,body)=>title+body,
  metric:(title,value)=>title+': '+value,
  localStorage:new Proxy({},{get(){throw new Error('Finance must not use browser storage');}})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../finance.js'),'utf8')+'\nglobalThis.finance=Finance;',context);
const finance=context.finance;
const sample=()=>({
  entries:[{id:1,entry_date:'2026-04-01',entry_type:'expense',category:'supplies',amount:'123456789012.34',
    counterparty:'<img src=x>',description:'لوازم آزمایشی\n<script>test</script>',notes:'<note>',receipt_reference:'<receipt>',created_by_name:'Finance <creator>',updated_by_name:'Finance <1>',updated_at:'2026-04-01'}],
  branches:[],categories:{income:{donation:'Donation'},expense:{supplies:'Supplies'}},payment_methods:{cash:'Cash'},
  totals:{income:'1999999999999.98',expense:'123456789012.34',net:'1876543210987.64'},currency:'AFN',
  page:1,pages:2,total:51,active_team_members:5,permissions:{can_add:true,can_edit:true,can_delete:false,can_use_central_office:true}
});
(async()=>{
  assert.equal(finance.money('1999999999999.98'),'1,999,999,999,999.98 AFN');
  assert.equal(finance.money('-0.25'),'-0.25 AFN');assert.equal(finance.money('0'),'0.00 AFN');
  for(const value of ['NaN','<script>','1e5','1.234'])assert.equal(finance.money(value),'—');
  let requested='';context.Live.request=async endpoint=>{requested=endpoint;return sample();};
  finance.filters.search='آزمایشی & receipt';await finance.load(2);
  assert.ok(requested.includes('page=2'));assert.equal(new URLSearchParams(requested.split('?')[1]).get('search'),finance.filters.search);
  assert.equal(finance.data.entries.length,1);assert.equal(finance.canWrite(),true);
  let html=finance.view();assert.ok(html.includes('1,999,999,999,999.98 AFN'));assert.ok(html.includes('data-finance-edit="1"'));
  assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('&lt;script&gt;test&lt;/script&gt;'));assert.ok(html.includes('&lt;receipt&gt;'));
  assert.ok(html.includes('&lt;note&gt;'));assert.ok(html.includes('Created by Finance &lt;creator&gt;'));
  assert.ok(html.includes('Active finance accounts: 5'));assert.ok(!/data-finance-delete/.test(html));
  finance.data.permissions.can_add=false;finance.data.permissions.can_edit=false;
  assert.match(finance.view(),/No offices are available/);assert.ok(!finance.view().includes('Super administrator access'));
  finance.data=sample();
  context.Live.user={id:2,role:'super_admin'};
  assert.equal(finance.canRead(),true);assert.equal(finance.canWrite(),false);
  html=finance.view();assert.ok(!html.includes('id="financeAdd"'));assert.ok(!html.includes('data-finance-edit'));
  for(const user of [{role:'department_user',department_code:'ED'},{role:'department_user'}, {role:'zone_admin'}, {role:'branch_admin'}]){
    context.Live.user={id:3,...user};assert.equal(finance.canRead(),false);assert.equal(finance.canWrite(),false);
    assert.match(finance.view(),/does not have access/);
  }
  context.Live.user={id:1,role:'department_user',department_code:'FINANCE'};
  context.Live.request=async()=>({});await finance.load();assert.match(finance.error,/Invalid finance/);assert.equal(finance.data,null);
  context.Live.request=async()=>{throw Object.assign(new Error('Finance denied'),{status:403});};
  await finance.load();assert.equal(finance.data,null);assert.equal(finance.canWrite(),false);assert.match(finance.view(),/Finance denied/);
  let complete;context.Live.request=()=>new Promise(resolve=>complete=resolve);
  const old=finance.load();finance.reset();context.Live.user={id:4,role:'department_user',department_code:'FINANCE'};context.Live.csrf='new-session';
  complete(sample());await old;assert.equal(finance.data,null);
  let closed=0,removed=0;finance.dialog={close(){closed++;},remove(){removed++;}};
  context.Live.showLogin=()=>{finance.reset();context.Live.active=false;};
  context.Live.request=async()=>{throw Object.assign(new Error('Expired'),{status:401});};await finance.load();
  assert.equal(closed,1);assert.equal(removed,1);assert.equal(finance.dialog,null);assert.equal(finance.data,null);assert.equal(finance.canRead(),false);
  console.log('PASS: exact AFN formatting, finance/super-admin permissions, escaped data, server filters, errors and session isolation');
})().catch(error=>{console.error(error);process.exit(1);});
