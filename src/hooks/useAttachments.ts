import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, publicSupabase } from '@/integrations/supabase/client';
import { FeedbackAttachment } from '@/types';

export function useAttachments(feedbackId: string | undefined) {
  return useQuery({
    queryKey: ['attachments', feedbackId],
    queryFn: async () => {
      if (!feedbackId) return [];

      const { data, error } = await publicSupabase
        .from('feedback_attachments')
        .select('*')
        .eq('feedback_id', feedbackId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as FeedbackAttachment[];
    },
    enabled: !!feedbackId,
  });
}

export function useCreateAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attachments: { feedback_id: string; image_url: string }[]) => {
      if (attachments.length === 0) return;

      const { error } = await supabase
        .from('feedback_attachments')
        .insert(attachments as never[]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ attachmentId, imageUrl }: { attachmentId: string; imageUrl: string }) => {
      // Delete from storage
      try {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/');
        const filePath = pathParts.slice(pathParts.indexOf('feedback-attachments') + 1).join('/');

        await supabase.storage
          .from('feedback-attachments')
          .remove([filePath]);
      } catch (e) {
        console.warn('Failed to delete file from storage:', e);
      }

      // Delete record
      const { error } = await supabase
        .from('feedback_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
    },
  });
}
