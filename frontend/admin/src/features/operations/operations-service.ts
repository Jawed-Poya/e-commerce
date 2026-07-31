import apiClient from "@/api/api-client";
import { postQueueable } from "@/features/offline/offline-queue";
import type { DocumentPayment, Expense, ExpenseCategory, ManualSale, OperationCustomer, OperationProduct, OperationSummary, Purchase, SalaryPayment, Staff, Supplier } from "./operations-types";

const base = "/admin/operations";
export const operationsService = {
  summary: () => apiClient.get<OperationSummary>(`${base}/summary`),
  products: async (search = "", take = 20) => (await apiClient.get<OperationProduct[]>(`${base}/products`, { search: search || undefined, take })).data,
  customers: async (search = "", take = 20) => (await apiClient.get<OperationCustomer[]>(`${base}/customers`, { search: search || undefined, take })).data,
  suppliers: async (search = "", take = 50) => (await apiClient.get<Supplier[]>(`${base}/suppliers`, { search: search || undefined, take })).data,
  suppliersResponse: (search = "", take = 50) => apiClient.get<Supplier[]>(`${base}/suppliers`, { search: search || undefined, take }),
  saveSupplier: (id: number | null, body: Omit<Supplier, "id">) => id ? apiClient.put<Supplier>(`${base}/suppliers/${id}`, body) : apiClient.post<Supplier>(`${base}/suppliers`, body),
  purchases: (search = "") => apiClient.get<Purchase[]>(`${base}/purchases`, { search: search || undefined }),
  createPurchase: (body: Record<string, unknown>) => postQueueable<Purchase>(`${base}/purchases`, body, "Purchase"),
  purchasePayments: (id: number) => apiClient.get<DocumentPayment[]>(`${base}/purchases/${id}/payments`),
  addPurchasePayment: (id: number, body: unknown) => apiClient.post<Purchase>(`${base}/purchases/${id}/payments`, body),
  sales: (search = "") => apiClient.get<ManualSale[]>(`${base}/sales`, { search: search || undefined }),
  createSale: (body: Record<string, unknown>) => postQueueable<ManualSale>(`${base}/sales`, body, "Manual sale"),
  salePayments: (id: number) => apiClient.get<DocumentPayment[]>(`${base}/sales/${id}/payments`),
  addSalePayment: (id: number, body: unknown) => apiClient.post<ManualSale>(`${base}/sales/${id}/payments`, body),
  staff: () => apiClient.get<Staff[]>(`${base}/staff`),
  saveStaff: (id: number | null, body: Omit<Staff, "id">) => id ? apiClient.put<Staff>(`${base}/staff/${id}`, body) : apiClient.post<Staff>(`${base}/staff`, body),
  deleteStaff: (id: number) => apiClient.delete<void>(`${base}/staff/${id}`),
  salaries: () => apiClient.get<SalaryPayment[]>(`${base}/salaries`),
  createSalary: (body: unknown) => apiClient.post<SalaryPayment>(`${base}/salaries`, body),
  salaryPayments: (id: number) => apiClient.get<DocumentPayment[]>(`${base}/salaries/${id}/payments`),
  addSalaryPayment: (id: number, body: unknown) => apiClient.post<SalaryPayment>(`${base}/salaries/${id}/payments`, body),
  expenseCategories: () => apiClient.get<ExpenseCategory[]>(`${base}/expense-categories`),
  saveExpenseCategory: (id: number | null, body: Omit<ExpenseCategory, "id">) => id ? apiClient.put<ExpenseCategory>(`${base}/expense-categories/${id}`, body) : apiClient.post<ExpenseCategory>(`${base}/expense-categories`, body),
  expenses: () => apiClient.get<Expense[]>(`${base}/expenses`),
  createExpense: (body: unknown) => apiClient.post<Expense>(`${base}/expenses`, body),
};
