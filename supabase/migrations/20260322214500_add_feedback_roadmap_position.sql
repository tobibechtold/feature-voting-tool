begin;

alter table public.feedback
  add column if not exists roadmap_position numeric;

with ranked_feedback as (
  select
    id,
    row_number() over (
      partition by app_id, status
      order by created_at, id
    )::numeric as next_roadmap_position
  from public.feedback
)
update public.feedback f
set roadmap_position = ranked_feedback.next_roadmap_position
from ranked_feedback
where f.id = ranked_feedback.id
  and f.roadmap_position is null;

create index if not exists feedback_app_status_roadmap_position_idx
  on public.feedback (app_id, status, roadmap_position);

commit;
