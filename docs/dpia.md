DRAFT, not legal advice, to be reviewed by a human before publication

# GDPR Article 35 Privacy Impact Assessment (DPIA) — Sanguine

Last updated: October 2026

## 1. Administrative Context and Controller Details
This assessment evaluates processing operations within Sanguine, a free on-device menstrual-cycle tracker for iOS and Android. Sanguine is not a contraceptive and is not a medical device.

- Data Controller: TBD (human)
- EU/UK Representative: TBD (human)
- Data Privacy Contact: TBD (human)

## 2. Description of Processing Operations
- Nature of data: Special category personal data under GDPR Article 9(1), comprising health data (menstrual dates, flow intensity, basal body temperature, cervical mucus observations, ovulation tests, symptoms, notes) and optional data concerning sexual life.
- Architecture: Zero remote transmission. The application has no user accounts, operates no servers, and contains no analytics SDKs, crash trackers, or advertising SDKs.
- Local storage: All data is written to a local database encrypted with SQLCipher from the first native release.
- Optional backup: Users can configure end-to-end encrypted backup files to their personal iCloud Drive or Google Drive application folder. Backups use Argon2id and XChaCha20-Poly1305 encryption. The developer cannot decrypt or inspect these files.
- Optional platform sync: Future releases will provide optional sync with Apple Health or Health Connect, configured strictly per data category.

## 3. Necessity, Proportionality, and Lawful Basis
- Lawful basis: Explicit consent under GDPR Article 9(2)(a), obtained via a dedicated onboarding checkbox, shown for EU, EEA, UK and Swiss regions (and when the region is unknown), before anything is saved: answers given in earlier steps are held in memory and written only when the person finishes, after consent. The record (version, time, basis) is kept on the phone and shown in Settings > Privacy and data. Users may withdraw consent at any time.
- Proportionality: Sanguine processes only the specific data points entered by the user to calculate cycle estimates and display calendar views. No secondary processing or automated profiling occurs.
- Data minimisation: Age, entered as a date of birth (D-055, so the minimum age of 13 is checked exactly), is the sole required onboarding field to confirm eligibility. All other logging is optional. Data stays on the device until erased by the user.

## 4. Assessment of Hazards, Mitigations, and Residual Levels

### 4.1 Device Theft or Unauthorised Physical Access
- Potential impact: Unauthorised exposure of personal cycle and symptom history if the physical device is unlocked or stolen.
- Mitigations: Local database encrypted via SQLCipher from the initial release; biometric and passcode app lock enabled with automatic timeout; screen blurring in app switchers (`FLAG_SECURE` on Android, overlay on iOS); sensitive notes double-encrypted.
- Residual level: Low.

### 4.2 Backup Interception or Cloud Compromise
- Potential impact: Extraction of cycle data from the user's personal cloud drive account.
- Mitigations: Encrypted blob design combines Argon2id passphrase derivation with a 256-bit device secret stored in hardware Secure Store; symmetric encryption uses XChaCha20-Poly1305; files reside in the user's private cloud folder; the developer never receives or stores keys or ciphertext.
- Residual level: Low.

### 4.3 Health Store Integration Exposure (Apple Health / Health Connect)
- Potential impact: Third-party applications on the device accessing cycle entries stored in the operating system health store.
- Mitigations: Integration is disabled by default; requires granular, per-category opt-in; clear permission copy explains platform access; samples imported from Apple Health are excluded from backups (identified by the prefix the sync gives their external id, `healthkit:`, and checked by a test); a sync pass cannot run while "Delete everything" is deleting data; sexual activity syncs only while its logging is on, which is off by default and hidden under 18.
- Residual level: Low.

### 4.4 Minor and Youth Privacy (Children Under Statutory Age)
- Potential impact: Minors accessing the service without age-appropriate privacy settings.
- Mitigations: Minimum age of 13 enforced at onboarding; users aged 13 to 17 enter teen mode by default, which hides sexual activity tracking, suppresses fertility estimate cards, and applies adolescent cycle thresholds.
- Residual level: Low.

## 5. Exercise of Data Subject Rights
- Right of access and data portability (Articles 15 and 20): Available directly in the app via Settings -> Privacy and data -> Export (producing JSON and CSV files).
- Right to rectification and erasure (Articles 16 and 17): Users can modify any entry on the day view or tap "Delete everything" in Settings to instantly wipe all local data.
- Right to withdraw consent (Article 7(3)): Users can stop logging or erase all local data at any time.
- Inquiries: Managed by Controller / Representative: TBD (human).

## 6. Review and Sign-off
Because of the on-device architecture, zero-server footprint, and strong cryptographic controls, the overall residual hazard level is Low.
- Reviewer: TBD (human)
- Status: Awaiting human review
