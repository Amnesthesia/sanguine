import type { SanguineData } from '../format/sanguineData';
export interface PickedFile { name: string; bytes: Uint8Array }
export interface Decoded { data: SanguineData; problems: string[] }
export interface FormatAdapter {
  id: string; // also source_app and external_id prefix
  detect(f: PickedFile): 'yes' | 'needs_password' | 'no';
  decode(f: PickedFile, o: { password?: string }): Decoded;
  encode?(d: SanguineData): PickedFile;
}
