using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Text;

namespace ECommerce.Services.Auth.Verification;

internal sealed record VerificationEmailBrand(
    string CompanyName,
    string? LogoUrl,
    string PrimaryColor,
    string SecondaryColor,
    string? SupportEmail,
    string? SupportPhone);

internal static class VerificationEmailTemplate
{
    private const string DefaultPrimaryColor = "#0f766e";
    private const string DefaultSecondaryColor = "#12332d";

    public static string BuildSubject(VerificationEmailBrand brand) =>
        $"{CleanHeaderText(brand.CompanyName, "Store")} verification code";

    public static string BuildPlainText(
        VerificationEmailBrand brand,
        string? recipientName,
        string code,
        DateTime expiresAt)
    {
        var companyName = CleanText(brand.CompanyName, "Store");
        var greetingName = CleanText(recipientName, "there");
        var expiresInMinutes = GetRemainingMinutes(expiresAt);
        var expiryText = FormatExpiry(expiresAt);
        var support = BuildPlainTextSupport(brand);

        return $"""
            Hello {greetingName},

            Use this verification code to confirm your email address for {companyName}:

            {code}

            This code expires in approximately {expiresInMinutes} minute{(expiresInMinutes == 1 ? string.Empty : "s")} ({expiryText}).

            Never share this code with anyone. {companyName} will never ask you for it by phone, message, or email.

            If you did not request this code, you can safely ignore this email.{support}

            © {DateTime.UtcNow.Year} {companyName}. All rights reserved.
            """;
    }

