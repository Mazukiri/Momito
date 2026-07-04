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
  'cpp',
  'concurrency',
  'computer_architecture',
  'machine_learning',
  'hpc',
  'quant',
] as const;

export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

// MOM-045: DSA pattern taxonomy (plan §8.2 targets 25 patterns at full coverage).
// Used to tag seeded DSA items and, later, to drive the DSA ladder UI (MOM-051).
export const DSA_PATTERNS = [
  'two_pointers',
  'sliding_window',
  'fast_slow_pointers',
  'merge_intervals',
  'cyclic_sort',
  'binary_search',
  'tree_bfs',
  'tree_dfs',
  'graph_traversal',
  'topological_sort',
  'union_find',
  'backtracking',
  'dynamic_programming',
  'greedy',
  'heap_priority_queue',
  'monotonic_stack',
  'prefix_sum',
  'bit_manipulation',
  'trie',
  'linked_list_reversal',
] as const;
export type DsaPattern = (typeof DSA_PATTERNS)[number];

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
  roleTags: string[];
  areaTags: string[];
  patternTags: string[];
  estimatedMinutes: number | null;
  rubric: Record<string, unknown>;
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export const SESSION_TYPES = [
  'quick_practice',
  'topic_practice',
  'company_practice',
  'mixed_mock',
  'role_drill',
  'weak_area_review',
  'daily_mixed_set',
  'job_prep',
  'spaced_review',
] as const;
export const SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface CreateSessionRequest {
  title?: string;
  sessionType: SessionType;
  topicId?: string;
  companyId?: string;
  difficulty?: QuestionDifficulty;
  roleTrackId?: CareerRoleTrackId;
  area?: CareerRoleAreaId;
  pattern?: string;
  jobApplicationId?: string;
  questionCount: number;
  questionIds?: string[];
}

export interface InterviewSessionResponse {
  id: string;
  userId: string;
  title: string | null;
  sessionType: SessionType;
  status: SessionStatus;
  roleTrackId?: CareerRoleTrackId | null;
  area?: CareerRoleAreaId | null;
  practiceMode?: string | null;
  jobApplicationId?: string | null;
  missionId?: string | null;
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
  correctness?: string | null;
  confidence?: number | null;
  timeSpentSeconds?: number | null;
  hintUsed?: boolean;
  rubricScore?: number | null;
  needsReview?: boolean;
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
  activeGoals?: CareerGoalResponse[];
  activeMissions?: MissionResponse[];
  focusMission?: MissionResponse | null;
  todayPlanItems?: PlanItemResponse[];
  roleReadiness?: RoleReadinessResponse[];
  dueTasks?: TaskResponse[];
  reminders?: ReminderResponse[];
  recommendations?: PracticeRecommendationResponse[];
}

export const CAREER_ROLE_TRACK_IDS = [
  'big-tech-swe',
  'google-l4-swe',
  'hpc-gpu-engineer',
  'quant-swe',
] as const;
export type CareerRoleTrackId = (typeof CAREER_ROLE_TRACK_IDS)[number];

export const CAREER_ROLE_AREA_IDS = [
  'dsa',
  'system_design',
  'lld_oop',
  'cs_fundamentals',
  'language_runtime',
  'domain_knowledge',
  'projects',
  'behavioral',
  'profile',
] as const;
export type CareerRoleAreaId = (typeof CAREER_ROLE_AREA_IDS)[number];

export const CAREER_GOAL_HORIZONS = ['now', '3_months', '6_months', '12_months'] as const;
export type CareerGoalHorizon = (typeof CAREER_GOAL_HORIZONS)[number];

export const CAREER_GOAL_STATUSES = ['active', 'paused', 'archived'] as const;
export type CareerGoalStatus = (typeof CAREER_GOAL_STATUSES)[number];

export interface RoleChecklistItem {
  id: string;
  area: CareerRoleAreaId;
  title: string;
  description: string;
  evidenceType: 'practice' | 'learning' | 'project' | 'profile' | 'job';
  weight: number;
  keywords: string[];
}

export interface CareerRoleTrack {
  id: CareerRoleTrackId;
  label: string;
  description: string;
  defaultHorizon: CareerGoalHorizon;
  profileRoleTemplate: RoleTemplateId;
  checklist: RoleChecklistItem[];
}

