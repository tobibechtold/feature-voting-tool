import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Header } from '@/components/Header';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';

export default function Login() {
  const navigate = useNavigate();
  const { setIsAdmin } = useApp();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // TODO: Replace with Supabase auth when connected
    // For now, simulate login
    setTimeout(() => {
      if (email && password) {
        setIsAdmin(true);
        navigate('/admin');
      } else {
        toast({
          title: t('loginError'),
          variant: 'destructive',
        });
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-12">
        <div className="max-w-md mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>

          <Card className="animate-fade-in">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <LogIn className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t('loginTitle')}</CardTitle>
              <CardDescription>
                Sign in to access the admin dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('loading') : t('login')}
                </Button>
              </form>
              
              <p className="text-sm text-muted-foreground text-center mt-6">
                Note: Connect Supabase for real authentication
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
