// Legend development runtime, compiled into the Expo Desktop Win32 host.
#include <string>
#include <cstdlib>
#include <cstdint>
#include <cwchar>

static std::wstring LegendWindowsEnv(const wchar_t *name) {
  const DWORD size = GetEnvironmentVariableW(name, nullptr, 0);
  if (!size) return {};
  std::wstring value(size, L'\0');
  const DWORD written = GetEnvironmentVariableW(name, value.data(), size);
  if (!written || written >= size) return {};
  value.resize(written);
  return value;
}
static uint16_t LegendMetroPort() {
  auto value = LegendWindowsEnv(L"LEGEND_METRO_PORT");
  wchar_t *end = nullptr;
  const auto port = wcstoul(value.c_str(), &end, 10);
  return !value.empty() && end && *end == 0 && port > 0 && port <= 65535
    ? static_cast<uint16_t>(port) : 8081;
}
REACT_MODULE(NativeLegendRuntime)
struct NativeLegendRuntime {
  REACT_SYNC_METHOD(describe)
  std::string describe() noexcept {
    return R"legend(__LEGEND_METADATA__)legend";
  }
  REACT_SYNC_METHOD(server)
  std::string server() noexcept { return "http://127.0.0.1:" + std::to_string(LegendMetroPort()); }
  REACT_SYNC_METHOD(session)
  std::string session() { return winrt::to_string(LegendWindowsEnv(L"LEGEND_SESSION_TOKEN")); }
};
