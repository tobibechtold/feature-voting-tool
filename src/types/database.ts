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
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
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
    }
    Enums: {
      app_role: 'admin' | 'user'
    }
  }
}
