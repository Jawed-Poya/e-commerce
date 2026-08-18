using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Options;
using ECommerce.Shared;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Auth.PasswordRecovery;

public sealed class PasswordRecoveryService(
    ApplicationDbContext context,
    UserManager<User> userManager,
    IWebHostEnvironment environment,
    ILogger<PasswordRecoveryService> logger,
    IOptions<AccountVerificationOptions> options) : IPasswordRecoveryService
{
    private readonly AccountVerificationOptions _options = options.Value;

    public async Task RequestResetAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmail(email);
        if (normalizedEmail is null)
            throw new ArgumentException("Enter a valid email address.");

        // Validate delivery configuration before account lookup so configuration
        // errors cannot be used to discover which email addresses are registered.
        EnsureEmailConfiguration(_options.Email);
        var storefrontBaseUrl = ResolveStorefrontBaseUrl();

        // Do not reveal whether an email address is registered. Duplicate legacy
        // emails are also ignored until an administrator repairs them.
        var normalized = userManager.NormalizeEmail(normalizedEmail);
        var candidates = await context.Users
            .Where(user => user.NormalizedEmail == normalized)
            .Take(2)
            .ToListAsync(cancellationToken);
        if (candidates.Count != 1)
            return;

        var user = candidates[0];
        if (!user.IsActive || !await userManager.IsInRoleAsync(user, AppRoles.Customer))
            return;
        if (!await userManager.HasPasswordAsync(user))
            return;

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var resetUrl = BuildResetUrl(storefrontBaseUrl, normalizedEmail, token);
        await SendResetEmailAsync(user, resetUrl, cancellationToken);
    }

    public async Task ResetAsync(
        string email,
        string token,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        var normalizedEmail = NormalizeEmail(email)
            ?? throw new ArgumentException("Enter a valid email address.");
        if (string.IsNullOrWhiteSpace(token))
            throw new ArgumentException("The password reset link is invalid.");
        if (string.IsNullOrWhiteSpace(newPassword))
            throw new ArgumentException("A new password is required.");

        var normalized = userManager.NormalizeEmail(normalizedEmail);
        var candidates = await context.Users
            .Where(user => user.NormalizedEmail == normalized)
            .Take(2)
            .ToListAsync(cancellationToken);
        if (candidates.Count != 1)
            throw new InvalidOperationException("The password reset link is invalid or has expired.");

        var user = candidates[0];
        if (!user.IsActive || !await userManager.IsInRoleAsync(user, AppRoles.Customer))
            throw new InvalidOperationException("The password reset link is invalid or has expired.");
        if (!await userManager.HasPasswordAsync(user))
            throw new InvalidOperationException("This account does not have a password to reset. Sign in with Google and create one from your account security settings.");

        var result = await userManager.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded)
        {
            var passwordErrors = result.Errors
                .Where(error => error.Code.StartsWith("Password", StringComparison.OrdinalIgnoreCase))
                .Select(error => error.Description)
                .ToArray();
            if (passwordErrors.Length > 0)
                throw new ArgumentException(string.Join(" ", passwordErrors));

            throw new InvalidOperationException("The password reset link is invalid or has expired.");
        }

        // Receiving the reset link proves control of this mailbox.
        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            var update = await userManager.UpdateAsync(user);
            if (!update.Succeeded)
                logger.LogWarning("Password was reset but email confirmation could not be persisted for user {UserId}.", user.Id);
        }
    }

    private Uri ResolveStorefrontBaseUrl()
    {
        var baseUrl = Clean(_options.StorefrontBaseUrl);
        if (baseUrl is null && environment.IsDevelopment())
            baseUrl = "http://localhost:5173";
        if (baseUrl is null || !Uri.TryCreate(baseUrl, UriKind.Absolute, out var storefront) ||
            storefront.Scheme is not ("http" or "https"))
        {
            throw new InvalidOperationException(
                "Password reset delivery is not configured. Set AccountVerification:StorefrontBaseUrl to the public storefront URL.");
        }

        return storefront;
    }

    private static string BuildResetUrl(Uri storefront, string email, string token)
    {
        var root = storefront.ToString().TrimEnd('/') + "/";
        return $"{root}account/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(token)}";
    }

    private async Task SendResetEmailAsync(User user, string resetUrl, CancellationToken cancellationToken)
    {
        var emailOptions = _options.Email;
        EnsureEmailConfiguration(emailOptions);
        var senderAddress = ResolveSenderEmail(emailOptions)
            ?? throw new InvalidOperationException("AccountVerification:Email:FromEmail is required.");
        if (!MailAddress.TryCreate(senderAddress, out var sender))
            throw new InvalidOperationException("AccountVerification:Email:FromEmail is not valid.");
        if (!MailAddress.TryCreate(user.Email ?? string.Empty, out var recipient))
            throw new InvalidOperationException("The customer email address is not valid.");

        var brand = await LoadBrandAsync(cancellationToken);
        var lifetime = Math.Clamp(_options.PasswordResetLifetimeMinutes, 10, 1440);
        var subject = $"Reset your {brand.CompanyName} password";
        var plainText = $"Hello {user.FullName},\n\nWe received a request to reset your {brand.CompanyName} password.\n\nOpen this link to create a new password:\n{resetUrl}\n\nThis link expires in about {lifetime} minutes. If you did not request this, you can ignore this email.";
        var html = BuildHtml(brand, user.FullName, resetUrl, lifetime);

        using var message = new MailMessage(new MailAddress(sender.Address, brand.CompanyName), recipient)
        {
            Subject = subject,
            SubjectEncoding = Encoding.UTF8,
            Body = plainText,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false
        };
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(plainText, Encoding.UTF8, MediaTypeNames.Text.Plain));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html, Encoding.UTF8, MediaTypeNames.Text.Html));

        using var smtp = new SmtpClient(emailOptions.Host.Trim(), emailOptions.Port)
        {
            DeliveryMethod = SmtpDeliveryMethod.Network,
            EnableSsl = emailOptions.EnableSsl,
            UseDefaultCredentials = false,
            Timeout = Math.Clamp(_options.DeliveryTimeoutSeconds, 5, 120) * 1000
        };
        var userName = Clean(emailOptions.UserName);
        if (userName is not null)
            smtp.Credentials = new NetworkCredential(userName, emailOptions.Password);

        try
        {
            await smtp.SendMailAsync(message, cancellationToken);
        }
        catch (SmtpException exception)
        {
            logger.LogError(exception, "SMTP rejected password reset email through {Host}:{Port}.", emailOptions.Host, emailOptions.Port);
            throw new InvalidOperationException(
                "Password reset email could not be sent. Check the SMTP host, port, TLS mode, username, password, and sender address.",
                exception);
        }
    }

    private async Task<EmailBrand> LoadBrandAsync(CancellationToken cancellationToken)
    {
        var company = await context.Companies.AsNoTracking()
            .Select(item => new { item.Name })
            .SingleOrDefaultAsync(cancellationToken);
        var settings = await context.CompanySettings.AsNoTracking()
            .Select(item => new { item.StorefrontPrimaryColor, item.StorefrontSecondaryColor })
            .SingleOrDefaultAsync(cancellationToken);

        return new EmailBrand(
            Clean(company?.Name) ?? "Store",
            Clean(settings?.StorefrontPrimaryColor) ?? "#2563eb",
            Clean(settings?.StorefrontSecondaryColor) ?? "#f97316");
    }

    private static string BuildHtml(EmailBrand brand, string? fullName, string resetUrl, int lifetime)
    {
        var company = WebUtility.HtmlEncode(brand.CompanyName);
        var name = WebUtility.HtmlEncode(Clean(fullName) ?? "customer");
        var link = WebUtility.HtmlEncode(resetUrl);
        var primary = SafeColor(brand.PrimaryColor, "#2563eb");
        var secondary = SafeColor(brand.SecondaryColor, "#f97316");
        return $"""
<!doctype html>
<html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f5f7fb"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e7eaf0;border-radius:18px;overflow:hidden">
<tr><td style="height:5px;background:linear-gradient(90deg,{primary},{secondary})"></td></tr>
<tr><td style="padding:30px">
<div style="font-size:13px;font-weight:700;color:{primary};text-transform:uppercase;letter-spacing:.08em">{company}</div>
<h1 style="margin:14px 0 10px;font-size:27px;line-height:1.2">Reset your password</h1>
<p style="margin:0 0 18px;line-height:1.7;color:#586174">Hello {name}, we received a request to reset your password.</p>
<a href="{link}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:{primary};color:#fff;text-decoration:none;font-weight:700">Create a new password</a>
<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#737b8d">This link expires in about {lifetime} minutes. If you did not request a password reset, you can safely ignore this email.</p>
</td></tr></table>
</td></tr></table></body></html>
""";
    }

    private static void EnsureEmailConfiguration(EmailDeliveryOptions email)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(email.Host)) missing.Add("Host");
        if (email.Port is <= 0 or > 65535) missing.Add("Port");
        if (ResolveSenderEmail(email) is null) missing.Add("FromEmail");
        if (!string.IsNullOrWhiteSpace(email.UserName) && string.IsNullOrWhiteSpace(email.Password)) missing.Add("Password");
        if (string.IsNullOrWhiteSpace(email.UserName) && !string.IsNullOrWhiteSpace(email.Password)) missing.Add("UserName");
        if (missing.Count > 0)
            throw new InvalidOperationException($"Password reset SMTP configuration is incomplete. Check: {string.Join(", ", missing)}.");
    }

    private static string? ResolveSenderEmail(EmailDeliveryOptions email)
    {
        var configured = Clean(email.FromEmail);
        if (configured is not null) return configured;
        var userName = Clean(email.UserName);
        return userName is not null && MailAddress.TryCreate(userName, out var address) ? address.Address : null;
    }

    private static string? NormalizeEmail(string? value)
    {
        var clean = Clean(value)?.ToLowerInvariant();
        return clean is not null && MailAddress.TryCreate(clean, out var address) &&
               string.Equals(address.Address, clean, StringComparison.OrdinalIgnoreCase)
            ? address.Address.ToLowerInvariant()
            : null;
    }

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    private static string SafeColor(string? value, string fallback)
    {
        var clean = Clean(value);
        if (clean is null) return fallback;
        if (clean.Length is 4 or 7 && clean[0] == '#' && clean.Skip(1).All(Uri.IsHexDigit)) return clean;
        return fallback;
    }

    private sealed record EmailBrand(string CompanyName, string PrimaryColor, string SecondaryColor);
}
