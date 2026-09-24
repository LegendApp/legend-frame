#pragma once
#include "NativeModules.h"
#include <wincred.h>
#include <winrt/Windows.Data.Json.h>
#pragma comment(lib, "Advapi32.lib")
namespace winrt::SparkSecureStorage {
namespace React = Microsoft::ReactNative;
namespace Json = Windows::Data::Json;
REACT_MODULE(SparkSecureStorage, L"NativeDesktopSecureStorage")
struct SparkSecureStorage {
  REACT_METHOD(call)
  void call(std::string method, std::string encoded, React::ReactPromise<std::string> promise) noexcept {
    try {
      wchar_t project[201]{};
      const auto count = GetEnvironmentVariableW(L"SPARK_PROJECT_ID", project, 201);
      if (!count || count >= 201) { promise.Reject(React::ReactError{"E_IDENTITY", "Launch through Spark to establish project-scoped storage"}); return; }
      auto args = Json::JsonObject::Parse(to_hstring(encoded));
      auto key = args.GetNamedString(L"key");
      if (key.empty() || key.size() > 200 || std::wstring_view(key).find(L'\0') != std::wstring_view::npos) throw hresult_invalid_argument(L"Invalid credential key");
      std::wstring target = std::wstring(L"Spark/") + std::to_wstring(count) + L":" + project + L"/" + key.c_str();
      if (method == "get") {
        PCREDENTIALW credential = nullptr;
        if (!CredReadW(target.c_str(), CRED_TYPE_GENERIC, 0, &credential)) {
          if (GetLastError() == ERROR_NOT_FOUND) { promise.Resolve("null"); return; }
          throw_last_error();
        }
        std::wstring value;
        if (credential->CredentialBlobSize) value.assign(reinterpret_cast<wchar_t *>(credential->CredentialBlob), credential->CredentialBlobSize / sizeof(wchar_t));
        SecureZeroMemory(credential->CredentialBlob, credential->CredentialBlobSize); CredFree(credential);
        promise.Resolve(to_string(Json::JsonValue::CreateStringValue(value).Stringify()));
        SecureZeroMemory(value.data(), value.size() * sizeof(wchar_t));
      } else if (method == "set") {
        auto value = args.GetNamedString(L"value");
        const auto size = value.size() * sizeof(wchar_t);
        if (size > CRED_MAX_CREDENTIAL_BLOB_SIZE) { promise.Reject(React::ReactError{"E_VALUE_TOO_LARGE", "Windows Credential Manager accepts at most 2560 bytes per value"}); return; }
        CREDENTIALW credential{}; credential.Type = CRED_TYPE_GENERIC; credential.TargetName = target.data();
        credential.Persist = CRED_PERSIST_LOCAL_MACHINE; credential.CredentialBlobSize = static_cast<DWORD>(size);
        credential.CredentialBlob = reinterpret_cast<LPBYTE>(const_cast<wchar_t *>(value.c_str()));
        if (!CredWriteW(&credential, 0)) throw_last_error();
        promise.Resolve("null");
      } else if (method == "remove") {
        if (!CredDeleteW(target.c_str(), CRED_TYPE_GENERIC, 0) && GetLastError() != ERROR_NOT_FOUND) throw_last_error();
        promise.Resolve("null");
      } else promise.Reject(React::ReactError{"E_UNSUPPORTED", "Unknown credential operation"});
    } catch (hresult_error const &error) { promise.Reject(React::ReactError{"E_SECURE_STORE", to_string(error.message())}); }
  }
};
}
