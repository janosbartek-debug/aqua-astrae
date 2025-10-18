# ============================================================
#  AQUA ASTRAE — Oraculum Assistant Setup Script (ASCII clean)
# ============================================================

Write-Host "Aqua Astrae - Oraculum Assistant setup starting..."

# --- Ellenőrzés: API key megvan-e
if (-not $env:OPENAI_API_KEY) {
    Write-Host "Nincs beállítva OPENAI_API_KEY!"
    Write-Host "Add meg például így:"
    Write-Host '$env:OPENAI_API_KEY = "sk-proj-..."'
    exit
}

# --- Konstansok
$assistantName = "Aqua Astrae - Oraculum"
$assistantFile = ".\assistants\oraculum_instructions.txt"
$envFile       = ".env.local"

# --- Headers
$headers = @{
  "Authorization" = "Bearer $env:OPENAI_API_KEY"
  "Content-Type"  = "application/json"
}

# --- Instrukciók beolvasása
if (-not (Test-Path $assistantFile)) {
    Write-Host "Nem található az instrukciófájl: $assistantFile"
    exit
}
$instructions = Get-Content -Raw -Path $assistantFile
Write-Host ("Instrukciók beolvasva ({0} karakter)" -f $instructions.Length)

# --- JSON body összeállítása
$body = @{
  name         = $assistantName
  model        = "gpt-4o-mini"
  instructions = $instructions
  tools        = @()
} | ConvertTo-Json -Depth 8

# --- API hívás
Write-Host "Assistant létrehozása folyamatban..."

try {
$response = Invoke-RestMethod -Method Post `
  -Uri "https://api.openai.com/v1/assistants" `
  -Headers $headers `
  -Body $body `
  -ContentType "application/json; charset=utf-8"


    $assistantId = $response.id
    Write-Host "Assistant létrehozva: $assistantId"
}
catch {
    Write-Host "Hiba történt: $($_.Exception.Message)"
    exit
}

# --- .env.local frissítése
if (-not (Test-Path $envFile)) {
    New-Item -ItemType File -Path $envFile -Force | Out-Null
}

$content = Get-Content $envFile -Raw
if ($content -match "ORACULUM_ASSISTANT_ID") {
    $content = $content -replace "ORACULUM_ASSISTANT_ID=.*", "ORACULUM_ASSISTANT_ID=$assistantId"
} else {
    $content += "`nORACULUM_ASSISTANT_ID=$assistantId"
}
Set-Content -Path $envFile -Value $content -Encoding UTF8

Write-Host ".env.local frissítve az új ID-val."
Write-Host "Készen áll! Indítsd újra a fejlesztői szervert: npm run dev"
