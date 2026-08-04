using System.Globalization;
using System.Net;
using System.Net.Mail;

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
    public static string BuildSubject(VerificationEmailBrand brand)
    {
        var companyName = RequireText(brand.CompanyName, "Company name");
        return $"{CleanHeaderText(companyName)} verification code";
    }

    public static string BuildPlainText(
        VerificationEmailBrand brand,
        string? recipientName,
        string code,
        DateTime expiresAt)
    {
        var companyName = RequireText(brand.CompanyName, "Company name");
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
        var rawCompanyName = RequireText(brand.CompanyName, "Company name");
        var companyName = Html(rawCompanyName);
        var greetingName = Html(CleanText(recipientName, "there"));
        var primaryColor = RequireHexColor(brand.PrimaryColor, "Storefront primary color");
        var secondaryColor = RequireHexColor(brand.SecondaryColor, "Storefront secondary color");
        var primaryForeground = GetContrastingTextColor(primaryColor);
        var heroForeground = GetContrastingTextColor(MixColors(primaryColor, secondaryColor, 0.5));
        var pageBackground = MixColors(primaryColor, "#ffffff", 0.94);
        var softPrimary = MixColors(primaryColor, "#ffffff", 0.90);
        var softerPrimary = MixColors(primaryColor, "#ffffff", 0.96);
        var borderColor = MixColors(primaryColor, "#ffffff", 0.78);
        var mutedBrandText = MixColors(secondaryColor, "#ffffff", 0.34);
        var expiresInMinutes = GetRemainingMinutes(expiresAt);
        var expiryText = Html(FormatExpiry(expiresAt));
        var logo = BuildLogo(brand, companyName, primaryColor, primaryForeground, softerPrimary, borderColor);
        var codeBadge = BuildCodeBadge(code, primaryColor, secondaryColor, borderColor);
        var support = BuildHtmlSupport(brand, primaryColor);
        var preheader = Html($"Your {rawCompanyName} verification code is ready and expires soon.");
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
                  .verification-code { padding: 17px 18px !important; font-size: 30px !important; letter-spacing: 7px !important; }
                  .brand-name { max-width: 210px !important; font-size: 17px !important; }
                }
              </style>
            </head>
            <body style="margin:0;padding:0;background-color:{{pageBackground}};font-family:Inter,'Segoe UI',Arial,sans-serif;color:#10231f;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{{preheader}}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:{{pageBackground}};">
                <tr>
                  <td align="center" style="padding:38px 12px;">
                    <table role="presentation" class="verification-shell" width="640" cellpadding="0" cellspacing="0" border="0" style="width:640px;max-width:640px;background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(15,23,42,.13);">
                      <tr>
                        <td style="height:7px;background-color:{{primaryColor}};background-image:linear-gradient(90deg,{{primaryColor}},{{secondaryColor}});font-size:0;line-height:0;">&nbsp;</td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:30px 48px 22px;background-color:#ffffff;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="left" valign="middle">{{logo}}</td>
                              <td align="right" valign="middle">
                                <span style="display:inline-block;padding:8px 13px;border:1px solid {{borderColor}};border-radius:999px;background:{{softerPrimary}};color:{{secondaryColor}};font-size:12px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;">Secure verification</span>
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
                                <h1 class="hero-title" style="margin:0 0 11px;color:{{heroForeground}};font-size:36px;line-height:43px;font-weight:800;letter-spacing:-1px;">Verify your email</h1>
                                <p style="margin:0;color:{{heroForeground}};opacity:.84;font-size:16px;line-height:26px;">One quick step keeps your account protected and ready to use.</p>
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
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{{softerPrimary}};border:1px solid {{borderColor}};border-radius:20px;">
                            <tr>
                              <td align="center" style="padding:26px 16px 12px;">
                                <div style="margin-bottom:15px;color:{{mutedBrandText}};font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;">Your verification code</div>
                                {{codeBadge}}
                                <div style="margin-top:11px;color:#80918d;font-size:11px;line-height:17px;">Select or tap and hold the code to copy it.</div>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:10px 16px 25px;">
                                <span style="display:inline-block;padding:8px 13px;border-radius:999px;background:#ffffff;border:1px solid {{borderColor}};color:{{primaryColor}};font-size:12px;line-height:18px;font-weight:800;">⏱ Expires in {{expiresInMinutes}} minute{{plural}}</span>
                                <div style="margin-top:9px;color:#80918d;font-size:11px;line-height:17px;">{{expiryText}}</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <tr>
                        <td class="mobile-padding" style="padding:18px 48px 8px;background:#ffffff;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid {{primaryColor}};background:{{softPrimary}};border-radius:12px;">
                            <tr>
                              <td style="padding:15px 16px;">
                                <p style="margin:0 0 4px;color:{{secondaryColor}};font-size:13px;line-height:20px;font-weight:800;">Keep this code private</p>
                                <p style="margin:0;color:{{mutedBrandText}};font-size:12px;line-height:19px;">{{companyName}} will never ask you to share this code by phone, chat, or another email.</p>
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
                        <td class="mobile-padding" style="padding:24px 48px;background:{{softerPrimary}};border-top:1px solid {{borderColor}};">
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
        string primaryForeground,
        string softPrimary,
        string borderColor)
    {
        var logoUrl = CleanText(brand.LogoUrl, string.Empty);
        if (Uri.TryCreate(logoUrl, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
        {
            return $"""
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:12px;">
                      <img src="{Html(uri.AbsoluteUri)}" width="44" height="44" alt="{encodedCompanyName}" style="width:44px;height:44px;object-fit:contain;border-radius:13px;background:{softPrimary};border:1px solid {borderColor};">
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

    private static string BuildCodeBadge(
        string code,
        string primaryColor,
        string secondaryColor,
        string borderColor)
    {
        var safeCode = new string(code.Where(char.IsDigit).Take(6).ToArray());
        if (safeCode.Length != 6)
            throw new InvalidOperationException("The verification code must contain exactly six digits.");

        return $"""
            <div class="verification-code" role="text" aria-label="Verification code {Html(safeCode)}" style="display:inline-block;min-width:250px;box-sizing:border-box;padding:19px 24px;border:1px solid {borderColor};border-bottom:4px solid {primaryColor};border-radius:15px;background:#ffffff;color:{secondaryColor};font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:34px;line-height:38px;font-weight:900;letter-spacing:9px;text-align:center;white-space:nowrap;user-select:all;-webkit-user-select:all;cursor:text;box-shadow:0 10px 28px rgba(15,23,42,.07);">{Html(safeCode)}</div>
            """;
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
        var words = RequireText(companyName, "Company name")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (words.Length == 1)
            return words[0][..Math.Min(2, words[0].Length)].ToUpperInvariant();
        return $"{words[0][0]}{words[^1][0]}".ToUpperInvariant();
    }

    private static string RequireHexColor(string? value, string name)
    {
        var color = RequireText(value, name);
        if (color.Length == 4 && color[0] == '#' && color[1..].All(Uri.IsHexDigit))
            return $"#{color[1]}{color[1]}{color[2]}{color[2]}{color[3]}{color[3]}".ToLowerInvariant();
        if (color.Length == 7 && color[0] == '#' && color[1..].All(Uri.IsHexDigit))
            return color.ToLowerInvariant();

        throw new InvalidOperationException($"{name} must use the #RRGGBB format before verification emails can be sent.");
    }

    private static string MixColors(string first, string second, double secondWeight)
    {
        var weight = Math.Clamp(secondWeight, 0, 1);
        var firstRed = Convert.ToInt32(first.Substring(1, 2), 16);
        var firstGreen = Convert.ToInt32(first.Substring(3, 2), 16);
        var firstBlue = Convert.ToInt32(first.Substring(5, 2), 16);
        var secondRed = Convert.ToInt32(second.Substring(1, 2), 16);
        var secondGreen = Convert.ToInt32(second.Substring(3, 2), 16);
        var secondBlue = Convert.ToInt32(second.Substring(5, 2), 16);

        var red = (int)Math.Round(firstRed * (1 - weight) + secondRed * weight);
        var green = (int)Math.Round(firstGreen * (1 - weight) + secondGreen * weight);
        var blue = (int)Math.Round(firstBlue * (1 - weight) + secondBlue * weight);
        return $"#{red:x2}{green:x2}{blue:x2}";
    }

    private static string GetContrastingTextColor(string color)
    {
        var red = Convert.ToInt32(color.Substring(1, 2), 16);
        var green = Convert.ToInt32(color.Substring(3, 2), 16);
        var blue = Convert.ToInt32(color.Substring(5, 2), 16);
        var luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
        return luminance > 0.62 ? "#10231f" : "#ffffff";
    }

    private static string CleanHeaderText(string value) =>
        value.Replace('\r', ' ').Replace('\n', ' ');

    private static string RequireText(string? value, string name)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean)
            ? throw new InvalidOperationException($"{name} must be configured before verification emails can be sent.")
            : clean;
    }

    private static string CleanText(string? value, string fallback)
    {
        var clean = value?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean;
    }

    private static string Html(string value) => WebUtility.HtmlEncode(value);
}
