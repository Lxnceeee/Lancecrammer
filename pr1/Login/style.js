const authWrapper = document.querySelector('.auth-wrapper');
const loginTrigger = document.querySelector('.login-trigger');
const registerTrigger = document.querySelector('.register-trigger');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const approvalStatus = document.getElementById('approval-status');
let pendingWatchTimer = null;
let pendingWatchUsername = '';

const USERS_KEY = 'parent_connect_users_v1';
const ACCOUNT_REQUESTS_KEY = 'parent_connect_account_requests_v1';
const DEVELOPER_ACCOUNT = {
    username: 'admin',
    password: 'group4pr1',
    role: 'Developer'
};

function setApprovalStatus(type, title, subtitle) {
    if (!approvalStatus) return;
    const titleEl = approvalStatus.querySelector('.approval-title');
    const subtitleEl = approvalStatus.querySelector('.approval-subtitle');
    approvalStatus.classList.remove('hidden', 'declined', 'approved');
    if (type === 'declined') approvalStatus.classList.add('declined');
    if (type === 'approved') approvalStatus.classList.add('approved');
    if (titleEl) titleEl.textContent = title;
    if (subtitleEl) subtitleEl.textContent = subtitle;
}

function loadUsers() {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        if (!raw) return [];
        const users = JSON.parse(raw);
        return Array.isArray(users) ? users : [];
    } catch (_) {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function loadAccountRequests() {
    try {
        const raw = localStorage.getItem(ACCOUNT_REQUESTS_KEY);
        if (!raw) return [];
        const requests = JSON.parse(raw);
        return Array.isArray(requests) ? requests : [];
    } catch (_) {
        return [];
    }
}

function saveAccountRequests(requests) {
    localStorage.setItem(ACCOUNT_REQUESTS_KEY, JSON.stringify(requests));
}

function ensureDeveloperAccount() {
    const users = loadUsers();
    const hasDeveloper = users.some((u) => (u.role || '').toLowerCase() === 'developer');
    if (!hasDeveloper) {
        const idx = users.findIndex((u) => (u.username || '').toLowerCase() === DEVELOPER_ACCOUNT.username);
        if (idx >= 0) users[idx] = { ...users[idx], ...DEVELOPER_ACCOUNT };
        else users.push({ ...DEVELOPER_ACCOUNT });
    }
    saveUsers(users);
}

function setActiveSession(user) {
    sessionStorage.setItem('auth_user', JSON.stringify({
        username: user.username,
        role: user.role || 'Teacher'
    }));
    window.location.href = '../smsblastingver8.html';
}

if (sessionStorage.getItem('auth_user')) {
    window.location.href = '../smsblastingver8.html';
}
ensureDeveloperAccount();

function attachPasswordToggle(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;

    const updateIcon = () => {
        const hasValue = (input.value || '').length > 0;
        if (!hasValue) {
            icon.classList.remove('fa-eye', 'fa-eye-slash');
            icon.classList.add('fa-lock');
            return;
        }
        icon.classList.remove('fa-lock');
        icon.classList.add(input.type === 'password' ? 'fa-eye' : 'fa-eye-slash');
    };

    icon.addEventListener('click', () => {
        if (!(input.value || '').length) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        updateIcon();
    });

    input.addEventListener('input', updateIcon);
    updateIcon();
}

attachPasswordToggle('login-password', 'login-password-toggle');
attachPasswordToggle('signup-password', 'signup-password-toggle');

if (registerTrigger) {
    registerTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        authWrapper.classList.add('toggled');
        if (approvalStatus) approvalStatus.classList.add('hidden');
        if (pendingWatchTimer) {
            clearInterval(pendingWatchTimer);
            pendingWatchTimer = null;
        }
    });
}

if (loginTrigger) {
    loginTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        authWrapper.classList.remove('toggled');
        if (approvalStatus) approvalStatus.classList.add('hidden');
        if (pendingWatchTimer) {
            clearInterval(pendingWatchTimer);
            pendingWatchTimer = null;
        }
    });
}

function watchApprovalStatus(username, password) {
    pendingWatchUsername = username.toLowerCase();
    if (pendingWatchTimer) clearInterval(pendingWatchTimer);
    pendingWatchTimer = setInterval(() => {
        const requests = loadAccountRequests();
        const req = requests
            .filter((r) => (r.username || '').toLowerCase() === pendingWatchUsername)
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
        if (!req) return;

        if (req.status === 'declined') {
            setApprovalStatus('declined', 'Request declined', 'Developer declined this account request. Use another username or ask for review.');
            clearInterval(pendingWatchTimer);
            pendingWatchTimer = null;
            return;
        }

        if (req.status === 'approved') {
            setApprovalStatus('approved', 'Approved', 'Approved. Logging you in...');
            const users = loadUsers();
            const user = users.find((u) => (u.username || '').toLowerCase() === pendingWatchUsername) || {
                username,
                password,
                role: req.assignedRole || 'Teacher'
            };
            clearInterval(pendingWatchTimer);
            pendingWatchTimer = null;
            setTimeout(() => setActiveSession(user), 700);
        }
    }, 1800);
}

if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = (document.getElementById('signup-username')?.value || '').trim();
        const password = (document.getElementById('signup-password')?.value || '').trim();

        if (!username || !password) {
            alert('Please enter username and password.');
            return;
        }

        const users = loadUsers();
        const exists = users.some((u) => (u.username || '').toLowerCase() === username.toLowerCase());
        if (exists) {
            alert('Username already exists.');
            return;
        }

        const requests = loadAccountRequests();
        const existingReq = requests
            .filter((r) => (r.username || '').toLowerCase() === username.toLowerCase())
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];

        if (existingReq && existingReq.status === 'pending') {
            setApprovalStatus('pending', 'Waiting for approval', 'This username is already waiting for approval.');
            return;
        }
        if (existingReq && existingReq.status === 'approved') {
            setApprovalStatus('approved', 'Approved', 'Approved. Logging you in...');
            const usersAfterApprove = loadUsers();
            const approvedUser = usersAfterApprove.find((u) => (u.username || '').toLowerCase() === username.toLowerCase()) || {
                username,
                password,
                role: existingReq.assignedRole || 'Teacher'
            };
            setTimeout(() => setActiveSession(approvedUser), 700);
            return;
        }
        if (existingReq && existingReq.status === 'declined') {
            setApprovalStatus('declined', 'Request declined', 'Developer declined this account request. Use another username or ask for review.');
            return;
        }

        requests.push({
            id: `req-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            username,
            password,
            status: 'pending',
            createdAt: Date.now()
        });
        saveAccountRequests(requests);
        signupForm.reset();
        setApprovalStatus('pending', 'Waiting for approval', 'Your account request was sent. Please wait for approval.');
        watchApprovalStatus(username, password);
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = (document.getElementById('login-username')?.value || '').trim();
        const password = (document.getElementById('login-password')?.value || '').trim();

        const users = loadUsers();
        const user = users.find((u) =>
            (u.username || '').toLowerCase() === username.toLowerCase() &&
            u.password === password
        );

        if (!user) {
            const pending = loadAccountRequests().find((r) =>
                (r.username || '').toLowerCase() === username.toLowerCase() && r.status === 'pending'
            );
            if (pending) {
                alert('Account is waiting for approval.');
                return;
            }

            const declined = loadAccountRequests().find((r) =>
                (r.username || '').toLowerCase() === username.toLowerCase() && r.status === 'declined'
            );
            if (declined) {
                alert('Account request was declined by Developer.');
                return;
            }

            alert('Invalid username or password.');
            return;
        }

        setActiveSession(user);
    });
}
