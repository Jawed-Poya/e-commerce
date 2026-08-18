import apiClient, { type ApiResponse } from "@/api/api-client";
import { getOfflineOwnerKey } from "@/features/offline/offline-owner";
import { postQueueable } from "@/features/offline/offline-queue";
import {
  isOfflineNetworkError,
  mergeReferenceItems,
  readCachedValue,
  readReferenceItems,
  writeCachedValue,
} from "@/features/offline/offline-reference-cache";
import type { CreateJournalVoucher, DocumentPayment, Expense, ExpenseCategory, JournalAccountBalance, JournalVoucher, ManualSale, ManualSaleLotMovement, OperationCustomer, OperationPolicy, OperationProduct, OperationSummary, PagedResult, Purchase, PurchaseDetails, QuickCreateProduct, SalaryPayment, Staff, Supplier, SupplierLedger } from "./operations-types";

const base = "/admin/operations";

function cacheScope() {
  return getOfflineOwnerKey() ?? "signed-out";
}

const cacheKey = (name: string) => `operations:${cacheScope()}:${name}`;
const normalize = (value: string) => value.trim().toLocaleLowerCase();

async function cachedLookup<T extends { id: number }>(
  name: string,
  search: string,
  take: number,
  request: () => Promise<T[]>,
  matches: (item: T, clean: string) => boolean,
) {
  try {
    const items = await request();
    await mergeReferenceItems(cacheKey(name), items);
    return items;
  } catch (error) {
    if (!isOfflineNetworkError(error)) throw error;
    const clean = normalize(search);
    const cached = await readReferenceItems<T>(cacheKey(name));
    return cached.filter((item) => !clean || matches(item, clean)).slice(0, take);
  }
}


async function cachedDocumentPage<T extends { id: number }>(
  name: string,
  search: string,
  page: number,
  pageSize: number,
  request: () => Promise<ApiResponse<PagedResult<T>>>,
  matches: (item: T, clean: string) => boolean,
) {
  try {
    const response = await request();
    await mergeReferenceItems(cacheKey(name), response.data.items);
    return response;
  } catch (error) {
    if (!isOfflineNetworkError(error)) throw error;
    const clean = normalize(search);
    const filtered = (await readReferenceItems<T>(cacheKey(name))).filter(
      (item) => !clean || matches(item, clean),
    );
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset = (safePage - 1) * safePageSize;
    return {
      success: true,
      data: {
        items: filtered.slice(offset, offset + safePageSize),
        page: safePage,
        pageSize: safePageSize,
        totalCount: filtered.length,
        totalPages: Math.ceil(filtered.length / safePageSize),
        hasPreviousPage: safePage > 1,
        hasNextPage: offset + safePageSize < filtered.length,
      },
      message: "Offline cached records",
    };
  }
}

async function getPolicy() {
  try {
    const policy = (await apiClient.get<OperationPolicy>(`${base}/policy`)).data;
    await writeCachedValue(cacheKey("policy"), policy);
    return { success: true, data: policy, message: "" };
  } catch (error) {
    if (!isOfflineNetworkError(error)) throw error;
    const cached = await readCachedValue<OperationPolicy>(cacheKey("policy"));
    if (!cached) throw error;
    return { success: true, data: cached, message: "Offline operation policy" };
  }
}

async function getSuppliers(search = "", take = 50) {
  return cachedLookup(
    "suppliers",
    search,
    take,
    async () => (await apiClient.get<Supplier[]>(`${base}/suppliers`, { search: search || undefined, take })).data,
    (item, clean) => [item.name, item.contactPerson, item.phone, item.email, item.taxNumber].some((value) => normalize(value ?? "").includes(clean)),
  );
}

