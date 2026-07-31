# Buzz

**Your place in line, made simple.**

Buzz is a live queue for face painters, balloon artists, and anyone else with a
line of excited kids. The artist opens a line; clients scan one QR code, take a
number, and watch their turn from their own phone. No paper list, no crowd
around the chair, no shouting names over a festival.

- **Live** — every screen is driven by Firestore listeners, so numbers, waiting
  counts and "it's your turn" update without a refresh.
- **No install for clients** — a QR code opens a web page. Artists can install
  it as an app (PWA) if they want.
- **Two audiences, one codebase** — an artist side for running the line, and a
  client side designed to be read one-handed in a noisy room.

| Environment | URL |
| --- | --- |
| GitHub Pages | https://angiediaz0209.github.io/artistline/ |
| Firebase Hosting | project `artistline-v1` |

---

## Contents

- [How it works](#how-it-works)
- [Routes](#routes)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Design system](#design-system)
- [Deployment](#deployment)
- [Known issues and gotchas](#known-issues-and-gotchas)

---

## How it works

### The artist

1. **Create an event** (a birthday, a festival, a school fair) and add one or
   more **lines** to it — "Face Painting", "Glitter Tattoos", "Balloons".
2. **Share** from `/share`: a QR code for clients, a kiosk link for an iPad on
   the table, and a display link for a TV showing the number being served. The
   client QR prints as a table sign.
3. **Run the line** from the dashboard. "Live now" shows each open line with the
   number being served, how many are waiting and who's next; one tap opens the
   manage screen, where **Next Number** calls the next person and **Done** closes
   out the person in the chair.

### The client

Three ways in, all offering the same two choices — **Get a turn** or **Find my
turn**:

| Entry | Who it's for |
| --- | --- |
| `/join/:eventId` | scanned the QR on the table |
| `/artist/:username` | the artist's public page (`?kiosk=1` for iPad mode) |
| `/kiosk/:eventId` | a dedicated kiosk device |

When an event has several lines, clients can take a number in **one line or
several at once** — one name and phone gets a separate number per line. Their
status page then tracks each line independently, and turning green for one line
doesn't disturb the others.

---

## Routes

**Public**

| Route | Screen |
| --- | --- |
| `/` | Landing page |
| `/login` | Sign in / sign up |
| `/artist/:username` | Artist's public page → get or find a turn |
| `/join/:eventId` | Pick line(s) → join |
| `/customer/:customerId` | A client's live status (all their linked turns) |
| `/event/:eventId/find` | Look up an existing turn by name or phone |
| `/display/:eventId` | Now-serving screen for a TV |
| `/kiosk/:eventId` · `/kiosk/:eventId/:queueId` | Self check-in kiosk |

**Authenticated** (wrapped in `ProtectedLayout`)

| Route | Screen |
| --- | --- |
| `/dashboard` | Live lines + your events |
| `/share` | Links, QR codes, printable signs |
| `/create-event` | New event |
| `/event/:eventId` | Event detail + its lines |
| `/event/:eventId/create-queue` | New line |
| `/queue/:queueId/manage` | Call numbers, mark done, remove people |

---

## Tech stack

| | |
| --- | --- |
| UI | React 19, React Router 7 |
| Build | Vite 7 |
| Styling | Tailwind CSS 3 (custom palette, class-based dark mode) |
| Backend | Firebase — Auth (email/password + Google) and Cloud Firestore |
| Icons / QR | `lucide-react`, `qrcode.react` |
| Toasts | `react-hot-toast` |

There is no server of our own: the browser talks to Firestore directly, and
[`firestore.rules`](./firestore.rules) is the only thing enforcing access.

---

## Getting started

**Requirements:** Node 18+ and npm.

```bash
npm install
npm run dev          # http://localhost:5173
```

The Firebase web config lives in [`src/firebase.js`](./src/firebase.js). Web API
keys are public by design — they identify the project, they don't grant access —
so security depends entirely on Firestore rules, not on hiding this file.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build for the domain root (Firebase) |
| `npm run build:gh` | Production build for GitHub Pages + `404.html` |
| `npm run deploy` | `build:gh` then publish to the `gh-pages` branch |
| `npm run preview` | Serve the last build locally |
| `npm run lint` | ESLint |

> Changing `tailwind.config.js` requires restarting the dev server — Tailwind
> reads it once at startup, so new colours or `darkMode` changes silently do
> nothing until you do.

---

## Project structure

```
src/
├── components/
│   ├── BuzzBrand.jsx        BuzzMark, Mascot, QueueFigures
│   ├── Logo.jsx             hexagon bee mark (SVG)
│   ├── NavBar.jsx           top bar + mobile bottom tab bar
│   ├── ProtectedLayout.jsx  auth gate + nav chrome
│   ├── ShareCard.jsx        one share target (copy / QR / open / print)
│   ├── ThemeToggle.jsx      light–dark switch
│   └── TurnChoice.jsx       "Get a turn" / "Find my turn"
├── contexts/AuthContext.jsx
├── hooks/
│   ├── useDarkMode.js       reads and flips the theme
│   └── useQueueCustomers.js live customers for a set of lines
├── pages/                   one file per route
└── utils/
    ├── theme.js             per-event accent themes
    ├── shareTones.js        share card colour tones
    └── urls.js              base-path aware URLs (see Deployment)
```

### Conventions worth knowing

- **Tailwind classes are written out in full.** Purge can't see
  `` `bg-${color}-500` ``, so `theme.js` and `shareTones.js` store complete class
  strings.
- **Counts come from customer documents, not counters.** `queue.waitingCount`
  only refreshes while someone has that line's manage page open, so anything
  user-facing uses `useQueueCustomers` instead.
- **"Now serving" is derived from who is actually in the chair.**
  `queue.currentNumber` keeps the last number called even after that person is
  done, so it is not a source of truth for the artist's screens. The public TV
  display does use it, deliberately — a deli counter should keep showing the
  last number called.

---

## Data model

Firestore, seven collections.

### `artists/{uid}`
`email` · `username` (lowercase, unique) · `displayName` · `createdAt`

### `usernames/{username}`
`userId` — reserves the name and powers `/artist/:username` lookups.

### `events/{id}`
`artistId` · `name` · `location.address` · `date` · `colorTheme` ·
`status` (`active` | `completed`) · `eventType` · `notes` ·
`totalCustomers` · `queueCount` · `createdAt`

Closing an event sets `completed`. The dashboard also styles a third,
never-written state, so don't read the badge colours as the full set.

### `queues/{id}` — a "line"
`eventId` · `artistId` · `name` · `isVisible` · `status` (`open` | `closed`) ·
`currentNumber` · `lastNumber` · `waitingCount` · `totalServed` · `createdAt`

`lastNumber` is incremented in a transaction to hand out numbers, so two people
joining at once can't get the same one.

### `customers/{id}` — one person in one line
`queueId` · `eventId` · `number` · `name` · `phone` · `status` · `response` ·
`joinGroupId` · `joinedAt` · `calledAt` · `completedAt`

Kiosk entries also carry `childName` · `parentName` · `isChild` · `isKiosk`.

**`joinGroupId`** links the turns created together when someone joins several
lines at once — that's how one status page shows them all.

**Status lifecycle:**

```
waiting ──► called ──► completed        (Next Number, or Done)
              │
              ├──► coming              client tapped "on my way"
              └──► skipped             client can't make it / left the line
```

### `contacts/{id}`
Marketing consent captured at the kiosk. Create-only from the client.

### `notifications/{id}`
Queued notification intents. Written by the artist; **nothing sends them yet** —
there is no SMS/push provider wired up.

---

## Design system

Sampled from the Buzz brand sheet and defined in `tailwind.config.js`.

| Token | Value | Role |
| --- | --- | --- |
| `honey-500` | `#F8B51E` | primary actions, accents |
| `honey-400` | `#FDCA50` | highlight panels |
| `ink-900` | `#18232A` | text, dark surfaces |
| `sage-400` | `#87B9A6` | queue numbers, live/success |
| `stone-500` | `#9B968F` | secondary text |
| `cream-100` | `#F9EEE3` | page background |

**Poppins** is the default sans. The mascot (`public/brand/mascot.webp`) has a
real alpha channel, so it sits on any surface with nothing behind it.

Honey is a light colour: it always carries `text-ink-900`, never white.

### Dark mode

Class-based (`darkMode: 'class'`), toggled by `ThemeToggle`, remembered in
`localStorage`, and applied by an inline script in `index.html` before first
paint so there's no flash.

Because the palette is already semantic — cream *is* "page", white *is* "card",
ink *is* "text" — dark mode is a `.dark` override layer in `src/index.css`
rather than `dark:` variants across every component. **If you add a colour,
add it there too.** Honey and sage deliberately don't invert; anything sitting
on a light accent panel keeps its light-mode colours.

---

## Deployment

The app runs at the **domain root** on Firebase Hosting but under
**`/artistline/`** on GitHub Pages. Everything that needs to know the base goes
through [`src/utils/urls.js`](./src/utils/urls.js):

| Export | Use |
| --- | --- |
| `ROUTER_BASE` | React Router `basename` |
| `asset(path)` | files in `public/` |
| `appUrl(path)` | absolute links for QR codes and copy buttons |

`vite.config.js` reads `base` from `VITE_BASE` (default `/`), and
`scripts/build-gh.mjs` derives that value from **`package.json` "homepage"**.
Never hardcode a leading slash for an asset or a shared link — it will 404 on
Pages.

### Renaming the repository

A GitHub project site is served from `/<repo-name>/`, so the base path has to
follow the repo name. Because it's derived, renaming takes one edit:

1. Rename the repo in GitHub → Settings.
2. Update `homepage` in `package.json` to the new URL.
3. `git remote set-url origin <new URL>` (GitHub redirects the old one, but
   don't rely on it).
4. `npm run deploy` — the new base is picked up automatically.

The Firebase deployment is unaffected: it serves from the domain root and its
project id (`artistline-v1`) is independent of the repo name.

**QR codes already in the wild:** codes are generated at runtime from the
current origin, so newly rendered ones are always correct — but anything
**already printed** with the old Pages URL stops working. Reprint table signs
after a rename, or point clients at the Firebase URL, which doesn't change.

### Firebase Hosting

```bash
npm run build
firebase deploy
```

### GitHub Pages

```bash
npm run deploy
```

This derives the base from `homepage`, builds, and copies `index.html` to `404.html`,
which is how Pages serves an SPA's deep links. Those URLs return HTTP 404 with
the app in the body — browsers render it fine.

---

## Known issues and gotchas

**Firestore rules are permissive.** `customers` allows public `read` and
`update`, and `queues` allows public `update`. Anyone who can guess a document
path can read every client's name and phone number, or alter a line's counters.
The client side needs unauthenticated writes to work as it does today, so
tightening this properly means scoping the rules per field (or moving writes
behind Cloud Functions). Worth doing before real events — this app collects
children's names and parents' phone numbers.

**`npm run deploy` can't authenticate on some machines.** The `gh-pages`
package shells out to `git` from its own cache directory, which doesn't inherit
a repo-scoped credential helper, and fails with `RPC failed; HTTP 400`. A GitHub
Actions workflow is the durable fix.

**Notifications don't send.** `resendNotification` writes a `notifications`
document; no provider consumes it. The client's live page is the actual
notification mechanism.

**Denormalized counters drift.** `queue.waitingCount` / `totalServed` are only
recomputed while a manage page is open, and `event.queueCount` is never
incremented at all. Read them with suspicion; prefer deriving from `customers`.

**The service worker caches nothing** — on purpose. Every screen shows live
queue state, and a stale cached bundle would show an artist an out-of-date line.
It exists so Chrome offers "Install app".

**One large JS chunk** (~730 kB, ~220 kB gzipped). Firebase dominates it.
Route-level `React.lazy` would be the first thing to try.

**WebP with no fallback** for the mascot, which needs iOS Safari 14+.

**Pre-existing lint errors** in `AuthContext.jsx` (Fast Refresh) and
`DisplayScreen.jsx` (`setState` in an effect).
