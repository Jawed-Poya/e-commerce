# E-Commerce System

A complete e-commerce system for managing and selling products online.

It includes a customer storefront and an administration panel for products, categories, inventory, pricing, customers, orders, purchasing, sales, reports, company settings, users, roles, and permissions.

The project uses React and TypeScript for the storefront and admin applications, ASP.NET Core for the backend API, and SQL Server for data storage.

## Google sign-in deployment

Google sign-in uses the backend `GoogleAuth:ClientId` as its single source of truth. For every deployed storefront:

1. Serve the storefront over HTTPS. Google only permits plain HTTP for localhost development.
2. In Google Cloud Console, add the exact storefront origin, such as `https://ecommerce.awsaan.com`, to the OAuth web client's authorized JavaScript origins. Origins include the scheme and port but no path.
3. Configure the same OAuth client ID in the server's `GoogleAuth__ClientId` environment variable.
4. If the API is hosted on a different origin, add the storefront origin to `Cors__AllowedOrigins` on the backend.
5. While the OAuth consent screen is in testing mode, add every allowed account as a test user. Publish the consent screen when sign-in should be available to all customers.

Changing the Google account used to create the OAuth client does not authorize other computers or customer accounts by itself; deployment origin and consent-screen access are configured separately.
