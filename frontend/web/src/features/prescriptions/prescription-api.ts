import { apiPostForm } from "../../shared/api/api-client";

export interface PrescriptionRequestCreated {
    id: number;
    requestNumber: string;
    status: "Pending" | "Reviewing" | "Contacted" | "Completed" | "Rejected";
    createdAt: string;
}

export interface CreatePrescriptionRequestInput {
    fullName: string;
    phone: string;
    email?: string;
    notes?: string;
    attachment: File;
}

export function createPrescriptionRequest(input: CreatePrescriptionRequestInput) {
    const form = new FormData();
    form.append("fullName", input.fullName.trim());
    form.append("phone", input.phone.trim());
    if (input.email?.trim()) form.append("email", input.email.trim());
    if (input.notes?.trim()) form.append("notes", input.notes.trim());
    form.append("attachment", input.attachment, input.attachment.name);
    return apiPostForm<PrescriptionRequestCreated>("/prescription-requests", form);
}
