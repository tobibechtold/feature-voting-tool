export type FeedbackType = 'feature' | 'bug';

export type FeedbackStatus = 'open' | 'planned' | 'progress' | 'completed';

export interface App {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface FeedbackItem {
  id: string;
  app_id: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  vote_count: number;
  created_at: string;
  submitter_email?: string | null;
  notify_on_updates?: boolean;
  version?: string | null;
}

export interface Vote {
  id: string;
  feedback_id: string;
  voter_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  feedback_id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
}
