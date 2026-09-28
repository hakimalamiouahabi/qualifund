param(
  [string]$RepoName = "leyton-radar",
  [ValidateSet("private","public")][string]$Visibility = "private",
  [switch]$Watch
)
$ErrorActionPreference = "Stop"

function Run-Gh([string[]]$Args) {
  & gh @Args
  if ($LASTEXITCODE -ne 0) { throw "gh $($Args -join ' ') a échoué." }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) est requis : https://cli.github.com/"
}
Run-Gh @("auth","status")
$Owner = (& gh api user --jq .login).Trim()
if (-not $Owner) { throw "Impossible de déterminer le compte GitHub connecté." }
$FullRepo = "$Owner/$RepoName"

if (-not (Test-Path .git)) {
  Run-Gh @("repo","create",$FullRepo,"--$Visibility","--source",".","--remote","origin")
  git branch -M main
  git add .
  git commit -m "release: LEYTON RADAR v12.2.0" 2>$null
  git push -u origin main
} else {
  git branch -M main
  $exists = $true
  & gh repo view $FullRepo --json nameWithOwner *> $null
  if ($LASTEXITCODE -ne 0) { $exists = $false }
  if (-not $exists) { Run-Gh @("repo","create",$FullRepo,"--$Visibility","--source",".","--remote","origin") }
  $origin = (git remote get-url origin 2>$null)
  if (-not $origin) { git remote add origin "https://github.com/$FullRepo.git" }
  git add .
  git commit -m "release: LEYTON RADAR v12.2.0" 2>$null
  git push -u origin main
}

# Active GitHub Pages en mode workflow avec le jeton de l'utilisateur connecté.
& gh api "repos/$FullRepo/pages" *> $null
if ($LASTEXITCODE -ne 0) {
  Run-Gh @("api","--method","POST","repos/$FullRepo/pages","-f","build_type=workflow")
} else {
  Run-Gh @("api","--method","PUT","repos/$FullRepo/pages","-f","build_type=workflow","-F","https_enforced=true")
}

Run-Gh @("workflow","run","update-and-deploy.yml","--repo",$FullRepo,"-f","full_refresh=true")
Start-Sleep -Seconds 3
$RunId = (& gh run list --repo $FullRepo --workflow update-and-deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId').Trim()
Write-Host "Dépôt : https://github.com/$FullRepo"
Write-Host "Workflow lancé : $RunId"
if ($Watch -and $RunId) { Run-Gh @("run","watch",$RunId,"--repo",$FullRepo,"--exit-status") }

try {
  $PageUrl = (& gh api "repos/$FullRepo/pages" --jq .html_url).Trim()
  if ($PageUrl) { Write-Host "GitHub Pages : $PageUrl" }
} catch {}
