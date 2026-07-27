# Final Stabilization Notes

## Request cancellation and SQL reads

ASP.NET Core normally binds controller `CancellationToken` parameters to
`HttpContext.RequestAborted`. That is useful for streaming, but it was unsafe for
this application because Axios navigation, query replacement, or a browser tab
closing could cancel an EF Core command while a receipt, report, company profile,
or authentication response was still being assembled.

The API now uses two layers of protection:

1. `StableCancellationTokenModelBinderProvider` gives normal MVC actions a stable
   token that is not tied to the browser connection. The notification event stream
   still uses `HttpContext.RequestAborted` explicitly because streaming should stop
   when the client disconnects.
2. `ServerOperation` creates server-owned read, write, and document scopes.
   Read-only receipt and reporting operations are additionally executed through
   `TransientSqlRetry`, which retries transient SQL timeouts, connection resets,
   and unexpected `TaskCanceledException` instances without retrying write
   transactions.

The SQL command timeout is 180 seconds. Admin API requests use a 240-second client
timeout, while PDF, Excel, and receipt downloads use 600 seconds.

## Company and profile saves

- Company profile and company settings buttons are explicit `type="submit"`
  buttons, which is required by the Base UI button primitive.
- Profile details and password changes use real form submission handlers.
- Save endpoints use server-owned write tokens and return the committed tracked
  model without a second request-abort-sensitive database reload.
- Email and phone uniqueness checks exclude the current user and run only when the
  normalized value changes.
- The company page now distinguishes loading, failed loading, and initialized form
  state, and provides a retry action instead of an endless spinner.

## Documents and receipts

- Company header queries and complete read-only receipt/report data loads use
  transient retry handling.
- A4 PDF, continuous 80 mm thermal PDF, and continuous PNG receipt output remain
  available.
- Operational PDFs remain available for products, sales, purchases, payroll, and
  expenses, plus financial reports and customer ledgers.

## Localization

- Admin API success/error messages are localized in the Axios response interceptor.
- Known messages use exact Dari and Pashto translations.
- Unknown server errors use a localized safe fallback rather than displaying an
  untranslated English exception.
- The admin literal dictionary contains matching Dari and Pashto key sets with no
  duplicate keys. The only untranslated scan results are the keyboard key `Ctrl`
  and the example URL `https://example.com/category.jpg`, which should not be
  translated.

## Verification

Run locally after extracting:

```bash
cd backend
dotnet restore
dotnet build
dotnet ef database update

cd ../frontend/admin
npm ci
npm run build

cd ../web
npm ci
npm run build
```

The delivery archive includes the original `.git` history and the final
stabilization commit.
