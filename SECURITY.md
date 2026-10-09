# Security

Sanguine keeps all data on the device. There is no server to attack; the relevant surfaces are the local database (SQLCipher, key in the system keystore), the encrypted backup file (`packages/crypto`, format in PLAN.md §6.3), the import parsers (`apps/mobile/src/data/import*.ts`) and the health-sync boundary (`packages/health-adapter`).

To report a vulnerability, email the maintainer at admin@dothings.lol. Do not include real health data in a report. Please allow a reasonable time to respond before publishing details.

Out of scope: findings that need a rooted or jailbroken device with the app unlocked, and the loss of data when a user loses both a backup passphrase and its recovery code (that is by design, PLAN.md §6.3).
