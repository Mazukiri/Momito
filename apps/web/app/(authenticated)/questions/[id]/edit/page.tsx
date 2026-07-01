'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { questionsApi } from '../../../../lib/api-client';
import QuestionForm, { type QuestionFormData } from '../../../../components/QuestionForm';
import { Spinner, ErrorBanner } from '../../../../components/ui';
import type { QuestionResponse } from '@momito/shared';

export default function EditQuestionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [question, setQuestion] = useState<QuestionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const q = await questionsApi.get(id);
      setQuestion(q);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load question');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching on mount
  useEffect(() => { fetchQuestion(); }, [fetchQuestion]);

  async function handleSubmit(data: QuestionFormData) {
    setSubmitting(true);
    setError('');
    try {
      const updated = await questionsApi.update(id, data);
      router.push(`/questions/${updated.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update question');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error && !question) {
    return (
      <div>
        <button
          onClick={() => router.push('/questions')}
          className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to questions
        </button>
        <ErrorBanner message={error} onRetry={fetchQuestion} />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="flex justify-center py-20 text-zinc-500">
        Question not found
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push(`/questions/${id}`)}
          className="mb-2 text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Back to question
        </button>
        <h1 className="text-2xl font-bold text-zinc-800">Edit Question</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Update your interview question
        </p>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <QuestionForm
          initialData={{
            title: question.title,
            prompt: question.prompt,
            type: question.type,
            difficulty: question.difficulty,
            topicId: question.topicId,
            subtopic: question.subtopic ?? '',
            referenceAnswer: question.referenceAnswer ?? '',
            notes: question.notes ?? '',
            sourceUrl: question.sourceUrl ?? '',
            companyIds: question.companies.map((c) => c.id),
          }}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Update Question"
        />
      </div>
    </div>
  );
}
