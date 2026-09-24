#pragma once

#include "pch.h"
#include "resource.h"

#if __has_include("codegen/NativeSparkWindowsGreetingDataTypes.g.h")
  #include "codegen/NativeSparkWindowsGreetingDataTypes.g.h"
#endif
// Note: The following lines use Mustache template syntax which will be processed during
// project generation to produce standard C++ code. If existing codegen spec files are found,
// use the actual filename; otherwise use conditional includes.
#if __has_include("codegen/NativeSparkWindowsGreetingSpec.g.h")
  #include "codegen/NativeSparkWindowsGreetingSpec.g.h"
#endif

#include "NativeModules.h"

namespace winrt::SparkWindowsGreeting
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

REACT_MODULE(SparkWindowsGreeting, L"NativeGreeting")
struct SparkWindowsGreeting
{
  // Note: Mustache template syntax below will be processed during project generation
  // to produce standard C++ code based on detected codegen files.
#if __has_include("codegen/NativeSparkWindowsGreetingSpec.g.h")
  using ModuleSpec = SparkWindowsGreetingCodegen::SparkWindowsGreetingSpec;
#endif

  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &reactContext) noexcept;

  REACT_SYNC_METHOD(getGreeting)
  std::string getGreeting() noexcept;

private:
  React::ReactContext m_context;
};

} // namespace winrt::SparkWindowsGreeting