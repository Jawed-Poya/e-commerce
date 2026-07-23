import apiClient from "@/api/api-client";
import type { Expense, ExpenseCategory, ManualSale, OperationProduct, OperationSummary, Purchase, SalaryPayment, Staff, Supplier } from "./operations-types";

const base = "/admin/operations";
export const operationsService = {
  summary: () => apiClient.get<OperationSummary>(`${base}/summary`),
  products: () => apiClient.get<OperationProduct[]>(`${base}/products`),
  suppliers: () => apiClient.get<Supplier[]>(`${base}/suppliers`),
  saveSupplier: (id: number | null, body: Omit<Supplier, "id">) => id ? apiClient.put<Supplier>(`${base}/suppliers/${id}`, body) : apiClient.post<Supplier>(`${base}/suppliers`, body),
  purchases: () => apiClient.get<Purchase[]>(`${base}/purchases`),
  createPurchase: (body: unknown) => apiClient.post<Purchase>(`${base}/purchases`, body),
  sales: () => apiClient.get<ManualSale[]>(`${base}/sales`),
  createSale: (body: unknown) => apiClient.post<ManualSale>(`${base}/sales`, body),
  staff: () => apiClient.get<Staff[]>(`${base}/staff`),
  saveStaff: (id: number | null, body: Omit<Staff, "id">) => id ? apiClient.put<Staff>(`${base}/staff/${id}`, body) : apiClient.post<Staff>(`${base}/staff`, body),
  deleteStaff: (id: number) => apiClient.delete<void>(`${base}/staff/${id}`),
  salaries: () => apiClient.get<SalaryPayment[]>(`${base}/salaries`),
  createSalary: (body: unknown) => apiClient.post<SalaryPayment>(`${base}/salaries`, body),
  expenseCategories: () => apiClient.get<ExpenseCategory[]>(`${base}/expense-categories`),
  saveExpenseCategory: (id: number | null, body: Omit<ExpenseCategory, "id">) => id ? apiClient.put<ExpenseCategory>(`${base}/expense-categories/${id}`, body) : apiClient.post<ExpenseCategory>(`${base}/expense-categories`, body),
  expenses: () => apiClient.get<Expense[]>(`${base}/expenses`),
  createExpense: (body: unknown) => apiClient.post<Expense>(`${base}/expenses`, body),
};
