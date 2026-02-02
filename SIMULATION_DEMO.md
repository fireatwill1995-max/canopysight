# Simulation / Demo Mode for Buyers

Simulation mode lets you show potential buyers how Canopy Sight works **without real cameras or edge devices**. It uses a mock camera feed and sample rail-safety alerts so the full app experience is visible.

## What It Does

- **Live view**: In simulation mode the app uses a **YouTube feed** ([video](https://www.youtube.com/watch?v=AgrYGFuW13g)) as the demo camera. Zones overlay still work; alerts and the rest of the app behave as usual.
- **Live alerts**: Injects sample alerts (advisory / warning / critical) so the alert feed looks active—e.g. “Person in exclusion zone”, “Vehicle approaching crossing”.
- **All other features**: Sites, zones, mesh, analytics, etc. work as normal; only the live feed and alert stream are simulated.

## How to Use

1. **Sign in** (e.g. use **Demo Login** on the sign-in page for quick testing).
2. Go to **Sites** and open any site (or create one).
3. Open the **Live Feed** tab.
4. Turn on **“Enable simulation mode”** in the **Demo / Simulation** card.
5. The live view will show the demo video and the alert feed will start receiving mock alerts.

You can leave simulation on for the whole demo. Toggle it off to show “no stream” / real behaviour if you prefer.

## Train Station Demo Video (Recommended)

The simulation live view is intended to show **a train station with people walking past and trains going past on a usual busy day outdoors**. To get that scene:

1. Add an MP4 file to the web app’s public folder:
   - Path: `apps/web/public/demo-train-station.mp4`
2. Name it exactly: `demo-train-station.mp4`.
3. When simulation is on, the app uses this file first. If the file is missing, it falls back to a generic sample (not train-station specific).

**Where to get the video** (free): **Pexels** – search "train station people" or "train platform", pick a clip with people walking and/or trains, Free download, HD MP4, save as `demo-train-station.mp4` in `apps/web/public/`. **Pixabay** / **Videvo** – search "train station platform people", download MP4, save to `apps/web/public/demo-train-station.mp4`.

**Tips:** Content = train station or platform, people walking, trains passing – busy outdoor day. Length = short loop (10–30 s). Format = MP4 (H.264).

## Demo Flow Suggestion

1. Log in as demo user.
2. Open a site (create a “Demo Train Station” site if you like) and add 1–2 devices and a few zones so zone overlays appear on the simulated feed.
3. Go to **Live Feed** and enable **Simulation mode**.
4. Walk through: live view with zones, live alerts, then **Zones** tab (drawing/editing), **Mesh Network**, **Analytics**, etc.
5. Use the simulation toggle to compare “with demo feed” vs “no cameras” if useful.

## Technical Notes

- Simulation is **client-side only** (no API or DB changes).
- State is stored in `sessionStorage` (`canopy_simulation_mode` and demo mode). Refreshing keeps it; closing the tab or clearing storage resets it.
- Mock alerts use the current site (and optional device) so they match the page you’re viewing.
