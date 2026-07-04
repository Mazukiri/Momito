import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

const topics = [
  ['00000000-0000-4000-8001-000000000001', 'Backend Engineering', 'APIs, distributed services, reliability, and server-side design'],
  ['00000000-0000-4000-8001-000000000002', 'JavaScript & TypeScript', 'JavaScript runtime behavior and practical TypeScript'],
  ['00000000-0000-4000-8001-000000000003', 'Databases', 'Relational data modeling, transactions, indexing, and query performance'],
  ['00000000-0000-4000-8001-000000000004', 'Operating Systems', 'Processes, threads, memory, scheduling, and concurrency'],
  ['00000000-0000-4000-8001-000000000005', 'Computer Networks', 'Transport protocols, HTTP, DNS, and network troubleshooting'],
  ['00000000-0000-4000-8001-000000000006', 'Object-Oriented Programming', 'Encapsulation, polymorphism, composition, and maintainable design'],
  ['00000000-0000-4000-8001-000000000007', 'System Design', 'Scalable architectures, data flow, capacity, and tradeoffs'],
  ['00000000-0000-4000-8001-000000000008', 'Behavioral Interviews', 'Communication, ownership, collaboration, and learning'],
] as const;

const companies = [
  ['00000000-0000-4000-8002-000000000001', 'Google', 'Global'],
  ['00000000-0000-4000-8002-000000000002', 'Amazon', 'Global'],
  ['00000000-0000-4000-8002-000000000003', 'Microsoft', 'Global'],
  ['00000000-0000-4000-8002-000000000004', 'Meta', 'Global'],
  ['00000000-0000-4000-8002-000000000005', 'Grab', 'Southeast Asia'],
  ['00000000-0000-4000-8002-000000000006', 'Shopee', 'Southeast Asia'],
] as const;

type SeedQuestion = {
  title: string;
  prompt: string;
  type: string;
  difficulty: string;
  topic: number;
  answer: string;
  companies?: number[];
  roleTags?: string[];
  areaTags?: string[];
  patternTags?: string[];
};

