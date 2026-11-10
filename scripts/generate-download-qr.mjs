import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import QRCode from 'qrcode';

let repository = process.argv[2] || process.env.GITHUB_REPOSITORY;
if (!repository) {
  repository = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
}
repository = repository
  .replace(/^https:\/\/github\.com\//, '')
  .replace(/^git@github\.com:/, '')
  .replace(/\.git$/, '')
  .replace(/\/$/, '');
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error('Use a GitHub repository URL or OWNER/REPOSITORY.');
}

const downloadUrl = `https://github.com/${repository}/releases/download/android-demo/petcare.apk`;
await mkdir('downloads', { recursive: true });
await QRCode.toFile('downloads/petcare-download-qr.png', downloadUrl, {
  width: 600,
  margin: 4,
  errorCorrectionLevel: 'M',
});
await writeFile('downloads/download-url.txt', downloadUrl + '\n');
await writeFile(
  'downloads/release-notes.md',
  `# Petcare for Android

[Download the APK](${downloadUrl}) or scan the QR below.

![Scan to download Petcare](https://github.com/${repository}/releases/download/android-demo/petcare-download-qr.png)

1. Download petcare.apk on your Android phone.
2. Open it and allow installation from your browser when Android asks.
3. Install Petcare and create an account. A made-up address such as alex@petcare.test works.

This is a signed debug APK for a school demo. Internet is needed for Supabase accounts, records, and photos.
`,
);
console.log('QR saved: downloads/petcare-download-qr.png');
console.log('APK download: ' + downloadUrl);
