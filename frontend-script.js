// ============================================================================
// TrackFlow AI — Production Frontend Client
// Connected to TrackFlow Supabase Backend (http://localhost:3000)
// ============================================================================

const API_BASE = window.TRACKFLOW_API_URL || 'http://localhost:3000';

const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

const views = {
  home: $('#homeView'),
  dashboard: $('#dashboardView'),
  applications: $('#applicationsView'),
  admin: $('#adminView')
};

// Application state
const state = {
  token: localStorage.getItem('trackflow_token') || null,
  user: null,
  myApplications: [],
  selectedApp: null,
  notifications: [],
  adminOverview: null,
  adminCases: [],
  selectedCase: null
};

// UI Toast Notification
function toast(m, isError = false) {
  let t = $('#tfToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'tfToast';
    t.className = 'tf-toast';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.style.borderColor = isError ? '#ff4d4f' : '';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3500);
}

// API Helper
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  // Remove Content-Type for FormData uploads
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    const json = await res.json();
    if (!res.ok || json.success === false) {
      const err = new Error(json.error?.message || 'Server request failed');
      err.code = json.error?.code;
      err.status = res.status;
      throw err;
    }
    return json.data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

// Global Auth helpers
function currentUser() {
  return state.user;
}

function refreshAccountUI() {
  const u = currentUser();
  const avatar = $('.avatar');
  const userBtn = $('#userBtn');
  const menuName = $('#menuName');
  const menuEmail = $('#menuEmail');

  if (u) {
    const initials = (u.full_name || u.name || 'User')
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    if (avatar) avatar.textContent = initials;
    if (menuName) menuName.textContent = u.full_name || u.name;
    if (menuEmail) menuEmail.textContent = u.email;
    if (userBtn) {
      userBtn.innerHTML = `<span class="avatar">${initials}</span> <span>${(u.full_name || u.name).split(' ')[0]}</span>`;
    }
  } else {
    if (userBtn) {
      userBtn.innerHTML = `<i class="fa-regular fa-user"></i> <span>Sign in</span>`;
    }
  }
}

// Navigation
let pendingView = null;
function showView(name) {
  const u = currentUser();
  if (name === 'dashboard' && !u) {
    pendingView = 'dashboard';
    openAuth('login');
    return;
  }
  if ((name === 'admin' || name === 'insights') && !u) {
    pendingView = 'insights';
    openAuth('login');
    return;
  }

  const t = name === 'insights' ? 'admin' : name;
  Object.entries(views).forEach(([k, el]) => el?.classList.toggle('hidden-view', k !== t));
  $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.view === (name === 'admin' ? 'insights' : name)));
  $('#stats').style.display = t === 'dashboard' ? 'none' : '';

  if (t === 'dashboard') loadDashboard();
  if (t === 'applications') loadApplications();
  if (t === 'admin') loadAdmin();
  if (t === 'home') startStats();
  closeMenu();
}

window.showView = showView;

// Mobile menu
const burger = $('#burger'), menu = $('#mobileMenu'), overlay = $('#mobileOverlay');
function openMenu() { if(menu) menu.hidden = false; if(overlay) overlay.style.display = 'block'; burger?.classList.add('active'); }
function closeMenu() { if(menu) menu.hidden = true; if(overlay) overlay.style.display = ''; burger?.classList.remove('active'); }
burger?.addEventListener('click', () => menu && !menu.hidden ? closeMenu() : openMenu());
overlay?.addEventListener('click', closeMenu);
$$('#mobileMenu button[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
$('#mobileSignIn')?.addEventListener('click', () => { closeMenu(); openAuth('login'); });

// Stats counters animation on home
let statsStarted = false;
function animateNumber(el, target, decimals, duration) {
  const st = performance.now();
  function f(now) {
    const p = Math.min((now - st) / duration, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * e).toFixed(decimals);
    if (p < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}

function startStats() {
  if (statsStarted) return;
  statsStarted = true;
  $$('.stat strong').forEach(el => {
    animateNumber(el, +el.dataset.target, +el.dataset.decimals, 1400);
  });
}

function startCounters() {
  $$('#adminStatic .metric b').forEach((e, i) => {
    if (e.dataset.started) return;
    e.dataset.started = '1';
    setTimeout(() => animateNumber(e, +e.dataset.count, 0, 1100), 150 + i * 100);
  });
}

// Auth modal handling
function cap(s) { return String(s).replace(/^./, c => c.toUpperCase()); }

function showAuth(mode) {
  ['login', 'register', 'reset'].forEach(k => {
    const el = $('#auth' + cap(k));
    if (el) el.classList.toggle('hidden-ui', k !== mode);
  });
  $('#authTabs')?.classList.toggle('hidden-ui', mode === 'reset');
  $$('#authTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === mode));
}

function openAuth(mode = 'login') {
  $('#authBackdrop').hidden = false;
  $('.lp-video')?.play?.().catch(() => {});
  showAuth(mode);
  setTimeout(() => {
    $(mode === 'login' ? '#loginEmail' : '#registerName')?.focus();
  }, 100);
}
window.openAuth = openAuth;

function closeAuth() {
  $('#authBackdrop').hidden = true;
}

let loginRole = 'citizen';
$$('#roleToggle button').forEach(b => b.addEventListener('click', () => {
  loginRole = b.dataset.role;
  $$('#roleToggle button').forEach(x => x.classList.toggle('active', x === b));
}));

$$('#authTabs button').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.tab)));
$$('[data-goto]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.goto)));
$('#backToLogin')?.addEventListener('click', () => showAuth('login'));

$('#pwShow')?.addEventListener('click', e => {
  const i = $('#loginPassword');
  const h = i.type === 'password';
  i.type = h ? 'text' : 'password';
  e.target.textContent = h ? 'Hide' : 'Show';
});

// Demo accounts prefill
$$('[data-demo]').forEach(b => b.addEventListener('click', () => {
  const isAdm = b.dataset.demo === 'admin';
  $('#loginEmail').value = isAdm ? 'admin@trackflow.ai' : 'demo@trackflow.ai';
  $('#loginPassword').value = isAdm ? 'adminPassword123!' : 'demoPassword123!';
  loginRole = isAdm ? 'admin' : 'citizen';
  $$('#roleToggle button').forEach(x => x.classList.toggle('active', x.dataset.role === loginRole));
}));

// Password strength indicator
$('#registerPassword')?.addEventListener('input', e => {
  const p = e.target.value;
  const s = (p.length >= 8) + /\d/.test(p) + /[^\w\s]/.test(p) + (/[a-z]/.test(p) && /[A-Z]/.test(p));
  $('#pwBar').style.width = s * 25 + '%';
  $('#pwNote').textContent = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][s] || 'Too weak';
});

// Sign In Action
$('#loginBtn')?.addEventListener('click', async () => {
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;

  if (!email || !password) {
    toast('Enter your email and password.', true);
    return;
  }

  try {
    $('#loginBtn').textContent = 'Signing in...';
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.token = data.token;
    state.user = data.user;
    if ($('#rememberMe')?.checked) {
      localStorage.setItem('trackflow_token', data.token);
    } else {
      sessionStorage.setItem('trackflow_token', data.token);
      localStorage.setItem('trackflow_token', data.token);
    }

    refreshAccountUI();
    closeAuth();
    toast(`Signed in as ${data.user.full_name || data.user.email}`);

    const target = pendingView || (data.user.role === 'admin' ? 'insights' : 'dashboard');
    pendingView = null;
    showView(target);
  } catch (err) {
    toast(err.message || 'Login failed. Check credentials.', true);
  } finally {
    $('#loginBtn').textContent = 'Log In →';
  }
});

// Register Action
$('#registerBtn')?.addEventListener('click', async () => {
  const full_name = $('#registerName').value.trim();
  const email = $('#registerEmail').value.trim();
  const role = $('#registerRole').value;
  const phone = $('#registerPhone').value.trim();
  const notification_preference = $('#registerNotify').value;
  const password = $('#registerPassword').value;
  const confirm = $('#registerConfirm').value;

  if (!full_name || !email) {
    toast('Please fill in your name and email.', true);
    return;
  }
  if (password.length < 8) {
    toast('Password must be at least 8 characters.', true);
    return;
  }
  if (password !== confirm) {
    toast('Passwords do not match.', true);
    return;
  }
  if (!$('#registerConsent')?.checked) {
    toast('Please agree to the Terms and Privacy Policy.', true);
    return;
  }

  try {
    $('#registerBtn').textContent = 'Creating account...';
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name,
        email,
        password,
        role: role === 'student' ? 'citizen' : role,
        phone,
        notification_preference
      })
    });

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('trackflow_token', data.token);

    refreshAccountUI();
    closeAuth();
    toast(`Account created! Welcome, ${full_name.split(' ')[0]}.`);
    showView('dashboard');
  } catch (err) {
    toast(err.message || 'Registration failed.', true);
  } finally {
    $('#registerBtn').textContent = 'Create account';
  }
});

