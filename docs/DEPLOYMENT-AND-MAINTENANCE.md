# Deployment and maintenance

## Portable upload storage

Uploaded product, type, company-brand, and storefront images use one configurable storage root. The default configuration is:

```json
"FileStorage": {
  "RootPath": "App_Data/uploads",
  "RequestPath": "/uploads",
  "MaximumImageSizeBytes": 5242880
}
```

`RootPath` can be absolute or relative to the published backend directory. For production, an absolute persistent path or mounted volume is recommended so a deployment cannot replace uploaded files.

- Windows/IIS example: `D:\\EasyCartData\\uploads`. Grant the application-pool identity **Modify** permission on this directory.
- Linux/systemd example: `/var/lib/easycart/uploads`. Make the directory writable by the service user, and mount it as persistent storage when using containers.
- Configure nested values with environment variables such as `FileStorage__RootPath` and `FileStorage__RequestPath`.

The API creates missing subdirectories, validates image signatures, generates safe names, stores platform-neutral URL paths, and serves the configured directory at `RequestPath`. Existing files under `wwwroot/uploads` remain readable for compatibility; move them to the configured root during a planned deployment when standardizing an older installation.

The configured upload directory is also exposed below `/api` (for example, `/api/uploads/...`). The storefront and admin clients use this API-prefixed route. This matters on Linux because Nginx deployments normally proxy `/api/` to ASP.NET Core while serving the React application at `/`; a root `/uploads/...` URL would otherwise be handled by the React host and return `404`.

### Linux upload and reverse-proxy setup

Create the persistent directory with the same user and group used by the ASP.NET Core service:

```bash
sudo install -d -m 0750 -o easycart -g easycart /var/lib/easycart/uploads
```

Set the production environment value on the API service:

```ini
Environment=FileStorage__RootPath=/var/lib/easycart/uploads
```

The frontend defaults to the same-origin API path `VITE_API_BASE_URL=/api`. If the API uses a different host, set a full **HTTPS** URL ending in `/api` during the frontend build. Never publish a build that points to `localhost` or plain HTTP: `localhost` means the visitor's own computer, and an HTTPS page will block HTTP images as mixed content.

Use an Nginx location that preserves the `/api` prefix. The `proxy_pass` value intentionally has no trailing slash:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5188;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

After deployment, verify one uploaded file directly at `https://your-domain.example/api/uploads/...`. A `404` usually means the proxy path or stored file is missing; a `403` or an upload failure usually means the service account cannot read/write the configured directory. Linux paths and filenames are case-sensitive, so do not rename an uploaded file or change the case of a stored path manually.

## SQL Server backup and restore

Database backup and restore are disabled until a SQL Server host path is configured:

```json
"DatabaseMaintenance": {
  "BackupDirectory": "D:\\SqlBackups\\EasyCart",
  "RestoreEnabled": false,
  "CommandTimeoutSeconds": 900
}
```

For SQL Server on Linux, a typical path is `/var/opt/mssql/backups/easycart`. `BackupDirectory` is interpreted by SQL Server, not the web server. The SQL Server service account must have read/write access. Keep `RestoreEnabled` false until backups have been created and independently tested. Backup creation uses full `COPY_ONLY` backups with checksums; restore first runs `RESTORE VERIFYONLY`, disconnects active sessions, restores the selected registered backup, and returns the database to multi-user mode.

The admin application exposes these functions under **Administration → Database maintenance**. Give each trusted operator only the permissions their role needs:

| Permission | Capability |
|---|---|
| `database-maintenance.view` | View maintenance status |
| `database.backup` | List and create full backups |
| `database.restore` | List and restore verified backups |
| `data.clear.branch` | Permanently clear one branch's business data |
| `data.clear.all` | Permanently clear all branches' business data |
| `data.seed.demo` | Load the professional demo data; also requires `data.clear.all` |

High-impact actions require an exact typed confirmation. Clearing business data preserves the company, settings, branches, users, roles, permissions, reusable types, and warehouses so administrators do not lose access. A database restore replaces the complete database.

## Professional demo reset

The admin maintenance page can replace current business data with a neutral professional demo: `Default Company` identity, dark-blue/orange branding, 20 illustrated products, an image for every category, opening stock and lots, 3 sample suppliers, 10 placeholder customers, 10 multi-item purchases, 10 multi-item sales, 5 storefront orders, expenses, and staff. Purchase `PUR-DEMO-…-001` contains all 20 product lines, and every purchase and sale includes a readable `BILL-PUR-…` or `BILL-SALE-…` reference.

For a controlled command-line deployment task, the same operation is available after normal database initialization:

```bash
dotnet ECommerce.dll --seed-demo
```

This operation permanently clears current business data first. Take and verify a backup before running it outside a disposable environment.

## Safe deletion rules

Products with stock or references from purchases, manual sales, storefront orders, inventory movements, or inventory lots cannot be moved to trash. Deactivate them instead. The same protection applies to referenced customers and reusable types. Financial documents cannot be permanently purged; use their cancel or reverse workflow so reports and audit history remain consistent. Trash cleanup also re-checks these rules before permanent deletion.
