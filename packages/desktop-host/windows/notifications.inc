// Inbox Win32 toast activation avoids a separate Windows App SDK singleton package.
#include <notificationactivationcallback.h>
#include <atomic>
#include <mutex>
#include <deque>
namespace LegendWin {
static std::mutex notificationMutex;
static std::deque<std::string> notificationResponses;
static std::deque<std::string> notificationEvents;
static std::atomic<HWND> notificationWindow{nullptr};
static void SetNotificationWindow(HWND hwnd) { notificationWindow = hwnd; if (hwnd) PostMessageW(hwnd, WM_APP + 19, 0, 0); }
static std::wstring ToastClassId() {
  auto key = ProjectKey(); return L"{" + key.substr(0, 8) + L"-" + key.substr(8, 4) + L"-" + key.substr(12, 4) + L"-" + key.substr(16, 4) + L"-" + key.substr(20, 12) + L"}";
}
static void QueueNotificationResponse(std::string const &encoded) {
  auto args = Json::JsonObject::Parse(to_hstring(encoded));
  if (args.GetNamedString(L"project") != LegendWindowsEnv(L"LEGEND_PROJECT_ID")) return;
  auto data = args.GetNamedObject(L"data", Json::JsonObject());
  for (auto const &entry : data) if (entry.Value().ValueType() != Json::JsonValueType::String) return;
  GUID identity{}; winrt::check_hresult(CoCreateGuid(&identity));
  Json::JsonObject response;
  response.SetNamedValue(L"type", Json::JsonValue::CreateStringValue(L"notificationResponse"));
  response.SetNamedValue(L"id", Json::JsonValue::CreateStringValue(winrt::to_hstring(winrt::guid(identity))));
  response.SetNamedValue(L"notificationId", Json::JsonValue::CreateStringValue(args.GetNamedString(L"notificationId")));
  response.SetNamedValue(L"action", Json::JsonValue::CreateStringValue(args.GetNamedString(L"action", L"open") == L"dismiss" ? L"dismiss" : L"open"));
  response.SetNamedValue(L"data", data); auto json = to_string(response.Stringify());
  { std::lock_guard lock(notificationMutex); notificationResponses.push_back(json); notificationEvents.push_back(json); if (notificationResponses.size() > 100) notificationResponses.pop_front(); if (notificationEvents.size() > 100) notificationEvents.pop_front(); }
  if (auto hwnd = notificationWindow.load()) PostMessageW(hwnd, WM_APP + 19, 0, 0);
}
static std::string NotificationResponses() {
  std::lock_guard lock(notificationMutex); Json::JsonArray responses;
  for (auto const &value : notificationResponses) responses.Append(Json::JsonObject::Parse(to_hstring(value))); return to_string(responses.Stringify());
}
static void EmitNotificationEvents() {
  if (!context) return;
  std::deque<std::string> events; { std::lock_guard lock(notificationMutex); events.swap(notificationEvents); }
  for (auto const &encoded : events) {
    auto event = Json::JsonObject::Parse(to_hstring(encoded));
    if (event.GetNamedString(L"action") == L"open") { auto hwnd = notificationWindow.load(); if (hwnd) { ShowWindow(hwnd, IsIconic(hwnd) ? SW_RESTORE : SW_SHOW); SetForegroundWindow(hwnd); } }
    auto value = Value(event); context.EmitJSEvent(L"RCTDeviceEventEmitter", L"desktop", std::move(value));
  }
}
struct ToastCallback : winrt::implements<ToastCallback, INotificationActivationCallback> {
  HRESULT __stdcall Activate(LPCWSTR appId, LPCWSTR arguments, const NOTIFICATION_USER_INPUT_DATA *, ULONG) noexcept override {
    try { if (appId && arguments && std::wstring(appId) == L"Legend." + ProjectKey()) QueueNotificationResponse(to_string(arguments)); return S_OK; } catch (...) { return winrt::to_hresult(); }
  }
};
struct ToastFactory : winrt::implements<ToastFactory, IClassFactory> {
  HRESULT __stdcall CreateInstance(IUnknown *outer, REFIID iid, void **object) noexcept override {
    if (!object) return E_POINTER; *object = nullptr; if (outer) return CLASS_E_NOAGGREGATION;
    try { auto callback = winrt::make_self<ToastCallback>(); return callback->QueryInterface(iid, object); } catch (...) { return winrt::to_hresult(); }
  }
  HRESULT __stdcall LockServer(BOOL) noexcept override { return S_OK; }
};
static DWORD toastRegistration = 0;
static void InitializeToastActivation() {
  auto factory = winrt::make_self<ToastFactory>();
  winrt::check_hresult(CoRegisterClassObject(winrt::guid(ToastClassId()), factory.get(), CLSCTX_LOCAL_SERVER, REGCLS_MULTIPLEUSE, &toastRegistration));
}
}