// Reset Password
$('#resetBtn')?.addEventListener('click', async () => {
  const email = $('#resetEmail').value.trim();
  if (!email) {
    toast('Enter your email.', true);
    return;
  }
  try {
    await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    toast('Password recovery instructions sent to your email.');
    showAuth('login');
  } catch (err) {
    toast(err.message || 'Error requesting password reset.', true);
  }
});

// Guest Demo Login
$('#guestBtn')?.addEventListener('click', async () => {
  try {
    $('#loginEmail').value = 'demo@trackflow.ai';
    $('#loginPassword').value = 'demoPassword123!';
    $('#loginBtn').click();
  } catch (e) {
    toast('Unable to sign in as guest.');
  }
});

// Logout
$('#logoutBtn')?.addEventListener('click', async () => {
  try {
    if (state.token) {
      await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    }
  } finally {
    state.token = null;
    state.user = null;
    state.myApplications = [];
    localStorage.removeItem('trackflow_token');
    sessionStorage.removeItem('trackflow_token');
    refreshAccountUI();
    $('#accountMenu')?.classList.add('hidden-ui');
    showView('home');
    openAuth('login');
    toast('Signed out successfully.');
  }
});

// User menu toggle
$('#userBtn')?.addEventListener('click', e => {
  e.stopPropagation();
  if (!currentUser()) {
    openAuth('login');
    return;
  }
  $('#accountMenu')?.classList.toggle('hidden-ui');
});

document.addEventListener('click', e => {
  if (!e.target.closest('#accountMenu') && !e.target.closest('#userBtn')) {
    $('#accountMenu')?.classList.add('hidden-ui');
  }
});

// Service icons mapping
const SV_ICONS = {
  'Scholarship': '🎓',
  'Certificate': '📄',
  'Reimbursement': '💰',
  'Admission': '🏫',
  'Approval': '🛂',
  'Grievance': '💬'
};

const STAGE_ORDER = [
  'Submitted',
  'Document Verification',
  'Department Review',
  'Officer Approval',
  'Finance Verification',
  'Completed'
];

