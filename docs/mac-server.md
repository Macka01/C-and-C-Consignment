# Move the tracker onto the MacBook Pro

The MacBook Pro is the one server. It already runs **Docker Desktop**, **Tailscale**, and Compose project **`homeserver`** (this is Wendy’s Mac, `Wendys-MBP`). That stack is three containers — there is **no** container named `homeserver`:

- `homeserver-caddy-1` — Caddy, the front door on host **80** and **443**
- `homeserver-hello-1` — Caddy file server
- `homeserver-postgres-1` — Postgres on **5432** (not published to the Mac)

The tracker is a fourth container next to those, not a replacement for any of them.

- **Web page server.** Container `cotton-clay-tracker` serves the tracker on port **43123** only. It never binds 80, 443, or 5432. The three homeserver containers stay up.
- **Data repository.** The database and shop report files stay on the Mac disk, bind-mounted into the tracker container. They are not stored in a Docker volume, and they are not in the browser.
- **Who can open it.** On the Mac, `http://127.0.0.1:43123`. On Wi-Fi, the `.local` address on port 43123. Through Caddy, a hostname you add on `homeserver-caddy-1` that reverse-proxies to `http://cotton-clay-tracker:43123`. Tailscale Funnel stays off — the tracker has no login, so it must not be on the public internet.

After the move, record sales, transfers, invoices, and reports only on this Mac’s address. Stop the copy that was running on any other computer.

## What you will have when it is done

| Piece | Where it lives |
| --- | --- |
| The app (code) | A folder on the Mac, for example `~/cotton-clay` |
| The web server | Docker container `cotton-clay-tracker` (Compose project `cotton-clay`) |
| Starts after login | Docker Desktop at login, then a small LaunchAgent that runs `docker compose up` |
| The data repository | `/Users/stevemcintyre/Library/Application Support/CottonAndClay/data` on Wendys-MBP (SQLite, **not** `homeserver-postgres-1`) |
| Database | `consignment.db` in that folder, bind-mounted at `/data` in the tracker container |
| Report photos and PDFs | `reports/` inside that folder |
| Daily backups | `~/Library/Application Support/CottonAndClay/backups` |
| Logs | `~/Library/Logs/CottonAndClay`, plus `docker compose logs tracker` |
| Address on this Mac | `http://127.0.0.1:43123` |
| Address on Wi-Fi | `http://<the-mac-name>.local:43123` |
| Address on Tailscale | `http://100.73.158.74:43123` (Tailscale name **homeserver**), or the HTTPS hostname you add on `homeserver-caddy-1` |
| Manage from the Mac Mini | Ordinary `ssh` to Tailscale name **homeserver** (`100.73.158.74`); `server/macos/remote.sh` |

The data repository sits on the Mac disk, outside the app folder and outside the image. It is **SQLite**, not the homeserver Postgres container. Rebuilding the tracker copies new code in and leaves `consignment.db` and `reports/` where they are.

A new repository starts empty. The sample shops (Harbour Linen and the others) are only created when you run the app for development *without* Docker. If you copy an existing database across, the stores already in it come with it.

Node.js does not need to be installed on the Mac. The image has Node 22.

## Do you need Visual Studio?

**No.** Do not install Visual Studio, Visual Studio Code, or Cursor on the Mac just to run this.

This is a website that Docker already knows how to build. The Mac’s job is to stay awake, keep Docker Desktop and Tailscale running, and leave the three `homeserver-*` containers as they are. You use **Terminal** for a few commands, then Safari or a phone browser to open the tracker.

You also do **not** need Node.js on the Mac. You only need git if you clone the project (if `git` is missing, macOS offers **Xcode Command Line Tools** — that is Apple’s small tools package, not Visual Studio).

## Follow these steps in order

Do this on the MacBook Pro itself. `homeserver-caddy-1`, `homeserver-hello-1`, and `homeserver-postgres-1` stay running the whole time.

