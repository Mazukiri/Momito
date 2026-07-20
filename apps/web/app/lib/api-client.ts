'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown[];
}

export class ApiClientError extends Error {
  statusCode: number;
  details?: unknown[];

  constructor(err: ApiError) {
    super(err.message);
    this.name = 'ApiClientError';
    this.statusCode = err.statusCode;
    this.details = err.details;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('momito_token');
}

export function setToken(token: string) {
  localStorage.setItem('momito_token', token);
}

export function clearToken() {
  localStorage.removeItem('momito_token');
}

// A 401 mid-session (token expired, or revoked by logout on another device —
// see JwtAuthGuard's tokenVersion check) used to just silently clearToken()
// here with nothing downstream reacting to it: the UI kept rendering whatever
// it last had until the user happened to navigate or reload. AuthProvider
// listens for this event and sets its user to null, which
// (authenticated)/layout.tsx's existing "no user → redirect to /login" effect
// then picks up immediately. Login/register calls are excluded (see
// callers below) since a wrong-password 401 there is a normal inline form
// error, not a revoked session.
function notifyUnauthorized() {
  clearToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('momito:unauthorized'));
  }
}

// MOM-177: the API runs on Render's free tier, which spins the instance down
// after ~15 min idle and takes 30–60s to wake. `fetch` has no default timeout,
// so the first request of the morning used to hang on a bare spinner for up to
// a minute and then, if the browser gave up first, reject with a raw TypeError
// that is not an ApiClientError at all — every caller does
// `err instanceof Error ? err.message : …`, so what the user actually read on
// the login form was the literal string "Failed to fetch".
//
// A cold start is not an error, it is a wait. These two constants split that
// wait into "probably waking" and "actually broken".
const WAKE_HINT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 45_000;

/** A transport failure — no HTTP response was ever received. */
export class ApiNetworkError extends Error {
  /** True when the request was aborted on our own timeout rather than refused. */
  readonly timedOut: boolean;

  constructor(message: string, timedOut: boolean) {
    super(message);
    this.name = 'ApiNetworkError';
    this.timedOut = timedOut;
  }
}

/**
 * Fires once the request has been in flight long enough that a cold start is
 * the likely explanation. The shell listens and can say so, instead of showing
 * a silent spinner. Emitted at most once per request; `momito:api-awake`
 * always follows, whether the request succeeded or failed.
 */
function announce(event: 'momito:api-waking' | 'momito:api-awake') {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(event));
}

async function fetchWithWake(url: string, options: RequestInit): Promise<Response> {
  // Retry once, and only for the idempotent verbs. A timed-out POST may well
  // have been applied server-side; replaying it could double-create.
  const method = (options.method ?? 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  let announced = false;

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const hint = setTimeout(() => {
      announced = true;
      announce('momito:api-waking');
    }, WAKE_HINT_MS);
    try {
      return await fetch(url, { ...options, signal: options.signal ?? controller.signal });
    } finally {
      clearTimeout(timeout);
      clearTimeout(hint);
    }
  };

  try {
    try {
      return await attempt();
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      // A caller-supplied signal is theirs to own — never retry over it.
      if (!retryable || options.signal) throw asNetworkError(error, timedOut);
      // One retry: a wake triggered by the first request is usually complete by
      // the time the second lands.
      try {
        return await attempt();
      } catch (retryError) {
        throw asNetworkError(retryError, retryError instanceof DOMException && retryError.name === 'AbortError');
      }
    }
  } finally {
    if (announced) announce('momito:api-awake');
  }
}

function asNetworkError(error: unknown, timedOut: boolean): ApiNetworkError {
  if (timedOut) {
    return new ApiNetworkError(
      'The server is taking longer than usual to respond. It may be waking up — try again in a moment.',
      true,
    );
  }
  return new ApiNetworkError("Can't reach the server. Check your connection and try again.", false);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetchWithWake(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
      notifyUnauthorized();
    }
    let body: ApiError;
    try {
      body = await res.json();
    } catch {
      body = { statusCode: res.status, error: res.statusText, message: res.statusText };
    }
    throw new ApiClientError(body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // POST, so fetchWithWake will not retry it — an upload that timed out may
  // already have been accepted, and replaying it would duplicate the record.
  // It still gets the timeout and the typed network error.
  const res = await fetchWithWake(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    if (res.status === 401) notifyUnauthorized();
    let errorBody: ApiError;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = { statusCode: res.status, error: res.statusText, message: res.statusText };
    }
    throw new ApiClientError(errorBody);
  }

  return res.json();
}

