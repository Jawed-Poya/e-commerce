using System.Net;
using System.Net.Http.Headers;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
            return new VerificationDispatchResponse(channel, Mask(GetDestination(user, channel)), DateTime.UtcNow, true);

        var destination = GetDestination(user, channel);
        var cooldown = TimeSpan.FromSeconds(Math.Clamp(_options.ResendCooldownSeconds, 30, 3600));
        var last = await context.AccountVerificationCodes
            .IgnoreQueryFilters()
            .Where(item => item.UserId == user.Id && item.Channel == channel && item.ConsumedAt == null)
            .OrderByDescending(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);
        if (last is not null && last.CreatedAt.Add(cooldown) > DateTime.UtcNow)
            throw new InvalidOperationException($"Wait {Math.Ceiling((last.CreatedAt.Add(cooldown) - DateTime.UtcNow).TotalSeconds)} seconds before requesting another code.");

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
            CodeHash = Hash(user.Id, channel, destination, code),
            ExpiresAt = expiresAt,
            CreatedAt = now
        };
        context.AccountVerificationCodes.Add(record);
        await context.SaveChangesAsync(cancellationToken);

        try
        {
            await DeliverAsync(channel, destination, code, expiresAt, cancellationToken);
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

        return new VerificationDispatchResponse(channel, Mask(destination), expiresAt, false);
    }

    public async Task<AuthUserResponse> ConfirmAsync(
        VerificationChannel channel,
        string code,
        CancellationToken cancellationToken = default)
    {
        var user = await GetUserAsync();
        if (IsVerified(user, channel))
            return await auth.GetCurrentAsync(cancellationToken)
                ?? throw new UnauthorizedAccessException("Authentication is required.");

        var normalizedCode = code.Trim();
        if (normalizedCode.Length != 6 || !normalizedCode.All(char.IsDigit))
            throw new InvalidOperationException("Enter the six-digit verification code.");

        var destination = GetDestination(user, channel);
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

        if (!CryptographicOperations.FixedTimeEquals(
                Convert.FromHexString(record.CodeHash),
                Convert.FromHexString(Hash(user.Id, channel, destination, normalizedCode))))
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
            throw new InvalidOperationException(channel == VerificationChannel.Email
                ? "Add an email address to your profile first."
                : "Add a phone number to your profile first.");
        return value.Trim();
    }

    private string Hash(string userId, VerificationChannel channel, string destination, string code)
    {
        var key = _options.HashKey?.Trim() ?? string.Empty;
        if (key.Length == 0 && environment.IsDevelopment())
            key = "development-only-verification-key-change-before-production";
        if (Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException(
                "AccountVerification:HashKey must contain at least 32 bytes.");
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{userId}|{(int)channel}|{destination}|{code}")));
    }

    private async Task DeliverAsync(
        VerificationChannel channel,
        string destination,
        string code,
        DateTime expiresAt,
        CancellationToken cancellationToken)
    {
        if (channel == VerificationChannel.Email)
        {
            var email = _options.Email;
            if (!string.IsNullOrWhiteSpace(email.Host) && !string.IsNullOrWhiteSpace(email.FromEmail))
            {
                using var message = new MailMessage(new MailAddress(email.FromEmail, email.FromName), new MailAddress(destination))
                {
                    Subject = "Verify your account",
                    Body = $"Your verification code is {code}. It expires at {expiresAt:O} UTC.",
                    IsBodyHtml = false
                };
                using var smtp = new SmtpClient(email.Host, email.Port)
                {
                    EnableSsl = email.EnableSsl,
                    Credentials = string.IsNullOrWhiteSpace(email.UserName)
                        ? CredentialCache.DefaultNetworkCredentials
                        : new NetworkCredential(email.UserName, email.Password)
                };
                await smtp.SendMailAsync(message, cancellationToken);
                return;
            }
        }
        else if (!string.IsNullOrWhiteSpace(_options.Sms.WebhookUrl))
        {
            var client = httpClientFactory.CreateClient(nameof(AccountVerificationService));
            if (!string.IsNullOrWhiteSpace(_options.Sms.BearerToken))
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.Sms.BearerToken);
            using var response = await client.PostAsJsonAsync(
                _options.Sms.WebhookUrl,
                new { to = destination, message = $"Your verification code is {code}." },
                cancellationToken);
            response.EnsureSuccessStatusCode();
            return;
        }

        if (environment.IsDevelopment())
        {
            logger.LogWarning("Development verification code for {Channel} {Destination}: {Code}", channel, destination, code);
            return;
        }

        throw new InvalidOperationException(channel == VerificationChannel.Email
            ? "Email verification delivery is not configured."
            : "SMS verification delivery is not configured.");
    }

    private static string Mask(string value)
    {
        var separator = value.IndexOf('@');
        if (separator > 0 && separator < value.Length - 1)
            return $"{value[0]}***@{value[(separator + 1)..]}";
        if (separator >= 0) return "***";
        return value.Length <= 4 ? "****" : $"***{value[^4..]}";
    }
}
