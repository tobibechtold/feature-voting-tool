import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FeedbackCard } from '@/components/FeedbackCard';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  buildFeedbackStateSections,
  getDefaultFeedbackStateExpansion,
  type FeedbackStateExpansion,
} from '@/lib/feedbackOverview';
import { loadGroupedFeedbackExpansion, saveGroupedFeedbackExpansion } from '@/lib/roadmapPreferences';
import { useTranslation } from '@/hooks/useTranslation';
import type { FeedbackItem, FeedbackStatus } from '@/types';

interface FeedbackStateSectionsProps {
  slug: string;
  items: FeedbackItem[];
  appSlug: string;
  votedItems: Set<string>;
  onVote: (id: string) => void;
}

function getStatusLabel(status: FeedbackStatus, t: (key: 'statusOpen' | 'statusPlanned' | 'statusProgress' | 'statusCompleted' | 'statusWontDo') => string) {
  switch (status) {
    case 'planned':
      return t('statusPlanned');
    case 'progress':
      return t('statusProgress');
    case 'completed':
      return t('statusCompleted');
    case 'wont_do':
      return t('statusWontDo');
    default:
      return t('statusOpen');
  }
}

export function FeedbackStateSections({
  slug,
  items,
  appSlug,
  votedItems,
  onVote,
}: FeedbackStateSectionsProps) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = React.useState<FeedbackStateExpansion>(() =>
    loadGroupedFeedbackExpansion(slug)
  );
  const sections = buildFeedbackStateSections(items).filter((section) => section.items.length > 0);

  React.useEffect(() => {
    setExpandedSections(loadGroupedFeedbackExpansion(slug));
  }, [slug]);

  const toggleSection = (status: FeedbackStatus) => {
    setExpandedSections((current) => {
      const next = {
        ...getDefaultFeedbackStateExpansion(),
        ...current,
        [status]: !current[status],
      };
      saveGroupedFeedbackExpansion(slug, next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const isOpen = expandedSections[section.status];
        const statusLabel = getStatusLabel(section.status, t);

        return (
          <Collapsible key={section.status} open={isOpen} onOpenChange={() => toggleSection(section.status)}>
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="flex items-center justify-between p-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="h-auto justify-start px-0 text-left hover:bg-transparent">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span>{statusLabel}</span>
                    <span className="text-muted-foreground">({section.items.length})</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="space-y-4 px-4 pb-4">
                  {section.items.map((item) => (
                    <FeedbackCard
                      key={item.id}
                      item={item}
                      appSlug={appSlug}
                      voted={votedItems.has(item.id)}
                      onVote={onVote}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
