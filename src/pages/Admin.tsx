import { useState, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, ExternalLink, Upload, X } from 'lucide-react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useApps, useCreateApp, useUpdateApp, useDeleteApp } from '@/hooks/useApps';
import { useUploadLogo, useDeleteLogo } from '@/hooks/useStorage';
import { useToast } from '@/hooks/use-toast';
import { App } from '@/types';

export default function Admin() {
  const { isAdmin, authLoading } = useApp();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const { data: apps, isLoading } = useApps();
  const createApp = useCreateApp();
  const updateApp = useUpdateApp();
  const deleteApp = useDeleteApp();
  const uploadLogo = useUploadLogo();
  const deleteLogo = useDeleteLogo();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [deletingApp, setDeletingApp] = useState<App | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <Skeleton className="h-96 w-full max-w-5xl mx-auto" />
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '' });
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(false);
  };

  const openCreateDialog = () => {
    setEditingApp(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (app: App) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      slug: app.slug,
      description: app.description || '',
    });
    setLogoPreview(app.logo_url);
    setLogoFile(null);
    setRemoveLogo(false);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setRemoveLogo(false);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let logoUrl: string | null = editingApp?.logo_url || null;

      // If we're editing and removing the logo
      if (removeLogo && editingApp?.logo_url) {
        await deleteLogo.mutateAsync(editingApp.logo_url);
        logoUrl = null;
      }

      if (editingApp) {
        // Upload new logo if selected
        if (logoFile) {
          logoUrl = await uploadLogo.mutateAsync({ file: logoFile, appId: editingApp.id });
          toast({ title: t('logoUploaded') });
        }

        await updateApp.mutateAsync({
          id: editingApp.id,
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
          description: formData.description || null,
          logo_url: logoUrl,
        });
        toast({ title: t('appUpdated') });
      } else {
        // Create the app first
        const newApp = await createApp.mutateAsync({
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
          description: formData.description || null,
        });

        // Upload logo if provided
        if (logoFile) {
          logoUrl = await uploadLogo.mutateAsync({ file: logoFile, appId: newApp.id });
          await updateApp.mutateAsync({ id: newApp.id, logo_url: logoUrl });
          toast({ title: t('logoUploaded') });
        }

        toast({ title: t('appCreated') });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (deletingApp) {
      try {
        // Delete logo from storage if exists
        if (deletingApp.logo_url) {
          await deleteLogo.mutateAsync(deletingApp.logo_url);
        }
        await deleteApp.mutateAsync(deletingApp.id);
        toast({ title: t('appDeleted') });
        setDeleteDialogOpen(false);
        setDeletingApp(null);
      } catch (error) {
        toast({
          title: 'Error',
          description: (error as Error).message,
          variant: 'destructive',
        });
      }
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
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">{t('appLogo')}</TableHead>
                      <TableHead>{t('appName')}</TableHead>
                      <TableHead>{t('appSlug')}</TableHead>
                      <TableHead>{t('appDescription')}</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apps?.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell>
                          {app.logo_url ? (
                            <img 
                              src={app.logo_url} 
                              alt={app.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                              <span className="text-lg font-bold text-primary">
                                {app.name.charAt(0)}
                              </span>
                            </div>
                          )}
                        </TableCell>
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
                    
                    {(!apps || apps.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {t('noApps')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
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
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>{t('appLogo')}</Label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img 
                      src={logoPreview} 
                      alt="Logo preview"
                      className="w-16 h-16 rounded-lg object-cover border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('uploadLogo')}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG, or SVG (max 2MB)
                  </p>
                </div>
              </div>
            </div>

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
              <Button 
                type="submit" 
                disabled={createApp.isPending || updateApp.isPending || uploadLogo.isPending}
              >
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
              disabled={deleteApp.isPending}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