export const CAREER_ROLE_TRACKS: Record<CareerRoleTrackId, CareerRoleTrack> = {
  'big-tech-swe': {
    id: 'big-tech-swe',
    label: 'Big Tech SWE',
    description: 'General SWE interview readiness for large product and infrastructure companies.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'big-tech-dsa-patterns', area: 'dsa', title: 'Core DSA patterns', description: 'Arrays, graphs, trees, DP, heaps, intervals, and binary search.', evidenceType: 'practice', weight: 3, keywords: ['arrays', 'graphs', 'trees', 'dynamic programming', 'heap'] },
      { id: 'big-tech-system-design', area: 'system_design', title: 'Scalable system design', description: 'Capacity, APIs, storage, cache, queues, and reliability tradeoffs.', evidenceType: 'practice', weight: 3, keywords: ['capacity', 'cache', 'queue', 'storage', 'reliability'] },
      { id: 'big-tech-lld', area: 'lld_oop', title: 'Maintainable code design', description: 'Interfaces, state machines, dependency inversion, and testable design.', evidenceType: 'practice', weight: 2, keywords: ['oop', 'design pattern', 'testable', 'interface'] },
      { id: 'big-tech-project', area: 'projects', title: 'Full-stack/system project', description: 'A shipped project with API, database, auth, observability, and deployment evidence.', evidenceType: 'project', weight: 3, keywords: ['full-stack', 'api', 'database', 'deployment'] },
      { id: 'big-tech-behavioral', area: 'behavioral', title: 'Behavioral story bank', description: 'STAR stories for ownership, conflict, ambiguity, and failure.', evidenceType: 'practice', weight: 1, keywords: ['ownership', 'conflict', 'ambiguity', 'failure'] },
    ],
  },
  'google-l4-swe': {
    id: 'google-l4-swe',
    label: 'Google L4 SWE',
    description: 'Mid-level software engineering readiness focused on coding, design, and production impact.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'google-dsa-depth', area: 'dsa', title: 'Medium/hard DSA fluency', description: 'Reliable solving across graph, DP, tree, and search problems.', evidenceType: 'practice', weight: 4, keywords: ['graph', 'dp', 'tree', 'binary search'] },
      { id: 'google-design-depth', area: 'system_design', title: 'L4 design bar', description: 'Design common systems and explain bottlenecks, consistency, and failure modes.', evidenceType: 'practice', weight: 3, keywords: ['consistency', 'bottleneck', 'failure', 'scaling'] },
      { id: 'google-cs-core', area: 'cs_fundamentals', title: 'Core CS fundamentals', description: 'OS, networking, database, and concurrency tradeoffs.', evidenceType: 'learning', weight: 2, keywords: ['os', 'networking', 'database', 'concurrency'] },
      { id: 'google-impact-profile', area: 'profile', title: 'Impact-heavy profile', description: 'Profile has quantified impact, strong projects, and production ownership.', evidenceType: 'profile', weight: 2, keywords: ['impact', 'scale', 'latency', 'ownership'] },
      { id: 'google-project-depth', area: 'projects', title: 'Distributed systems project', description: 'A project demonstrating scalability, data flow, reliability, or infra depth.', evidenceType: 'project', weight: 3, keywords: ['distributed', 'scalable', 'reliability', 'infrastructure'] },
    ],
  },
  'hpc-gpu-engineer': {
    id: 'hpc-gpu-engineer',
    label: 'HPC/GPU Engineer',
    description: 'Preparation for performance, parallel computing, CUDA, and systems-heavy engineering roles.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'hpc-engineer',
    checklist: [
      { id: 'hpc-cpp', area: 'language_runtime', title: 'Modern C++ depth', description: 'Memory, RAII, templates, concurrency, profiling, and build systems.', evidenceType: 'learning', weight: 3, keywords: ['c++', 'raii', 'templates', 'profiling', 'cmake'] },
      { id: 'hpc-parallel', area: 'domain_knowledge', title: 'Parallel computing', description: 'MPI, OpenMP, CUDA, kernels, memory hierarchy, and performance tuning.', evidenceType: 'learning', weight: 4, keywords: ['mpi', 'openmp', 'cuda', 'kernel', 'memory hierarchy'] },
      { id: 'hpc-cs', area: 'cs_fundamentals', title: 'Architecture and OS fundamentals', description: 'Cache, scheduling, NUMA, vectorization, and synchronization.', evidenceType: 'practice', weight: 3, keywords: ['cache', 'numa', 'vectorization', 'synchronization'] },
      { id: 'hpc-project', area: 'projects', title: 'Performance project', description: 'A benchmarked implementation with measurable speedup and profiling evidence.', evidenceType: 'project', weight: 4, keywords: ['benchmark', 'speedup', 'cuda', 'simulation', 'parallel'] },
      { id: 'hpc-dsa', area: 'dsa', title: 'Systems-friendly DSA', description: 'Graphs, arrays, memory-aware algorithms, and complexity fluency.', evidenceType: 'practice', weight: 2, keywords: ['graph', 'array', 'complexity', 'memory'] },
    ],
  },
  'quant-swe': {
    id: 'quant-swe',
    label: 'Quant SWE',
    description: 'Preparation for quant developer and hedge fund software engineering roles.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'quant-hedge-fund-swe',
    checklist: [
      { id: 'quant-dsa', area: 'dsa', title: 'Fast coding and algorithms', description: 'High accuracy under time pressure for arrays, DP, graphs, and data structures.', evidenceType: 'practice', weight: 4, keywords: ['algorithms', 'data structures', 'dp', 'graphs'] },
      { id: 'quant-math', area: 'domain_knowledge', title: 'Probability and statistics', description: 'Probability, statistics, expected value, distributions, and estimation.', evidenceType: 'learning', weight: 3, keywords: ['probability', 'statistics', 'expected value', 'distribution'] },
      { id: 'quant-systems', area: 'system_design', title: 'Low-latency systems', description: 'Throughput, latency, queues, market data, caching, and operational risk.', evidenceType: 'practice', weight: 3, keywords: ['latency', 'throughput', 'market data', 'queue'] },
      { id: 'quant-project', area: 'projects', title: 'Backtesting/trading project', description: 'A tested project with data ingestion, strategy evaluation, and risk metrics.', evidenceType: 'project', weight: 4, keywords: ['backtesting', 'trading', 'risk', 'pandas', 'market'] },
      { id: 'quant-cpp-python', area: 'language_runtime', title: 'Python/C++ production fluency', description: 'Python data stack plus C++ performance fundamentals.', evidenceType: 'learning', weight: 2, keywords: ['python', 'c++', 'numpy', 'pandas'] },
    ],
  },
};

