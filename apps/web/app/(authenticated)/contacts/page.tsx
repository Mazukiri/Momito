'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CONTACT_RELATIONSHIPS, type ContactRelationship, type ContactResponse, type JobApplicationResponse } from '@momito/shared';
import { contactsApi, jobsApi } from '../../lib/api-client';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../components/ui';

// Display order: the known relationships, then a catch-all for null/unset.
const GROUP_ORDER: (ContactRelationship | 'unspecified')[] = [...CONTACT_RELATIONSHIPS, 'unspecified'];
const GROUP_LABEL: Record<string, string> = {
  recruiter: 'Recruiters',
  referrer: 'Referrers',
  hiring_manager: 'Hiring managers',
  peer: 'Peers',
  other: 'Other',
  unspecified: 'Unspecified',
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [jobs, setJobs] = useState<JobApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [contactList, jobList] = await Promise.all([contactsApi.list(), jobsApi.list()]);
      setContacts(contactList);
      setJobs(jobList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, ContactResponse[]>();
    for (const contact of contacts) {
      const key = contact.relationship ?? 'unspecified';
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(contact);
    }
    return GROUP_ORDER.map((key) => ({ key, label: GROUP_LABEL[key], items: byGroup.get(key) ?? [] })).filter((group) => group.items.length > 0);
  }, [contacts]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Contacts</h1>
        <p className="mt-1 text-sm text-zinc-500">Your referral network — recruiters, referrers, and hiring managers across the pipeline.</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {contacts.length === 0 ? (
        <EmptyState icon="👥" title="No contacts yet" description="Add contacts from a job's detail page to build your referral network." />
      ) : (
        groups.map((group) => (
          <div key={group.key}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{group.label} ({group.items.length})</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((contact) => {
                const job = contact.jobApplicationId ? jobById.get(contact.jobApplicationId) : undefined;
                return (
                  <Card key={contact.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">{contact.name}</h3>
                      {contact.company && <span className="text-xs text-zinc-400">{contact.company}</span>}
                    </div>
                    {contact.email && <p className="mt-0.5 truncate text-xs text-zinc-500">{contact.email}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {contact.linkedinUrl && <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 dark:text-indigo-400">LinkedIn</a>}
                      {job && (
                        <Link href={`/jobs/${job.id}`} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
                          {job.company}
                        </Link>
                      )}
                    </div>
                    {contact.notes && <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{contact.notes}</p>}
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
