import type { DocumentItem } from "./operations-types";

export type DocumentLineState = "empty" | "incomplete" | "ready";

export function createEmptyDocumentItem(): DocumentItem {
    return {
        productId: 0,
        product: null,
        unitId: null,
        unitName: null,
        conversionFactor: 1,
        quantity: 1,
        amount: 0,
        bonusQuantity: 0,
        discountPercent: 0,
        lotNumber: "",
        expireDate: null,
    };
}

export function isDocumentLineEmpty(item: DocumentItem) {
    return (
        item.productId <= 0 &&
        !item.product &&
        item.unitId == null &&
        item.quantity === 1 &&
        item.amount === 0 &&
        item.bonusQuantity === 0 &&
        item.discountPercent === 0 &&
        !(item.lotNumber ?? "").trim() &&
        !item.expireDate
    );
}

export function isDocumentLineComplete(item: DocumentItem) {
    return (
        item.productId > 0 &&
        item.product != null &&
        Number.isFinite(item.conversionFactor) &&
        item.conversionFactor > 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(item.amount) &&
        item.amount >= 0
        && item.bonusQuantity >= 0
        && item.discountPercent >= 0 && item.discountPercent <= 100
    );
}

export function getDocumentLineState(item: DocumentItem): DocumentLineState {
    if (isDocumentLineEmpty(item)) return "empty";
    return isDocumentLineComplete(item) ? "ready" : "incomplete";
}

export function getSubmittableDocumentLines(items: DocumentItem[]) {
    return items.filter((item) => !isDocumentLineEmpty(item));
}
