import { useState } from 'react';
import { Lightbulb, Bug } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/hooks/useTranslation';
import { FeedbackType } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface CreateFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: FeedbackType;
  onSubmit: (data: { 
    title: string; 
    description: string; 
    type: FeedbackType;
    email?: string;
    notifyOnUpdates?: boolean;
  }) => void;
}

export function CreateFeedbackDialog({
  open,
  onOpenChange,
  type,
  onSubmit,
}: CreateFeedbackDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [notifyOnUpdates, setNotifyOnUpdates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (email: string) => {
    if (!email) return true; // Empty is valid (optional field)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    
    if (email && !isValidEmail(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ 
        title: title.trim(), 
        description: description.trim(), 
        type,
        email: email.trim() || undefined,
        notifyOnUpdates: email.trim() ? notifyOnUpdates : false,
      });
      toast({
        title: t('submitSuccess'),
      });
      setTitle('');
      setDescription('');
      setEmail('');
      setNotifyOnUpdates(true);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFeature = type === 'feature';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isFeature ? 'bg-feature-bg' : 'bg-bug-bg'
              }`}
            >
              {isFeature ? (
                <Lightbulb className="h-5 w-5 text-feature" />
              ) : (
                <Bug className="h-5 w-5 text-bug" />
              )}
            </div>
            <div>
              <DialogTitle>
                {isFeature ? t('createFeature') : t('createBug')}
              </DialogTitle>
              <DialogDescription>
                {isFeature
                  ? t('featureDialogDescription')
                  : t('bugDialogDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('title')}</Label>
            <Input
              id="title"
              placeholder={t('titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('emailOptional')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {email.trim() && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notifyOnUpdates"
                checked={notifyOnUpdates}
                onCheckedChange={(checked) => setNotifyOnUpdates(checked === true)}
              />
              <Label 
                htmlFor="notifyOnUpdates" 
                className="text-sm font-normal cursor-pointer"
              >
                {t('notifyOnUpdates')}
              </Label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant={isFeature ? 'feature' : 'bug'}
              disabled={isSubmitting || !title.trim() || !description.trim()}
            >
              {t('submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