// ============================================================================
// DASHBOARD VIEW
// ============================================================================
async function loadDashboard() {
  const u = currentUser();
  if (!u) return;

  const hr = new Date().getHours();
  const greeting = hr < 12 ? 'Good morning, ' : hr < 18 ? 'Good afternoon, ' : 'Good evening, ';
  const h2 = $('#dashboardView h2');
  if (h2 && h2.firstChild) h2.firstChild.textContent = greeting;
  if ($('#dashboardUserName')) $('#dashboardUserName').textContent = (u.full_name || u.name || 'User').split(' ')[0];

  try {
    const [apps, notifs] = await Promise.all([
      apiRequest('/api/applications'),
      apiRequest('/api/notifications')
    ]);

    state.myApplications = apps;
    state.notifications = notifs;

    const completed = apps.filter(a => a.status === 'Completed' || a.current_stage === 'Completed');
    const delayed = apps.filter(a => a.status === 'Delayed');
    const actionReq = apps.filter(a => a.status === 'Action Required');
    const active = apps.filter(a => a.status !== 'Completed' && a.current_stage !== 'Completed');

    if ($('#dashActive')) $('#dashActive').textContent = active.length;
    if ($('#dashAction')) $('#dashAction').textContent = actionReq.length;
    if ($('#dashDelayed')) $('#dashDelayed').textContent = delayed.length;
    if ($('#dashCompleted')) $('#dashCompleted').textContent = completed.length;

    // Applications list
    const host = $('#dashboardApplicationList');
    if (host) {
      if (!apps.length) {
        host.innerHTML = '<div class="empty">No applications yet. Submit your first one to start tracking.</div>';
      } else {
        host.innerHTML = apps.map(a => {
          const ic = SV_ICONS[a.service_type] || '📄';
          const badgeClass = a.status === 'Completed' ? 'good' : a.status === 'Action Required' ? 'warn' : a.status === 'Delayed' ? 'risk' : 'good';
          const label = a.status === 'Completed' ? 'Completed' : a.status === 'Action Required' ? 'Action' : a.status === 'Delayed' ? 'Delayed' : 'On track';
          return `
            <button class="dashboard-app-row" data-id="${a.id}">
              <span class="dash-app-icon">${ic}</span>
              <span class="dash-app-main">
                <b>${escapeHtml(a.title || a.service_type)}</b>
                <small>${a.tracking_id} · ${escapeHtml(a.current_stage)}${a.status === 'Completed' ? '' : ` · day ${a.days_in_stage}`}</small>
              </span>
              <span class="dash-status ${badgeClass}">${label}</span>
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          `;
        }).join('');

        $$('.dashboard-app-row', host).forEach(r => {
          r.addEventListener('click', () => {
            state.selectedApp = state.myApplications.find(a => a.id === r.dataset.id);
            showView('applications');
          });
        });
      }
    }

    // Action Center
    const ac = $('.action-card');
    if (ac) {
      const itemsHtml = actionReq.map(a => `
        <div class="attention-item" style="margin-bottom:8px">
          <div class="attention-icon">!</div>
          <div>
            <b>${escapeHtml(a.title || a.service_type)}</b>
            <p>${a.delay_cause ? escapeHtml(a.delay_cause) : 'Missing required documentation'}</p>
            <small>${a.tracking_id} · ${escapeHtml(a.department)}</small>
          </div>
          <button class="mini-action" data-fix="${a.id}">Fix now</button>
        </div>
      `).join('');

      const safeHtml = active.filter(a => a.status !== 'Action Required').slice(0, 3).map(a => `
        <div class="attention-safe">
          <i class="fa-solid fa-circle-check"></i>
          <span>${escapeHtml(a.service_type)}: ${a.status === 'Delayed' ? 'delayed, but no action needed from you' : 'on track, no action needed'}.</span>
        </div>
      `).join('');

      ac.innerHTML = `
        <div class="dash-card-head">
          <div><span class="eyebrow">ACTION CENTER</span><h3>What needs your attention?</h3></div>
          <i class="fa-solid fa-bolt"></i>
        </div>
        ${itemsHtml}
        ${safeHtml}
      `;

      $$('[data-fix]', ac).forEach(b => b.addEventListener('click', () => fixApplicationAction(b.dataset.fix)));
    }

    // AI Prediction Mini Card
    const pm = $('.prediction-mini');
    if (pm) {
      const highestRiskApp = active.sort((x, y) => y.delay_risk - x.delay_risk)[0];
      if (highestRiskApp) {
        pm.innerHTML = `
          <div class="dash-card-head">
            <div><span class="eyebrow">AI PREDICTION</span><h3>Next Update</h3></div>
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <div class="prediction-mini-main">
            <strong>1–2 days</strong>
            <span>${escapeHtml(highestRiskApp.service_type)} · ${escapeHtml(highestRiskApp.current_stage)}</span>
            <em>${highestRiskApp.delay_risk}% delay risk · highest of your applications</em>
          </div>
          <div class="mini-risk"><span style="width:${highestRiskApp.delay_risk}%"></span></div>
          <p>Estimated from queue load, time already waited and earlier stage delays.</p>
        `;
      } else {
        pm.innerHTML = `
          <div class="dash-card-head">
            <div><span class="eyebrow">AI PREDICTION</span><h3>Next Update</h3></div>
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <p>No active applications to predict.</p>
        `;
      }
    }

    // Activity List
    const actList = $('.activity-list');
    if (actList) {
      actList.innerHTML = notifs.slice(0, 5).map(n => `
        <div>
          <span class="activity-dot"></span>
          <p>${escapeHtml(n.message || n.title)}<small>${formatTimeAgo(n.created_at)}</small></p>
        </div>
      `).join('') || '<div class="empty">No recent notifications.</div>';

      const unreadCount = notifs.filter(n => !n.is_read).length;
      $$('.badge').forEach(b => b.textContent = Math.min(9, unreadCount));
    }

  } catch (err) {
    toast('Error loading dashboard: ' + err.message, true);
  }
}

// "Fix now" action resolver
async function fixApplicationAction(appId) {
  try {
    await apiRequest(`/api/applications/${appId}/fix`, { method: 'POST' });
    toast('Attention item resolved! Review resumed.');
    loadDashboard();
    if (!$('#applicationsView').classList.contains('hidden-view')) {
      loadApplications();
    }
  } catch (e) {
    toast('Could not resolve action: ' + e.message, true);
  }
}

// Simulate Day Backend Button (Requirement #22)
(()=>{
  const box = $('.dashboard-actions');
  if (box && !$('#tickBtn')) {
    const t = document.createElement('button');
    t.className = 'mini-action secondary-action';
    t.id = 'tickBtn';
    t.innerHTML = '<i class="fa-solid fa-forward"></i> Simulate next day';
    t.addEventListener('click', async () => {
      try {
        t.disabled = true;
        t.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulating...';
        const res = await apiRequest('/api/dev/simulate-day', { method: 'POST' });
        toast(res.message || 'Simulated one working day.');
        loadDashboard();
        if (!$('#applicationsView').classList.contains('hidden-view')) loadApplications();
        if (!$('#adminView').classList.contains('hidden-view')) loadAdmin();
      } catch (err) {
        toast('Simulation failed: ' + err.message, true);
      } finally {
        t.disabled = false;
        t.innerHTML = '<i class="fa-solid fa-forward"></i> Simulate next day';
      }
    });
    box.appendChild(t);
  }
})();

