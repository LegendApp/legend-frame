#include "pch.h"

#include "SparkWindowsGreeting.h"

namespace winrt::SparkWindowsGreeting
{

// See https://microsoft.github.io/react-native-windows/docs/native-platform for help writing native modules

void SparkWindowsGreeting::Initialize(React::ReactContext const &reactContext) noexcept {
  m_context = reactContext;
}

std::string SparkWindowsGreeting::getGreeting() noexcept {
  return "Hello from the custom native module";
}

} // namespace winrt::SparkWindowsGreeting