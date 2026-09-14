#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "LegendUI.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::LegendUI::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  AddAttributedModules(packageBuilder, true);
  winrt::LegendUI::RegisterControls(packageBuilder);
}

} // namespace winrt::LegendUI::implementation
