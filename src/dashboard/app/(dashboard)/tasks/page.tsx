// Server-side initial fetch from `staff_task` table.
// Real DB table is `staff_task` (mig 016), not `task` — verified at Step 1.
// Client subscribes to postgres_changes for live PENDING task updates.

import { getSupabaseServer } from "../../../lib/supabase-server";
import TasksRealtime, { type TaskRow } from "./TasksRealtime";

export const dynamic = "force-dynamic";

const TASK_COLUMNS =
  "task_id, location_id, task_type, priority, status, assigned_to, " +
  "title, description, due_at, sla_hours, completed_at, created_at, updated_at, " +
  "staff:staff ( full_name, short_name )";

export default async function TasksPage() {
  const supabase = await getSupabaseServer();

  const { data, error } = await supabase
    .from("staff_task")
    .select(TASK_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">
            100 task gần nhất. Realtime cập nhật khi có task PENDING mới.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </div>
      )}

      <TasksRealtime initialRows={(data as unknown as TaskRow[]) ?? []} />
    </div>
  );
}
