 const emergencyChannel = new BroadcastChannel('hms_universal_bus');
  
  let staffList = JSON.parse(localStorage.getItem('hms_staff_db') || '[]');
  let storedCases = JSON.parse(localStorage.getItem('hms_cases_db') || '[]');
  let storedReception = JSON.parse(localStorage.getItem('hms_reception_db') || '[]');
  let storedWards = JSON.parse(localStorage.getItem('hms_wards_db') || '[]');
  let diagnosticOrders = JSON.parse(localStorage.getItem('hms_diagnostics_db') || '[]');
  let pharmacyOrders = JSON.parse(localStorage.getItem('hms_pharmacy_db') || '[]');
  let manualExpenses = JSON.parse(localStorage.getItem('hms_expenses_db') || '[]');
  let staffLeaveRequests = JSON.parse(localStorage.getItem('hms_leave_db') || '[]');
  let staffNotifications = JSON.parse(localStorage.getItem('hms_notifications_db') || '{}'); // { username: [ {id, text, time, read} ] }
  let activeSession = JSON.parse(localStorage.getItem('hms_active_session') || 'null');
  let currentLocationStamp = "Emergency Desk (Station 1)";

  const salaryMap = {
    'doctor': 3000,
    'sr_doctor': 3500,
    'receptionist': 750,
    'pharmacist': 1500,
    'ward_incharge': 1000,
    'lab_assistant': 1000,
    'scan_assistant': 1000,
    'admin': 0
  };

  function updateWallpaperClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const wClock = document.getElementById('wallClock');
    const wDate = document.getElementById('wallDate');
    if(wClock) wClock.innerText = timeStr;
    if(wDate) wDate.innerText = dateStr;

    document.querySelectorAll('.liveDateVal').forEach(el => el.innerText = now.toLocaleDateString());
    document.querySelectorAll('.liveTimeVal').forEach(el => el.innerText = timeStr);

    checkTimeRules(now);
  }
  setInterval(updateWallpaperClock, 1000);
  updateWallpaperClock();

  function checkTimeRules(now) {
    if (!activeSession) return;
    const hours = now.getHours();
    const mins = now.getMinutes();
    const totalMins = hours * 60 + mins;

    const role = activeSession.role;
    const isDoctor = (role === 'doctor' || role === 'sr_doctor');

    let noticeText = "";
    let noticeBoxIds = ['receptionistStatusNotice', 'wardStatusNotice', 'bloodLabStatusNotice', 'scanLabStatusNotice', 'pharmacyStatusNotice'];

    if (!isDoctor) {
      if (totalMins >= 780 && totalMins <= 810) {
        noticeText = "🍔 Rotational Lunch Break active (1:00 PM - 1:30 PM). Portal status: Lunch Break in progress.";
      } else if (totalMins >= 675 && totalMins <= 690) {
        noticeText = "☕ Morning Break active (11:15 AM).";
      } else if (totalMins > 600 && !activeSession.attended) {
        noticeText = "⚠️ Attendance warning: Failed to log in before 10:00 AM. Summoned by Admin / Marked on Leave.";
      } else if (totalMins > 1325) {
        noticeText = "🚨 Red Flag: Late checkout past 10:00 PM (+/- 5 min margin).";
      }
    }

    noticeBoxIds.forEach(id => {
      const box = document.getElementById(id);
      if (box) {
        if (noticeText) {
          box.style.display = 'block';
          box.innerText = noticeText;
        } else {
          box.style.display = 'none';
        }
      }
    });
  }

  function fetchLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { currentLocationStamp = `GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`; },
        () => {
          fetch('https://ipapi.co/json/').then(r => r.json()).then(d => { currentLocationStamp = `${d.city || 'Hospital Bay'}, ${d.region_code || ''}`; }).catch(()=>{});
        }
      );
    }
  }
  fetchLocation();

  function openLoginModal() { document.getElementById('loginModal').style.display = 'flex'; }
  function closeLoginModal() { 
    document.getElementById('loginModal').style.display = 'none'; 
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginForm').reset();
  }

  document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    const errEl = document.getElementById('loginError');

    if (u === 'madhukar' && p === '230507') {
      activeSession = { name: 'Madhukar (Admin)', role: 'admin', attended: true };
      localStorage.setItem('hms_active_session', JSON.stringify(activeSession));
      initSystemSession();
      return;
    }

    const foundStaff = staffList.find(s => s.name.toLowerCase() === u.toLowerCase() && s.pass === p);
    if (foundStaff) {
      activeSession = { name: foundStaff.name, role: foundStaff.role, attended: true };
      localStorage.setItem('hms_active_session', JSON.stringify(activeSession));
      initSystemSession();
      return;
    }

    errEl.style.display = 'block';
  });

  function initSystemSession() {
    closeLoginModal();
    document.getElementById('wallpaperScreen').classList.add('hidden');
    document.getElementById('appInterface').classList.remove('hidden');

    document.getElementById('headerUsername').innerText = activeSession.name;
    document.getElementById('headerRoleBadge').innerText = activeSession.role.replace('_', ' ');

    const srSearchBox = document.getElementById('srSearchContainer');
    if (srSearchBox) {
      if (activeSession.role === 'sr_doctor' || activeSession.role === 'admin') {
        srSearchBox.style.display = 'block';
      } else {
        srSearchBox.style.display = 'none';
      }
    }

    renderSidebarByRole();
    renderDoctorTable();
    renderStaffDirectory();
    renderReceptionTable();
    renderWardTables();
    renderLabTables();
    renderPharmacyTable();
    renderAdminEmergencyPreview();
    renderExpensePreview();
    renderLeaveTables();
    renderNotifications();
    updateFinancialDashboard();
  }

  function logoutSystem() {
    localStorage.removeItem('hms_active_session');
    activeSession = null;
    document.getElementById('appInterface').classList.add('hidden');
    document.getElementById('wallpaperScreen').classList.remove('hidden');
  }

  function updateFinancialDashboard() {
    const opPatients = storedReception.filter(r => r.type === 'OP');
    const ipPatients = storedReception.filter(r => r.type === 'IP');

    let totalInflow = 0;
    let govSchemeTotal = 0;

    opPatients.forEach(op => {
      if (op.paymentScheme === 'GovtScheme') {
        govSchemeTotal += 350;
      } else {
        totalInflow += 350;
      }
    });

    ipPatients.forEach(ip => {
      const days = Number(ip.ipDays) || 1;
      const ipTotal = 500 + 500 + (1000 * days);
      if (ip.paymentScheme === 'GovtScheme') {
        govSchemeTotal += ipTotal;
      } else {
        totalInflow += ipTotal;
      }
    });

    pharmacyOrders.forEach(rx => {
      totalInflow += Number(rx.totalBilled) || 0;
    });

    diagnosticOrders.forEach(ord => {
      totalInflow += Number(ord.totalBilled) || 0;
    });

    let totalOutflow = 0;
    staffList.forEach(s => {
      totalOutflow += Number(salaryMap[s.role]) || 0;
    });

    manualExpenses.forEach(ex => {
      totalOutflow += Number(ex.amount) || 0;
    });

    const netCash = Number(totalInflow) - Number(totalOutflow);

    const inflowEl = document.getElementById('finInflowVal');
    const opCountEl = document.getElementById('finOpCount');
    const ipCountEl = document.getElementById('finIpCount');
    const rxCountEl = document.getElementById('finRxCount');
    const diagCountEl = document.getElementById('finDiagCount');
    const outflowEl = document.getElementById('finOutflowVal');
    const netEl = document.getElementById('finNetVal');
    const govValEl = document.getElementById('govSchemeTotalVal');
    const govListEl = document.getElementById('govSchemeDetailsList');

    if (inflowEl) inflowEl.innerText = `₹${totalInflow.toLocaleString()}`;
    if (opCountEl) opCountEl.innerText = opPatients.length;
    if (ipCountEl) ipCountEl.innerText = ipPatients.length;
    if (rxCountEl) rxCountEl.innerText = pharmacyOrders.length;
    if (diagCountEl) diagCountEl.innerText = diagnosticOrders.length;
    if (outflowEl) outflowEl.innerText = `₹${totalOutflow.toLocaleString()}`;
    if (netEl) {
      netEl.innerText = `₹${netCash.toLocaleString()}`;
      netEl.style.color = netCash >= 0 ? '#38a169' : '#e53e3e';
    }
    if (govValEl) govValEl.innerText = `₹${govSchemeTotal.toLocaleString()}`;
    if (govListEl) {
      const govPatients = [...opPatients, ...ipPatients].filter(p => p.paymentScheme === 'GovtScheme');
      if (govPatients.length === 0) {
        govListEl.innerText = "No government scheme entries recorded yet.";
      } else {
        govListEl.innerHTML = govPatients.map(gp => `• Token <b>${gp.token}</b> (${gp.name}): ${gp.type === 'IP' ? 'IPD Dues' : 'OPD ₹350'}`).join('<br>');
      }
    }
  }

  function renderSidebarByRole() {
    const nav = document.getElementById('sidebarNav');
    let html = '';
    const role = activeSession.role;

    if (role === 'admin') {
      html += `<a onclick="showSection('secAdminPanel')" id="navAdmin" class="active">⚙️ Admin, Leave Approvals & Finance</a>`;
      html += `<a onclick="showSection('secEmergency')">🚨 Emergency Admission</a>`;
      html += `<a onclick="showSection('secOutpatient')">📋 Reception Desk (OP/IP)</a>`;
      html += `<a onclick="showSection('secDoctorFeed')">🩺 Critical Cases Feed & Search</a>`;
      html += `<a onclick="showSection('secWardIncharge')">🛏️ Ward In-Charge Portal</a>`;
      html += `<a onclick="showSection('secBloodLab')">🧪 Blood Lab Assistant</a>`;
      html += `<a onclick="showSection('secScanLab')">🩻 Scan Lab Assistant</a>`;
      html += `<a onclick="showSection('secPharmacy')">💊 Pharmacy Inventory (All Staff)</a>`;
      showSection('secAdminPanel');
    } else {
      // General staff portal links (Receptionist, Doctor, Ward Incharge, Lab Asst, Pharmacist, etc.)
      html += `<a onclick="showSection('secStaffLeavePortal')" id="navLeave" class="active">🗓️ Apply Leave / Weekly-Off</a>`;
      
      if (role === 'receptionist') {
        html += `<a onclick="showSection('secEmergency')" class="emergency-link">🚨 Emergency Admission</a>`;
        html += `<a onclick="showSection('secOutpatient')">📋 Patient Registration (OP/IP)</a>`;
      } else if (role === 'doctor' || role === 'sr_doctor') {
        html += `<a onclick="showSection('secDoctorFeed')">🩺 Doctor Workspace & Discharge</a>`;
        html += `<a onclick="showSection('secEmergency')">🚨 Emergency Admission</a>`;
      } else if (role === 'ward_incharge') {
        html += `<a onclick="showSection('secWardIncharge')">🛏️ Ward In-Charge Dashboard</a>`;
      } else if (role === 'lab_assistant') {
        html += `<a onclick="showSection('secBloodLab')">🧪 Blood Lab Assistant Desk</a>`;
      } else if (role === 'scan_assistant') {
        html += `<a onclick="showSection('secScanLab')">🩻 Scan Lab Assistant Desk</a>`;
      } else if (role === 'pharmacist') {
        html += `<a onclick="showSection('secPharmacy')">💊 Pharmacy Inventory & Billing</a>`;
      }
      
      html += `<a onclick="showSection('secPharmacy')">💊 Pharmacy Inventory</a>`;
      showSection('secStaffLeavePortal');
    }

    nav.innerHTML = html;
  }

  function showSection(secId) {
    ['secEmergency', 'secOutpatient', 'secDoctorFeed', 'secWardIncharge', 'secAdminPanel', 'secPharmacy', 'secBloodLab', 'secScanLab', 'secStaffLeavePortal'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.add('hidden');
    });
    const target = document.getElementById(secId);
    if(target) target.classList.remove('hidden');
  }

  // Staff Leave & Weekly-Off Application Logic
  document.getElementById('leaveApplicationForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const type = document.getElementById('leaveType').value;
    const date = document.getElementById('leaveDate').value;
    const reason = document.getElementById('leaveReason').value.trim();

    const leaveObj = {
      id: 'REQ-' + Math.floor(1000 + Math.random() * 9000),
      staffName: activeSession.name,
      role: activeSession.role,
      type,
      date,
      reason,
      status: 'Pending Admin Approval'
    };

    staffLeaveRequests.unshift(leaveObj);
    localStorage.setItem('hms_leave_db', JSON.stringify(staffLeaveRequests));
    renderLeaveTables();
    alert(`Your ${type} request for ${date} has been submitted successfully to Admin!`);
    e.target.reset();
  });

  function renderLeaveTables() {
    // Render My Requests for staff
    const myTbody = document.getElementById('myLeaveTableBody');
    if (myTbody && activeSession.role !== 'admin') {
      const myReqs = staffLeaveRequests.filter(r => r.staffName === activeSession.name);
      if (myReqs.length === 0) {
        myTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #a0aec0;">No requests submitted yet.</td></tr>`;
      } else {
        myTbody.innerHTML = myReqs.map(r => `
          <tr>
            <td><b>${r.id}</b></td>
            <td><span style="background:#edf2f7; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:11px;">${r.type}</span></td>
            <td>${r.date}</td>
            <td>${r.reason}</td>
            <td><span style="color:${r.status.includes('Approved') ? '#38a169' : (r.status.includes('Rejected') ? '#e53e3e' : '#d69e2e')}; font-weight:bold;">${r.status}</span></td>
          </tr>
        `).join('');
      }
    }

    // Render Admin Approvals Table
    const adminTbody = document.getElementById('adminLeaveTableBody');
    if (adminTbody && activeSession.role === 'admin') {
      const pendingReqs = staffLeaveRequests.filter(r => r.status.includes('Pending'));
      if (pendingReqs.length === 0) {
        adminTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #a0aec0;">No pending staff leave or weekly-off applications.</td></tr>`;
      } else {
        adminTbody.innerHTML = pendingReqs.map((r, index) => `
          <tr>
            <td><strong>${r.staffName}</strong></td>
            <td><span style="background:#edf2f7; padding:3px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase; font-size:11px;">${r.role.replace('_', ' ')}</span></td>
            <td><b>${r.type}</b></td>
            <td>${r.date}</td>
            <td>${r.reason}</td>
            <td>
              <button class="btn btn-success" style="padding:4px 10px; font-size:11px; margin-right:5px;" onclick="handleLeaveApproval('${r.id}', 'Approved')">Approve</button>
              <button class="btn btn-danger" style="padding:4px 10px; font-size:11px; width:auto;" onclick="handleLeaveApproval('${r.id}', 'Rejected')">Reject</button>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  function handleLeaveApproval(reqId, decision) {
    const req = staffLeaveRequests.find(r => r.id === reqId);
    if (!req) return;

    req.status = decision === 'Approved' ? 'Approved by Admin' : 'Rejected by Admin';
    localStorage.setItem('hms_leave_db', JSON.stringify(staffLeaveRequests));

    // Send notification to respective staff
    if (!staffNotifications[req.staffName]) {
      staffNotifications[req.staffName] = [];
    }
    const notifText = `Your ${req.type} request for ${req.date} has been <b>${decision.toLowerCase()}</b> by Admin.`;
    staffNotifications[req.staffName].unshift({
      id: Date.now(),
      text: notifText,
      time: new Date().toLocaleTimeString(),
      read: false
    });
    localStorage.setItem('hms_notifications_db', JSON.stringify(staffNotifications));

    renderLeaveTables();
    alert(`Request ${reqId} has been ${decision.toLowerCase()}. Notification sent to ${req.staffName}.`);
  }

  function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notifDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    
    // Mark notifications as read when opened
    if (dropdown.style.display === 'block' && activeSession) {
      const userNotifs = staffNotifications[activeSession.name] || [];
      userNotifs.forEach(n => n.read = true);
      localStorage.setItem('hms_notifications_db', JSON.stringify(staffNotifications));
      renderNotifications();
    }
  }

  function renderNotifications() {
    if (!activeSession) return;
    const userNotifs = staffNotifications[activeSession.name] || [];
    const badge = document.getElementById('notifBadge');
    const listContent = document.getElementById('notifListContent');

    const unreadCount = userNotifs.filter(n => !n.read).length;
    if (unreadCount > 0) {
      badge.style.display = 'inline-block';
      badge.innerText = unreadCount;
    } else {
      badge.style.display = 'none';
    }

    if (userNotifs.length === 0) {
      listContent.innerHTML = `<div style="color: #a0aec0; font-size: 12px; text-align: center;">No new notifications.</div>`;
    } else {
      listContent.innerHTML = userNotifs.map(n => `
        <div class="notif-item">
          <div>${n.text}</div>
          <div style="font-size: 10px; color: #a0aec0; margin-top: 2px; text-align: right;">${n.time}</div>
        </div>
      `).join('');
    }
  }

  // Staff registration & dismissal
  document.getElementById('addStaffForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('newStaffName').value.trim();
    const pass = document.getElementById('newStaffPass').value.trim();
    const role = document.getElementById('newStaffRole').value;

    staffList.push({ name, pass, role });
    localStorage.setItem('hms_staff_db', JSON.stringify(staffList));
    renderStaffDirectory();
    updateFinancialDashboard();
    alert(`Staff account created & saved for ${name} as ${role}!`);
    e.target.reset();
  });

  function dismissStaff(index) {
    const target = staffList[index];
    if (confirm(`Are you sure you want to dismiss/remove staff member ${target.name} (${target.role})?`)) {
      staffList.splice(index, 1);
      localStorage.setItem('hms_staff_db', JSON.stringify(staffList));
      renderStaffDirectory();
      updateFinancialDashboard();
      alert('Staff member successfully dismissed.');
    }
  }

  function renderStaffDirectory() {
    const tbody = document.getElementById('staffDirectoryTable');
    if(!tbody) return;
    if(staffList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#a0aec0;">No staff accounts added yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = staffList.map((s, index) => {
      const salary = salaryMap[s.role] || 0;
      return `
        <tr>
          <td><strong>${s.name}</strong></td>
          <td><code>${s.pass}</code></td>
          <td><span style="background:#edf2f7; padding:3px 8px; border-radius:4px; font-weight:bold; text-transform:uppercase; font-size:11px;">${s.role.replace('_', ' ')}</span></td>
          <td><b style="color:#e53e3e;">₹${salary.toLocaleString()} / day</b></td>
          <td><button class="btn btn-danger" style="padding:4px 10px; font-size:11px; width:auto;" onclick="dismissStaff(${index})">Dismiss Staff</button></td>
        </tr>
      `;
    }).join('');
  }

  // Manual expense entry by Admin
  document.getElementById('addExpenseForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const title = document.getElementById('expenseTitle').value.trim();
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;

    manualExpenses.push({ title, amount, date: new Date().toLocaleDateString() });
    localStorage.setItem('hms_expenses_db', JSON.stringify(manualExpenses));
    renderExpensePreview();
    updateFinancialDashboard();
    alert(`Manual expense of ₹${amount} recorded for "${title}"!`);
    e.target.reset();
  });

  function renderExpensePreview() {
    const box = document.getElementById('expenseListPreview');
    if (!box) return;
    if (manualExpenses.length === 0) {
      box.innerHTML = `<span style="color: #a0aec0;">No manual expenses recorded yet.</span>`;
      return;
    }
    box.innerHTML = `<b>Recorded Expenses:</b><br>` + manualExpenses.map((ex, idx) => `• ${ex.title}: ₹${ex.amount} (${ex.date}) <button style="color:red; background:none; border:none; cursor:pointer;" onclick="removeExpense(${idx})">[Remove]</button>`).join('<br>');
  }

  function removeExpense(idx) {
    manualExpenses.splice(idx, 1);
    localStorage.setItem('hms_expenses_db', JSON.stringify(manualExpenses));
    renderExpensePreview();
    updateFinancialDashboard();
  }

  function searchPatientCaseById() {
    const query = document.getElementById('srPatientSearchInput').value.trim().toLowerCase();
    const resBox = document.getElementById('srSearchResultBox');

    if (!query) {
      alert('Please enter a Patient ID, OPD/IP Token, or Name.');
      return;
    }

    const recMatches = storedReception.filter(r => r.token.toLowerCase().includes(query) || r.name.toLowerCase().includes(query));
    const caseMatches = storedCases.filter(c => c.patient.toLowerCase().includes(query));
    const wardMatches = storedWards.filter(w => w.token?.toLowerCase().includes(query) || w.name?.toLowerCase().includes(query));
    const diagMatches = diagnosticOrders.filter(d => d.patient.toLowerCase().includes(query) || d.id.toLowerCase().includes(query));
    const rxMatches = pharmacyOrders.filter(rx => rx.patient.toLowerCase().includes(query) || rx.id.toLowerCase().includes(query));

    if (recMatches.length === 0 && caseMatches.length === 0 && wardMatches.length === 0 && diagMatches.length === 0 && rxMatches.length === 0) {
      resBox.style.display = 'block';
      resBox.innerHTML = `<p style="color: #e53e3e; font-weight: bold;">No records found for Patient ID / Token: "${query}"</p>`;
      return;
    }

    let reportHtml = `<h4 style="color: #2b6cb0; margin-bottom: 12px; border-bottom: 1px solid #edf2f7; padding-bottom: 6px;">📋 Comprehensive Case Record & Discharge Control for ID: "${query.toUpperCase()}"</h4>`;

    if (recMatches.length > 0) {
      reportHtml += `<p style="font-weight: bold; color: #4a5568; margin-top: 8px;">Registration Records (OP/IP):</p><ul>`;
      recMatches.forEach(r => {
        reportHtml += `<li>Token: <b>${r.token}</b> | Name: ${r.name} (${r.ag}) | Type: <span style="color:${r.type === 'IP' ? '#c05621' : '#2b6cb0'}; font-weight:bold;">${r.type}</span> | Scheme: ${r.paymentScheme} | Fee: <b>${r.feeCollected || '₹0'}</b> | Status: <b>${r.status}</b>`;
        if (!r.status.includes('Discharged')) {
          reportHtml += ` <button class="btn btn-danger" style="padding:2px 8px; font-size:11px; width:auto; display:inline-block; margin-left:10px;" onclick="executeDischargeByToken('${r.token}')">Discharge Patient</button>`;
        }
        reportHtml += `</li>`;
      });
      reportHtml += `</ul>`;
    }

    if (wardMatches.length > 0) {
      reportHtml += `<p style="font-weight: bold; color: #4a5568; margin-top: 8px;">Ward, Bed & Attender Details:</p><ul>`;
      wardMatches.forEach(w => {
        reportHtml += `<li>Bed: <b>${w.bed}</b> | Attender: <b>${w.attenderName} (${w.attenderPhone})</b> | Billing: <b>${w.billingSummary}</b> | Belongings: ${w.belongings}</li>`;
      });
      reportHtml += `</ul>`;
    }

    if (diagMatches.length > 0) {
      reportHtml += `<p style="font-weight: bold; color: #4a5568; margin-top: 8px;">Diagnostic Tests & Scans:</p><ul>`;
      diagMatches.forEach(d => {
        reportHtml += `<li>Order ID: <b>${d.id}</b> | Type: ${d.dest} | Test/Scan: ${d.testName} | Wholesale: ₹${d.baseCost} | Profit: ₹${d.profit} | Billed: <b>₹${d.totalBilled}</b></li>`;
      });
      reportHtml += `</ul>`;
    }

    if (rxMatches.length > 0) {
      reportHtml += `<p style="font-weight: bold; color: #4a5568; margin-top: 8px;">Pharmacy Dispensing:</p><ul>`;
      rxMatches.forEach(rx => {
        reportHtml += `<li>Rx ID: <b>${rx.id}</b> | Medicine: ${rx.medName} | Sheets: ${rx.sheets} | Total Billed: <b>₹${rx.totalBilled}</b></li>`;
      });
      reportHtml += `</ul>`;
    }

    resBox.style.display = 'block';
    resBox.innerHTML = reportHtml;
  }

  function executeDischargeByToken(token) {
    const item = storedReception.find(r => r.token.toLowerCase() === token.toLowerCase());
    if (!item) {
      alert(`Patient token ${token} not found in registration logs.`);
      return;
    }

    if (item.type === 'IP') {
      alert(`IP Discharge Rule: Attender must pay the entire bill at the reception desk before discharge for patient ${item.name} (${item.token}).`);
    }

    if (confirm(`Are you sure you want to discharge patient ${item.name} (${item.token})? This will update their record status and clear allocated beds.`)) {
      item.status = `Discharged (${activeSession.name})`;
      localStorage.setItem('hms_reception_db', JSON.stringify(storedReception));

      storedWards = storedWards.filter(w => w.token.toLowerCase() !== token.toLowerCase());
      localStorage.setItem('hms_wards_db', JSON.stringify(storedWards));

      renderReceptionTable();
      renderWardTables();
      updateFinancialDashboard();
      alert(`Patient ${item.token} successfully discharged by ${activeSession.name}!`);
      
      if (activeSession.role === 'sr_doctor' || activeSession.role === 'admin') {
        searchPatientCaseById();
      }
    }
  }

  function adminExecuteDischarge() {
    const query = document.getElementById('adminSearchInput').value.trim();
    if (!query) {
      alert('Please enter a Patient Token / ID to discharge.');
      return;
    }
    executeDischargeByToken(query);
    document.getElementById('adminSearchInput').value = '';
  }

  function adminRemoveEmergencyPatient() {
    const query = document.getElementById('adminEmergencySearchInput').value.trim().toLowerCase();
    if (!query) {
      alert('Please enter an Emergency Patient Token or Name to remove.');
      return;
    }

    const initialLength = storedCases.length;
    storedCases = storedCases.filter(c => !c.patient.toLowerCase().includes(query) && !c.incident_type.toLowerCase().includes(query));

    if (storedCases.length === initialLength) {
      alert(`No emergency patient record matching "${query}" was found.`);
      return;
    }

    localStorage.setItem('hms_cases_db', JSON.stringify(storedCases));
    renderDoctorTable();
    renderAdminEmergencyPreview();
    document.getElementById('adminEmergencySearchInput').value = '';
    alert(`Emergency patient record matching "${query}" has been successfully removed by Admin.`);
  }

  function renderAdminEmergencyPreview() {
    const previewBox = document.getElementById('adminEmergencyListPreview');
    if (!previewBox) return;

    if (storedCases.length === 0) {
      previewBox.innerHTML = `<p style="font-size: 13px; color: #a0aec0;">No active emergency cases logged.</p>`;
      return;
    }

    previewBox.innerHTML = `<p style="font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #4a5568;">Active Emergency Cases (Click to remove):</p>` +
      storedCases.map((c, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 12px; margin-bottom: 6px; border-radius: 4px; border: 1px solid #cbd5e0; font-size: 13px;">
          <span><b>${c.patient}</b> — ${c.incident_type} (${c.date} ${c.time})</span>
          <button class="btn btn-danger" style="padding: 3px 10px; font-size: 11px; width: auto;" onclick="removeEmergencyIndex(${index})">Remove</button>
        </div>
      `).join('');
  }

  function removeEmergencyIndex(index) {
    const target = storedCases[index];
    if (confirm(`Are you sure you want to remove emergency record for ${target.patient} (${target.incident_type})?`)) {
      storedCases.splice(index, 1);
      localStorage.setItem('hms_cases_db', JSON.stringify(storedCases));
      renderDoctorTable();
      renderAdminEmergencyPreview();
      alert('Emergency record successfully deleted.');
    }
  }

  function toggleIpFields() {
    const type = document.getElementById('recType').value;
    const ipSec = document.getElementById('ipBelongingsSection');
    const opFeeField = document.getElementById('opFeeField');
    const submitBtn = document.getElementById('recSubmitBtn');
    if (type === 'IP') {
      ipSec.style.display = 'block';
      opFeeField.style.display = 'none';
      submitBtn.innerText = 'Register IP & Send File to Ward In-Charge';
      submitBtn.style.background = '#dd6b20';
    } else {
      ipSec.style.display = 'none';
      opFeeField.style.display = 'block';
      submitBtn.innerText = 'Generate Token & Record Registration';
      submitBtn.style.background = '#3182ce';
    }
  }

  document.getElementById('receptionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const type = document.getElementById('recType').value;
    const paymentScheme = document.getElementById('recPaymentScheme').value;

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const serial = Math.floor(100 + Math.random() * 900);

    let token = "";
    if (type === 'OP') {
      token = `${dd}${mm}${serial}`;
    } else {
      token = `${mm}${yy}${serial}`;
    }

    const name = document.getElementById('recName').value.trim();
    const ag = document.getElementById('recAgeGender').value.trim();
    const phone = document.getElementById('recPhone').value.trim();
    const dept = document.getElementById('recDept').value;

    let recObj = {
      token,
      name,
      ag,
      phone,
      dept,
      type,
      paymentScheme,
      feeCollected: type === 'OP' ? (paymentScheme === 'GovtScheme' ? '₹350 (Govt Scheme Exempted)' : '₹350 Collected') : 'N/A (IP)',
      status: type === 'IP' ? 'Pending Bed Allocation & Attender' : 'Consultation Queue'
    };

    if (paymentScheme === 'GovtScheme') {
      alert(`⚠️ Government Scheme patient detected! Please note that this patient should approach Receptionist 2. Entry has been logged for government reimbursement.`);
    }

    if (type === 'IP') {
      const days = parseInt(document.getElementById('recIpDays').value) || 1;
      recObj.ipDays = days;
      const roomTotal = 1000 * days;
      const serviceTotal = 500;
      const admissionTotal = 500;
      const totalIpCost = admissionTotal + roomTotal + serviceTotal;

      recObj.feeCollected = paymentScheme === 'GovtScheme' ? `Govt Scheme IPD (Total: ₹${totalIpCost})` : `Admission: ₹500 + Room: ₹1,000×${days} + Service: ₹500 (Total: ₹${totalIpCost})`;
      recObj.belongings = {
        valuables: document.getElementById('recValuables').value.trim() || 'None declared',
        luggage: document.getElementById('recLuggage').value.trim() || 'None',
        electronics: document.getElementById('recElectronics').value.trim() || 'None'
      };
    }

    storedReception.unshift(recObj);
    localStorage.setItem('hms_reception_db', JSON.stringify(storedReception));

    renderReceptionTable();
    renderWardTables();
    updateFinancialDashboard();

    alert(`${type === 'IP' ? 'In-Patient (IP) file created with ID ' + token + ' and forwarded to Ward In-Charge!' : 'Token Generated: ' + token}`);
    e.target.reset();
    toggleIpFields();
  });

  function renderReceptionTable() {
    const tbody = document.getElementById('receptionTableBody');
    if(!tbody) return;
    if(storedReception.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0;">No records found.</td></tr>`;
      return;
    }
    tbody.innerHTML = storedReception.map(o => `
      <tr>
        <td><b>${o.token}</b></td>
        <td>${o.name}</td>
        <td><span style="background:${o.type === 'IP' ? '#feebc8' : '#ebf8ff'}; color:${o.type === 'IP' ? '#c05621' : '#2b6cb0'}; padding:3px 6px; border-radius:4px; font-weight:bold; font-size:11px;">${o.type}</span></td>
        <td><span style="background:${o.paymentScheme === 'GovtScheme' ? '#e6fffa' : '#edf2f7'}; color:${o.paymentScheme === 'GovtScheme' ? '#234e52' : '#4a5568'}; padding:3px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${o.paymentScheme === 'GovtScheme' ? 'Govt Scheme' : 'Standard'}</span></td>
        <td>${o.type === 'IP' ? `IPD Stay (${o.ipDays || 1} Days) & Belongings` : o.dept}</td>
        <td><span style="color:${o.status.includes('Discharged') ? '#e53e3e' : (o.status.includes('Pending') ? '#d69e2e' : '#38a169')}; font-weight:bold;">${o.feeCollected} | ${o.status}</span></td>
      </tr>
    `).join('');
  }

  function allocateBed(token) {
    const item = storedReception.find(r => r.token === token);
    if (!item) return;

    const attenderName = prompt(`Enter IP Attender Name for patient ${item.name}:`, "John Attender");
    if (!attenderName) return;

    const attenderPhone = prompt(`Enter IP Attender Phone Number:`, "+1 555-9988");
    if (!attenderPhone) return;

    const bedNo = prompt(`Allocate Ward / Bed for patient ${item.name} (${item.token}):`, "Ward A - Bed 3");
    if (!bedNo) return;

    const careNote = prompt("Enter Dietary / Nursing Care Instructions:", "Standard Diet, Monitor Vitals");
    if (careNote === null) return;

    item.status = `Admitted to ${bedNo}`;
    localStorage.setItem('hms_reception_db', JSON.stringify(storedReception));

    const wardObj = {
      token: item.token,
      name: item.name,
      bed: bedNo,
      attenderName,
      attenderPhone,
      billingSummary: item.feeCollected,
      belongings: `Valuables: ${item.belongings.valuables} | Bags: ${item.belongings.luggage} | Devices: ${item.belongings.electronics}`,
      note: careNote,
      incharge: activeSession.name
    };

    storedWards.unshift(wardObj);
    localStorage.setItem('hms_wards_db', JSON.stringify(storedWards));

    renderReceptionTable();
    renderWardTables();
    updateFinancialDashboard();
    alert(`Successfully registered attender (${attenderName}) and allocated ${bedNo} for ${item.name}!`);
  }

  function renderWardTables() {
    const pendingTbody = document.getElementById('wardPendingTableBody');
    if (pendingTbody) {
      const pendingIPs = storedReception.filter(r => r.type === 'IP' && r.status.includes('Pending'));
      if (pendingIPs.length === 0) {
        pendingTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #a0aec0;">No pending IP admissions awaiting bed allocation.</td></tr>`;
      } else {
        pendingTbody.innerHTML = pendingIPs.map(i => `
          <tr>
            <td><b>${i.token}</b></td>
            <td><strong>${i.name}</strong></td>
            <td>${i.ag}</td>
            <td>${i.phone}</td>
            <td><code style="background:#f0fff4; color:#22543d; padding:4px; border-radius:4px; font-size:11px; display:block;">${i.feeCollected}</code></td>
            <td><code style="background:#fffaf0; color:#c05621; padding:4px; border-radius:4px; font-size:11px; display:block;">Valuables: ${i.belongings.valuables}<br>Luggage: ${i.belongings.luggage}<br>Devices: ${i.belongings.electronics}</code></td>
            <td><button class="btn btn-primary" style="padding:5px 12px; font-size:12px; background:#dd6b20;" onclick="allocateBed('${i.token}')">Register Attender & Allocate Bed</button></td>
          </tr>
        `).join('');
      }
    }

    const tbody = document.getElementById('wardTableBody');
    if (tbody) {
      if (storedWards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #a0aec0;">No active in-patients currently assigned beds.</td></tr>`;
        return;
      }
      tbody.innerHTML = storedWards.map(w => `
        <tr>
          <td><strong>${w.name}</strong> <small style="color:#718096">(${w.token})</small></td>
          <td><b>${w.bed}</b></td>
          <td><b>${w.attenderName}</b><br><small>${w.attenderPhone}</small></td>
          <td><code style="font-size:11px; color:#22543d; background:#f0fff4; padding:4px; border-radius:4px; display:block;">${w.billingSummary}</code></td>
          <td><span style="font-size:12px; color:#4a5568;">${w.belongings}</span></td>
          <td>${w.note}</td>
          <td><code>${w.incharge}</code></td>
        </tr>
      `).join('');
    }
  }

  // Pharmacy Form Submission with Wholesale + ₹30/sheet Profit Calculator
  document.getElementById('pharmacyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const patient = document.getElementById('rxPatient').value.trim();
    const medName = document.getElementById('rxMedName').value.trim();
    const baseCost = parseFloat(document.getElementById('rxBaseCost').value) || 0;
    const sheets = parseInt(document.getElementById('rxSheets').value) || 1;

    const profitPerSheet = 30;
    const totalProfit = profitPerSheet * sheets;
    const totalBilled = (baseCost + profitPerSheet) * sheets;

    const rxObj = {
      id: 'RX-' + Math.floor(1000 + Math.random() * 9000),
      patient,
      medName,
      sheets,
      baseCost: baseCost * sheets,
      profit: totalProfit,
      totalBilled,
      status: 'Dispensed & Paid'
    };

    pharmacyOrders.unshift(rxObj);
    localStorage.setItem('hms_pharmacy_db', JSON.stringify(pharmacyOrders));
    renderPharmacyTable();
    updateFinancialDashboard();

    alert(`Prescription billed for ${patient}! Wholesale: ₹${baseCost * sheets} + Profit (₹30 × ${sheets} sheets = ₹${totalProfit}) = Total Billed: ₹${totalBilled}`);
    e.target.reset();
  });

  function renderPharmacyTable() {
    const tbody = document.getElementById('pharmacyTableBody');
    if(!tbody) return;
    if(pharmacyOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #a0aec0;">No pharmacy sales recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = pharmacyOrders.map(rx => `
      <tr>
        <td><b>${rx.id}</b></td>
        <td><strong>${rx.patient}</strong></td>
        <td>${rx.medName}</td>
        <td>${rx.sheets} sheet(s)</td>
        <td>₹${rx.baseCost}</td>
        <td><b style="color:#38a169;">+₹${rx.profit}</b></td>
        <td><b style="color:#2b6cb0;">₹${rx.totalBilled}</b></td>
        <td><span style="color:#38a169; font-weight:bold;">${rx.status}</span></td>
      </tr>
    `).join('');
  }

  // Doctor Suggest Diagnostic Form with ₹350 profit (Blood Test) and ₹1000 profit (Scan)
  document.getElementById('doctorSuggestForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const patient = document.getElementById('docPatientRef').value.trim();
    const dest = document.getElementById('docDestFacility').value;
    const testName = document.getElementById('docTestName').value.trim();
    const baseCost = parseFloat(document.getElementById('docTestCost').value) || 0;

    let profit = 0;
    if (dest === 'Lab') {
      profit = 350;
    } else if (dest === 'Scan Lab') {
      profit = 1000;
    }
    const totalBilled = baseCost + profit;

    const orderObj = {
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      patient,
      dest,
      testName,
      baseCost,
      profit,
      totalBilled,
      status: 'Pending Test',
      doctor: activeSession.name
    };

    diagnosticOrders.unshift(orderObj);
    localStorage.setItem('hms_diagnostics_db', JSON.stringify(diagnosticOrders));
    renderLabTables();
    updateFinancialDashboard();

    alert(`Successfully sent ${testName} order to ${dest}! Wholesale: ₹${baseCost} + Profit: ₹${profit} = Total Billed: ₹${totalBilled}`);
    e.target.reset();
  });

  function renderLabTables() {
    const bloodTbody = document.getElementById('bloodLabTableBody');
    if (bloodTbody) {
      const bloodItems = diagnosticOrders.filter(o => o.dest === 'Lab');
      if (bloodItems.length === 0) {
        bloodTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #a0aec0;">No pending blood lab requests.</td></tr>`;
      } else {
        bloodTbody.innerHTML = bloodItems.map(o => `
          <tr>
            <td><b>${o.id}</b></td>
            <td><strong>${o.patient}</strong></td>
            <td>${o.testName}</td>
            <td>₹${o.baseCost}</td>
            <td><b style="color:#38a169;">+₹${o.profit}</b></td>
            <td><b style="color:#2b6cb0;">₹${o.totalBilled}</b></td>
            <td><span style="color:${o.status === 'Completed' ? '#38a169' : '#d69e2e'}; font-weight:bold;">${o.status}</span></td>
            <td>${o.status === 'Pending Test' ? `<button class="btn btn-primary" style="padding:4px 10px; font-size:12px;" onclick="completeOrder('${o.id}')">Mark Complete</button>` : 'Done'}</td>
          </tr>
        `).join('');
      }
    }

    const scanTbody = document.getElementById('scanLabTableBody');
    if (scanTbody) {
      const scanItems = diagnosticOrders.filter(o => o.dest === 'Scan Lab');
      if (scanItems.length === 0) {
        scanTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #a0aec0;">No pending scan requests.</td></tr>`;
      } else {
        scanTbody.innerHTML = scanItems.map(o => `
          <tr>
            <td><b>${o.id}</b></td>
            <td><strong>${o.patient}</strong></td>
            <td>${o.testName}</td>
            <td>₹${o.baseCost}</td>
            <td><b style="color:#38a169;">+₹${o.profit}</b></td>
            <td><b style="color:#2b6cb0;">₹${o.totalBilled}</b></td>
            <td><span style="color:${o.status === 'Completed' ? '#38a169' : '#d69e2e'}; font-weight:bold;">${o.status}</span></td>
            <td>${o.status === 'Pending Test' ? `<button class="btn btn-primary" style="padding:4px 10px; font-size:12px;" onclick="completeOrder('${o.id}')">Mark Complete</button>` : 'Done'}</td>
          </tr>
        `).join('');
      }
    }
  }

  function completeOrder(orderId) {
    const item = diagnosticOrders.find(o => o.id === orderId);
    if (item) {
      item.status = 'Completed';
      localStorage.setItem('hms_diagnostics_db', JSON.stringify(diagnosticOrders));
      renderLabTables();
      updateFinancialDashboard();
    }
  }

  document.getElementById('emergencyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const now = new Date();

    const payload = {
      patient: document.getElementById('patientToken').value || 'Unidentified Patient',
      who_admitted: formData.get('who_admitted'),
      incident_type: formData.get('incident_type'),
      case_status: formData.get('case_status'),
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      location: currentLocationStamp,
      logged_by: activeSession.name
    };

    storedCases.unshift(payload);
    localStorage.setItem('hms_cases_db', JSON.stringify(storedCases));
    emergencyChannel.postMessage(payload);

    const sMsg = document.getElementById('successMsg');
    sMsg.style.display = 'block';
    setTimeout(() => { sMsg.style.display = 'none'; }, 3500);
    e.target.reset();
  });

  emergencyChannel.onmessage = (event) => {
    const data = event.data;
    storedCases.unshift(data);
    renderDoctorTable();
    renderAdminEmergencyPreview();

    if (activeSession && (activeSession.role === 'doctor' || activeSession.role === 'sr_doctor')) {
      showAlertModal(data);
    }
  };

  function showAlertModal(data) {
    document.getElementById('m_patient').innerText = data.patient;
    document.getElementById('m_datetime').innerText = `${data.date} at ${data.time}`;
    document.getElementById('m_location').innerText = data.location;
    document.getElementById('m_who').innerText = data.who_admitted;
    document.getElementById('m_incident').innerText = data.incident_type;
    document.getElementById('m_status').innerText = data.case_status;

    document.getElementById('alertModal').style.display = 'flex';
    try {
      const audio = new Audio('https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3');
      audio.play();
    } catch(e) {}
  }

  function closeAlertModal() { document.getElementById('alertModal').style.display = 'none'; }

  function renderDoctorTable() {
    const tbody = document.getElementById('doctorTableBody');
    if(!tbody) return;
    if(storedCases.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #a0aec0;">No emergency cases logged yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = storedCases.map(c => `
      <tr>
        <td><b>${c.date}</b><br>${c.time}</td>
        <td>${c.location}</td>
        <td><strong>${c.patient}</strong></td>
        <td><span style="color:#e53e3e; font-weight:bold;">${c.incident_type}</span></td>
        <td>${c.who_admitted}</td>
        <td>${c.case_status}</td>
      </tr>
    `).join('');
  }

  if (activeSession) {
    initSystemSession();
  }