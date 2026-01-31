import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useApp } from '@/contexts/AppContext';
import { useTranslation } from '@/hooks/useTranslation';
import { mockApps } from '@/lib/mockData';
import { App } from '@/types';

export default function Admin() {
  const { isAdmin } = useApp();
  const { t } = useTranslation();
  
  const [apps, setApps] = useState<App[]>(mockApps);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [deletingApp, setDeletingApp] = useState<App | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const openCreateDialog = () => {
    setEditingApp(null);
    setFormData({ name: '', slug: '', description: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (app: App) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      slug: app.slug,
      description: app.description || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingApp) {
      setApps((prev) =>
        prev.map((app) =>
          app.id === editingApp.id
            ? { ...app, ...formData }
            : app
        )
      );
    } else {
      const newApp: App = {
        id: String(Date.now()),
        name: formData.name,
        slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description || null,
        created_at: new Date().toISOString(),
      };
      setApps((prev) => [...prev, newApp]);
    }
    
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingApp) {
      setApps((prev) => prev.filter((app) => app.id !== deletingApp.id));
      setDeleteDialogOpen(false);
      setDeletingApp(null);
    }
  };

  const confirmDelete = (app: App) => {
    setDeletingApp(app);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="max-w-5xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('back')}
          </Link>

          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {t('adminDashboard')}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('manageApps')}
              </p>
            </div>
            
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addApp')}
            </Button>
          </div>

          <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle>{t('manageApps')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('appName')}</TableHead>
                    <TableHead>{t('appSlug')}</TableHead>
                    <TableHead>{t('appDescription')}</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {app.slug}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {app.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <Link to={`/app/${app.slug}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(app)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => confirmDelete(app)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {apps.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        {t('noApps')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingApp ? t('edit') : t('addApp')}
            </DialogTitle>
            <DialogDescription>
              {editingApp
                ? 'Update the app details'
                : 'Add a new app to receive feedback'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('appName')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="My Awesome App"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="slug">{t('appSlug')}</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                  }))
                }
                placeholder="my-awesome-app"
                required
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs: /app/{formData.slug || 'my-awesome-app'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">{t('appDescription')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optional description..."
                rows={3}
              />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit">
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingApp?.name}" and all its feedback.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
