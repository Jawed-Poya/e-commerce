export const generalTypeKeys = {
    all: ["types"] as const,

    group: (group: string) => ["types", group] as const,

    detail: (id: number) => ["types", id] as const,
};
