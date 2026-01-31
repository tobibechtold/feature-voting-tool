import { Moon, Sun, Globe, LogIn, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Link, useNavigate } from 'react-router-dom';

export function Header() {
  const { theme, setTheme, language, setLanguage, isAdmin, setIsAdmin } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    setIsAdmin(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 glass">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-primary-foreground font-bold text-lg">F</span>
          </div>
          <span className="font-semibold text-lg">{t('appTitle')}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')}>
                <span className={language === 'en' ? 'font-semibold' : ''}>
                  🇬🇧 {t('english')}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('de')}>
                <span className={language === 'de' ? 'font-semibold' : ''}>
                  🇩🇪 {t('german')}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>

          {/* Admin Controls */}
          {isAdmin ? (
            <>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/admin">
                  <Settings className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                {t('logout')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">
                <LogIn className="h-4 w-4 mr-2" />
                {t('login')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
