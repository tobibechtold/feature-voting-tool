export type FeedbackType = 'feature' | 'bug';

export type FeedbackStatus = 'open' | 'planned' | 'progress' | 'completed' | 'wont_do';

export interface App {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  platforms: string[];
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
  platform?: string | null;
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
  commenter_email?: string | null;
  notify_on_reply?: boolean;
}

export interface VersionRelease {
  id: string;
  app_id: string;
  version: string;
  released_at: string | null;
  created_at: string;
}

export interface ReleaseGroup {
  id: string;
  app_id: string;
  semver: string;
  title: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReleaseGroupPlatform {
  id: string;
  release_group_id: string;
  platform: string;
  version: string;
  status: 'planned' | 'released';
  released_at: string | null;
  created_at: string;
}

export interface FeedbackReleaseTarget {
  id: string;
  feedback_id: string;
  release_group_id: string;
  platform: string;
  created_at: string;
}

export interface FeedbackAttachment {
  id: string;
  feedback_id: string;
  image_url: string;
  created_at: string;
}
