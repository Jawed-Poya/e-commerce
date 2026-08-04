# E-Commerce Application

This installation is designed for **one company** with optional branches. Tenant selection, tenant-scoped roles, hosted subscription tables, and tenant filters are removed by migration `20260803223000_ConvertToSingleCompanyAndAddAccountVerification`.

## Upgrade safely

1. Back up the SQL Server database.
2. Configure production secrets through environment variables, user secrets, or your deployment secret store. Do not commit them to `appsettings.json`.
3. Start the backend once so EF Core applies pending migrations.
4. Confirm that the company profile, main branch, warehouse, aggregate inventory, and generated inventory lots reconcile correctly.

The single-company conversion is intentionally destructive for old tenant/subscription metadata and cannot be automatically rolled back.

## Google sign-in

Create a Google OAuth 2.0 **Web application** client and use the same client ID in both applications:

- Backend: `GoogleAuth__ClientId`
- Storefront: `VITE_GOOGLE_CLIENT_ID` in `frontend/web/.env.local`

Add every storefront origin used in production or development to the Google client's authorized JavaScript origins. The storefront sends the Google credential to the backend, and the backend validates it for the configured client ID before signing the customer in.

Example storefront environment:

```env
VITE_API_BASE_URL=https://api.example.com/api
VITE_GOOGLE_CLIENT_ID=000000000000-example.apps.googleusercontent.com
```

## Email and phone verification

Checkout requires an authenticated customer with at least one confirmed contact. The contact included in the order must match either the confirmed account email or confirmed account phone number.

Configure a strong verification hash key:

```text
AccountVerification__HashKey=<at-least-32-random-bytes>
```

Email delivery uses SMTP:

```text
AccountVerification__Email__Host=smtp.example.com
AccountVerification__Email__Port=587
AccountVerification__Email__UserName=...
AccountVerification__Email__Password=...
AccountVerification__Email__FromEmail=no-reply@example.com
AccountVerification__Email__FromName=Store
AccountVerification__Email__EnableSsl=true
```

Phone delivery uses an HTTP webhook. The backend sends a JSON payload shaped as:

```json
{
  "to": "+93000000000",
  "message": "Your verification code is 123456."
}
```

Configure it with:

```text
AccountVerification__Sms__WebhookUrl=https://sms-provider.example.com/send
AccountVerification__Sms__BearerToken=...
```

The repository intentionally contains no real SMTP or SMS credentials. Configure them through environment variables, user secrets, IIS environment variables, or your deployment secret store. Empty values in `appsettings.json` do not send email or SMS.

When the backend runs in Development and a provider is completely unconfigured, the API returns a development-only code and writes the same code to the backend log. The storefront fills that code into the confirmation field so the verification flow can still be tested locally. A partially configured SMTP provider returns a precise configuration error instead of pretending the message was sent. Production never returns verification codes and refuses to dispatch until the selected provider and hash key are configured.

For a local shell, set the values before starting the backend:

```text
AccountVerification__HashKey=<at-least-32-random-bytes>
AccountVerification__Email__Host=<smtp-host>
AccountVerification__Email__Port=587
AccountVerification__Email__UserName=<smtp-user>
AccountVerification__Email__Password=<smtp-password-or-app-password>
AccountVerification__Email__FromEmail=<verified-sender-address>
AccountVerification__Email__FromName=Store
AccountVerification__Email__EnableSsl=true
```

The SMS endpoint is a provider adapter, not a built-in SMS gateway. Your configured URL must accept the documented `{ to, message }` JSON payload and return a successful HTTP status. Providers with a different request format need a small provider-specific adapter.

## Expiry alert periods

Company Settings supports up to 12 alert stages between 0 and 365 days before expiry. Day `0` is always included. A lot can therefore produce new staged alerts such as 90, 30, 14, 7, 3, 1, and 0 days before expiry. Each lot/date/stage is deduplicated.

## Local commands

```bash
# Backend
cd backend
dotnet restore
dotnet run

# Storefront
cd frontend/web
npm ci
npm run build

# Admin
cd frontend/admin
npm ci
npm run build
```
