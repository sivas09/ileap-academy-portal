# Shop Management

Phase 1 adds database-driven product management for the iLEAP Academy public Shop page.

## Add a Product

1. Log in to the iLEAP Academy portal as an Admin.
2. Open Admin, then use the Shop / Products form.
3. Fill in:
   - Title
   - Slug
   - Category
   - Short Description
   - Full Description
   - Price Label
   - Stripe Payment Link
   - Image URL
   - Badge
   - Rating Label
   - Status
   - Sort Order
4. Set Status to `PUBLISHED` when the product should appear on the public Shop page.
5. Save the product.

The public Shop page reads published products from `/api/products`.

## Stripe Payment Links

Phase 1 uses Stripe Payment Links only.

To create a Stripe Payment Link:

1. Open Stripe Dashboard.
2. Create or select a product and price.
3. Create a Payment Link for that price.
4. Copy the `https://buy.stripe.com/...` URL.
5. Paste it into the product's Stripe Payment Link field.
6. Save and publish the product.

If a product has a Stripe Payment Link, the public Shop page shows a Buy Now button that opens Stripe in a new tab.

If a product does not have a Stripe Payment Link, the public Shop page shows Coming Soon and Request Preview.

## Publish, Unpublish, Archive

- `DRAFT`: Product is saved in the admin portal but hidden from the public Shop page.
- `PUBLISHED`: Product appears on the public Shop page.
- `ARCHIVED`: Product is removed from the public Shop page and should no longer be edited for active sale.

Archiving is non-destructive so historical references are preserved.

## Phase 2 Scope

Phase 2 should include:

- Cart support, if iLEAP wants multi-product checkout.
- Stripe Checkout API integration for custom checkout sessions.
- Order records for public Shop purchases.
- Automatic digital file/PDF delivery.
- Email delivery workflow after payment.
- Admin upload and fulfillment controls.

Do not collect or store card data in the application. Use Stripe-hosted payment flows.
