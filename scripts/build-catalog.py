#!/usr/bin/env python3
import json
from pathlib import Path

ROOTS = [Path("apps"), Path("notebooks")]
items = []

for root in ROOTS:
    if not root.exists():
        continue

    for meta_path in sorted(root.rglob("app.json")):
        folder = meta_path.parent
        with meta_path.open("r", encoding="utf-8") as f:
            item = json.load(f)

        entry = item.get("entry", "index.html")
        url = str(folder / entry).replace("\\", "/")

        if entry == "index.html":
            url = str(folder).replace("\\", "/") + "/"

        item["url"] = url
        item["path"] = str(folder).replace("\\", "/")
        items.append(item)

order = {"comparative": 0, "pilot-wave": 1, "foundations": 2}
items.sort(key=lambda x: (x.get("type", ""), order.get(x.get("category", ""), 99), x.get("title", "")))

with open("catalog.json", "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2, ensure_ascii=False)

print(f"Wrote catalog.json with {len(items)} entries")
