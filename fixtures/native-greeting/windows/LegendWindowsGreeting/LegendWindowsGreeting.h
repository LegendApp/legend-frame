#pragma once

#include "pch.h"
#include "resource.h"

#if __has_include("codegen/NativeLegendWindowsGreetingDataTypes.g.h")
  #include "codegen/NativeLegendWindowsGreetingDataTypes.g.h"
#endif
// Note: The following lines use Mustache template syntax which will be processed during
// project generation to produce standard C++ code. If existing codegen spec files are found,
// use the actual filename; otherwise use conditional includes.
#if __has_include("codegen/NativeLegendWindowsGreetingSpec.g.h")
  #include "codegen/NativeLegendWindowsGreetingSpec.g.h"
#endif

#include "NativeModules.h"

namespace winrt::LegendWindowsGreeting
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

REACT_MODULE(LegendWindowsGreeting, L"NativeGreeting")
struct LegendWindowsGreeting
{
  // Note: Mustache template syntax below will be processed during project generation
  // to produce standard C++ code based on detected codegen files.
#if __has_include("codegen/NativeLegendWindowsGreetingSpec.g.h")
  using ModuleSpec = LegendWindowsGreetingCodegen::LegendWindowsGreetingSpec;
#endif

  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &reactContext) noexcept;

  REACT_SYNC_METHOD(getGreeting)
  std::string getGreeting() noexcept;

private:
  React::ReactContext m_context;
};

} // namespace winrt::LegendWindowsGreeting