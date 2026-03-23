import { Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

type AppPage = 'feedback' | 'roadmap' | 'changelog';

interface AppPageNavigationProps {
  slug: string;
  currentPage: AppPage;
}

export function AppPageNavigation({ slug, currentPage }: AppPageNavigationProps) {
  const { t } = useTranslation();

  const items: Array<{ page: AppPage; label: string; to: string }> = [
    { page: 'feedback', label: t('feedback'), to: `/app/${slug}` },
    { page: 'roadmap', label: t('roadmap'), to: `/app/${slug}/roadmap` },
    { page: 'changelog', label: t('changelog'), to: `/app/${slug}/changelog` },
  ];

  return (
    <nav className="overflow-x-auto" aria-label="App navigation">
      <div className="inline-flex min-w-max items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-1">
        {items.map((item) => {
          const isActive = item.page === currentPage;

          return (
            <Link
              key={item.page}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
