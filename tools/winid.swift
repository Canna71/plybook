// Prints the window id of the largest on-screen window owned by a process whose name contains
// the first argument (for `screencapture -l <id>`).
import CoreGraphics
import Foundation

let wanted = CommandLine.arguments.count > 1 ? CommandLine.arguments[1].lowercased() : "plybook"
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
guard let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    exit(1)
}
var best: (id: Int, area: Double)? = nil
for w in list {
    let owner = (w[kCGWindowOwnerName as String] as? String ?? "").lowercased()
    guard owner.contains(wanted), let id = w[kCGWindowNumber as String] as? Int,
          let b = w[kCGWindowBounds as String] as? [String: Double] else { continue }
    let area = (b["Width"] ?? 0) * (b["Height"] ?? 0)
    if area > (best?.area ?? 0) { best = (id, area) }
}
if let best { print(best.id) } else { exit(1) }
