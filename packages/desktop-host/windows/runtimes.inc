// Margelo Runtimes backend. Every worker is a real RNW host with its own Hermes heap.
#include <JSI/JsiApiContext.h>
#include <functional>
#include <memory>
#include <vector>
#include <optional>
#include <winrt/Microsoft.ReactNative.Composition.h>
namespace LegendWin {
namespace Composition = winrt::Microsoft::ReactNative::Composition;
static React::ReactPropertyId<bool> secondaryProperty{L"Legend", L"SecondaryRuntime"};
struct Worker {
  std::string name, kind;
  React::ReactNativeHost host{nullptr}; React::ReactContext context;
  bool ready = false, stopped = false;
  std::vector<std::function<void(std::string const &)>> pending;
  std::vector<std::function<void()>> detach;
};
static std::map<std::string, std::shared_ptr<Worker>> workers;
struct RuntimeCall { std::string runtime; React::ReactPromise<std::string> promise; };
static std::map<std::string, RuntimeCall> runtimeCalls;
static uint64_t runtimeCallSequence = 0;
static std::shared_ptr<bool> runtimeOwner;
static bool IsSecondary(React::ReactContext const &value) { return value.Properties().Get(secondaryProperty).value_or(false); }
static void StopWorker(std::string const &name, std::string const &reason) {
  auto found = workers.find(name); if (found == workers.end()) return; auto worker = found->second; workers.erase(found); worker->stopped = true;
  auto pending = std::move(worker->pending); for (auto &callback : pending) callback(reason);
  for (auto &detach : worker->detach) detach(); worker->detach.clear();
  for (auto it = runtimeCalls.begin(); it != runtimeCalls.end();) { if (it->second.runtime == name) { it->second.promise.Reject(React::ReactError{"E_RUNTIME_DESTROYED", reason}); it = runtimeCalls.erase(it); } else ++it; }
  auto unload = worker->host.UnloadInstance(); unload.Completed([worker](auto const &, auto const &) {});
}
static void StopWorkers() { while (!workers.empty()) StopWorker(workers.begin()->first, "Runtime was destroyed"); }
static winrt::fire_and_forget LoadWorker(std::shared_ptr<Worker> worker) {
  try { co_await worker->host.LoadInstance(); }
  catch (...) { auto error = winrt::to_string(winrt::to_message()); React::ReactDispatcher(host.InstanceSettings().UIDispatcher()).Post([worker, error]() { if (!worker->stopped) StopWorker(worker->name, error); }); }
}
static winrt::fire_and_forget WorkerDeadline(std::weak_ptr<Worker> weak, React::ReactDispatcher dispatcher) {
  co_await winrt::resume_after(std::chrono::seconds(120));
  dispatcher.Post([weak]() { if (auto worker = weak.lock(); worker && !worker->stopped && !worker->ready) StopWorker(worker->name, "Worker bundle did not become ready within 120 seconds"); });
}
static std::shared_ptr<Worker> GetWorker(std::string const &name, std::string kind = "threaded-runtime") {
  if (name.empty() || name == "main" || name.size() > 100) throw winrt::hresult_invalid_argument(L"Expected a secondary runtime name of 1–100 characters");
  if (auto found = workers.find(name); found != workers.end()) { if (kind != found->second->kind && kind != "threaded-runtime") throw winrt::hresult_invalid_argument(L"Runtime kind cannot change while running"); return found->second; }
  auto worker = std::make_shared<Worker>(); worker->name = name; worker->kind = kind; worker->host = React::ReactNativeHost();
  auto settings = worker->host.InstanceSettings(), main = host.InstanceSettings();
  settings.UIDispatcher(main.UIDispatcher()); settings.JSIEngineOverride(React::JSIEngine::Hermes);
  settings.SourceBundleHost(main.SourceBundleHost()); settings.SourceBundlePort(main.SourceBundlePort());
  settings.UseDeveloperSupport(main.UseDeveloperSupport()); settings.UseFastRefresh(true); settings.UseDirectDebugger(false);
  settings.DebugBundlePath(L".threaded-runtime/entry"); settings.JavaScriptBundleFile(L"index.windows");
  React::ReactPropertyBag(settings.Properties()).Set(secondaryProperty, true);
  for (auto const &provider : main.PackageProviders()) settings.PackageProviders().Append(provider);
  auto weak = std::weak_ptr(worker); auto dispatcher = React::ReactDispatcher(main.UIDispatcher());
  settings.InstanceCreated([weak](auto const &, React::InstanceCreatedEventArgs const &args) {
    if (auto worker = weak.lock()) {
      React::ReactContext context(args.Context()); auto handle = context.Handle().JSRuntime();
      if (!handle) throw winrt::hresult_error(E_FAIL, L"Worker has no Hermes JSI runtime");
      auto &runtime = React::GetOrCreateContextRuntime(context, handle); facebook::jsi::Object env(runtime);
      env.setProperty(runtime, "runtimeName", facebook::jsi::String::createFromUtf8(runtime, worker->name)); env.setProperty(runtime, "kind", facebook::jsi::String::createFromUtf8(runtime, worker->kind)); runtime.global().setProperty(runtime, "__THREADED_RUNTIME_ENV__", std::move(env));
    }
  });
  settings.InstanceLoaded([weak, dispatcher](auto const &, React::InstanceLoadedEventArgs const &args) {
    auto context = React::ReactContext(args.Context()); auto failed = args.Failed();
    dispatcher.Post([weak, context, failed]() {
      auto worker = weak.lock(); if (!worker || worker->stopped) return;
      if (failed) { StopWorker(worker->name, "Worker bundle failed to load; inspect Metro and native logs"); return; }
      worker->context = context; worker->ready = true; auto pending = std::move(worker->pending); for (auto &callback : pending) callback("");
    });
  });
  workers.emplace(name, worker); LoadWorker(worker); WorkerDeadline(weak, dispatcher); return worker;
}
static void WhenReady(std::shared_ptr<Worker> const &worker, std::function<void(std::string const &)> callback) {
  if (worker->ready) callback(""); else { if (worker->pending.size() >= 1000) throw winrt::hresult_error(E_FAIL, L"Too many pending runtime operations"); worker->pending.push_back(std::move(callback)); }
}
static winrt::fire_and_forget CallDeadline(std::string id, React::ReactDispatcher dispatcher) {
  co_await winrt::resume_after(std::chrono::seconds(120)); dispatcher.Post([id]() { auto found = runtimeCalls.find(id); if (found != runtimeCalls.end()) { found->second.promise.Reject(React::ReactError{"E_RUNTIME_TIMEOUT", "Runtime call exceeded 120 seconds"}); runtimeCalls.erase(found); } });
}
struct RuntimeProps : winrt::implements<RuntimeProps, React::IComponentProps> {
  std::string name = "background-list", app = "ThreadedRuntimeHost", component, key, props = "{}"; React::ViewProps view{nullptr};
  void SetProp(uint32_t, winrt::hstring const &key, React::IJSValueReader const &reader) noexcept { if (key == L"runtimeName") React::ReadValue(reader, name); else if (key == L"appName") React::ReadValue(reader, app); else if (key == L"initialPropsJson") React::ReadValue(reader, props); else if (key == L"componentName") React::ReadValue(reader, component); else if (key == L"surfaceKey") React::ReadValue(reader, this->key); }
};
struct RuntimeSurface : winrt::implements<RuntimeSurface, winrt::Windows::Foundation::IInspectable> {
  winrt::weak_ref<Composition::ContentIslandComponentView> view; React::ReactNativeIsland island{nullptr};
  React::EventEmitter emitter{nullptr}; std::string failure;
  void Fail(std::string const &message) { failure = message; if (emitter) emitter.DispatchEvent(L"runtimeError", [message](React::IJSValueWriter const &writer) { writer.WriteObjectBegin(); writer.WritePropertyName(L"message"); writer.WriteString(winrt::to_hstring(message)); writer.WriteObjectEnd(); }); }
  std::string name, app, component, key, props; uint64_t generation = 0; bool mounted = false;
  void Close() noexcept { ++generation; auto previous = island; island = nullptr; if (previous) { try { previous.ReactViewHost(nullptr); previous.Island().Close(); } catch (...) { /* The containing island may already be closing. */ } } }
  Json::JsonObject InitialProps() {
    Json::JsonObject::Parse(winrt::to_hstring(props)); // Validate before entering an RNW writer callback.
    Json::JsonObject value;
    value.SetNamedValue(L"componentName", Json::JsonValue::CreateStringValue(winrt::to_hstring(component)));
    value.SetNamedValue(L"initialPropsJson", Json::JsonValue::CreateStringValue(winrt::to_hstring(props)));
    value.SetNamedValue(L"runtimeName", Json::JsonValue::CreateStringValue(winrt::to_hstring(name)));
    return value;
  }
  void Render() { try {
    if (!mounted || name.empty() || app.empty()) return; Close();
    auto worker = GetWorker(name); auto weak = get_weak(); const auto expected = generation;
    WhenReady(worker, [weak, expected, worker](std::string const &error) {
      auto self = weak.get(); if (!self || !self->mounted || self->generation != expected) return;
      if (!error.empty()) { self->Fail(error); return; }
      try {
      auto view = self->view.get(); if (!view) return;
      self->island = React::ReactNativeIsland(compositor); React::ReactViewOptions options; options.ComponentName(winrt::to_hstring(self->app));
      auto props = self->InitialProps(); options.InitialProps([props](React::IJSValueWriter const &writer) { WriteJson(writer, props); });
      self->island.ReactViewHost(React::ReactCoreInjection::MakeViewHost(worker->host, options)); view.Connect(self->island.Island());
      worker->detach.push_back([weak, expected]() { if (auto self = weak.get(); self && self->generation == expected) self->Close(); });
      } catch (...) { self->Fail(winrt::to_string(winrt::to_message())); }
    });
  } catch (...) { Fail(winrt::to_string(winrt::to_message())); } }
};
static void RegisterRuntimeSurface(React::IReactPackageBuilder const &package) {
  package.as<React::IReactPackageBuilderFabric>().AddViewComponent(L"ThreadedRuntimeSurface", [](React::IReactViewComponentBuilder const &builder) {
    builder.SetCreateProps([](React::ViewProps const &view, React::IComponentProps const &previous) { auto props = winrt::make_self<RuntimeProps>(); if (previous) { auto old = winrt::get_self<RuntimeProps>(previous); props->name = old->name; props->app = old->app; props->component = old->component; props->key = old->key; props->props = old->props; } props->view = view; return props.as<React::IComponentProps>(); });
    builder.as<Composition::IReactCompositionViewComponentBuilder>().SetContentIslandComponentViewInitializer([](Composition::ContentIslandComponentView const &view) {
      auto state = winrt::make_self<RuntimeSurface>(); state->view = view; view.UserData(state.as<winrt::Windows::Foundation::IInspectable>()); auto weak = state->get_weak();
      view.Mounted([weak](auto const &, auto const &) { if (auto self = weak.get()) { self->mounted = true; self->Render(); } });
      view.Unmounted([weak](auto const &, auto const &) { if (auto self = weak.get()) { self->mounted = false; self->Close(); } });
      view.Destroying([weak](auto const &, auto const &) { if (auto self = weak.get()) { self->mounted = false; self->Close(); } });
    });
    builder.SetUpdateEventEmitterHandler([](React::ComponentView const &view, React::EventEmitter const &emitter) { auto state = winrt::get_self<RuntimeSurface>(view.UserData()); state->emitter = emitter; if (!state->failure.empty()) state->Fail(state->failure); });
    builder.SetUpdatePropsHandler([](React::ComponentView const &view, React::IComponentProps const &props, React::IComponentProps const &) {
      auto self = winrt::get_self<RuntimeSurface>(view.UserData()); auto value = winrt::get_self<RuntimeProps>(props);
      bool recreate = self->name != value->name || self->app != value->app || self->key != value->key; self->name = value->name; self->app = value->app; self->component = value->component; self->key = value->key; self->props = value->props;
      if (recreate || !self->island) self->Render(); else { try { auto props = self->InitialProps(); self->island.SetProperties([props](React::IJSValueWriter const &writer) { WriteJson(writer, props); }); } catch (...) { self->Fail(winrt::to_string(winrt::to_message())); } }
    });
  });
}
}
REACT_MODULE(LegendThreadedRuntime, L"ThreadedRuntime")
struct LegendThreadedRuntime {
  using Promise = winrt::Microsoft::ReactNative::ReactPromise<void>;
  winrt::Microsoft::ReactNative::ReactContext context; std::shared_ptr<bool> owner;
  REACT_INIT(Initialize) void Initialize(winrt::Microsoft::ReactNative::ReactContext const &value) noexcept { context = value; if (!LegendWin::IsSecondary(context)) { owner = std::make_shared<bool>(true); context.UIDispatcher().Post([token = owner]() { LegendWin::StopWorkers(); LegendWin::runtimeOwner = token; }); } }
  ~LegendThreadedRuntime() { if (owner) context.UIDispatcher().Post([token = owner]() { if (LegendWin::runtimeOwner == token) { LegendWin::StopWorkers(); LegendWin::runtimeOwner.reset(); } }); }
  template<typename F> void UI(F action, Promise promise) { context.UIDispatcher().Post([action, promise]() { try { action(); promise.Resolve(); } catch (winrt::hresult_error const &error) { promise.Reject(winrt::Microsoft::ReactNative::ReactError{"E_RUNTIME", winrt::to_string(error.message())}); } catch (std::exception const &error) { promise.Reject(error.what()); } }); }
  REACT_METHOD(prewarmRuntime) void prewarmRuntime(std::string name, Promise promise) noexcept { prewarmRuntimeWithOptions(name, "threaded-runtime", false, promise); }
  REACT_METHOD(prewarmRuntimeWithOptions) void prewarmRuntimeWithOptions(std::string name, std::string kind, bool, Promise promise) noexcept {
    context.UIDispatcher().Post([name, kind, promise]() { try { auto worker = LegendWin::GetWorker(name, kind); LegendWin::WhenReady(worker, [promise](std::string const &error) { if (error.empty()) promise.Resolve(); else promise.Reject(error.c_str()); }); } catch (winrt::hresult_error const &error) { promise.Reject(winrt::to_string(error.message()).c_str()); } });
  }
  REACT_METHOD(notifyRuntimeReady) void notifyRuntimeReady(std::string, Promise promise) noexcept { promise.Resolve(); /* InstanceLoaded gates calls after the complete worker bundle. */ }
  REACT_METHOD(dispatchHeadlessTask) void dispatchHeadlessTask(std::string name, std::string task, std::string payload, Promise promise) noexcept {
    context.UIDispatcher().Post([name, task, payload, promise]() { try { auto worker = LegendWin::GetWorker(name); LegendWin::WhenReady(worker, [worker, task, payload, promise](std::string const &error) { if (!error.empty()) { promise.Reject(error.c_str()); return; } worker->context.CallJSFunction(L"ThreadedRuntimeHeadlessTaskRunner", L"run", task, payload, worker->name); promise.Resolve(); }); } catch (winrt::hresult_error const &error) { promise.Reject(winrt::to_string(error.message()).c_str()); } });
  }
  REACT_METHOD(callRuntimeFunction) void callRuntimeFunction(std::string name, std::string function, std::string args, winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    auto dispatcher = context.UIDispatcher(); dispatcher.Post([name, function, args, promise, dispatcher]() {
      using namespace LegendWin;
      try {
        if (runtimeCalls.size() >= 1000) throw winrt::hresult_error(E_FAIL, L"Too many runtime calls");
        auto worker = GetWorker(name); auto id = std::to_string(++runtimeCallSequence);
        if (!worker->ready && worker->pending.size() >= 1000) throw winrt::hresult_error(E_FAIL, L"Too many pending runtime operations");
        runtimeCalls.emplace(id, RuntimeCall{name, promise}); CallDeadline(id, dispatcher);
        WhenReady(worker, [worker, id, function, args](std::string const &error) { auto found = runtimeCalls.find(id); if (found == runtimeCalls.end()) return; if (!error.empty()) { found->second.promise.Reject(error.c_str()); runtimeCalls.erase(found); return; } worker->context.CallJSFunction(L"ThreadedRuntimeFunctionRunner", L"run", function, args, id, worker->name); });
      } catch (winrt::hresult_error const &error) { promise.Reject(winrt::to_string(error.message()).c_str()); }
    });
  }
  REACT_METHOD(completeRuntimeFunctionCall) void completeRuntimeFunctionCall(std::string id, std::optional<std::string> result, std::optional<std::string> error, Promise promise) noexcept {
    UI([id, result, error]() { auto found = LegendWin::runtimeCalls.find(id); if (found == LegendWin::runtimeCalls.end()) return; if (error) found->second.promise.Reject(error->c_str()); else found->second.promise.Resolve(result.value_or("null")); LegendWin::runtimeCalls.erase(found); }, promise);
  }
  REACT_METHOD(destroyRuntime) void destroyRuntime(std::string name, Promise promise) noexcept { UI([name]() { LegendWin::StopWorker(name, "Runtime was destroyed"); }, promise); }
  REACT_METHOD(destroyAllRuntimes) void destroyAllRuntimes(Promise promise) noexcept { UI([]() { LegendWin::StopWorkers(); }, promise); }
  REACT_METHOD(getRuntimeNames) void getRuntimeNames(winrt::Microsoft::ReactNative::ReactPromise<std::vector<std::string>> promise) noexcept { context.UIDispatcher().Post([promise]() { std::vector<std::string> names; for (auto const &[name, worker] : LegendWin::workers) names.push_back(name); promise.Resolve(names); }); }
};
