import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUploadLogo() {
  return useMutation({
    mutationFn: async ({ file, appId }: { file: File; appId: string }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${appId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('app-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('app-logos')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
  });
}

export function useDeleteLogo() {
  return useMutation({
    mutationFn: async (logoUrl: string) => {
      const url = new URL(logoUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(pathParts.indexOf('app-logos') + 1).join('/');

      const { error } = await supabase.storage
        .from('app-logos')
        .remove([filePath]);

      if (error) throw error;
    },
  });
}

export function useUploadFeedbackScreenshot() {
  return useMutation({
    mutationFn: async ({ file, feedbackId, index }: { file: File; feedbackId: string; index: number }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${feedbackId}-${index}-${Date.now()}.${fileExt}`;
      const filePath = `screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('feedback-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('feedback-attachments')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
  });
}
