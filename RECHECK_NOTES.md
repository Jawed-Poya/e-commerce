# Recheck Notes

## Corrected backend compilation issues

- Corrected the order payment enum reference in `FinancialDocumentService` to `API.Entities.Orders.PaymentStatus`.
- Reworked both QuestPDF page footers so text styling is configured inside the text callback. No fluent method is chained after the callback that returns `void`.
- Replaced every `Unit.Millimeter` reference in the document service with `Unit.Millimetre`.

## Additional frontend corrections

- Aligned the Admin `TrashItem` TypeScript interface with the backend `TrashItemResponse`, including `scheduledPurgeAt` and the non-null `deletedAt` field.
- Replaced iteration over `MutationRecord.addedNodes` with `NodeList.forEach`, avoiding a TypeScript dependency on the `DOM.Iterable` library.

## Validation performed

- Parsed all 205 Admin/Web TypeScript and TSX source files: no syntax errors.
- Resolved all 834 relative and `@/` local imports: no missing files.
- Compared the new company, report, ledger, worth, and trash TypeScript contracts with their ASP.NET Core response contracts: no field mismatches.
- Checked 181 C# files for balanced delimiters and all project-local type aliases: no structural or alias errors.
- Verified no remaining wrong `PaymentStatus` namespace, `Unit.Millimeter`, or QuestPDF callback-then-style chaining pattern.
- Validated project JSON, TSConfig JSONC, and CSS delimiter structure.

## Environment limitation

A complete `dotnet build` could not be run because the .NET SDK is not installed in the execution environment. A dependency-backed Vite build was also unavailable because the npm registry returned HTTP 503 while restoring packages. Run the normal backend and frontend build commands locally as the final deployment gate.
