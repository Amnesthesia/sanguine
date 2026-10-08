import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { removeTempFile } from './tempFiles';

/** Writes bytes to the cache and opens the system share sheet (the user chooses where the file goes). */
export async function shareFile(bytes: Uint8Array, name: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  } finally {
    removeTempFile(file);
  }
}
