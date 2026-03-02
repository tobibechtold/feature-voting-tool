import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Bug, ImagePlus, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { FeedbackType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { normalizePlatformLabel } from '@/lib/platforms';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface CreateFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: FeedbackType;
  platforms: string[];
  onSubmit: (data: { 
    title: string; 
    description: string; 
    type: FeedbackType;
    platform?: string;
    email?: string;
    notifyOnUpdates?: boolean;
    screenshots?: File[];
  }) => void;
}

export function CreateFeedbackDialog({
  open,
  onOpenChange,
  type,
  platforms,
  onSubmit,
}: CreateFeedbackDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [notifyOnUpdates, setNotifyOnUpdates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [platform, setPlatform] = useState<string>('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValidEmail = (email: string) => {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_FILES - screenshots.length;
    const toAdd = files.slice(0, remaining);
    
    const validFiles: File[] = [];
    for (const file of toAdd) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: `${file.name} exceeds 5MB`,
          variant: 'destructive',
        });
        continue;
      }
      if (!file.type.startsWith('image/')) continue;
      validFiles.push(file);
    }

    const newPreviews = validFiles.map(f => URL.createObjectURL(f));
    setScreenshots(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeScreenshot = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setScreenshots(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (type === 'bug' && !platform) return;
    
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
        platform: type === 'bug' ? platform : undefined,
        email: email.trim() || undefined,
        notifyOnUpdates: email.trim() ? notifyOnUpdates : false,
        screenshots: screenshots.length > 0 ? screenshots : undefined,
      });
      toast({ title: t('submitSuccess') });
      // Cleanup previews
      previews.forEach(p => URL.revokeObjectURL(p));
      setTitle('');
      setDescription('');
      setEmail('');
      setNotifyOnUpdates(true);
      setPlatform('');
      setScreenshots([]);
      setPreviews([]);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFeature = type === 'feature';

  useEffect(() => {
    if (!open) return;
    if (type === 'bug') {
      setPlatform((prev) => prev || platforms[0] || '');
      return;
    }
    setPlatform('');
  }, [open, type, platforms]);

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
                  ? 'Share your idea to improve this app'
                  : 'Report an issue you encountered'}
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

          {!isFeature && (
            <div className="space-y-2">
              <Label>{t('platform')}</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectPlatform')} />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      {normalizePlatformLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Screenshot attachment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('attachScreenshots')}</Label>
              <span className="text-xs text-muted-foreground">{t('maxFiles')}</span>
            </div>

            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {previews.map((src, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-md overflow-hidden border border-border">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeScreenshot(i)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {screenshots.length < MAX_FILES && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {t('attachScreenshots')}
                </Button>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

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
              disabled={isSubmitting || !title.trim() || !description.trim() || !isValidEmail(email) || (!isFeature && !platform)}
            >
              {t('submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
