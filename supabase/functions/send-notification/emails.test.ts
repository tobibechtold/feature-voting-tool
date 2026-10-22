import { describe, expect, it } from 'vitest';
import { buildNotificationEmail, type NotificationRequest } from './emails';

const opts = { baseUrl: 'https://vote.example.com/', adminEmail: 'admin@example.com' };
const ID = '11111111-1111-1111-1111-111111111111';

function req(over: Partial<NotificationRequest> & Pick<NotificationRequest, 'type'>, keyed: boolean): NotificationRequest {
  return {
    feedback: {
      id: ID,
      type: 'feature',
      title: 'Dark mode',
      status: 'planned',
      submitter_email: 'user@example.com',
      notify_on_updates: true,
      ...(keyed ? { number: 42 } : {}),
    },
    appName: 'Intake',
    appSlug: 'intake',
    ...(keyed ? { appKey: 'INTAKE' } : {}),
    comment: 'Thanks!',
    commenterEmail: 'commenter@example.com',
    ...over,
  };
}

describe('buildNotificationEmail with key', () => {
  it('new_feedback', () => {
    const e = buildNotificationEmail(req({ type: 'new_feedback' }, true), opts)!;
    expect(e.to).toEqual(['admin@example.com']);
    expect(e.subject).toBe('[INTAKE-42] New Feature Request: Dark mode');
    expect(e.html).toContain('INTAKE-42: Dark mode');
    expect(e.html).toContain('href="https://vote.example.com/app/intake/INTAKE-42"');
  });

  it('status_change', () => {
    const e = buildNotificationEmail(req({ type: 'status_change' }, true), opts)!;
    expect(e.to).toEqual(['user@example.com']);
    expect(e.subject).toBe('Your feature request INTAKE-42 is now Planned');
    expect(e.html).toContain('INTAKE-42: Dark mode');
    expect(e.html).toContain('/app/intake/INTAKE-42"');
  });

  it('admin_comment', () => {
    const e = buildNotificationEmail(req({ type: 'admin_comment' }, true), opts)!;
    expect(e.to).toEqual(['user@example.com']);
    expect(e.subject).toBe('Admin replied to your feature request INTAKE-42');
    expect(e.html).toContain('INTAKE-42: Dark mode');
    expect(e.html).toContain('/app/intake/INTAKE-42"');
  });

  it('admin_reply_to_comment', () => {
    const e = buildNotificationEmail(req({ type: 'admin_reply_to_comment' }, true), opts)!;
    expect(e.to).toEqual(['commenter@example.com']);
    expect(e.subject).toBe('Admin replied on INTAKE-42 "Dark mode"');
    expect(e.html).toContain('INTAKE-42: Dark mode');
    expect(e.html).toContain('/app/intake/INTAKE-42"');
  });
});

describe('buildNotificationEmail without key fields (old callers)', () => {
  it('new_feedback', () => {
    const e = buildNotificationEmail(req({ type: 'new_feedback' }, false), opts)!;
    expect(e.subject).toBe('New Feature Request: Dark mode');
    expect(e.html).toContain(`href="https://vote.example.com/app/intake/${ID}"`);
    expect(e.html).toContain('<strong>Title:</strong> Dark mode</p>');
  });

  it('status_change', () => {
    const e = buildNotificationEmail(req({ type: 'status_change' }, false), opts)!;
    expect(e.subject).toBe('Your feature request is now Planned');
    expect(e.html).toContain(`/app/intake/${ID}"`);
    expect(e.html).toContain('"<strong>Dark mode</strong>"');
  });

  it('admin_comment', () => {
    const e = buildNotificationEmail(req({ type: 'admin_comment' }, false), opts)!;
    expect(e.subject).toBe('Admin replied to your feature request');
    expect(e.html).toContain(`/app/intake/${ID}"`);
  });

  it('admin_reply_to_comment', () => {
    const e = buildNotificationEmail(req({ type: 'admin_reply_to_comment' }, false), opts)!;
    expect(e.subject).toBe('Admin replied on "Dark mode"');
    expect(e.html).toContain(`/app/intake/${ID}"`);
  });
});

describe('buildNotificationEmail null cases', () => {
  it('status_change without opt-in', () => {
    const r = req({ type: 'status_change' }, true);
    r.feedback.notify_on_updates = false;
    expect(buildNotificationEmail(r, opts)).toBeNull();
  });

  it('admin_comment without submitter email', () => {
    const r = req({ type: 'admin_comment' }, true);
    r.feedback.submitter_email = null;
    expect(buildNotificationEmail(r, opts)).toBeNull();
  });

  it('admin_reply_to_comment without commenter email', () => {
    expect(buildNotificationEmail(req({ type: 'admin_reply_to_comment', commenterEmail: undefined }, true), opts)).toBeNull();
  });
});
