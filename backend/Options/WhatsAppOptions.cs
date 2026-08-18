namespace ECommerce.Options;

public sealed class WhatsAppOptions
{
    public const string SectionName = "WhatsApp";

    /// <summary>
    /// Used only when a stored phone number is local and starts with 0.
    /// Enter digits only, for example 93 for Afghanistan.
    /// </summary>
    public string DefaultCountryCode { get; set; } = "93";

    /// <summary>
    /// Supported placeholders: {CustomerName} and {Phone}.
    /// Leave empty to open WhatsApp without a prefilled message.
    /// </summary>
    public string CustomerMessageTemplate { get; set; } =
        "Hello {CustomerName}, we are contacting you about your account.";

    /// <summary>
    /// Supported placeholders: {CustomerName}, {Phone}, and {OrderNumber}.
    /// </summary>
    public string OrderMessageTemplate { get; set; } =
        "Hello {CustomerName}, we are contacting you about order {OrderNumber}.";

    /// <summary>
    /// Supported placeholders: {CustomerName}, {Phone}, {SaleNumber},
    /// {Total}, {Paid}, {Balance}, and {Currency}.
    /// </summary>
    public string SaleMessageTemplate { get; set; } =
        "Receipt {SaleNumber}\nCustomer: {CustomerName}\nTotal: {Total} {Currency}\nPaid: {Paid} {Currency}\nBalance: {Balance} {Currency}\nThank you for your business.";
}
