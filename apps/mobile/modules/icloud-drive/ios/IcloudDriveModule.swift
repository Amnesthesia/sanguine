import ExpoModulesCore
import Foundation

// Files in the app's own iCloud Drive container (Documents/), used for the encrypted backup (PLAN.md §6.3). Bytes cross as base64.
public class IcloudDriveModule: Module {
  private let queue = DispatchQueue(label: "app.sanguine.icloud", qos: .utility)

  /// The Documents folder of the container, or nil without an iCloud account or entitlement. Must not run on the main thread.
  private func documents() -> URL? {
    guard FileManager.default.ubiquityIdentityToken != nil,
          let root = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
    let dir = root.appendingPathComponent("Documents", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  private func fileURL(_ name: String) throws -> URL {
    guard !name.isEmpty, !name.contains("/"), !name.hasPrefix("."), let dir = documents() else { throw IcloudError.unavailable }
    return dir.appendingPathComponent(name)
  }

  private func onQueue<T>(_ work: @escaping () throws -> T) async throws -> T {
    try await withCheckedThrowingContinuation { cont in
      queue.async { cont.resume(with: Result { try work() }) }
    }
  }

  public func definition() -> ModuleDefinition {
    Name("IcloudDrive")

    AsyncFunction("isAvailable") { () async throws -> Bool in
      try await self.onQueue { self.documents() != nil }
    }

    AsyncFunction("write") { (name: String, base64: String) async throws in
      guard let data = Data(base64Encoded: base64) else { throw IcloudError.badData }
      try await self.onQueue {
        let url = try self.fileURL(name)
        var failure: NSError?
        var written: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &failure) { target in
          do { try data.write(to: target, options: .atomic) } catch { written = error }
        }
        if let failure { throw failure }
        if let written { throw written }
      }
    }

    AsyncFunction("read") { (name: String) async throws -> String? in
      try await self.onQueue {
        let url = try self.fileURL(name)
        // a file that is in iCloud but not on this phone yet: ask for it and wait a little
        try? FileManager.default.startDownloadingUbiquitousItem(at: url)
        for _ in 0..<40 where !FileManager.default.fileExists(atPath: url.path) { Thread.sleep(forTimeInterval: 0.25) }
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        var failure: NSError?
        var out: Data?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &failure) { source in out = try? Data(contentsOf: source) }
        if let failure { throw failure }
        return out?.base64EncodedString()
      }
    }

    AsyncFunction("list") { () async throws -> [[String: Any]] in
      try await self.onQueue {
        guard let dir = self.documents() else { throw IcloudError.unavailable }
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        let urls = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: keys)
        let iso = ISO8601DateFormatter()
        return urls.filter { !$0.lastPathComponent.hasPrefix(".") }.map { u in
          let v = try? u.resourceValues(forKeys: Set(keys))
          return ["name": u.lastPathComponent, "modifiedAt": iso.string(from: v?.contentModificationDate ?? Date(timeIntervalSince1970: 0)), "size": v?.fileSize ?? 0]
        }
      }
    }

    AsyncFunction("remove") { (name: String) async throws in
      try await self.onQueue {
        let url = try self.fileURL(name)
        var failure: NSError?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &failure) { target in try? FileManager.default.removeItem(at: target) }
        if let failure { throw failure }
      }
    }
  }
}

enum IcloudError: Error { case unavailable, badData }
