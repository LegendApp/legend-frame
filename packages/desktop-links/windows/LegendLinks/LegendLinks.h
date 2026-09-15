#pragma once
#include "NativeModules.h"
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#pragma comment(lib, "Shlwapi.lib")
#include <shobjidl.h>
#include <winrt/Windows.Security.Cryptography.h>
#include <winrt/Windows.Security.Cryptography.Core.h>
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "Advapi32.lib")
#include <winrt/Windows.System.h>
#include <winrt/Windows.Data.Json.h>
namespace winrt::LegendLinks {
namespace React = Microsoft::ReactNative;
namespace Json = Windows::Data::Json;
inline std::wstring ProjectAppId() {
  DWORD size = GetEnvironmentVariableW(L"LEGEND_PROJECT_ID", nullptr, 0);
  if (!size) throw hresult_invalid_argument(L"Missing project identity");
  std::wstring identity(size, L'\0'); identity.resize(GetEnvironmentVariableW(L"LEGEND_PROJECT_ID", identity.data(), size));
  using namespace Windows::Security::Cryptography;
  auto hash = Core::HashAlgorithmProvider::OpenAlgorithm(Core::HashAlgorithmNames::Sha256());
  return L"Legend." + std::wstring(CryptographicBuffer::EncodeToHexString(hash.HashData(CryptographicBuffer::ConvertStringToBinary(identity, BinaryStringEncoding::Utf8))));
}
struct RecentDocuments {
  HKEY key = nullptr;
  std::wstring appId = ProjectAppId();
  RecentDocuments() { check_win32(RegCreateKeyExW(HKEY_CURRENT_USER, (L"Software\\Legend\\" + appId + L"\\RecentDocuments").c_str(), 0, nullptr, 0, KEY_READ | KEY_WRITE, nullptr, &key, nullptr)); }
  ~RecentDocuments() { if (key) RegCloseKey(key); }
  static void check_win32(LSTATUS status) { if (status != ERROR_SUCCESS) throw hresult_error(HRESULT_FROM_WIN32(status)); }
  Json::JsonArray Read() {
    DWORD size = 0; auto status = RegGetValueW(key, nullptr, L"URLs", RRF_RT_REG_SZ, nullptr, nullptr, &size);
    if (status == ERROR_FILE_NOT_FOUND) return {};
    check_win32(status);
    std::wstring value(size / sizeof(wchar_t), L'\0'); check_win32(RegGetValueW(key, nullptr, L"URLs", RRF_RT_REG_SZ, nullptr, value.data(), &size));
    return Json::JsonArray::Parse(value.c_str());
  }
  void Write(Json::JsonArray const &list) { auto value = list.Stringify(); check_win32(RegSetValueExW(key, L"URLs", 0, REG_SZ, reinterpret_cast<BYTE const *>(value.c_str()), static_cast<DWORD>((value.size() + 1) * sizeof(wchar_t)))); }
  bool ShellEnabled() { wchar_t mode[16]{}; GetEnvironmentVariableW(L"LEGEND_RUNTIME_MODE", mode, 16); return std::wstring(mode) == L"dev"; }
  void Add(hstring const &url) {
    Windows::Foundation::Uri uri(url);
    if (uri.SchemeName() != L"file") throw hresult_invalid_argument(L"Recent documents require file URLs");
    Json::JsonArray next; next.Append(Json::JsonValue::CreateStringValue(uri.AbsoluteUri()));
    for (auto const &entry : Read()) if (entry.GetString() != uri.AbsoluteUri() && next.Size() < 20) next.Append(entry);
    if (ShellEnabled()) {
      DWORD size = 32768; std::wstring path(size, L'\0'); check_hresult(PathCreateFromUrlW(uri.AbsoluteUri().c_str(), path.data(), &size, 0));
      com_ptr<IShellItem> item; check_hresult(SHCreateItemFromParsingName(path.c_str(), nullptr, IID_PPV_ARGS(item.put())));
      SHARDAPPIDINFO info{item.get(), appId.c_str()}; SHAddToRecentDocs(SHARD_APPIDINFO, &info);
    }
    Write(next);
  }
  void Clear() {
    if (ShellEnabled()) {
      auto destinations = create_instance<IApplicationDestinations>(CLSID_ApplicationDestinations);
      check_hresult(destinations->SetAppID(appId.c_str())); check_hresult(destinations->RemoveAllDestinations());
    }
    Write(Json::JsonArray());
  }
};
REACT_MODULE(LegendLinks, L"NativeDesktopLinks")
struct LegendLinks {
  React::ReactContext context;
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &value) noexcept { context = value; }
  static fire_and_forget Invoke(std::string method, std::string encoded, React::ReactPromise<std::string> promise) {
    try {
      auto args = Json::JsonObject::Parse(to_hstring(encoded));
      if (method == "recent" || method == "noteRecent" || method == "clearRecent") {
        RecentDocuments recent;
        if (method == "recent") promise.Resolve(to_string(recent.Read().Stringify()));
        else { if (method == "noteRecent") recent.Add(args.GetNamedString(L"url")); else recent.Clear(); promise.Resolve("null"); }
      } else if (method == "initialURL") {
        int count = 0; auto arguments = CommandLineToArgvW(GetCommandLineW(), &count); hstring initial;
        if (arguments) {
          for (int i = 1; i < count; ++i) {
            std::wstring candidate(arguments[i]); const auto colon = candidate.find(L':');
            if (colon != std::wstring::npos && colon > 1 && candidate[0] != L'-') { initial = candidate; break; }
          }
          LocalFree(arguments);
        }
        promise.Resolve(initial.empty() ? "null" : to_string(Json::JsonValue::CreateStringValue(initial).Stringify()));
      } else {
        Windows::Foundation::Uri uri(args.GetNamedString(L"url"));
        if (method == "open") {
          if (!co_await Windows::System::Launcher::LaunchUriAsync(uri)) { promise.Reject(React::ReactError{"E_OPEN_URL", "No application opened this URL"}); co_return; }
          promise.Resolve("true");
        } else if (method == "canOpen") {
          auto status = co_await Windows::System::Launcher::QueryUriSupportAsync(uri, Windows::System::LaunchQuerySupportType::Uri);
          promise.Resolve(status == Windows::System::LaunchQuerySupportStatus::Available ? "true" : "false");
        } else promise.Reject(React::ReactError{"E_UNSUPPORTED", "Unsupported Windows linking operation"});
      }
    } catch (hresult_error const &error) { promise.Reject(React::ReactError{"E_LINKING", to_string(error.message())}); }
  }
  REACT_METHOD(call)
  void call(std::string method, std::string args, React::ReactPromise<std::string> promise) noexcept {
    context.UIDispatcher().Post([method = std::move(method), args = std::move(args), promise]() { Invoke(method, args, promise); });
  }
};
}