1. **Plug the Mac in** and leave it plugged in. Leave yourself logged in. Leave the lid open (or closed only if power and an external display are connected). A sleeping Mac means the phones lose the tracker.

2. **Stop the Mac sleeping on power.** Open Terminal and paste this, then enter your Mac password:

   ```bash
   sudo pmset -c sleep 0 disksleep 0 displaysleep 10 womp 1 tcpkeepalive 1
   ```

   Optionally turn on “Start up automatically after a power failure” in Battery / Energy settings.

3. **Confirm Docker Desktop is running.** The whale in the menu bar should be steady, not paused. In Docker Desktop → Settings → General, turn on **Start Docker Desktop when you log in**. In Terminal:

   ```bash
   docker ps
   ```

   You should already see `homeserver-caddy-1`, `homeserver-hello-1`, and `homeserver-postgres-1`. Leave all three running. There is no container named `homeserver`.

4. **Confirm Tailscale is connected** on this Mac (menu extra is connected). On each iPhone, install Tailscale and log into the **same** tailnet. Leave Funnel off.

5. **Get the app onto the Mac.** Keep the folder on the Mac’s disk, not in iCloud Drive. In Terminal:

   ```bash
   git clone https://origin.cursor.com/git/steve-mcintyre/c-c-consignment.git "$HOME/cotton-clay"
   cd "$HOME/cotton-clay"
   git checkout cursor/macbook-server-4781
   ```

   If `git` is not found, run `xcode-select --install`, finish that installer, then try the clone again.

   You need the `cursor/macbook-server-4781` branch — that is the copy with Docker, Tailscale, and the `homeserver` wiring. Confirm the folder contains `compose.yaml` and `server/macos/install.sh`.

6. **Move any real records in before the first start.** If another computer already has stores and sales, stop that old server first (Control-C in its Terminal). Copy its `data` folder (especially `consignment.db` and `data/reports/`) onto a USB stick or AirDrop, then:

   ```bash
   mkdir -p "$HOME/Library/Application Support/CottonAndClay/data/reports"
   ```

   Put `consignment.db` (and `consignment.db-wal` / `consignment.db-shm` if you have them) in `data/`. Put the report files in `data/reports/`.

   If you have no real records yet, skip this step. The Mac will start with an empty tracker, not the sample shops.

7. **Install and start the tracker.** Docker Desktop must still be running. The three `homeserver-*` containers must still be running.

   ```bash
   cd "$HOME/cotton-clay"
   bash server/macos/install.sh
   ```

   The first build takes several minutes. When it finishes it prints addresses. The three homeserver containers are left running. The new container is `cotton-clay-tracker` on port **43123**.