// Dashboard Filter Buttons
$$('[data-dash-filter]').forEach(b => {
  b.addEventListener('click', () => {
    if ($('#applicationStatusFilter')) {
      $('#applicationStatusFilter').value = b.dataset.dashFilter === 'active' ? 'progress' : b.dataset.dashFilter;
    }
    showView('applications');
  });
});

// ============================================================================
// APPLICATIONS VIEW & AI DETAIL
// ============================================================================
async function loadApplications() {
  const search = ($('#applicationSearch')?.value || '').trim();
  const filter = $('#applicationStatusFilter')?.value || 'all';

  try {
    const apps = await apiRequest(`/api/applications?search=${encodeURIComponent(search)}&status=${filter}`);
    state.myApplications = apps;

    const host = $('.application-list');
    if (!host) return;

    if (!apps.length) {
      host.innerHTML = '<div class="empty">No applications match your criteria.</div>';
      $('.detail-panel').innerHTML = '<div class="empty">Select an application to view live intelligence.</div>';
      return;
    }

    if (!state.selectedApp || !apps.some(a => a.id === state.selectedApp.id)) {
      state.selectedApp = apps[0];
    }

    host.innerHTML = apps.map(a => {
      const ic = SV_ICONS[a.service_type] || '📄';
      const isSel = state.selectedApp && state.selectedApp.id === a.id;
      const riskClass = a.status === 'Completed' ? 'good' : a.status === 'Action Required' ? 'warn' : a.status === 'Delayed' ? 'risk' : 'good';
      const riskLabel = a.status === 'Completed' ? 'Completed' : a.status === 'Action Required' ? 'Action' : a.status === 'Delayed' ? 'Delayed' : 'On track';
      return `
        <button class="app-card ${isSel ? 'selected' : ''}" data-id="${a.id}">
          <span class="app-icon">${ic}</span>
          <span><b>${escapeHtml(a.service_type)}</b><small>${a.tracking_id}</small></span>
          <em class="${riskClass}">${riskLabel}</em>
        </button>
      `;
    }).join('');

    $$('.app-card', host).forEach(card => {
      card.addEventListener('click', () => {
        state.selectedApp = state.myApplications.find(a => a.id === card.dataset.id);
        $$('.app-card', host).forEach(c => c.classList.toggle('selected', c === card));
        if (state.selectedApp) renderApplicationDetail(state.selectedApp);
      });
    });

    if (state.selectedApp) {
      renderApplicationDetail(state.selectedApp);
    }
  } catch (err) {
    toast('Error loading applications: ' + err.message, true);
  }
}

async function renderApplicationDetail(app) {
  const panel = $('.detail-panel');
  if (!panel) return;

  panel.innerHTML = '<div style="padding:40px;text-align:center;color:#888"><i class="fa-solid fa-spinner fa-spin"></i> Loading Application Intelligence...</div>';

  try {
    const [trackingData, twinData, intelData, predData] = await Promise.all([
      apiRequest(`/api/applications/track/${app.tracking_id}`),
      apiRequest(`/api/applications/${app.id}/twin`),
      apiRequest(`/api/applications/${app.id}/intelligence`),
      apiRequest(`/api/applications/${app.id}/prediction`)
    ]);

    const isDone = app.status === 'Completed' || app.current_stage === 'Completed';
    const stages = trackingData.stages || STAGE_ORDER;
    const currentIdx = stages.indexOf(app.current_stage);

    const timelineHtml = stages.map((stgName, idx) => {
      const done = idx < currentIdx || isDone;
      const current = idx === currentIdx && !isDone;
      const icon = done ? 'fa-solid fa-check' : current ? 'fa-solid fa-wave-square' : 'fa-regular fa-circle';
      return `
        <button class="stage ${done ? 'done' : current ? 'current' : ''}" data-stage="${stgName}">
          <i class="${icon}"></i>
          <span>${escapeHtml(stgName)}</span>
        </button>
      `;
    }).join('');

    const factorsHtml = (predData.factors || intelData.factors || []).map(f => `
      <span>${escapeHtml(f.name)} <b>+${f.impact}%</b></span>
    `).join('');

    // Digital twin dependencies nodes
    const prevStage = currentIdx > 0 ? stages[currentIdx - 1] : null;
    const nextStage = twinData.nextStage;

    panel.innerHTML = `
      <div class="detail-top">
        <div>
          <span class="eyebrow">${escapeHtml(app.service_type).toUpperCase()} APPLICATION</span>
          <h3 id="appTitle">${app.tracking_id}</h3>
        </div>
        <div class="health">
          <span>Application Health</span>
          <strong id="healthValue">${intelData.health}</strong>
          <small>/ 100 · ${isDone ? 'Completed' : intelData.risk > 50 ? 'Moderate Risk' : 'Healthy'}</small>
        </div>
      </div>

      <div class="timeline" id="timeline">${timelineHtml}</div>

      <div class="insight-grid">
        <div class="insight-card delay-card">
          <div class="card-title"><span>AI DELAY DETECTIVE</span><i class="fa-solid fa-sparkles"></i></div>
          <div class="delay-stats">
            <div><small>Normal</small><b>${intelData.normalDays}</b></div>
            <div><small>Current</small><b>${intelData.currentDays} day(s)</b></div>
            <div><small>Excess</small><b>${intelData.excessDays > 0 ? '+' + intelData.excessDays + ' day(s)' : '0'}</b></div>
          </div>
          <p><strong>Likely cause:</strong> ${escapeHtml(intelData.likelyCause)}</p>
          <p class="ai-explain">${escapeHtml(intelData.explanation)}</p>
          <div class="action-safe" style="${intelData.actionRequired ? 'background:rgba(255,196,0,.1);color:#f3c75f' : ''}">
            <i class="fa-solid ${intelData.actionRequired ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
            ${escapeHtml(intelData.recommendedAction)}
          </div>
          ${intelData.actionRequired ? `<button class="mini-action" id="fixBtn" style="margin-top:10px">Fix now — upload document</button>` : ''}
          <div class="contact-line" style="margin-top:12px;font-size:12px;color:#aaa">
            <i class="fa-solid fa-user-tie"></i> Contact: <b>${escapeHtml(intelData.contact)}</b>
          </div>
        </div>

        <div class="insight-card prediction-card">
          <div class="card-title"><span>PROCESSING PREDICTION</span><i class="fa-solid fa-chart-line"></i></div>
          <div class="prediction-number">${predData.delayRisk}<span>%</span></div>
          <b>${predData.delayRisk > 50 ? 'Moderate delay risk' : predData.delayRisk > 25 ? 'Low delay risk' : 'On schedule'}</b>
          <div class="risk-bar"><span style="width:${predData.delayRisk}%"></span></div>
          <p>Estimated next update: <strong>${escapeHtml(predData.estimatedNextUpdate)}</strong></p>
          <div class="factors">${factorsHtml}</div>
        </div>
      </div>

      <div class="twin-panel">
        <div>
          <span class="eyebrow">INNOVATION LAYER</span>
          <h3>Application Digital Twin</h3>
          <p>A live representation of status, health, dependencies, delays and predicted next state.</p>
        </div>
        <div class="twin-map">
          <span class="twin-node active">${escapeHtml(app.current_stage).toUpperCase()}</span>
          ${prevStage ? `<span class="twin-node dependency">${escapeHtml(prevStage).toUpperCase()} ✓</span>` : ''}
          ${nextStage ? `<span class="twin-node next">NEXT → ${escapeHtml(nextStage).toUpperCase()}</span>` : '<span class="twin-node next">COMPLETE</span>'}
          <div class="data-particle p1"></div><div class="data-particle p2"></div>
        </div>
      </div>
    `;

    $('#fixBtn')?.addEventListener('click', () => fixApplicationAction(app.id));

    // Dynamic AI chat assistance answers for this app
    answers['Why is my application delayed?'] = intelData.explanation;
    answers['What happens next?'] = isDone ? 'Your application is completed.' : `Next it moves to ${nextStage || 'Final Completion'}. Estimated turnaround: ${predData.estimatedNextUpdate}.`;
    answers['Do I need to contact anyone?'] = intelData.actionRequired ? intelData.recommendedAction : `Only if it stays stuck. Contact: ${intelData.contact}.`;

  } catch (err) {
    panel.innerHTML = `<div class="empty">Failed to load details: ${escapeHtml(err.message)}</div>`;
  }
}

