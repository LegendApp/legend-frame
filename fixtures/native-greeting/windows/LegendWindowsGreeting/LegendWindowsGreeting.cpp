#include "pch.h"

#include "LegendWindowsGreeting.h"

namespace winrt::LegendWindowsGreeting
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

void LegendWindowsGreeting::Initialize(React::ReactContext const &reactContext) noexcept {
  m_context = reactContext;
}

std::string LegendWindowsGreeting::getGreeting() noexcept {
  return "Hello from the custom native module";
}

} // namespace winrt::LegendWindowsGreeting