$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stage = Join-Path $projectRoot 'build/windows-runtime'
$output = Join-Path $projectRoot 'release'
New-Item -ItemType Directory -Force -Path $stage,$output,(Join-Path $stage 'public'),(Join-Path $stage 'tools'),(Join-Path $stage 'licenses') | Out-Null
foreach ($name in @('server.mjs','catalog.mjs','package.json','README.md','THIRD_PARTY.md')) { Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $stage -Force }
Get-ChildItem -LiteralPath (Join-Path $projectRoot 'public') -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stage 'public') -Force }
Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination (Join-Path $stage 'node.exe') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'tools/yt-dlp.exe') -Destination (Join-Path $stage 'tools/yt-dlp.exe') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'node_modules/ffmpeg-static/ffmpeg.exe') -Destination (Join-Path $stage 'tools/ffmpeg.exe') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'node_modules/ffmpeg-static/ffmpeg.exe.LICENSE') -Destination (Join-Path $stage 'licenses/FFmpeg-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'node_modules/ffmpeg-static/ffmpeg.exe.README') -Destination (Join-Path $stage 'licenses/FFmpeg-README.txt') -Force
& node (Join-Path $PSScriptRoot 'fetch-licenses.mjs') $stage
if ($LASTEXITCODE -ne 0) { throw 'Falha ao obter os avisos de licença.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload = Join-Path $projectRoot ('build/payload-' + [Guid]::NewGuid().ToString('N') + '.zip')
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage,$payload,[System.IO.Compression.CompressionLevel]::Optimal,$false)
$framework = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$exe = Join-Path $output 'Soundpad-1.0.0-win-x64.exe'
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ "/out:$exe" "/resource:$payload,Soundpad.payload.zip" "/reference:$(Join-Path $framework 'System.IO.Compression.dll')" "/reference:$(Join-Path $framework 'System.IO.Compression.FileSystem.dll')" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $projectRoot 'desktop/Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o executável.' }
$hash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $output 'SHA256SUMS.txt'), "$hash  Soundpad-1.0.0-win-x64.exe`n")
Get-Item -LiteralPath $exe | Select-Object Name,Length
Write-Output "SHA256: $hash"