    public static string BuildHtml(
        VerificationEmailBrand brand,
        string? recipientName,
        string code,
        DateTime expiresAt)
    {
        var companyName = Html(CleanText(brand.CompanyName, "Store"));
        var greetingName = Html(CleanText(recipientName, "there"));
        var primaryColor = NormalizeColor(brand.PrimaryColor, DefaultPrimaryColor);
        var secondaryColor = NormalizeColor(brand.SecondaryColor, DefaultSecondaryColor);
        var primaryForeground = GetContrastingTextColor(primaryColor);
        var expiresInMinutes = GetRemainingMinutes(expiresAt);
        var expiryText = Html(FormatExpiry(expiresAt));
        var logo = BuildLogo(brand, companyName, primaryColor, primaryForeground);
        var codeCells = BuildCodeCells(code, primaryColor, secondaryColor);
        var support = BuildHtmlSupport(brand, primaryColor);
        var preheader = Html($"Your {CleanText(brand.CompanyName, "Store")} verification code is ready and expires soon.");
        var year = DateTime.UtcNow.Year;
        var plural = expiresInMinutes == 1 ? string.Empty : "s";

        return $$"""
            <!doctype html>
            <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="x-apple-disable-message-reformatting">
              <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
              <title>{{companyName}} verification code</title>
              <style>
                html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
                table, td { border-collapse: collapse !important; }
                img { border: 0; outline: none; text-decoration: none; display: block; }
                a { text-decoration: none; }
                .verification-shell { width: 100%; max-width: 640px; }
                .mobile-padding { padding-left: 48px !important; padding-right: 48px !important; }
                @media only screen and (max-width: 620px) {
                  .verification-shell { width: 100% !important; }
                  .mobile-padding { padding-left: 22px !important; padding-right: 22px !important; }
                  .hero-title { font-size: 29px !important; line-height: 36px !important; }
                  .code-cell { width: 38px !important; height: 52px !important; font-size: 27px !important; }
                  .brand-name { max-width: 210px !important; font-size: 17px !important; }
                }
              </style>
            </head>
            <body style="margin:0;padding:0;background-color:#edf4f2;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#10231f;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{{preheader}}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#edf4f2;">
                <tr>
                  <td align="center" style="padding:38px 12px;">
                    <table role="presentation" class="verification-shell" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(15,51,45,.13);">
                      <tr>
                        <td style="height:7px;background-color:{{primaryColor}};background-image:linear-gradient(90deg,{{primaryColor}},#14b8a6,#f59e0b);font-size:0;line-height:0;">&nbsp;</td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:30px 48px 22px;background-color:#ffffff;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="left" valign="middle">{{logo}}</td>
                              <td align="right" valign="middle">
                                <span style="display:inline-block;padding:8px 13px;border:1px solid #dce9e5;border-radius:999px;background:#f5faf8;color:#526b65;font-size:12px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">Secure verification</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:26px 48px 18px;background-color:{{secondaryColor}};background-image:radial-gradient(circle at 88% 12%,rgba(255,255,255,.13),transparent 30%),linear-gradient(135deg,{{secondaryColor}},{{primaryColor}});">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td>
                                <div style="width:54px;height:54px;line-height:54px;border-radius:17px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2);text-align:center;font-size:25px;margin-bottom:20px;">✦</div>
                                <h1 class="hero-title" style="margin:0 0 11px;color:#ffffff;font-size:36px;line-height:43px;font-weight:800;letter-spacing:-1px;">Verify your email</h1>
                                <p style="margin:0;color:#dff6f0;font-size:16px;line-height:26px;">One quick step keeps your account protected and ready to use.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:34px 48px 12px;background:#ffffff;">
                          <p style="margin:0 0 12px;color:#10231f;font-size:18px;line-height:28px;font-weight:700;">Hello {{greetingName}},</p>
                          <p style="margin:0;color:#5e716c;font-size:15px;line-height:25px;">Enter the code below in {{companyName}} to confirm that this email address belongs to you.</p>
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:22px 48px 12px;background:#ffffff;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f8f6;border:1px solid #dce9e5;border-radius:20px;">
                            <tr>
                              <td align="center" style="padding:26px 16px 12px;">
                                <div style="margin-bottom:15px;color:#6b7e79;font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;">Your verification code</div>
                                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;border-spacing:7px 0;border-collapse:separate !important;">
                                  <tr>{{codeCells}}</tr>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:10px 16px 25px;">
                                <span style="display:inline-block;padding:8px 13px;border-radius:999px;background:#ffffff;border:1px solid #d9e7e3;color:{{primaryColor}};font-size:12px;line-height:18px;font-weight:800;">⏱ Expires in {{expiresInMinutes}} minute{{plural}}</span>
                                <div style="margin-top:9px;color:#80918d;font-size:11px;line-height:17px;">{{expiryText}}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:18px 48px 8px;background:#ffffff;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #f59e0b;background:#fffaf0;border-radius:12px;">
                            <tr>
                              <td style="padding:15px 16px;">
                                <p style="margin:0 0 4px;color:#7a4a05;font-size:13px;line-height:20px;font-weight:800;">Keep this code private</p>
                                <p style="margin:0;color:#8b672e;font-size:12px;line-height:19px;">{{companyName}} will never ask you to share this code by phone, chat, or another email.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:22px 48px 34px;background:#ffffff;">
                          <p style="margin:0;color:#72837f;font-size:13px;line-height:21px;">Didn’t request this? You can safely ignore the email. Your account remains protected.</p>
                          {{support}}
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:24px 48px;background:#f5f9f8;border-top:1px solid #e2ece9;">
                          <p style="margin:0 0 6px;color:#536762;font-size:12px;line-height:18px;font-weight:700;">Sent securely by {{companyName}}</p>
                          <p style="margin:0;color:#8a9a96;font-size:11px;line-height:18px;">© {{year}} {{companyName}}. All rights reserved.</p>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:18px auto 0;max-width:560px;color:#8a9a96;font-size:11px;line-height:18px;text-align:center;">This is an automated security message. Please do not forward it.</p>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }

    private static string BuildLogo(
        VerificationEmailBrand brand,
        string encodedCompanyName,
        string primaryColor,
        string primaryForeground)
    {
        var logoUrl = CleanText(brand.LogoUrl, string.Empty);
        if (Uri.TryCreate(logoUrl, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
        {
            return $"""
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:12px;">
                      <img src="{Html(uri.AbsoluteUri)}" width="44" height="44" alt="{encodedCompanyName}" style="width:44px;height:44px;object-fit:contain;border-radius:13px;background:#f3f8f6;border:1px solid #dce9e5;">
                    </td>
                    <td valign="middle" class="brand-name" style="max-width:300px;color:#10231f;font-size:19px;line-height:24px;font-weight:800;letter-spacing:-.2px;">{encodedCompanyName}</td>
                  </tr>
                </table>
                """;
        }

        var initials = Html(GetInitials(brand.CompanyName));
        return $"""
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:12px;">
                  <div style="width:44px;height:44px;line-height:44px;border-radius:13px;background:{primaryColor};color:{primaryForeground};font-size:16px;font-weight:900;text-align:center;letter-spacing:.5px;">{initials}</div>
                </td>
                <td valign="middle" class="brand-name" style="max-width:300px;color:#10231f;font-size:19px;line-height:24px;font-weight:800;letter-spacing:-.2px;">{encodedCompanyName}</td>
              </tr>
            </table>
            """;
    }

    private static string BuildCodeCells(string code, string primaryColor, string secondaryColor)
    {
        var safeCode = new string(code.Where(char.IsDigit).Take(6).ToArray()).PadRight(6, '•');
        var builder = new StringBuilder();
        foreach (var character in safeCode)
        {
            builder.Append($"""
                <td class="code-cell" width="44" height="58" align="center" valign="middle" style="width:44px;height:58px;border:1px solid #cfe0db;border-bottom:3px solid {primaryColor};border-radius:12px;background:#ffffff;color:{secondaryColor};font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:30px;line-height:30px;font-weight:900;">{Html(character.ToString())}</td>
                """);
        }

        return builder.ToString();
    }

    private static string BuildHtmlSupport(VerificationEmailBrand brand, string primaryColor)
    {
        var email = CleanText(brand.SupportEmail, string.Empty);
        var phone = CleanText(brand.SupportPhone, string.Empty);
        if (email.Length == 0 && phone.Length == 0)
            return string.Empty;

        var parts = new List<string>();
        if (email.Length > 0 && MailAddress.TryCreate(email, out var address))
        {
            var safeEmail = Html(address.Address);
            parts.Add($"<a href=\"mailto:{safeEmail}\" style=\"color:{primaryColor};font-weight:700;\">{safeEmail}</a>");
        }
        if (phone.Length > 0)
            parts.Add($"<span style=\"color:#526b65;font-weight:700;\">{Html(phone)}</span>");

        if (parts.Count == 0)
            return string.Empty;

        return $"<p style=\"margin:15px 0 0;color:#72837f;font-size:12px;line-height:20px;\">Need help? Contact {string.Join(" &nbsp;•&nbsp; ", parts)}</p>";
    }

    private static string BuildPlainTextSupport(VerificationEmailBrand brand)
    {
        var values = new[]
            {
                CleanText(brand.SupportEmail, string.Empty),
                CleanText(brand.SupportPhone, string.Empty)
            }
            .Where(value => value.Length > 0)
            .ToArray();

        return values.Length == 0
            ? string.Empty
            : $"\n\nNeed help? Contact {string.Join(" or ", values)}.";
    }

    private static int GetRemainingMinutes(DateTime expiresAt) =>
        Math.Max(1, (int)Math.Ceiling((expiresAt.ToUniversalTime() - DateTime.UtcNow).TotalMinutes));

    private static string FormatExpiry(DateTime expiresAt) =>
        expiresAt.ToUniversalTime().ToString("dd MMM yyyy 'at' HH:mm 'UTC'", CultureInfo.InvariantCulture);

    private static string GetInitials(string? companyName)
    {
        var words = CleanText(companyName, "Store")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (words.Length == 0)
            return "ST";
        if (words.Length == 1)
            return words[0][..Math.Min(2, words[0].Length)].ToUpperInvariant();
        return $"{words[0][0]}{words[^1][0]}".ToUpperInvariant();
    }

    private static string NormalizeColor(string? value, string fallback)
    {
        var color = CleanText(value, fallback);
        if (color.Length == 4 && color[0] == '#' && color[1..].All(Uri.IsHexDigit))
            return $"#{color[1]}{color[1]}{color[2]}{color[2]}{color[3]}{color[3]}".ToLowerInvariant();
        if (color.Length == 7 && color[0] == '#' && color[1..].All(Uri.IsHexDigit))
            return color.ToLowerInvariant();
        return fallback;
    }

    private static string GetContrastingTextColor(string color)
    {
        var red = Convert.ToInt32(color.Substring(1, 2), 16);
        var green = Convert.ToInt32(color.Substring(3, 2), 16);
        var blue = Convert.ToInt32(color.Substring(5, 2), 16);
        var luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
        return luminance > 0.62 ? "#10231f" : "#ffffff";
    }

    private static string CleanHeaderText(string? value, string fallback) =>
        CleanText(value, fallback)
            .Replace('\r', ' ')
            .Replace('\n', ' ');

    private static string CleanText(string? value, string fallback)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean;
    }

    private static string Html(string value) => WebUtility.HtmlEncode(value);
}
