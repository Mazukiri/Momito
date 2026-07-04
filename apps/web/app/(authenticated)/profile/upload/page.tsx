'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { profileApi } from '../../../lib/api-client';
import { Card, ErrorBanner, Spinner } from '../../../components/ui';

export default function ProfileUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Choose a PDF CV file first.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      await profileApi.uploadCv(file);
      router.push('/profile');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload CV');
      setUploading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => router.push('/profile')}
        className="mb-4 text-sm text-indigo-600 hover:text-indigo-500"
      >
        Back to profile
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-800">Upload CV</h1>
        <p className="mt-1 text-sm text-zinc-500">Import a PDF and review the extracted profile fields.</p>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} /></div>}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="cvFile" className="block text-sm font-medium text-zinc-700">
              CV PDF
            </label>
            <input
              id="cvFile"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
            />
          </div>

          {file && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              <span className="font-medium">{file.name}</span>
              <span className="ml-2 text-zinc-400">{Math.round(file.size / 1024)} KB</span>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !file}
            className="flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading && <Spinner className="mr-2 h-4 w-4" />}
            Upload and Parse
          </button>
        </form>
      </Card>
    </div>
  );
}
