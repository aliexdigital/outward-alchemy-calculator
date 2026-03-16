# Alie’s Outward Crafting Calculator

A browser-based crafting helper for **Outward** that lets you:

- import your current inventory
- see what you can craft right now
- see what is almost craftable
- plan one target item
- build shopping lists
- browse the recipe database
---

## What it does

The app helps you answer questions like:

- What can I craft right now with my bag?
- What am I only 1–2 ingredients away from crafting?
- What do I still need to make one more copy of an item?
- What should I buy or farm for a target recipe?
- What recipes exist for a given item or ingredient?

---

## Main features

- **Craft now**
  - shows all currently craftable recipes
  - ranks recipes by smart score and other sort options
  - shows almost-craftable recipes separately

- **Plan a target**
  - checks whether you can make one more copy of an item
  - shows what is still needed
  - shows the closest route toward crafting it

- **Shopping list**
  - builds a missing-items list for multiple targets

- **Missing ingredients**
  - shows recipes that are close to completion

- **Recipe database**
  - searchable recipe browser
  - optional debug section for recipe visibility logic

- **Manual inventory import**
  - CSV / Excel upload fallback

- **Mod sync support**
  - the Outward mod can open the app with a sync payload in the URL
  - the app reads that payload and populates inventory automatically

---

## Project structure

```text
.
├─ frontend/          # the browser app (main runtime)
├─ shared/            # shared data / offline support files
├─ tools/             # one-time data tooling and scraping helpers
├─ README.md
├─ run.cmd
└─ run_frontend.cmd