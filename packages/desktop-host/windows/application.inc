// Application integration for the pinned RNW Composition host. UI-thread owned.
#include <map>
#include <set>
#include <fstream>
#include <shlwapi.h>
#include <filesystem>
#include <shlobj.h>
#include <commctrl.h>
#include <winrt/Windows.ApplicationModel.Core.h>
#include <winrt/Windows.Data.Json.h>
#include <winrt/Windows.Security.Cryptography.h>
#include <winrt/Windows.Security.Cryptography.Core.h>
#pragma comment(lib, "Comctl32.lib")
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "Shlwapi.lib")
namespace LegendWin {
namespace React = winrt::Microsoft::ReactNative;
namespace Json = winrt::Windows::Data::Json;
namespace UI = winrt::Microsoft::UI::Windowing;
using winrt::to_hstring; using winrt::to_string;
struct Window { React::ReactNativeWindow view{nullptr}; UI::AppWindow app{nullptr}; bool guard = false; bool pending = false; bool allow = false; uint64_t request = 0; };
static std::map<std::string, Window> windows;
static React::ReactNativeHost host{nullptr};
static winrt::Microsoft::UI::Composition::Compositor compositor{nullptr};
static React::ReactContext context;
static bool quitGuard = false, quitPending = false;
static uint64_t generation = 0, quitRequest = 0;
static Json::JsonArray pendingURLs;
static std::string initialURL;
static std::filesystem::path dataDirectory;
struct Shortcut { std::string id, windowId; UINT key; int modifiers; bool repeat; };
static std::map<std::string, Shortcut> shortcuts;
static HHOOK keyboardHook = nullptr;
static std::map<UINT, React::JSValueObject> menuActions;
static HMENU currentMenu = nullptr;
static std::string menuOwner;
static Json::JsonArray menus;
static HWND Hwnd(Window const &window) { return winrt::Microsoft::UI::GetWindowFromWindowId(window.app.Id()); }
static std::string Id(HWND hwnd) { auto root = GetAncestor(hwnd, GA_ROOT); for (auto const &[id, window] : windows) if (Hwnd(window) == root) return id; return ""; }
static void Emit(React::JSValueObject value) { if (context) context.EmitJSEvent(L"RCTDeviceEventEmitter", L"desktop", std::move(value)); }
static void WriteJson(React::IJSValueWriter const &writer, Json::IJsonValue const &value) {
  switch (value.ValueType()) {
    case Json::JsonValueType::Object: writer.WriteObjectBegin(); for (auto const &pair : value.GetObject()) { writer.WritePropertyName(pair.Key()); WriteJson(writer, pair.Value()); } writer.WriteObjectEnd(); break;
    case Json::JsonValueType::Array: writer.WriteArrayBegin(); for (auto const &item : value.GetArray()) WriteJson(writer, item); writer.WriteArrayEnd(); break;
    case Json::JsonValueType::String: writer.WriteString(value.GetString()); break;
    case Json::JsonValueType::Number: writer.WriteDouble(value.GetNumber()); break;
    case Json::JsonValueType::Boolean: writer.WriteBoolean(value.GetBoolean()); break;
    default: writer.WriteNull();
  }
}
static Json::JsonObject Info(std::string const &id) {
  auto &window = windows.at(id); auto hwnd = Hwnd(window); RECT frame{}; GetWindowRect(hwnd, &frame);
  Json::JsonObject result, rect;
  result.SetNamedValue(L"id", Json::JsonValue::CreateStringValue(to_hstring(id))); result.SetNamedValue(L"title", Json::JsonValue::CreateStringValue(window.app.Title()));
  result.SetNamedValue(L"visible", Json::JsonValue::CreateBooleanValue(IsWindowVisible(hwnd))); result.SetNamedValue(L"focused", Json::JsonValue::CreateBooleanValue(GetForegroundWindow() == hwnd));
  result.SetNamedValue(L"minimized", Json::JsonValue::CreateBooleanValue(IsIconic(hwnd)));
  result.SetNamedValue(L"resizable", Json::JsonValue::CreateBooleanValue((GetWindowLongPtrW(hwnd, GWL_STYLE) & WS_THICKFRAME) != 0));
  result.SetNamedValue(L"alwaysOnTop", Json::JsonValue::CreateBooleanValue((GetWindowLongPtrW(hwnd, GWL_EXSTYLE) & WS_EX_TOPMOST) != 0));
  result.SetNamedValue(L"fullscreen", Json::JsonValue::CreateBooleanValue(window.app.Presenter().Kind() == UI::AppWindowPresenterKind::FullScreen));
  result.SetNamedValue(L"minWidth", Json::JsonValue::CreateNumberValue(GetSystemMetrics(SM_CXMINTRACK))); result.SetNamedValue(L"maxWidth", Json::JsonValue::CreateNumberValue(GetSystemMetrics(SM_CXMAXTRACK)));
  rect.SetNamedValue(L"x", Json::JsonValue::CreateNumberValue(frame.left)); rect.SetNamedValue(L"y", Json::JsonValue::CreateNumberValue(frame.top)); rect.SetNamedValue(L"width", Json::JsonValue::CreateNumberValue(frame.right-frame.left)); rect.SetNamedValue(L"height", Json::JsonValue::CreateNumberValue(frame.bottom-frame.top)); result.SetNamedValue(L"frame", rect); return result;
}
static void QueueLaunch(std::wstring const &commandLine, bool initial) {
  int count = 0; auto argv = CommandLineToArgvW(commandLine.c_str(), &count);
  if (!argv) return;
  for (int i = 1; i < count; ++i) {
    std::wstring candidate(argv[i]); if (candidate.empty() || candidate[0] == L'-') continue;
    bool file = std::filesystem::path(candidate).is_absolute();
    if (file) { wchar_t uri[32768]; DWORD length = 32768; if (FAILED(UrlCreateFromPathW(candidate.c_str(), uri, &length, 0))) continue; candidate = uri; }
    else { auto colon = candidate.find(L':'); if (colon == std::wstring::npos || colon < 2) continue; }
    auto url = to_string(candidate); auto eventId = std::to_string(++generation);
    Json::JsonObject item; item.SetNamedValue(L"type", Json::JsonValue::CreateStringValue(file ? L"openFile" : L"openURL")); item.SetNamedValue(L"url", Json::JsonValue::CreateStringValue(candidate)); item.SetNamedValue(L"id", Json::JsonValue::CreateStringValue(to_hstring(eventId)));
    pendingURLs.Append(item); if (pendingURLs.Size() > 200) pendingURLs.RemoveAt(0); if (initial && initialURL.empty()) initialURL = url;
    Emit({{"type", file ? "openFile" : "openURL"}, {"id", eventId}, {"url", url}, {"initial", initial}});
  }
  LocalFree(argv);
}
static bool ForwardLaunch() {
  auto key = L"Legend.Project." + LegendWindowsEnv(L"LEGEND_PROJECT_ID");
  struct Search { std::wstring key; HWND target = nullptr; } search{key};
  EnumWindows([](HWND hwnd, LPARAM param) -> BOOL { auto data = reinterpret_cast<Search *>(param); if (GetPropW(hwnd, data->key.c_str())) { data->target = hwnd; return FALSE; } return TRUE; }, reinterpret_cast<LPARAM>(&search));
  if (!search.target) return false;
  auto text = GetCommandLineW(); COPYDATASTRUCT data{0x4C47, static_cast<DWORD>((wcslen(text) + 1) * sizeof(wchar_t)), text}; DWORD_PTR result = 0;
  if (!SendMessageTimeoutW(search.target, WM_COPYDATA, 0, reinterpret_cast<LPARAM>(&data), SMTO_ABORTIFHUNG, 2000, &result) || !result) return false;
  ShowWindow(search.target, SW_RESTORE); SetForegroundWindow(search.target); return true;
}
static void SaveFrame(std::string const &id, HWND hwnd) {
  if (id != "main" || dataDirectory.empty() || IsIconic(hwnd) || IsZoomed(hwnd)) return;
  auto file = dataDirectory / L"window.json", temporary = dataDirectory / L"window.pending";
  auto text = to_string(Info(id).GetNamedObject(L"frame").Stringify()); std::ofstream stream(temporary, std::ios::binary | std::ios::trunc); stream << text; stream.close();
  if (stream) MoveFileExW(temporary.c_str(), file.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH);
}
static void RequestQuit() {
  if (quitPending) return;
  if (!quitGuard) { windows.at("main").allow = true; windows.at("main").app.Destroy(); return; }
  quitPending = true; auto request = quitRequest = ++generation;
  Emit({{"type", "beforeQuit"}, {"requestId", static_cast<int64_t>(request)}});
  SetTimer(Hwnd(windows.at("main")), 0x4C47, 30000, nullptr);
}
static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam, UINT_PTR, DWORD_PTR) {
  auto id = Id(hwnd);
  if (!id.empty()) {
    if (message == WM_COPYDATA) { auto data = reinterpret_cast<COPYDATASTRUCT *>(lParam); if (data && data->dwData == 0x4C47 && data->cbData >= sizeof(wchar_t) && data->cbData <= 65536 && data->cbData % sizeof(wchar_t) == 0) { auto text = static_cast<wchar_t *>(data->lpData); if (text && text[data->cbData / sizeof(wchar_t) - 1] == 0) { QueueLaunch(text, false); return TRUE; } } return FALSE; }
    if (message == WM_EXITSIZEMOVE) SaveFrame(id, hwnd);
    if (message == WM_NCDESTROY && GetMenu(hwnd) == currentMenu) { currentMenu = nullptr; menuActions.clear(); }
    if (message == WM_ACTIVATE) Emit({{"type", LOWORD(wParam) == WA_INACTIVE ? "blur" : "focus"}, {"windowId", id}});
    if (message == WM_COMMAND && HIWORD(wParam) == 0) {
      auto found = menuActions.find(LOWORD(wParam)); if (found != menuActions.end() && context) { context.EmitJSEvent(L"RCTDeviceEventEmitter", L"NativeMenuAction", found->second.Copy()); return 0; }
    }
    if (message == WM_TIMER && wParam == 0x4C47) { if (id == "main") quitPending = false; windows.at(id).pending = false; KillTimer(hwnd, 0x4C47); return 0; }
  }
  return DefSubclassProc(hwnd, message, wParam, lParam);
}
static void Attach(std::string id, React::ReactNativeWindow view) {
  Window window; window.view = view; window.app = view.AppWindow(); windows.emplace(id, window);
  auto app = window.app; SetWindowSubclass(Hwnd(window), WindowProc, 0x4C47, 0);
  app.Closing([id](auto const &, UI::AppWindowClosingEventArgs const &args) {
    auto found = windows.find(id); if (found == windows.end() || found->second.allow) return;
    auto &window = found->second;
    if (window.guard) {
      args.Cancel(true); if (window.pending) return;
      window.pending = true; window.request = ++generation;
      SetTimer(Hwnd(window), 0x4C47, 30000, nullptr);
      Emit({{"type", "beforeClose"}, {"windowId", id}, {"requestId", static_cast<int64_t>(window.request)}});
    } else if (id == "main" && quitGuard) { args.Cancel(true); RequestQuit(); }
  });
  app.Destroying([id](auto const &, auto const &) {
    Emit({{"type", "closed"}, {"windowId", id}});
    if (id != "main") windows.erase(id);
  });
}
static LRESULT CALLBACK Keyboard(int code, WPARAM remove, LPARAM param) {
  if (code >= 0 && remove == PM_REMOVE) {
    auto message = reinterpret_cast<MSG *>(param);
    if (message->message == WM_KEYDOWN || message->message == WM_SYSKEYDOWN) {
      auto id = Id(message->hwnd); int modifiers = 0;
      if (GetKeyState(VK_CONTROL) < 0) modifiers |= 1 << 18;
      if (GetKeyState(VK_MENU) < 0) modifiers |= 1 << 19;
      if (GetKeyState(VK_SHIFT) < 0) modifiers |= 1 << 17;
      if (GetKeyState(VK_LWIN) < 0 || GetKeyState(VK_RWIN) < 0) modifiers |= 1 << 20;
      for (auto const &[key, shortcut] : shortcuts) if (!id.empty() && (shortcut.windowId.empty() || shortcut.windowId == id) && shortcut.key == message->wParam && shortcut.modifiers == modifiers) {
        if (shortcut.repeat || !(message->lParam & (1LL << 30))) context.EmitJSEvent(L"RCTDeviceEventEmitter", L"shortcut", React::JSValueObject{{"id", key}});
        message->message = WM_NULL; break;
      }
    }
  }
  return CallNextHookEx(keyboardHook, code, remove, param);
}
static void RebuildMenus() {
  auto next = CreateMenu(); std::map<UINT, React::JSValueObject> actions; UINT command = 0x5000;
  for (auto const &value : menus) {
    auto menu = value.GetObject(); auto popup = CreatePopupMenu();
    for (auto const &entry : menu.GetNamedArray(L"items")) {
      auto item = entry.GetObject(); if (item.GetNamedBoolean(L"hidden", false)) continue;
      if (item.GetNamedBoolean(L"separator", false)) { AppendMenuW(popup, MF_SEPARATOR, 0, nullptr); continue; }
      auto flags = MF_STRING | (item.GetNamedBoolean(L"enabled", true) ? MF_ENABLED : MF_GRAYED) | (item.GetNamedBoolean(L"checked", false) ? MF_CHECKED : 0);
      AppendMenuW(popup, flags, command, item.GetNamedString(L"title", L"").c_str());
      actions.emplace(command++, React::JSValueObject{{"ownerId", menuOwner}, {"menuId", to_string(menu.GetNamedString(L"id"))}, {"itemId", to_string(item.GetNamedString(L"id"))}});
    }
    AppendMenuW(next, MF_POPUP, reinterpret_cast<UINT_PTR>(popup), menu.GetNamedString(L"title").c_str());
  }
  for (auto const &[id, window] : windows) SetMenu(Hwnd(window), nullptr);
  auto target = GetForegroundWindow(); if (Id(target).empty()) target = Hwnd(windows.at("main")); SetMenu(target, next); DrawMenuBar(target);
  auto old = currentMenu; currentMenu = next; menuActions = std::move(actions); if (old) DestroyMenu(old);
}
static void Initialize(React::ReactNativeWin32App const &app) {
  host = app.ReactNativeHost(); compositor = app.ReactNativeWindow().ReactNativeIsland().Compositor(); Attach("main", app.ReactNativeWindow());
  keyboardHook = SetWindowsHookExW(WH_GETMESSAGE, Keyboard, nullptr, GetCurrentThreadId());
  // AsyncStorage's documented override supports unpackaged Win32 applications.
  PWSTR raw = nullptr; winrt::check_hresult(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &raw));
  std::filesystem::path directory(raw); CoTaskMemFree(raw);
  auto identity = LegendWindowsEnv(L"LEGEND_PROJECT_ID"); if (identity.empty()) throw winrt::hresult_invalid_argument(L"Missing Legend project identity");
  auto algorithm = winrt::Windows::Security::Cryptography::Core::HashAlgorithmProvider::OpenAlgorithm(winrt::Windows::Security::Cryptography::Core::HashAlgorithmNames::Sha256());
  auto bytes = winrt::Windows::Security::Cryptography::CryptographicBuffer::ConvertStringToBinary(identity, winrt::Windows::Security::Cryptography::BinaryStringEncoding::Utf8);
  auto safe = winrt::Windows::Security::Cryptography::CryptographicBuffer::EncodeToHexString(algorithm.HashData(bytes));
  directory /= L"Legend"; directory /= std::wstring(safe); std::filesystem::create_directories(directory); dataDirectory = directory;
  SetPropW(Hwnd(windows.at("main")), (L"Legend.Project." + identity).c_str(), reinterpret_cast<HANDLE>(1));
  QueueLaunch(GetCommandLineW(), true);
  auto config = Json::JsonObject::Parse(winrt::hstring(LegendWindowsEnv(L"LEGEND_WINDOW_CONFIG").empty() ? L"{}" : LegendWindowsEnv(L"LEGEND_WINDOW_CONFIG")));
  auto appWindow = windows.at("main").app; appWindow.Resize({static_cast<int32_t>(config.GetNamedNumber(L"width", 1000)), static_cast<int32_t>(config.GetNamedNumber(L"height", 700))});
  if (config.GetNamedBoolean(L"restoreFrame", false)) try {
    std::ifstream stream(directory / L"window.json"); std::string text((std::istreambuf_iterator<char>(stream)), std::istreambuf_iterator<char>());
    auto frame = Json::JsonObject::Parse(to_hstring(text)); RECT rect{static_cast<LONG>(frame.GetNamedNumber(L"x")), static_cast<LONG>(frame.GetNamedNumber(L"y")), 0, 0}; rect.right = rect.left + static_cast<LONG>(frame.GetNamedNumber(L"width")); rect.bottom = rect.top + static_cast<LONG>(frame.GetNamedNumber(L"height"));
    if (rect.right - rect.left >= 100 && rect.bottom - rect.top >= 100 && MonitorFromRect(&rect, MONITOR_DEFAULTTONULL)) appWindow.MoveAndResize({rect.left, rect.top, rect.right-rect.left, rect.bottom-rect.top});
  } catch (...) { /* Missing/invalid saved geometry uses the configured frame. */ }

  winrt::Windows::ApplicationModel::Core::CoreApplication::Properties().Insert(L"React-Native-Community-Async-Storage-Database-Path", winrt::box_value(winrt::hstring((directory / L"AsyncStorage.db").wstring())));
}
}
REACT_MODULE(LegendDesktopApp, L"NativeDesktopApp")
struct LegendDesktopApp {
  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept { LegendWin::context = context; LegendWin::quitGuard = false; LegendWin::quitPending = false; LegendWin::shortcuts.clear(); for (auto &[id, window] : LegendWin::windows) { window.guard = false; window.pending = false; } }
  REACT_METHOD(addListener) void addListener(std::string) noexcept {}
  REACT_METHOD(removeListeners) void removeListeners(double) noexcept {}
  REACT_METHOD(call)
  void call(std::string method, std::string encoded, winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    LegendWin::context.UIDispatcher().Post([method, encoded, promise]() {
      using namespace LegendWin;
      try {
        auto args = Json::JsonObject::Parse(to_hstring(encoded));
        if (method == "quitGuard") quitGuard = args.GetNamedBoolean(L"enabled");
        else if (method == "quit") RequestQuit();
        else if (method == "replyQuit") {
          if (quitPending && args.GetNamedNumber(L"requestId") == quitRequest) { quitPending = false; KillTimer(Hwnd(windows.at("main")), 0x4C47); if (args.GetNamedBoolean(L"allow")) { windows.at("main").allow = true; windows.at("main").app.Destroy(); } }
        } else if (method == "hide") windows.at("main").app.Hide();
        else if (method == "activate") { windows.at("main").app.Show(); SetForegroundWindow(Hwnd(windows.at("main"))); }
        else if (method == "context") {
          Json::JsonObject result; result.SetNamedValue(L"projectId", Json::JsonValue::CreateStringValue(LegendWindowsEnv(L"LEGEND_PROJECT_ID"))); result.SetNamedValue(L"name", Json::JsonValue::CreateStringValue(LegendWindowsEnv(L"LEGEND_PROJECT_NAME"))); result.SetNamedValue(L"version", Json::JsonValue::CreateStringValue(LegendWindowsEnv(L"LEGEND_PROJECT_VERSION"))); result.SetNamedValue(L"runtime", Json::JsonObject::Parse(to_hstring(NativeLegendRuntime{}.describe()))); result.SetNamedValue(L"launchArguments", Json::JsonArray()); promise.Resolve(to_string(result.Stringify())); return;
        } else if (method == "pendingURLs") { promise.Resolve(to_string(pendingURLs.Stringify())); return; }
        else if (method == "initialURL") { promise.Resolve(initialURL.empty() ? "null" : to_string(Json::JsonValue::CreateStringValue(to_hstring(initialURL)).Stringify())); return; }
        else throw winrt::hresult_invalid_argument(L"Unsupported application operation");
        promise.Resolve("null");
      } catch (winrt::hresult_error const &error) { promise.Reject(React::ReactError{"E_APP", to_string(error.message())}); }
    });
  }
};
REACT_MODULE(LegendDesktopWindows, L"NativeDesktopWindowManager")
struct LegendDesktopWindows {
  REACT_INIT(Initialize) void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept { LegendWin::context = context; }
  REACT_METHOD(call)
  void call(std::string method, std::string encoded, winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    LegendWin::context.UIDispatcher().Post([method, encoded, promise]() {
      using namespace LegendWin;
      try {
        auto args = Json::JsonObject::Parse(to_hstring(encoded)); auto id = to_string(args.GetNamedString(L"id", L"main"));
        if (method == "open") {
          if (windows.count(id)) throw winrt::hresult_invalid_argument(L"Window already exists");
          if (args.GetNamedBoolean(L"modal", false) || args.HasKey(L"parentId")) throw winrt::hresult_invalid_argument(L"Owned/modal windows are not implemented");
          auto view = React::ReactNativeWindow::CreateFromCompositor(compositor); auto app = view.AppWindow();
          app.Title(args.GetNamedString(L"title", L"Window")); app.Resize({static_cast<int32_t>(args.GetNamedNumber(L"width", 800)), static_cast<int32_t>(args.GetNamedNumber(L"height", 600))});
          React::ReactViewOptions options; options.ComponentName(L"main");
          Json::JsonObject props; props.SetNamedValue(L"windowId", Json::JsonValue::CreateStringValue(to_hstring(id))); props.SetNamedValue(L"windowProps", args.GetNamedObject(L"props", Json::JsonObject()));
          // Write JSON props through the public JSValue writer contract.
          auto propsJson = to_string(props.Stringify());
          options.InitialProps([propsJson](React::IJSValueWriter const &writer) { WriteJson(writer, Json::JsonObject::Parse(to_hstring(propsJson))); });
          Attach(id, view); view.ReactNativeIsland().ReactViewHost(React::ReactCoreInjection::MakeViewHost(host, options)); app.Show();
          promise.Resolve(to_string(Info(id).Stringify())); return;
        }
        if (method == "list") { Json::JsonArray result; for (auto const &[name, window] : windows) result.Append(Info(name)); promise.Resolve(to_string(result.Stringify())); return; }
        auto found = windows.find(id); if (found == windows.end()) { promise.Reject(React::ReactError{"E_NOT_FOUND", "Window not found"}); return; }
        auto &window = found->second; auto hwnd = Hwnd(window);
        if (method == "info") { promise.Resolve(to_string(Info(id).Stringify())); return; }
        if (method == "title") window.app.Title(args.GetNamedString(L"title"));
        else if (method == "closeGuard") window.guard = args.GetNamedBoolean(L"enabled");
        else if (method == "replyClose") {
          if (window.pending && args.GetNamedNumber(L"requestId", 0) == window.request) { window.pending = false; KillTimer(hwnd, 0x4C47); if (args.GetNamedBoolean(L"allow")) { if (id == "main") RequestQuit(); else { window.allow = true; window.app.Destroy(); } } }
        } else if (method == "close") PostMessageW(hwnd, WM_CLOSE, 0, 0);
        else if (method == "show") { window.app.Show(); SetForegroundWindow(hwnd); }
        else if (method == "hide") window.app.Hide();
        else if (method == "minimize") ShowWindow(hwnd, SW_MINIMIZE);
        else if (method == "maximize") ShowWindow(hwnd, SW_MAXIMIZE);
        else if (method == "unmaximize") ShowWindow(hwnd, SW_RESTORE);
        else throw winrt::hresult_invalid_argument(L"Unsupported window operation");
        promise.Resolve("null");
      } catch (winrt::hresult_error const &error) { promise.Reject(React::ReactError{"E_WINDOW", to_string(error.message())}); }
    });
  }
};
REACT_MODULE(LegendDesktopShortcuts, L"NativeDesktopShortcuts")
struct LegendDesktopShortcuts {
  REACT_INIT(Initialize) void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept { LegendWin::context = context; }
  REACT_METHOD(addListener) void addListener(std::string) noexcept {}
  REACT_METHOD(removeListeners) void removeListeners(double) noexcept {}
  REACT_METHOD(call)
  void call(std::string method, std::string encoded, winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    LegendWin::context.UIDispatcher().Post([method, encoded, promise]() {
      using namespace LegendWin;
      try { auto args = Json::JsonObject::Parse(to_hstring(encoded)); auto id = to_string(args.GetNamedString(L"id"));
        if (method == "remove") shortcuts.erase(id);
        else if (method == "register") {
          auto text = args.GetNamedString(L"key"); if (text.size() != 1) throw winrt::hresult_invalid_argument(L"Invalid shortcut");
          wchar_t key = text[0]; UINT code = key >= 0xf704 && key <= 0xf717 ? VK_F1 + key - 0xf704 : key == 0xf700 ? VK_UP : key == 0xf701 ? VK_DOWN : key == 0xf702 ? VK_LEFT : key == 0xf703 ? VK_RIGHT : key == 0xf728 ? VK_DELETE : key == 0x7f ? VK_BACK : static_cast<UINT>(towupper(key));
          shortcuts[id] = {id, to_string(args.GetNamedString(L"windowId", L"")), code, static_cast<int>(args.GetNamedNumber(L"modifiers")), args.GetNamedBoolean(L"repeat", false)};
        } else throw winrt::hresult_invalid_argument(L"Unknown shortcut operation"); promise.Resolve("null");
      } catch (winrt::hresult_error const &error) { promise.Reject(React::ReactError{"E_SHORTCUT", to_string(error.message())}); }
    });
  }
};
REACT_MODULE(LegendNativeMenu, L"NativeMenu")
struct LegendNativeMenu {
  REACT_INIT(Initialize) void Initialize(winrt::Microsoft::ReactNative::ReactContext const &context) noexcept { LegendWin::context = context; }
  REACT_METHOD(addListener) void addListener(std::string) noexcept {}
  REACT_METHOD(removeListeners) void removeListeners(double) noexcept {}
  REACT_METHOD(configureMenus) void configureMenus(std::string owner, std::string json) noexcept { LegendWin::context.UIDispatcher().Post([owner, json]() { LegendWin::menuOwner = owner; LegendWin::menus = LegendWin::Json::JsonArray::Parse(winrt::to_hstring(json)); LegendWin::RebuildMenus(); }); }
  REACT_METHOD(clearMenus) void clearMenus(std::string owner) noexcept { LegendWin::context.UIDispatcher().Post([owner]() { if (owner == LegendWin::menuOwner) { LegendWin::menus.Clear(); LegendWin::RebuildMenus(); } }); }
  REACT_METHOD(clearAllMenus) void clearAllMenus() noexcept { clearMenus(LegendWin::menuOwner); }
  REACT_METHOD(updateMenuItems) void updateMenuItems(std::string owner, std::string json) noexcept { LegendWin::context.UIDispatcher().Post([owner, json]() {
    if (owner != LegendWin::menuOwner) return; auto patches = LegendWin::Json::JsonArray::Parse(winrt::to_hstring(json));
    for (auto const &menu : LegendWin::menus) for (auto const &value : menu.GetObject().GetNamedArray(L"items")) for (auto const &patchValue : patches) { auto item = value.GetObject(), patch = patchValue.GetObject(); if (item.GetNamedString(L"id") == patch.GetNamedString(L"id")) for (auto const &pair : patch) item.SetNamedValue(pair.Key(), pair.Value()); }
    LegendWin::RebuildMenus();
  }); }
};
