import AppKit
import NitroModules

final class ProbeView: NSView {
  let text = NSTextField(labelWithString: "Waiting for React props")
  override init(frame: NSRect) {
    super.init(frame: frame)
    wantsLayer = true
    layer?.backgroundColor = NSColor.systemTeal.cgColor
    text.textColor = .white
    text.font = .systemFont(ofSize: 18, weight: .semibold)
    addSubview(text)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  override func layout() {
    super.layout()
    text.frame = NSRect(x: 16, y: max(0, bounds.height / 2 - 12), width: max(0, bounds.width - 32), height: 24)
  }
}

final class HybridCompatibilityView: HybridCompatibilityViewSpec {
  let view = ProbeView()
  var drops = 0
  var label: String = "" { didSet { view.text.stringValue = label } }
  func snapshot() throws -> String {
    let read = { () throws -> String in
      let data = try JSONSerialization.data(withJSONObject: ["label": self.view.text.stringValue, "width": self.view.bounds.width, "height": self.view.bounds.height, "attached": self.view.window != nil, "drops": self.drops])
      return String(decoding: data, as: UTF8.self)
    }
    return try Thread.isMainThread ? read() : DispatchQueue.main.sync(execute: read)
  }
  func onDropView() { drops += 1 }
}
