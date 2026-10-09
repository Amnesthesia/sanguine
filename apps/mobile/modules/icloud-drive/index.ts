import { requireNativeModule } from 'expo-modules-core';

export interface IcloudDriveNative {
  isAvailable(): Promise<boolean>;
  write(name: string, base64: string): Promise<void>;
  read(name: string): Promise<string | null>;
  list(): Promise<Array<{ name: string; modifiedAt: string; size: number }>>;
  remove(name: string): Promise<void>;
}
export default requireNativeModule<IcloudDriveNative>('IcloudDrive');
