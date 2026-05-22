"""Login to fantasyrugbydraft.com and save the session cookie."""
import os
import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')

# Load credentials from .env (cron jobs don't inherit a shell environment)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, '.env'))
except ImportError:
    pass

login = os.environ["FANTASY_RUGBY_EMAIL"]
password = os.environ["FANTASY_RUGBY_PASSWORD"]

payload = {
    'Data': f'{{"tblogin":"{login}","tbpassword":"{password}","rememberme":"on",'
            '"leagueid":"","code":"","timezoneoffset":-660,"action":"user/login","type":"action"}'
}

resp = requests.post(
    'http://www.fantasyrugbydraft.com/Web/Services/Action.asmx/Request',
    json=payload,
)

raw_cookies = resp.raw.headers.getlist('Set-Cookie') if hasattr(resp.raw.headers, 'getlist') else []
if len(raw_cookies) >= 2:
    cookie_str = raw_cookies[0] + ';' + raw_cookies[1]
else:
    cookie_str = '; '.join(raw_cookies)

with open(os.path.join(DATA_DIR, 'cookie.txt'), 'w') as f:
    f.write(cookie_str)

print('Cookie saved.')
