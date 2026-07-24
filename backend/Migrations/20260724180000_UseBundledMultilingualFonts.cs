using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

public partial class UseBundledMultilingualFonts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[TenantSettings]
                SET [DariFontFamily] = N'Vazirmatn'
                WHERE NULLIF(LTRIM(RTRIM([DariFontFamily])), N'') IS NULL
                   OR [DariFontFamily] = N'B Nazanin';

                UPDATE [dbo].[TenantSettings]
                SET [PashtoFontFamily] = N'Noto Sans Arabic'
                WHERE NULLIF(LTRIM(RTRIM([PashtoFontFamily])), N'') IS NULL
                   OR [PashtoFontFamily] = N'Bahij TheSansArabic';
            END;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Font selections are user preferences. Do not overwrite choices on rollback.
    }
}
