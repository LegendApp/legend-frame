require "xcodeproj"
root = ARGV.fetch(0)
project = Xcodeproj::Project.new(File.join(root, "SDKUITests.xcodeproj"))
target = project.new_target(:ui_test_bundle, "SDKUITests", :osx, "14.0")
target.add_file_references([project.main_group.new_file("SDKUITests.swift")])
target.resources_build_phase.add_file_reference(project.main_group.new_file("configuration.json"))
target.build_configurations.each do |config|
  config.build_settings["SWIFT_VERSION"] = "5.0"
  config.build_settings["GENERATE_INFOPLIST_FILE"] = "YES"
  config.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = "so.legend.spark.sdk.ui-tests"
  config.build_settings["CODE_SIGN_IDENTITY"] = "-"
  config.build_settings["CODE_SIGN_STYLE"] = "Manual"
  config.build_settings["ENABLE_HARDENED_RUNTIME"] = "NO"
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.test_action.build_configuration = "Debug"
scheme.save_as(File.join(root, "SDKUITests.xcodeproj"), "SDKUITests", true)
