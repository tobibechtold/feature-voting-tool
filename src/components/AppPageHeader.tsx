import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { AppPageNavigation } from './AppPageNavigation';

type AppPage = 'feedback' | 'roadmap' | 'changelog';

interface AppPageHeaderProps {
  backTo: string;
  slug: string;
  currentPage: AppPage;
  app: {
    name: string;
    description?: string | null;
    logo_url?: string | null;
  };
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function AppPageHeader({
  backTo,
  slug,
  currentPage,
  app,
  subtitle,
  action,
}: AppPageHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-8 animate-fade-in">
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {app.logo_url ? (
              <img
                src={app.logo_url}
                alt={app.name}
                className="h-16 w-16 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-primary/10 bg-gradient-to-br from-primary/10 to-primary/5">
                <span className="text-3xl font-bold text-primary">{app.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{app.name}</h1>
              {(subtitle || app.description) && (
                <p className="mt-2 text-muted-foreground">{subtitle || app.description}</p>
              )}
            </div>
          </div>

          {action ? <div className="flex flex-col gap-2 sm:flex-row">{action}</div> : null}
        </div>

        <AppPageNavigation slug={slug} currentPage={currentPage} />
      </div>
    </div>
  );
}
