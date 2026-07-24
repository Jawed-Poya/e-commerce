import { Permissions } from "@/features/auth/permissions";
import type { PermissionGroup } from "@/features/users/user-types";
import type { TenantPlan } from "./tenant-types";

const free = new Set<string>([
    Permissions.DashboardView,
    Permissions.ProductsView,
    Permissions.ProductsManage,
    Permissions.InventoryView,
    Permissions.OrdersView,
    Permissions.OrdersManage,
    Permissions.CustomersView,
    Permissions.CustomersManage,
    Permissions.UsersView,
    Permissions.TenantProfileManage,
    Permissions.TenantSettingsManage,
    Permissions.TenantReportsView,
]);

const premium = new Set<string>([
    ...free,
    Permissions.ProductPricingManage,
    Permissions.InventoryManage,
    Permissions.PaymentsManage,
    Permissions.UsersManage,
    Permissions.RolesManage,
    Permissions.TenantBranchesManage,
    Permissions.TenantClaimsManage,
    Permissions.TenantTrashManage,
    Permissions.SystemManage,
]);

export function tenantPlanPermissions(plan: TenantPlan) {
    if (plan === "Free") return free;
    if (plan === "Premium") return premium;
    return new Set(
        Object.values(Permissions).filter(
            (permission) => permission !== Permissions.PlatformTenantsManage,
        ),
    );
}

export function permissionGroupsForPlan(
    groups: PermissionGroup[],
    plan: TenantPlan,
) {
    const allowed = tenantPlanPermissions(plan);
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => allowed.has(item.value)),
        }))
        .filter((group) => group.items.length > 0);
}