$('#applicationSearch')?.addEventListener('input', () => loadApplications());
$('#applicationStatusFilter')?.addEventListener('change', () => loadApplications());

// ============================================================================
// NEW APPLICATION WIZARD
// ============================================================================
let wizardStep = 1;
let selectedService = 'Scholarship';
let pendingFiles = [];

function openNewApplication() {
  if (!currentUser()) {
    openAuth('login');
    return;
  }
  wizardStep = 1;
  pendingFiles = [];
  $('#newAppTitle').value = '';
  $('#newAppDepartment').value = '';
  $('#newAppReference').value = '';
  $('#newAppDescription').value = '';
  $('#submissionConsent').checked = false;
  hideAllProduction();
  $('#newApplicationView').classList.remove('hidden-view');
  renderWizard();
}
window.openNewApplication = openNewApplication;

function hideAllProduction() {
  $$('#newApplicationView, #adminCaseView').forEach(v => v.classList.add('hidden-view'));
}

function renderWizard() {
  $$('#newApplicationView .wizard-step').forEach(s => s.classList.toggle('hidden-ui', +s.dataset.step !== wizardStep));
  $$('#newApplicationView .step').forEach((s, idx) => {
    s.classList.toggle('active', idx + 1 === wizardStep);
    s.classList.toggle('done', idx + 1 < wizardStep);
  });

  const nextBtn = $('#wizardNext');
  if (nextBtn) {
    nextBtn.textContent = wizardStep === 4 ? 'Submit Application' : 'Continue';
  }

  if (wizardStep === 4) {
    const rc = $('#reviewCard');
    if (rc) {
      rc.innerHTML = `
        <b>${escapeHtml($('#newAppTitle').value || selectedService + ' Application')}</b>
        <span>${escapeHtml(selectedService)} · ${escapeHtml($('#newAppDepartment').value || 'Default Department')}</span>
        <p>${escapeHtml($('#newAppDescription').value || 'No description provided.')}</p>
        <small>${pendingFiles.length} document${pendingFiles.length === 1 ? '' : 's'} attached.</small>
      `;
    }
  }
}

$$('.service-option').forEach(b => b.addEventListener('click', () => {
  $$('.service-option').forEach(x => x.classList.remove('selected'));
  b.classList.add('selected');
  selectedService = b.dataset.service;
}));

$('#newApplicationBtn')?.addEventListener('click', openNewApplication);
$('#wizardBack')?.addEventListener('click', () => {
  if (wizardStep > 1) {
    wizardStep--;
    renderWizard();
  } else {
    hideAllProduction();
    showView('applications');
  }
});

$('#wizardNext')?.addEventListener('click', () => {
  if (wizardStep < 4) {
    if (wizardStep === 2 && !$('#newAppTitle').value.trim()) {
      toast('Please enter an application title.', true);
      return;
    }
    wizardStep++;
    renderWizard();
  } else {
    submitNewApplication();
  }
});

$$('[data-close-production]').forEach(b => b.addEventListener('click', () => {
  hideAllProduction();
  showView('applications');
}));

// Document Upload handling
const uploadZone = $('#uploadZone'), fileInput = $('#documentInput');
uploadZone?.addEventListener('click', () => fileInput.click());
uploadZone?.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.borderColor = '#fff'; });
uploadZone?.addEventListener('dragleave', () => uploadZone.style.borderColor = '');
uploadZone?.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  addFiles([...e.dataTransfer.files]);
});
fileInput?.addEventListener('change', () => addFiles([...fileInput.files]));

function addFiles(incoming) {
  for (const f of incoming) {
    if (!/^(application\/pdf|image\/jpeg|image\/png)$/.test(f.type) || f.size > 10 * 1024 * 1024) {
      toast(`${f.name}: Only PDF, JPG, PNG under 10 MB allowed.`, true);
      continue;
    }
    if (!pendingFiles.some(x => x.name === f.name && x.size === f.size)) {
      pendingFiles.push(f);
    }
  }
  renderPendingFiles();
}

