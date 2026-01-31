export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      apps: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          logo_url?: string | null
          created_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          app_id: string
          type: 'feature' | 'bug'
          title: string
          description: string
          status: 'open' | 'planned' | 'progress' | 'completed'
          vote_count: number
          created_at: string
          submitter_email: string | null
          notify_on_updates: boolean
        }
        Insert: {
          id?: string
          app_id: string
          type: 'feature' | 'bug'
          title: string
          description: string
          status?: 'open' | 'planned' | 'progress' | 'completed'
          vote_count?: number
          created_at?: string
          submitter_email?: string | null
          notify_on_updates?: boolean
        }
        Update: {
          id?: string
          app_id?: string
          type?: 'feature' | 'bug'
          title?: string
          description?: string
          status?: 'open' | 'planned' | 'progress' | 'completed'
          vote_count?: number
          created_at?: string
          submitter_email?: string | null
          notify_on_updates?: boolean
        }
      }
      votes: {
        Row: {
          id: string
          feedback_id: string
          voter_id: string
          created_at: string
        }
        Insert: {
          id?: string
          feedback_id: string
          voter_id: string
          created_at?: string
        }
        Update: {
          id?: string
          feedback_id?: string
          voter_id?: string
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          feedback_id: string
          content: string
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id?: string
          feedback_id: string
          content: string
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          feedback_id?: string
          content?: string
          is_admin?: boolean
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'user'
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'user'
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'admin' | 'user'
        }
      }
    }
    Functions: {
      has_role: {
        Args: {
          _user_id: string
          _role: 'admin' | 'user'
        }
        Returns: boolean
      }
      vote_for_feedback: {
        Args: {
          p_feedback_id: string
          p_voter_id: string
        }
        Returns: { vote_count: number; already_voted: boolean }
      }
      delete_feedback_cascade: {
        Args: {
          p_feedback_id: string
        }
        Returns: void
      }
      delete_app_cascade: {
        Args: {
          p_app_id: string
        }
        Returns: void
      }
    }
    Enums: {
      app_role: 'admin' | 'user'
    }
  }
}
