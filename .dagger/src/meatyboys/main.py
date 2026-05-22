import dagger
from dagger import dag, function, object_type, DefaultPath
from typing import Annotated

VM_HOST = "149.28.178.14"
VM_USER = "root"
PROD_DIR = "/root/meatyboys"
DEV_DIR = "/root/meatyboys-dev"
DEV_PORT = 5000
PROD_PORT = 5001  # internal; nginx proxies port 80 → PROD_PORT


@object_type
class Meatyboys:
    src: Annotated[dagger.Directory, DefaultPath(".")]

    def _ssh_base(self, ssh_private_key: dagger.Secret) -> dagger.Container:
        """Debian container with openssh-client configured to reach the VM."""
        ssh_config = f"""Host vm
    HostName {VM_HOST}
    User {VM_USER}
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
"""
        return (
            dag.container()
            .from_("debian:bookworm-slim")
            .with_exec(["apt-get", "update", "-qq"])
            .with_exec(["apt-get", "install", "-y", "-q", "openssh-client"])
            .with_exec(["mkdir", "-p", "/root/.ssh"])
            .with_new_file("/root/.ssh/config", ssh_config, permissions=0o600)
            .with_mounted_secret("/root/.ssh/id_ed25519", ssh_private_key, mode=0o600)
        )

    @function
    async def deploy_dev(
        self,
        ssh_private_key: dagger.Secret,
        env_production: dagger.Secret,
    ) -> str:
        """Deploy the PR branch to the dev environment at http://149.28.178.14:5000."""
        return await (
            self._ssh_base(ssh_private_key)
            .with_secret_variable("ENV_PRODUCTION", env_production)
            .with_mounted_directory("/app", self.src)
            # Ensure dev directories exist on the VM
            .with_exec(["ssh", "vm", f"mkdir -p {DEV_DIR}/data {DEV_DIR}/playerfiles"])
            # Bundle source (exclude runtime dirs), copy to VM, and extract
            .with_exec([
                "sh", "-c",
                f"tar czf /tmp/app.tar.gz -C /app "
                "--exclude='./.venv' --exclude='./data' --exclude='./playerfiles' "
                "--exclude='./.dagger' --exclude='./__pycache__' --exclude='./reference' . "
                f"&& scp /tmp/app.tar.gz vm:/tmp/ "
                f"&& ssh vm 'tar xzf /tmp/app.tar.gz -C {DEV_DIR} && rm /tmp/app.tar.gz'",
            ])
            # Write .env: force PORT/HOST for dev, inherit everything else from ENV_PRODUCTION
            .with_exec([
                "sh", "-c",
                f'( printf "PORT={DEV_PORT}\\nHOST=0.0.0.0\\n"; '
                f'printf "%s\\n" "$ENV_PRODUCTION" | grep -v "^PORT=" | grep -v "^HOST=" ) '
                f'| ssh vm "cat > {DEV_DIR}/.env"',
            ])
            # Initialise playerfiles on first deploy so the app doesn't crash cold
            .with_exec([
                "ssh", "vm",
                f'[ -f {DEV_DIR}/playerfiles/time.txt ] || '
                f'echo \'{{"time":"1970-01-01T00:00:00.000Z","usr":"","snake":"up"}}\' '
                f'> {DEV_DIR}/playerfiles/time.txt; '
                f'[ -f {DEV_DIR}/playerfiles/allplayers.txt ] || echo "[]" > {DEV_DIR}/playerfiles/allplayers.txt; '
                f'[ -f {DEV_DIR}/playerfiles/users.txt ] || echo "{{}}" > {DEV_DIR}/playerfiles/users.txt',
            ])
            # Set up venv and install deps
            .with_exec([
                "ssh", "vm",
                f"set -e; cd {DEV_DIR}; "
                "[ -f .venv/bin/activate ] || python3 -m venv .venv; "
                ".venv/bin/pip install -q -r requirements.txt",
            ])
            # Restart dev gunicorn on DEV_PORT (only kills dev instance, leaving prod alone)
            .with_exec([
                "ssh", "vm",
                f"pkill -f 'gunicorn.*{DEV_DIR}' 2>/dev/null || true; sleep 1; "
                f"cd {DEV_DIR}; "
                f"nohup .venv/bin/gunicorn -w 1 --threads 4 -b 0.0.0.0:{DEV_PORT} "
                f"--access-logfile {DEV_DIR}/gunicorn.log app:app "
                f">> {DEV_DIR}/gunicorn.log 2>&1 &",
            ])
            .stdout()
        )

    @function
    async def deploy(
        self,
        ssh_private_key: dagger.Secret,
        env_production: dagger.Secret,
    ) -> str:
        """Deploy master to production at http://meatyboys.com (port 80 via nginx)."""
        return await (
            self._ssh_base(ssh_private_key)
            .with_secret_variable("ENV_PRODUCTION", env_production)
            # Force PORT=PROD_PORT so gunicorn binds to 5001 and dev (5000) can coexist.
            # deploy.sh reads PORT from .env and passes it to both gunicorn and nginx.
            .with_exec([
                "sh", "-c",
                f'( printf "PORT={PROD_PORT}\\n"; '
                f'printf "%s\\n" "$ENV_PRODUCTION" | grep -v "^PORT=" ) '
                f'| ssh vm "cat > {PROD_DIR}/.env"',
            ])
            # Pull latest master and run deploy.sh (handles venv, cron, gunicorn, nginx)
            .with_exec([
                "ssh", "vm",
                f"set -e; cd {PROD_DIR} && git fetch origin master && git reset --hard origin/master && bash deploy.sh",
            ])
            .stdout()
        )
