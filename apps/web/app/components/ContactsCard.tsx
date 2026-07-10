'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CONTACT_RELATIONSHIPS, type ContactRelationship, type ContactResponse } from '@momito/shared';
import { contactsApi } from '../lib/api-client';
import { Card, Spinner } from './ui';

const relationshipLabel = (value: ContactRelationship | null) => (value ? value.replace(/_/g, ' ') : '—');

// MOM-116/117: the contacts attached to a job — recruiter, referrer, etc.
// Replaces the free-text referralName with a real, reusable contact record.
export function ContactsCard({ jobId }: { jobId: string }) {
  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<ContactRelationship>('referrer');
  const [email, setEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setContacts(await contactsApi.listForJob(jobId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data load
    load();
  }, [load]);

  async function addContact(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await contactsApi.createForJob(jobId, {
        name: name.trim(),
        relationship,
        email: email.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
      });
      setName('');
      setEmail('');
      setLinkedinUrl('');
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  }

  async function removeContact(id: string) {
    setError('');
    const previous = contacts;
    setContacts(contacts.filter((contact) => contact.id !== id));
    try {
      await contactsApi.remove(id);
    } catch (err: unknown) {
      setContacts(previous);
      setError(err instanceof Error ? err.message : 'Failed to remove contact');
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Contacts</h2>
        <button onClick={() => setShowForm((value) => !value)} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {showForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {showForm && (
        <form onSubmit={addContact} className="mb-3 space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Name" className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          <select value={relationship} onChange={(event) => setRelationship(event.target.value as ContactRelationship)} className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            {CONTACT_RELATIONSHIPS.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
          </select>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email (optional)" className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          <input value={linkedinUrl} onChange={(event) => setLinkedinUrl(event.target.value)} placeholder="https://linkedin.com/in/… (optional)" className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100" />
          <button disabled={saving || !name.trim()} className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-zinc-400">No contacts yet.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-start justify-between gap-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{contact.name}</span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] capitalize text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{relationshipLabel(contact.relationship)}</span>
                </div>
                {contact.email && <p className="truncate text-xs text-zinc-500">{contact.email}</p>}
                {contact.linkedinUrl && <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="truncate text-xs text-indigo-600 dark:text-indigo-400">LinkedIn</a>}
              </div>
              <button onClick={() => removeContact(contact.id)} className="shrink-0 text-xs text-zinc-400 hover:text-rose-600" aria-label={`Remove ${contact.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
