# Install-Profiles.ps1
# Automates opening Chrome profiles to load the X-links extension manually.

# 1. Modern Chrome Security Context
# Modern Google Chrome (v137+) has removed the `--load-extension` command line flag for security.
# Chrome also protects its 'Preferences' file with HMAC signatures (Secure Preferences) which prevents 
# silent programmatical injection of extensions. Finally, on non-domain joined machines (such as 
# Windows Home edition), policy-based forced installation (ExtensionInstallForcelist) is restricted to 
# Chrome Web Store hosted extensions only. 
#
# Consequently, local unpacked extensions must be loaded manually via Developer Mode. 
# This script automates profile switching and URL navigation to make the process as fast as possible.

$ExtensionPath = $PSScriptRoot
if ([string]::IsNullOrEmpty($ExtensionPath)) {
    $ExtensionPath = "Z:\Codes\X-links"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "               X-links Chrome Profile Installer            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Extension Source: $ExtensionPath" -ForegroundColor White
Write-Host ""

# Find Chrome Executable
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $ChromePath)) {
    $ChromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (-not (Test-Path $ChromePath)) {
    Write-Error "Google Chrome installation could not be found. Please check your installation path."
    Exit
}

# Find Chrome User Data Directory
$UserDataPath = "$env:LOCALAPPDATA\Google\Chrome\User Data"
if (-not (Test-Path $UserDataPath)) {
    Write-Error "Chrome User Data directory not found at $UserDataPath"
    Exit
}

# Scan for profiles containing a Preferences file
Write-Host "Scanning for Chrome profiles..." -ForegroundColor Yellow
$Profiles = Get-ChildItem $UserDataPath -Directory | Where-Object {
    (Test-Path (Join-Path $_.FullName "Preferences")) -and ($_.Name -eq "Default" -or $_.Name -like "Profile*")
} | Sort-Object Name

$ProfileCount = $Profiles.Count
Write-Host "Found $ProfileCount Chrome profiles." -ForegroundColor Green
Write-Host ""
Write-Host "Instructions for each profile that opens:" -ForegroundColor Yellow
Write-Host "1. Toggle 'Developer mode' in the top-right corner to ON." -ForegroundColor White
Write-Host "2. Click 'Load unpacked' in the top-left corner." -ForegroundColor White
Write-Host "3. The extension path has been copied to your clipboard. Press Ctrl+V (or paste) into the file picker and select/open the folder." -ForegroundColor White
Write-Host "4. Go back to this console and press [Enter] to launch the next profile." -ForegroundColor White
Write-Host ""

$Confirm = Read-Host "Ready to begin? (Y/N)"
if ($Confirm -ne "Y" -and $Confirm -ne "y") {
    Write-Host "Cancelled." -ForegroundColor Red
    Exit
}

# Copy path to clipboard initially
Set-Clipboard -Value $ExtensionPath

$CurrentIndex = 1
foreach ($Profile in $Profiles) {
    $ProfileName = $Profile.Name
    
    Write-Host ""
    Write-Host "[$CurrentIndex / $ProfileCount] Processing Profile: $ProfileName" -ForegroundColor Cyan
    
    # Copy path to clipboard in case clipboard was overwritten
    Set-Clipboard -Value $ExtensionPath
    Write-Host "-> Extension path copied to clipboard." -ForegroundColor Gray
    
    # Launch Chrome for this specific profile directly to the extensions page
    Write-Host "-> Launching Chrome..." -ForegroundColor Gray
    Start-Process $ChromePath -ArgumentList "chrome://extensions/ --profile-directory=`"$ProfileName`""
    
    if ($CurrentIndex -lt $ProfileCount) {
        Read-Host "Press [Enter] when ready to open the next profile..."
    } else {
        Write-Host ""
        Write-Host "All profiles opened!" -ForegroundColor Green
    }
    
    $CurrentIndex++
}

Write-Host ""
Write-Host "Finished! The X-links extension has been loaded across all selected profiles." -ForegroundColor Green
