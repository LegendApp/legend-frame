#include "pch.h"

#include "FrameWindowsGreeting.h"

namespace winrt::FrameWindowsGreeting
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

void FrameWindowsGreeting::Initialize(React::ReactContext const &reactContext) noexcept {
  m_context = reactContext;
}

std::string FrameWindowsGreeting::getGreeting() noexcept {
  return "Hello from the custom native module";
}

} // namespace winrt::FrameWindowsGreeting