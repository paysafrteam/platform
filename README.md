# PaySafr frontend

PaySafr is an escrow and invoicing experience for freelancers and online sellers in Nigeria. This repository is being built in phases, starting with the design-system foundation and then the buyer payment flow.

## Run locally

Requirements: Node.js LTS and npm. From this folder:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Useful scripts:

```bash
npm run lint
npm run typecheck
npm run build
npm run start
npm run format
```

## Current development routes

- `/` - PaySafr scaffold preview.
- `/dev/typography` - supplied font and missing-glyph specimen. Returns 404 in production.
- `/dev/components` - initial brand and component gallery. Returns 404 in production.

Buyer demo routes and scenario switcher are added in Phase 2.

## Folder map

- `src/app/` - Next.js App Router pages and global styles.
- `src/components/brand/` - shared logo, Paga attribution, brand pills and social labels.
- `src/components/ui/` - shadcn/ui primitives, restyled to the PaySafr tokens.
- `src/lib/` - typed domain rules, formatting, mock store and API adapters (built in later phases).
- `src/content/` - shared UI copy and reference content (built in later phases).
- `public/brand/` - cleaned, web-ready brand marks and visual references.
- `public/fonts/` - local prototype fonts.
- `design-assets/` - source materials extracted for reference. It is not in `public/` and is never served.

## Mocks and backend integration

The UI will use a typed API layer in `src/lib/api/`, with seeded mock data and scenario state in `src/lib/mocks/`. Screens will call the API layer rather than importing mock data or calling `fetch` themselves. The mock adapter will persist the interactive demo in `sessionStorage`.

The backend connection will be selected through `.env.local`:

```dotenv
NEXT_PUBLIC_USE_MOCKS=true
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SHOW_API_PLACEHOLDERS=true
NEXT_PUBLIC_FEE_RATE=0.02
NEXT_PUBLIC_SHOW_SOCIAL_PROOF=false
```

Copy `.env.example` to `.env.local` for local overrides. Use `NEXT_PUBLIC_USE_MOCKS=false` and provide the backend base URL to switch to the typed HTTP adapter once endpoints are ready. Paga credentials and other secrets must remain on the backend; they do not belong in this frontend.

The development scenario switcher will be available from the UI when the buyer flow is built. API placeholder tags will identify backend work still represented by mocks.

## Brand and type

Brand tokens live in `src/app/globals.css`: Dark Green `#112b00`, Light Green `#66ff00`, Dark Grey `#666666`, Light Grey `#cccccc`, White and Black. Danger and warning tones are isolated in their own tokens. The MVP uses the light theme only. shadcn/ui is initialized with the Radix and Lucide foundations; feature-specific primitives are added as those flows are implemented.

Halfre is used for display headings and the wordmark. Degular Demo is used for body text at regular, medium, semibold and bold weights. Both are local prototype assets. Degular Demo is marked Personal Use Only; obtain a commercial license before public launch. The font stacks use Inter as the fallback for glyphs absent from the demo font files. Money values use the `.money` class and tabular numerals.

`design-assets/` retains the source logo, font and visual reference materials. The small SVG marks in `public/brand/` are cleaned/cropped versions for web use. The live-text lockup is a prototype and should be compared with the supplied wordmark reference before launch.

## Share action handler wiring

`ShareActions` will expose `onWhatsApp`, `onInstagram`, `onDownload` and `onCopyLink` callbacks. Plug the template work in by passing the matching handler at each receipt or invoice placement. Until then, each visible action shows a “Coming soon” notice instead of silently doing nothing.

## Open decisions for handover

- Fee is currently configured at the prompt's provisional default of 2%; the final fee is still to be confirmed.
- Receipt and invoice artwork, Paga Engine attribution artwork, legal copy, live social links and approval of danger/warning colors remain external inputs.
- A full Degular commercial license is needed before commercial release.
