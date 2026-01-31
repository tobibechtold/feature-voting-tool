import { supabase } from '@/integrations/supabase/client';

interface NotificationPayload {
  type: 'new_feedback' | 'status_change' | 'admin_comment';
  feedback: {
    id: string;
    type: 'feature' | 'bug';
    title: string;
    status?: string;
    submitter_email?: string | null;
    notify_on_updates?: boolean;
  };
  appName: string;
  appSlug: string;
  comment?: string;
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: payload,
    });

    if (error) {
      console.error('Failed to send notification:', error);
    } else {
      console.log('Notification sent:', data);
    }
  } catch (err) {
    console.error('Error calling notification function:', err);
  }
}
