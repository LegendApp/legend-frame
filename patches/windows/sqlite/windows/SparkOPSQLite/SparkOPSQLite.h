#pragma once
#include "NativeModules.h"
#include <JSI/JsiApiContext.h>
#include <OPSqlite.hpp>
#include <filesystem>
#include <shlobj.h>
#include <winrt/Windows.Security.Cryptography.h>
#include <winrt/Windows.Security.Cryptography.Core.h>
#pragma comment(lib, "Shell32.lib")
REACT_MODULE(SparkOPSQLiteModule, L"OPSQLite")
struct SparkOPSQLiteModule {
  winrt::Microsoft::ReactNative::ReactContext context;
  std::shared_ptr<std::atomic<bool>> generation;
  REACT_INIT(Initialize) void Initialize(winrt::Microsoft::ReactNative::ReactContext const &value) noexcept { context = value; }
  ~SparkOPSQLiteModule() { if (generation) opsqlite::invalidate(generation); }
  static std::filesystem::path Directory() {
    wchar_t project[32768]{}; if (!GetEnvironmentVariableW(L"SPARK_PROJECT_ID", project, 32768)) throw winrt::hresult_invalid_argument(L"Missing project identity");
    using namespace winrt::Windows::Security::Cryptography;
    auto hash = Core::HashAlgorithmProvider::OpenAlgorithm(Core::HashAlgorithmNames::Sha256());
    auto id = CryptographicBuffer::EncodeToHexString(hash.HashData(CryptographicBuffer::ConvertStringToBinary(project, BinaryStringEncoding::Utf8)));
    PWSTR raw = nullptr; winrt::check_hresult(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, nullptr, &raw)); std::filesystem::path path(raw); CoTaskMemFree(raw);
    path /= L"Spark"; path /= id.c_str(); path /= L"data"; std::filesystem::create_directories(path); return path;
  }
  REACT_SYNC_METHOD(getConstants) winrt::Microsoft::ReactNative::JSValueObject getConstants() { return {{"WINDOWS_DATABASE_PATH", winrt::to_string(Directory().wstring())}}; }
  REACT_SYNC_METHOD(install) bool install() {
    if (generation) return true;
    auto handle = context.Handle().JSRuntime(); if (!handle) return false;
    auto &runtime = winrt::Microsoft::ReactNative::GetOrCreateContextRuntime(context, handle);
    auto location = winrt::to_string(Directory().wstring());
    generation = opsqlite::install(runtime, context.CallInvoker(), location.c_str(), ""); return true;
  }
  REACT_METHOD(moveAssetsDatabase) void moveAssetsDatabase(winrt::Microsoft::ReactNative::JSValueObject args, winrt::Microsoft::ReactNative::ReactPromise<bool> promise) noexcept {
    try {
      auto filename = args.at("filename").AsString(); std::filesystem::path name(winrt::to_hstring(filename).c_str());
      if (name.empty() || name.has_parent_path() || name == L"." || name == L".." || filename.find('\0') != std::string::npos) throw winrt::hresult_invalid_argument(L"Asset filename must be a simple filename");
      wchar_t executable[32768]{}; GetModuleFileNameW(nullptr, executable, 32768);
      auto source = std::filesystem::path(executable).parent_path() / L"Assets" / name, destination = Directory() / name;
      auto overwrite = args.count("overwrite") && args.at("overwrite").AsBoolean();
      promise.Resolve(std::filesystem::copy_file(source, destination, overwrite ? std::filesystem::copy_options::overwrite_existing : std::filesystem::copy_options::none));
    } catch (std::exception const &error) { promise.Reject(error.what()); }
    catch (winrt::hresult_error const &error) { promise.Reject(winrt::to_string(error.message()).c_str()); }
  }
  REACT_SYNC_METHOD(getDylibPath) std::string getDylibPath(std::string, std::string name) {
    std::filesystem::path file(winrt::to_hstring(name).c_str()); if (file.empty() || file.has_parent_path()) throw winrt::hresult_invalid_argument(L"Expected a library filename");
    wchar_t executable[32768]{}; GetModuleFileNameW(nullptr, executable, 32768);
    return winrt::to_string((std::filesystem::path(executable).parent_path() / (file.wstring() + L".dll")).wstring());
  }
};