const questions: SeedQuestion[] = [
  { title: 'Design an idempotent payment endpoint', prompt: 'How would you design a POST payment endpoint so client retries cannot charge a customer twice?', type: 'backend', difficulty: 'hard', topic: 0, answer: 'Require a client-generated idempotency key, persist it with the request fingerprint and outcome in the same transaction as the payment state, return the stored result for matching retries, and reject reuse with a different payload. Define key expiry and handle concurrent inserts with a unique constraint.', companies: [1, 4] },
  { title: 'REST pagination tradeoffs', prompt: 'Compare offset pagination and cursor pagination. When would you choose each?', type: 'backend', difficulty: 'medium', topic: 0, answer: 'Offset pagination is simple and supports page jumps but becomes slow at large offsets and can duplicate or skip records during writes. Cursor pagination uses a stable ordered key, scales better, and remains consistent under inserts, but does not naturally support arbitrary page jumps.' },
  { title: 'API rate limiter design', prompt: 'Explain how to implement a distributed rate limiter for a public API.', type: 'backend', difficulty: 'hard', topic: 0, answer: 'Choose a policy such as token bucket, identify the key and limit window, and perform atomic state changes in a shared store such as Redis using Lua. Return standard limit headers, account for clock and store failures, and define whether failures are open or closed.', companies: [0, 3] },
  { title: 'Reliable background jobs', prompt: 'What guarantees and failure modes should a background job system handle?', type: 'nodejs', difficulty: 'medium', topic: 0, answer: 'Assume at-least-once delivery, make handlers idempotent, acknowledge only after success, retry transient failures with bounded exponential backoff and jitter, send poison jobs to a dead-letter queue, and expose queue age, retry, and failure metrics.' },

  { title: 'JavaScript event loop ordering', prompt: 'Given timers, resolved promises, and synchronous code, explain the execution order in Node.js.', type: 'javascript', difficulty: 'medium', topic: 1, answer: 'Synchronous code runs first. After the current stack finishes, promise reactions run from the microtask queue before the event loop advances to timer callbacks. Node also has phase-specific queues and process.nextTick runs before ordinary promise microtasks.' },
  { title: 'Closures and retained state', prompt: 'What is a closure, and how can closures accidentally cause memory retention?', type: 'javascript', difficulty: 'easy', topic: 1, answer: 'A closure is a function together with references to its lexical environment. As long as the function remains reachable, captured objects remain reachable too; long-lived listeners, timers, or caches can therefore retain large object graphs.' },
  { title: 'TypeScript unknown versus any', prompt: 'Why is unknown safer than any at an external data boundary?', type: 'typescript', difficulty: 'easy', topic: 1, answer: 'Any disables type checking and permits arbitrary operations. Unknown requires narrowing or validation before use, so untrusted JSON cannot silently flow into code that assumes a specific shape.' },
  { title: 'Model a state machine with TypeScript', prompt: 'How would you use discriminated unions to prevent invalid UI or workflow states?', type: 'typescript', difficulty: 'medium', topic: 1, answer: 'Represent each valid state as an object with a shared literal discriminator and only the fields valid in that state. Exhaustively switch on the discriminator and use never checking so new states require explicit handling.' },

  { title: 'How a composite index is used', prompt: 'For an index on (user_id, created_at), which queries benefit and why?', type: 'database', difficulty: 'medium', topic: 2, answer: 'The index efficiently supports predicates beginning with user_id and can provide created_at ordering within a user. It generally cannot efficiently satisfy a predicate on created_at alone because of the leftmost-prefix rule.' },
  { title: 'Transaction isolation anomalies', prompt: 'Describe dirty reads, non-repeatable reads, and phantom reads, then relate them to isolation levels.', type: 'database', difficulty: 'hard', topic: 2, answer: 'A dirty read observes uncommitted data, a non-repeatable read sees a row change between reads, and a phantom is a changed result set for a repeated predicate. Stronger isolation levels prevent progressively more anomalies; serializable aims to match some serial execution but may require retries.' },
  { title: 'Diagnose a slow SQL query', prompt: 'Walk through a disciplined process for diagnosing and improving a slow query.', type: 'database', difficulty: 'medium', topic: 2, answer: 'Capture the exact query and parameters, inspect EXPLAIN ANALYZE, compare estimated and actual rows, identify scans, joins, sorts, and lock waits, then improve indexing, statistics, query shape, or schema. Re-measure with representative data and workload.' },
  { title: 'Optimistic versus pessimistic locking', prompt: 'Compare optimistic and pessimistic concurrency control with practical use cases.', type: 'database', difficulty: 'medium', topic: 2, answer: 'Optimistic locking detects conflicts at write time using a version and works well when contention is low. Pessimistic locking acquires database locks before mutation and suits short, high-contention critical sections, but increases blocking and deadlock risk.' },

  { title: 'Process versus thread', prompt: 'Compare processes and threads in terms of isolation, communication, and failure behavior.', type: 'os', difficulty: 'easy', topic: 3, answer: 'Processes have separate virtual address spaces and stronger isolation; communication requires IPC. Threads share process memory and resources, making communication cheap but synchronization necessary and memory corruption capable of affecting the whole process.' },
  { title: 'Virtual memory and page faults', prompt: 'Explain virtual memory and what happens during a page fault.', type: 'os', difficulty: 'medium', topic: 3, answer: 'Virtual memory maps per-process virtual addresses to physical frames through page tables. On a missing mapping, the CPU traps into the kernel; the kernel validates access, loads or allocates the page if valid, updates the page table, and resumes, or terminates the process for invalid access.' },
  { title: 'Deadlock conditions and prevention', prompt: 'What four conditions are required for deadlock, and how can a system prevent it?', type: 'os', difficulty: 'medium', topic: 3, answer: 'Mutual exclusion, hold-and-wait, no preemption, and circular wait must all hold. Break one condition through ordered lock acquisition, acquiring resources together, timeouts or preemption where possible, or avoiding exclusive resources.' },
  { title: 'Mutex versus semaphore', prompt: 'When should you use a mutex, a counting semaphore, or a condition variable?', type: 'os', difficulty: 'medium', topic: 3, answer: 'A mutex protects exclusive access and has ownership. A counting semaphore represents a number of available permits or signals events. A condition variable lets threads sleep until a predicate over protected state may have changed and must be paired with a mutex and predicate loop.' },

  { title: 'TCP connection establishment', prompt: 'Explain the TCP three-way handshake and why two messages are insufficient.', type: 'networking', difficulty: 'easy', topic: 4, answer: 'The client sends SYN with its initial sequence number, the server replies SYN-ACK with its own number and acknowledgment, and the client ACKs it. The final acknowledgment confirms bidirectional reachability and that both initial sequence numbers were received.' },
  { title: 'What happens after entering a URL', prompt: 'Trace the major steps from entering an HTTPS URL to receiving the response.', type: 'networking', difficulty: 'medium', topic: 4, answer: 'The browser resolves DNS, establishes a transport connection, performs TLS negotiation and certificate validation, sends an HTTP request, and receives and parses the response. Caches, proxies, CDN routing, connection reuse, and HTTP/2 or HTTP/3 may alter individual steps.' },
  { title: 'HTTP caching semantics', prompt: 'Explain Cache-Control, ETag, and conditional requests.', type: 'networking', difficulty: 'medium', topic: 4, answer: 'Cache-Control defines freshness and storage policy. ETag identifies a representation version. Once stale, a cache can send If-None-Match; the origin returns 304 if unchanged, avoiding transfer of the full body.' },
  { title: 'TCP versus UDP', prompt: 'Compare TCP and UDP and give applications that fit each.', type: 'networking', difficulty: 'easy', topic: 4, answer: 'TCP provides an ordered reliable byte stream with congestion control and connection state. UDP provides independent best-effort datagrams with lower protocol overhead. Web APIs commonly use TCP or QUIC-based HTTP; real-time media and DNS often value UDP behavior.' },

  { title: 'Composition over inheritance', prompt: 'Why is composition often preferred over deep inheritance hierarchies?', type: 'oop', difficulty: 'easy', topic: 5, answer: 'Composition assembles behavior through explicit collaborators, reducing coupling to a base-class implementation and allowing behavior to vary independently. Inheritance remains useful for genuine substitutability but deep hierarchies make changes and testing harder.' },
  { title: 'Apply the dependency inversion principle', prompt: 'Show how dependency inversion improves the testability of an order service.', type: 'oop', difficulty: 'medium', topic: 5, answer: 'Make the order service depend on small interfaces for payment, persistence, and notifications, then inject implementations. Tests can provide deterministic fakes without network or database access, while production wiring supplies concrete adapters.' },
  { title: 'Liskov substitution in practice', prompt: 'Give an example of an inheritance design that violates Liskov substitution and explain the fix.', type: 'oop', difficulty: 'medium', topic: 5, answer: 'A writable Rectangle API with Square as a subtype violates expectations when width and height setters cannot vary independently. Model immutable shapes with area behavior or separate interfaces instead of claiming an invalid behavioral subtype relationship.' },
  { title: 'Encapsulation beyond private fields', prompt: 'What does good encapsulation mean beyond marking fields private?', type: 'oop', difficulty: 'easy', topic: 5, answer: 'Good encapsulation protects invariants and exposes intention-revealing operations rather than raw state mutation. It keeps related data and behavior together, limits temporal coupling, and prevents callers from constructing invalid states.' },

  { title: 'Design a URL shortener', prompt: 'Design a production URL-shortening service, including APIs, storage, key generation, redirects, and scaling.', type: 'system_design', difficulty: 'medium', topic: 6, answer: 'Define create and redirect APIs, estimate read-heavy capacity, generate collision-resistant short keys, store key-to-URL mappings in a partitionable database, cache hot redirects, and use CDN or edge routing. Address expiration, abuse, analytics, and availability tradeoffs.', companies: [0, 2] },
  { title: 'Design a notification platform', prompt: 'Design a service that sends email, SMS, and push notifications reliably.', type: 'system_design', difficulty: 'hard', topic: 6, answer: 'Accept validated requests, persist intent, fan out through durable queues by channel, use provider adapters and idempotent workers, track per-recipient state, retry transient errors, dead-letter permanent failures, enforce preferences and rate limits, and monitor delivery latency.' },
  { title: 'Scale a read-heavy feed', prompt: 'Compare fan-out-on-write and fan-out-on-read for a social feed.', type: 'system_design', difficulty: 'hard', topic: 6, answer: 'Fan-out-on-write precomputes followers feeds for fast reads but makes celebrity writes expensive. Fan-out-on-read assembles feeds at request time, reducing write amplification but increasing read latency. A hybrid commonly precomputes ordinary users and merges celebrity posts at read time.', companies: [3] },
  { title: 'Choose consistency for inventory', prompt: 'How would you prevent overselling inventory across concurrent orders?', type: 'system_design', difficulty: 'hard', topic: 6, answer: 'Keep authoritative inventory updates in a strongly consistent boundary using conditional writes, row locks, or a serialized partition. Represent reservations with expiration, make checkout idempotent, release timed-out reservations, and reconcile downstream events without treating caches as authoritative.' },

  { title: 'Tell me about a difficult bug', prompt: 'Describe a difficult production or project bug you diagnosed and fixed.', type: 'behavioral', difficulty: 'medium', topic: 7, answer: 'Use STAR: establish impact and constraints, explain your diagnostic ownership and evidence, describe the focused fix and verification, quantify the result, and state what monitoring or process change prevented recurrence.' },
  { title: 'Disagreement with a teammate', prompt: 'Tell me about a technical disagreement and how you resolved it.', type: 'behavioral', difficulty: 'medium', topic: 7, answer: 'Explain the legitimate competing goals, how you clarified assumptions and gathered evidence, how the team chose a decision rule or experiment, and the outcome. Show respect, willingness to change your view, and commitment after the decision.' },
  { title: 'A project that failed', prompt: 'Describe a project or decision that did not work and what you learned.', type: 'behavioral', difficulty: 'hard', topic: 7, answer: 'Own your contribution without blaming others, identify the mistaken assumption or missed signal, describe the corrective action, and demonstrate a specific later behavior changed by the lesson.' },
  { title: 'Prioritize under a deadline', prompt: 'How have you handled several important tasks with an immovable deadline?', type: 'behavioral', difficulty: 'medium', topic: 7, answer: 'Describe how you identified the critical outcome, surfaced dependencies and risks, negotiated scope using impact and effort, communicated tradeoffs early, and preserved a minimum quality bar. End with the measurable outcome and retrospective improvement.' },

  { title: 'CUDA memory coalescing', prompt: 'Explain memory coalescing in CUDA and how poor access patterns affect kernel throughput.', type: 'hpc', difficulty: 'hard', topic: 3, answer: 'Coalescing lets adjacent threads access adjacent global memory so the hardware can combine requests into fewer memory transactions. Strided or divergent access patterns increase transactions, reduce bandwidth utilization, and can dominate kernel time. Improve layout, tiling, shared memory usage, and thread/block mapping.', roleTags: ['hpc-gpu-engineer'], areaTags: ['domain_knowledge'], patternTags: ['cuda', 'memory hierarchy', 'performance'] },
  { title: 'MPI versus shared-memory parallelism', prompt: 'Compare MPI and OpenMP. When would you choose each in a high-performance application?', type: 'hpc', difficulty: 'medium', topic: 3, answer: 'MPI is explicit distributed-memory message passing and fits multi-node workloads. OpenMP is shared-memory threading and fits one-node parallel loops or task parallelism. Real HPC codes often combine MPI across nodes and OpenMP or CUDA inside a node.', roleTags: ['hpc-gpu-engineer'], areaTags: ['domain_knowledge'], patternTags: ['mpi', 'openmp', 'parallel computing'] },
  { title: 'C++ RAII and exception safety', prompt: 'How does RAII improve resource safety in C++? Explain basic, strong, and no-throw exception guarantees.', type: 'cpp', difficulty: 'medium', topic: 5, answer: 'RAII ties resource lifetime to object lifetime so destructors release memory, locks, files, and handles on all exits. Basic guarantee preserves invariants, strong guarantee commits atomically or rolls back, and no-throw guarantee promises an operation will not throw.', roleTags: ['hpc-gpu-engineer', 'quant-swe'], areaTags: ['language_runtime'], patternTags: ['c++', 'raii', 'exception safety'] },
  { title: 'Expected value with stopping', prompt: 'A game pays based on repeated coin flips until a stopping condition. How would you derive the expected payout?', type: 'quant', difficulty: 'hard', topic: 2, answer: 'Define states, write recurrence equations for expected value from each state, apply boundary conditions at stopping states, then solve the system. Check convergence and whether optional stopping assumptions apply.', roleTags: ['quant-swe'], areaTags: ['domain_knowledge'], patternTags: ['probability', 'expected value', 'recurrence'] },
  { title: 'Design a backtesting engine', prompt: 'Design a backtesting engine for trading strategies, including data ingestion, execution simulation, risk metrics, and reproducibility.', type: 'quant', difficulty: 'hard', topic: 6, answer: 'Separate data ingestion, strategy interface, execution simulator, portfolio accounting, and metric generation. Handle corporate actions, latency/slippage assumptions, transaction costs, deterministic replay, and experiment metadata.', roleTags: ['quant-swe'], areaTags: ['projects'], patternTags: ['backtesting', 'trading', 'system design'] },
  { title: 'Low-latency order book updates', prompt: 'How would you represent and update a limit order book for low-latency market data processing?', type: 'quant', difficulty: 'hard', topic: 0, answer: 'Use cache-friendly structures keyed by price levels, maintain best bid/ask pointers, apply incremental updates in sequence, detect gaps, and avoid allocation on the hot path. Measure latency percentiles and correctness under replay.', roleTags: ['quant-swe'], areaTags: ['system_design'], patternTags: ['latency', 'market data', 'data structures'] },
];

