const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export function getAuthToken() {
  return localStorage.getItem('jobbot_auth_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('jobbot_auth_token', token);
  } else {
    localStorage.removeItem('jobbot_auth_token');
  }
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = getAuthToken();
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ── Auth APIs ────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Invalid email or password');
  }
  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function registerUser(email, password, name) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Registration failed');
  }
  const data = await res.json();
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error('Unauthenticated');
  }
  return res.json();
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch (err) {
    // Ignore network error on logout
  }
  setAuthToken(null);
}

// ── App Core APIs ────────────────────────────────────────────────
export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function saveConfig(config) {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save config');
  return res.json();
}

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch status');
  return res.json();
}

export async function startBot() {
  const res = await fetch(`${API_BASE}/bot/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to start bot');
  return res.json();
}

export async function stopBot() {
  const res = await fetch(`${API_BASE}/bot/stop`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to stop bot');
  return res.json();
}

export async function fetchAppliedJobs() {
  const res = await fetch(`${API_BASE}/jobs`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch applied jobs');
  return res.json();
}

export async function fetchRecentLogs(limit = 150) {
  const res = await fetch(`${API_BASE}/logs?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function fetchResumeStatus() {
  const res = await fetch(`${API_BASE}/resume/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch resume status');
  return res.json();
}

export async function uploadResume(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/resume/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload resume');
  }
  return res.json();
}

export async function parseResume() {
  const res = await fetch(`${API_BASE}/resume/parse`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to parse resume');
  }
  return res.json();
}

export async function deleteResume() {
  const res = await fetch(`${API_BASE}/resume`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to delete resume');
  }
  return res.json();
}

// ── Responses & Inbox APIs ───────────────────────────────────────
export async function fetchResponses() {
  const res = await fetch(`${API_BASE}/responses`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch responses');
  return res.json();
}

export async function fetchResponseMetrics() {
  const res = await fetch(`${API_BASE}/responses/metrics`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function updateResponseRecord(id, status, notes = '', interviewDate = null) {
  const res = await fetch(`${API_BASE}/responses/update`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id, status, notes, interview_date: interviewDate }),
  });
  if (!res.ok) throw new Error('Failed to update response status');
  return res.json();
}

export async function checkInboxForResponses() {
  const res = await fetch(`${API_BASE}/responses/check-inbox`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to scan inbox');
  return res.json();
}

// ── Google Jobs & Career Pages Collector APIs ────────────────────
export async function fetchCollectorJobs() {
  const res = await fetch(`${API_BASE}/collector/jobs`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch collected jobs');
  return res.json();
}

export async function runJobCollector() {
  const res = await fetch(`${API_BASE}/collector/run`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to run job collector');
  return res.json();
}

export async function clearCollectorJobs() {
  const res = await fetch(`${API_BASE}/collector/clear`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear collector jobs');
  return res.json();
}

// ── Scheduler & Email APIs ───────────────────────────────────────
export async function fetchSchedulerStatus() {
  const res = await fetch(`${API_BASE}/scheduler/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch scheduler status');
  return res.json();
}

export async function runSchedulerNow() {
  const res = await fetch(`${API_BASE}/scheduler/run-now`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to trigger scheduled run');
  return res.json();
}

export async function applySelectedJobsNow(jobIds) {
  const res = await fetch(`${API_BASE}/scheduler/apply-selected-now`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ job_ids: jobIds }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to apply to selected jobs');
  }
  return res.json();
}

export async function testEmailSettings(payload) {
  const res = await fetch(`${API_BASE}/email/test`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to send test email');
  }
  return res.json();
}

// ── AI Message & Email Generator APIs ───────────────────────────
export async function generateAIMessage(payload) {
  const res = await fetch(`${API_BASE}/ai/generate`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to generate message with AI');
  }
  return res.json();
}

export async function updateJobStatus(jobId, status) {
  const res = await fetch(`${API_BASE}/jobs/update-status`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ job_id: jobId, status }),
  });
  if (!res.ok) throw new Error('Failed to update job status');
  return res.json();
}

export async function applyJobLive(jobId) {
  const res = await fetch(`${API_BASE}/jobs/apply-live`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to execute live apply');
  }
  return res.json();
}

