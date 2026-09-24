#pragma once
#include "NativeModules.h"
#include <commctrl.h>
#include <winrt/Windows.Data.Json.h>
#include <atomic>
#include <functional>
#include <memory>
#include <vector>
#include <set>
#include <cmath>
#include <climits>
#pragma comment(lib, "Comctl32.lib")
namespace winrt::SparkMessageDialog {
namespace React = Microsoft::ReactNative;
namespace Json = Windows::Data::Json;
// Match the framework's own top-level windows, never another process's HWND.
inline HWND Parent(std::wstring const &id, bool explicitId) {
  HWND active = GetActiveWindow();
  if (!explicitId && active && GetPropW(active, L"Spark.ReactWindow")) return active;
  struct Search { std::wstring property; HWND found = nullptr; } search{L"Spark.Window." + (explicitId ? id : L"main")};
  EnumWindows([](HWND hwnd, LPARAM value) -> BOOL {
    auto search = reinterpret_cast<Search *>(value); DWORD process = 0; GetWindowThreadProcessId(hwnd, &process);
    if (process == GetCurrentProcessId() && GetPropW(hwnd, search->property.c_str())) { search->found = hwnd; return FALSE; }
    return TRUE;
  }, reinterpret_cast<LPARAM>(&search));
  return search.found;
}
// Modal Win32 APIs pump a nested loop. Start outside the RN dispatcher callback
// so React can still deliver another call (which must reject E_BUSY).
inline LRESULT CALLBACK TaskProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_NCCREATE) {
    auto pending = reinterpret_cast<std::unique_ptr<std::function<void()>> *>(reinterpret_cast<CREATESTRUCTW *>(lparam)->lpCreateParams);
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(pending->release()));
  }
  if (message == WM_APP + 1) {
    auto raw = reinterpret_cast<std::function<void()> *>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0); std::unique_ptr<std::function<void()>> action(raw); DestroyWindow(hwnd);
    if (action) (*action)(); return 0;
  }
  if (message == WM_NCDESTROY) {
    delete reinterpret_cast<std::function<void()> *>(GetWindowLongPtrW(hwnd, GWLP_USERDATA)); SetWindowLongPtrW(hwnd, GWLP_USERDATA, 0);
  }
  return DefWindowProcW(hwnd, message, wparam, lparam);
}
inline void Schedule(React::ReactContext context, std::function<void()> action, std::function<void()> failure) {
  context.UIDispatcher().Post([action = std::move(action), failure = std::move(failure)]() {
    const wchar_t *name = L"SparkMessageDialogTask";
    WNDCLASSW cls{}; cls.lpfnWndProc = TaskProc; cls.hInstance = GetModuleHandleW(nullptr); cls.lpszClassName = name;
    if (!RegisterClassW(&cls) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) { failure(); return; }
    auto pending = std::make_unique<std::function<void()>>(action);
    // Ownership passes on WM_NCCREATE. This class always accepts creation.
    auto hwnd = CreateWindowExW(0, name, L"", 0, 0, 0, 0, 0, HWND_MESSAGE, nullptr, cls.hInstance, &pending);
    if (!hwnd) { failure(); return; }
    if (!PostMessageW(hwnd, WM_APP + 1, 0, 0)) { DestroyWindow(hwnd); failure(); }
  });
}
struct DisabledWindows {
  std::vector<HWND> windows;
  void DisableOthers(HWND parent) {
    struct Input { DisabledWindows *self; HWND parent; } input{this, parent};
    EnumWindows([](HWND window, LPARAM value) -> BOOL {
      auto input = reinterpret_cast<Input *>(value); DWORD process = 0; GetWindowThreadProcessId(window, &process);
      if (process == GetCurrentProcessId() && window != input->parent && GetPropW(window, L"Spark.ReactWindow") && IsWindowEnabled(window)) {
        input->self->windows.push_back(window); EnableWindow(window, FALSE);
      }
      return TRUE;
    }, reinterpret_cast<LPARAM>(&input));
  }
  ~DisabledWindows() { for (auto window : windows) if (IsWindow(window)) EnableWindow(window, TRUE); }
};
struct DialogState {
  std::atomic<bool> busy{false}, stopped{false};
  std::atomic<HWND> window{nullptr};
  DisabledWindows *applicationModal = nullptr;
  HWND parent = nullptr;
};
REACT_MODULE(SparkMessageDialog, L"NativeDesktopMessageDialog")
struct SparkMessageDialog {
  React::ReactContext context;
  std::shared_ptr<DialogState> state = std::make_shared<DialogState>();
  REACT_INIT(Initialize) void Initialize(React::ReactContext const &value) noexcept { context = value; }
  ~SparkMessageDialog() {
    state->stopped = true;
    if (auto window = state->window.load()) PostMessageW(window, TDM_CLICK_BUTTON, IDCANCEL, 0);
  }
  REACT_METHOD(call) void call(std::string method, std::string encoded, React::ReactPromise<std::string> promise) noexcept {
    if (method != "show") { promise.Reject(React::ReactError{"E_INVALID_ARGUMENT", "Unknown dialog operation"}); return; }
    if (state->busy.exchange(true)) { promise.Reject(React::ReactError{"E_BUSY", "A message dialog is already open"}); return; }
    auto current = state;
    Schedule(context, [current, encoded, promise] {
      try {
        if (current->stopped) { current->busy = false; promise.Resolve("{\"button\":-1,\"checked\":false}"); return; }
        auto args = Json::JsonObject::Parse(to_hstring(encoded));
        auto parent = Parent(std::wstring(args.GetNamedString(L"windowId", L"")), args.HasKey(L"windowId"));
        if (args.HasKey(L"windowId") && !parent) { current->busy = false; promise.Reject(React::ReactError{"E_NOT_FOUND", "Dialog parent does not exist"}); return; }
        if (parent && !IsWindowEnabled(parent)) { current->busy = false; promise.Reject(React::ReactError{"E_BUSY", "Dialog parent already has a modal operation"}); return; }
        auto title = args.GetNamedString(L"title"), message = args.GetNamedString(L"message", L"");
        auto buttons = args.GetNamedArray(L"buttons");
        if (title.empty() || buttons.Size() < 1 || buttons.Size() > 4) throw hresult_invalid_argument(L"Dialog needs a title and 1-4 buttons");
        auto index = [&](wchar_t const *key, int fallback) {
          double value = args.GetNamedNumber(key, fallback);
          if (!std::isfinite(value) || value != std::floor(value) || value < 0 || value >= buttons.Size()) throw hresult_invalid_argument(L"Dialog button index is out of bounds");
          return static_cast<int>(value);
        };
        const int defaultIndex = index(L"defaultButton", 0), cancelIndex = args.HasKey(L"cancelButton") ? index(L"cancelButton", 0) : -1;
        std::vector<std::wstring> labels; labels.reserve(buttons.Size());
        for (auto const &button : buttons) { auto text = button.GetString(); if (text.empty()) throw hresult_invalid_argument(L"Button title must not be empty"); labels.emplace_back(text); }
        std::vector<TASKDIALOG_BUTTON> nativeButtons;
        for (size_t i = 0; i < labels.size(); ++i) nativeButtons.push_back({static_cast<int>(i) == cancelIndex ? IDCANCEL : 1000 + static_cast<int>(i), labels[i].c_str()});
        TASKDIALOGCONFIG config{}; config.cbSize = sizeof(config); config.hwndParent = parent;
        config.dwFlags = TDF_ALLOW_DIALOG_CANCELLATION | TDF_POSITION_RELATIVE_TO_WINDOW | TDF_CALLBACK_TIMER;
        config.pszWindowTitle = title.c_str(); config.pszMainInstruction = title.c_str(); config.pszContent = message.c_str();
        auto kind = args.GetNamedString(L"kind", L"info");
        if (kind != L"info" && kind != L"warning" && kind != L"error") throw hresult_invalid_argument(L"Invalid dialog kind");
        config.pszMainIcon = kind == L"error" ? TD_ERROR_ICON : kind == L"warning" ? TD_WARNING_ICON : TD_INFORMATION_ICON;
        config.cButtons = static_cast<UINT>(nativeButtons.size()); config.pButtons = nativeButtons.data();
        config.nDefaultButton = defaultIndex == cancelIndex ? IDCANCEL : 1000 + defaultIndex;
        hstring checkbox;
        if (args.HasKey(L"checkbox")) {
          auto value = args.GetNamedObject(L"checkbox"); checkbox = value.GetNamedString(L"label"); config.pszVerificationText = checkbox.c_str();
          if (value.GetNamedBoolean(L"checked", false)) config.dwFlags |= TDF_VERIFICATION_FLAG_CHECKED;
        }
        DisabledWindows disabled;
        const bool appModal = !args.HasKey(L"windowId");
        if (appModal) { disabled.DisableOthers(parent); current->applicationModal = &disabled; current->parent = parent; }
        config.lpCallbackData = reinterpret_cast<LONG_PTR>(current.get());
        config.pfCallback = [](HWND hwnd, UINT message, WPARAM, LPARAM, LONG_PTR data) -> HRESULT {
          auto state = reinterpret_cast<DialogState *>(data);
          if (message == TDN_CREATED) { state->window = hwnd; if (state->stopped) PostMessageW(hwnd, TDM_CLICK_BUTTON, IDCANCEL, 0); }
          if (message == TDN_TIMER && state->applicationModal) state->applicationModal->DisableOthers(state->parent);
          if (message == TDN_DESTROYED) state->window = nullptr;
          return S_OK;
        };
        int selected = 0; BOOL checked = FALSE;
        auto status = TaskDialogIndirect(&config, &selected, nullptr, &checked);
        current->applicationModal = nullptr; current->window = nullptr; current->busy = false; check_hresult(status);
        Json::JsonObject result;
        result.SetNamedValue(L"button", Json::JsonValue::CreateNumberValue(current->stopped ? -1 : selected == IDCANCEL ? cancelIndex : selected >= 1000 && selected < 1000 + static_cast<int>(buttons.Size()) ? selected - 1000 : -1));
        result.SetNamedValue(L"checked", Json::JsonValue::CreateBooleanValue(checked != FALSE)); promise.Resolve(to_string(result.Stringify()));
      } catch (hresult_error const &error) { current->applicationModal = nullptr; current->window = nullptr; current->busy = false; promise.Reject(React::ReactError{error.code() == E_INVALIDARG ? "E_INVALID_ARGUMENT" : "E_DIALOG", to_string(error.message())}); }
      catch (std::exception const &error) { current->applicationModal = nullptr; current->window = nullptr; current->busy = false; promise.Reject(React::ReactError{"E_DIALOG", error.what()}); }
    }, [current, promise] { current->busy = false; promise.Reject(React::ReactError{"E_DIALOG", "Could not schedule native dialog"}); });
  }
};
}