function inferQuestionMetadata(question: SeedQuestion) {
  const roleTags = question.roleTags ?? inferRoleTags(question.type);
  const areaTags = question.areaTags ?? inferAreaTags(question.type);
  const patternTags = question.patternTags ?? inferPatternTags(question);
  const estimatedMinutes = question.difficulty === 'easy' ? 10 : question.difficulty === 'medium' ? 25 : 45;
  const importance = question.difficulty === 'hard' ? 3 : question.difficulty === 'medium' ? 2 : 1;
  return {
    roleTags,
    areaTags,
    patternTags,
    estimatedMinutes,
    importance,
    rubric: {
      strong: ['Correct core concept', 'Explains tradeoffs', 'Mentions failure modes or edge cases'],
      weak: ['Vague definitions only', 'No concrete example', 'Ignores constraints'],
    },
  };
}

function inferRoleTags(type: string): string[] {
  if (type === 'hpc' || type === 'cpp' || type === 'concurrency' || type === 'computer_architecture') return ['hpc-gpu-engineer'];
  if (type === 'quant') return ['quant-swe'];
  if (type === 'dsa') return ['big-tech-swe', 'google-l4-swe', 'quant-swe', 'hpc-gpu-engineer'];
  if (type === 'system_design' || type === 'backend') return ['big-tech-swe', 'google-l4-swe', 'quant-swe'];
  return ['big-tech-swe', 'google-l4-swe'];
}