export const operationsService = {
  summary: () => apiClient.get<OperationSummary>(`${base}/summary`),
  policy: getPolicy,
  products: (search = "", take = 20, includeCurrentUnitCost = false) => cachedLookup(
    "products",
    search,
    take,
    async () => (await apiClient.get<OperationProduct[]>(`${base}/products`, {
      search: search || undefined,
      take,
      includeCurrentUnitCost: includeCurrentUnitCost || undefined,
    })).data,
    (item, clean) => [item.name, item.strength, item.genericName, item.formula, item.barcode, ...item.units.map((unit) => unit.barcode)].some((value) => normalize(value ?? "").includes(clean)),
  ),
  quickCreateProduct: (body: QuickCreateProduct) =>
    apiClient.post<OperationProduct>(`${base}/products/quick`, body),
  customers: (search = "", take = 20) => cachedLookup(
    "customers",
    search,
    take,
    async () => (await apiClient.get<OperationCustomer[]>(`${base}/customers`, { search: search || undefined, take })).data,
    (item, clean) => [item.name, item.phone, item.email, item.customerTypeName].some((value) => normalize(value ?? "").includes(clean)),
  ),
  suppliers: getSuppliers,
  suppliersResponse: async (search = "", take = 50) => ({ success: true, data: await getSuppliers(search, take), message: "" }),
  supplierPage: (search = "", page = 1, pageSize = 20) =>
    apiClient.get<PagedResult<Supplier>>(`${base}/suppliers/page`, { search: search || undefined, page, pageSize }),
  saveSupplier: (id: number | null, body: Omit<Supplier, "id" | "outstandingBalance">) => id ? apiClient.put<Supplier>(`${base}/suppliers/${id}`, body) : apiClient.post<Supplier>(`${base}/suppliers`, body),
  supplierLedger: (id: number) => apiClient.get<SupplierLedger>(`${base}/suppliers/${id}/ledger`),
  purchases: (search = "", page = 1, pageSize = 20) => cachedDocumentPage(
    "purchases",
    search,
    page,
    pageSize,
    () => apiClient.get<PagedResult<Purchase>>(`${base}/purchases`, { search: search || undefined, page, pageSize }),
    (item, clean) => [item.purchaseNumber, item.referenceNumber, item.supplierName].some((value) => normalize(value ?? "").includes(clean)),
  ),
  purchase: (id: number) => apiClient.get<PurchaseDetails>(`${base}/purchases/${id}`),
  createPurchase: (body: Record<string, unknown>) => postQueueable<Purchase>(`${base}/purchases`, body, "Purchase"),
  purchasePayments: (id: number) => apiClient.get<DocumentPayment[]>(`${base}/purchases/${id}/payments`),
  addPurchasePayment: (id: number, body: unknown) => apiClient.post<Purchase>(`${base}/purchases/${id}/payments`, body),
  sales: (search = "", page = 1, pageSize = 20) => cachedDocumentPage(
    "sales",
    search,
    page,
    pageSize,
    () => apiClient.get<PagedResult<ManualSale>>(`${base}/sales`, { search: search || undefined, page, pageSize }),
    (item, clean) => [item.saleNumber, item.referenceNumber, item.customerName].some((value) => normalize(value ?? "").includes(clean)),
  ),
  createSale: (body: Record<string, unknown>) => postQueueable<ManualSale>(`${base}/sales`, body, "Manual sale"),
  saleLots: (id: number) => apiClient.get<ManualSaleLotMovement[]>(`${base}/sales/${id}/lots`),
  salePayments: (id: number) => apiClient.get<DocumentPayment[]>(`${base}/sales/${id}/payments`),
  addSalePayment: (id: number, body: unknown) => apiClient.post<ManualSale>(`${base}/sales/${id}/payments`, body),
  staff: () => apiClient.get<Staff[]>(`${base}/staff`),
  staffPage: (search = "", page = 1, pageSize = 20) => apiClient.get<PagedResult<Staff>>(`${base}/staff/page`, { search: search || undefined, page, pageSize }),
  saveStaff: (id: number | null, body: Omit<Staff, "id" | "isSystemUser">) => id ? apiClient.put<Staff>(`${base}/staff/${id}`, body) : apiClient.post<Staff>(`${base}/staff`, body),
  deleteStaff: (id: number) => apiClient.delete<void>(`${base}/staff/${id}`),
  salaries: (page = 1, pageSize = 20) => apiClient.get<PagedResult<SalaryPayment>>(`${base}/salaries`, { page, pageSize }),
  createSalary: (body: unknown) => apiClient.post<SalaryPayment>(`${base}/salaries`, body),
  salaryPayments: (id: number) => apiClient.get<DocumentPayment[]>(`${base}/salaries/${id}/payments`),
  addSalaryPayment: (id: number, body: unknown) => apiClient.post<SalaryPayment>(`${base}/salaries/${id}/payments`, body),
  expenseCategories: () => apiClient.get<ExpenseCategory[]>(`${base}/expense-categories`),
  saveExpenseCategory: (id: number | null, body: Omit<ExpenseCategory, "id">) => id ? apiClient.put<ExpenseCategory>(`${base}/expense-categories/${id}`, body) : apiClient.post<ExpenseCategory>(`${base}/expense-categories`, body),
  expenses: (page = 1, pageSize = 20) => apiClient.get<PagedResult<Expense>>(`${base}/expenses`, { page, pageSize }),
  createExpense: (body: unknown) => apiClient.post<Expense>(`${base}/expenses`, body),
  journalVouchers: (page = 1, pageSize = 20) => apiClient.get<PagedResult<JournalVoucher>>(`${base}/journal-vouchers`, { page, pageSize }),
  journalAccountBalances: () => apiClient.get<JournalAccountBalance[]>(`${base}/journal-vouchers/accounts`),
  createJournalVoucher: (body: CreateJournalVoucher) => apiClient.post<JournalVoucher>(`${base}/journal-vouchers`, body),
};

export async function warmOfflineOperationReferences() {
  if (!navigator.onLine) return;
  await Promise.allSettled([
    operationsService.policy(),
    operationsService.products("", 500),
    operationsService.suppliers("", 500),
    operationsService.customers("", 500),
    operationsService.purchases("", 1, 100),
    operationsService.sales("", 1, 100),
  ]);
}
