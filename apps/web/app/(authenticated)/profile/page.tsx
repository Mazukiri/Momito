'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, profileApi } from '../../lib/api-client';
import type {
  ProfileEducationItem,
  ProfileExperienceItem,
  ProfileProjectItem,
  ProfileResponse,
} from '@momito/shared';
import { Card, EmptyState, ErrorBanner, Spinner } from '../../components/ui';

function skillsToText(skills: string[]) {
  return skills.join('\n');
}

function parseSkills(value: string): string[] {
  return [...new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean))];
}

function experienceToText(items: ProfileExperienceItem[]) {
  return items.map((item) => [
    item.company,
    item.role,
    item.years,
    item.tier,
    item.description,
  ].join(' | ')).join('\n');
}

function parseExperience(value: string): ProfileExperienceItem[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [company = '', role = '', years = '0', tier = 'Unknown', ...description] = line.split('|').map((part) => part.trim());
    return {
      company,
      role,
      years: Number(years) || 0,
      tier: tier || 'Unknown',
      description: description.join(' | '),
    };
  });
}

function educationToText(items: ProfileEducationItem[]) {
  return items.map((item) => [
    item.degree,
    item.institution,
    item.country,
    item.year ?? '',
  ].join(' | ')).join('\n');
}

function parseEducation(value: string): ProfileEducationItem[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [degree = '', institution = '', country = '', year = ''] = line.split('|').map((part) => part.trim());
    const numericYear = Number(year);
    return {
      degree,
      institution,
      country,
      year: Number.isFinite(numericYear) && numericYear > 0 ? numericYear : null,
    };
  });
}

function projectsToText(items: ProfileProjectItem[]) {
  return items.map((item) => [
    item.name,
    item.url ?? '',
    item.type,
    item.githubStars,
    item.description,
  ].join(' | ')).join('\n');
}

function parseProjects(value: string): ProfileProjectItem[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name = '', url = '', type = '', githubStars = '0', ...description] = line.split('|').map((part) => part.trim());
    return {
      name,
      url: url || null,
      type,
      githubStars: Math.max(0, Number(githubStars) || 0),
      description: description.join(' | '),
    };
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [skillsText, setSkillsText] = useState('');
  const [experienceText, setExperienceText] = useState('');
  const [educationText, setEducationText] = useState('');
  const [projectsText, setProjectsText] = useState('');

  const applyProfile = useCallback((next: ProfileResponse) => {
    setProfile(next);
    setName(next.name ?? '');
    setEmail(next.email ?? '');
    setGithubUrl(next.githubUrl ?? '');
    setLinkedinUrl(next.linkedinUrl ?? '');
    setSkillsText(skillsToText(next.skills));
    setExperienceText(experienceToText(next.experience));
    setEducationText(educationToText(next.education));
    setProjectsText(projectsToText(next.projects));
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await profileApi.get();
      applyProfile(result);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        setProfile(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetching
    fetchProfile();
  }, [fetchProfile]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await profileApi.update({
        name: name || null,
        email: email || null,
        githubUrl: githubUrl || null,
        linkedinUrl: linkedinUrl || null,
        skills: parseSkills(skillsText),
        experience: parseExperience(experienceText),
        education: parseEducation(educationText),
        projects: parseProjects(projectsText),
      });
      applyProfile(updated);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Profile</h1>
          <p className="mt-1 text-sm text-zinc-500">Your editable source for CV scoring</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/profile/upload')}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Upload CV
          </button>
          <button
            onClick={() => router.push('/profile/scores')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Scores
          </button>
        </div>
      </div>

      {error && <div className="mb-6"><ErrorBanner message={error} onRetry={fetchProfile} /></div>}

      {!profile ? (
        <Card>
          <EmptyState
            icon="CV"
            title="No profile yet"
            description="Upload a PDF CV to create your structured profile, then edit the extracted fields before scoring."
            action={
              <button
                onClick={() => router.push('/profile/upload')}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Upload CV
              </button>
            }
          />
        </Card>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Skills</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{profile.skills.length}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Experience</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{profile.experience.length}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Projects</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{profile.projects.length}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Education</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{profile.education.length}</p>
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 text-lg font-semibold text-zinc-800 dark:text-zinc-100">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="GitHub URL"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <input
                value={linkedinUrl}
                onChange={(event) => setLinkedinUrl(event.target.value)}
                placeholder="LinkedIn URL"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </Card>

          <Card>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Skills</label>
            <textarea
              value={skillsText}
              onChange={(event) => setSkillsText(event.target.value)}
              rows={6}
              placeholder="One skill per line"
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </Card>

          <Card>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Experience</label>
            <textarea
              value={experienceText}
              onChange={(event) => setExperienceText(event.target.value)}
              rows={6}
              placeholder="Company | Role | Years | Tier | Description"
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </Card>

          <Card>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Projects</label>
            <textarea
              value={projectsText}
              onChange={(event) => setProjectsText(event.target.value)}
              rows={6}
              placeholder="Name | URL | Type | GitHub stars | Description"
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </Card>

          <Card>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Education</label>
            <textarea
              value={educationText}
              onChange={(event) => setEducationText(event.target.value)}
              rows={4}
              placeholder="Degree | Institution | Country | Year"
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </Card>

          {profile.rawCvText && (
            <Card>
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Extracted CV text</span>
                <span className="text-sm text-zinc-400">{showRaw ? 'Hide' : 'Show'}</span>
              </button>
              {showRaw && (
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {profile.rawCvText}
                </pre>
              )}
            </Card>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {saved && <span className="text-sm font-medium text-green-600">Saved</span>}
          </div>
        </form>
      )}
    </div>
  );
}
