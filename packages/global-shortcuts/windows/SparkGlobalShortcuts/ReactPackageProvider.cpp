#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "SparkGlobalShortcuts.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::SparkGlobalShortcuts::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  AddAttributedModules(packageBuilder, true);
}

} // namespace winrt::SparkGlobalShortcuts::implementation
