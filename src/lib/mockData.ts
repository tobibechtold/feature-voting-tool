import { App, FeedbackItem, Comment } from '@/types';

export const mockApps: App[] = [
  {
    id: '1',
    name: 'TaskFlow Pro',
    slug: 'taskflow',
    description: 'Project management and task tracking',
    logo_url: null,
    platforms: ['web', 'ios', 'android'],
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    name: 'CodeSnap',
    slug: 'codesnap',
    description: 'Beautiful code screenshots',
    logo_url: null,
    platforms: ['web'],
    created_at: '2024-02-20T14:30:00Z',
  },
  {
    id: '3',
    name: 'DataViz Studio',
    slug: 'dataviz',
    description: 'Data visualization platform',
    logo_url: null,
    platforms: ['web', 'desktop'],
    created_at: '2024-03-10T09:15:00Z',
  },
];

export const mockFeedback: FeedbackItem[] = [
  {
    id: '1',
    app_id: '1',
    type: 'feature',
    title: 'Dark mode support',
    description: 'Add a dark mode option for better viewing in low light conditions.',
    status: 'planned',
    vote_count: 42,
    created_at: '2024-03-01T08:00:00Z',
  },
  {
    id: '2',
    app_id: '1',
    type: 'bug',
    title: 'Tasks not syncing on mobile',
    description: 'When I create a task on mobile, it does not appear on desktop until I refresh.',
    status: 'progress',
    vote_count: 28,
    platform: 'ios',
    created_at: '2024-03-05T12:00:00Z',
  },
  {
    id: '3',
    app_id: '1',
    type: 'feature',
    title: 'Keyboard shortcuts',
    description: 'Add keyboard shortcuts for common actions like creating tasks and navigation.',
    status: 'open',
    vote_count: 15,
    created_at: '2024-03-08T16:00:00Z',
  },
  {
    id: '4',
    app_id: '1',
    type: 'feature',
    title: 'Calendar integration',
    description: 'Sync tasks with Google Calendar and Outlook.',
    status: 'completed',
    vote_count: 67,
    created_at: '2024-02-15T10:00:00Z',
  },
  {
    id: '5',
    app_id: '2',
    type: 'feature',
    title: 'Export to SVG',
    description: 'Allow exporting code screenshots as SVG for better scaling.',
    status: 'open',
    vote_count: 23,
    created_at: '2024-03-10T14:00:00Z',
  },
  {
    id: '6',
    app_id: '2',
    type: 'bug',
    title: 'Syntax highlighting broken for TypeScript',
    description: 'Generic types are not highlighted correctly in TypeScript files.',
    status: 'planned',
    vote_count: 19,
    platform: 'web',
    created_at: '2024-03-12T09:00:00Z',
  },
];

export const mockComments: Comment[] = [
  {
    id: '1',
    feedback_id: '1',
    content: 'This is on our roadmap for Q2! Stay tuned.',
    is_admin: true,
    created_at: '2024-03-02T10:00:00Z',
  },
  {
    id: '2',
    feedback_id: '2',
    content: 'We identified the issue and are working on a fix.',
    is_admin: true,
    created_at: '2024-03-06T11:00:00Z',
  },
];

// Simple voter ID based on browser fingerprint
export function getVoterId(): string {
  let voterId = localStorage.getItem('voter_id');
  if (!voterId) {
    voterId = 'voter_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('voter_id', voterId);
  }
  return voterId;
}

// Track votes in localStorage until Supabase is connected
export function getVotedItems(): Set<string> {
  const voted = localStorage.getItem('voted_items');
  return new Set(voted ? JSON.parse(voted) : []);
}

export function addVotedItem(feedbackId: string): void {
  const voted = getVotedItems();
  voted.add(feedbackId);
  localStorage.setItem('voted_items', JSON.stringify([...voted]));
}
