// Metro resolves image imports to an asset id; `expo-env.d.ts` is generated only by `expo start`, so declare it here.
declare module '*.png' {
  const asset: number;
  export default asset;
}
