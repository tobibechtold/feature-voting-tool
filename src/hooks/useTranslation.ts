import { useApp } from '@/contexts/AppContext';
import { t, TranslationKey } from '@/lib/i18n';

export function useTranslation() {
  const { language } = useApp();
  
  return {
    t: (key: TranslationKey) => t(key, language),
    language,
  };
}
