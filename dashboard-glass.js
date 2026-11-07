/* Overview-only visual enhancement. Does not alter data storage, authentication, or other modules. */
(function(){
 const originalOverview=overview;
 const tile=(name,value,icon)=>'<div class="glass-card"><div class="glass-icon" aria-hidden="true">'+icon+'</div><label>'+name+'</label><strong>'+value+'</strong></div>';
 overview=function(){
  const assigned=state.branches.filter(b=>b.admin!=="Not assigned").length;
  const sample='—';
  return '<div class="glass-dashboard">'
  +'<div class="glass-welcome"><div><h1>Good Evening,<br>Super Admin 👋</h1><p>Welcome to LEARN Afghan School System</p></div><div class="glass-actions"><button class="glass-round" aria-label="Search branches" data-go="branches">⌕</button><button class="glass-round" aria-label="View approvals" data-go="approvals">♧</button></div></div>'
  +'<div class="glass-banner" role="img" aria-label="LEARN Afghan graduation banner; add approved female graduation photograph as assets/dashboard-girls.webp"><div class="glass-banner-brand"><div class="glass-book" aria-hidden="true">📖</div><b>LEARN AFGHAN</b><div class="glass-wave"></div></div></div>'
  +'<div class="glass-stats">'+tile('Students',sample,'♟')+tile('Teachers',sample,'🎓')+tile('Staff (HR)',sample,'♟')+tile('Finance (AFN)',sample,'▣')+tile('Attendance',sample,'▦')+tile('Branches',String(state.branches.length),'⌂')+'</div>'
  +'<div class="glass-panels"><section class="glass-panel"><h2>Student Enrollment (This Term)</h2><div class="glass-chart" aria-label="Illustrative chart, not real enrollment data">'+[40,51,62,72,81,92].map(n=>'<span style="height:'+n+'%"></span>').join('')+'</div><div class="glass-months"><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div><p class="glass-note">Illustrative chart — enrollment records not connected.</p></section>'
  +'<section class="glass-panel"><h2>Quick Actions</h2><div class="glass-quick"><button data-go="forms"><span>♙</span>Data Entry</button><button data-go="teachers"><span>🎓</span>Teachers</button><button data-go="branches"><span>▤</span>Branches</button><button data-go="reports"><span>▥</span>Reports</button></div></section>'
  +'<section class="glass-panel"><h2>Attendance Overview</h2><div class="glass-attendance"><div class="glass-ring" style="background:conic-gradient(#d9e6f5 0 100%)"><div><b>—</b><small>No live data</small></div></div><div class="glass-legend">🟢 Present <b>—</b><br>🟡 Absent <b>—</b><br>🔴 Late <b>—</b></div></div><p class="glass-note">Live attendance integration pending.</p></section></div>'
  +'<p class="glass-note">Prototype view: unverified statistics are intentionally blank. Branch records: '+state.branches.length+' (demo); assigned administrators: '+assigned+' (demo). No live database is connected.</p></div>';
 };
 render();
})();