function inferAreaTags(type: string): string[] {
  if (type === 'dsa') return ['dsa'];
  if (type === 'system_design' || type === 'backend') return ['system_design'];
  if (type === 'oop') return ['lld_oop'];
  if (['database', 'os', 'networking', 'concurrency', 'computer_architecture'].includes(type)) return ['cs_fundamentals'];
  if (['javascript', 'typescript', 'nodejs', 'cpp'].includes(type)) return ['language_runtime'];
  if (type === 'hpc' || type === 'quant' || type === 'machine_learning') return ['domain_knowledge'];
  if (type === 'behavioral') return ['behavioral'];
  return ['cs_fundamentals'];
}

function inferPatternTags(question: SeedQuestion): string[] {
  const text = `${question.title} ${question.prompt}`.toLowerCase();
  const tags = ['cache', 'queue', 'transaction', 'index', 'thread', 'memory', 'tcp', 'http', 'design', 'latency', 'probability', 'cuda', 'mpi', 'oop', 'dp', 'graph']
    .filter((tag) => text.includes(tag));
  return tags.length ? tags : [question.type];
}

async function main() {
  const passwordHash = await bcrypt.hash('MomitoDemo123!', 12);
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { email: 'demo@momito.local', name: 'Momito Demo' },
    create: { id: DEMO_USER_ID, email: 'demo@momito.local', name: 'Momito Demo', passwordHash },
  });

  for (const [id, name, description] of topics) {
    await prisma.topic.upsert({ where: { id }, update: { name, description }, create: { id, name, description } });
  }
  for (const [id, name, region] of companies) {
    await prisma.company.upsert({ where: { id }, update: { name, region }, create: { id, name, region } });
  }

  for (const [index, question] of questions.entries()) {
    const id = `00000000-0000-4000-8003-${String(index + 1).padStart(12, '0')}`;
    const data = {
      title: question.title,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      topicId: topics[question.topic][0],
      referenceAnswer: question.answer,
      createdByUserId: DEMO_USER_ID,
      ...inferQuestionMetadata(question),
    };
    await prisma.question.upsert({ where: { id }, update: data, create: { id, ...data } });
    await prisma.questionCompany.deleteMany({ where: { questionId: id } });
    if (question.companies?.length) {
      await prisma.questionCompany.createMany({
        data: question.companies.map((company) => ({ questionId: id, companyId: companies[company][0] })),
      });
    }
  }

  console.log(`Seeded ${topics.length} topics, ${companies.length} companies, and ${questions.length} questions.`);
  console.log('Demo login: demo@momito.local / MomitoDemo123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
