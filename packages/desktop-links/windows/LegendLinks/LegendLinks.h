#pragma once
#include "NativeModules.h"
#include <shellapi.h>
#include <winrt/Windows.System.h>
#include <winrt/Windows.Data.Json.h>
namespace winrt::LegendLinks {
namespace React = Microsoft::ReactNative;
namespace Json = Windows::Data::Json;
REACT_MODULE(LegendLinks, L"NativeDesktopLinks")
struct LegendLinks {
  React::ReactContext context;
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &value) noexcept { context = value; }
  static fire_and_forget Invoke(std::string method, std::string encoded, React::ReactPromise<std::string> promise) {
    try {
      auto args = Json::JsonObject::Parse(to_hstring(encoded));
      if (method == "initialURL") {
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
