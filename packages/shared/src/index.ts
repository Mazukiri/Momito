export const QUESTION_TYPES = [
  'dsa',
  'backend',
  'javascript',
  'typescript',
  'nodejs',
  'database',
  'os',
  'networking',
  'oop',
  'system_design',
  'behavioral',
] as const;

export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface TopicSummary {
  id: string;
  name: string;
}

export interface CompanySummary {
  id: string;
  name: string;
}

export interface QuestionResponse {
  id: string;
  title: string;
  prompt: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  topicId: string;
  topic: TopicSummary;
  companies: CompanySummary[];
  subtopic: string | null;
  referenceAnswer: string | null;
  notes: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const SESSION_TYPES = ['quick_practice', 'topic_practice', 'company_practice', 'mixed_mock'] as const;
export const SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface CreateSessionRequest {
  title?: string;
  sessionType: SessionType;
  topicId?: string;
  companyId?: string;
  difficulty?: QuestionDifficulty;
  questionCount: number;
  questionIds?: string[];
}

export interface InterviewSessionResponse {
  id: string;
  userId: string;
  title: string | null;
  sessionType: SessionType;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionQuestionResponse {
  id: string;
  sessionId: string;
  questionId: string;
  order: number;
  question: QuestionResponse;
}

export interface AnswerAttemptResponse {
  id: string;
  userId: string;
  sessionId: string | null;
  questionId: string;
  answerText: string;
  selfRating: number | null;
  aiScore: number | null;
  aiFeedback: string | null;
  createdAt: string;
  updatedAt: string;
}

export const STUDY_PLAN_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type StudyPlanStatus = (typeof STUDY_PLAN_STATUSES)[number];

export interface StudyPlanItemResponse {
  id: string;
  userId: string;
  topicId: string | null;
  topic: TopicSummary | null;
  title: string;
  notes: string | null;
  targetDate: string | null;
  status: StudyPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TopicProgress {
  topicId: string;
  topicName: string;
  attempted: number;
  total: number;
  percentage: number;
}

export interface WeakTopic {
  topicId: string;
  topicName: string;
  avgSelfRating: number;
}

export interface DashboardSummaryResponse {
  totalQuestionsPracticed: number;
  totalSessions: number;
  topicProgress: TopicProgress[];
  recentSessions: InterviewSessionResponse[];
  weakTopics: WeakTopic[];
  suggestedNextTopics: TopicSummary[];
}
