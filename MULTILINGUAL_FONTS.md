# Multilingual UI fonts

The admin application and storefront apply a language-specific font stack automatically from the active language and the tenant's **Company Settings → Appearance** preferences.

## Bundled fonts

These open-source variable fonts are installed through Fontsource and bundled into the Vite production builds. They work on client devices without requiring a font to be installed locally or an internet connection at runtime.

### English

- Inter — default body font
- Manrope — default heading font

### Dari

- Vazirmatn — default body font
- Noto Sans Arabic — UI alternative
- Noto Naskh Arabic — reading-oriented alternative

### Pashto

- Noto Sans Arabic — default body font
- Vazirmatn — UI alternative
- Noto Naskh Arabic — reading-oriented alternative

## Local font choices

The following choices are retained for organizations that already own and install the corresponding fonts on every device:

### Dari local fonts

- B Nazanin
- B Mitra
- B Wahid
- B Titr

### Pashto local fonts

- Bahij TheSansArabic
- Bahij Nassim
- Bahij Nazanin
- Bahij Roya
- Bahij SultanNahia
- Bahij Tanseek Pro
- Bahij Titr
- Bahij Traffic
- Bahij Uthman Taha
- Bahij Yakout
- Bahij Yekan
- Bahij Zar

The repository does not redistribute B or Bahij font binaries. When a selected local font is unavailable, the application falls back automatically to the bundled Arabic-script font stack.

## Important behavior

- Choosing a Dari font changes Dari content; it does not change an English interface until the language is switched to Dari.
- Choosing a Pashto font changes Pashto content; it does not change an English interface until the language is switched to Pashto.
- Company Settings and Platform → Companies → Edit include live English, Dari, and Pashto samples so each choice can be verified immediately.
- Run `npm install` or `npm ci` in both frontend applications after updating the source so Fontsource packages are installed before building.
