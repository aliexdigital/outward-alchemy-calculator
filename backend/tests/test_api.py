from __future__ import annotations

from io import BytesIO

import pandas as pd
from fastapi.testclient import TestClient

from backend.app.main import create_app


def make_client() -> TestClient:
    return TestClient(create_app())


def csv_bytes(rows: list[dict]) -> bytes:
    return pd.DataFrame(rows).to_csv(index=False).encode("utf-8")


def excel_bytes(rows: list[dict]) -> bytes:
    buffer = BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False)
    return buffer.getvalue()


def direct_result_map(items: list[dict]) -> dict[str, dict]:
    return {row["result"]: row for row in items}


def test_add_inventory_item_updates_direct_and_overview_results() -> None:
    client = make_client()

    baseline = client.get("/api/results/direct").json()
    assert baseline["count"] == 0

    client.post("/api/inventory/items/add", json={"item": "Gravel Beetle", "qty": 1}).raise_for_status()

    inventory = client.get("/api/inventory").json()
    overview = client.get("/api/results/overview").json()
    direct = client.get("/api/results/direct?limit=10").json()

    assert inventory["items"] == [{"item": "Gravel Beetle", "qty": 1}]
    assert overview["inventory"]["items"] == [{"item": "Gravel Beetle", "qty": 1}]
    assert overview["snapshot"]["direct_crafts"] > 0
    assert "Clean Water" in direct_result_map(direct["items"])


def test_adding_same_item_merges_quantity_and_results() -> None:
    client = make_client()

    client.post("/api/inventory/items/add", json={"item": "Gravel Beetle", "qty": 1}).raise_for_status()
    client.post("/api/inventory/items/add", json={"item": "Gravel Beetle", "qty": 2}).raise_for_status()

    inventory = client.get("/api/inventory").json()
    direct = client.get("/api/results/direct?limit=10").json()
    clean_water = direct_result_map(direct["items"])["Clean Water"]

    assert inventory["items"] == [{"item": "Gravel Beetle", "qty": 3}]
    assert inventory["total_quantity"] == 3
    assert clean_water["max_crafts"] == 3


def test_editing_existing_quantity_updates_outputs() -> None:
    client = make_client()

    client.post("/api/inventory/items/add", json={"item": "Gravel Beetle", "qty": 1}).raise_for_status()
    client.put("/api/inventory/items/Gravel Beetle", json={"qty": 5}).raise_for_status()

    inventory = client.get("/api/inventory").json()
    direct = client.get("/api/results/direct?limit=10").json()
    clean_water = direct_result_map(direct["items"])["Clean Water"]

    assert inventory["items"] == [{"item": "Gravel Beetle", "qty": 5}]
    assert clean_water["max_crafts"] == 5


def test_csv_import_updates_canonical_inventory_and_results() -> None:
    client = make_client()

    response = client.post(
        "/api/inventory/import/csv",
        files={"file": ("inventory.csv", csv_bytes([{"item": "Gravel Beetle", "qty": 2}]), "text/csv")},
    )
    response.raise_for_status()

    inventory = client.get("/api/inventory").json()
    direct = client.get("/api/results/direct?limit=10").json()
    clean_water = direct_result_map(direct["items"])["Clean Water"]

    assert inventory["items"] == [{"item": "Gravel Beetle", "qty": 2}]
    assert clean_water["max_crafts"] == 2


def test_excel_import_updates_canonical_inventory_and_results() -> None:
    client = make_client()

    response = client.post(
        "/api/inventory/import/excel",
        files={
            "file": (
                "inventory.xlsx",
                excel_bytes([{"item": "Gravel Beetle", "qty": 2}]),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    response.raise_for_status()

    inventory = client.get("/api/inventory").json()
    direct = client.get("/api/results/direct?limit=10").json()
    clean_water = direct_result_map(direct["items"])["Clean Water"]

    assert inventory["items"] == [{"item": "Gravel Beetle", "qty": 2}]
    assert clean_water["max_crafts"] == 2


def test_planner_and_shopping_list_read_same_canonical_inventory() -> None:
    client = make_client()

    client.post("/api/inventory/items/add", json={"item": "Gravel Beetle", "qty": 2}).raise_for_status()

    planner = client.post("/api/results/planner", json={"target": "Cool Potion", "max_depth": 5}).json()
    shopping = client.post(
        "/api/results/shopping-list",
        json={"targets": [{"item": "Mineral Tea", "qty": 1}], "max_depth": 5},
    ).json()

    assert planner["found"] is True
    assert shopping["missing"] == []
