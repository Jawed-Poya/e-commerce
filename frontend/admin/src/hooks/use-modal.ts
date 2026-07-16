import {
    useModalStore,
    type ModalItem,
    type ModalMode,
} from "@/stores/modal-store";

export function useModal<T = unknown>(name: string, mode: ModalMode) {
    const key = `${name}-${mode}`;

    const modal = useModalStore(
        (state) => state.modals[key] as ModalItem<T> | undefined,
    );

    const open = useModalStore((state) => state.open);

    const close = useModalStore((state) => state.close);

    return {
        open: (data?: T) => open(name, mode, data),

        close: () => close(name, mode),

        isOpen: modal?.isOpen ?? false,

        data: modal?.data,
    };
}
