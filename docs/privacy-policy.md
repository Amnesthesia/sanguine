# Sanguine Privacy Policy

Last updated: October 2026

## 1. Overview and APP Entity Status
Sanguine is a free on-device menstrual-cycle tracking application for iOS and Android. It is not a contraceptive and is not a medical device. Sanguine does not provide medical opinions or screen for medical conditions.

Sanguine is operated by its developer, who can be contacted at admin@dothings.lol. Although the application operates without central servers or backend databases, Sanguine is treated as an APP entity bound by the Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth). This document sets out how personal and health information is handled.

## 2. Collection Notice (APP 5)
Sanguine keeps no personal information on remote servers. All entries remain on your physical device. The one thing that leaves it is the update check described in section 6, which carries a random installation identifier and no health or cycle information.

- What you log: Menstrual cycle dates, bleeding flow intensity, cycle symptoms, basal body temperature, cervical mucus observations, ovulation test results, personal notes, and optional sexual activity records. These entries constitute sensitive health information.
- Purpose of collection: To compute cycle estimates, display calendar visualisations, and present personal history entirely on your device.
- Direct entry: You enter this information directly. There is no background surveillance, no location tracking, and no cross-app monitoring.
- Absence of trackers: Sanguine includes no user accounts, no analytics SDKs, no crash-reporting SDKs, and no advertising frameworks. We cannot view, access, or monetise your entries.
- Age restriction: Sanguine is intended for people aged 13 and older. For users aged 13 to 17, the application activates teen mode by default, which disables sexual activity logging and fertility estimate cards until explicitly adjusted in Settings.

## 3. Local Storage and Cryptography
All application data resides exclusively in a local database on your phone. Starting from the first native release, this database is encrypted using SQLCipher. You can further secure access using the in-app biometric or passcode lock.

## 4. Optional Backups and Platform Sync
- Optional encrypted backup: You can choose to create end-to-end encrypted backups stored in your personal iCloud Drive or Google Drive application folder. Backups use Argon2id key derivation XORed with a device-generated secret, alongside XChaCha20-Poly1305 encryption. The developer cannot decrypt or read these backups; only your personal passphrase and device secret can decrypt the file.
- Using Sanguine on more than one phone: if the automatic encrypted copy is on, each phone first downloads the copy already in your iCloud Drive or Google Drive application folder, decrypts it on the phone and merges its entries, then uploads the merged copy. A second phone joins only when you enter the first phone's recovery code and passphrase on it. The copy never passes through a server of the developer, and the developer cannot read it. Deleting everything on one phone does not delete the entries on your other phones or the copy in your cloud folder.
- Optional health sync: Sanguine can sync with Apple Health or Health Connect. This is off by default and you choose each data category yourself in Settings. What you log here is written to the health store only for the categories you switch on; wrist temperature is read and never written. Data in Apple Health or Health Connect is subject to Apple or Google terms and permissions, and a backup never contains records that were only imported from Apple Health.

## 5. Access and Correction (APP 12 and APP 13)
Because the developer maintains no central user accounts and holds no copy of your records, you exercise access, export, correction, and deletion directly within the application:
- Access and export: You can export your entire event log at any time as JSON or CSV files via Settings -> Privacy and data.
- Calendar file: Settings -> Privacy and data -> Add to someone's calendar creates a calendar file holding only your predicted period date range (and, if you choose, your estimated fertile date range), under event titles you choose. The file goes only where you send it through your phone's share sheet; once sent, it is in the recipient's calendar and outside Sanguine's control.
- Correction: You can edit or retract any logged entry directly on the day detail screen.
- Erasure: You can permanently erase all data on your device at any time by selecting "Delete everything" in Settings -> Privacy and data.

## 6. Disclosure and Secondary Use (APP 6 and APP 8)
Sanguine does not disclose, transmit, sell, or rent your health information to third parties, commercial brokers, or overseas recipients. Cycle data never leaves your device unless you independently export your data or enable optional encrypted backups to your personal cloud account. When it starts, the app asks Expo's update service (expo.dev, operated by 650 Industries in the United States) whether a newer version of the app's code is available, and downloads it if so. That request carries no health or cycle information: only the app version, the device platform, a random installation identifier the update service uses, and your IP address, as with any internet request.

## 7. Notifiable Data Breach (NDB) Procedure
Under the Australian Notifiable Data Breach scheme, entities must assess suspected data breaches and notify affected individuals and the OAIC if serious harm is likely. Because Sanguine stores no information on external servers, the developer cannot suffer a central server data breach.

If a critical security defect is identified in the application code that compromises on-device encryption:
1. Investigation: The developer will investigate and evaluate the defect within 30 days of becoming aware of it, as the Notifiable Data Breaches scheme requires for an assessment.
2. Remediation: A software update containing a fix will be published via app store channels immediately.
3. Notification: If an eligible data breach occurs under the Privacy Act, notice will be provided through app release notes, public project channels, and formal notification to the Office of the Australian Information Commissioner (OAIC).

## 8. Contact and Complaints
If you have questions, feedback, or complaints regarding privacy, contact:
- Privacy contact: the Sanguine developer
- Email: admin@dothings.lol

Complaints will be acknowledged within 7 days and answered within 30 days. If you remain dissatisfied with the response, you can lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at enquiries@oaic.gov.au or by calling 1300 363 992.
