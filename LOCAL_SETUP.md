# Local setup and recovery

The repository uses the public npm registry. Run installs from each frontend folder:

```powershell
cd frontend/admin
npm ci

cd ../web
npm ci
```

## Windows `EPERM` while removing `node_modules`

`EPERM` means Windows still has a file handle open. It is not a package-version error.

1. Stop every running Vite, npm, Node.js, and test process for the project.
2. Close terminals and Explorer windows currently opened inside `node_modules`.
3. Run the recovery command from the affected frontend:

```powershell
npm run reinstall
```

When another Node process still holds the directory, close it first. As a last resort:

```powershell
taskkill /F /IM node.exe
npm run reinstall
```

The committed lockfiles contain only `https://registry.npmjs.org/` package URLs; they do not depend on an internal build registry.

## Admin permission repair

The built-in `Admin` role always resolves to every application permission. After updating an older database:

1. Restart the backend so startup repair runs.
2. Sign out of the admin frontend.
3. Clear any old session if needed:

```js
localStorage.removeItem("easycart-admin-token");
localStorage.removeItem("easycart-admin-session");
```

4. Sign in again with the configured seed administrator.

The new JWT and `/api/auth/me` response will contain the complete permission set for the `Admin` role, even if old `AspNetRoleClaims` rows were missing.
