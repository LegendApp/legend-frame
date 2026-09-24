#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "SparkUI.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::SparkUI::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  AddAttributedModules(packageBuilder, true);
  winrt::SparkUI::RegisterControls(packageBuilder);
}

} // namespace winrt::SparkUI::implementation
