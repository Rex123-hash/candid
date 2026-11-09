# Candid: one-page spec

**One line:** Checkout for farm stands and honesty boxes with nobody at the till. Snap what you take, pay with PayPal or Venmo, go.

**For:** a small seller with an unstaffed stand (farm stand, honesty box, campus or office snack shelf) and the passer-by with a phone.

## The four moments

1. **Setup (owner).** Photograph the price sign. AI reads the items and prices into a draft catalog. The owner edits and confirms. Candid creates a PayPal catalog product for each item and shows a printable QR sign.
2. **Checkout (customer).** Scan the QR code, then photograph the basket. AI matches what it sees against *this stand's catalog only* and fills in a list. The customer corrects quantities and pays with PayPal or Venmo (PayPal JS SDK v6). The server works out the amount from catalog prices. The browser never sends a price.
3. **Closing check (owner).** Take a shelf photo at opening and another at closing. AI counts each item. Candid compares what left the shelf with what was paid today and shows the gap per item. This is a number for the owner, never an accusation. No customer photos are stored.
4. **Co-op payout (owner, stretch).** Items belong to growers. One PayPal Payouts batch sends each grower their share of today's captured sales.

## Non-negotiables

- **PayPal sandbox only.** The app refuses to start payments if any non-sandbox host or `PAYPAL_ENV` other than `sandbox` is configured.
- **Amounts come from the server.** Integer cents everywhere; the PayPal amount is derived from catalog prices × validated quantities.
- **Capture safety.** Capture is idempotent per order: there is one `PayPal-Request-Id` per sale, and a captured sale is never captured again. A sale is marked paid only after PayPal returns `COMPLETED`. The webhook only confirms events whose signature PayPal has verified.
- **The AI only proposes.** AI output fills in a form; a person always confirms before money moves. When the AI fails or refuses, the user gets the manual list instead.
- **Accessibility.** WCAG 2.2 AA target: works with the keyboard alone, visible focus, labelled controls, live-region status updates, status shown with text as well as colour, honours reduced motion, usable at 320 px.

## Stack

Next.js (App Router, TypeScript) on Node · `@paypal/paypal-server-sdk` for OAuth and orders (an APIMatic-generated SDK) · the PayPal REST API for Catalog Products, Payouts and webhook verification · PayPal JS SDK v6 in the browser · Google Gemini on Vertex AI (`@google/genai`, JSON-schema output, vision) · AG Grid Community for the owner's sales table · a file-based JSON store locally, with Upstash Redis when its env vars are set · Vitest for tests.

## Out of scope

Real money, user accounts or login (owners get a private dashboard link), inventory forecasting, hardware, stored customer images.

## Cut order if late

Owner assistant → co-op payouts → photo setup (enter the catalog by hand). The customer checkout and the closing check are never cut.
