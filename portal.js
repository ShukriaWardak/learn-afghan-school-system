'use strict';

// Authenticated branch viewer. Never save tokens, passwords or records in localStorage.
const apiRoot = 'backend/api/';
const $ = (id) => document.getElementById(id);
const state = { user: null, csrfToken: null, branches: [] };

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
async function api(path, options = {}) {
  const response = await fetch(apiRoot + path, {
    ...options,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error || 'The server could not complete this request.', response.status);
  }
  return data;
}
function message(id, text = '', kind = 'error') {
  const element = $(id);
  element.textContent = text;
  element.dataset.kind = kind;
}
function showLogin(notice = '') {
  state.user = null;
  state.csrfToken = null;
  state.branches = [];
  $('workspace').hidden = true;
  $('login-panel').hidden = false;
  $('password').value = '';
  message('workspace-message');
  message('login-message', notice);
}
function showWorkspace(user) {
  state.user = user;
  $('login-panel').hidden = true;
  $('workspace').hidden = false;
  $('welcome').textContent = 'Signed in as ' + user.display_name + ' (' + user.role.replaceAll('_', ' ') + ')';
  $('branch-search').value = '';
  message('workspace-message');
}
function cell(row, content) {
  const td = document.createElement('td');
  td.textContent = content == null || content === '' ? '—' : String(content);
  row.append(td);
  return td;
}
function renderBranches() {
  const query = $('branch-search').value.trim().toLocaleLowerCase();
  const matching = state.branches.filter((branch) =>
    [branch.name, branch.code, branch.zone_name, branch.zone_code, branch.location]
      .some((part) => String(part ?? '').toLocaleLowerCase().includes(query))
  );
  const tbody = $('branch-rows');
  tbody.replaceChildren();
  $('branch-count').textContent = String(state.branches.length);
  if (!matching.length) {
    const row = document.createElement('tr');
    cell(row, query ? 'No matching branches.' : 'No branch records available for this account.')
      .colSpan = 5;
    tbody.append(row);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const branch of matching) {
    const row = document.createElement('tr');
    cell(row, branch.code);
    cell(row, branch.name);
    cell(row, branch.zone_name);
    cell(row, branch.location);
    const td = cell(row, '');
    const tag = document.createElement('span');
    tag.className = 'status';
    if (['active', 'inactive', 'pending'].includes(branch.status)) tag.classList.add(branch.status);
    tag.textContent = String(branch.status ?? 'unknown');
    td.append(tag);
    fragment.append(row);
  }
  tbody.append(fragment);
}
async function loadBranches() {
  const button = $('refresh-button');
  button.disabled = true;
  message('workspace-message', 'Loading authorized branch records…', 'info');
  try {
    const data = await api('branches.php');
    if (!Array.isArray(data.branches)) throw new Error('Unexpected server response.');
    state.branches = data.branches;
    renderBranches();
    message('workspace-message');
  } catch (error) {
    if (error.status === 401) {
      showLogin('Your session expired. Please sign in again.');
      return;
    }
    state.branches = [];
    renderBranches();
    message('workspace-message', error.status === 403
      ? 'This account is not permitted to view the branch directory.'
      : (error.message || 'Could not load branches.'));
  } finally {
    button.disabled = false;
  }
}
async function start() {
  try {
    const session = await api('session.php');
    if (!session.authenticated || !session.user || !session.csrf_token) {
      throw new Error('Invalid session response.');
    }
    state.csrfToken = session.csrf_token;
    showWorkspace(session.user);
    await loadBranches();
  } catch (error) {
    showLogin(error.status === 401 ? '' : error.message);
  }
}
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('login-button');
  button.disabled = true;
  message('login-message');
  try {
    const token = await api('csrf.php');
    if (!token.csrf_token) throw new Error('The server did not provide a security token.');
    const credentials = {
      username: $('username').value.trim(),
      password: $('password').value
    };
    const result = await api('login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token.csrf_token },
      body: JSON.stringify(credentials)
    });
    if (!result.user || !result.csrf_token) throw new Error('Invalid login response.');
    state.csrfToken = result.csrf_token;
    $('password').value = '';
    showWorkspace(result.user);
    await loadBranches();
  } catch (error) {
    message('login-message', error.message || 'Sign-in failed.');
  } finally {
    button.disabled = false;
  }
});
$('logout-button').addEventListener('click', async () => {
  const button = $('logout-button');
  button.disabled = true;
  try {
    await api('logout.php', {
      method: 'POST',
      headers: { 'X-CSRF-Token': state.csrfToken || '' }
    });
    showLogin('You have signed out.');
    message('login-message', 'You have signed out.', 'info');
  } catch (error) {
    message('workspace-message', error.message || 'Sign-out failed.');
  } finally {
    button.disabled = false;
  }
});
$('branch-search').addEventListener('input', renderBranches);
$('refresh-button').addEventListener('click', loadBranches);
start();
