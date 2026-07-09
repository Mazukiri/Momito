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

// A4: pattern pedagogy — REDESIGN_PLAN.MD's DSA_PATTERNS spec asks for
// {id,name,description,whenToUse} per pattern so the ladder teaches *when* to
// reach for each pattern, not just a bare id. Kept separate from DSA_PATTERNS
// (rather than replacing it) since patternTags/dsa.service key on the plain
// string ids already stored on seeded questions.
export interface DsaPatternMeta {
  name: string;
  description: string;
  whenToUse: string;
}

export const DSA_PATTERN_META: Record<DsaPattern, DsaPatternMeta> = {
  two_pointers: {
    name: 'Two Pointers',
    description: 'Walk two indices through a sequence (from ends inward, or both forward at different speeds) to avoid nested loops.',
    whenToUse: 'Sorted array/string problems asking for pairs, palindromes, or in-place partitioning — anywhere a nested O(n²) scan can collapse to one linear pass.',
  },
  sliding_window: {
    name: 'Sliding Window',
    description: 'Maintain a contiguous window over an array/string, expanding and shrinking its bounds incrementally instead of recomputing from scratch.',
    whenToUse: 'Contiguous-subarray/substring problems with a size, sum, or character constraint (longest/shortest/count of subarrays satisfying a condition).',
  },
  fast_slow_pointers: {
    name: 'Fast & Slow Pointers',
    description: 'Two pointers advancing at different speeds through a linked structure or implicit sequence to detect cycles or find midpoints.',
    whenToUse: 'Linked-list cycle detection, finding the middle node, or detecting a cycle in a functional graph (e.g. array-as-next-pointer problems).',
  },
  merge_intervals: {
    name: 'Merge Intervals',
    description: 'Sort intervals by start time, then sweep once merging/comparing overlapping ranges.',
    whenToUse: 'Any problem about overlapping ranges: merging, inserting, finding free/busy time, or counting overlaps.',
  },
  cyclic_sort: {
    name: 'Cyclic Sort',
    description: 'Place each value at its "correct" index in one pass when values are a known bounded range (e.g. 1..n) — exploits the range as a free hash.',
    whenToUse: 'Finding missing/duplicate numbers in an array of 1..n without extra space, in-place.',
  },
  binary_search: {
    name: 'Binary Search',
    description: 'Halve the search space each step using a monotonic predicate, not just on plain sorted arrays — also "search on the answer".',
    whenToUse: 'Sorted-array lookup/insertion-point problems, or any problem where you can binary-search over a range of possible answers and check feasibility.',
  },
  tree_bfs: {
    name: 'Tree BFS',
    description: 'Level-order traversal using a queue, processing one full level at a time.',
    whenToUse: 'Level-by-level tree output, shortest path in an unweighted tree/graph, or "minimum steps" problems.',
  },
  tree_dfs: {
    name: 'Tree DFS',
    description: 'Recursive (or explicit-stack) pre/in/post-order traversal exploring one branch fully before backtracking.',
    whenToUse: 'Path-sum problems, tree validation/construction, or anything needing a full root-to-leaf path before deciding.',
  },
  graph_traversal: {
    name: 'Graph Traversal',
    description: 'General BFS/DFS over an explicit or implicit graph, tracking visited nodes to avoid revisiting.',
    whenToUse: 'Connectivity, shortest path in unweighted graphs, flood-fill, or exploring an implicit graph (grid, state space).',
  },
  topological_sort: {
    name: 'Topological Sort',
    description: 'Order nodes of a DAG so every edge points forward, via Kahn\'s algorithm (in-degree queue) or DFS post-order.',
    whenToUse: 'Task/course scheduling with prerequisites, build-dependency ordering, or detecting a cycle in a directed graph.',
  },
  union_find: {
    name: 'Union Find',
    description: 'Disjoint-set structure with union-by-rank and path compression to track connectivity incrementally.',
    whenToUse: 'Dynamic connectivity queries, detecting cycles while building a graph edge-by-edge, or grouping into connected components.',
  },
  backtracking: {
    name: 'Backtracking',
    description: 'Recursively build a partial solution, prune branches that can\'t work, and undo choices to try the next option.',
    whenToUse: 'Combinatorial search — permutations, combinations, subsets, constraint-satisfaction (N-Queens, Sudoku), or "generate all valid X".',
  },
  dynamic_programming: {
    name: 'Dynamic Programming',
    description: 'Break a problem into overlapping subproblems, cache results (memoization or a bottom-up table), and build the answer from smaller answers.',
    whenToUse: 'Optimization/counting problems with overlapping subproblems and optimal substructure — often signaled by "min/max/count ways to reach X".',
  },
  greedy: {
    name: 'Greedy',
    description: 'Make the locally-best choice at each step and prove (or trust) it leads to a globally optimal solution, with no backtracking.',
    whenToUse: 'Interval scheduling, when sorting by one criterion makes the optimal choice obvious at each step, and exchange-argument proofs apply.',
  },
  heap_priority_queue: {
    name: 'Heap / Priority Queue',
    description: 'Maintain a min/max-heap to always access the smallest/largest remaining element in O(log n).',
    whenToUse: '"Top/kth largest/smallest", merging k sorted lists, or scheduling problems needing repeated access to an extremum.',
  },
  monotonic_stack: {
    name: 'Monotonic Stack',
    description: 'Maintain a stack that\'s always increasing or decreasing, popping elements that violate the invariant as you scan.',
    whenToUse: '"Next greater/smaller element", histogram/rectangle-area problems, or anywhere you need each element\'s nearest larger/smaller neighbor in O(n).',
  },
  prefix_sum: {
    name: 'Prefix Sum',
    description: 'Precompute cumulative sums so any range-sum query becomes an O(1) subtraction instead of a re-scan.',
    whenToUse: 'Repeated range-sum queries, subarray-sum-equals-k counting, or 2D range-sum problems.',
  },
  bit_manipulation: {
    name: 'Bit Manipulation',
    description: 'Use bitwise operators (XOR, AND, shifts, masks) to solve problems in O(1) space or spot bit-level invariants.',
    whenToUse: 'Finding a unique/missing element via XOR, counting set bits, or any problem hinting at a bitmask state space.',
  },
  trie: {
    name: 'Trie',
    description: 'A prefix tree storing strings character-by-character so shared prefixes share storage and lookups.',
    whenToUse: 'Prefix search/autocomplete, word search in a dictionary, or any problem needing fast "does this prefix exist" queries.',
  },
  linked_list_reversal: {
    name: 'Linked List Reversal',
    description: 'Reverse (all or part of) a singly-linked list in place by walking pointers and flipping next-references as you go.',
    whenToUse: 'Reverse-a-list variants (full, k-group, between positions) and problems that reduce to reversing part of a list to simplify a comparison.',
  },
};

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

