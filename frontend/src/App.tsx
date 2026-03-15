import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { api } from "./api";
import type {
  DirectResponse,
  InventoryResponse,
  MetadataResponse,
  NearResponse,
  OverviewResponse,
  PlannerResponse,
  RecipeResult,
  ShoppingListResponse,
} from "./types";

const NAV_ITEMS = ["Craft now", "Plan a target", "Shopping list", "Missing ingredients", "Recipe database"] as const;
const SORT_MODES = [
  "Smart score",
  "Max crafts",
  "Max total output",
  "Healing yield",
  "Stamina yield",
  "Mana yield",
  "Sale value",
  "Result A-Z",
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function parseShoppingTargets(raw: string): Array<{ item: string; qty: number }> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [item, qty] = line.includes(",") ? line.split(",") : [line, "1"];
      return { item: item.trim(), qty: Math.max(1, Number.parseInt(qty.trim(), 10) || 1) };
    });
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => JSON.stringify(row[header] ?? ""))
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value ?? "None"}</strong>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={classNames("panel", className)}>
      <header className="panel-header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

function RecipeTable({
  rows,
  columns,
}: {
  rows: RecipeResult[];
  columns: Array<{ key: keyof RecipeResult; label: string }>;
}) {
  if (!rows.length) {
    return <div className="empty-state">No results yet.</div>;
  }
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.result}-${row.station}-${row.ingredients}`}>
              {columns.map((column) => (
                <td key={column.key}>{String(row[column.key] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [bestDirect, setBestDirect] = useState<DirectResponse | null>(null);
  const [craftNow, setCraftNow] = useState<DirectResponse | null>(null);
  const [near, setNear] = useState<NearResponse | null>(null);
  const [plannerResult, setPlannerResult] = useState<PlannerResponse | null>(null);
  const [shoppingResult, setShoppingResult] = useState<ShoppingListResponse | null>(null);

  const [activeSection, setActiveSection] = useState<NavItem>("Craft now");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [plannerDepth, setPlannerDepth] = useState(5);
  const [sortMode, setSortMode] = useState<string>("Smart score");
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickQty, setQuickQty] = useState(1);
  const [showOwnedOnly, setShowOwnedOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [planTarget, setPlanTarget] = useState("");
  const [shoppingText, setShoppingText] = useState("Mineral Tea,1");
  const [bulkText, setBulkText] = useState("");
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const deferredQuickAddValue = useDeferredValue(quickAddValue);

  const refreshDashboard = useCallback(
    async (stations: string[], currentSortMode: string) => {
      const [inventoryData, overviewData, bestDirectData, craftNowData, nearData] = await Promise.all([
        api.getInventory(),
        api.getOverview(stations),
        api.getDirect("Smart score", stations, 8),
        api.getDirect(currentSortMode, stations, 24),
        api.getNear(stations, 20),
      ]);
      setInventory(inventoryData);
      setOverview(overviewData);
      setBestDirect(bestDirectData);
      setCraftNow(craftNowData);
      setNear(nearData);
    },
    [],
  );

  useEffect(() => {
    async function bootstrap() {
      try {
        const meta = await api.getMetadata();
        setMetadata(meta);
        setSelectedStations(meta.stations);
        setSelectedCategories(meta.categories.map((category) => category.name));
        const recipeTargets = Array.from(new Set(meta.recipes.map((recipe) => String(recipe.result ?? "")))).filter(Boolean).sort();
        setPlanTarget(recipeTargets[0] ?? "");
        await refreshDashboard(meta.stations, "Smart score");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load app data.");
      } finally {
        setIsLoading(false);
      }
    }

    void bootstrap();
  }, [refreshDashboard]);

  useEffect(() => {
    if (!metadata) return;
    void refreshDashboard(selectedStations, sortMode).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to refresh calculator results.");
    });
  }, [metadata, refreshDashboard, selectedStations, sortMode]);

  const inventoryMap = useMemo(() => {
    const map = new Map<string, number>();
    inventory?.items.forEach((item) => map.set(item.item, item.qty));
    return map;
  }, [inventory]);

  const allCatalogRows = useMemo(() => {
    if (!metadata) return [];
    return metadata.categories.flatMap((category) =>
      category.items.map((item) => ({
        item,
        category: category.name,
        qty: inventoryMap.get(item) ?? 0,
      })),
    );
  }, [metadata, inventoryMap]);

  const filteredCatalogRows = useMemo(() => {
    const search = deferredQuickAddValue.trim().toLowerCase();
    return allCatalogRows.filter((row) => {
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(row.category);
      const searchMatch = !search || row.item.toLowerCase().includes(search);
      const ownedMatch = !showOwnedOnly || row.qty > 0;
      return categoryMatch && searchMatch && ownedMatch;
    });
  }, [allCatalogRows, deferredQuickAddValue, selectedCategories, showOwnedOnly]);

  const recipeTargets = useMemo(() => {
    if (!metadata) return [];
    return Array.from(new Set(metadata.recipes.map((recipe) => String(recipe.result ?? "")))).filter(Boolean).sort();
  }, [metadata]);

  const handleInventoryMutation = useCallback(
    async (operation: Promise<unknown>) => {
      try {
        setError(null);
        await operation;
        await refreshDashboard(selectedStations, sortMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Inventory update failed.");
      }
    },
    [refreshDashboard, selectedStations, sortMode],
  );

  const handleQuickAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const itemName = metadata?.ingredients.find((item) => item.toLowerCase() === quickAddValue.trim().toLowerCase());
    if (!itemName) {
      setError("Choose a known ingredient from the ingredient search before adding it.");
      return;
    }
    await handleInventoryMutation(api.addInventoryItem(itemName, Math.max(1, quickQty)));
    setQuickAddValue("");
    setQuickQty(1);
  };

  const applyInventoryQty = async (item: string) => {
    const nextValue = Number.parseInt(draftQuantities[item] ?? "", 10);
    if (Number.isNaN(nextValue)) return;
    await handleInventoryMutation(api.setInventoryItem(item, Math.max(0, nextValue)));
    setDraftQuantities((current) => {
      const copy = { ...current };
      delete copy[item];
      return copy;
    });
  };

  const handleBulkFile = async (file: File | null) => {
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".csv")) {
      await handleInventoryMutation(api.importCsv(file));
    } else {
      await handleInventoryMutation(api.importExcel(file));
    }
  };

  const runPlanner = async () => {
    if (!planTarget) return;
    try {
      setError(null);
      const result = await api.getPlanner(planTarget, plannerDepth);
      setPlannerResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planner request failed.");
    }
  };

  const runShoppingList = async () => {
    try {
      setError(null);
      const targets = parseShoppingTargets(shoppingText);
      const result = await api.getShoppingList(targets, plannerDepth);
      setShoppingResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shopping list request failed.");
    }
  };

  if (isLoading) {
    return <main className="app-shell loading-shell">Loading the crafting calculator...</main>;
  }

  return (
    <main className={classNames("app-shell", leftCollapsed && "left-collapsed")}>
      <aside className="utility-rail">
        <button
          className="rail-toggle"
          type="button"
          onClick={() => setLeftCollapsed((value) => !value)}
          aria-label={leftCollapsed ? "Expand utility rail" : "Collapse utility rail"}
        >
          {leftCollapsed ? ">" : "<"}
        </button>
        {!leftCollapsed ? (
          <div className="rail-scroll">
            <header className="rail-header">
              <span className="eyebrow">Utility rail</span>
              <h2>Support tools</h2>
              <p>Snapshot, planning controls, imports, and helper notes live here.</p>
            </header>

            <Panel title="Snapshot" description="Live summary driven by the same canonical inventory state used by every result panel.">
              <div className="stat-grid two-up">
                <StatCard label="Inventory lines" value={overview?.snapshot.inventory_lines ?? 0} />
                <StatCard label="Known recipes" value={overview?.snapshot.known_recipes ?? 0} />
                <StatCard label="Direct crafts" value={overview?.snapshot.direct_crafts ?? 0} />
                <StatCard label="Near crafts" value={overview?.snapshot.near_crafts ?? 0} />
              </div>
              <div className="stat-grid one-up compact-grid">
                <StatCard label="Best heal" value={overview?.snapshot.best_heal} />
                <StatCard label="Best stamina" value={overview?.snapshot.best_stamina} />
                <StatCard label="Best mana" value={overview?.snapshot.best_mana} />
              </div>
            </Panel>

            <Panel title="Planning tools" description="Choose stations for direct/near results and set planner depth for target planning.">
              <label className="field">
                <span>Planner depth</span>
                <input type="range" min={1} max={8} value={plannerDepth} onChange={(event) => setPlannerDepth(Number(event.target.value))} />
                <strong>{plannerDepth}</strong>
              </label>
              <div className="chip-group">
                {metadata?.stations.map((station) => {
                  const active = selectedStations.includes(station);
                  return (
                    <button
                      key={station}
                      type="button"
                      className={classNames("chip", active && "active")}
                      onClick={() =>
                        setSelectedStations((current) =>
                          active ? current.filter((value) => value !== station) : [...current, station],
                        )
                      }
                    >
                      {station}
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title="How to use this sidebar">
              <ul className="helper-list">
                <li>Snapshot reflects the same inventory that drives every result endpoint.</li>
                <li>Planning tools affects direct and near-craft results immediately.</li>
                <li>Bulk add merges into the canonical inventory instead of creating a hidden copy.</li>
              </ul>
            </Panel>

            <Panel title="Bulk add inventory" description="Import from text, CSV, or Excel without leaving the main calculator flow.">
              <textarea
                className="bulk-text"
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={"Gravel Beetle,2\nClean Water,4"}
              />
              <div className="inline-actions">
                <button type="button" className="button subtle" onClick={() => void handleInventoryMutation(api.importText(bulkText))}>
                  Import text
                </button>
                <label className="button subtle file-button">
                  Upload CSV / Excel
                  <input
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(event) => void handleBulkFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </Panel>

            <Panel title="Data details">
              <div className="helper-list">
                <div>Recipes loaded: {metadata?.recipe_count ?? 0}</div>
                <div>Ingredient categories: {metadata?.categories.length ?? 0}</div>
                <div>Stations: {metadata?.stations.length ?? 0}</div>
              </div>
            </Panel>
          </div>
        ) : null}
      </aside>

      <section className="main-column">
        <header className="hero-card">
          <p className="eyebrow">Outward crafting helper</p>
          <h1>Alie&apos;s Outward Crafting</h1>
          <p>Compare recipes, rank recovery or value, and build a clean shopping list.</p>
        </header>

        <nav className="mode-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              type="button"
              className={classNames("nav-pill", activeSection === item && "active")}
              onClick={() => setActiveSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        {error ? <div className="error-banner">{error}</div> : null}

        <Panel title="Inventory input" description="Quick-add ingredients, filter the full catalog, and edit the same inventory that drives every result.">
          <Panel title="Inventory overview" className="inline-overview" description="Current canonical inventory state.">
            <div className="inventory-overview-row">
              <StatCard label="Unique items" value={inventory?.unique_items ?? 0} />
              <StatCard label="Total quantity" value={inventory?.total_quantity ?? 0} />
              <button
                type="button"
                className="button subtle"
                onClick={() => downloadCsv("outward_inventory.csv", overview?.inventory_table ?? [])}
              >
                Download inventory CSV
              </button>
            </div>
            <div className="info-strip">
              {inventory?.items.length
                ? "This inventory overview is the single source of truth for all recipe results."
                : "No inventory selected yet. Add ingredients below or use bulk add from the left rail."}
            </div>
          </Panel>

          <form className="quick-add-row" onSubmit={(event) => void handleQuickAdd(event)}>
            <label className="field grow">
              <span>Search items</span>
              <input
                list="ingredient-options"
                value={quickAddValue}
                onChange={(event) => setQuickAddValue(event.target.value)}
                placeholder="Start typing an ingredient name..."
              />
              <datalist id="ingredient-options">
                {metadata?.ingredients.map((ingredient) => (
                  <option key={ingredient} value={ingredient} />
                ))}
              </datalist>
            </label>
            <label className="field quantity-field">
              <span>Qty</span>
              <input
                type="number"
                min={1}
                value={quickQty}
                onChange={(event) => setQuickQty(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <button type="submit" className="button primary">
              Add
            </button>
          </form>

          <div className="toolbar-row">
            <div className="toolbar-categories">
              <span className="toolbar-label">Categories</span>
              <div className="chip-group">
                {metadata?.categories.map((category) => {
                  const active = selectedCategories.includes(category.name);
                  return (
                    <button
                      key={category.name}
                      type="button"
                      className={classNames("chip", active && "active")}
                      onClick={() =>
                        setSelectedCategories((current) =>
                          active ? current.filter((value) => value !== category.name) : [...current, category.name],
                        )
                      }
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={showOwnedOnly}
                onChange={(event) => setShowOwnedOnly(event.target.checked)}
              />
              <span>Owned only</span>
            </label>
            <button type="button" className="button subtle" onClick={() => void handleInventoryMutation(api.replaceInventory([]))}>
              Clear
            </button>
          </div>

          <div className="table-shell ingredient-table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Have it</th>
                  <th>Ingredient</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Apply</th>
                </tr>
              </thead>
              <tbody>
                {filteredCatalogRows.map((row) => {
                  const currentQty = inventoryMap.get(row.item) ?? 0;
                  const draftValue = draftQuantities[row.item] ?? String(Math.max(currentQty, 1));
                  return (
                    <tr key={row.item}>
                      <td>
                        <input
                          type="checkbox"
                          checked={currentQty > 0}
                          onChange={(event) =>
                            void handleInventoryMutation(api.setInventoryItem(row.item, event.target.checked ? Math.max(currentQty, 1) : 0))
                          }
                        />
                      </td>
                      <td>{row.item}</td>
                      <td>{row.category}</td>
                      <td>
                        <input
                          className="qty-input"
                          type="number"
                          min={1}
                          value={draftValue}
                          onChange={(event) =>
                            setDraftQuantities((current) => ({
                              ...current,
                              [row.item]: event.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button type="button" className="button subtle tiny" onClick={() => void applyInventoryQty(row.item)}>
                          Apply
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="stat-grid four-up">
            <StatCard label="Categories shown" value={selectedCategories.length} />
            <StatCard label="Visible now" value={filteredCatalogRows.length} />
            <StatCard label="Selected total" value={inventory?.total_quantity ?? 0} />
            <StatCard label="Unique selected" value={inventory?.unique_items ?? 0} />
          </div>
        </Panel>

        {activeSection === "Craft now" ? (
          <Panel title="What you can craft right now" description="Full craftable output from the current inventory and station filter.">
            <label className="field inline-field">
              <span>Sort results by</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                {SORT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <RecipeTable
              rows={craftNow?.items ?? []}
              columns={[
                { key: "result", label: "Item" },
                { key: "max_crafts", label: "Crafts" },
                { key: "max_total_output", label: "Total output" },
                { key: "station", label: "Station" },
                { key: "effects", label: "Effects" },
              ]}
            />
          </Panel>
        ) : null}

        {activeSection === "Plan a target" ? (
          <Panel title="Plan a target" description="Run the multi-step planner against the same canonical inventory used everywhere else.">
            <div className="inline-actions">
              <label className="field grow">
                <span>Target item</span>
                <select value={planTarget} onChange={(event) => setPlanTarget(event.target.value)}>
                  {recipeTargets.map((target) => (
                    <option key={target} value={target}>
                      {target}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="button primary" onClick={() => void runPlanner()}>
                Run planner
              </button>
            </div>
            {plannerResult ? (
              <>
                <div className="info-strip">{plannerResult.found ? "A plan was found." : "No plan found with the current inventory and planner depth."}</div>
                <pre className="code-block">{plannerResult.lines.join("\n") || "No planner steps available."}</pre>
              </>
            ) : null}
          </Panel>
        ) : null}

        {activeSection === "Shopping list" ? (
          <Panel title="Shopping list" description="Generate a missing-ingredient list from the current canonical inventory plus one or more targets.">
            <textarea className="bulk-text" value={shoppingText} onChange={(event) => setShoppingText(event.target.value)} />
            <div className="inline-actions">
              <button type="button" className="button primary" onClick={() => void runShoppingList()}>
                Build shopping list
              </button>
            </div>
            {shoppingResult ? (
              <>
                <div className="split-columns">
                  <Panel title="Targets">
                    <div className="mini-table">
                      {shoppingResult.targets.map((item) => (
                        <div key={item.item}>
                          {item.item} x{item.qty}
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Missing ingredients">
                    <div className="mini-table">
                      {shoppingResult.missing.length ? (
                        shoppingResult.missing.map((item) => (
                          <div key={item.item}>
                            {item.item} x{item.qty}
                          </div>
                        ))
                      ) : (
                        <div>Nothing missing.</div>
                      )}
                    </div>
                  </Panel>
                </div>
                <pre className="code-block">{shoppingResult.lines.join("\n")}</pre>
              </>
            ) : null}
          </Panel>
        ) : null}

        {activeSection === "Missing ingredients" ? (
          <Panel title="Almost craftable recipes" description="Recipes that are close enough to matter right now.">
            <RecipeTable
              rows={near?.items ?? []}
              columns={[
                { key: "result", label: "Item" },
                { key: "missing_slots", label: "Missing slots" },
                { key: "missing_items", label: "Missing items" },
                { key: "station", label: "Station" },
              ]}
            />
          </Panel>
        ) : null}

        {activeSection === "Recipe database" ? (
          <Panel title="Recipe database" description="The full reference dataset, ready for further UI polish later.">
            <div className="table-shell recipe-database-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Result</th>
                    <th>Station</th>
                    <th>Ingredients</th>
                    <th>Effects</th>
                  </tr>
                </thead>
                <tbody>
                  {(metadata?.recipes ?? []).slice(0, 200).map((recipe, index) => (
                    <tr key={`${String(recipe.result)}-${index}`}>
                      <td>{String(recipe.result ?? "")}</td>
                      <td>{String(recipe.station ?? "")}</td>
                      <td>{String(recipe.ingredients ?? "")}</td>
                      <td>{String(recipe.effects ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
      </section>

      <aside className="results-rail">
        <Panel title="Best direct options" description="Strongest immediate crafts from the current inventory and station filter.">
          <div className="stat-grid two-up">
            <StatCard label="Direct crafts" value={bestDirect?.count ?? 0} />
            <StatCard label="Near crafts" value={bestDirect?.near_count ?? 0} />
          </div>
          <RecipeTable
            rows={bestDirect?.items ?? []}
            columns={[
              { key: "result", label: "Item" },
              { key: "max_crafts", label: "Crafts" },
              { key: "station", label: "Station" },
            ]}
          />
        </Panel>

        <Panel title="Almost craftable recipes" description="Near-craftable recipes that are one or two missing ingredient slots away.">
          <div className="stat-grid two-up">
            <StatCard label="Near crafts" value={near?.count ?? 0} />
            <StatCard label="Known recipes" value={near?.known_recipes ?? 0} />
          </div>
          <RecipeTable
            rows={near?.items ?? []}
            columns={[
              { key: "result", label: "Item" },
              { key: "missing_slots", label: "Missing" },
              { key: "station", label: "Station" },
            ]}
          />
        </Panel>

        <Panel title="What you can craft right now" description="Sorted craftable list from the current inventory.">
          <RecipeTable
            rows={craftNow?.items ?? []}
            columns={[
              { key: "result", label: "Item" },
              { key: "max_total_output", label: "Output" },
              { key: "station", label: "Station" },
            ]}
          />
        </Panel>
      </aside>
    </main>
  );
}
