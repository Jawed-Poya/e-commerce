using API.Entities.Orders;
using ECommerce.Entities.Orders;

namespace ECommerce.Entities.Orders.Contracts;

public sealed record CheckoutItemRequest(
    long ProductId,
    decimal Quantity
);

public sealed record CheckoutCustomerRequest(
    string FirstName,
    string? LastName,
    string Phone,
    string? Email
);

public sealed record CheckoutAddressRequest(
    string Label,
    string RecipientName,
    string Phone,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? State,
    string Country,
    string? PostalCode
);

public sealed record CreateCheckoutOrderRequest(
    CheckoutCustomerRequest Customer,
    CheckoutAddressRequest ShippingAddress,
    PaymentMethod PaymentMethod,
    string? BankTransferReference,
    string? Notes,
    IReadOnlyCollection<CheckoutItemRequest> Items
);

public sealed record PaymentOptionResponse(
    PaymentMethod Method,
    string Name,
    string Description,
    bool RequiresReference,
    BankTransferDetailsResponse? BankDetails
);

public sealed record BankTransferDetailsResponse(
    string BankName,
    string AccountName,
    string AccountNumber,
    string? Iban,
    string Instructions
);

public sealed record CheckoutConfigurationResponse(
    string Currency,
    bool ShippingEnabled,
    decimal FlatShippingFee,
    decimal FreeShippingThreshold,
    IReadOnlyCollection<PaymentOptionResponse> PaymentMethods
);

public sealed record OrderConfirmationResponse(
    long Id,
    string OrderNumber,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    PaymentMethod PaymentMethod,
    decimal Subtotal,
    decimal ShippingTotal,
    decimal Total,
    string Currency,
    DateTime CreatedAt,
    DateTime? ReservationExpiresAt,
    BankTransferDetailsResponse? BankDetails
);

public sealed record OrderListItemResponse(
    long Id,
    string OrderNumber,
    string CustomerName,
    string CustomerPhone,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    PaymentMethod PaymentMethod,
    decimal Total,
    string Currency,
    int ItemCount,
    DateTime CreatedAt
);

public sealed record OrderCustomerResponse(
    long Id,
    string Name,
    string Phone,
    string? Email,
    string? CustomerTypeName
);

public sealed record OrderAddressResponse(
    string Label,
    string RecipientName,
    string Phone,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string? State,
    string Country,
    string? PostalCode
);

public sealed record OrderItemResponse(
    long Id,
    long ProductId,
    string ProductName,
    string? ProductBarcode,
    decimal Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Tax,
    decimal Total,
    string Currency
);

public sealed record PaymentResponse(
    long Id,
    PaymentMethod Method,
    string Provider,
    string? ExternalReference,
    decimal Amount,
    string Currency,
    PaymentStatus Status,
    DateTime? PaidAt,
    string? FailureReason,
    DateTime CreatedAt
);

public sealed record OrderStatusHistoryResponse(
    long Id,
    OrderStatus FromStatus,
    OrderStatus ToStatus,
    string? Note,
    string? ChangedByUserId,
    DateTime CreatedAt
);

public sealed record OrderDetailsResponse(
    long Id,
    string OrderNumber,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    FulfillmentStatus FulfillmentStatus,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal TaxTotal,
    decimal ShippingTotal,
    decimal Total,
    string Currency,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? ReservationExpiresAt,
    OrderCustomerResponse Customer,
    OrderAddressResponse ShippingAddress,
    IReadOnlyCollection<OrderItemResponse> Items,
    IReadOnlyCollection<PaymentResponse> Payments,
    IReadOnlyCollection<OrderStatusHistoryResponse> StatusHistory
);

public sealed record UpdateOrderStatusRequest(
    OrderStatus Status,
    string? Note
);

public sealed record UpdatePaymentStatusRequest(
    PaymentStatus Status,
    string? ExternalReference,
    string? FailureReason
);

public sealed record OrderTrackingResponse(
    string OrderNumber,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    FulfillmentStatus FulfillmentStatus,
    decimal Total,
    string Currency,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    IReadOnlyCollection<OrderStatusHistoryResponse> Timeline
);
