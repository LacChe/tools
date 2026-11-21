# Conventions

1. **App id.** Every tool has one id, used in `tools.json`, the folder name `tools/<id>/`, the database prefix and the `data-app` attribute. Non-tool pages use `hub` (index) and `login`.
2. **Database naming.** All tables, functions, policies and constraints are `snake_case` and start with the app id: `<id>_<thing>`. Shared infrastructure starts with `hub_`. Examples: `exercise_items`, `expenses_entries`, `hub_app_access`.
   - Policies: `<table>_<purpose>`. Unique constraints: `<table>_<columns>_key`.
   - Text shown to users has a language suffix: `label_en`, later `label_zh`.
   - Small lookup lists (categories, currencies) are tables with a text key, `label_en` and `sort_order`.
3. **Access is per app, and is data.** Table `hub_app_access (user_id, app_id)` says who may use which app. Row-level security on every app table calls `public.hub_has_access('<id>')`. Never put user ids in policies.
4. **Row-level security is mandatory** on every table. Only the publishable Supabase key ships in the browser.
5. **CSS uses variables only.** No hex, `rgb()` or `rgba()` outside the `:root` token block in `base.css`. For translucent colors use `color-mix(in srgb, var(--token) N%, transparent)`.
6. **Load order on every page:** `base.css`, then `theme.css`, then the app's own `style.css`.
7. **Every page sets `<html data-app="<id>">`.** This lets `theme.css` restyle one app: `:root[data-app="expenses"] { --accent: ...; }`.
8. **Shared UI pieces live in `base.css`.** An app's own stylesheet holds only what is specific to that app.
9. **Icons** are single SVG files with no hex colors. Strokes use classes `c1` (accent) and `c2` (accent-2). The hub inlines them so they follow the theme.
10. **User-supplied text** is inserted with `textContent`, never `innerHTML`.
