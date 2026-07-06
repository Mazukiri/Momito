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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

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

  const res = await fetch(`${API_BASE}${path}`, {
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
import type { QuestionResponse, PaginatedResponse, TopicSummary, CompanySummary } from '@momito/shared';

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
    request<CompanySummary[]>('/companies'),

  create: (body: { name: string; region?: string; notes?: string }) =>
    request<CompanySummary>('/companies', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: { name?: string; region?: string; notes?: string }) =>
    request<CompanySummary>(`/companies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    request<void>(`/companies/${id}`, { method: 'DELETE' }),
};

// ── Sessions ──────────────────────────────────────
import type {
  InterviewSessionResponse,
  SessionQuestionResponse,
  AnswerAttemptResponse,
  MissTagReason,
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

export interface AiGradeResponse {
  attemptId: string;
  aiScore: number | null;
  aiFeedback: string | null;
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
};

// Career OS
import type {
  CareerGoalResponse,
  CareerRoleTrack,
  CreateJobApplicationRequest,
  CreateMissionRequest,
  CreateTaskRequest,
  JobApplicationResponse,
  JobEventResponse,
  LearningEvidenceResponse,
  LearningHighlightResponse,
  MissionCheckInResponse,
  MissionDetailResponse,
  MissionResponse,
  MissionTodayResponse,
  PracticeRecommendationResponse,
  ReadwiseConnectionResponse,
  ReadwiseSyncRunResponse,
  ReminderResponse,
  RoleReadinessResponse,
  TaskResponse,
  UpdateJobApplicationRequest,
  UpdateMissionRequest,
  UpdateTaskRequest,
  WeeklyPlanResponse,
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
};

export const jobsApi = {
  list: (params: { status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    const query = qs.toString();
    return request<JobApplicationResponse[]>(`/jobs${query ? `?${query}` : ''}`);
  },

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

export const missionsApi = {
  list: (params: { stage?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.stage) qs.set('stage', params.stage);
    const query = qs.toString();
    return request<MissionResponse[]>(`/missions${query ? `?${query}` : ''}`);
  },

  create: (body: CreateMissionRequest) =>
    request<MissionResponse>('/missions', { method: 'POST', body: JSON.stringify(body) }),

  createFromJob: (jobId: string) =>
    request<MissionDetailResponse>(`/missions/from-job/${jobId}`, { method: 'POST' }),

  get: (id: string) =>
    request<MissionDetailResponse>(`/missions/${id}`),

  update: (id: string, body: UpdateMissionRequest) =>
    request<MissionResponse>(`/missions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  diagnose: (id: string) =>
    request<MissionDetailResponse>(`/missions/${id}/diagnose`, { method: 'POST' }),

  generatePlan: (id: string) =>
    request<WeeklyPlanResponse>(`/missions/${id}/plans/generate`, { method: 'POST' }),

  today: (id: string) =>
    request<MissionTodayResponse>(`/missions/${id}/today`),

  createCheckIn: (id: string, body: { summary: string; wins?: string | null; blockers?: string | null; adjustments?: string | null }) =>
    request<MissionCheckInResponse>(`/missions/${id}/check-ins`, { method: 'POST', body: JSON.stringify(body) }),

  reviewPlan: (id: string, body: { summary?: string; wins?: string | null; blockers?: string | null; adjustments?: string | null } = {}) =>
    request<WeeklyPlanResponse>(`/plans/${id}/review`, { method: 'POST', body: JSON.stringify(body) }),
};

// ── Content Coverage (MOM-062) ────────────────────
import type { ContentCoverageResponse, DsaProgressResponse } from '@momito/shared';

export const contentApi = {
  coverage: () => request<ContentCoverageResponse>('/content/coverage'),
};

// ── DSA Ladder Progress (MOM-050) ─────────────────
export const dsaApi = {
  progress: () => request<DsaProgressResponse>('/dsa/progress'),
};
