import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeedbackStatus } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

interface StatusSelectProps {
  value: FeedbackStatus;
  onValueChange: (value: FeedbackStatus) => void;
  disabled?: boolean;
}

export function StatusSelect({ value, onValueChange, disabled }: StatusSelectProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">{t('statusOpen')}</SelectItem>
        <SelectItem value="planned">{t('statusPlanned')}</SelectItem>
        <SelectItem value="progress">{t('statusProgress')}</SelectItem>
        <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
        <SelectItem value="wont_do">{t('statusWontDo')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
