import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { App } from '@/types';

interface AppCardProps {
  app: App;
}

export function AppCard({ app }: AppCardProps) {
  return (
    <Link to={`/app/${app.slug}`}>
      <Card className="group h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
              <span className="text-2xl font-bold text-primary">
                {app.name.charAt(0)}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <CardTitle className="mb-2">{app.name}</CardTitle>
          {app.description && (
            <CardDescription>{app.description}</CardDescription>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
