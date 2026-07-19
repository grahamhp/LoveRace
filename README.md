# LoveRace: A probability study of human connection

A dependency-free interactive prototype that estimates a potential partner pool and translates weekly encounters into 20%, 50%, and 80% probability timelines.

## Run locally

From this folder, start any static web server. For example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

The app requests current population, country population, and GDP-per-capita data from the World Bank API. Documented fallback values keep the experience working if the API is unavailable.

## Modeling note

This is a transparent exploratory model, not a prediction of any individual outcome. Survey coverage differs by country; several preferences use adjustable broad proxies; and filters are treated as independent even when real demographic characteristics overlap. See the in-product methodology panel for the exact equation, sources, and limitations.
