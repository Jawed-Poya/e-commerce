export type PaymentStatus = "Unpaid" | "Partial" | "Paid";
export interface OperationSummary { purchasesThisMonth: number; salesThisMonth: number; expensesThisMonth: number; salariesThisMonth: number; lowStockProducts: number }
export interface OperationProduct { id: number; name: string; barcode: string | null; availableQuantity: number; defaultPrice: number | null }
export interface OperationCustomer { id: number; name: string; phone: string; email: string | null; customerTypeName: string | null }
export interface Supplier { id: number; name: string; contactPerson: string | null; phone: string | null; email: string | null; address: string | null; taxNumber: string | null; isActive: boolean }
export interface Purchase { id: number; purchaseNumber: string; purchaseDate: string; supplierName: string | null; itemCount: number; total: number; paidAmount: number; remainingAmount: number; paymentStatus: PaymentStatus; status: "Draft" | "Received" | "Cancelled"; createdAt: string }
export interface ManualSale { id: number; saleNumber: string; saleDate: string; customerName: string; itemCount: number; total: number; paidAmount: number; remainingAmount: number; paymentStatus: PaymentStatus; createdAt: string }
export interface Staff { id: number; employeeNumber: string; fullName: string; phone: string | null; email: string | null; position: string | null; department: string | null; hireDate: string; baseSalary: number; isActive: boolean; address: string | null; notes: string | null }
export interface SalaryPayment { id: number; staffId: number; staffName: string; periodYear: number; periodMonth: number; baseSalary: number; bonus: number; deduction: number; netAmount: number; paidAmount: number; remainingAmount: number; paymentStatus: PaymentStatus; paidDate: string; paymentMethod: string; referenceNumber: string | null; createdAt: string }
export interface ExpenseCategory { id: number; name: string; description: string | null; isActive: boolean }
export interface Expense { id: number; expenseDate: string; categoryId: number; categoryName: string; amount: number; vendor: string | null; paymentMethod: string; referenceNumber: string | null; description: string; createdAt: string }
export interface DocumentPayment { id: number; amount: number; paymentDate: string; paymentMethod: string; referenceNumber: string | null; notes: string | null; createdAt: string }
export interface DocumentItem { productId: number; quantity: number; amount: number; lotNumber?: string; expireDate?: string | null; product?: OperationProduct | null }
