param([Parameter(Mandatory)][string]$Notes)
$ErrorActionPreference = 'Stop'
$repository = 'adrighg-scripts/MineHost'
$workspace = (Resolve-Path "$PSScriptRoot/../..").Path
$output = Join-Path $workspace 'outputs'
$android = Join-Path $output 'MineHost'
$version = [regex]::Match((Get-Content "$android/app/build.gradle.kts" -Raw), 'versionName\s*=\s*"([0-9]+\.[0-9]+\.[0-9]+)"').Groups[1].Value
if (!$version) { throw 'Set a valid Android release version first.' }
$env:GCM_INTERACTIVE = 'never'
$credential = "protocol=https`nhost=github.com`nusername=adrighg-scripts`n`n" | git credential fill
$entry = $credential | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
if (!$entry) { throw 'Sign in to GitHub through Git Credential Manager first.' }
$headers = @{ Authorization = 'Bearer ' + $entry.Substring(9); Accept = 'application/vnd.github+json' }
$api = "https://api.github.com/repos/$repository"
$tag = "v$version"
$releases = Invoke-RestMethod "$api/releases?per_page=100" -Headers $headers
$release = $releases | Where-Object tag_name -eq $tag | Select-Object -First 1
if ($release -and !$release.draft) { throw "Release $tag is already published. Increment the Android version before releasing again." }

# Build on the original workstation to retain the APK signing certificate.
& "$android/gradlew.bat" -p $android assembleRelease lintRelease --console=plain
if ($LASTEXITCODE) { throw 'Android build failed.' }
Copy-Item "$android/app/build/outputs/apk/release/app-release.apk" "$output/MineHost.apk"
& python "$workspace/work/package_release.py"
if ($LASTEXITCODE) { throw 'Android source packaging failed.' }
git -C $PSScriptRoot push origin main
if ($LASTEXITCODE) { throw 'Repository push failed.' }

if (!$release) {
    $body = @{ tag_name = $tag; name = "MineHost $version"; draft = $true; body = $Notes } | ConvertTo-Json
    $release = Invoke-RestMethod "$api/releases" -Method Post -Headers $headers -ContentType application/json -Body $body
}
$upload = ($release.upload_url -split '\{')[0]
$assetNames = @('MineHost.apk','MineHost_Android.zip','MineHost_OpenJDK_Sources.zip','MineHost_Pumpkin_Sources.zip')
if (Test-Path "$android/app/src/main/jniLibs/arm64-v8a/libpatchbukkit.so") {
    $assetNames += 'MineHost_PatchBukkit_Sources.zip'
}
foreach ($name in $assetNames) {
    $file = Get-Item "$output/$name"
    $existing = $release.assets | Where-Object name -eq $name | Select-Object -First 1
    if ($existing) {
        Invoke-RestMethod "$api/releases/assets/$($existing.id)" -Method Delete -Headers $headers | Out-Null
    }
    $asset = Invoke-RestMethod "${upload}?name=$name" -Method Post -Headers $headers -ContentType application/octet-stream -InFile $file.FullName -TimeoutSec 240
    if ($asset.state -ne 'uploaded' -or $asset.size -ne $file.Length) { throw "Upload failed for $name." }
}
Invoke-RestMethod "$api/releases/$($release.id)" -Method Patch -Headers $headers -ContentType application/json -Body '{"draft":false,"make_latest":"true"}' | Select-Object html_url
