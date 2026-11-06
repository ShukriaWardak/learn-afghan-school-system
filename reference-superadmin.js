/* Reference-inspired visual dashboard. Demo values deliberately not invented. */
NAV.splice(0,NAV.length,
["MANAGEMENT",[["overview","⌂","Dashboard"],["students","♧","Students"],["teachers","♧","Teachers"],["users","♙","Users & Roles"],["staff","▣","HR"],["finance","▥","Finance"],["attendance","▤","Attendance"],["classes","▦","Classes"],["reports","▥","Reports"],["settings","⚙","Settings"]]],
["ORGANIZATION",[["zones","◎","Zones"],["branches","▦","Schools & Branches"],["departments","▤","Departments"],["audit","⌁","Audit History"],["backup","◈","Backups"]]]
);
overview=function(){
 const card=(label,value,icon,color,desc)=>'<div class="ref-stat"><div class="ref-icon" style="color:'+color+'">'+icon+'</div><b>'+label+'</b><strong>'+value+'</strong><small>'+desc+'</small></div>';
 const action=(page,icon,label)=>'<button class="ref-action" data-go="'+page+'"><span>'+icon+'</span>'+label+'</button>';
 return '<div class="ref-welcome"><div><div>Good Evening,</div><h1>Pashtana Durrani 👋</h1><p>Welcome to LEARN Afghan School System</p></div><div class="ref-tools"><span>⌕</span><span>♧</span></div></div>'+
 '<div class="ref-hero"><div class="ref-hero-logo"><div class="ref-book">◫</div><b>LEARN AFGHAN</b><span>School Management System</span></div><div class="ref-hero-photo" role="img" aria-label="LEARN Afghan event photo. Add approved image at assets/learn-afghan-event.jpg"><span>LEARN Afghan • Education & Achievement</span></div></div>'+
 '<div class="ref-stats">'+card("Students","—","♟","#0879f9","Database connection pending")+card("Teachers","—","🎓","#8b35e8","Database connection pending")+card("Staff (HR)","—","♟","#e8b900","Database connection pending")+card("Finance (AFN)","—","▣","#36bd45","Database connection pending")+card("Attendance","—","▦","#00b7b4","Database connection pending")+card("Schools","25","⌂","#9138ec","Planned branches")+'</div>'+
 '<div class="ref-bottom"><section class="ref-panel"><h3>Student Enrollment (This Term)</h3><div class="ref-empty">Enrollment chart will appear when verified student records are connected.</div></section><section class="ref-panel"><h3>Quick Actions</h3><div class="ref-actions">'+action("students","♟","Students")+action("teachers","🎓","Teachers")+action("classes","▦","Classes")+action("reports","▥","Reports")+'</div></section><section class="ref-panel"><h3>Attendance Overview</h3><div class="ref-attendance"><div class="ref-ring">—<small>Overall</small></div><div>Present —<br>Absent —<br>Late —</div></div><small>Awaiting verified attendance data</small></section></div>'+
 '<p class="ref-demo">DEVELOPMENT PREVIEW — No live student, financial or attendance data is connected. This visual update does not change authentication or permissions.</p>';
};
render();
