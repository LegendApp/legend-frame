import XCTest

final class SDKUITests: XCTestCase {
  @MainActor
  func testNativeSDK() throws {
    let file = Bundle(for: Self.self).url(forResource: "configuration", withExtension: "json")!
    let config = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: String]
    let app = XCUIApplication(url: URL(fileURLWithPath: config["app"]!))
    app.launchEnvironment = ["SPARK_BUNDLE_URL": config["bundleURL"]!]
    app.launchArguments = ["-RCT_jsLocation", config["location"]!, "--spark-test-report", config["report"]!, "--spark-test-quit-on-complete"]
    app.launch()
    defer { if app.state != .notRunning { app.terminate() } }

    // Other panel checks cancel themselves. Wait for the specific acceptance
    // case before interacting with the remote system file-panel view.
    let name = app.textFields["saveAsNameTextField"]
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND value BEGINSWITH %@", "accepted"), object: name)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 60), .completed)
    let save = app.buttons["OKButton"]
    XCTAssertTrue(save.waitForExistence(timeout: 10))
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = "Native save acceptance"
    attachment.lifetime = .keepAlways
    add(attachment)
    save.click()

    let report = config["report"]!
    let written = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in FileManager.default.fileExists(atPath: report) }, object: nil)
    XCTAssertEqual(XCTWaiter.wait(for: [written], timeout: 120), .completed)
    let result = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: report))) as! [String: Any]
    XCTAssertEqual(result["passed"] as? Bool, true, "Native SDK checks failed: \(result)")
    XCTAssertTrue(app.wait(for: .notRunning, timeout: 15), "Accepted guarded quit must terminate the app")
  }
}
