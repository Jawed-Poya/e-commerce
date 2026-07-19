export interface DashboardKpis {
    totalProducts: number;
    activeProducts: number;
    totalProductViews: number;
    totalCustomers: number;
    totalOrders: number;
    pendingOrders: number;
    pendingPayments: number;
    paidRevenue: number;
    revenueLast30Days: number;
    notificationsLast24Hours: number;
    realtimeConnections: number;
    currency: string;
}

export interface InventoryHealthSummary {
    healthyProducts: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
}

export interface DashboardStatusCount {
    status: string;
    count: number;
}

export interface SalesTrendPoint {
    date: string;
    orders: number;
    revenue: number;
}

export interface TopProductItem {
    productId: number;
    name: string;
    imageUrl: string | null;
    viewCount: number;
    quantitySold: number;
    revenue: number;
}

export interface LowStockItem {
    productId: number;
    name: string;
    imageUrl: string | null;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minimumQuantity: number;
}

export interface RecentOrderItem {
    id: number;
    orderNumber: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    total: number;
    currency: string;
    createdAt: string;
}

export interface AdminDashboardResponse {
    kpis: DashboardKpis;
    inventory: InventoryHealthSummary;
    orderStatuses: DashboardStatusCount[];
    salesTrend: SalesTrendPoint[];
    topViewedProducts: TopProductItem[];
    topSellingProducts: TopProductItem[];
    lowStockProducts: LowStockItem[];
    recentOrders: RecentOrderItem[];
    generatedAt: string;
}
