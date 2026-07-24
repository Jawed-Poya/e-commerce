# Multilingual UI fonts

The admin and storefront choose a font automatically from the active language and the tenant's Appearance settings.

## English

- Inter (default body)
- Manrope (preferred headings)
- Poppins
- Segoe UI
- Arial

## Dari

- B Nazanin (default body)
- B Mitra
- B Wahid
- B Titr (preferred headings)
- Vazirmatn
- Noto Sans Arabic
- Tahoma

## Pashto

- Bahij TheSansArabic (default body)
- Bahij Nassim
- Bahij Nazanin
- Bahij Roya
- Bahij SultanNahia
- Bahij Tanseek Pro
- Bahij Titr (preferred headings)
- Bahij Traffic
- Bahij Uthman Taha
- Bahij Yakout
- Bahij Yekan
- Bahij Zar
- Noto Sans Arabic
- Tahoma

The repository intentionally does not redistribute proprietary font binaries. CSS `local()` aliases activate these families when they are installed on the device. The application then falls back to Noto Sans Arabic, Tahoma, Segoe UI, or the system sans-serif stack. Install only font files whose license permits your intended deployment.
