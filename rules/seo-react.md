---
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/index.html"
---

# SEO for React SPA (Client-Side Rendered)

## Structured Data (JSON-LD)

- **Never hardcode JSON-LD in `index.html`** — In SPAs, static JSON-LD applies to every route. Render via React components per page instead.
- Render `<script type="application/ld+json">` using a `JsonLd` component with `dangerouslySetInnerHTML`.
- **Sanitize output**: `JSON.stringify(data).replace(/<\/script/gi, '<\\/script')` to prevent XSS.
- Schema types must only appear on their relevant pages:
  - `Product` → product detail pages only
  - `FAQPage` → FAQ page only
  - `ItemList` → catalog/listing pages only
  - `Organization` → all pages (OK to repeat)
- **Use real API data** for prices, availability, SKU, ratings. Never hardcode or fake values.
- `aggregateRating.reviewCount` must match actual visible reviews. If < 5 real reviews, consider omitting.

## Per-Page Meta Tags (React 19)

- React 19 natively hoists `<title>`, `<meta>`, and `<link>` tags to `<head>` — **no `react-helmet` needed**.
- Every public page must have unique:
  - `<title>` — Page-specific, under 60 chars, brand at end (e.g., `"Product Name | Brand"`)
  - `<meta name="description">` — Unique per page, 120-160 chars
  - `<link rel="canonical">` — Full URL with path
  - OG tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
  - Twitter Card tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)
- Use a shared `PageHead` component for consistency.
- Keep `index.html` minimal: only charset, viewport, favicons, theme-color, analytics scripts. No description, OG, or title tags — React manages those.

## Shared Constants

- Define `BASE_URL` (e.g., `https://fairybookstore.com`) in one place and import everywhere.
- Never duplicate domain strings across files.

## Sitemap

- Static `sitemap.xml` files miss dynamic pages (products, blog posts). Use a server-side dynamic endpoint.
- Include `hreflang` alternates for multilingual pages.
- Cache sitemap responses with TTL (e.g., 1 hour) to avoid excessive backend calls.
- Fall back to static pages if the backend service is unavailable.

## Reference Implementation (Fairy Book Gateway)

| Component | Path | Purpose |
|-----------|------|---------|
| `JsonLd` | `components/seo/JsonLd.tsx` | JSON-LD injection with XSS protection |
| Schema builders | `components/seo/schemas.ts` | Organization, WebSite, Product, FAQ, Breadcrumb, ItemList |
| `PageHead` | `components/seo/PageHead.tsx` | Per-page title, description, canonical, OG/Twitter |
| `SitemapResource` | `web/rest/SitemapResource.java` | Dynamic sitemap with product URLs |
| `SeoConfigResource` | `web/rest/SeoConfigResource.java` | Noindex for non-production environments |
