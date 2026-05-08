# ─────────────────────────────────────────────────────────────────────────────
# deploy.ps1 — Deploy Meaty Boys from Windows to your VM
#
# Run from the project root in PowerShell:
#   .\deploy.ps1
#
# Requirements:
#   OpenSSH must be installed on Windows (it is by default on Windows 10/11).
#   Verify with:  ssh -V
# ─────────────────────────────────────────────────────────────────────────────

# ── VM CONNECTION — fill these in ─────────────────────────────────────────────
$VM_IP       = "149.28.178.14"          # ← your VM's public IP
$VM_USER     = "root"                   # ← SSH username (check your VM provider)
$VM_SSH_PORT = 22                       # ← SSH port (22 is default; change if different)
$VM_APP_DIR  = "~/meatyboys"            # ← where the app lives on the VM
# ─────────────────────────────────────────────────────────────────────────────

$VM = "${VM_USER}@${VM_IP}"

# Helper: run a command on the VM over SSH
function SSH-Run($cmd) {
    ssh -p $VM_SSH_PORT $VM $cmd
}

Write-Host ""
Write-Host "=== Meaty Boys — Deploying to $VM_IP ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "You will be prompted for the VM password at each step."
Write-Host "To avoid this, set up SSH key auth (see bottom of this file)."
Write-Host ""

# ── STEP 1: Create directory structure on VM ──────────────────────────────────
Write-Host "[1/4] Creating app directories on VM..."
SSH-Run "mkdir -p ${VM_APP_DIR}/templates ${VM_APP_DIR}/public ${VM_APP_DIR}/scripts ${VM_APP_DIR}/data ${VM_APP_DIR}/playerfiles"

# ── STEP 2: Copy application files ───────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Copying application files..."

# Core files
scp -P $VM_SSH_PORT app.py config.py requirements.txt deploy.sh "${VM}:${VM_APP_DIR}/"

# Folders (use -r for recursive)
scp -P $VM_SSH_PORT -r templates "${VM}:${VM_APP_DIR}/"
scp -P $VM_SSH_PORT -r public    "${VM}:${VM_APP_DIR}/"
scp -P $VM_SSH_PORT -r scripts   "${VM}:${VM_APP_DIR}/"

# ── STEP 3: Copy production .env ──────────────────────────────────────────────
# .env.production holds your real SECRET_KEY, PORT=5000, DEBUG=false etc.
# It is gitignored — never committed. The deploy script puts it on the VM as .env.
Write-Host ""
Write-Host "[3/4] Copying .env.production to VM as .env..."
scp -P $VM_SSH_PORT .env.production "${VM}:${VM_APP_DIR}/.env"

# ── STEP 4: Run setup + start the app on VM ───────────────────────────────────
Write-Host ""
Write-Host "[4/4] Running deploy.sh on VM (installs deps, starts gunicorn)..."
SSH-Run "cd ${VM_APP_DIR} && bash deploy.sh"

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Green
Write-Host "App:  http://${VM_IP}:5000"
Write-Host "Logs: ssh -p $VM_SSH_PORT $VM 'tail -f ${VM_APP_DIR}/gunicorn.log'"
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: Set up SSH key auth to avoid typing your password every deploy
#
# Run these two commands once in PowerShell (enter your VM password when asked):
#
#   ssh-keygen -t ed25519 -C "meatyboys-deploy"
#
#   Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh -p 22 ubuntu@149.28.178.14 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
#
# After that, deploys will be passwordless.
# ─────────────────────────────────────────────────────────────────────────────