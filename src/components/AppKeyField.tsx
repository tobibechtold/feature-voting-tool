import { Input } from '@/components/ui/input';
import { formatItemKey } from '@/lib/itemKey';

interface AppKeyFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
}

export function AppKeyField({ value, onChange, error, id = 'item_key' }: AppKeyFieldProps) {
  return (
    <>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="INTAKE"
        maxLength={10}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
      />
      <p className="text-xs text-muted-foreground">
        {`Example: ${formatItemKey(value || 'KEY', 42)}`}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}