export interface CareerGoalResponse {
  id: string;
  userId: string;
  roleTrackId: CareerRoleTrackId;
  roleTrack: CareerRoleTrack;
  horizon: CareerGoalHorizon;
  status: CareerGoalStatus;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleAreaReadiness {
  area: CareerRoleAreaId;
  totalWeight: number;
  completedWeight: number;
  percentage: number;
  completedItems: string[];
  gapItems: RoleChecklistItem[];
}

export interface RoleReadinessResponse {
  roleTrackId: CareerRoleTrackId;
  roleTrack: CareerRoleTrack;
  overallPercentage: number;
  areas: RoleAreaReadiness[];
  topGaps: RoleChecklistItem[];
  nextActions: string[];
}

export const MISSION_SOURCE_TYPES = ['manual', 'career_goal', 'job_application'] as const;
export type MissionSourceType = (typeof MISSION_SOURCE_TYPES)[number];

export const MISSION_STAGES = [
  'diagnose',
  'weekly_plan',
  'execute',
  'interview',
  'retrospective',
  'archived',
] as const;
export type MissionStage = (typeof MISSION_STAGES)[number];

export const MISSION_COMPETENCY_STATUSES = ['missing', 'building', 'ready'] as const;
export type MissionCompetencyStatus = (typeof MISSION_COMPETENCY_STATUSES)[number];

export const PLAN_ITEM_TYPES = ['learn', 'practice', 'build', 'apply', 'review'] as const;
export type PlanItemType = (typeof PLAN_ITEM_TYPES)[number];

export const PLAN_ITEM_STATUSES = ['todo', 'in_progress', 'done', 'skipped'] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUSES)[number];

