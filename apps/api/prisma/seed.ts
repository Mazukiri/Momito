import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

export const topics = [
  ['00000000-0000-4000-8001-000000000001', 'Backend Engineering', 'APIs, distributed services, reliability, and server-side design'],
  ['00000000-0000-4000-8001-000000000002', 'JavaScript & TypeScript', 'JavaScript runtime behavior and practical TypeScript'],
  ['00000000-0000-4000-8001-000000000003', 'Databases', 'Relational data modeling, transactions, indexing, and query performance'],
  ['00000000-0000-4000-8001-000000000004', 'Operating Systems', 'Processes, threads, memory, scheduling, and concurrency'],
  ['00000000-0000-4000-8001-000000000005', 'Computer Networks', 'Transport protocols, HTTP, DNS, and network troubleshooting'],
  ['00000000-0000-4000-8001-000000000006', 'Object-Oriented Programming', 'Encapsulation, polymorphism, composition, and maintainable design'],
  ['00000000-0000-4000-8001-000000000007', 'System Design', 'Scalable architectures, data flow, capacity, and tradeoffs'],
  ['00000000-0000-4000-8001-000000000008', 'Behavioral Interviews', 'Communication, ownership, collaboration, and learning'],
  ['00000000-0000-4000-8001-000000000009', 'Data Structures & Algorithms', 'Coding-interview patterns: arrays, strings, trees, graphs, and dynamic programming'],
] as const;

// MOM-060: 20 company packs (plan §8.2). Company has no dedicated roleTags/focus
// column, so focus areas and linked role tracks are encoded in `notes` (D-003:
// reuse existing fields rather than add a column for this). Existing rows (index
// 0-5) keep their original position — question seed entries above reference
// companies by array index, not id, so appends only go at the end.
const companies = [
  ['00000000-0000-4000-8002-000000000001', 'Google', 'Global', 'Focus areas: system design, DSA depth, distributed systems. Linked tracks: big-tech-swe, google-l4-swe.'],
  ['00000000-0000-4000-8002-000000000002', 'Amazon', 'Global', 'Focus areas: leadership principles (behavioral), system design, operational excellence. Linked tracks: big-tech-swe.'],
  ['00000000-0000-4000-8002-000000000003', 'Microsoft', 'Global', 'Focus areas: system design, C#/.NET or general backend, collaboration. Linked tracks: big-tech-swe, fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000004', 'Meta', 'Global', 'Focus areas: DSA speed, system design, product sense. Linked tracks: big-tech-swe, fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000005', 'Grab', 'Southeast Asia', 'Focus areas: backend systems, marketplace/logistics design. Linked tracks: big-tech-swe, fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000006', 'Shopee', 'Southeast Asia', 'Focus areas: backend systems, high-throughput e-commerce design. Linked tracks: big-tech-swe, fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000007', 'Apple', 'Global', 'Focus areas: platform/runtime depth, mobile architecture, performance. Linked tracks: mobile-swe.'],
  ['00000000-0000-4000-8002-000000000008', 'Netflix', 'Global', 'Focus areas: distributed systems, streaming infra, chaos/reliability engineering. Linked tracks: infra-platform-engineer.'],
  ['00000000-0000-4000-8002-000000000009', 'Uber', 'Global', 'Focus areas: marketplace systems, geo/real-time infra, backend design. Linked tracks: big-tech-swe, infra-platform-engineer.'],
  ['00000000-0000-4000-8002-000000000010', 'Airbnb', 'Global', 'Focus areas: fullstack product engineering, API design, trust & safety systems. Linked tracks: fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000011', 'Stripe', 'Global', 'Focus areas: API design, payments correctness/idempotency, backend reliability. Linked tracks: big-tech-swe, fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000012', 'ByteDance', 'Global', 'Focus areas: recommendation/ML systems, mobile app performance. Linked tracks: ai-ml-engineer, mobile-swe.'],
  ['00000000-0000-4000-8002-000000000013', 'NVIDIA', 'Global', 'Focus areas: CUDA/GPU performance, parallel computing, systems programming. Linked tracks: hpc-gpu-engineer.'],
  ['00000000-0000-4000-8002-000000000014', 'Databricks', 'Global', 'Focus areas: distributed data processing (Spark), data pipeline design. Linked tracks: data-engineer.'],
  ['00000000-0000-4000-8002-000000000015', 'Palantir', 'Global', 'Focus areas: data modeling, backend systems, ontology/graph design. Linked tracks: data-engineer, big-tech-swe.'],
  ['00000000-0000-4000-8002-000000000016', 'Bloomberg', 'Global', 'Focus areas: low-latency systems, C++/Java backend, financial data. Linked tracks: quant-swe, fullstack-swe.'],
  ['00000000-0000-4000-8002-000000000017', 'Two Sigma', 'Global', 'Focus areas: probability/statistics, quant research tooling, low-latency systems. Linked tracks: quant-swe.'],
  ['00000000-0000-4000-8002-000000000018', 'Jane Street', 'Global', 'Focus areas: functional programming, probability, fast/correct reasoning under pressure. Linked tracks: quant-swe.'],
  ['00000000-0000-4000-8002-000000000019', 'CrowdStrike', 'Global', 'Focus areas: security fundamentals, threat detection systems, systems programming. Linked tracks: security-engineer.'],
  ['00000000-0000-4000-8002-000000000020', 'OpenAI', 'Global', 'Focus areas: ML/NLP research and infra, training/serving systems. Linked tracks: ai-ml-engineer, infra-platform-engineer.'],
] as const;

