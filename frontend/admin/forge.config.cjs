const path = require('node:path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseVersion, FuseV1Options } = require('@electron/fuses');

const iconBase = path.join(__dirname, 'desktop', 'assets', 'easycart-admin');

module.exports = {
    packagerConfig: {
        name: 'EasyCart Admin',
        executableName: 'EasyCartAdmin',
        icon: iconBase,
        asar: true,
        ignore: [
            /^\/node_modules($|\/)/,
            /^\/src($|\/)/,
            /^\/public($|\/)/,
            /^\/\.env/,
            /^\/\.gitignore$/,
            /^\/dist-desktop($|\/)/,
            /^\/out($|\/)/,
            /^\/tsconfig/,
            /^\/vite\.config/,
            /^\/package-lock\.json$/,
        ],
    },
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'easycart_admin',
                authors: 'EasyCart',
                description: 'EasyCart administration desktop application',
                setupExe: 'EasyCart-Admin-Setup.exe',
                setupIcon: `${iconBase}.ico`,
                noMsi: true,
            },
        },
    ],
    plugins: [
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
