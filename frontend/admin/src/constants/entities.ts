export const Entities = {
    Product: "product",
    ProductCategory: "product-category",
    ProductBrand: "product-brand",
    ProductUnit: "product-unit",

    GeneralType: "general-type",

    Order: "order",
    OrderItem: "order-item",

    Customer: "customer",
    CustomerType: "customer-type",

    User: "user",
    Role: "role",
    Permission: "permission",

    Notification: "notification",

    Setting: "setting",

    ActivityLog: "activity-log",

    Inventory: "inventory",
    InventoryTransaction: "inventory-transaction",
} as const;

export type EntityName = (typeof Entities)[keyof typeof Entities];
