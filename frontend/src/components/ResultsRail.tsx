import type { DirectResponse, NearResponse } from "../types";
import { BestDirectCards, NearCraftTable } from "./data-views";
import { Panel, StatCard } from "./ui";

export function ResultsRail({
  bestDirect,
  near,
}: {
  bestDirect: DirectResponse | null;
  near: NearResponse | null;
}) {
  return (
    <aside className="results-rail">
      <Panel title="Best direct options" description="Live shortlist from the current stations and ranking.">
        <div className="stat-grid two-up compact-grid">
          <StatCard label="Direct crafts" value={bestDirect?.count ?? 0} />
          <StatCard label="Near crafts" value={bestDirect?.near_count ?? 0} />
        </div>
        <BestDirectCards rows={bestDirect?.items ?? []} />
      </Panel>

      <Panel title="Almost craftable" description="Closest valid recipes under the current threshold.">
        <div className="stat-grid two-up compact-grid">
          <StatCard label="Near crafts" value={near?.count ?? 0} />
          <StatCard label="Known recipes" value={near?.known_recipes ?? 0} />
        </div>
        <NearCraftTable
          compact
          rows={near?.items ?? []}
          emptyMessage="No recipes are currently inside the selected near-craft threshold."
        />
      </Panel>
    </aside>
  );
}
