# QuickList — lists, by color

**The list *is* the colour.** No titles required, no categories — you tell lists apart by the hue you give them, and that hue becomes the identity of the whole screen. Mobile-first, premium, fast. Zero dependencies, no build step, works offline, installable.

---

## Run it

- **On this PC:** `py -3 -m http.server 8743 -d quicklist` → open `http://localhost:8743`
- **On your phone:** host the folder on any static host (Netlify Drop, Vercel, GitHub Pages) and open it. Installable as a PWA (Add to Home Screen); offline after first load.
- **Want a real Android APK?** See [BUILD-APK.md](BUILD-APK.md) — a no-tools, ~5-minute path.

First launch ships with three demo lists (one untitled, one pinned with quantities + auto-tidy on) so every feature is visible. Delete them to make it yours.

## What's new in this version (vs. the previous build)

Renamed to **QuickList**, hardened for daily use, and five original features added:

1. **Find** — a live search across every list *and* its items; matches are highlighted right on the cards.
2. **Sort & filter** — arrange home by Recent / Name / To-do first / Colour, and filter the grid down to a single colour (an organising idea unique to a colour-first app).
3. **Pin to top** — keep your everyday lists above the rest; pinned cards show a pin flag and always sort first.
4. **Smart paste / bulk add** — paste a whole block (recipe, notes, a checklist) and it becomes clean items: `-`, `*`, `•`, `1.`, `2)` markers are stripped, `[x]`/`[ ]` set the done state, and `milk x2` captures a quantity. Commas and line breaks each start a new item.
5. **Quantities** — items carry a `×N` badge; tap it to bump, or edit the text (`milk x3`) to set it. Shown in copied/shared text too.
6. **Auto-tidy** ("Keep checked at bottom") — a per-list toggle that glides completed items to the bottom so the live list stays on top.

## User flow

```
HOME (grid of colour cards) ── search field · sort/filter (⇄) · ⋯ per-card menu
  │  + (FAB)                                            (Open · Pin · Colour · Copy · WhatsApp · Duplicate · Delete)
  ▼
NEW LIST  ─ created instantly with the next colour, opens straight to the cursor
  │
LIST DETAIL
  ├─ type / paste a block / "milk x2"   → smart add (markers, [x], quantity)
  ├─ 🎤 mic                              → dictate; speech → text → item(s)
  ├─ tap circle                          → check (colour fill + spring); auto-tidy sinks it if on
  ├─ tap text                            → inline edit (text + quantity)
  ├─ tap ×N badge                        → bump quantity
  ├─ swipe item left                     → delete (with Undo)
  ├─ drag ⠿ handle                       → reorder instantly, persisted
  ├─ 🎨 colour                           → recolour the whole list live
  ├─ ⋯ menu                              → Pin · Keep checked at bottom · Colour · Clear checked · Duplicate · Delete
  ├─ copy                                → whole list to clipboard as plain text (quantities preserved)
  └─ WhatsApp                            → opens WhatsApp with a clean text version
```

## Component architecture

Vanilla JS, organised as components so it maps cleanly onto React/Vue/Svelte. Sections in [`app.js`](app.js):

| Layer | Responsibility |
|---|---|
| **Color system** | `PALETTE`, WCAG-luminance → readable foreground, `applyHue()`; CSS derives every tint via `color-mix()` |
| **Store** | single `state`, `localStorage`, CRUD (`createList`, `deleteList`, `duplicateList`, `clearDone`, `togglePin`, `toggleTidy`, item add/toggle/edit/delete/reorder/quantity) |
| **Router / Views** | history-based nav; `<Home>` (`renderHome` + `homeView` sort/filter/search) and `<ListDetail>` (`renderDetail`) |
| **Components** | `ListCard`, `ItemRow`, empty states — pure functions returning markup |
| **Interactions** | `Find/Sort/Filter`, `DragReorder`, `SwipeDelete`, `SmartAdd/Paste`, `Quantity`, `AutoTidy`, `Voice`, `Share`, `Copy`, `Sheet`, `Toast` |

State shape:
```js
{ v, nextColor, sort, filterColor,
  lists: [ { id, title, color, pinned, tidy, items: [ { id, text, done, qty } ], createdAt, updatedAt } ] }
```

## Accounts & sync (new)

- **Guest by default** — the app is fully usable with no account; nothing leaves the device.
- **Sign in** from the avatar in the home header: Google, or email/username + password, plus a create-account flow.
- **Device accounts work immediately** — passwords are PBKDF2-hashed via Web Crypto and never stored in clear; each account's lists are kept separate.
- **Cloud sync (optional)** — add your Firebase config to `config.js` to enable Google sign-in and real cross-device sync (sign in on another phone/computer → your lists are there). Setup: [SETUP-ACCOUNTS.md](SETUP-ACCOUNTS.md). Security model & audit: [SECURITY.md](SECURITY.md).
- **Startup is bulletproof** — the local app renders synchronously first; any cloud/network failure is contained and the app stays usable. Corrupted storage falls back to a safe state (verified).

## Quality floor

Visible keyboard focus, `prefers-reduced-motion`, dark mode via `prefers-color-scheme`, safe-area insets, 44px+ touch targets, browser-back closes sheets / leaves detail, a fatal-error fallback screen (never a blank page), and content never depends on an animation finishing to be visible. The red swipe-delete layer is gated to swipe gestures only, so it never peeks behind rows.

## Honest limitations

- Lists are local to the device. The store is one `save()` call — drop in a sync backend without touching the UI.
- Web Speech API support varies by browser/OS (best on Chrome/Android, Safari/iOS); the mic hides itself when the API is absent.
