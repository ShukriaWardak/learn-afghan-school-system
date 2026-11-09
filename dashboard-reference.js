"use strict";
/* Visual-only reference dashboard. Existing authentication, scoped APIs and modules stay intact.
   Do not present the design reference's illustrative counts as genuine database records. */
function referenceOverview(){
 const live=Live.active, person=live?(Live.user.display_name||Live.user.username):"Super Admin";
 const role=live?Live.user.role:"super_admin";
 const branches="25";
 const attendance="—", students="4,545",teachers="81", staff="—",finance="—";
 const card=(icon,title,value,cls)=>'<div class="ref-stat '+cls+'"><span class="ref-stat-icon" aria-hidden="true">'+icon+'</span><span class="ref-stat-label">'+title+'</span><strong>'+value+'</strong></div>';
 const quick=(label,icon,target)=>'<button type="button" class="ref-quick" data-go="'+target+'"><span aria-hidden="true">'+icon+'</span>'+label+'</button>';
 const sample=[18,33,49,59,70,84,97];
 const line=sample.map((y,i)=>(i?'L':'M')+(24+i*44)+','+(120-y)).join(' ');
 const dots=sample.map((y,i)=>'<circle cx="'+(24+i*44)+'" cy="'+(120-y)+'" r="4.5"/>').join('');
 return '<div class="ref-dashboard">'
 +'<div class="ref-intro"><div><div class="ref-greeting">Good Evening,</div><h1>'+escapeHtml(person)+' <span aria-hidden="true">👋</span></h1><p>Welcome to LEARN Afghan School System</p></div><span class="ref-mode">'+(live?'Authenticated · '+escapeHtml(role.replaceAll("_"," ")):'Preview · demo only')+'</span></div>'
 +'<div class="ref-banner"><div class="ref-banner-brand"><span class="ref-book" aria-hidden="true">📖</span><strong>LEARN AFGHAN</strong><span class="ref-gold-wave" aria-hidden="true"></span></div><div class="ref-banner-photo" role="img" aria-label="LEARN Afghan students"></div></div>'
 +'<div class="ref-stats">'
 +card('👥','Students',students,'blue')+card('🎓','Teachers',teachers,'purple')+card('👥','Staff (HR)',staff,'yellow')+card('💳','Finance (AFN)',finance,'green')+card('🗓','Attendance',attendance,'turquoise')+card('🏫','Branches',branches,'violet')
 +'</div><div class="ref-panels">'
 +'<section class="ref-panel"><h2>Student Enrollment (This Term)</h2><div class="ref-chart"><svg viewBox="0 0 320 150" role="img" aria-label="Illustrative enrollment trend; not database information"><g stroke="#dce7f4" stroke-width="1"><path d="M15 20H310M15 55H310M15 90H310M15 125H310"/></g><path d="'+line+'" stroke="#167ddd" fill="none" stroke-width="4" stroke-linejoin="round"/><g fill="#167ddd">'+dots+'</g></svg><div class="ref-months"><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div></div><small>Illustrative chart · enrollment history not connected</small></section>'
 +'<section class="ref-panel"><h2>Quick Actions</h2><div class="ref-quick-grid">'+quick('Add Student','👤','students')+quick('Add Teacher','🎓','teachers')+quick('Create Class','📖','forms')+quick('Generate Report','📊','reports')+'</div><small>Opening a module does not bypass permissions.</small></section>'
 +'<section class="ref-panel"><h2>Attendance Overview</h2><div class="ref-attendance"><div class="ref-ring"><div><strong>—</strong><small>Not available</small></div></div><div class="ref-legend"><span><i class="present"></i>Present <b>—</b></span><span><i class="absent"></i>Absent <b>—</b></span><span><i class="late"></i>Late <b>—</b></span></div></div><small>Live attendance percentage requires an aggregate endpoint.</small></section>'
 +'</div><p class="ref-data-note">'+(live?'Students (4,545), teachers (81) and branches (25) are institution-provided totals, not calculated from this local database. Other values await verified aggregates.':'Institution-provided reference totals: 4,545 students, 81 teachers and 25 branches. Finance, staffing and attendance await verification.')+'</p></div>';
}
const originalLiveOverview=Live.overview.bind(Live);
overview=referenceOverview;
Live.overview=function(){return this.user?.role==="super_admin"?referenceOverview():originalLiveOverview();};

/* The nine primary menu entries follow the supplied screenshot. Advanced operational
   routes remain available under More Modules; no PHP endpoint or authorization is changed. */
const originalNavigation=navigation;
function referenceNavigation(){
 if(Live.active && Live.user?.role!=="super_admin")return originalNavigation();
 const mainItems=[
  ["overview","⌂","Dashboard"],["students","♧","Students"],
  ["teachers","🎓","Teachers"],["users","♙","Users & Roles"],
  ["staff","▣","HR"],["finance","▥","Finance"],
  ["attendance","▦","Attendance"],["forms","▤","Classes"],
  ["reports","▥","Reports"],["settings","⚙","Settings"]
 ];
 const moreItems=NAV.flatMap(group=>group[1]).filter(item=>!mainItems.some(primary=>primary[0]===item[0]));
 const moreOpen=moreItems.some(item=>item[0]===current)||Boolean($('#nav .ref-more-menu')?.open);
 const link=([key,icon,label])=>'<button type="button" class="nav-link '+(current===key?'active':'')+'" data-page="'+key+'"'+(current===key?' aria-current="page"':'')+'><span class="nav-symbol" aria-hidden="true">'+icon+'</span>'+escapeHtml(label)+'</button>';
 $("#nav").innerHTML='<div class="ref-main-menu">'+mainItems.map(link).join("")+'</div>'
    +'<details class="ref-more-menu"'+(moreOpen?' open':'')+'><summary>More Modules</summary>'+moreItems.map(link).join("")+'</details>';
 document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
}
navigation=referenceNavigation;

/* Re-render after the new view is registered. Server session loading remains owned by Live. */
if(!document.documentElement.classList.contains("auth-required"))render();
