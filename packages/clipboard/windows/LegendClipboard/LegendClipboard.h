#pragma once
#include "NativeModules.h"
#include <winrt/Windows.ApplicationModel.DataTransfer.h>
#include <winrt/Windows.Data.Json.h>
namespace winrt::LegendClipboard {
namespace React = Microsoft::ReactNative;
namespace Transfer = Windows::ApplicationModel::DataTransfer;
namespace Json = Windows::Data::Json;
REACT_MODULE(LegendClipboard, L"NativeDesktopClipboard")
struct LegendClipboard {
  React::ReactContext context;
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &value) noexcept { context = value; }
  static fire_and_forget Invoke(std::string method, std::string encoded, React::ReactPromise<std::string> promise) {
    try {
      auto args = Json::JsonObject::Parse(to_hstring(encoded));
      if (method == "setString" || method == "writeText") {
        Transfer::DataPackage data;
        auto text = args.GetNamedString(L"text");
        if (args.GetNamedString(L"format", L"plain-text") == L"html") data.SetHtmlFormat(Transfer::HtmlFormatHelper::CreateHtmlFormat(text));
        else data.SetText(text);
        Transfer::Clipboard::SetContent(data); Transfer::Clipboard::Flush(); promise.Resolve("null");
      } else if (method == "clear") { Transfer::Clipboard::Clear(); promise.Resolve("null"); }
      else {
        auto data = Transfer::Clipboard::GetContent();
        if (method == "hasString" || method == "hasText") promise.Resolve(data.Contains(Transfer::StandardDataFormats::Text()) ? "true" : "false");
        else if (method == "getString" || method == "readText") {
          hstring text;
          const bool html = args.GetNamedString(L"format", L"plain-text") == L"html";
          if (html && data.Contains(Transfer::StandardDataFormats::Html())) text = Transfer::HtmlFormatHelper::GetStaticFragment(co_await data.GetHtmlFormatAsync());
          else if (data.Contains(Transfer::StandardDataFormats::Text())) text = co_await data.GetTextAsync();
          promise.Resolve(to_string(Json::JsonValue::CreateStringValue(text).Stringify()));
        } else promise.Reject(React::ReactError{"E_UNSUPPORTED", "Unsupported Windows clipboard operation"});
      }
    } catch (hresult_error const &error) { promise.Reject(React::ReactError{"E_CLIPBOARD", to_string(error.message())}); }
  }
  REACT_METHOD(call)
  void call(std::string method, std::string args, React::ReactPromise<std::string> promise) noexcept {
    context.UIDispatcher().Post([method = std::move(method), args = std::move(args), promise]() { Invoke(method, args, promise); });
  }
};
}
