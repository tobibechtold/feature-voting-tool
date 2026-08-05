import { useState } from 'react';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { useApiTokens, useCreateApiToken, useRevokeApiToken, ApiToken } from '@/hooks/useApiTokens';

export function ApiTokensCard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: tokens, isLoading } = useApiTokens();
  const createToken = useCreateApiToken();
  const revokeToken = useRevokeApiToken();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

  const closeCreateDialog = () => {
    setCreateOpen(false);
    setName('');
    setCreatedToken(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const token = await createToken.mutateAsync(name.trim());
      setCreatedToken(token);
    } catch (error) {
      toast({ title: String(error), variant: 'destructive' });
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    toast({ title: t('tokenCopied') });
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeToken.mutateAsync(revokeTarget.id);
    } catch (error) {
      toast({ title: String(error), variant: 'destructive' });
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t('apiTokens')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('apiTokensDescription')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {t('createToken')}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !tokens || tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noTokens')}</p>
        ) : (
          <ul className="divide-y">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{token.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(token.created_at).toLocaleDateString()}
                    {' · '}
                    {token.last_used_at
                      ? `${t('tokenLastUsed')}: ${new Date(token.last_used_at).toLocaleDateString()}`
                      : t('tokenNeverUsed')}
                  </p>
                </div>
                {token.revoked_at ? (
                  <span className="text-xs text-muted-foreground">{t('tokenRevoked')}</span>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setRevokeTarget(token)}>
                    {t('revokeToken')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) closeCreateDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createToken')}</DialogTitle>
            {createdToken && (
              <DialogDescription>{t('tokenCreatedWarning')}</DialogDescription>
            )}
          </DialogHeader>
          {createdToken ? (
            <div className="space-y-4">
              <code className="block break-all rounded bg-muted p-3 text-sm">{createdToken}</code>
              <DialogFooter>
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-1" />
                  {t('copyToken')}
                </Button>
                <Button onClick={closeCreateDialog}>{t('close')}</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">{t('tokenName')}</Label>
                <Input
                  id="token-name"
                  value={name}
                  placeholder={t('tokenNamePlaceholder')}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>{t('cancel')}</Button>
                <Button onClick={handleCreate} disabled={!name.trim() || createToken.isPending}>
                  {t('submit')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeTokenConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revokeTokenConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke}>{t('revokeToken')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
