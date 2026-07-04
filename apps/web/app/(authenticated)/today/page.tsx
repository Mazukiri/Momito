import Link from 'next/link';
import { Card } from '../../components/ui';

// MOM-012: static stub only. The real queue (overdue reviews, weakness repair,
// curriculum next step, career deadlines — plan §6.1) lands with MOM-032, which is
// blocked on the ReviewState migration (human-approval gated, see DECISIONS.md D-004).
export default function TodayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Today</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your daily queue is coming soon. In the meantime, jump into what you need.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <h2 className="font-semibold text-zinc-800">Reviews</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Spaced-repetition reviews will appear here once scheduling is implemented.
          </p>
          <Link href="/attempts" className="mt-3 inline-block text-sm font-medium text-indigo-600">
            See past attempts →
          </Link>
        </Card>
        <Card>
          <h2 className="font-semibold text-zinc-800">Practice</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Start a fresh practice session across DSA, system design, or behavioral prompts.
          </p>
          <Link href="/practice/new" className="mt-3 inline-block text-sm font-medium text-indigo-600">
            Start practicing →
          </Link>
        </Card>
        <Card>
          <h2 className="font-semibold text-zinc-800">Career</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Track applications, upcoming interviews, and reminders.
          </p>
          <Link href="/jobs" className="mt-3 inline-block text-sm font-medium text-indigo-600">
            View jobs →
          </Link>
        </Card>
      </div>

      <Card>
        <p className="text-sm text-zinc-500">
          Looking for the full progress dashboard?{' '}
          <Link href="/dashboard" className="font-medium text-indigo-600">
            Go to Dashboard →
          </Link>
        </p>
      </Card>
    </div>
  );
}
