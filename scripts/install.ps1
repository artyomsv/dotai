<#
.SYNOPSIS
  Links dotai content into each AI tool's home folder, as listed in links/*.links.

.DESCRIPTION
  Folders become junctions (no admin rights needed). Files become symbolic links, which need
  Windows Developer Mode (run "start ms-settings:developers" and turn it on); without it, file links are skipped
  and the existing file is left untouched.
  Nothing is deleted: a real file or folder in the way is moved to ~/.dotai-backup/<timestamp>/.
  Safe to run again. -Uninstall removes only links that point into this repository and restores
  the newest backup.

.EXAMPLE
  ./scripts/install.ps1 -DryRun
  ./scripts/install.ps1
  ./scripts/install.ps1 -Tool codex
  ./scripts/install.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string[]]$Tool,
  [switch]$DryRun,
  [switch]$Uninstall,
  [string]$HomeDir = $HOME
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$failed = 0

function Normalize([string]$path) {
  if ($path.StartsWith('\??\')) { $path = $path.Substring(4) }
  return [IO.Path]::GetFullPath($path).TrimEnd('\')
}

# Backups go to their own folder, never next to the target: a tool that loads every subfolder
# (like ~/.codex/skills) would otherwise load the backup as a second copy.
$backupRoot = Join-Path (Normalize $HomeDir) '.dotai-backup'
function BackupPath([string]$target, [string]$run) {
  $homePath = Normalize $HomeDir
  $relative = if ($target.StartsWith("$homePath\")) { $target.Substring($homePath.Length + 1) } else { $target -replace ':', '' }
  return Join-Path (Join-Path $backupRoot $run) $relative
}

function LinkTarget([string]$path) {
  $item = Get-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  if (-not $item -or -not $item.LinkType) { return $null }
  $target = @($item.Target)[0]
  if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $path) $target }
  return Normalize $target
}

function Act([string]$message, [scriptblock]$action) {
  if ($DryRun) { Write-Host "[dry-run] $message" } else { & $action; Write-Host $message }
}

function CanLinkFiles {
  $probe = Join-Path ([IO.Path]::GetTempPath()) "dotai-symlink-probe-$stamp"
  try {
    New-Item -ItemType SymbolicLink -Path $probe -Target $PSCommandPath -ErrorAction Stop | Out-Null
    Remove-Item -LiteralPath $probe -Force
    return $true
  } catch { return $false }
}
$canLinkFiles = CanLinkFiles

$manifests = Get-ChildItem (Join-Path $repo 'links') -Filter '*.links'
if ($Tool) { $manifests = $manifests | Where-Object { $Tool -contains $_.BaseName } }

foreach ($manifest in $manifests) {
  Write-Host "== $($manifest.BaseName)"
  foreach ($line in Get-Content $manifest.FullName) {
    $line = $line.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $parts = $line -split '\s+'
    $source = Normalize (Join-Path $repo $parts[0])
    $target = Normalize ($parts[1] -replace '^~', $HomeDir)
    $current = LinkTarget $target

    if ($Uninstall) {
      if ($current -ne $source) { Write-Host "skip     $target (not a dotai link)"; continue }
      Act "unlinked $target" {
        if ((Get-Item -LiteralPath $target -Force).PSIsContainer) { [IO.Directory]::Delete($target) }
        else { [IO.File]::Delete($target) }
      }
      $runs = Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending
      $backup = $runs | ForEach-Object { BackupPath $target $_.Name } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
      if ($backup) { Act "restored $target from $backup" { Move-Item -LiteralPath $backup -Destination $target } }
      continue
    }

    if (-not (Test-Path -LiteralPath $source)) { Write-Host "MISSING  $source"; $failed++; continue }
    if ($current -eq $source) { Write-Host "ok       $target"; continue }

    $isDir = (Get-Item -LiteralPath $source).PSIsContainer
    if (-not $isDir -and -not $canLinkFiles) {
      Write-Host "SKIPPED  $target (file links need Developer Mode: run 'start ms-settings:developers' and turn it on; existing file left as is)"
      $failed++
      continue
    }

    if (Test-Path -LiteralPath $target) {
      $backup = BackupPath $target $stamp
      Act "backup   $target -> $backup" {
        New-Item -ItemType Directory -Path (Split-Path $backup) -Force | Out-Null
        Move-Item -LiteralPath $target -Destination $backup
      }
    } elseif ($current) {
      Act "removed  $target (broken link)" { Remove-Item -LiteralPath $target -Force }
    }

    $parent = Split-Path $target
    if (-not (Test-Path -LiteralPath $parent)) { Act "mkdir    $parent" { New-Item -ItemType Directory -Path $parent | Out-Null } }
    $type = if ($isDir) { 'Junction' } else { 'SymbolicLink' }
    Act "linked   $target -> $source" { New-Item -ItemType $type -Path $target -Target $source | Out-Null }
  }
}

if (-not $Uninstall -and -not $DryRun) { git -C $repo config core.hooksPath .githooks }
if ($failed) { Write-Host "$failed link(s) not created"; exit 1 }
exit 0
