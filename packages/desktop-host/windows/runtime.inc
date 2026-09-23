// Frame development runtime, compiled into the Expo Desktop Win32 host.
#include <string>
#include <shellapi.h>
#include <winrt/Windows.Foundation.h>
#include <cstdlib>
#include <cstdint>
#include <cwchar>
#include <fstream>
#include <filesystem>
#include <winrt/Windows.Data.Json.h>

static std::wstring FrameWindowsEnv(const wchar_t *name) {
  const DWORD size = GetEnvironmentVariableW(name, nullptr, 0);
  if (!size) return {};
  std::wstring value(size, L'\0');
  const DWORD written = GetEnvironmentVariableW(name, value.data(), size);
  if (!written || written >= size) return {};
  value.resize(written);
  return value;
}
static void FrameInitializeEnvironment() {
  const auto defaults = winrt::Windows::Data::Json::JsonObject::Parse(LR"frame(__FRAME_PROJECT_CONFIG__)frame");
  for (auto const &item : defaults) if (FrameWindowsEnv(item.Key().c_str()).empty()) SetEnvironmentVariableW(item.Key().c_str(), item.Value().GetString().c_str());
  // Shell task activations carry their project context even in the shared prebuilt executable.
  int count = 0; auto argv = CommandLineToArgvW(GetCommandLineW(), &count);
  if (argv) {
    try {
      for (int i = 1; i < count; ++i) {
        std::wstring argument(argv[i]); const std::wstring prefix = L"--frame-context=";
        if (argument.rfind(prefix, 0) != 0) continue;
        auto context = winrt::Windows::Data::Json::JsonObject::Parse(winrt::Windows::Foundation::Uri::UnescapeComponent(argument.substr(prefix.size())));
        for (auto key : {L"FRAME_PROJECT_ID", L"FRAME_PROJECT_NAME", L"FRAME_PROJECT_VERSION", L"FRAME_WINDOW_CONFIG", L"FRAME_SESSION_FILE"})
          if (context.HasKey(key)) SetEnvironmentVariableW(key, context.GetNamedString(key).c_str());
      }
    } catch (...) { LocalFree(argv); throw; }
    LocalFree(argv);
  }
}
static uint16_t FrameMetroPort() {
  auto value = FrameWindowsEnv(L"FRAME_METRO_PORT");
  if (value.empty()) {
    std::ifstream file(std::filesystem::path(FrameWindowsEnv(L"FRAME_SESSION_FILE")), std::ios::binary);
    if (file) try {
      auto state = winrt::Windows::Data::Json::JsonObject::Parse(winrt::to_hstring(std::string(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>())));
      value = std::to_wstring(static_cast<int>(state.GetNamedNumber(L"port", 8081)));
    } catch (...) {}
  }
  wchar_t *end = nullptr;
  const auto port = wcstoul(value.c_str(), &end, 10);
  return !value.empty() && end && *end == 0 && port > 0 && port <= 65535
    ? static_cast<uint16_t>(port) : 8081;
}
REACT_MODULE(NativeFrameRuntime)
struct NativeFrameRuntime {
  REACT_SYNC_METHOD(describe)
  std::string describe() noexcept {
    return R"frame(__FRAME_METADATA__)frame";
  }
  REACT_SYNC_METHOD(server)
  std::string server() noexcept { return "http://127.0.0.1:" + std::to_string(FrameMetroPort()); }
  REACT_SYNC_METHOD(session)
  std::string session() noexcept { return winrt::to_string(FrameWindowsEnv(L"FRAME_SESSION_TOKEN")); }
};
