export type PrescriptionRequestStatus =
    | "Pending"
    | "Reviewing"
    | "Contacted"
    | "Completed"
    | "Rejected";

export interface AdminPrescriptionRequest {
    id: number;
    requestNumber: string;
    fullName: string;
    phone: string;
    email: string | null;
    notes: string | null;
    originalFileName: string;
    contentType: string;
    fileSize: number;
    status: PrescriptionRequestStatus;
    adminNotes: string | null;
    createdAt: string;
    updatedAt: string | null;
}

export interface PagedPrescriptionRequests {
    items: AdminPrescriptionRequest[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
}
