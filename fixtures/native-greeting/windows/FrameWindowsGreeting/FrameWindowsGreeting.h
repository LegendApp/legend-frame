#pragma once

#include "pch.h"
#include "resource.h"

#include "codegen/NativeGreetingSpec.g.h"

#include "NativeModules.h"

namespace winrt::FrameWindowsGreeting
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

REACT_MODULE(FrameWindowsGreeting, L"NativeGreeting")
struct FrameWindowsGreeting
{
  using ModuleSpec = FrameWindowsGreetingCodegen::GreetingSpec;

  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &reactContext) noexcept;

  REACT_SYNC_METHOD(getGreeting)
  std::string getGreeting() noexcept;

private:
  React::ReactContext m_context;
};

} // namespace winrt::FrameWindowsGreeting