export type SeedQuestion = {
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
  // MOM-045: DSA items link out to the source problem rather than embedding its
  // statement (D-008 / ADR-0004). sourceUrl is optional because non-DSA items
  // (backend/CS-fundamentals questions) are original prompts with no external source.
  sourceUrl?: string;
};

export const questions: SeedQuestion[] = [
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

  // MOM-045: DSA starter batch. Per D-008/ADR-0004, `prompt` and `answer` are
  // original notes written for this app, not the source problem's statement or
  // official editorial — read the actual problem at `sourceUrl` first, then use
  // these as pattern guidance while practicing. This is a starter batch, not the
  // full Gate-3 target of 150 items (see BACKLOG.md Track G for the remaining batches).
  { title: 'Two Sum', prompt: 'Solve "Two Sum" (read the full problem at the source link, LeetCode #1). Implement your solution, then explain why your approach hits the target time complexity.', type: 'dsa', difficulty: 'easy', topic: 8, sourceUrl: 'https://leetcode.com/problems/two-sum/', answer: 'Hash-map complement lookup: for each value, check whether target-minus-value has already been seen before inserting the current value. One pass, O(n) time, O(n) space. Watch for duplicate values reusing the same index and confirm the problem wants indices, not values.', patternTags: ['two_pointers'] },
  { title: 'Valid Parentheses', prompt: 'Solve "Valid Parentheses" (LeetCode #20). Implement your solution, then explain your invariant for why the stack approach is correct.', type: 'dsa', difficulty: 'easy', topic: 8, sourceUrl: 'https://leetcode.com/problems/valid-parentheses/', answer: 'Push opening brackets onto a stack; on a closing bracket, pop and check it matches the expected opener. Invalid if the stack is empty when popping, or non-empty at the end. O(n) time, O(n) space. This is the canonical entry point for monotonic-stack-style matching problems.', patternTags: ['monotonic_stack'] },
  { title: 'Merge Two Sorted Lists', prompt: 'Solve "Merge Two Sorted Lists" (LeetCode #21). Implement iteratively, then discuss the recursive alternative and its stack-depth tradeoff.', type: 'dsa', difficulty: 'easy', topic: 8, sourceUrl: 'https://leetcode.com/problems/merge-two-sorted-lists/', answer: 'Use a dummy head and a tail pointer; repeatedly attach the smaller current node from either list and advance that list. Append the remaining tail of whichever list is non-empty. O(n+m) time, O(1) extra space iteratively; the recursive version is O(n+m) call-stack space.', patternTags: ['two_pointers'] },
  { title: 'Best Time to Buy and Sell Stock', prompt: 'Solve "Best Time to Buy and Sell Stock" (LeetCode #121). Implement your one-pass solution and explain what invariant you track.', type: 'dsa', difficulty: 'easy', topic: 8, sourceUrl: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', answer: 'Track the minimum price seen so far and the best profit so far in one left-to-right pass; at each price, profit = price - minSoFar. O(n) time, O(1) space. This is the simplest member of the "track a running extreme while scanning" family that generalizes to Kadane-style problems.', patternTags: ['sliding_window'] },
  { title: 'Reverse Linked List', prompt: 'Solve "Reverse Linked List" (LeetCode #206). Implement both an iterative and a recursive version.', type: 'dsa', difficulty: 'easy', topic: 8, sourceUrl: 'https://leetcode.com/problems/reverse-linked-list/', answer: 'Iteratively, walk the list keeping prev/curr/next pointers and relink curr.next = prev each step. Recursively, reverse the rest of the list first, then fix up the current node\'s neighbor pointers on the way back up. O(n) time; O(1) space iteratively, O(n) call stack recursively. Foundational for many linked-list-reversal variants (reverse in groups of k, reverse between positions).', patternTags: ['linked_list_reversal'] },
  { title: 'Linked List Cycle', prompt: 'Solve "Linked List Cycle" (LeetCode #141). Implement Floyd\'s cycle detection and explain why the pointers must meet if a cycle exists.', type: 'dsa', difficulty: 'easy', topic: 8, sourceUrl: 'https://leetcode.com/problems/linked-list-cycle/', answer: 'Advance a slow pointer one step and a fast pointer two steps; if they ever meet, there is a cycle. If a cycle exists, once the slow pointer enters it, the fast pointer closes the gap between them by one node per step, so they must eventually coincide. O(n) time, O(1) space.', patternTags: ['fast_slow_pointers'] },
  { title: 'Longest Substring Without Repeating Characters', prompt: 'Solve "Longest Substring Without Repeating Characters" (LeetCode #3). Implement the sliding-window solution and explain how you shrink the window.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', answer: 'Maintain a window [left, right] and a map of last-seen index per character. On seeing a repeat inside the window, jump left to one past its previous occurrence (never move left backward). Track the max window length seen. O(n) time, O(min(n, charset)) space.', patternTags: ['sliding_window'] },
  { title: '3Sum', prompt: 'Solve "3Sum" (LeetCode #15). Implement the sort-plus-two-pointers approach and explain how you avoid duplicate triplets.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/3sum/', answer: 'Sort the array; fix each index i as the first element, then use two pointers moving inward over the remaining sorted suffix to find pairs summing to -nums[i]. Skip over duplicate values for i, and after finding a match, skip duplicates for both inner pointers before continuing. O(n^2) time, O(1) extra space beyond sorting.', patternTags: ['two_pointers'] },
  { title: 'Merge Intervals', prompt: 'Solve "Merge Intervals" (LeetCode #56). Implement your solution and explain why sorting first is necessary.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/merge-intervals/', answer: 'Sort intervals by start time, then scan once, merging the current interval into the last kept interval whenever its start is <= the last interval\'s end (extend the end if needed), otherwise appending it as a new interval. Sorting guarantees any overlap with earlier intervals is detected against the most recently merged one. O(n log n) time, O(n) space.', patternTags: ['merge_intervals'] },
  { title: 'Binary Tree Level Order Traversal', prompt: 'Solve "Binary Tree Level Order Traversal" (LeetCode #102). Implement a BFS solution that groups nodes by level.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/binary-tree-level-order-traversal/', answer: 'BFS with a queue, but capture the queue\'s size at the start of each iteration to know exactly how many nodes belong to the current level before enqueuing their children. O(n) time, O(n) space (widest level plus output).', patternTags: ['tree_bfs'] },
  { title: 'Course Schedule', prompt: 'Solve "Course Schedule" (LeetCode #207). Implement cycle detection over the prerequisite graph and explain which graph technique you used.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/course-schedule/', answer: 'Build a directed graph from prerequisites and run Kahn\'s algorithm: repeatedly remove zero-indegree nodes, decrementing neighbors\' indegree. If all nodes are eventually removed, there is no cycle and the schedule is possible; otherwise a cycle exists among the remaining nodes. O(V+E) time and space. Equivalent to topological sort existing iff the graph is a DAG.', patternTags: ['topological_sort', 'graph_traversal'] },
  { title: 'Number of Islands', prompt: 'Solve "Number of Islands" (LeetCode #200). Implement a grid-traversal solution and explain your visited-tracking strategy.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/number-of-islands/', answer: 'Scan every cell; on an unvisited land cell, increment the island count and flood-fill (DFS or BFS) in the four cardinal directions, marking visited cells (in-place mutation or a visited set) so they are not recounted. O(rows*cols) time and space.', patternTags: ['graph_traversal'] },
  { title: 'Coin Change', prompt: 'Solve "Coin Change" (LeetCode #322). Implement the bottom-up DP and explain your state definition.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/coin-change/', answer: 'Let dp[amount] be the fewest coins to make that amount, dp[0]=0, dp[x]=infinity if unreachable. For each amount from 1 upward, try every coin <= amount and take min(dp[amount], dp[amount-coin]+1). Answer is dp[target] or -1 if it stayed infinite. O(amount * numCoins) time, O(amount) space.', patternTags: ['dynamic_programming'] },
  { title: 'Kth Largest Element in an Array', prompt: 'Solve "Kth Largest Element in an Array" (LeetCode #215). Implement a heap-based solution and discuss the quickselect alternative\'s complexity.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/kth-largest-element-in-an-array/', answer: 'Maintain a min-heap of size k over the stream of numbers; once the heap exceeds size k, pop the smallest. The heap\'s root is the kth largest at the end. O(n log k) time, O(k) space. Quickselect (partition-based) achieves expected O(n) time but O(n) worst case and mutates the array.', patternTags: ['heap_priority_queue'] },
  { title: 'Word Break', prompt: 'Solve "Word Break" (LeetCode #139). Implement the DP solution and explain your state transition.', type: 'dsa', difficulty: 'medium', topic: 8, sourceUrl: 'https://leetcode.com/problems/word-break/', answer: 'Let dp[i] mean the prefix of length i can be segmented using dictionary words. dp[0]=true; for each i, dp[i] is true if there exists j<i with dp[j] true and s[j:i] in the dictionary (as a set for O(1) lookup). Answer is dp[n]. O(n^2) time (or better with word-length bounds), O(n) space.', patternTags: ['dynamic_programming'] },
  { title: 'Trapping Rain Water', prompt: 'Solve "Trapping Rain Water" (LeetCode #42). Implement the two-pointer solution and explain why tracking left/right maxima works without a second array.', type: 'dsa', difficulty: 'hard', topic: 8, sourceUrl: 'https://leetcode.com/problems/trapping-rain-water/', answer: 'Water trapped above a bar is bounded by the shorter of the tallest bar to its left and to its right. Move two pointers inward from both ends, always advancing the side with the smaller running max, because that side\'s trapped water is fully determined regardless of what the far side\'s max eventually becomes. O(n) time, O(1) space, avoiding the O(n) prefix/suffix-max arrays of the simpler DP approach.', patternTags: ['two_pointers'] },
  { title: 'Median of Two Sorted Arrays', prompt: 'Solve "Median of Two Sorted Arrays" (LeetCode #4). Implement the O(log(min(m,n))) binary-search partition solution.', type: 'dsa', difficulty: 'hard', topic: 8, sourceUrl: 'https://leetcode.com/problems/median-of-two-sorted-arrays/', answer: 'Binary search a partition index on the smaller array; the partition on the larger array is determined by the combined-left-half size. Adjust the smaller array\'s partition until maxLeft <= minRight on both sides, then the median is derivable from the four boundary elements (average of two middles for even total length, or the max-left for odd). O(log(min(m,n))) time, O(1) space. Get the even/odd and empty-partition edge cases right before optimizing.', patternTags: ['binary_search'] },
];

export function inferQuestionMetadata(question: SeedQuestion) {
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
  for (const [id, name, region, notes] of companies) {
    await prisma.company.upsert({ where: { id }, update: { name, region, notes }, create: { id, name, region, notes } });
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
      sourceUrl: question.sourceUrl ?? null,
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

// MOM-024: guarded so `content-lib.ts` can import `questions`/`topics` for
// validation without triggering a live DB seed as a side effect of the import.
if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
