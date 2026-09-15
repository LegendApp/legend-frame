// Application integration for the pinned RNW Composition host. UI-thread owned.
#include <map>
#include <set>
#include <vector>
#include <algorithm>
#include <cmath>
#include <exception>
#include <shellscalingapi.h>
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
#pragma comment(linker, "/manifestdependency:\"type='win32' name='Microsoft.Windows.Common-Controls' version='6.0.0.0' processorArchitecture='*' publicKeyToken='6595b64144ccf1df' language='*'\"")
#pragma comment(lib, "Shell32.lib")
#pragma comment(lib, "Shlwapi.lib")
#pragma comment(lib, "Shcore.lib")
namespace LegendWin {
namespace React = winrt::Microsoft::ReactNative;
namespace Json = winrt::Windows::Data::Json;
namespace UI = winrt::Microsoft::UI::Windowing;
using winrt::to_hstring; using winrt::to_string;
struct Window { React::ReactNativeWindow view{nullptr}; UI::AppWindow app{nullptr}; UI::OverlappedPresenter normal{nullptr}; int32_t minWidth = 100, minHeight = 100, maxWidth = 20000, maxHeight = 20000; std::string parentId; bool modal = false; bool disabledByModal = false; bool enabledBeforeModal = false; bool guard = false; bool pending = false; bool allow = false; uint64_t request = 0; };
static std::map<std::string, Window> windows;
static React::ReactNativeHost host{nullptr};
static winrt::Microsoft::UI::Composition::Compositor compositor{nullptr};
static React::ReactContext context;
static bool quitGuard = false, quitPending = false;
static uint64_t generation = 0, quitRequest = 0;
static Json::JsonArray pendingURLs{nullptr};
static std::string initialURL;
static std::filesystem::path dataDirectory;
struct Shortcut { std::string id, windowId; UINT key; int modifiers; bool repeat; };
static std::map<std::string, Shortcut> shortcuts;
static HHOOK keyboardHook = nullptr;
static std::map<UINT, React::JSValueObject> menuActions;
static HMENU currentMenu = nullptr;
static std::string menuOwner;
static Json::JsonArray menus{nullptr};
static HACCEL acceleratorTable = nullptr;
static HWND Hwnd(Window const &window) { return winrt::Microsoft::UI::GetWindowFromWindowId(window.app.Id()); }
static void UpdateModality() {
  for (auto &[id, window] : windows) {
    bool blocked = false;
    for (auto const &[childId, child] : windows) if (child.modal && child.parentId == id && IsWindowVisible(Hwnd(child))) { blocked = true; break; }
    if (blocked && !window.disabledByModal) { window.enabledBeforeModal = IsWindowEnabled(Hwnd(window)); window.disabledByModal = true; EnableWindow(Hwnd(window), FALSE); }
    else if (!blocked && window.disabledByModal) { window.disabledByModal = false; if (window.enabledBeforeModal) EnableWindow(Hwnd(window), TRUE); }
  }
}
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
  result.SetNamedValue(L"minWidth", Json::JsonValue::CreateNumberValue(window.minWidth)); result.SetNamedValue(L"maxWidth", Json::JsonValue::CreateNumberValue(window.maxWidth));
  rect.SetNamedValue(L"x", Json::JsonValue::CreateNumberValue(frame.left)); rect.SetNamedValue(L"y", Json::JsonValue::CreateNumberValue(frame.top)); rect.SetNamedValue(L"width", Json::JsonValue::CreateNumberValue(frame.right-frame.left)); rect.SetNamedValue(L"height", Json::JsonValue::CreateNumberValue(frame.bottom-frame.top)); result.SetNamedValue(L"frame", rect); return result;
}
static Json::JsonObject Rect(RECT const &frame) {
  Json::JsonObject result;
  result.SetNamedValue(L"x", Json::JsonValue::CreateNumberValue(frame.left));
  result.SetNamedValue(L"y", Json::JsonValue::CreateNumberValue(frame.top));
  result.SetNamedValue(L"width", Json::JsonValue::CreateNumberValue(frame.right - frame.left));
  result.SetNamedValue(L"height", Json::JsonValue::CreateNumberValue(frame.bottom - frame.top));
  return result;
}
static Json::JsonArray Displays() {
  struct State { Json::JsonArray result; std::exception_ptr error; } state;
  const auto enumerated = EnumDisplayMonitors(nullptr, nullptr, [](HMONITOR monitor, HDC, LPRECT, LPARAM param) -> BOOL {
    auto &state = *reinterpret_cast<State *>(param);
    try {
      MONITORINFOEXW info{}; info.cbSize = sizeof(info);
      if (!GetMonitorInfoW(monitor, reinterpret_cast<MONITORINFO *>(&info))) winrt::throw_last_error();
      UINT dpiX = 96, dpiY = 96; winrt::check_hresult(GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &dpiX, &dpiY));
      DISPLAY_DEVICEW device{}; device.cb = sizeof(device); EnumDisplayDevicesW(info.szDevice, 0, &device, 0);
      Json::JsonObject display;
      display.SetNamedValue(L"id", Json::JsonValue::CreateStringValue(info.szDevice));
      display.SetNamedValue(L"name", Json::JsonValue::CreateStringValue(device.DeviceString[0] ? device.DeviceString : info.szDevice));
      display.SetNamedValue(L"frame", Rect(info.rcMonitor)); display.SetNamedValue(L"workArea", Rect(info.rcWork));
      display.SetNamedValue(L"scale", Json::JsonValue::CreateNumberValue(dpiX / 96.0)); state.result.Append(display);
      return TRUE;
    } catch (...) { state.error = std::current_exception(); return FALSE; }
  }, reinterpret_cast<LPARAM>(&state));
  if (state.error) std::rethrow_exception(state.error);
  if (!enumerated) winrt::throw_last_error();
  return state.result;
}
static int32_t Dimension(Json::JsonObject const &args, wchar_t const *key, int32_t fallback) {
  const auto value = args.GetNamedNumber(key, fallback);
  if (!std::isfinite(value) || value < 100 || value > 20000) throw winrt::hresult_invalid_argument(L"Invalid window dimension");
  return static_cast<int32_t>(value);
}
static void ApplyOptions(Window &window, Json::JsonObject const &options) {
  static const std::set<std::wstring> supported{L"title", L"width", L"height", L"minWidth", L"minHeight", L"maxWidth", L"maxHeight", L"resizable", L"minimizable", L"alwaysOnTop"};
  for (auto const &pair : options) if (!supported.count(std::wstring(pair.Key()))) throw winrt::hresult_invalid_argument(L"Unsupported Windows window option");
  const auto minWidth = Dimension(options, L"minWidth", window.minWidth), minHeight = Dimension(options, L"minHeight", window.minHeight);
  const auto maxWidth = Dimension(options, L"maxWidth", window.maxWidth), maxHeight = Dimension(options, L"maxHeight", window.maxHeight);
  if (minWidth > maxWidth || minHeight > maxHeight) throw winrt::hresult_invalid_argument(L"Invalid window constraints");
  auto size = window.app.Size();
  const auto width = Dimension(options, L"width", std::clamp(size.Width, minWidth, maxWidth));
  const auto height = Dimension(options, L"height", std::clamp(size.Height, minHeight, maxHeight));
  if (width < minWidth || width > maxWidth || height < minHeight || height > maxHeight) throw winrt::hresult_invalid_argument(L"Window size is outside its constraints");
  window.minWidth = minWidth; window.minHeight = minHeight; window.maxWidth = maxWidth; window.maxHeight = maxHeight;
  if (options.HasKey(L"title")) window.app.Title(options.GetNamedString(L"title"));
  if (options.HasKey(L"resizable")) { window.normal.IsResizable(options.GetNamedBoolean(L"resizable")); window.normal.IsMaximizable(options.GetNamedBoolean(L"resizable")); }
  if (options.HasKey(L"minimizable")) window.normal.IsMinimizable(options.GetNamedBoolean(L"minimizable"));
  if (options.HasKey(L"alwaysOnTop")) window.normal.IsAlwaysOnTop(options.GetNamedBoolean(L"alwaysOnTop"));
  if (window.app.Presenter().Kind() != UI::AppWindowPresenterKind::FullScreen) window.app.Resize({width, height});
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
// Retained for the process lifetime. An abandoned owner can be replaced after a
// crash; a slow/hung owner must never cause us to start a second notebook writer.
static winrt::handle instanceMutex;
static std::wstring ProjectKey() {
  auto identity = LegendWindowsEnv(L"LEGEND_PROJECT_ID");
  if (identity.empty()) throw winrt::hresult_invalid_argument(L"Missing Legend project identity");
  auto algorithm = winrt::Windows::Security::Cryptography::Core::HashAlgorithmProvider::OpenAlgorithm(winrt::Windows::Security::Cryptography::Core::HashAlgorithmNames::Sha256());
  auto bytes = winrt::Windows::Security::Cryptography::CryptographicBuffer::ConvertStringToBinary(identity, winrt::Windows::Security::Cryptography::BinaryStringEncoding::Utf8);
  return std::wstring(winrt::Windows::Security::Cryptography::CryptographicBuffer::EncodeToHexString(algorithm.HashData(bytes)));
}
static bool ForwardLaunch() {
  auto key = L"Legend.Project." + ProjectKey();
  instanceMutex.attach(CreateMutexW(nullptr, FALSE, (L"Local\\" + key).c_str()));
  if (!instanceMutex) winrt::throw_last_error();
  const auto deadline = GetTickCount64() + 60000;
  for (;;) {
    const auto wait = WaitForSingleObject(instanceMutex.get(), 0);
    if (wait == WAIT_OBJECT_0 || wait == WAIT_ABANDONED) return false;
    if (wait == WAIT_FAILED) winrt::throw_last_error();
    struct Search { std::wstring key; HWND target = nullptr; } search{key};
    EnumWindows([](HWND hwnd, LPARAM param) -> BOOL { auto data = reinterpret_cast<Search *>(param); if (GetPropW(hwnd, data->key.c_str())) { data->target = hwnd; return FALSE; } return TRUE; }, reinterpret_cast<LPARAM>(&search));
    if (search.target) {
      DWORD process = 0; GetWindowThreadProcessId(search.target, &process); AllowSetForegroundWindow(process);
      auto text = GetCommandLineW(); COPYDATASTRUCT data{0x4C47, static_cast<DWORD>((wcslen(text) + 1) * sizeof(wchar_t)), text}; DWORD_PTR result = 0;
      if (!SendMessageTimeoutW(search.target, WM_COPYDATA, 0, reinterpret_cast<LPARAM>(&data), SMTO_ABORTIFHUNG | SMTO_BLOCK, 5000, &result) || !result)
        throw winrt::hresult_error(HRESULT_FROM_WIN32(ERROR_TIMEOUT), L"The existing Legend app did not accept this launch. Close it before retrying.");
      return true;
    }
    if (GetTickCount64() >= deadline)
      throw winrt::hresult_error(HRESULT_FROM_WIN32(ERROR_TIMEOUT), L"The existing Legend app is still starting. A second instance was not opened.");
    // Waiting for the main window also covers simultaneous first launches.
    Sleep(50);
  }
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
    if (message == WM_COPYDATA) { auto data = reinterpret_cast<COPYDATASTRUCT *>(lParam); if (data && data->dwData == 0x4C47 && data->cbData >= sizeof(wchar_t) && data->cbData <= 65536 && data->cbData % sizeof(wchar_t) == 0) { auto text = static_cast<wchar_t *>(data->lpData); if (text && text[data->cbData / sizeof(wchar_t) - 1] == 0) { QueueLaunch(text, false); ShowWindow(hwnd, IsIconic(hwnd) ? SW_RESTORE : SW_SHOW); SetForegroundWindow(hwnd); return TRUE; } } return FALSE; }
    if (message == WM_GETMINMAXINFO) {
      auto limits = reinterpret_cast<MINMAXINFO *>(lParam); auto const &window = windows.at(id);
      limits->ptMinTrackSize = {window.minWidth, window.minHeight}; limits->ptMaxTrackSize = {window.maxWidth, window.maxHeight}; return 0;
    }
    if (message == WM_SHOWWINDOW) PostMessageW(hwnd, WM_APP + 18, 0, 0);
    if (message == WM_APP + 18) { UpdateModality(); return 0; }
    if (message == WM_EXITSIZEMOVE) SaveFrame(id, hwnd);
    if (message == WM_MOVE) Emit({{"type", "move"}, {"windowId", id}});
    if (message == WM_SIZE) Emit({{"type", "resize"}, {"windowId", id}});
    if (message == WM_NCDESTROY && currentMenu && GetMenu(hwnd) == currentMenu) { currentMenu = nullptr; menuActions.clear(); }
    if (message == WM_ACTIVATE && LOWORD(wParam) != WA_INACTIVE && currentMenu && GetMenu(hwnd) != currentMenu) {
      for (auto const &[name, other] : windows) { auto otherHwnd = Hwnd(other); if (GetMenu(otherHwnd) == currentMenu) { SetMenu(otherHwnd, nullptr); DrawMenuBar(otherHwnd); } }
      SetMenu(hwnd, currentMenu); DrawMenuBar(hwnd);
    }
    if (message == WM_ACTIVATE) Emit({{"type", LOWORD(wParam) == WA_INACTIVE ? "blur" : "focus"}, {"windowId", id}});
    if (message == WM_COMMAND && (HIWORD(wParam) == 0 || HIWORD(wParam) == 1)) {
      auto found = menuActions.find(LOWORD(wParam)); if (found != menuActions.end() && context) { context.EmitJSEvent(L"RCTDeviceEventEmitter", L"NativeMenuAction", found->second.Copy()); return 0; }
    }
    if (message == WM_TIMER && wParam == 0x4C47) { if (id == "main") quitPending = false; windows.at(id).pending = false; KillTimer(hwnd, 0x4C47); return 0; }
  }
  return DefSubclassProc(hwnd, message, wParam, lParam);
}
static void Attach(std::string id, React::ReactNativeWindow view) {
  Window window; window.view = view; window.app = view.AppWindow(); window.normal = window.app.Presenter().as<UI::OverlappedPresenter>(); windows.emplace(id, window);
  SetPropW(Hwnd(window), (L"Legend.Window." + std::wstring(to_hstring(id))).c_str(), reinterpret_cast<HANDLE>(1));
  SetPropW(Hwnd(window), L"Legend.ReactWindow", reinterpret_cast<HANDLE>(1));
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
    if (id != "main") {
      // A menu attached to a destroyed HWND is otherwise destroyed by Windows.
      auto closing = windows.find(id);
      if (currentMenu && closing != windows.end() && GetMenu(Hwnd(closing->second)) == currentMenu) {
        SetMenu(Hwnd(closing->second), nullptr);
        auto main = Hwnd(windows.at("main")); SetMenu(main, currentMenu); DrawMenuBar(main);
      }
      const auto parent = windows.at(id).parentId;
      windows.erase(id); UpdateModality();
      if (!parent.empty() && windows.count(parent) && IsWindowEnabled(Hwnd(windows.at(parent)))) SetForegroundWindow(Hwnd(windows.at(parent)));
    }
  });
}
static LRESULT CALLBACK Keyboard(int code, WPARAM remove, LPARAM param) {
  if (code >= 0 && remove == PM_REMOVE) {
    auto message = reinterpret_cast<MSG *>(param);
    auto target = GetAncestor(message->hwnd, GA_ROOT);
    if (acceleratorTable && !Id(target).empty() && IsWindowEnabled(target) && TranslateAcceleratorW(target, acceleratorTable, message)) { message->message = WM_NULL; return CallNextHookEx(keyboardHook, code, remove, param); }
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
static React::JSValue Value(Json::IJsonValue const &value) {
  switch (value.ValueType()) {
    case Json::JsonValueType::Object: { React::JSValueObject result; for (auto const &entry : value.GetObject()) result.emplace(to_string(entry.Key()), Value(entry.Value())); return result; }
    case Json::JsonValueType::Array: { React::JSValueArray result; for (auto const &entry : value.GetArray()) result.push_back(Value(entry)); return result; }
    case Json::JsonValueType::String: return to_string(value.GetString());
    case Json::JsonValueType::Number: return value.GetNumber();
    case Json::JsonValueType::Boolean: return value.GetBoolean();
    default: return nullptr;
  }
}
static std::wstring MenuTitle(winrt::hstring const &title) {
  std::wstring result; for (auto c : title) { result += c; if (c == L'&') result += c; } return result;
}
static void RebuildMenus() {
  auto next = CreateMenu(); std::map<UINT, React::JSValueObject> actions; std::vector<ACCEL> accelerators; UINT command = 0x5000;
  for (auto const &value : menus) {
    auto menu = value.GetObject(); auto popup = CreatePopupMenu();
    for (auto const &entry : menu.GetNamedArray(L"items")) {
      auto item = entry.GetObject(); if (item.GetNamedBoolean(L"hidden", false)) continue;
      if (item.GetNamedBoolean(L"separator", false)) { AppendMenuW(popup, MF_SEPARATOR, 0, nullptr); continue; }
      auto flags = MF_STRING | (item.GetNamedBoolean(L"enabled", true) ? MF_ENABLED : MF_GRAYED) | (item.GetNamedBoolean(L"checked", false) ? MF_CHECKED : 0);
      auto title = MenuTitle(item.GetNamedString(L"title", L""));
      if (item.HasKey(L"shortcut") && item.GetNamedValue(L"shortcut").ValueType() == Json::JsonValueType::Object) {
        auto shortcut = item.GetNamedObject(L"shortcut"); auto key = shortcut.GetNamedString(L"key", L"");
        if (key.size() == 1 && command <= 0xffff) {
          const auto bits = static_cast<int>(shortcut.GetNamedNumber(L"modifiers", 0));
          BYTE modifiers = FVIRTKEY; if (bits & ((1 << 18) | (1 << 20))) modifiers |= FCONTROL;
          if (bits & (1 << 19)) modifiers |= FALT; if (bits & (1 << 17)) modifiers |= FSHIFT;
          wchar_t c = key[0]; WORD code = 0;
          if (c >= 0xf704 && c <= 0xf717) code = VK_F1 + c - 0xf704;
          else if (c == 0xf700) code = VK_UP; else if (c == 0xf701) code = VK_DOWN; else if (c == 0xf702) code = VK_LEFT; else if (c == 0xf703) code = VK_RIGHT;
          else if (c == 0xf728) code = VK_DELETE; else if (c == 0x7f) code = VK_BACK;
          else { auto scan = VkKeyScanW(c); if (scan != -1) { code = LOBYTE(scan); if (HIBYTE(scan) & 1) modifiers |= FSHIFT; if (HIBYTE(scan) & 2) modifiers |= FCONTROL; if (HIBYTE(scan) & 4) modifiers |= FALT; } }
          if (code) {
            if (item.GetNamedBoolean(L"enabled", true)) accelerators.push_back({modifiers, code, static_cast<WORD>(command)});
            title += L"\t"; if (modifiers & FCONTROL) title += L"Ctrl+"; if (modifiers & FALT) title += L"Alt+"; if (modifiers & FSHIFT) title += L"Shift+";
            wchar_t label[80]{}; auto scan = MapVirtualKeyW(code, MAPVK_VK_TO_VSC); if (code == VK_LEFT || code == VK_RIGHT || code == VK_UP || code == VK_DOWN || code == VK_DELETE) scan |= 0x100;
            GetKeyNameTextW(static_cast<LONG>(scan << 16), label, 80); title += label;
          }
        }
      }
      AppendMenuW(popup, flags, command, title.c_str());
      actions.emplace(command++, React::JSValueObject{{"ownerId", to_string(item.GetNamedString(L"_legendOwner", to_hstring(menuOwner)))}, {"menuId", to_string(item.GetNamedString(L"_legendMenu", menu.GetNamedString(L"id")))}, {"itemId", to_string(item.GetNamedString(L"id"))}, {"payload", Value(item.GetNamedObject(L"payload", Json::JsonObject()))}});
    }
    AppendMenuW(next, MF_POPUP, reinterpret_cast<UINT_PTR>(popup), MenuTitle(menu.GetNamedString(L"title")).c_str());
  }
  for (auto const &[id, window] : windows) SetMenu(Hwnd(window), nullptr);
  auto target = GetForegroundWindow(); if (Id(target).empty()) target = Hwnd(windows.at("main")); SetMenu(target, next); DrawMenuBar(target);
  auto old = currentMenu; currentMenu = next; menuActions = std::move(actions); if (old) DestroyMenu(old);
  if (acceleratorTable) DestroyAcceleratorTable(acceleratorTable);
  acceleratorTable = accelerators.empty() ? nullptr : CreateAcceleratorTableW(accelerators.data(), static_cast<int>(accelerators.size()));
}
static void Initialize(React::ReactNativeWin32App const &app) {
  // WinRT activation must follow init_apartment, never static initialization.
  pendingURLs = Json::JsonArray(); menus = Json::JsonArray();
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
  SetPropW(Hwnd(windows.at("main")), (L"Legend.Project." + ProjectKey()).c_str(), reinterpret_cast<HANDLE>(1));
  winrt::check_hresult(SetCurrentProcessExplicitAppUserModelID((L"Legend." + ProjectKey()).c_str()));
  QueueLaunch(GetCommandLineW(), true);
  auto config = Json::JsonObject::Parse(winrt::hstring(LegendWindowsEnv(L"LEGEND_WINDOW_CONFIG").empty() ? L"{}" : LegendWindowsEnv(L"LEGEND_WINDOW_CONFIG")));
  auto appWindow = windows.at("main").app;
  Json::JsonObject style;
  style.SetNamedValue(L"width", Json::JsonValue::CreateNumberValue(config.GetNamedNumber(L"width", 1000)));
  style.SetNamedValue(L"height", Json::JsonValue::CreateNumberValue(config.GetNamedNumber(L"height", 700)));
  for (auto key : {L"minWidth", L"minHeight", L"maxWidth", L"maxHeight", L"resizable", L"minimizable", L"alwaysOnTop"})
    if (config.HasKey(key)) style.SetNamedValue(key, config.GetNamedValue(key));
  ApplyOptions(windows.at("main"), style);
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
          const auto parentId = to_string(args.GetNamedString(L"parentId", L""));
          const bool modal = args.GetNamedBoolean(L"modal", false);
          if ((modal && parentId.empty()) || parentId == id) throw winrt::hresult_invalid_argument(L"Modal windows need a distinct parent");
          if (!parentId.empty() && !windows.count(parentId)) { promise.Reject(React::ReactError{"E_NOT_FOUND", "Parent window not found"}); return; }
          if (modal) for (auto const &[childId, child] : windows) if (child.parentId == parentId && child.modal) { promise.Reject(React::ReactError{"E_BUSY", "Parent already has a modal window"}); return; }
          auto view = React::ReactNativeWindow::CreateFromCompositor(compositor); auto app = view.AppWindow();
          app.Title(args.GetNamedString(L"title", L"Window")); app.Resize({static_cast<int32_t>(args.GetNamedNumber(L"width", 800)), static_cast<int32_t>(args.GetNamedNumber(L"height", 600))});
          React::ReactViewOptions options; options.ComponentName(L"main");
          Json::JsonObject props; props.SetNamedValue(L"windowId", Json::JsonValue::CreateStringValue(to_hstring(id))); props.SetNamedValue(L"windowProps", args.GetNamedObject(L"props", Json::JsonObject()));
          // Write JSON props through the public JSValue writer contract.
          auto propsJson = to_string(props.Stringify());
          options.InitialProps([propsJson](React::IJSValueWriter const &writer) { WriteJson(writer, Json::JsonObject::Parse(to_hstring(propsJson))); });
          // Validate all options before attaching/showing a new React root.
          Json::JsonObject style;
          for (auto const &pair : args) if (pair.Key() != L"id" && pair.Key() != L"props" && pair.Key() != L"parentId" && pair.Key() != L"modal") style.SetNamedValue(pair.Key(), pair.Value());
          Window pending; pending.view = view; pending.app = app; pending.normal = app.Presenter().as<UI::OverlappedPresenter>();
          try { ApplyOptions(pending, style); } catch (...) { app.Destroy(); throw; }
          Attach(id, view);
          auto &attached = windows.at(id); attached.parentId = parentId; attached.modal = modal;
          if (!parentId.empty()) {
            SetLastError(0); SetWindowLongPtrW(Hwnd(attached), GWLP_HWNDPARENT, reinterpret_cast<LONG_PTR>(Hwnd(windows.at(parentId))));
            if (GetLastError()) { app.Destroy(); throw winrt::hresult_error(HRESULT_FROM_WIN32(GetLastError())); }
          }
          attached.minWidth = pending.minWidth; attached.minHeight = pending.minHeight; attached.maxWidth = pending.maxWidth; attached.maxHeight = pending.maxHeight;
          view.ReactNativeIsland().ReactViewHost(React::ReactCoreInjection::MakeViewHost(host, options)); app.Show(); UpdateModality();
          promise.Resolve(to_string(Info(id).Stringify())); return;
        }
        if (method == "displays") { promise.Resolve(to_string(Displays().Stringify())); return; }
        if (method == "list") { Json::JsonArray result; for (auto const &[name, window] : windows) result.Append(Info(name)); promise.Resolve(to_string(result.Stringify())); return; }
        auto found = windows.find(id); if (found == windows.end()) { promise.Reject(React::ReactError{"E_NOT_FOUND", "Window not found"}); return; }
        auto &window = found->second; auto hwnd = Hwnd(window);
        if (method == "info") { promise.Resolve(to_string(Info(id).Stringify())); return; }
        if (method == "options") ApplyOptions(window, args.GetNamedObject(L"options"));
        else if (method == "center") {
          MONITORINFO monitor{}; monitor.cbSize = sizeof(monitor);
          if (!GetMonitorInfoW(MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST), &monitor)) winrt::throw_last_error();
          auto size = window.app.Size();
          window.app.Move({monitor.rcWork.left + (monitor.rcWork.right - monitor.rcWork.left - size.Width) / 2, monitor.rcWork.top + (monitor.rcWork.bottom - monitor.rcWork.top - size.Height) / 2});
        } else if (method == "frame") {
          auto frame = args.GetNamedObject(L"frame"); const auto x = frame.GetNamedNumber(L"x"), y = frame.GetNamedNumber(L"y");
          if (!std::isfinite(x) || !std::isfinite(y) || x < INT32_MIN || x > INT32_MAX || y < INT32_MIN || y > INT32_MAX) throw winrt::hresult_invalid_argument(L"Invalid frame origin");
          auto width = Dimension(frame, L"width", window.app.Size().Width), height = Dimension(frame, L"height", window.app.Size().Height);
          if (width < window.minWidth || width > window.maxWidth || height < window.minHeight || height > window.maxHeight) throw winrt::hresult_invalid_argument(L"Frame is outside window constraints");
          window.app.MoveAndResize({static_cast<int32_t>(x), static_cast<int32_t>(y), width, height});
        } else if (method == "fullscreen") {
          if (args.GetNamedBoolean(L"enabled")) window.app.SetPresenter(UI::AppWindowPresenterKind::FullScreen);
          else window.app.SetPresenter(window.normal);
        } else if (method == "title") window.app.Title(args.GetNamedString(L"title"));
        else if (method == "closeGuard") window.guard = args.GetNamedBoolean(L"enabled");
        else if (method == "replyClose") {
          if (window.pending && args.GetNamedNumber(L"requestId", 0) == window.request) { window.pending = false; KillTimer(hwnd, 0x4C47); if (args.GetNamedBoolean(L"allow")) { if (id == "main") RequestQuit(); else { window.allow = true; window.app.Destroy(); } } }
        } else if (method == "close") PostMessageW(hwnd, WM_CLOSE, 0, 0);
        else if (method == "show") { window.app.Show(); UpdateModality(); SetForegroundWindow(hwnd); }
        else if (method == "hide") { window.app.Hide(); UpdateModality(); }
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
