import { create } from "zustand";

export type ModalMode = "create" | "edit" | "view" | "delete";

export interface ModalItem<T = unknown> {
    isOpen: boolean;

    mode: ModalMode;

    data?: T;
}

interface ModalStore {
    modals: Record<string, ModalItem<unknown>>;

    open<T>(name: string, mode: ModalMode, data?: T): void;

    close(name: string, mode: ModalMode): void;

    isOpen(name: string, mode: ModalMode): boolean;

    get<T>(name: string, mode: ModalMode): ModalItem<T> | undefined;

    closeAll(): void;
}

export const useModalStore = create<ModalStore>((set, get) => ({
    modals: {},

    open: (name, mode, data) =>
        set((state) => ({
            modals: {
                ...state.modals,

                [`${name}-${mode}`]: {
                    isOpen: true,
                    mode,
                    data,
                },
            },
        })),

    close: (name, mode) =>
        set((state) => {
            const key = `${name}-${mode}`;

            const modal = state.modals[key];

            if (!modal) {
                return state;
            }

            return {
                modals: {
                    ...state.modals,

                    [key]: {
                        ...modal,
                        isOpen: false,
                    },
                },
            };
        }),

    isOpen: (name, mode) => get().modals[`${name}-${mode}`]?.isOpen ?? false,

    get: <T>(name: string, mode: ModalMode): ModalItem<T> | undefined => {
        return get().modals[`${name}-${mode}`] as ModalItem<T> | undefined;
    },

    closeAll: () =>
        set({
            modals: {},
        }),
}));
