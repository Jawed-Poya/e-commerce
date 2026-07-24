using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ECommerce.Migrations;

public partial class UpdateMultilingualFontDefaults : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[TenantSettings]
                SET [DariFontFamily] = N'B Nazanin'
                WHERE NULLIF(LTRIM(RTRIM([DariFontFamily])), N'') IS NULL
                   OR [DariFontFamily] = N'Vazirmatn';

                UPDATE [dbo].[TenantSettings]
                SET [PashtoFontFamily] = N'Bahij TheSansArabic'
                WHERE NULLIF(LTRIM(RTRIM([PashtoFontFamily])), N'') IS NULL
                   OR [PashtoFontFamily] = N'Noto Sans Arabic';
            END;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            IF OBJECT_ID(N'[dbo].[TenantSettings]', N'U') IS NOT NULL
            BEGIN
                UPDATE [dbo].[TenantSettings]
                SET [DariFontFamily] = N'Vazirmatn'
                WHERE [DariFontFamily] = N'B Nazanin';

                UPDATE [dbo].[TenantSettings]
                SET [PashtoFontFamily] = N'Noto Sans Arabic'
                WHERE [PashtoFontFamily] = N'Bahij TheSansArabic';
            END;
            """);
    }
}
