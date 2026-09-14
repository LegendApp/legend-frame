param([Parameter(Mandatory=$true)][int]$AppProcess)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
function Find-Control([string]$AutomationId, $Pattern) {
  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  while ([DateTime]::UtcNow -lt $deadline) {
    $condition = [System.Windows.Automation.AndCondition]::new(
      [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $AppProcess),
      [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, $AutomationId))
    $elements = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    foreach ($element in $elements) {
      $nativePattern = $null
      if ($element.TryGetCurrentPattern($Pattern, [ref]$nativePattern)) { return $nativePattern }
    }
    Start-Sleep -Milliseconds 250
  }
  throw "No native control/pattern for $AutomationId"
}
$button = Find-Control 'legend-button' ([System.Windows.Automation.InvokePattern]::Pattern)
$button.Invoke()
$input = Find-Control 'legend-input' ([System.Windows.Automation.ValuePattern]::Pattern)
$input.SetValue('Native edit')
$combo = Find-Control 'legend-select' ([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
$combo.Expand()
$condition = [System.Windows.Automation.AndCondition]::new(
  [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $AppProcess),
  [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'Second'))
$deadline = [DateTime]::UtcNow.AddSeconds(15)
while ([DateTime]::UtcNow -lt $deadline) {
  $elements = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
  foreach ($element in $elements) {
    $selection = $null
    if ($element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$selection)) { $selection.Select(); exit 0 }
  }
  Start-Sleep -Milliseconds 250
}
throw 'Native ComboBox option was not exposed through UI Automation'
