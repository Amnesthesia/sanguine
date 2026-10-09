// Device side of the report for a doctor (P8-6, D-084): print the HTML to a PDF on the phone, hand it to the share sheet, delete it.
import { File } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { removeTempFile } from './tempFiles';

export async function shareReportPdf(html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  const file = new File(uri);
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Report' });
  } finally {
    removeTempFile(file);
  }
}
