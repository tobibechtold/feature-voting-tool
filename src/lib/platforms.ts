export function parsePlatformsInput(input: string): string[] {
  const unique = new Set<string>();

  for (const raw of input.split(',')) {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) continue;
    unique.add(normalized);
  }

  return Array.from(unique);
}

export function formatPlatformsInput(platforms: string[]): string {
  return platforms.join(', ');
}

export function normalizePlatformLabel(platform: string): string {
  const key = platform.trim().toLowerCase();

  if (key === 'ios') return 'iOS';
  if (key === 'android') return 'Android';
  if (key === 'web') return 'Web';

  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