8. **Check it on the Mac.** In Safari open [http://127.0.0.1:43123](http://127.0.0.1:43123). You should see **This computer is the shared server**. If you copied a database, a store you recognise should be there. In Terminal, `docker ps` should still list `homeserver-caddy-1`, `homeserver-hello-1`, `homeserver-postgres-1`, plus the new `cotton-clay-tracker`.

9. **Check it on a phone, iPad, or the Mini.** Each device needs Tailscale connected (same account as the MacBook). Then Safari: [http://100.73.158.74:43123](http://100.73.158.74:43123). Bookmark it. Steps are in [Open the tracker on Mini, iPad, iPhone](#12-open-the-tracker-on-mini-ipad-iphone). On studio Wi-Fi without Tailscale you can also try `http://<mac-name>.local:43123`. If macOS asks to allow incoming connections for Docker, allow it.

10. **Optional: put it behind `homeserver-caddy-1`.** Until you add a hostname, `https://…ts.net` is still Caddy’s existing site, not the tracker. That is expected. When you are ready, add a hostname in the Caddyfile that reverse-proxies to `http://cotton-clay-tracker:43123` (not a path like `/consignment`). The pasteable snippet is in [Put the tracker behind Caddy](#6-put-the-tracker-behind-caddy) below. Then set `CONSIGNMENT_HOMESERVER_URL` in `server/macos/host.env` and run `bash server/macos/start.sh`.

11. **Stop using any old copy.** If the tracker was running on another computer, leave that one stopped. Two servers become two different sets of stock.

12. **Day to day.** Leave the Mac plugged in, logged in, and awake. Leave Docker Desktop and Tailscale running. Leave the three `homeserver-*` containers running. Phones use the bookmark from step 9 (or the Caddy hostname from step 10).

13. **Optional: manage it from the Mac Mini.** One-time on Wendys-MBP: `bash server/macos/enable-remote.sh` (turns on macOS Remote Login). On the Mini, `ssh` to Tailscale name **homeserver** at `100.73.158.74` — the macOS name `Wendys-MBP` will not resolve. Not `tailscale ssh`. Commands are in [Manage from the Mac Mini](#11-manage-from-the-mac-mini). The tracker website still has no login.

The sections below are the same steps with extra detail, plus backups, updates, and what to do when something is wrong.

## How this fits next to the homeserver Compose stack

- Tracker Compose project is `cotton-clay`. Container `cotton-clay-tracker`. It does **not** reuse the names `homeserver`, `homeserver-caddy-1`, `homeserver-hello-1`, or `homeserver-postgres-1`.
- Those three stay running. The install never `docker stop`s them, never replaces their images, and never takes ports **80**, **443**, or **5432**.
- After start, `cotton-clay-tracker` joins the `homeserver` Compose network (usually `homeserver_default`), and `homeserver-caddy-1` is also attached to `cotton-clay`. From Caddy, the tracker is `http://cotton-clay-tracker:43123`.
- The only host port the tracker binds is **43123**.
- If something else already uses 43123, the install stops and names that process.
- Host 80/443 stay with `homeserver-caddy-1`. The install does **not** run `tailscale serve` when that Caddy container is present.
- Funnel is never turned on.

## 1. Prepare the MacBook

Do this on the MacBook Pro itself.

1. Plug in the power adapter and leave it plugged in. A MacBook on battery will sleep, and Docker, Tailscale, and the phones will lose the tracker.
2. Leave the lid open. Closing the lid sleeps a MacBook. An external display plus the power adapter is the arrangement that keeps working with the lid closed. Otherwise leave the lid open and let the screen sleep.
3. Stay logged in. Docker Desktop and this tracker start at login. The screen can lock. After a restart or a power cut, log in once.
4. Turn on **Start up automatically after a power failure** if you see it under Battery or Energy settings. It applies while the power adapter is connected.
5. Stop the Mac sleeping while it is on power:

   ```bash
   sudo pmset -c sleep 0 disksleep 0 displaysleep 10 womp 1 tcpkeepalive 1
   ```

   `displaysleep 10` lets the screen turn off after 10 minutes. `sleep 0` keeps the computer awake.

6. Give the Mac a short Bonjour name. System Settings → General → Sharing → Local hostname. Set it to `cotton-clay` if you want `http://cotton-clay.local:43123` on the LAN. Optional if every phone will use Tailscale.

   ```bash
   sudo scutil --set LocalHostName cotton-clay
   ```

7. Docker Desktop:
   - Open Docker Desktop and wait until it says it is running.
   - Settings → General: **Start Docker Desktop when you log in**.
   - Settings → General: use **VirtioFS** for file sharing (the current default). The database is a SQLite file on a bind mount; VirtioFS is the mode that behaves.
   - Leave Docker Desktop running. Do not pause or quit it while people need the tracker.
   - Confirm your other stacks still look right: `docker ps`. You should already see `homeserver-caddy-1`, `homeserver-hello-1`, and `homeserver-postgres-1`. The tracker will add `cotton-clay-tracker`.

8. Tailscale:
   - Open the Tailscale app and confirm this Mac is connected.
   - Give the machine a name you will recognise (the Tailscale machine name, which becomes the MagicDNS name).
   - Install Tailscale on each iPhone and shop computer, and log them into the **same tailnet**.
   - Leave **Funnel** off.
   - MagicDNS should be on (Tailscale admin console → DNS). That is how `http://<machine>:43123` resolves.

9. On the home router, a DHCP reservation for the Mac is still useful for the Wi-Fi address. Tailscale addresses do not depend on that.

FileVault can stay on. Unlock the disk and log in after a restart.

## 2. Put the app on the Mac

Clone the project, or copy the project folder. Name it `cotton-clay`. Keep it on the Mac’s disk, not in iCloud Drive.

```bash
git clone https://origin.cursor.com/git/steve-mcintyre/c-c-consignment.git "$HOME/cotton-clay"
cd "$HOME/cotton-clay"
git checkout cursor/macbook-server-4781
```

Use a copy that contains `compose.yaml` and `server/macos/install.sh`.

Leave out `node_modules` and `.next` if you are copying a folder from another computer. Docker builds the Linux image itself. Leave the database out of this folder too if you are placing it in the data repository in the next step.

## 3. Move the data

There are two situations.

### You already have real records on another computer

Those records are the `data` folder next to the app: `consignment.db`, and if they exist `consignment.db-wal` and `consignment.db-shm`, plus everything in `data/reports/`.

1. On the old computer, stop the server. In the Terminal window that is running it, press Control-C. Quit `npm run dev` and `npm run start`. Check that the page no longer loads.
2. Copy that `data` folder onto a USB stick, or AirDrop a zip of it. Copy it once, while the server is stopped.
3. On the Mac, create the repository and put the files in it **before** the first start:

   ```bash
   mkdir -p "$HOME/Library/Application Support/CottonAndClay/data/reports"
   ```

   Copy `consignment.db` (and the `-wal` and `-shm` files if you have them) into `data/`. Copy the report files into `data/reports/`.

4. Then run the install. It sees the database and does not replace it.

### You only have the sample shops, or you have not started the tracker yet

Skip the copy. The install creates an empty repository. Add the real consignee stores on the Mac. The four sample shops are not created.

### If the Mac already created an empty database

Stop the container, move the empty file aside, put the real database in place, and install again:

```bash
bash server/macos/uninstall.sh
cd "$HOME/Library/Application Support/CottonAndClay/data"
mv consignment.db consignment.db.empty
# copy the real consignment.db and reports/ in now
cd "$HOME/cotton-clay"
bash server/macos/install.sh
```

## 4. Install the server

From the project folder on the Mac, with Docker Desktop running:

```bash
cd "$HOME/cotton-clay"
bash server/macos/install.sh
```

The first image build takes several minutes. The script:

1. Creates the data repository, the backup folder, and the log folder.
2. Copies `data/consignment.db` from the project into the repository only when the repository does not already have one.
3. Writes `server/macos/host.env` (Tailscale URLs, timezone, bind-mount paths). That file stays on the Mac and is not committed.
4. Builds the `cotton-clay-tracker:local` image and starts the Compose stack. Other projects keep running.
5. Writes a backup of any database that is already there.
6. Joins `cotton-clay-tracker` to the homeserver Compose network (and attaches `homeserver-caddy-1` to `cotton-clay`). Does not take ports 80, 443, or 5432, and does not take Tailscale HTTPS 443.
7. Registers two login helpers:
   - `com.cottonandclay.tracker` waits for Docker Desktop after login, then runs `docker compose up`.
   - `com.cottonandclay.backup` copies the repository every day at 2:15am, inside a one-shot container.
8. Opens `http://127.0.0.1:43123/api/health` and waits until it answers.

The container listens on every interface, port **43123**. Inside it, `CONSIGNMENT_DATA_DIR=/data` and `CONSIGNMENT_SEED=0`.

Run the script again any time you need to rebuild. It leaves an existing database in place.

## 5. Check it from the Mac, then from a phone

1. On the Mac, open `http://127.0.0.1:43123`.
2. If you copied a database, confirm a store you recognise is there, with the quantities you expect. Open one report file and confirm the photo or PDF loads.
3. If you started empty, add one real store and confirm it is still there after you refresh.
4. Confirm `docker ps` still shows `homeserver-caddy-1`, `homeserver-hello-1`, `homeserver-postgres-1`, and the new `cotton-clay-tracker`.
5. On this Mac, `http://127.0.0.1:43123` should load the tracker. That address bypasses Caddy.
6. On a phone on Tailscale, `http://<tailscale-machine-name>:43123` also bypasses Caddy and is the address that works before you add a proxy hostname.
7. On the same Wi-Fi without Tailscale, `http://cotton-clay.local:43123` still works.
8. Add a hostname on `homeserver-caddy-1` (next section). Do not put the tracker under a path such as `/consignment` — the app’s `/api` routes would miss.
9. Leave the old computer’s server stopped. Two running copies become two different sets of stock.

The home page should say **This computer is the shared server**.

## 6. Put the tracker behind Caddy

`homeserver-caddy-1` keeps host **80** and **443**. Postgres stays on **5432** inside the homeserver stack. Add a **hostname** in the Caddyfile that `homeserver-caddy-1` already uses — not a URL path.

Upstream: `http://cotton-clay-tracker:43123`  
Allow uploads of **20 MB** (shop report photos).

Paste this site block into that Caddyfile. Replace the hostname with the one you want on the tailnet:

```caddy
consignment.wendys-mbp.YOUR-TAILNET.ts.net {
	reverse_proxy cotton-clay-tracker:43123
	request_body {
		max_size 20MB
	}
}
```

From the `homeserver` Compose folder, reload Caddy (do not recreate the container if you can reload):

```bash
docker compose exec caddy caddy reload
```

After the hostname works, put it in `server/macos/host.env` so the dashboard lists it first:

```bash
CONSIGNMENT_HOMESERVER_URL=https://consignment.wendys-mbp.YOUR-TAILNET.ts.net
```

Then:

```bash
cd "$HOME/cotton-clay"
bash server/macos/start.sh
```

Bookmark that HTTPS hostname on the phones. Until the proxy is in place, keep using `http://127.0.0.1:43123` on the Mac and `http://<tailscale-name>:43123` on the tailnet.

## 7. Let the Mac accept connections

Docker Desktop publishes 43123 on the Mac. The first time a phone connects on Wi-Fi, macOS may ask to allow incoming connections for Docker. Allow it.

Tailscale Serve uses the Tailscale interface. Phones on the tailnet do not need a router port-forward.

If a phone on Wi-Fi cannot connect and the Mac can, check the firewall, that the phone is not on a guest network, and that Docker Desktop is running.

## 8. Backups

The database and the report files exist on this Mac. A backup is a second copy of that repository.

- Every day at **2:15am** a one-shot container writes a dated folder under `~/Library/Application Support/CottonAndClay/backups`. Fourteen copies are kept. The database copy is taken while the tracker is running.
- That job runs only if the Mac is awake and Docker Desktop is up. If it was asleep at 2:15:

  ```bash
  cd "$HOME/cotton-clay"
  bash server/macos/backup.sh
  ```

- Each backup folder contains `consignment.db`, `reports/`, and a `README.txt`.
- Time Machine, if you use it, includes Application Support. Copy the `backups` folder to a USB stick now and then as well.
- The install also writes a backup before it rebuilds the image.

### Restore a backup

1. Stop the container: `bash server/macos/uninstall.sh`
2. Replace `consignment.db` and the `reports` folder in `~/Library/Application Support/CottonAndClay/data` with the copies from the backup folder you want.
3. Start again: `bash server/macos/install.sh`
4. Open the site and confirm the stores look like that day’s records.

## 9. Update the app later

```bash
cd "$HOME/cotton-clay"
bash server/macos/update.sh
```

That pulls the latest code, backs up the repository, rebuilds the image, and restarts only the `cotton-clay` stack. `homeserver-caddy-1`, `homeserver-hello-1`, `homeserver-postgres-1`, and every other container stay up. The data repository path does not change.

If this folder is not a git checkout, copy the new app files in yourself, leave Application Support alone, and run `bash server/macos/install.sh`.

## 10. Day to day

- Leave the Mac plugged in, logged in, and awake (lid open, or lid closed with power and an external display).
- Leave Docker Desktop running. Leave Tailscale connected.
- Use the Caddy hostname bookmark on phones once it is set. Until then, use `http://100.73.158.74:43123`.
- Logs: `~/Library/Logs/CottonAndClay/tracker.err.log`, or:

  ```bash
  cd "$HOME/cotton-clay"
  docker compose --env-file server/macos/host.env logs -f tracker
  ```

- Restart the tracker only:

  ```bash
  bash server/macos/start.sh
  ```

- Stop the tracker and keep the data (does not quit Docker Desktop, Tailscale, or the three `homeserver-*` containers):

  ```bash
  bash server/macos/uninstall.sh
  ```

- See that it is up: `http://127.0.0.1:43123/api/health` answers `{"ok":true}`.

## 11. Manage from the Mac Mini

The tracker stays on **Wendys-MBP**. The Mini is only a remote keyboard. The Tailscale **Mac GUI is sandboxed** and cannot run Tailscale SSH. Use **macOS Remote Login** and ordinary `ssh`.

On the tailnet this Mac is named **homeserver** at **`100.73.158.74`**. The Mini is `steves-mac-mini-9`. The macOS name `Wendys-MBP` is not in DNS (`ssh: Could not resolve hostname wendys-mbp`) — that is expected. **homeserver** here is the Tailscale machine name of the MacBook, not a Docker container. Do not replace the homeserver Compose stack. Do not bind 80, 443, or 5432.

There is still **no login on the tracker website**. This SSH access is only so Steve can start/stop/update the container and read logs.

### One time on Wendys-MBP

Logged in as `stevemcintyre`, from `/Users/stevemcintyre/cotton-clay`:

```bash
cd /Users/stevemcintyre/cotton-clay
bash server/macos/enable-remote.sh
```

That turns on **Remote Login** (`sudo systemsetup -setremotelogin on`). It does **not** run `sudo tailscale set --ssh` — that fails on the sandboxed Tailscale Mac GUI. If the script cannot turn Remote Login on, paste:

```bash
sudo systemsetup -setremotelogin on
```

Or turn it on by hand: System Settings → General → Sharing → **Remote Login**, allow **stevemcintyre**. Leave Wendys-MBP plugged in, logged in, and awake, with Docker Desktop and Tailscale connected. Funnel stays off.

### On the Mac Mini

Tailscale must be **running and connected** on the Mini (same account as Wendys-MBP). If `tailscale status` says `Tailscale is stopped`:

```bash
open -a Tailscale
```

Then click **Connect** on the Tailscale icon in the menu bar (same login as the MacBook). Wait until it says connected. Then:

```bash
export PATH="/Applications/Tailscale.app/Contents/MacOS:/usr/local/bin:/opt/homebrew/bin:$PATH"
tailscale status
```

`tailscale status` on this Mini shows the MacBook as **homeserver** at **100.73.158.74** (not `Wendys-MBP`). That is the ssh target:

```bash
ssh stevemcintyre@100.73.158.74 "bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh status"
ssh stevemcintyre@100.73.158.74 "bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh logs"
ssh stevemcintyre@100.73.158.74 "bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh restart"
ssh stevemcintyre@100.73.158.74 "bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh update"
ssh stevemcintyre@100.73.158.74 "bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh backup"
ssh stevemcintyre@100.73.158.74 "bash /Users/stevemcintyre/cotton-clay/server/macos/remote.sh stop"
```

`ssh stevemcintyre@homeserver` is the same machine if MagicDNS resolves it. Use ordinary `ssh`, not `tailscale ssh`. Each command runs **on the MacBook** and only touches `cotton-clay-tracker`. `status` also lists the three homeserver containers (they must stay Up).

The first `ssh` asks `Are you sure you want to continue connecting` — type `yes`. Then the Mac password for `stevemcintyre` on Wendys-MBP. Later connections skip the fingerprint question.

Never run `docker stop homeserver-caddy-1`, `homeserver-hello-1`, or `homeserver-postgres-1`. `remote.sh` refuses those names.

## 12. Open the tracker on Mini, iPad, iPhone

The tracker is a **website** on Wendys-MBP. You do not install Cotton & Clay. `ssh` is only to restart or update the MacBook.

**Data** stays on that Mac: `/Users/stevemcintyre/Library/Application Support/CottonAndClay/data/consignment.db` (SQLite). `homeserver-postgres-1` is not used.

To use it **away from home Wi-Fi without Tailscale on the phone/iPad**, the URL has to be on the public internet. That is only safe with a shared access code, then Tailscale Funnel (phones open Safari only). Until Funnel is on, keep using Tailscale on those devices (`http://100.73.158.74:43123`).

### Home-screen icon (iPhone / iPad)

After the tracker loads in Safari: Share → **Add to Home Screen**. Name it Cotton & Clay. It opens as a standalone app with the pitcher icon.

### Away from home, no Tailscale on phones (after update)

On Wendys-MBP, `git pull`, then put a code in `server/macos/host.env`:

```bash
cd /Users/stevemcintyre/cotton-clay
# in host.env: CONSIGNMENT_ACCESS_CODE=pick-a-code-you-will-remember
bash server/macos/start.sh
bash server/macos/enable-public.sh
```

`enable-public.sh` does not take ports 80, 443, or 5432. It prints an `https://…ts.net` address. On Mini / iPad / iPhone: Safari to that address, enter the code, then Add to Home Screen. The Tailscale **app** is not required on those devices once Funnel is working.

If Funnel cannot start (Mac GUI limits), keep Tailscale connected on the device and use `http://100.73.158.74:43123` as today.

### Until then (works now)

Mini already has Tailscale. Safari: [http://100.73.158.74:43123](http://100.73.158.74:43123).

iPhone / iPad: Tailscale app, same `Macka01` account, Connect, then that same address.

## When something is wrong

**The phone cannot open the page.** The Mac is asleep, logged out, Docker Desktop is paused, or Tailscale is disconnected on the Mac or the phone. Wake the Mac, log in, wait until Docker is running, check the Tailscale menu extra, then try `http://127.0.0.1:43123` on the Mac itself.

**HTTPS opens Caddy’s existing site, not the tracker.** That is expected until you add a hostname on `homeserver-caddy-1` (section 6). Use `http://127.0.0.1:43123` on the Mac, or `http://100.73.158.74:43123` on the Mini / iPad / iPhone, until that hostname exists.

**`docker ps` no longer shows homeserver-caddy-1 / hello / postgres.** The install does not stop them. Start the `homeserver` Compose stack from its own folder, then `bash server/macos/start.sh` so the tracker can join Caddy’s network again. This install only starts project `cotton-clay`.

**Port 43123 is in use.** An old `npm run dev`, an old Node LaunchAgent, or another container is bound to it. Stop that, then install again.

**The Mac restarted and the site is down.** Log in on Wendys-MBP. Wait for Docker Desktop. The LaunchAgent retries until Docker answers, then starts the container. Tailscale needs to be connected as well.

**The Mini cannot SSH / `Could not resolve hostname wendys-mbp` / `Tailscale is stopped`.** On the Mini: `open -a Tailscale`, click **Connect**, then `tailscale status`. The MacBook is **homeserver** at **100.73.158.74** — `ssh stevemcintyre@100.73.158.74`. Do not use `Wendys-MBP` or `tailscale ssh`. On Wendys-MBP: Tailscale connected, Remote Login on for `stevemcintyre`, user still logged in.

**A report photo will not upload from the phone.** Prefer the Caddy HTTPS hostname once it exists. The file picker still works on plain HTTP on port 43123. Files stay in the data repository on this Mac, not in iCloud. Raise the Caddy `request_body` max to 20 MB if large photos fail.
