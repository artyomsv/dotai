param(
    [string]$Question = "Claude has a question",
    [int]$BashPid = 0
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

# Walk up process tree from the hook's bash PID to find the terminal window
$termPid = $null
$currentPid = $BashPid
while ($currentPid -and $currentPid -ne 0) {
    try {
        $p = Get-Process -Id $currentPid -ErrorAction Stop
        if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
            $termPid = $p.Id
            break
        }
        $wmi = Get-CimInstance Win32_Process -Filter "ProcessId=$currentPid"
        $currentPid = $wmi.ParentProcessId
    } catch { break }
}

$balloon = New-Object System.Windows.Forms.NotifyIcon
$balloon.Icon = [System.Drawing.SystemIcons]::Question
$balloon.BalloonTipTitle = "Claude Code - Input needed"
$balloon.BalloonTipText = $Question
$balloon.Visible = $true

if ($termPid) {
    Register-ObjectEvent $balloon BalloonTipClicked -MessageData $termPid -Action {
        [Microsoft.VisualBasic.Interaction]::AppActivate($Event.MessageData)
    } | Out-Null
}

# Use a WinForms message pump so click events are processed
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 8000
$timer.Add_Tick({
    $balloon.Dispose()
    $timer.Stop()
    [System.Windows.Forms.Application]::ExitThread()
})
$timer.Start()

$balloon.ShowBalloonTip(7000)
[System.Windows.Forms.Application]::Run()
