using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Net.Mime;
using System.Security.Cryptography;
using System.Text;
using ECommerce.Data;
using ECommerce.Entities.Users;
using ECommerce.Entities.Users.Contracts;
using ECommerce.Options;
using ECommerce.Services.Customers;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ECommerce.Services.Auth.Verification;

public sealed class AccountVerificationService(
    ApplicationDbContext context,
    UserManager<User> userManager,
    ICurrentCustomerAccessor currentCustomer,
    IAuthService auth,
    IHttpClientFactory httpClientFactory,
    IWebHostEnvironment environment,
    ILogger<AccountVerificationService> logger,
    IOptions<AccountVerificationOptions> options) : IAccountVerificationService
{
    private readonly AccountVerificationOptions _options = options.Value;

    public async Task<VerificationDispatchResponse> SendAsync(
        VerificationChannel channel,
        CancellationToken cancellationToken = default)
    {
        var user = await GetUserAsync();
        if (IsVerified(user, channel))
        {
            return new VerificationDispatchResponse(
                channel,
                Mask(GetDestination(user, channel)),
                DateTime.UtcNow,
                true,
                null);
        }

        var destination = GetDestination(user, channel);
        var hashKey = GetHashKey();
        var cooldown = TimeSpan.FromSeconds(Math.Clamp(_options.ResendCooldownSeconds, 30, 3600));
        var last = await context.AccountVerificationCodes
            .IgnoreQueryFilters()
            .Where(item => item.UserId == user.Id && item.Channel == channel && item.ConsumedAt == null)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (last is not null && last.CreatedAt.Add(cooldown) > DateTime.UtcNow)
        {
            var remaining = Math.Max(1, Math.Ceiling((last.CreatedAt.Add(cooldown) - DateTime.UtcNow).TotalSeconds));
            throw new InvalidOperationException($"Wait {remaining} seconds before requesting another code.");
        }

        var now = DateTime.UtcNow;
        await context.AccountVerificationCodes
            .IgnoreQueryFilters()
            .Where(item => item.UserId == user.Id && item.Channel == channel && item.ConsumedAt == null && item.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.ConsumedAt, now), cancellationToken);

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var expiresAt = now.AddMinutes(Math.Clamp(_options.CodeLifetimeMinutes, 3, 60));
        var record = new AccountVerificationCode
        {
            UserId = user.Id,
            Channel = channel,
            Destination = destination,
            CodeHash = Hash(hashKey, user.Id, channel, destination, code),
            ExpiresAt = expiresAt,
            CreatedAt = now
        };
        context.AccountVerificationCodes.Add(record);
        await context.SaveChangesAsync(cancellationToken);

        string? developmentCode;
        try
        {
            developmentCode = await DeliverAsync(
                channel,
                destination,
                user.FullName,
                code,
                expiresAt,
                cancellationToken);
        }
        catch (Exception exception)
        {
            record.ConsumedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(CancellationToken.None);
            if (exception is OperationCanceledException)
                throw;
            if (exception is InvalidOperationException)
                throw;

            logger.LogError(
                exception,
                "Could not deliver {Channel} verification code to {Destination}.",
                channel,
                Mask(destination));
            throw new InvalidOperationException(
                "The verification code could not be delivered. Check the configured provider and try again.",
                exception);
        }

        return new VerificationDispatchResponse(
            channel,
            Mask(destination),
            expiresAt,
            false,
            developmentCode);
    }

    public async Task<AuthUserResponse> ConfirmAsync(
        VerificationChannel channel,
        string code,
        CancellationToken cancellationToken = default)
    {
        var user = await GetUserAsync();
        if (IsVerified(user, channel))
        {
            return await auth.GetCurrentAsync(cancellationToken)
                ?? throw new UnauthorizedAccessException("Authentication is required.");
        }

        var normalizedCode = code.Trim();
        if (normalizedCode.Length != 6 || !normalizedCode.All(char.IsDigit))
            throw new InvalidOperationException("Enter the six-digit verification code.");

        var destination = GetDestination(user, channel);
        var hashKey = GetHashKey();
        var now = DateTime.UtcNow;
        var record = await context.AccountVerificationCodes
            .IgnoreQueryFilters()
            .Where(item => item.UserId == user.Id && item.Channel == channel && item.ConsumedAt == null)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Request a verification code first.");

        if (record.ExpiresAt <= now)
            throw new InvalidOperationException("The verification code has expired. Request a new code.");
        if (!string.Equals(record.Destination, destination, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Your account contact changed. Request a new verification code.");

        var maximumAttempts = Math.Clamp(_options.MaximumAttempts, 3, 10);
        if (record.AttemptCount >= maximumAttempts)
            throw new InvalidOperationException("Too many invalid attempts. Request a new verification code.");

        var expectedHash = Hash(hashKey, user.Id, channel, destination, normalizedCode);
        if (!FixedTimeEquals(record.CodeHash, expectedHash))
        {
            record.AttemptCount++;
            if (record.AttemptCount >= maximumAttempts)
                record.ConsumedAt = now;
            await context.SaveChangesAsync(cancellationToken);
            throw new InvalidOperationException("The verification code is invalid.");
        }

        record.ConsumedAt = now;
        if (channel == VerificationChannel.Email)
            user.EmailConfirmed = true;
        else
            user.PhoneNumberConfirmed = true;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
            throw new InvalidOperationException(string.Join(" ", result.Errors.Select(error => error.Description)));

        return await auth.GetCurrentAsync(cancellationToken)
            ?? throw new UnauthorizedAccessException("Authentication is required.");
    }

    private async Task<User> GetUserAsync()
    {
        if (!currentCustomer.IsAuthenticated || string.IsNullOrWhiteSpace(currentCustomer.UserId))
            throw new UnauthorizedAccessException("Authentication is required.");
        return await userManager.FindByIdAsync(currentCustomer.UserId)
            ?? throw new UnauthorizedAccessException("Authentication is required.");
    }

    private static bool IsVerified(User user, VerificationChannel channel) =>
        channel == VerificationChannel.Email ? user.EmailConfirmed : user.PhoneNumberConfirmed;

    private static string GetDestination(User user, VerificationChannel channel)
    {
        var value = channel == VerificationChannel.Email ? user.Email : user.PhoneNumber;
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException(channel == VerificationChannel.Email
                ? "Add an email address to your profile first."
                : "Add a phone number to your profile first.");
        }

        return value.Trim();
    }

    private string GetHashKey()
    {
        var key = _options.HashKey?.Trim() ?? string.Empty;
        if (key.Length == 0 && environment.IsDevelopment())
            key = "development-only-verification-key-change-before-production";
        if (Encoding.UTF8.GetByteCount(key) < 32)
        {
            throw new InvalidOperationException(
                "AccountVerification:HashKey must contain at least 32 bytes. Configure it through environment variables or your deployment secret store.");
        }

        return key;
    }

    private static string Hash(
        string hashKey,
        string userId,
        VerificationChannel channel,
        string destination,
        string code)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(hashKey));
        return Convert.ToHexString(
            hmac.ComputeHash(Encoding.UTF8.GetBytes($"{userId}|{(int)channel}|{destination}|{code}")));
    }

    private static bool FixedTimeEquals(string storedHash, string expectedHash)
    {
        try
        {
            return CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(storedHash),
                Convert.FromHexString(expectedHash));
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private async Task<string?> DeliverAsync(
        VerificationChannel channel,
        string destination,
        string? recipientName,
        string code,
        DateTime expiresAt,
        CancellationToken cancellationToken)
    {
        if (channel == VerificationChannel.Email)
        {
            if (IsEmailProviderConfigured())
            {
                await DeliverEmailAsync(
                    destination,
                    recipientName,
                    code,
                    expiresAt,
                    cancellationToken);
                return null;
            }

            EnsureEmailConfigurationIsNotPartial();
        }
        else
        {
            if (IsSmsProviderConfigured())
            {
                await DeliverSmsAsync(destination, code, cancellationToken);
                return null;
            }

            EnsureSmsConfigurationIsNotPartial();
        }

        if (environment.IsDevelopment())
        {
            logger.LogWarning(
                "No {Channel} delivery provider is configured. Development verification code for {Destination}: {Code}",
                channel,
                Mask(destination),
                code);
            return code;
        }

        throw new InvalidOperationException(channel == VerificationChannel.Email
            ? "Email verification delivery is not configured. Set AccountVerification__Email__Host and sender credentials."
            : "SMS verification delivery is not configured. Set AccountVerification__Sms__WebhookUrl.");
    }

    private bool IsEmailProviderConfigured()
    {
        var email = _options.Email;
        var sender = ResolveSenderEmail(email);
        return !string.IsNullOrWhiteSpace(email.Host) && sender is not null;
    }

    private static string? ResolveSenderEmail(EmailDeliveryOptions email)
    {
        var configured = Clean(email.FromEmail);
        if (configured is not null)
            return configured;

        var userName = Clean(email.UserName);
        return userName is not null && MailAddress.TryCreate(userName, out var address)
            ? address.Address
            : null;
    }

    private void EnsureEmailConfigurationIsNotPartial()
    {
        var email = _options.Email;
        var hasAnyValue = !string.IsNullOrWhiteSpace(email.Host) ||
                          !string.IsNullOrWhiteSpace(email.UserName) ||
                          !string.IsNullOrWhiteSpace(email.Password) ||
                          !string.IsNullOrWhiteSpace(email.FromEmail);
        if (!hasAnyValue)
            return;

        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(email.Host))
            missing.Add("Host");
        if (ResolveSenderEmail(email) is null)
            missing.Add("FromEmail");
        if (!string.IsNullOrWhiteSpace(email.UserName) && string.IsNullOrWhiteSpace(email.Password))
            missing.Add("Password");
        if (string.IsNullOrWhiteSpace(email.UserName) && !string.IsNullOrWhiteSpace(email.Password))
            missing.Add("UserName");
        if (email.Port is <= 0 or > 65535)
            missing.Add("Port");

        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"Email verification SMTP configuration is incomplete. Check: {string.Join(", ", missing.Distinct(StringComparer.OrdinalIgnoreCase))}.");
        }
    }

    private async Task DeliverEmailAsync(
        string destination,
        string? recipientName,
        string code,
        DateTime expiresAt,
        CancellationToken cancellationToken)
    {
        EnsureEmailConfigurationIsNotPartial();
        var email = _options.Email;
        var senderEmail = ResolveSenderEmail(email)
            ?? throw new InvalidOperationException("AccountVerification:Email:FromEmail is required.");
        if (!MailAddress.TryCreate(senderEmail, out var sender))
            throw new InvalidOperationException("AccountVerification:Email:FromEmail is not a valid email address.");
        if (!MailAddress.TryCreate(destination, out var recipient))
            throw new InvalidOperationException("The account email address is not valid.");

        var brand = await GetEmailBrandAsync(email, cancellationToken);
        var plainText = VerificationEmailTemplate.BuildPlainText(
            brand,
            recipientName,
            code,
            expiresAt);
        var html = VerificationEmailTemplate.BuildHtml(
            brand,
            recipientName,
            code,
            expiresAt);

        using var message = new MailMessage(
            new MailAddress(sender.Address, brand.CompanyName),
            recipient)
        {
            Subject = VerificationEmailTemplate.BuildSubject(brand),
            SubjectEncoding = Encoding.UTF8,
            Body = plainText,
            BodyEncoding = Encoding.UTF8,
            IsBodyHtml = false
        };
        message.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(
                plainText,
                Encoding.UTF8,
                MediaTypeNames.Text.Plain));
        message.AlternateViews.Add(
            AlternateView.CreateAlternateViewFromString(
                html,
                Encoding.UTF8,
                MediaTypeNames.Text.Html));

        using var smtp = new SmtpClient(email.Host.Trim(), email.Port)
        {
            DeliveryMethod = SmtpDeliveryMethod.Network,
            EnableSsl = email.EnableSsl,
            UseDefaultCredentials = false,
            Timeout = Math.Clamp(_options.DeliveryTimeoutSeconds, 5, 120) * 1000
        };

        var userName = Clean(email.UserName);
        if (userName is not null)
            smtp.Credentials = new NetworkCredential(userName, email.Password);

        try
        {
            await smtp.SendMailAsync(message, cancellationToken);
        }
        catch (SmtpException exception)
        {
            logger.LogError(
                exception,
                "SMTP rejected verification email through {Host}:{Port} with status {StatusCode}.",
                email.Host,
                email.Port,
                exception.StatusCode);
            throw new InvalidOperationException(
                $"Email delivery failed through SMTP ({exception.StatusCode}). Check the host, port, TLS mode, username, password, and sender address.",
                exception);
        }
    }

    private async Task<VerificationEmailBrand> GetEmailBrandAsync(
        EmailDeliveryOptions email,
        CancellationToken cancellationToken)
    {
        var company = await context.Companies
            .AsNoTracking()
            .Select(item => new
            {
                item.Name,
                item.LogoUrl,
                item.Email,
                item.Phone
            })
            .SingleOrDefaultAsync(cancellationToken);

        var settings = await context.CompanySettings
            .AsNoTracking()
            .Select(item => new
            {
                item.StorefrontPrimaryColor,
                item.StorefrontSecondaryColor
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (company is null)
            throw new InvalidOperationException(
                "Company profile must be configured before verification emails can be sent.");
        if (settings is null)
            throw new InvalidOperationException(
                "Company storefront colors must be configured before verification emails can be sent.");

        var companyName = Clean(company.Name)
            ?? throw new InvalidOperationException(
                "Company name must be configured before verification emails can be sent.");
        var primaryColor = Clean(settings.StorefrontPrimaryColor)
            ?? throw new InvalidOperationException(
                "Storefront primary color must be configured before verification emails can be sent.");
        var secondaryColor = Clean(settings.StorefrontSecondaryColor)
            ?? throw new InvalidOperationException(
                "Storefront secondary color must be configured before verification emails can be sent.");

        return new VerificationEmailBrand(
            companyName,
            Clean(company.LogoUrl),
            primaryColor,
            secondaryColor,
            Clean(company.Email) ?? ResolveSenderEmail(email),
            Clean(company.Phone));
    }

    private bool IsSmsProviderConfigured() =>
        !string.IsNullOrWhiteSpace(_options.Sms.WebhookUrl);

    private void EnsureSmsConfigurationIsNotPartial()
    {
        if (string.IsNullOrWhiteSpace(_options.Sms.WebhookUrl) &&
            !string.IsNullOrWhiteSpace(_options.Sms.BearerToken))
        {
            throw new InvalidOperationException(
                "SMS verification configuration is incomplete. WebhookUrl is required when BearerToken is configured.");
        }
    }

    private async Task DeliverSmsAsync(
        string destination,
        string code,
        CancellationToken cancellationToken)
    {
        var webhook = _options.Sms.WebhookUrl.Trim();
        if (!Uri.TryCreate(webhook, UriKind.Absolute, out var webhookUri) ||
            (webhookUri.Scheme != Uri.UriSchemeHttps && webhookUri.Scheme != Uri.UriSchemeHttp))
        {
            throw new InvalidOperationException(
                "AccountVerification:Sms:WebhookUrl must be an absolute HTTP or HTTPS URL.");
        }
        if (!environment.IsDevelopment() && webhookUri.Scheme != Uri.UriSchemeHttps)
            throw new InvalidOperationException("The production SMS webhook must use HTTPS.");

        var client = httpClientFactory.CreateClient(nameof(AccountVerificationService));
        using var request = new HttpRequestMessage(HttpMethod.Post, webhookUri)
        {
            Content = JsonContent.Create(new
            {
                to = destination,
                message = $"Your verification code is {code}."
            })
        };
        if (!string.IsNullOrWhiteSpace(_options.Sms.BearerToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer",
                _options.Sms.BearerToken.Trim());
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.DeliveryTimeoutSeconds, 5, 120)));
        using var response = await client.SendAsync(request, timeout.Token);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning(
                "SMS verification webhook returned HTTP {StatusCode} for {Destination}.",
                (int)response.StatusCode,
                Mask(destination));
            throw new InvalidOperationException(
                $"SMS provider rejected the verification request with HTTP {(int)response.StatusCode}.");
        }
    }

    private static string? Clean(string? value)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean;
    }

    private static string Mask(string value)
    {
        var separator = value.IndexOf('@');
        if (separator > 0 && separator < value.Length - 1)
            return $"{value[0]}***@{value[(separator + 1)..]}";
        if (separator >= 0)
            return "***";
        return value.Length <= 4 ? "****" : $"***{value[^4..]}";
    }
}
