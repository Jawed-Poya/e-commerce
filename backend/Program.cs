using System.Text;
using System.Text.Json.Serialization;
using System.Security.Claims;
using ECommerce.Options;
using ECommerce.Shared;
using ECommerce.Services.Notifications;
using ECommerce.Services.Company;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.FileProviders;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
var pdfArabicFontPath = Path.Combine(
    builder.Environment.ContentRootPath,
    "Assets",
    "Fonts",
    "NotoSansArabic-Variable.ttf");
using (var pdfArabicFont = File.OpenRead(pdfArabicFontPath))
    QuestPDF.Drawing.FontManager.RegisterFont(pdfArabicFont);

builder.Services
    .AddControllers(options =>
    {
        options.ModelBinderProviders.Insert(0, new StableCancellationTokenModelBinderProvider());
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddCatalog();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSignalR();

var configuredOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>();

var allowedOrigins = (configuredOrigins ?? [])
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

if (allowedOrigins.Length == 0)
{
    allowedOrigins =
    [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:4173",
        "http://localhost:4174"
    ];
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("JWT configuration is missing.");
if (string.IsNullOrWhiteSpace(jwt.Key) || Encoding.UTF8.GetByteCount(jwt.Key) < 32)
    throw new InvalidOperationException("Jwt:Key must be at least 32 bytes long.");

// AddIdentity registers its application cookie as the explicit default
// authenticate/challenge scheme. Setting only DefaultScheme here is not
// enough because AuthenticationOptions prefers DefaultAuthenticateScheme and
// DefaultChallengeScheme when they are already populated by Identity.
// Force API authorization to authenticate Bearer tokens for every [Authorize]
// endpoint while leaving Identity available for user/role management.
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultForbidScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                if (!string.IsNullOrWhiteSpace(accessToken) &&
                    (context.HttpContext.Request.Path.StartsWithSegments("/hubs/store-notifications") ||
                     context.HttpContext.Request.Path.StartsWithSegments("/api/hubs/store-notifications")))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    foreach (var permission in AppPermissions.All)
    {
        options.AddPolicy(permission, policy =>
            policy.RequireAssertion(context =>
                AppPermissions.IsGranted(context.User, permission)));
    }

    options.AddPolicy(AppPermissions.AdminNotificationsViewPolicy, policy =>
        policy.RequireAssertion(context =>
            AppPermissions.IsGranted(context.User, AppPermissions.OrdersView) ||
            AppPermissions.IsGranted(context.User, AppPermissions.InventoryView) ||
            AppPermissions.IsGranted(context.User, AppPermissions.ReviewsView)));

    options.AddPolicy(AppPermissions.DatabaseMaintenanceAccessPolicy, policy =>
        policy.RequireAssertion(context =>
            AppPermissions.IsGranted(context.User, AppPermissions.DatabaseMaintenanceView) ||
            AppPermissions.IsGranted(context.User, AppPermissions.DatabaseBackup) ||
            AppPermissions.IsGranted(context.User, AppPermissions.DatabaseRestore) ||
            AppPermissions.IsGranted(context.User, AppPermissions.BranchDataClear) ||
            AppPermissions.IsGranted(context.User, AppPermissions.AllBusinessDataClear) ||
            AppPermissions.IsGranted(context.User, AppPermissions.DemoDataSeed)));

    options.AddPolicy(AppPermissions.DatabaseBackupReadPolicy, policy =>
        policy.RequireAssertion(context =>
            AppPermissions.IsGranted(context.User, AppPermissions.DatabaseBackup) ||
            AppPermissions.IsGranted(context.User, AppPermissions.DatabaseRestore)));
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 260L * 1024L * 1024L;
});

var app = builder.Build();

await app.InitializeDatabaseAsync();

if (args.Any(argument => string.Equals(argument, "--seed-demo", StringComparison.OrdinalIgnoreCase)))
{
    await using var seedScope = app.Services.CreateAsyncScope();
    await seedScope.ServiceProvider
        .GetRequiredService<IDemoDataSeeder>()
        .ResetAndSeedAsync();
}

// Resolve the original client IP and scheme before redirects and audit logging.
// The development frontends use the HTTP launch profile by default, so HTTPS
// redirection remains disabled only in development.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    ForwardLimit = 1
});
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseStaticFiles();
var fileStorage = app.Services
    .GetRequiredService<Microsoft.Extensions.Options.IOptions<FileStorageOptions>>()
    .Value;
var uploadRoot = fileStorage.ResolveRootPath(app.Environment);
Directory.CreateDirectory(uploadRoot);
var uploadRequestPath = fileStorage.ResolveRequestPath();
var uploadFileProvider = new PhysicalFileProvider(uploadRoot);
var uploadContentTypes = new FileExtensionContentTypeProvider();
uploadContentTypes.Mappings[".avif"] = "image/avif";

void UseUploadFiles(IFileProvider fileProvider, string requestPath) =>
    app.UseStaticFiles(
        new StaticFileOptions
        {
            FileProvider = fileProvider,
            ContentTypeProvider = uploadContentTypes,
            RequestPath = requestPath,
            ServeUnknownFileTypes = false
        });

// Uploads are public static assets. Keep them outside the /api route so API
// routing, authentication rules, caching, and reverse-proxy policies stay separate.
UseUploadFiles(uploadFileProvider, uploadRequestPath);

app.UseMiddleware<ApiExceptionMiddleware>();
app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseMiddleware<BranchContextMiddleware>();
app.UseMiddleware<ActivityAuditMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHub<StoreNotificationHub>("/hubs/store-notifications");
app.MapHub<StoreNotificationHub>("/api/hubs/store-notifications");
app.ValidateAdminEndpointAuthorization();

app.Run();
