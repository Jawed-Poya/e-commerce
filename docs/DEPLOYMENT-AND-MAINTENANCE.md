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

The admin maintenance page can replace current business data with a compact pharmacy demo: six products with lightweight SVG images, opening stock and lots, supplier and purchase, two customers, manual sale, storefront order, expense, and staff record.

For a controlled command-line deployment task, the same operation is available after normal database initialization:

```bash
dotnet ECommerce.dll --seed-demo
```

This operation permanently clears current business data first. Take and verify a backup before running it outside a disposable environment.

## Safe deletion rules

Products with stock or references from purchases, manual sales, storefront orders, inventory movements, or inventory lots cannot be moved to trash. Deactivate them instead. The same protection applies to referenced customers and reusable types. Financial documents cannot be permanently purged; use their cancel or reverse workflow so reports and audit history remain consistent. Trash cleanup also re-checks these rules before permanent deletion.
