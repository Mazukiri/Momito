'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { questionsApi } from '../../../lib/api-client';
import QuestionForm, { type QuestionFormData } from '../../../components/QuestionForm';
import { ErrorBanner } from '../../../components/ui';

export default function NewQuestionPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(data: QuestionFormData) {
    setSubmitting(true);
    setError('');
    try {
      const created = await questionsApi.create(data);
      router.push(`/questions/${created.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create question');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push('/questions')}
          className="mb-2 text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to questions
        </button>
        <h1 className="text-2xl font-bold text-zinc-800">New Question</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Add a new interview question to your collection
        </p>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <QuestionForm onSubmit={handleSubmit} submitting={submitting} submitLabel="Create Question" />
      </div>
    </div>
  );
}
