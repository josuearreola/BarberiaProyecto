# Script para comprimir el proyecto sin node_modules
# Uso: .\comprimir-proyecto.ps1

Write-Host "🗜️  Comprimiendo proyecto web7mo..." -ForegroundColor Cyan

$projectPath = "."
$outputZip = "web7mo-proyecto-$(Get-Date -Format 'yyyy-MM-dd').zip"
$excludeFolders = @('node_modules', 'dist', 'build', '.git', '.angular', '.vscode')

# Obtener todos los archivos excluyendo carpetas específicas
$filesToCompress = Get-ChildItem -Path $projectPath -Recurse -File | Where-Object {
    $file = $_
    $exclude = $false
    foreach ($folder in $excludeFolders) {
        if ($file.FullName -like "*\$folder\*") {
            $exclude = $true
            break
        }
    }
    -not $exclude
}

Write-Host "📦 Archivos a comprimir: $($filesToCompress.Count)" -ForegroundColor Yellow

# Crear el archivo ZIP
$filesToCompress | Compress-Archive -DestinationPath $outputZip -CompressionLevel Optimal -Force

$zipSize = (Get-Item $outputZip).Length / 1MB
Write-Host "✅ Compresión completada: $outputZip ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green