function renderPendingFiles() {
  if ($('#documentCount')) {
    $('#documentCount').textContent = `${pendingFiles.length} file${pendingFiles.length === 1 ? '' : 's'} selected`;
  }
  const host = $('#documentList');
  if (host) {
    host.innerHTML = pendingFiles.map((f, i) => `
      <div class="document-item">
        <span><b>${escapeHtml(f.name)}</b><small> · ${(f.size / 1024 / 1024).toFixed(2)} MB · Ready for upload</small></span>
        <button type="button" class="document-remove" data-idx="${i}"><i class="fa-solid fa-trash"></i></button>
      </div>
    `).join('');

    $$('.document-remove', host).forEach(b => b.addEventListener('click', () => {
      pendingFiles.splice(+b.dataset.idx, 1);
      renderPendingFiles();
    }));
  }
}

async function submitNewApplication() {
  if (!$('#submissionConsent')?.checked) {
    toast('Please confirm the submission consent checkbox.', true);
    return;
  }

  const nextBtn = $('#wizardNext');
  try {
    nextBtn.disabled = true;
    nextBtn.textContent = 'Submitting...';

    // 1. Create application on backend
    const createdApp = await apiRequest('/api/applications', {
      method: 'POST',
      body: JSON.stringify({
        service_type: selectedService,
        title: $('#newAppTitle').value.trim() || `${selectedService} Application`,
        department: $('#newAppDepartment').value.trim() || undefined,
        reference_number: $('#newAppReference').value.trim() || undefined,
        description: $('#newAppDescription').value.trim() || undefined,
        notification_preference: $('#newAppNotify')?.value
      })
    });

    // 2. Upload documents to Supabase storage if any were selected
    if (pendingFiles.length > 0) {
      const formData = new FormData();
      pendingFiles.forEach(f => formData.append('files', f));
      formData.append('documentType', 'Application Attachments');
      await apiRequest(`/api/documents/upload/${createdApp.id}`, {
        method: 'POST',
        body: formData
      });
    }

    hideAllProduction();
    state.selectedApp = createdApp;
    toast(`Application submitted! Tracking ID: ${createdApp.tracking_id}`);
    alert(`Application submitted successfully.\n\nYour TrackFlow Tracking ID:\n${createdApp.tracking_id}\n\nKeep this ID to track your application.`);
    showView('applications');
    loadApplications();
  } catch (err) {
    toast('Submission error: ' + err.message, true);
  } finally {
    nextBtn.disabled = false;
    nextBtn.textContent = 'Submit Application';
  }
}

// ============================================================================
// TRACK BY ID MODAL
// ============================================================================
$('#trackIdBtn')?.addEventListener('click', () => {
  $('#trackBackdrop').hidden = false;
  $('#trackInput').value = '';
  $('#trackResult').innerHTML = '';
  setTimeout(() => $('#trackInput')?.focus(), 50);
});

$('#trackClose')?.addEventListener('click', () => $('#trackBackdrop').hidden = true);
$('#trackSubmit')?.addEventListener('click', trackById);

async function trackById() {
  const trackingId = $('#trackInput').value.trim().toUpperCase();
  if (!trackingId) {
    toast('Enter a tracking ID.', true);
    return;
  }

  const resultContainer = $('#trackResult');
  resultContainer.innerHTML = '<div style="color:#aaa;padding:10px">Searching application record...</div>';

  try {
    const data = await apiRequest(`/api/applications/track/${trackingId}`);
    resultContainer.innerHTML = `
      <div class="review-card" style="margin-top:12px">
        <b>${data.trackingId}</b>
        <span>${escapeHtml(data.service)} · ${escapeHtml(data.currentStage)}</span>
        <strong>Application Health: ${data.health}/100</strong>
        <p style="font-size:12px;margin:6px 0;color:#ccc">${escapeHtml(data.explanation)}</p>
        <button class="full-btn" id="trackOpenBtn">Open application view</button>
      </div>
    `;

    $('#trackOpenBtn')?.addEventListener('click', () => {
      $('#trackBackdrop').hidden = true;
      if (data.id) {
        state.selectedApp = state.myApplications.find(a => a.id === data.id) || { id: data.id, tracking_id: data.trackingId, service_type: data.service, current_stage: data.currentStage, status: data.status };
      }
      showView('applications');
    });
  } catch (err) {
    resultContainer.innerHTML = `<p style="color:#f87171">No application found with ID "${escapeHtml(trackingId)}". Check receipt and try again.</p>`;
  }
}
window.trackById = trackById;