export async function deleteJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/delete`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) throw new Error('Failed to delete job');
  return res.json();
}

export async function bulkDeleteJobs(jobIds) {
  const res = await fetch(`${API_BASE}/jobs/bulk-delete`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ job_ids: jobIds }),
  });
  if (!res.ok) throw new Error('Failed to bulk delete jobs');
  return res.json();
}

export async function clearAllJobs() {
  const res = await fetch(`${API_BASE}/jobs/clear`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to clear all jobs');
  return res.json();
}

export async function bulkUpdateJobStatus(jobIds, status = 'Applied') {
  const res = await fetch(`${API_BASE}/jobs/bulk-update-status`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ job_ids: jobIds, status }),
  });
  if (!res.ok) throw new Error('Failed to bulk update job status');
  return res.json();
}

export async function autoUpdateJobStatuses() {
  const res = await fetch(`${API_BASE}/jobs/auto-update-status`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to auto-update job statuses');
  return res.json();
}

export async function fetchPlatformStatus() {
  const res = await fetch(`${API_BASE}/platform/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch platform status');
  return res.json();
}

export async function connectPlatformCredentials(platform, email, password) {
  const res = await fetch(`${API_BASE}/platforms/connect-credentials`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ platform, email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || 'Failed to connect credentials');
  return data;
}

export async function openPlatformLoginBrowser(platform) {
  const res = await fetch(`${API_BASE}/platforms/open-login-browser`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ platform }),
  });
  return res.json();
}

export async function verifyPlatformSession(platform) {
  const res = await fetch(`${API_BASE}/platforms/verify-session`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ platform }),
  });
  return res.json();
}

export async function checkPlatformLoginStatus(platform) {
  const res = await fetch(`${API_BASE}/platforms/check-login-status`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ platform }),
  });
  return res.json();
}

export async function disconnectPlatform(platform) {
  const res = await fetch(`${API_BASE}/platforms/disconnect`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ platform }),
  });
  return res.json();
}

export async function testAIConnection(payload) {
  const res = await fetch(`${API_BASE}/ai/test`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'AI connection test failed');
  }
  return res.json();
}

export async function fetchGmailStatus() {
  const res = await fetch(`${API_BASE}/gmail/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch Gmail status');
  return res.json();
}

export async function connectGmail(email, app_password) {
  const res = await fetch(`${API_BASE}/gmail/connect`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, app_password }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to connect Gmail');
  }
  return res.json();
}

export async function disconnectGmail() {
  const res = await fetch(`${API_BASE}/gmail/disconnect`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to disconnect Gmail');
  return res.json();
}

export async function fetchCustomAnswers() {
  const res = await fetch(`${API_BASE}/candidate/custom-answers`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch custom answers');
  return res.json();
}

export async function saveCustomAnswer(question, answer) {
  const res = await fetch(`${API_BASE}/candidate/custom-answers`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question, answer }),
  });
  if (!res.ok) throw new Error('Failed to save custom answer');
  return res.json();
}

export async function deleteCustomAnswer(question) {
  const res = await fetch(`${API_BASE}/candidate/custom-answers`, {
    method: 'DELETE',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('Failed to delete custom answer');
  return res.json();
}

// ── AI Intelligence Suite & Custom Tools ───────────────────────────
export async function tailorResume(payload) {
  const res = await fetch(`${API_BASE}/ai/tailor-resume`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to tailor resume');
  }
  return res.json();
}

export async function draftRecruiterReply(payload) {
  const res = await fetch(`${API_BASE}/ai/reply-draft`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to generate recruiter reply');
  }
  return res.json();
}

export async function askScreeningQuestion(payload) {
  const res = await fetch(`${API_BASE}/ai/screening-answer`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to generate screening answer');
  }
  return res.json();
}

export async function applyDirectEmail(payload) {
  const res = await fetch(`${API_BASE}/email/apply-direct`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to dispatch direct email application');
  }
  return res.json();
}

export async function testTriggerAlert(payload) {
  const res = await fetch(`${API_BASE}/email/test-trigger-alert`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to dispatch test trigger alert');
  }
  return res.json();
}

export async function masterOpenPlatforms() {
  const res = await fetch(`${API_BASE}/platforms/master-open`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to open Master Connect window');
  }
  return res.json();
}

export async function masterSyncPlatforms() {
  const res = await fetch(`${API_BASE}/platforms/master-sync`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Master sync request failed');
  }
  return res.json();
}


export async function masterConnectWithCredentials(email, password, platforms = null) {
  const res = await fetch(`${API_BASE}/platforms/master-credentials`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ email, password, platforms }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || 'Failed to connect platforms with credentials');
  return data;
}