export interface MissionCompetencyStateResponse {
  id: string;
  missionId: string;
  checklistItemId: string;
  roleTrackId: CareerRoleTrackId;
  area: CareerRoleAreaId;
  title: string;
  description: string;
  evidenceType: RoleChecklistItem['evidenceType'];
  weight: number;
  targetLevel: number;
  currentLevel: number;
  confidence: number;
  status: MissionCompetencyStatus;
  rationale: string | null;
  evidenceCount: number;
  lastEvidenceAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionResponse {
  id: string;
  userId: string;
  name: string;
  summary: string | null;
  sourceType: MissionSourceType;
  stage: MissionStage;
  roleTrackId: CareerRoleTrackId;
  roleTrack: CareerRoleTrack;
  careerGoalId: string | null;
  jobApplicationId: string | null;
  jobApplication?: Pick<JobApplicationResponse, 'id' | 'company' | 'roleTitle' | 'status' | 'deadline'> | null;
  targetDate: string | null;
  weeklyHours: number;
  successDefinition: string | null;
  diagnosisSummary: string | null;
  activePlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanItemResponse {
  id: string;
  planId: string;
  missionId: string;
  taskId: string | null;
  title: string;
  description: string | null;
  type: PlanItemType;
  status: PlanItemStatus;
  roleTrackId: CareerRoleTrackId | null;
  area: CareerRoleAreaId | null;
  estimatedMinutes: number;
  expectedArtifact: string | null;
  scheduledFor: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanResponse {
  id: string;
  missionId: string;
  weekStart: string;
  weekEnd: string;
  status: 'active' | 'completed' | 'archived';
  focusSummary: string | null;
  generatedFromDiagnosis: string | null;
  totalPlannedHours: number;
  createdAt: string;
  updatedAt: string;
  items: PlanItemResponse[];
}

export interface MissionCheckInResponse {
  id: string;
  missionId: string;
  summary: string;
  wins: string | null;
  blockers: string | null;
  adjustments: string | null;
  checkInAt: string;
  createdAt: string;
}

export interface MissionDetailResponse extends MissionResponse {
  competencyStates: MissionCompetencyStateResponse[];
  plans: WeeklyPlanResponse[];
  recentCheckIns: MissionCheckInResponse[];
}

export interface CreateMissionRequest {
  name: string;
  summary?: string | null;
  sourceType?: MissionSourceType;
  roleTrackId: CareerRoleTrackId;
  careerGoalId?: string | null;
  jobApplicationId?: string | null;
  targetDate?: string | null;
  weeklyHours?: number;
  successDefinition?: string | null;
}

export type UpdateMissionRequest = Partial<CreateMissionRequest> & {
  stage?: MissionStage;
  diagnosisSummary?: string | null;
};

export interface MissionTodayResponse {
  mission: MissionResponse;
  activePlan: WeeklyPlanResponse | null;
  dueTasks: TaskResponse[];
  recentEvidence: LearningEvidenceResponse[];
  topCompetencies: MissionCompetencyStateResponse[];
}

export interface ProfileExperienceItem {
  company: string;
  role: string;
  years: number;
  tier: string;
  description: string;
}

export interface ProfileEducationItem {
  degree: string;
  institution: string;
  country: string;
  year: number | null;
}

export interface ProfileProjectItem {
  name: string;
  url: string | null;
  description: string;
  type: string;
  githubStars: number;
}

export interface ProfileResponse {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  skills: string[];
  experience: ProfileExperienceItem[];
  education: ProfileEducationItem[];
  projects: ProfileProjectItem[];
  rawCvText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  name?: string | null;
  email?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  skills?: string[];
  experience?: ProfileExperienceItem[];
  education?: ProfileEducationItem[];
  projects?: ProfileProjectItem[];
}

export const ROLE_TEMPLATE_IDS = ['google-l4-swe', 'hpc-engineer', 'quant-hedge-fund-swe'] as const;
export type RoleTemplateId = (typeof ROLE_TEMPLATE_IDS)[number];

export interface RoleTemplate {
  id: RoleTemplateId;
  label: string;
  requiredSkills: string[];
  preferredSkills: string[];
  projectArchetypes: string[];
  minYears: number;
  tierWeights: Record<string, number>;
}

export const ROLE_TEMPLATES: Record<RoleTemplateId, RoleTemplate> = {
  'google-l4-swe': {
    id: 'google-l4-swe',
    label: 'Google L4 SWE',
    requiredSkills: [
      'Python',
      'Go',
      'Java',
      'C++',
      'Distributed Systems',
      'Algorithms',
      'Data Structures',
      'System Design',
      'SQL',
    ],
    preferredSkills: ['Kubernetes', 'gRPC', 'Protobuf', 'BigQuery', 'Spanner'],
    projectArchetypes: ['distributed', 'scalable', 'open-source', 'research'],
    minYears: 2,
    tierWeights: { FAANG: 1, Tier1: 0.7, Tier2: 0.4, Startup: 0.3, Unknown: 0.1 },
  },
  'hpc-engineer': {
    id: 'hpc-engineer',
    label: 'HPC Engineer',
    requiredSkills: [
      'C++',
      'MPI',
      'OpenMP',
      'CUDA',
      'HPC',
      'Linux',
      'Parallel Computing',
      'Performance Optimization',
    ],
    preferredSkills: ['Fortran', 'Slurm', 'InfiniBand', 'VTune', 'Perf'],
    projectArchetypes: ['hpc', 'simulation', 'gpu', 'parallel', 'research'],
    minYears: 1,
    tierWeights: { FAANG: 0.8, Tier1: 0.9, Tier2: 0.6, Startup: 0.4, Unknown: 0.2 },
  },
  'quant-hedge-fund-swe': {
    id: 'quant-hedge-fund-swe',
    label: 'Quant Hedge Fund SWE',
    requiredSkills: [
      'Python',
      'C++',
      'Statistics',
      'Probability',
      'Linear Algebra',
      'Algorithms',
      'Data Structures',
      'SQL',
      'Backtesting',
    ],
    preferredSkills: ['Pandas', 'NumPy', 'R', 'MATLAB', 'Kafka', 'Redis', 'kdb+'],
    projectArchetypes: ['trading', 'quant', 'finance', 'ml', 'research', 'backtesting'],
    minYears: 1,
    tierWeights: { FAANG: 0.7, Tier1: 0.9, Tier2: 0.5, Startup: 0.5, Unknown: 0.1 },
  },
};

export interface CreateProfileScoreRequest {
  role: RoleTemplateId;
  jdText?: string | null;
}

export interface ProfileScoreResponse {
  id: string;
  userId: string;
  profileId: string;
  targetId: string;
  targetLabel: string;
  roleTemplate: RoleTemplateId;
  jdText: string | null;
  skillsMatch: number;
  projectQuality: number;
  experienceDepth: number;
  presentation: number;
  skillsGaps: string[];
  projectGaps: string[];
  experienceGaps: string[];
  presentationGaps: string[];
  suggestions: string[];
  createdAt: string;
}

export const JOB_APPLICATION_STATUSES = [
  'saved',
  'applied',
  'oa',
  'interview',
  'onsite',
  'offer',
  'rejected',
  'withdrawn',
] as const;
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export const JOB_APPLICATION_SOURCES = ['referral', 'online', 'linkedin', 'cold_email', 'recruiter', 'other'] as const;
export type JobApplicationSource = (typeof JOB_APPLICATION_SOURCES)[number];

export const VISA_TAGS = ['sponsored', 'unknown', 'not_sponsoring'] as const;
export type VisaTag = (typeof VISA_TAGS)[number];

export interface JobApplicationResponse {
  id: string;
  userId: string;
  company: string;
  roleTitle: string;
  url: string | null;
  location: string | null;
  status: JobApplicationStatus;
  roleTrackId: CareerRoleTrackId | null;
  jdText: string | null;
  appliedDate: string | null;
  deadline: string | null;
  source: JobApplicationSource | null;
  referralName: string | null;
  visaTag: VisaTag | null;
  h1bCountLastYear: number | null;
  compensationNotes: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number; tasks: number; reminders: number };
}

export interface CreateJobApplicationRequest {
  company: string;
  roleTitle: string;
  url?: string | null;
  location?: string | null;
  status?: JobApplicationStatus;
  roleTrackId?: CareerRoleTrackId | null;
  jdText?: string | null;
  appliedDate?: string | null;
  deadline?: string | null;
  source?: JobApplicationSource | null;
  referralName?: string | null;
  visaTag?: VisaTag | null;
  h1bCountLastYear?: number | null;
  compensationNotes?: string | null;
  notes?: string | null;
}

export type UpdateJobApplicationRequest = Partial<CreateJobApplicationRequest>;

export interface JobEventResponse {
  id: string;
  userId: string;
  jobApplicationId: string;
  type: string;
  title: string;
  notes: string | null;
  eventAt: string;
  createdAt: string;
}

export const TASK_TYPES = [
  'study',
  'practice',
  'reading',
  'project',
  'application',
  'interview',
  'review',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'done', 'dismissed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface TaskResponse {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  roleTrackId: CareerRoleTrackId | null;
  area: CareerRoleAreaId | null;
  topicId: string | null;
  topic?: TopicSummary | null;
  jobApplicationId: string | null;
  missionId: string | null;
  jobApplication?: Pick<JobApplicationResponse, 'id' | 'company' | 'roleTitle' | 'status'> | null;
  plannedFor: string | null;
  dueDate: string | null;
  recurrence: string | null;
  reminderOffsetMinutes: number | null;
  completedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  notes?: string | null;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  roleTrackId?: CareerRoleTrackId | null;
  area?: CareerRoleAreaId | null;
  topicId?: string | null;
  jobApplicationId?: string | null;
  missionId?: string | null;
  plannedFor?: string | null;
  dueDate?: string | null;
  recurrence?: string | null;
  reminderOffsetMinutes?: number | null;
}

export type UpdateTaskRequest = Partial<CreateTaskRequest>;

export const REMINDER_STATUSES = ['pending', 'dismissed', 'completed'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export interface ReminderResponse {
  id: string;
  userId: string;
  taskId: string | null;
  jobApplicationId: string | null;
  type: string;
  title: string;
  dueAt: string;
  status: ReminderStatus;
  lastTriggeredAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningSourceResponse {
  id: string;
  userId: string;
  externalId: string | null;
  title: string;
  author: string | null;
  url: string | null;
  sourceType: string;
  category: string | null;
  summary: string | null;
  coverImageUrl: string | null;
  readwiseUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearningHighlightResponse {
  id: string;
  userId: string;
  sourceId: string | null;
  source?: LearningSourceResponse | null;
  readwiseHighlightId: number | null;
  text: string;
  note: string | null;
  color: string | null;
  location: string | null;
  locationType: string | null;
  highlightedAt: string | null;
  readwiseUpdatedAt: string | null;
  isDeleted: boolean;
  reviewedAt: string | null;
  usefulness: string | null;
  roleTrackId: CareerRoleTrackId | null;
  area: CareerRoleAreaId | null;
  topicId: string | null;
  topic?: TopicSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningEvidenceResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  roleTrackId: CareerRoleTrackId | null;
  area: CareerRoleAreaId | null;
  topicId: string | null;
  sourceId: string | null;
  highlightId: string | null;
  taskId: string | null;
  questionId: string | null;
  jobApplicationId: string | null;
  missionId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface ReadwiseConnectionResponse {
  id: string;
  userId: string;
  status: string;
  hasToken: boolean;
  lastSyncedAt: string | null;
  nextPageCursor: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadwiseSyncRunResponse {
  id: string;
  userId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  booksProcessed: number;
  highlightsProcessed: number;
  deletedCount: number;
  error: string | null;
}

export interface PracticeRecommendationResponse {
  id: string;
  type: 'practice' | 'task' | 'reading' | 'job' | 'profile';
  title: string;
  reason: string;
  roleTrackId: CareerRoleTrackId | null;
  area: CareerRoleAreaId | null;
  targetHref: string;
  priority: number;
}

// ── Knowledge Kernel (MOM-022/023) ──────────────────────────────────────────
// Type/service-layer shapes from redesign-v2 plan §5. These describe how existing
// models (Question, Story, Task, JobApplication, ...) are *presented* uniformly;
// they intentionally do not require any schema change (see DECISIONS.md D-003).

export const KNOWLEDGE_DOMAINS = [
  'dsa',
  'system_design',
  'cs_fundamentals',
  'behavioral',
  'career',
  'story',
  'company',
  'job',
] as const;
export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];

export const KNOWLEDGE_DIFFICULTIES = ['easy', 'medium', 'hard', 'advanced'] as const;
export type KnowledgeDifficulty = (typeof KNOWLEDGE_DIFFICULTIES)[number];

export const KNOWLEDGE_PROVENANCE = [
  'seed',
  'imported',
  'user_created',
  'ai_generated',
  'manual_curated',
] as const;
export type KnowledgeProvenance = (typeof KNOWLEDGE_PROVENANCE)[number];

// Only 'published' and 'verified' items should appear in the default curriculum
// (plan §8.1) — 'draft'/'reviewable' are visible in authoring/review views only.
export const KNOWLEDGE_QUALITY_STATUSES = ['draft', 'reviewable', 'published', 'verified'] as const;
export type KnowledgeQualityStatus = (typeof KNOWLEDGE_QUALITY_STATUSES)[number];

export interface KnowledgeObject {
  id: string;
  domain: KnowledgeDomain;
  title: string;
  summary?: string;
  tags: string[];
  difficulty?: KnowledgeDifficulty;
  sourceUrl?: string;
  provenance: KnowledgeProvenance;
  qualityStatus: KnowledgeQualityStatus;
  createdAt: string;
  updatedAt: string;
}

export const REVIEWABLE_OBJECT_TYPES = [
  'question',
  'story',
  'system_design_case',
  'behavioral_prompt',
  'cs_card',
] as const;
export type ReviewableObjectType = (typeof REVIEWABLE_OBJECT_TYPES)[number];

export interface Reviewable {
  objectId: string;
  objectType: ReviewableObjectType;
  prompt: string;
  referenceAnswer?: string;
  rubricId?: string;
  reviewStateId?: string;
}

// ── Rubric (MOM-023) ────────────────────────────────────────────────────────
// Matches the Json shape already stored in Question.rubric (plan §5.3). Existing
// rows may not conform yet — treat this as the target shape for new/updated rubrics,
// not a runtime guarantee about historical data.

export interface RubricCriterionLevel {
  score: number;
  description: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  levels?: RubricCriterionLevel[];
}

export interface Rubric {
  id: string;
  objectId: string;
  criteria: RubricCriterion[];
  maxScore: number;
}

// MOM-025: maps QuestionType (Question.type) to the broader KnowledgeDomain
// taxonomy. Matches plan §8.2's CS Fundamentals scope (OS, networking, DB,
// concurrency, JS/TS, backend/API, OOP, C++, ML) to the 'cs_fundamentals' domain.
const QUESTION_TYPE_TO_KNOWLEDGE_DOMAIN: Record<QuestionType, KnowledgeDomain> = {
  dsa: 'dsa',
  system_design: 'system_design',
  behavioral: 'behavioral',
  backend: 'cs_fundamentals',
  javascript: 'cs_fundamentals',
  typescript: 'cs_fundamentals',
  nodejs: 'cs_fundamentals',
  database: 'cs_fundamentals',
  os: 'cs_fundamentals',
  networking: 'cs_fundamentals',
  oop: 'cs_fundamentals',
  cpp: 'cs_fundamentals',
  concurrency: 'cs_fundamentals',
  computer_architecture: 'cs_fundamentals',
  machine_learning: 'cs_fundamentals',
  hpc: 'cs_fundamentals',
  quant: 'cs_fundamentals',
};

/**
 * Presents an existing `Question` row as a `KnowledgeObject`. `Question` has no
 * `provenance`/`qualityStatus` columns yet (D-003: no schema change until those
 * are genuinely needed), so this infers reasonable defaults rather than reading
 * stored values — every question in this app today is user-authored and treated
 * as immediately usable in practice sessions.
 */
export function questionToKnowledgeObject(question: QuestionResponse): KnowledgeObject {
  return {
    id: question.id,
    domain: QUESTION_TYPE_TO_KNOWLEDGE_DOMAIN[question.type],
    title: question.title,
    summary: question.notes ?? undefined,
    tags: [...question.roleTags, ...question.areaTags, ...question.patternTags],
    difficulty: question.difficulty,
    sourceUrl: question.sourceUrl ?? undefined,
    provenance: 'user_created',
    qualityStatus: 'published',
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

export function isRubric(value: unknown): value is Rubric {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Rubric>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.objectId === 'string' &&
    typeof candidate.maxScore === 'number' &&
    Array.isArray(candidate.criteria) &&
    candidate.criteria.every(
      (c) =>
        typeof c?.id === 'string' &&
        typeof c?.title === 'string' &&
        typeof c?.description === 'string' &&
        typeof c?.weight === 'number',
    )
  );
}
