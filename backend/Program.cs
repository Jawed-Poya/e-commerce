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
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

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

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:5174", "http://localhost:4173", "http://localhost:4174"];

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
                    context.HttpContext.Request.Path.StartsWithSegments("/hubs/store-notifications"))
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
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 260L * 1024L * 1024L;
});

var app = builder.Build();

await app.InitializeDatabaseAsync();

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
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseCors("CorsPolicy");
app.UseAuthentication();
app.UseMiddleware<CompanyContextMiddleware>();
app.UseMiddleware<ActivityAuditMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHub<StoreNotificationHub>("/hubs/store-notifications");
app.ValidateAdminEndpointAuthorization();

app.Run();
