param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$TaskName = "Manfu-FlowLab-Collector"
)

$ErrorActionPreference = "Stop"
$node = (Get-Command node -ErrorAction Stop).Source
$collector = Join-Path $ProjectRoot "strategy-lab\collector.mjs"
$launcher = Join-Path $ProjectRoot "strategy-lab\launch-collector.vbs"
$wscript = Join-Path $env:WINDIR "System32\wscript.exe"

if (-not (Test-Path -LiteralPath $collector)) { throw "Collector script was not found: $collector" }
if (-not (Test-Path -LiteralPath $launcher)) { throw "Hidden launcher was not found: $launcher" }
if (-not (Test-Path -LiteralPath $wscript)) { throw "Windows Script Host was not found: $wscript" }

$start = Get-Date -Hour 9 -Minute 30 -Second 0
$repetition = New-CimInstance -Namespace Root/Microsoft/Windows/TaskScheduler -ClassName MSFT_TaskRepetitionPattern -ClientOnly -Property @{
  Interval = "PT1M"
  Duration = "PT1H1M"
  StopAtDurationEnd = $false
}
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Wednesday, Thursday, Friday -At $start
$trigger.Repetition = $repetition

$arguments = '"{0}" "{1}" "{2}" "{3}"' -f $launcher, $node, $collector, $ProjectRoot
$action = New-ScheduledTaskAction -Execute $wscript -Argument $arguments -WorkingDirectory $ProjectRoot
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId (whoami) -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Manfu THS individual-fund radar, one-minute hidden collection" -Force | Out-Null
Write-Host "Task updated: $TaskName"
Write-Host "Schedule: weekdays 09:30-10:30, every minute, hidden Node launcher"
