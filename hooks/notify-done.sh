#!/bin/bash
# Send a desktop notification when Claude finishes a task (Windows)
powershell.exe -Command "
  [void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
  \$balloon = New-Object System.Windows.Forms.NotifyIcon
  \$balloon.Icon = [System.Drawing.SystemIcons]::Information
  \$balloon.BalloonTipTitle = 'Claude Code'
  \$balloon.BalloonTipText = 'Task completed!'
  \$balloon.Visible = \$true
  \$balloon.ShowBalloonTip(5000)
  Start-Sleep -Seconds 6
  \$balloon.Dispose()
" 2>/dev/null