// ============================================================================
// ADMIN INTELLIGENCE & CASE MANAGEMENT
// ============================================================================
async function loadAdmin() {
  try {
    const [overview, delayedCases, svcPerf, deptPerf] = await Promise.all([
      apiRequest('/api/admin/overview'),
      apiRequest('/api/admin/delayed-cases'),
      apiRequest('/api/admin/service-performance'),
      apiRequest('/api/admin/department-performance')
    ]);

    state.adminOverview = overview;

    // Static metrics counters
    const metrics = $$('#adminStatic .metric b');
    if (metrics[0]) metrics[0].dataset.count = overview.total;
    if (metrics[1]) metrics[1].dataset.count = overview.completed;
    if (metrics[2]) metrics[2].dataset.count = overview.inProgress;
    if (metrics[3]) metrics[3].dataset.count = overview.delayed;
    startCounters();

    // Render Overview Pane
    const trendPts = overview.weeklyTrend.map((v, i) => `${20 + i * 44},${90 - (v.delayedPct / 100) * 70}`).join(' ');
    const maxPct = Math.max(...overview.weeklyTrend.map(v => v.delayedPct), 1);

    const deptRows = deptPerf.map(d => `
      <tr>
        <td><b>${escapeHtml(d.department)}</b></td>
        <td>${d.totalCases}</td>
        <td>${d.delayedCases}</td>
        <td style="color:${d.avgExcessDays > 2 ? '#ff4d4f' : '#f3c75f'}">+${d.avgExcessDays} d</td>
      </tr>
    `).join('');

    const svcRows = svcPerf.map(s => `
      <tr>
        <td><b>${SV_ICONS[s.service] || '📄'} ${escapeHtml(s.service)}</b></td>
        <td>${s.total}</td>
        <td>${s.delayed} (${s.delayedPercentage}%)</td>
        <td>${s.completed}</td>
      </tr>
    `).join('');

    $('#pane-ov').innerHTML = `
      <div class="admin-grid">
        <div class="admin-panel">
          <div class="card-title"><span>DELAY RATE · LAST 8 WEEKS</span><i class="fa-solid fa-chart-line"></i></div>
          <svg viewBox="0 0 340 110" width="100%" style="margin-top:12px">
            <polyline points="${trendPts}" fill="none" stroke="#fff" stroke-width="2"/>
            ${overview.weeklyTrend.map((v, i) => `
              <circle cx="${20 + i * 44}" cy="${90 - (v.delayedPct / maxPct) * 70}" r="3" fill="#fff"/>
              <text x="${20 + i * 44}" y="106" font-size="8" fill="#777" text-anchor="middle">${v.day}</text>
              <text x="${20 + i * 44}" y="${82 - (v.delayedPct / maxPct) * 70}" font-size="8" fill="#aaa" text-anchor="middle">${v.delayedPct}%</text>
            `).join('')}
          </svg>
        </div>
        <div class="admin-panel">
          <div class="card-title"><span>DEPARTMENT PERFORMANCE</span><i class="fa-solid fa-table-cells"></i></div>
          <div class="tbl-wrap">
            <table class="tbl heat" style="margin-top:8px">
              <tr><th>Department</th><th>Cases</th><th>Delayed</th><th>Avg Over SLA</th></tr>
              ${deptRows}
            </table>
          </div>
        </div>
        <div class="admin-panel wide">
          <div class="card-title"><span>SERVICE PERFORMANCE</span><i class="fa-solid fa-list-check"></i></div>
          <div class="tbl-wrap">
            <table class="tbl">
              <tr><th>Service</th><th>Applications</th><th>Delayed</th><th>Completed</th></tr>
              ${svcRows}
            </table>
          </div>
        </div>
      </div>
    `;

    // Render Root Causes Pane
    const topCauses = overview.topCauses || [];
    $('#pane-rc').innerHTML = `
      <div class="admin-grid three">
        <div class="admin-panel">
          <div class="card-title"><span>SYSTEM AI RECOMMENDATION</span><i class="fa-solid fa-lightbulb"></i></div>
          <div class="recommendation" style="margin-top:12px">
            <small>ENGINE INTELLIGENCE</small>
            <strong>${escapeHtml(overview.aiRecommendation.title)}</strong>
            <span>${escapeHtml(overview.aiRecommendation.subtitle)}</span>
          </div>
        </div>
        <div class="admin-panel wide">
          <div class="card-title"><span>RECURRING DELAY CAUSES</span><i class="fa-solid fa-triangle-exclamation"></i></div>
          <div class="rec-list">
            ${topCauses.map(c => `
              <div class="recommendation" style="margin-bottom:8px">
                <small>${escapeHtml(c.cause).toUpperCase()} · ${c.count} CASES</small>
                <strong>Recommended Mitigation:</strong>
                <span>${escapeHtml(c.recommendation)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    renderAdminCasesTable();
  } catch (err) {
    toast('Error loading admin intelligence: ' + err.message, true);
  }
}

async function renderAdminCasesTable() {
  const sf = $('#fSvc')?.value || 'all';
  const cf = $('#fCause')?.value || 'all';

  try {
    const cases = await apiRequest(`/api/admin/cases?service=${sf}`);
    state.adminCases = cases;

    const delayed = cases.filter(a => a.status === 'Delayed' || a.status === 'Action Required');

    $('#pane-cs').innerHTML = `
      <div class="admin-panel">
        <div class="filters">
          <select id="fSvc">
            <option value="all">All services</option>
            ${Object.keys(SV_ICONS).map(s => `<option ${s === sf ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <span style="align-self:center;font-size:11px;color:#888">${delayed.length} delayed cases</span>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <tr><th>Tracking ID</th><th>Service</th><th>Stage</th><th>Cause</th><th>Officer</th><th>Actions</th></tr>
            ${delayed.slice(0, 15).map(a => `
              <tr>
                <td><b>${a.tracking_id}</b></td>
                <td>${escapeHtml(a.service_type)}</td>
                <td>${escapeHtml(a.current_stage)}</td>
                <td>${escapeHtml(a.delay_cause || 'Queue backlog')}</td>
                <td>${escapeHtml(a.assigned_officer_name || 'Unassigned')}</td>
                <td style="white-space:nowrap">
                  <button class="mini-action" data-open="${a.id}">Manage</button>
                  <button class="mini-action secondary-action" data-esc="${a.id}">Escalate</button>
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    `;

    $('#fSvc').onchange = renderAdminCasesTable;

    $$('[data-open]').forEach(b => b.onclick = () => openCaseManagementModal(b.dataset.open));
    $$('[data-esc]').forEach(b => b.onclick = async () => {
      try {
        await apiRequest(`/api/admin/cases/${b.dataset.esc}/escalate`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Escalated by administrator review', level: 'department_head' })
        });
        toast('Case escalated to department head.');
        renderAdminCasesTable();
      } catch (err) {
        toast('Escalation failed: ' + err.message, true);
      }
    });
  } catch (err) {
    console.error('Error rendering cases:', err);
  }
}

$$('#adminTabs button').forEach(b => b.addEventListener('click', () => {
  $$('#adminTabs button').forEach(x => x.classList.toggle('active', x === b));
  ['ov', 'cs', 'rc'].forEach(k => $('#pane-' + k)?.classList.toggle('hidden-ui', k !== b.dataset.at));
}));

// Case Management Workspace Modal
function openCaseManagementModal(caseId) {
  hideAllProduction();
  $('#adminCaseView').classList.remove('hidden-view');

  const q = $('.case-queue');
  $$('.case-item', q).forEach(x => x.remove());

  const cases = state.adminCases.filter(a => a.status === 'Delayed' || a.status === 'Action Required');
  cases.forEach(a => {
    const b = document.createElement('button');
    b.className = `case-item ${caseId === a.id ? 'selected' : ''}`;
    b.dataset.id = a.id;
    b.innerHTML = `
      <span class="risk-dot high"></span>
      <div><b>${a.tracking_id}</b><small>${escapeHtml(a.service_type)} · ${escapeHtml(a.current_stage)}</small></div>
      <strong>${a.days_in_stage}d</strong>
    `;
    b.onclick = () => selectCaseForManagement(a.id);
    q.appendChild(b);
  });

  selectCaseForManagement(caseId || cases[0]?.id);
}

async function selectCaseForManagement(id) {
  if (!id) return;
  const cur = state.adminCases.find(a => a.id === id);
  if (!cur) return;
  state.selectedCase = cur;

  $$('.case-item').forEach(x => x.classList.toggle('selected', x.dataset.id === id));
  const d = $('.case-detail');
  if (!d) return;

  $('h3', d).textContent = cur.tracking_id;
  $('.case-meta', d).innerHTML = `
    <span>${escapeHtml(cur.service_type)}</span>
    <span>${escapeHtml(cur.department)}</span>
    <span>Risk ${cur.delay_risk}/100</span>
    <span>${escapeHtml(cur.delay_cause || 'Queue backlog')}</span>
  `;

  if ($('#caseStage')) $('#caseStage').value = cur.current_stage;
  if ($('#caseOfficer')) $('#caseOfficer').value = cur.assigned_officer_name || 'Unassigned';
  if ($('#caseNote')) $('#caseNote').value = '';

  // Fetch full stage history & audit preview
  try {
    const fullApp = await apiRequest(`/api/applications/${cur.id}`);
    const history = fullApp.stage_history || [];
    $('.audit-preview', d).innerHTML = `
      <b>Audit history</b>
      ${history.slice(0, 4).map(h => `
        <span>${formatTimeAgo(h.created_at)} · ${escapeHtml(h.to_stage)} (${escapeHtml(h.note || h.reason || '')})</span>
      `).join('')}
    `;
  } catch (e) {
    // Keep fallback
  }
}

$('#rootCauseBtn')?.addEventListener('click', () => openCaseManagementModal());

$('#saveCaseBtn')?.addEventListener('click', async () => {
  if (!state.selectedCase) return;
  try {
    const stage = $('#caseStage').value;
    const assignedOfficerName = $('#caseOfficer').value;
    const note = $('#caseNote').value.trim();

    await apiRequest(`/api/admin/cases/${state.selectedCase.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, assignedOfficerName, note })
    });

    toast('Case updated successfully!');
    loadAdmin();
    openCaseManagementModal(state.selectedCase.id);
  } catch (err) {
    toast('Failed to save case: ' + err.message, true);
  }
});

$('#requestInfoBtn')?.addEventListener('click', async () => {
  if (!state.selectedCase) return;
  try {
    const note = $('#caseNote').value.trim() || 'Please upload the requested missing documentation.';
    await apiRequest(`/api/admin/cases/${state.selectedCase.id}/request-information`, {
      method: 'POST',
      body: JSON.stringify({ note })
    });
    toast('Information requested. Applicant has been notified.');
    loadAdmin();
    openCaseManagementModal(state.selectedCase.id);
  } catch (err) {
    toast('Error requesting info: ' + err.message, true);
  }
});

// Helper: Escape HTML
function escapeHtml(x) {
  if (x === null || x === undefined) return '';
  return String(x).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Helper: Format relative timestamp
function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Ask My Application Modal
const answers = {
  'Why is my application delayed?': 'Your application is progressing normally. Check your timeline for stage updates.',
  'What happens next?': 'The application will proceed to the subsequent department stage once approved.',
  'Do I need to contact anyone?': 'No action required right now.'
};

$('#modalClose')?.addEventListener('click', () => $('#modalBackdrop').hidden = true);
$('#dashboardAskBtn')?.addEventListener('click', () => {
  $('#modalBackdrop').hidden = false;
  $('#chatInput')?.focus();
});
$('#askBtn')?.addEventListener('click', () => {
  $('#modalBackdrop').hidden = false;
  $('#chatInput')?.focus();
});

$$('.suggestions button').forEach(b => b.addEventListener('click', () => {
  sendChatMessage(b.dataset.question);
}));

$('#chatForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const input = $('#chatInput');
  const val = input.value.trim();
  if (val) {
    sendChatMessage(val);
    input.value = '';
  }
});

function sendChatMessage(msg) {
  const chat = $('#chat');
  if (!chat) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'chat-msg user';
  userBubble.textContent = msg;
  chat.appendChild(userBubble);

  const aiBubble = document.createElement('div');
  aiBubble.className = 'chat-msg ai';
  aiBubble.innerHTML = `<i class="fa-solid fa-sparkles"></i> <span>Thinking...</span>`;
  chat.appendChild(aiBubble);
  chat.scrollTop = chat.scrollHeight;

  setTimeout(() => {
    let reply = answers[msg];
    if (!reply) {
      if (msg.toLowerCase().includes('delay') || msg.toLowerCase().includes('stuck')) {
        reply = answers['Why is my application delayed?'];
      } else if (msg.toLowerCase().includes('next') || msg.toLowerCase().includes('when')) {
        reply = answers['What happens next?'];
      } else {
        reply = `TrackFlow AI: Your application status is actively tracked by our SLA intelligence engine. Current stage: ${state.selectedApp ? state.selectedApp.current_stage : 'Review'}.`;
      }
    }
    aiBubble.innerHTML = `<i class="fa-solid fa-sparkles"></i> <span>${escapeHtml(reply)}</span>`;
    chat.scrollTop = chat.scrollHeight;
  }, 400);
}

// ============================================================================
// INITIALIZATION
// ============================================================================
async function initApp() {
  const token = localStorage.getItem('trackflow_token') || sessionStorage.getItem('trackflow_token');
  if (token) {
    state.token = token;
    try {
      const data = await apiRequest('/api/auth/me');
      state.user = data.user;
      refreshAccountUI();
      closeAuth();
      showView('dashboard');
      return;
    } catch (e) {
      console.warn('Session verification failed:', e);
      localStorage.removeItem('trackflow_token');
      sessionStorage.removeItem('trackflow_token');
      state.token = null;
    }
  }

  // If unauthenticated, show Home or open Auth
  showView('home');
  openAuth('login');
}

initApp();