// ── Auth ──────────────────────────────────────────
import type { AuthResponse, AuthUser } from '@momito/shared';

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<AuthUser>('/auth/me'),
};

// ── Questions ─────────────────────────────────────
import type { QuestionResponse, PaginatedResponse, TopicSummary, CompanyResponse } from '@momito/shared';

export interface ListQuestionsParams {
  topic?: string;
  difficulty?: string;
  type?: string;
  role?: string;
  area?: string;
  pattern?: string;
  company?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const questionsApi = {
  list: (params: ListQuestionsParams = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request<PaginatedResponse<QuestionResponse>>(`/questions${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<QuestionResponse>(`/questions/${id}`),

  create: (body: {
    title: string;
    prompt: string;
    type: string;
    difficulty: string;
    topicId: string;
    subtopic?: string;
    referenceAnswer?: string;
    notes?: string;
    sourceUrl?: string;
    companyIds?: string[];
  }) =>
    request<QuestionResponse>('/questions', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Partial<{
    title: string;
    prompt: string;
    type: string;
    difficulty: string;
    topicId: string;
    subtopic: string;
    referenceAnswer: string;
    notes: string;
    sourceUrl: string;
    companyIds: string[];
  }>) =>
    request<QuestionResponse>(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    request<void>(`/questions/${id}`, { method: 'DELETE' }),
};

// ── Topics ────────────────────────────────────────
export const topicsApi = {
  list: () =>
    request<TopicSummary[]>('/topics'),

  create: (body: { name: string; parentTopicId?: string; description?: string }) =>
    request<TopicSummary>('/topics', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: { name?: string; parentTopicId?: string; description?: string }) =>
    request<TopicSummary>(`/topics/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    request<void>(`/topics/${id}`, { method: 'DELETE' }),
};

// ── Companies ─────────────────────────────────────
export const companiesApi = {
  list: () =>
    request<CompanyResponse[]>('/companies'),

  get: (id: string) =>
    request<CompanyResponse>(`/companies/${id}`),

  create: (body: { name: string; region?: string; notes?: string }) =>
    request<CompanyResponse>('/companies', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: { name?: string; region?: string; notes?: string }) =>
    request<CompanyResponse>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    request<void>(`/companies/${id}`, { method: 'DELETE' }),
};

// ── Sessions ──────────────────────────────────────
import type {
  InterviewSessionResponse,
  SessionQuestionResponse,
  AnswerAttemptResponse,
  MissTagReason,
  WeaknessSignalResponse,
  WeaknessSummaryResponse,
} from '@momito/shared';

export interface CreateSessionResponse {
  session: InterviewSessionResponse;
  questions: SessionQuestionResponse[];
}

export interface SessionDetailResponse extends InterviewSessionResponse {
  sessionQuestions: SessionQuestionResponse[];
  answerAttempts: AnswerAttemptResponse[];
}

export interface CreateSessionParams {
  title?: string;
  sessionType: string;
  topicId?: string;
  companyId?: string;
  difficulty?: string;
  roleTrackId?: string;
  area?: string;
  pattern?: string;
  jobApplicationId?: string;
  missionId?: string;
  questionCount: number;
  questionIds?: string[];
}

export const sessionsApi = {
  create: (body: CreateSessionParams) =>
    request<CreateSessionResponse>('/sessions', { method: 'POST', body: JSON.stringify(body) }),

  list: (params: { status?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<PaginatedResponse<InterviewSessionResponse>>(`/sessions${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<SessionDetailResponse>(`/sessions/${id}`),

  answer: (id: string, body: {
    questionId: string;
    answerText: string;
    selfRating?: number;
    correctness?: string;
    confidence?: number;
    timeSpentSeconds?: number;
    hintUsed?: boolean;
    rubricScore?: number;
    needsReview?: boolean;
    // MOM-028/039: reflection fields.
    missTags?: MissTagReason[];
    reflectionNote?: string;
    language?: string;
    complexity?: string;
  }) =>
    request<AnswerAttemptResponse>(`/sessions/${id}/answer`, { method: 'POST', body: JSON.stringify(body) }),

  complete: (id: string) =>
    request<InterviewSessionResponse>(`/sessions/${id}/complete`, { method: 'POST' }),

  abandon: (id: string) =>
    request<InterviewSessionResponse>(`/sessions/${id}/abandon`, { method: 'POST' }),
};

// ── Attempts ──────────────────────────────────────
export const attemptsApi = {
  list: (params: { questionId?: string; sessionId?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.questionId) qs.set('questionId', params.questionId);
    if (params.sessionId) qs.set('sessionId', params.sessionId);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<PaginatedResponse<AnswerAttemptResponse>>(`/attempts${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<AnswerAttemptResponse>(`/attempts/${id}`),

  forQuestion: (questionId: string, params: { page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<PaginatedResponse<AnswerAttemptResponse>>(`/questions/${questionId}/attempts${query ? `?${query}` : ''}`);
  },

  // Standalone attempt (no session) — the Today queue's inline recall flow
  // records a typed recall as a real attempt so it feeds streak, history, and
  // weakness signals like any session answer.
  create: (body: {
    questionId: string;
    answerText: string;
    selfRating?: number;
    timeSpentSeconds?: number;
    missTags?: MissTagReason[];
    reflectionNote?: string;
  }) =>
    request<AnswerAttemptResponse>('/attempts', { method: 'POST', body: JSON.stringify(body) }),

  // Post-reveal rate/reflect (attempt lifecycle §7.2: Submit → Reveal →
  // Reflect → Self-rate). Rating here schedules the FSRS review server-side.
  update: (id: string, body: {
    selfRating?: number;
    correctness?: string;
    confidence?: number;
    missTags?: MissTagReason[];
    reflectionNote?: string;
  }) =>
    request<AnswerAttemptResponse>(`/attempts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ── Weakness signals (plan §5.4/§6.1) ───────────────────────────────────────
export const weaknessesApi = {
  summary: () => request<WeaknessSummaryResponse>('/weaknesses'),
  // MOM-127: act on a persisted signal from summary.openSignals.
  resolveSignal: (id: string) =>
    request<WeaknessSignalResponse>(`/weaknesses/signals/${id}/resolve`, { method: 'POST' }),
  dismissSignal: (id: string) =>
    request<WeaknessSignalResponse>(`/weaknesses/signals/${id}/dismiss`, { method: 'POST' }),
};

// ── AI grading (Workstream C: dormant until ANTHROPIC_API_KEY is set) ──────
export interface AiUsageResponse {
  available: boolean;
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  dailyBudgetUsd: number;
  remainingUsd: number;
}

// MOM-168: the grader's FSRS-style verdict, so the reveal panel can offer a one-tap rating.
// Null on the cached path (not recoverable from the persisted Markdown).
export type SuggestedRating = 'again' | 'hard' | 'good' | 'easy';

export interface AiGradeResponse {
  attemptId: string;
  aiScore: number | null;
  aiFeedback: string | null;
  suggestedRating: SuggestedRating | null;
  cached: boolean;
}

export const aiApi = {
  usage: () => request<AiUsageResponse>('/ai/usage'),

  grade: (attemptId: string, force = false) =>
    request<AiGradeResponse>(`/attempts/${attemptId}/grade${force ? '?force=true' : ''}`, { method: 'POST' }),
};

// ── Web Push (ADR-0008) ────────────────────────────
export interface PushConfigResponse {
  available: boolean;
  publicKey: string | null;
}

export interface PushSubscriptionKeys {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const pushApi = {
  config: () => request<PushConfigResponse>('/push/config'),

  subscribe: (subscription: PushSubscriptionKeys) =>
    request<{ ok: true }>('/push/subscriptions', { method: 'POST', body: JSON.stringify(subscription) }),

  unsubscribe: (endpoint: string) =>
    request<{ ok: true }>('/push/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
};


// ── Dashboard ─────────────────────────────────────
import type { DashboardSummaryResponse } from '@momito/shared';

export const dashboardApi = {
  summary: () =>
    request<DashboardSummaryResponse>('/dashboard/summary'),
};

// Profile and CV Scoring
import type {
  AtsCoverageResponse,
  CreateProfileScoreRequest,
  ProfileResponse,
  ProfileScoreResponse,
  UpdateProfileRequest,
} from '@momito/shared';

export const profileApi = {
  get: () =>
    request<ProfileResponse>('/profile'),

  update: (body: UpdateProfileRequest) =>
    request<ProfileResponse>('/profile', { method: 'PATCH', body: JSON.stringify(body) }),

  uploadCv: (file: File) => {
    const form = new FormData();
    form.set('file', file);
    return requestForm<ProfileResponse>('/profile/upload', form);
  },
};

export const profileScoresApi = {
  create: (body: CreateProfileScoreRequest) =>
    request<ProfileScoreResponse>('/profile-scores', { method: 'POST', body: JSON.stringify(body) }),

  list: () =>
    request<ProfileScoreResponse[]>('/profile-scores'),

  get: (id: string) =>
    request<ProfileScoreResponse>(`/profile-scores/${id}`),

  generateTasks: (id: string) =>
    request<{ created: number }>(`/profile-scores/${id}/generate-tasks`, { method: 'POST' }),

  atsCoverage: (jdText: string, resumeVersionId?: string) =>
    request<AtsCoverageResponse>('/profile-scores/ats-coverage', {
      method: 'POST',
      body: JSON.stringify({ jdText, resumeVersionId }),
    }),

  // MOM-134-full: turn the JD keywords missing from a résumé/profile into tasks.
  atsGenerateTasks: (jdText: string, resumeVersionId?: string) =>
    request<{ created: number }>('/profile-scores/ats-coverage/generate-tasks', {
      method: 'POST',
      body: JSON.stringify({ jdText, resumeVersionId }),
    }),
};

// Career OS
import type {
  CareerGoalResponse,
  CareerRoleTrack,
  ContactResponse,
  CreateContactRequest,
  CreateInterviewRoundRequest,
  CreateJobApplicationRequest,
  CreateTaskRequest,
  InterviewRoundResponse,
  JobApplicationResponse,
  JobEventResponse,
  JobFunnelResponse,
  UpdateInterviewRoundRequest,
  LearningEvidenceResponse,
  LearningHighlightResponse,
  JobReadinessResponse,
  JobStoryGapResponse,
  OfferResponse,
  UpsertOfferRequest,
  ResumeVersionResponse,
  ResumeDriftResponse,
  CreateResumeVersionRequest,
  UpdateResumeVersionRequest,
  ResumeAiEnvelope,
  ResumeAnalysisResult,
  ResumeRewriteResult,
  CoverLetterDraftResult,
  PracticeRecommendationResponse,
  ReadwiseConnectionResponse,
  ReadwiseSyncRunResponse,
  ReminderResponse,
  RoleReadinessResponse,
  TargetShortlistResponse,
  TaskResponse,
  UpdateContactRequest,
  UpdateJobApplicationRequest,
  UpdateTaskRequest,
} from '@momito/shared';

export const careerApi = {
  roleTracks: () =>
    request<CareerRoleTrack[]>('/career/role-tracks'),

  goals: () =>
    request<CareerGoalResponse[]>('/career/goals'),

  upsertGoal: (body: { roleTrackId: string; horizon?: string; status?: string; targetDate?: string | null }) =>
    request<CareerGoalResponse>('/career/goals', { method: 'POST', body: JSON.stringify(body) }),

  updateGoal: (id: string, body: { roleTrackId: string; horizon?: string; status?: string; targetDate?: string | null }) =>
    request<CareerGoalResponse>(`/career/goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  readiness: (roleTrackId: string) =>
    request<RoleReadinessResponse>(`/career/role-tracks/${roleTrackId}/readiness`),

  activeReadiness: () =>
    request<RoleReadinessResponse[]>('/career/readiness'),

  jobReadiness: (jobId: string) =>
    request<JobReadinessResponse>(`/career/jobs/${jobId}/readiness`),

  jobStoryGaps: (jobId: string) =>
    request<JobStoryGapResponse>(`/career/jobs/${jobId}/story-gaps`),

  targetShortlist: () =>
    request<TargetShortlistResponse>('/career/target-shortlist'),
};

export const contactsApi = {
  list: () =>
    request<ContactResponse[]>('/contacts'),

  listForJob: (jobId: string) =>
    request<ContactResponse[]>(`/jobs/${jobId}/contacts`),

  createForJob: (jobId: string, body: CreateContactRequest) =>
    request<ContactResponse>(`/jobs/${jobId}/contacts`, { method: 'POST', body: JSON.stringify(body) }),

  create: (body: CreateContactRequest) =>
    request<ContactResponse>('/contacts', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: UpdateContactRequest) =>
    request<ContactResponse>(`/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  remove: (id: string) =>
    request<void>(`/contacts/${id}`, { method: 'DELETE' }),
};

export const resumesApi = {
  list: () =>
    request<ResumeVersionResponse[]>('/resumes'),

  get: (id: string) =>
    request<ResumeVersionResponse>(`/resumes/${id}`),

  create: (body: CreateResumeVersionRequest) =>
    request<ResumeVersionResponse>('/resumes', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: UpdateResumeVersionRequest) =>
    request<ResumeVersionResponse>(`/resumes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  remove: (id: string) =>
    request<void>(`/resumes/${id}`, { method: 'DELETE' }),

  // MOM-136/137/138: résumé AI, dormant-until-key. These resolve to
  // {ok:false, reason} (HTTP 200) when the instance has no ANTHROPIC_API_KEY,
  // so callers render a banner rather than handling an error.
  // MOM-149: pass a jobApplicationId to have the critique judged against that JD and that
  // company's focus areas. Omitted → the API falls back to the job this version is linked to.
  aiAnalyze: (id: string, jobApplicationId?: string) =>
    request<ResumeAiEnvelope<ResumeAnalysisResult>>(`/resumes/${id}/ai/analyze`, {
      method: 'POST',
      body: JSON.stringify(jobApplicationId ? { jobApplicationId } : {}),
    }),

  // MOM-155: what the profile has gained since this version was derived from it.
  drift: (id: string) => request<ResumeDriftResponse>(`/resumes/${id}/drift`),

  // MOM-151: the analysis's missing themes become study tasks (deduped server-side, no AI spend).
  aiThemesToTasks: (id: string, themes: string[]) =>
    request<{ created: number }>(`/resumes/${id}/ai/themes-to-tasks`, {
      method: 'POST',
      body: JSON.stringify({ themes }),
    }),

  // MOM-153: both take a pasted JD *or* a jobApplicationId whose stored JD (plus that company's
  // focus areas and sponsorship posture) is used instead — so a JD captured once in the pipeline
  // never has to be re-pasted. Neither → the API falls back to the job this version is linked to.
  aiRewrite: (id: string, target: { jdText?: string; jobApplicationId?: string }) =>
    request<ResumeAiEnvelope<ResumeRewriteResult>>(`/resumes/${id}/ai/rewrite`, { method: 'POST', body: JSON.stringify(target) }),

  aiCoverLetter: (id: string, target: { jdText?: string; jobApplicationId?: string }) =>
    request<ResumeAiEnvelope<CoverLetterDraftResult>>(`/resumes/${id}/ai/cover-letter`, { method: 'POST', body: JSON.stringify(target) }),

  // MOM-139: fetch the export with the auth header (a plain <a href> can't send
  // the Bearer token), then trigger a browser download of the returned blob.
  download: async (id: string, format: 'md' | 'pdf') => {
    const token = getToken();
    const res = await fetchWithWake(`${API_BASE}/resumes/${id}/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      if (res.status === 401) notifyUnauthorized();
      throw new ApiClientError({ statusCode: res.status, error: res.statusText, message: `Export failed (${res.status})` });
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `resume.${format}`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};

export const offersApi = {
  list: () =>
    request<OfferResponse[]>('/offers'),

  getForJob: (jobId: string) =>
    request<OfferResponse | null>(`/jobs/${jobId}/offer`),

  upsertForJob: (jobId: string, body: UpsertOfferRequest) =>
    request<OfferResponse>(`/jobs/${jobId}/offer`, { method: 'PUT', body: JSON.stringify(body) }),

  removeForJob: (jobId: string) =>
    request<void>(`/jobs/${jobId}/offer`, { method: 'DELETE' }),
};

export const jobsApi = {
  list: (params: { status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    const query = qs.toString();
    return request<JobApplicationResponse[]>(`/jobs${query ? `?${query}` : ''}`);
  },

  funnel: () => request<JobFunnelResponse>('/jobs/funnel'),

  create: (body: CreateJobApplicationRequest) =>
    request<JobApplicationResponse>('/jobs', { method: 'POST', body: JSON.stringify(body) }),

  get: (id: string) =>
    request<JobApplicationResponse & { events: JobEventResponse[]; tasks: TaskResponse[]; reminders: ReminderResponse[] }>(`/jobs/${id}`),

  update: (id: string, body: UpdateJobApplicationRequest) =>
    request<JobApplicationResponse>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  addEvent: (id: string, body: { type: string; title: string; notes?: string | null; eventAt?: string | null }) =>
    request<JobEventResponse>(`/jobs/${id}/events`, { method: 'POST', body: JSON.stringify(body) }),

  generatePrep: (id: string) =>
    request<{ created: number }>(`/jobs/${id}/generate-prep`, { method: 'POST' }),

  scoreProfile: (id: string) =>
    request<ProfileScoreResponse>(`/jobs/${id}/score-profile`, { method: 'POST' }),
};

// MOM-110: interview rounds nested under a job.
export const interviewRoundsApi = {
  list: (jobId: string) =>
    request<InterviewRoundResponse[]>(`/jobs/${jobId}/rounds`),

  create: (jobId: string, body: CreateInterviewRoundRequest) =>
    request<InterviewRoundResponse>(`/jobs/${jobId}/rounds`, { method: 'POST', body: JSON.stringify(body) }),

  update: (jobId: string, roundId: string, body: UpdateInterviewRoundRequest) =>
    request<InterviewRoundResponse>(`/jobs/${jobId}/rounds/${roundId}`, { method: 'PATCH', body: JSON.stringify(body) }),

  remove: (jobId: string, roundId: string) =>
    request<{ deleted: boolean }>(`/jobs/${jobId}/rounds/${roundId}`, { method: 'DELETE' }),

  generatePrep: (jobId: string, roundId: string) =>
    request<{ created: number }>(`/jobs/${jobId}/rounds/${roundId}/prep`, { method: 'POST' }),
};

export const tasksApi = {
  list: (params: { range?: string; status?: string; type?: string; roleTrackId?: string; missionId?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) qs.set(key, value);
    });
    const query = qs.toString();
    return request<TaskResponse[]>(`/tasks${query ? `?${query}` : ''}`);
  },

  create: (body: CreateTaskRequest) =>
    request<TaskResponse>('/tasks', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: UpdateTaskRequest) =>
    request<TaskResponse>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  complete: (id: string) =>
    request<TaskResponse>(`/tasks/${id}/complete`, { method: 'POST' }),

  snooze: (id: string, snoozedUntil: string) =>
    request<TaskResponse>(`/tasks/${id}/snooze`, { method: 'POST', body: JSON.stringify({ snoozedUntil }) }),

  remove: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const remindersApi = {
  list: () =>
    request<ReminderResponse[]>('/reminders'),

  dismiss: (id: string) =>
    request<ReminderResponse>(`/reminders/${id}/dismiss`, { method: 'POST' }),
};

import type { CreateStoryRequest, StoryResponse, UpdateStoryRequest } from '@momito/shared';

// MOM-064/065: CRUD API client for the Story Bank, consumed by
// apps/web/app/(authenticated)/stories/page.tsx.
export const storiesApi = {
  list: () =>
    request<StoryResponse[]>('/stories'),

  get: (id: string) =>
    request<StoryResponse>(`/stories/${id}`),

  create: (body: CreateStoryRequest) =>
    request<StoryResponse>('/stories', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: UpdateStoryRequest) =>
    request<StoryResponse>(`/stories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  remove: (id: string) =>
    request<void>(`/stories/${id}`, { method: 'DELETE' }),

  // MOM-066: link/unlink a story to a behavioral prompt (Question).
  linkPrompt: (storyId: string, questionId: string) =>
    request<StoryResponse>(`/stories/${storyId}/prompts`, { method: 'POST', body: JSON.stringify({ questionId }) }),

  unlinkPrompt: (storyId: string, questionId: string) =>
    request<StoryResponse>(`/stories/${storyId}/prompts/${questionId}`, { method: 'DELETE' }),
};

import type { ReviewableObjectType, ReviewStateResponse } from '@momito/shared';

export const reviewsApi = {
  due: () =>
    request<ReviewStateResponse[]>('/reviews/due'),

  record: (objectType: ReviewableObjectType, objectId: string, selfRating: number) =>
    request<ReviewStateResponse>(`/reviews/${objectType}/${objectId}`, {
      method: 'POST',
      body: JSON.stringify({ selfRating }),
    }),
};

export const learningApi = {
  readwiseConnection: () =>
    request<ReadwiseConnectionResponse | null>('/integrations/readwise'),

  connectReadwise: (token: string) =>
    request<ReadwiseConnectionResponse>('/integrations/readwise/connect', { method: 'POST', body: JSON.stringify({ token }) }),

  syncReadwise: () =>
    request<ReadwiseSyncRunResponse>('/integrations/readwise/sync', { method: 'POST' }),

  inbox: () =>
    request<LearningHighlightResponse[]>('/learning/inbox'),

  getHighlight: (id: string) =>
    request<LearningHighlightResponse>(`/learning/highlights/${id}`),

  updateHighlight: (id: string, body: { roleTrackId?: string | null; area?: string | null; topicId?: string | null; reviewed?: boolean; usefulness?: string | null }) =>
    request<LearningHighlightResponse>(`/learning/highlights/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  ledger: (params: { roleTrackId?: string; area?: string; missionId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.roleTrackId) qs.set('roleTrackId', params.roleTrackId);
    if (params.area) qs.set('area', params.area);
    if (params.missionId) qs.set('missionId', params.missionId);
    const query = qs.toString();
    return request<LearningEvidenceResponse[]>(`/learning/ledger${query ? `?${query}` : ''}`);
  },

  createEvidence: (body: {
    type: string;
    title: string;
    body?: string | null;
    roleTrackId?: string | null;
    area?: string | null;
    topicId?: string | null;
    metadata?: Record<string, unknown>;
    missionId?: string | null;
    occurredAt?: string | null;
  }) =>
    request<LearningEvidenceResponse>('/learning/evidence', { method: 'POST', body: JSON.stringify(body) }),
};

export const recommendationsApi = {
  list: () =>
    request<PracticeRecommendationResponse[]>('/practice/recommendations'),
};

// MOM-162 (D-021): missionsApi removed — the Missions engine is retired.

// ── Content Coverage (MOM-062) ────────────────────
import type { ContentCoverageResponse, DsaProgressResponse } from '@momito/shared';

export const contentApi = {
  coverage: () => request<ContentCoverageResponse>('/content/coverage'),
};

// ── DSA Ladder Progress (MOM-050) ─────────────────
export const dsaApi = {
  progress: () => request<DsaProgressResponse>('/dsa/progress'),
};