// MOM-121 (ADR-0010 / D-017): structured company intelligence. `focusAreas` maps
// a CareerRoleAreaId to a 1–5 interview-weight; `interviewProcess` is the ordered
// round sequence (roundType aligns with INTERVIEW_ROUND_TYPES).
export type CompanyFocusAreas = Partial<Record<CareerRoleAreaId, number>>;

export interface CompanyInterviewStage {
  roundType: string;
  label: string;
  notes?: string;
}

export interface CompanyResponse {
  id: string;
  name: string;
  region: string | null;
  notes: string | null;
  focusAreas: CompanyFocusAreas;
  roleTrackIds: CareerRoleTrackId[];
  interviewProcess: CompanyInterviewStage[];
  sponsorshipStatus: VisaTag | null;
  compBand: string | null;
  // MOM-123: populated by GET /companies/:id (detail), omitted from the list.
  linkedQuestionCount?: number;
  linkedStoryCount?: number;
  createdAt: string;
  updatedAt: string;
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
  // MOM-127: a mock-interview draw weighted toward your weak spots — interleaves
  // recently-struggled questions with fresh ones across areas, simulating a loop.
  'mixed_interview',
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
  missTags?: MissTagReason[];
  reflectionNote?: string | null;
  language?: string | null;
  complexity?: string | null;
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
  // Consecutive days (up to and including today, or yesterday if today has no
  // attempt yet — the streak isn't broken until a full day passes with none) with
  // >=1 AnswerAttempt, computed server-side in Asia/Ho_Chi_Minh.
  streak: number;
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

// MOM-061: plan §8.2 targets 8 role-track categories (backend, AI/NLP, infra,
// mobile, fullstack, quant/HPC, data, security). big-tech-swe/google-l4-swe cover
// backend and hpc-gpu-engineer/quant-swe cover quant/HPC; the remaining six IDs
// below fill the categories the plan lists that had no track at all.
export const CAREER_ROLE_TRACK_IDS = [
  'big-tech-swe',
  'google-l4-swe',
  'hpc-gpu-engineer',
  'quant-swe',
  'ai-ml-engineer',
  'infra-platform-engineer',
  'mobile-swe',
  'fullstack-swe',
  'data-engineer',
  'security-engineer',
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
  // MOM-061: profileRoleTemplate defaults to 'google-l4-swe' (the general SWE
  // template) for these six tracks — no dedicated RoleTemplate skill/tier data
  // exists yet for AI/mobile/fullstack/data/security/infra roles. Authoring those
  // is separate scope (would need its own requiredSkills/tierWeights review).
  'ai-ml-engineer': {
    id: 'ai-ml-engineer',
    label: 'AI/ML Engineer',
    description: 'Preparation for applied ML and NLP engineering roles: model development, evaluation, and production ML systems.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'ai-ml-fundamentals', area: 'domain_knowledge', title: 'ML/NLP fundamentals', description: 'Supervised/unsupervised learning, embeddings, transformers, evaluation metrics, and overfitting.', evidenceType: 'learning', weight: 4, keywords: ['embeddings', 'transformer', 'evaluation', 'overfitting'] },
      { id: 'ai-ml-dsa', area: 'dsa', title: 'DSA for ML infra', description: 'Arrays, graphs, and DP fluency, applied to data pipelines and feature engineering code.', evidenceType: 'practice', weight: 3, keywords: ['arrays', 'graphs', 'dp', 'pipelines'] },
      { id: 'ai-ml-system-design', area: 'system_design', title: 'ML system design', description: 'Training/serving pipelines, feature stores, model versioning, and latency/accuracy tradeoffs.', evidenceType: 'practice', weight: 3, keywords: ['serving', 'feature store', 'versioning', 'latency'] },
      { id: 'ai-ml-project', area: 'projects', title: 'End-to-end ML project', description: 'A project with data ingestion, training, evaluation, and a served inference path.', evidenceType: 'project', weight: 4, keywords: ['training', 'inference', 'evaluation', 'deployment'] },
      { id: 'ai-ml-python', area: 'language_runtime', title: 'Python ML stack fluency', description: 'NumPy/PyTorch or TensorFlow, vectorized computation, and profiling.', evidenceType: 'learning', weight: 2, keywords: ['numpy', 'pytorch', 'tensorflow', 'vectorization'] },
    ],
  },
  'infra-platform-engineer': {
    id: 'infra-platform-engineer',
    label: 'Infra/Platform Engineer',
    description: 'Preparation for infrastructure, platform, and developer-tooling engineering roles.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'infra-dsa', area: 'dsa', title: 'Core DSA patterns', description: 'Graphs, trees, and scheduling-adjacent algorithms.', evidenceType: 'practice', weight: 2, keywords: ['graphs', 'trees', 'scheduling'] },
      { id: 'infra-system-design', area: 'system_design', title: 'Infra system design', description: 'CI/CD, orchestration (Kubernetes), observability, and multi-tenant reliability tradeoffs.', evidenceType: 'practice', weight: 4, keywords: ['kubernetes', 'ci/cd', 'observability', 'reliability'] },
      { id: 'infra-os-networking', area: 'cs_fundamentals', title: 'OS and networking depth', description: 'Containers, cgroups, networking primitives, and Linux internals.', evidenceType: 'learning', weight: 3, keywords: ['containers', 'cgroups', 'networking', 'linux'] },
      { id: 'infra-project', area: 'projects', title: 'Platform tooling project', description: 'A project automating deployment, scaling, or observability for a real workload.', evidenceType: 'project', weight: 4, keywords: ['automation', 'deployment', 'scaling', 'observability'] },
      { id: 'infra-behavioral', area: 'behavioral', title: 'Incident/ownership stories', description: 'STAR stories for on-call incidents, postmortems, and cross-team reliability work.', evidenceType: 'practice', weight: 1, keywords: ['incident', 'postmortem', 'on-call'] },
    ],
  },
  'mobile-swe': {
    id: 'mobile-swe',
    label: 'Mobile SWE',
    description: 'Preparation for iOS/Android/cross-platform mobile engineering roles.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'mobile-dsa', area: 'dsa', title: 'Core DSA patterns', description: 'Arrays, trees, and recursion fluency for standard mobile-team interview loops.', evidenceType: 'practice', weight: 3, keywords: ['arrays', 'trees', 'recursion'] },
      { id: 'mobile-platform', area: 'language_runtime', title: 'Platform runtime depth', description: 'Lifecycle management, threading/concurrency on-device, and memory/battery constraints.', evidenceType: 'learning', weight: 3, keywords: ['lifecycle', 'concurrency', 'memory', 'battery'] },
      { id: 'mobile-design', area: 'system_design', title: 'Mobile app architecture', description: 'Offline-first sync, state management, and API/backend integration tradeoffs.', evidenceType: 'practice', weight: 3, keywords: ['offline-first', 'sync', 'state management'] },
      { id: 'mobile-project', area: 'projects', title: 'Shipped mobile app', description: 'A published or demoable app with real users or a polished demo covering a full feature.', evidenceType: 'project', weight: 4, keywords: ['app store', 'shipped', 'demo'] },
      { id: 'mobile-behavioral', area: 'behavioral', title: 'Product collaboration stories', description: 'STAR stories on working with design/product and handling platform review feedback.', evidenceType: 'practice', weight: 1, keywords: ['design collaboration', 'app review', 'product'] },
    ],
  },
  'fullstack-swe': {
    id: 'fullstack-swe',
    label: 'Fullstack SWE',
    description: 'Preparation for fullstack roles spanning frontend, backend, and API integration.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'fullstack-dsa', area: 'dsa', title: 'Core DSA patterns', description: 'Arrays, strings, trees, and DP fluency for general SWE loops.', evidenceType: 'practice', weight: 3, keywords: ['arrays', 'strings', 'trees', 'dp'] },
      { id: 'fullstack-frontend', area: 'language_runtime', title: 'Frontend runtime depth', description: 'Rendering, state management, and browser performance fundamentals.', evidenceType: 'learning', weight: 3, keywords: ['rendering', 'state management', 'performance'] },
      { id: 'fullstack-design', area: 'system_design', title: 'Fullstack system design', description: 'API design, auth, caching, and end-to-end data-flow tradeoffs across the stack.', evidenceType: 'practice', weight: 3, keywords: ['api design', 'auth', 'caching'] },
      { id: 'fullstack-project', area: 'projects', title: 'Shipped fullstack project', description: 'A project with a real frontend, backend, database, and deployment.', evidenceType: 'project', weight: 4, keywords: ['frontend', 'backend', 'database', 'deployment'] },
      { id: 'fullstack-behavioral', area: 'behavioral', title: 'Cross-functional collaboration stories', description: 'STAR stories on working across frontend/backend/design boundaries.', evidenceType: 'practice', weight: 1, keywords: ['cross-functional', 'collaboration'] },
    ],
  },
  'data-engineer': {
    id: 'data-engineer',
    label: 'Data Engineer',
    description: 'Preparation for data engineering roles: pipelines, warehousing, and large-scale data processing.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'data-dsa', area: 'dsa', title: 'Core DSA patterns', description: 'Arrays, hashing, and sorting/merging fluency, applied to batch and streaming data problems.', evidenceType: 'practice', weight: 2, keywords: ['arrays', 'hashing', 'sorting', 'streaming'] },
      { id: 'data-sql', area: 'cs_fundamentals', title: 'SQL and data modeling depth', description: 'Window functions, partitioning, indexing, and dimensional modeling.', evidenceType: 'learning', weight: 4, keywords: ['sql', 'window functions', 'partitioning', 'indexing'] },
      { id: 'data-design', area: 'system_design', title: 'Data pipeline design', description: 'Batch vs. streaming tradeoffs, orchestration, schema evolution, and data quality checks.', evidenceType: 'practice', weight: 4, keywords: ['batch', 'streaming', 'orchestration', 'schema evolution'] },
      { id: 'data-project', area: 'projects', title: 'End-to-end data pipeline project', description: 'A project ingesting, transforming, and serving data with measurable freshness/quality guarantees.', evidenceType: 'project', weight: 4, keywords: ['ingestion', 'transformation', 'data quality'] },
      { id: 'data-python', area: 'language_runtime', title: 'Python/SQL production fluency', description: 'Pandas/Spark-style data manipulation plus production SQL.', evidenceType: 'learning', weight: 2, keywords: ['pandas', 'spark', 'sql'] },
    ],
  },
  'security-engineer': {
    id: 'security-engineer',
    label: 'Security Engineer',
    description: 'Preparation for application/infrastructure security engineering roles.',
    defaultHorizon: '6_months',
    profileRoleTemplate: 'google-l4-swe',
    checklist: [
      { id: 'security-dsa', area: 'dsa', title: 'Core DSA patterns', description: 'Arrays, graphs, and hashing fluency for general SWE loops most security teams still run.', evidenceType: 'practice', weight: 2, keywords: ['arrays', 'graphs', 'hashing'] },
      { id: 'security-fundamentals', area: 'cs_fundamentals', title: 'Security fundamentals', description: 'AuthN/authZ, common vulnerability classes (OWASP Top 10), cryptography basics, and threat modeling.', evidenceType: 'learning', weight: 4, keywords: ['authn', 'authz', 'owasp', 'threat modeling'] },
      { id: 'security-design', area: 'system_design', title: 'Secure system design', description: 'Defense in depth, least privilege, secrets management, and incident-response-aware architecture.', evidenceType: 'practice', weight: 4, keywords: ['defense in depth', 'least privilege', 'secrets management'] },
      { id: 'security-project', area: 'projects', title: 'Security-focused project', description: 'A project demonstrating a security review, a fixed vulnerability class, or a hardening effort with before/after evidence.', evidenceType: 'project', weight: 4, keywords: ['security review', 'vulnerability', 'hardening'] },
      { id: 'security-behavioral', area: 'behavioral', title: 'Incident response stories', description: 'STAR stories on responding to a security incident or driving a hardening initiative.', evidenceType: 'practice', weight: 1, keywords: ['incident response', 'hardening'] },
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
  // MOM-129: FSRS-grounded signals. `masteryScore` (0–100) blends average
  // retrievability with graded-attempt volume for the area; `retrievability`
  // (0–1) is the raw average, null when the area has no review history.
  masteryScore: number | null;
  retrievability: number | null;
}

export interface RoleReadinessResponse {
  roleTrackId: CareerRoleTrackId;
  roleTrack: CareerRoleTrack;
  overallPercentage: number;
  areas: RoleAreaReadiness[];
  topGaps: RoleChecklistItem[];
  nextActions: string[];
}

// MOM-130: the "am I ready for <company>?" go/no-go for one JobApplication —
// the role-track's grounded readiness docked by that target's open weakness
// signals (the MOM-113 debrief output).
export const JOB_READINESS_STATUSES = ['ready', 'almost', 'not_ready'] as const;
export type JobReadinessStatus = (typeof JOB_READINESS_STATUSES)[number];

export interface JobReadinessWeakArea {
  area: CareerRoleAreaId;
  percentage: number;
}

export interface JobReadinessResponse {
  jobApplicationId: string;
  company: string;
  roleTitle: string;
  roleTrackId: CareerRoleTrackId;
  roleTrack: CareerRoleTrack;
  /** 0–100 verdict = grounded role readiness minus the weakness-signal penalty. */
  score: number;
  status: JobReadinessStatus;
  /** Points docked for this job's open weakness signals. */
  penalty: number;
  areas: RoleAreaReadiness[];
  weakestAreas: JobReadinessWeakArea[];
  blockingSignals: WeaknessSignalResponse[];
  nextActions: string[];
}

// MOM-131: the behavioral gap map for a specific target. Which STAR competencies
// this role's behavioral loop expects, and which the user's story bank actually
// covers — so "you have ownership + conflict but no ambiguity story for Meta"
// becomes a concrete, closeable gap instead of a vague worry.
export interface StoryGapCompetency {
  /** A STORY_COMPETENCIES id (e.g. 'ambiguity'). */
  id: string;
  name: string;
  covered: boolean;
  /** How many of the user's stories are tagged with this competency. */
  storyCount: number;
}

export interface JobStoryGapResponse {
  jobApplicationId: string;
  company: string;
  roleTitle: string;
  roleTrackId: CareerRoleTrackId;
  competencies: StoryGapCompetency[];
  coveredCount: number;
  missingCount: number;
  /** Total stories in the user's bank (context for an empty gap map). */
  totalStories: number;
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

// MOM-134-lite (CareerOS Track Q): deterministic ATS keyword coverage of the
// user's profile skills against a pasted JD. Full résumé-version ATS lands with
// ResumeVersion (MOM-133/134); this v1 checks the base profile.
export interface AtsCoverageResponse {
  jdKeywordCount: number;
  covered: string[];
  missing: string[];
  coveragePct: number; // 0-1
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

// MOM-122: the catalog company a job is linked to (a slim projection of
// CompanyResponse), so the pipeline can show sponsorship/focus without a second fetch.
export interface JobCompanyRef {
  id: string;
  name: string;
  region: string | null;
  sponsorshipStatus: VisaTag | null;
  focusAreas: CompanyFocusAreas;
}

export interface JobApplicationResponse {
  id: string;
  userId: string;
  company: string;
  companyId: string | null;
  companyRef: JobCompanyRef | null;
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
  companyId?: string | null;
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

// MOM-109/110 (CareerOS Track N, ADR-0013): a first-class interview round.
// Replaces the JobEvent-as-interview hack — carries the schedule and the
// outcome+debrief that MOM-113 turns into WeaknessSignals (the loop-closing edge).
export const INTERVIEW_ROUND_TYPES = [
  'recruiter_screen',
  'phone_screen',
  'online_assessment',
  'technical',
  'coding',
  'system_design',
  'behavioral',
  'hiring_manager',
  'onsite',
  'final',
  'other',
] as const;
export type InterviewRoundType = (typeof INTERVIEW_ROUND_TYPES)[number];

export const INTERVIEW_ROUND_TYPE_LABELS: Record<InterviewRoundType, string> = {
  recruiter_screen: 'Recruiter screen',
  phone_screen: 'Phone screen',
  online_assessment: 'Online assessment',
  technical: 'Technical',
  coding: 'Coding',
  system_design: 'System design',
  behavioral: 'Behavioral',
  hiring_manager: 'Hiring manager',
  onsite: 'Onsite',
  final: 'Final',
  other: 'Other',
};

export const INTERVIEW_ROUND_OUTCOMES = ['pending', 'passed', 'failed', 'mixed', 'withdrawn', 'unknown'] as const;
export type InterviewRoundOutcome = (typeof INTERVIEW_ROUND_OUTCOMES)[number];

export interface InterviewRoundResponse {
  id: string;
  userId: string;
  jobApplicationId: string;
  roundType: InterviewRoundType;
  sequence: number;
  scheduledAt: string | null;
  durationMinutes: number | null;
  interviewer: string | null;
  outcome: InterviewRoundOutcome;
  debrief: string | null;
  areasWeak: string[];
  missTags: MissTagReason[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateInterviewRoundRequest {
  roundType: InterviewRoundType;
  sequence?: number;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  interviewer?: string | null;
}

export interface UpdateInterviewRoundRequest {
  roundType?: InterviewRoundType;
  sequence?: number;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
  interviewer?: string | null;
  outcome?: InterviewRoundOutcome;
  debrief?: string | null;
  areasWeak?: CareerRoleAreaId[];
  missTags?: MissTagReason[];
}

// MOM-101 (CareerOS Track M): the job-hunt funnel. The progression stages a
// live application moves through, in order; `rejected`/`withdrawn` are terminal
// outcomes reported separately, not funnel positions.
export const JOB_FUNNEL_STAGES = ['saved', 'applied', 'oa', 'interview', 'onsite', 'offer'] as const;
export type JobFunnelStage = (typeof JOB_FUNNEL_STAGES)[number];

export interface JobFunnelStageRow {
  stage: JobFunnelStage;
  atStage: number; // active apps whose current status is exactly this stage
  reached: number; // active apps currently at this stage or deeper (cumulative)
  conversionFromPrev: number | null; // reached[i] / reached[i-1]; null for the first stage
}

export interface JobFunnelBreakdownRow {
  key: string; // a source or visaTag value
  total: number;
  offers: number;
  interviewing: number; // reached interview or deeper
  conversion: number; // offers / total
}

// Honest v1: computed from CURRENT status only — an app that was rejected after
// an onsite is counted as an outcome, not as having reached onsite, because no
// transition history exists yet. True stage timing/history lands with MOM-104.
export interface JobFunnelResponse {
  total: number;
  active: number; // not rejected/withdrawn
  offers: number;
  rejected: number;
  withdrawn: number;
  responseRate: number; // of active apps that reached `applied`, the share that reached `oa` or deeper
  stages: JobFunnelStageRow[];
  bySource: JobFunnelBreakdownRow[];
  byVisaTag: JobFunnelBreakdownRow[];
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
  // MOM-146: a synced Readwise highlight the learner chose to remember. Enters
  // the same FSRS queue as questions/stories so a saved insight actually
  // resurfaces and sticks, instead of dead-ending in a write-only ledger.
  'highlight',
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

// ── Miss tags (MOM-028) ──────────────────────────────────────────────────────
// Plan §5.4's WeaknessSignal.reason taxonomy, reused here as AnswerAttempt.missTags
// (DECISIONS.MD D-003's MOM-028 outcome) — a user self-tags *why* an attempt missed,
// distinct from `correctness`'s coarse correct/partial/incorrect outcome.
export const MISS_TAG_REASONS = [
  'misread',
  'wrong_pattern',
  'edge_case',
  'time_pressure',
  'blank',
  'implementation_bug',
  'concept_gap',
  'communication_gap',
  'tradeoff_gap',
] as const;
export type MissTagReason = (typeof MISS_TAG_REASONS)[number];

// Human labels for MissTagReason, shared so the API can compose recommendation
// reasons ("You logged 'Missed an edge case' on 3 recent attempts") with the
// exact same wording the reflection UI showed when the tag was captured.
export const MISS_TAG_LABELS: Record<MissTagReason, string> = {
  misread: 'Misread the question',
  wrong_pattern: 'Used the wrong approach',
  edge_case: 'Missed an edge case',
  time_pressure: 'Ran out of time',
  blank: "Didn't know where to start",
  implementation_bug: 'Implementation bug',
  concept_gap: "Didn't know the concept",
  communication_gap: 'Struggled to explain it',
  tradeoff_gap: 'Missed a tradeoff',
};

// ── Self-rating scale (learning loop §7.2) ──────────────────────────────────
// The API stores selfRating 1-5 and fsrs-scheduler maps it 1→Again, 2→Hard,
// 3/4→Good, 5→Easy. Rating UIs should present these four labeled grades —
// shown *after* the reference answer is revealed — instead of an unlabeled
// star row, so the grade the user picks means the same thing FSRS thinks it
// means. Value 4 is intentionally absent from the scale (it schedules
// identically to 3); historical 4s remain valid data.
export const SELF_RATING_SCALE = [
  { value: 1, label: 'Again', description: 'Got it wrong — show me again soon' },
  { value: 2, label: 'Hard', description: 'Got there, but it was a struggle' },
  { value: 3, label: 'Good', description: 'Solid recall with minor gaps' },
  { value: 5, label: 'Easy', description: 'Knew it cold' },
] as const;
export type SelfRatingValue = (typeof SELF_RATING_SCALE)[number]['value'];

// ── Weakness signals (plan §5.4 / §6.1 priority 3) ──────────────────────────
// Derived on the fly from AnswerAttempt.missTags + low selfRating within a
// recent window — "Progress is derived from real attempts" (§2.1.8), so there
// is no separate weakness table to drift out of sync.

export interface WeaknessReasonSummary {
  reason: MissTagReason;
  label: string;
  count: number;
  lastAt: string;
  /** Up to 3 recent question titles that carried this tag. */
  sampleTitles: string[];
  /** Question ids behind this signal, most recent first (capped). */
  questionIds: string[];
}

export interface WeaknessAreaSummary {
  /** patternTag (e.g. 'sliding-window') or topic name, depending on the list. */
  key: string;
  label: string;
  /** Attempts in the window that struggled (low rating or any miss tag). */
  struggles: number;
  /** Total attempts in the window touching this area. */
  attempts: number;
  lastAt: string;
  questionIds: string[];
}

// MOM-127 (ADR-0011 / D-013): persisted weakness signals. The derived engine
// above still handles practice struggles on the fly; these rows store only the
// signals that can't be re-derived — interview debriefs and manual entries —
// with severity accrual, read-time decay, and a repair/dismiss lifecycle.
export const WEAKNESS_SIGNAL_TYPES = ['reason', 'pattern', 'topic', 'area', 'round'] as const;
export type WeaknessSignalType = (typeof WEAKNESS_SIGNAL_TYPES)[number];

export const WEAKNESS_SIGNAL_SOURCES = ['attempt', 'debrief', 'manual'] as const;
export type WeaknessSignalSource = (typeof WEAKNESS_SIGNAL_SOURCES)[number];

export const WEAKNESS_SIGNAL_STATUSES = ['open', 'repairing', 'resolved', 'dismissed'] as const;
export type WeaknessSignalStatus = (typeof WEAKNESS_SIGNAL_STATUSES)[number];

export interface WeaknessSignalResponse {
  id: string;
  signalType: WeaknessSignalType;
  key: string;
  label: string;
  roleTrackId: string | null;
  area: string | null;
  jobApplicationId: string | null;
  /** Effective (decayed) severity at read time, not the stored raw value. */
  severity: number;
  occurrences: number;
  source: WeaknessSignalSource;
  status: WeaknessSignalStatus;
  lastSignalAt: string;
}

export interface WeaknessSummaryResponse {
  windowDays: number;
  totalAttempts: number;
  totalStruggles: number;
  reasons: WeaknessReasonSummary[];
  patterns: WeaknessAreaSummary[];
  topics: WeaknessAreaSummary[];
  /** MOM-127: open, above-the-decay-floor persisted signals, most-severe first. */
  openSignals: WeaknessSignalResponse[];
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

// ── Content Coverage (MOM-062) ──────────────────────────────────────────────
// Plan §8.2 full-product data targets, by question type where the plan maps
// cleanly onto one. DSA/CS Fundamentals/System Design/Behavioral are the plan's
// named domains; the remaining CS Fundamentals sub-types don't have individual
// targets in the plan, so only the four domain-level targets are tracked here.
export const CONTENT_COVERAGE_TARGETS: Partial<Record<QuestionType, number>> = {
  dsa: 150,
  system_design: 25,
  behavioral: 60,
};

export const CS_FUNDAMENTALS_TARGET = 150;
export const CS_FUNDAMENTALS_TYPES: QuestionType[] = [
  'backend',
  'javascript',
  'typescript',
  'nodejs',
  'database',
  'os',
  'networking',
  'oop',
  'cpp',
  'concurrency',
  'computer_architecture',
  'machine_learning',
  'hpc',
  'quant',
];

export interface ContentCoverageDomain {
  label: string;
  count: number;
  target: number;
  percentage: number;
}

export interface ContentCoverageResponse {
  totalQuestions: number;
  byType: Record<string, number>;
  byDifficulty: Record<string, number>;
  domains: ContentCoverageDomain[];
  companyCount: number;
  roleTrackCount: number;
}

// ── DSA Ladder Progress (MOM-050/051) ────────────────────────────────────────
export interface DsaPatternProgress {
  pattern: DsaPattern;
  totalItems: number;
  attemptedItems: number;
  solvedItems: number;
}

export interface DsaProgressResponse {
  patterns: DsaPatternProgress[];
  totalDsaItems: number;
  totalAttempted: number;
  totalSolved: number;
}

// ── FSRS Review Scheduling (MOM-027/029/030) ─────────────────────────────────
// Mirrors apps/api/prisma/schema.prisma's ReviewState model (ADR-0002 / D-005).
// Reuses ReviewableObjectType (defined above, from the MOM-022/023 Knowledge
// Kernel work) rather than redeclaring it — only 'question' is actually wired
// up to persistence so far; the other kernel-defined types become reviewable
// as their own migrations/services land.
export interface ReviewStateResponse {
  id: string;
  objectType: ReviewableObjectType;
  objectId: string;
  stability: number;
  difficulty: number;
  due: string;
  state: number;
  reps: number;
  lapses: number;
  suspended: boolean;
  lastReviewedAt: string | null;
  // MOM-032: populated for display purposes (e.g. the Today queue) when the
  // referenced object can be resolved — objectId has no DB-level foreign key
  // (ADR-0002), so this is looked up separately, not joined.
  title: string | null;
}

// ── Story competencies (A5) ──────────────────────────────────────────────────
// REDESIGN_PLAN.MD's STORY_COMPETENCIES: a fixed taxonomy of behavioral
// competencies a STAR story can demonstrate, with Amazon Leadership Principle
// mappings since Amazon is a named target company (seed data already has an
// Amazon focus-area note). Story.competencyTags stays a free-form string[] at
// the DB/DTO layer (ADR-0003) — this is the frontend's structured picker over
// that field, not a schema constraint, so a user can still add a custom tag
// beyond this list.
export interface StoryCompetency {
  id: string;
  name: string;
  description: string;
  amazonLps?: string[];
}

export const STORY_COMPETENCIES: StoryCompetency[] = [
  { id: 'ownership', name: 'Ownership', description: 'Took responsibility for an outcome beyond your immediate role, including its long-term consequences.', amazonLps: ['Ownership', 'Deliver Results'] },
  { id: 'conflict', name: 'Conflict resolution', description: 'Navigated disagreement with a peer, manager, or stakeholder to reach a workable outcome.', amazonLps: ['Have Backbone; Disagree and Commit', 'Earn Trust'] },
  { id: 'failure', name: 'Failure & recovery', description: 'Something went wrong (a bug, a missed deadline, a bad call) — what happened and what you changed afterward.', amazonLps: ['Learn and Be Curious', 'Insist on the Highest Standards'] },
  { id: 'leadership', name: 'Leadership', description: 'Influenced or directed the work of others without necessarily having formal authority over them.', amazonLps: ['Hire and Develop the Best', 'Think Big'] },
  { id: 'ambiguity', name: 'Ambiguity', description: 'Made progress on a problem with incomplete information, unclear requirements, or no established playbook.', amazonLps: ['Invent and Simplify', 'Bias for Action'] },
  { id: 'delivery', name: 'Delivery under pressure', description: 'Shipped something real under a real constraint — a deadline, limited resources, or competing priorities.', amazonLps: ['Deliver Results', 'Bias for Action'] },
  { id: 'growth', name: 'Growth & learning', description: 'Picked up a new skill, technology, or domain specifically to get the job done.', amazonLps: ['Learn and Be Curious'] },
  { id: 'teamwork', name: 'Teamwork & collaboration', description: 'Worked effectively with others across a team or organizational boundary toward a shared goal.', amazonLps: ['Earn Trust', 'Hire and Develop the Best'] },
];

// ── Story Bank (MOM-063/064) ─────────────────────────────────────────────────
// STAR-shaped, user-authored (ADR-0003). Reviewable via ReviewState with
// objectType: 'story' (ReviewableObjectType, defined above) once MOM-067 wires
// rehearsal sessions to it — no separate review type needed here.
// MOM-066: a behavioral prompt (Question) a story can answer. questionTitle is
// denormalized for display — StoryPrompt only stores questionId at the DB level.
export interface StoryPromptLink {
  questionId: string;
  questionTitle: string;
}

export interface StoryResponse {
  id: string;
  userId: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string | null;
  competencyTags: string[];
  followUpQuestions: string[];
  companies: CompanySummary[];
  prompts: StoryPromptLink[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoryRequest {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics?: string | null;
  competencyTags?: string[];
  followUpQuestions?: string[];
  companyIds?: string[];
}

export type UpdateStoryRequest = Partial<CreateStoryRequest>;
