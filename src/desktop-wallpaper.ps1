param(
    [Parameter(Mandatory = $true)][long]$WindowHandle,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class DesktopWallpaperNative {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr GetShellWindow();

    [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
    public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

    [DllImport("user32.dll", EntryPoint="SetWindowLongPtrW", SetLastError=true)]
    public static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int index, IntPtr value);

    [DllImport("user32.dll", EntryPoint="SetWindowLongW", SetLastError=true)]
    public static extern int SetWindowLong32(IntPtr hWnd, int index, int value);

    [DllImport("user32.dll", SetLastError=true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);

    public static IntPtr SetWindowLongPtr(IntPtr hWnd, int index, IntPtr value) {
        return IntPtr.Size == 8
            ? SetWindowLongPtr64(hWnd, index, value)
            : new IntPtr(SetWindowLong32(hWnd, index, value.ToInt32()));
    }
}
'@

# Resolve Explorer's desktop windows. Explorer may take a moment to expose Progman
# after sign-in, so retry briefly instead of failing on the first lookup.
$progman = [IntPtr]::Zero
for ($attempt = 0; $attempt -lt 10 -and $progman -eq [IntPtr]::Zero; $attempt++) {
    $progman = [DesktopWallpaperNative]::FindWindow('Progman', $null)
    if ($progman -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 300 }
}
if ($progman -ne [IntPtr]::Zero) {
    $result = [IntPtr]::Zero
    # Ask Explorer to create its WorkerW desktop layer. This message is a known undocumented shell technique.
    [void][DesktopWallpaperNative]::SendMessageTimeout($progman, 0x052C, [IntPtr]::Zero, [IntPtr]::Zero, 0, 1000, [ref]$result)
}

$script:desktopView = [IntPtr]::Zero
$script:desktopTop = [IntPtr]::Zero
$callback = [DesktopWallpaperNative+EnumWindowsProc]{
    param([IntPtr]$top, [IntPtr]$unused)
    $view = [DesktopWallpaperNative]::FindWindowEx($top, [IntPtr]::Zero, 'SHELLDLL_DefView', $null)
    if ($view -ne [IntPtr]::Zero) {
        $script:desktopView = $view
        $script:desktopTop = $top
        return $false
    }
    return $true
}
[void][DesktopWallpaperNative]::EnumWindows($callback, [IntPtr]::Zero)

if ($script:desktopView -eq [IntPtr]::Zero) {
    throw 'Could not locate the Windows desktop icon layer (SHELLDLL_DefView).'
}

$worker = [DesktopWallpaperNative]::FindWindowEx([IntPtr]::Zero, $script:desktopTop, 'WorkerW', $null)
if ($worker -eq [IntPtr]::Zero) {
    # Windows 11 can expose the shell differently; try Progman and then the shell
    # window returned by User32 before giving up.
    $worker = $progman
}
if ($worker -eq [IntPtr]::Zero) {
    $worker = [DesktopWallpaperNative]::GetShellWindow()
}
if ($worker -eq [IntPtr]::Zero) {
    throw 'Could not locate a Windows desktop wallpaper host. Restart Windows Explorer and try again.'
}

$hwnd = [IntPtr]::new($WindowHandle)
$GWL_STYLE = -16
$WS_CHILD = 0x40000000
$WS_VISIBLE = 0x10000000
$SWP_FRAMECHANGED = 0x0020
$SWP_SHOWWINDOW = 0x0040

[void][DesktopWallpaperNative]::SetParent($hwnd, $worker)
[void][DesktopWallpaperNative]::SetWindowLongPtr($hwnd, $GWL_STYLE, [IntPtr]($WS_CHILD -bor $WS_VISIBLE))
if (-not [DesktopWallpaperNative]::SetWindowPos($hwnd, [IntPtr]::Zero, 0, 0, $Width, $Height, ($SWP_FRAMECHANGED -bor $SWP_SHOWWINDOW))) {
    throw 'SetWindowPos failed while sizing the wallpaper window.'
}
Write-Output 'Attached video window to the Windows desktop.'
