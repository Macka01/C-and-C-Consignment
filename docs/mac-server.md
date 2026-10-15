# Move the tracker onto the MacBook Pro

The MacBook Pro is the one server. It already runs **Docker Desktop** and **Tailscale**. The tracker joins that setup instead of installing a second Node service.

- **Web page server.** A Docker container named `cotton-clay-tracker` serves the tracker on port **43123**. Other Compose stacks on the Mac are left alone.
- **Data repository.** The database and shop report files stay on the Mac disk, bind-mounted into the container. They are not stored in a Docker volume, and they are not in the browser.
- **Who can open it.** Phones and shop computers on the **same Wi-Fi** can use the LAN address. Phones and laptops on **Tailscale** can use it from anywhere on the tailnet. Tailscale Funnel stays off — the tracker has no login, so it must not be on the public internet.

After the move, record sales, transfers, invoices, and reports only on this Mac’s address. Stop the copy that was running on any other computer.

## What you will have when it is done

| Piece | Where it lives |
| --- | --- |
| The app (code) | A folder on the Mac, for example `~/cotton-clay` |
| The web server | Docker container `cotton-clay-tracker` (Compose project `cotton-clay`) |
| Starts after login | Docker Desktop at login, then a small LaunchAgent that runs `docker compose up` |
| The data repository | `~/Library/Application Support/CottonAndClay/data` on the Mac, mounted at `/data` in the container |
| Database | `consignment.db` inside that folder |
| Report photos and PDFs | `reports/` inside that folder |
| Daily backups | `~/Library/Application Support/CottonAndClay/backups` |
| Logs | `~/Library/Logs/CottonAndClay`, plus `docker compose logs tracker` |
| Address on this Mac | `http://127.0.0.1:43123` |
| Address on Wi-Fi | `http://<the-mac-name>.local:43123` |
| Address on Tailscale | `https://<the-mac>.<tailnet>.ts.net` (HTTPS via Tailscale Serve), or `http://<tailscale-name>:43123` |

The data repository sits outside the app folder and outside the image. Rebuilding the container copies new code in and leaves the database where it is.

A new repository starts empty. The sample shops (Harbour Linen and the others) are only created when you run the app for development *without* Docker. If you copy an existing database across, the stores already in it come with it.

Node.js does not need to be installed on the Mac. The image has Node 22.

## How this fits next to the Docker and Tailscale you already use

- Compose project name is `cotton-clay`. `docker compose ps` in other folders is unchanged.
- The only host port this stack binds is **43123**. It does not take 80 or 443 inside Docker.
- If something else on the Mac already uses 43123, the install stops and names that process. Pick that process off, or stop an old tracker, then run the install again.
- Tailscale stays the Mac app you already have. The install does not install a Tailscale *container*. It asks the Mac’s Tailscale to **Serve** HTTPS to `http://127.0.0.1:43123` on port 443 of the tailnet.
- If Tailscale Serve is already using HTTPS 443 for another local service, the install leaves that mapping alone. Phones then use `http://<tailscale-name>:43123`.
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
   - Confirm your other stacks still look right: `docker ps`. The tracker will add one container named `cotton-clay-tracker`.

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
git clone <the repository URL> "$HOME/cotton-clay"
cd "$HOME/cotton-clay"
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
6. Asks Tailscale to Serve HTTPS to port 43123, unless 443 is already used by something else.
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
4. Confirm `docker ps` shows `cotton-clay-tracker` and still shows your other containers.
5. On a phone that has Tailscale connected to the same tailnet, open the HTTPS address the install printed (`https://<mac>.<tailnet>.ts.net`). Bookmark that. It works at home and away, as long as the Mac is awake.
6. If HTTPS was not enabled (because 443 was already taken), open `http://<tailscale-machine-name>:43123`.
7. On the same Wi-Fi without Tailscale, `http://cotton-clay.local:43123` still works. The dashboard lists every address the install knows.
8. Leave the old computer’s server stopped. Two running copies become two different sets of stock.

The home page should say **This computer is the shared server** and list the Tailscale and LAN addresses.

## 6. Let the Mac accept connections

Docker Desktop publishes 43123 on the Mac. The first time a phone connects on Wi-Fi, macOS may ask to allow incoming connections for Docker. Allow it.

Tailscale Serve uses the Tailscale interface. Phones on the tailnet do not need a router port-forward.

If a phone on Wi-Fi cannot connect and the Mac can, check the firewall, that the phone is not on a guest network, and that Docker Desktop is running.

## 7. Backups

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

## 8. Update the app later

```bash
cd "$HOME/cotton-clay"
bash server/macos/update.sh
```

That pulls the latest code, backs up the repository, rebuilds the image, and restarts only the `cotton-clay` stack. Other containers stay up. The data repository path does not change.

If this folder is not a git checkout, copy the new app files in yourself, leave Application Support alone, and run `bash server/macos/install.sh`.

## 9. Day to day

- Leave the Mac plugged in, logged in, and awake (lid open, or lid closed with power and an external display).
- Leave Docker Desktop running. Leave Tailscale connected.
- Use the Tailscale HTTPS bookmark on phones.
- Logs: `~/Library/Logs/CottonAndClay/tracker.err.log`, or:

  ```bash
  cd "$HOME/cotton-clay"
  docker compose --env-file server/macos/host.env logs -f tracker
  ```

- Restart the tracker only:

  ```bash
  bash server/macos/start.sh
  ```

- Stop the tracker and keep the data (does not quit Docker Desktop or Tailscale):

  ```bash
  bash server/macos/uninstall.sh
  ```

- See that it is up: `http://127.0.0.1:43123/api/health` answers `{"ok":true}`.

## When something is wrong

**The phone cannot open the page.** The Mac is asleep, logged out, Docker Desktop is paused, or Tailscale is disconnected on the Mac or the phone. Wake the Mac, log in, wait until Docker is running, check the Tailscale menu extra, then try `http://127.0.0.1:43123` on the Mac itself.

**HTTPS opens the wrong site.** Tailscale Serve on port 443 was already used by another local service. Use `http://<tailscale-name>:43123`, or free 443 and run `bash server/macos/start.sh`.

**The page loads and the stores are missing.** The container started before the database was copied, so it created an empty repository. Follow “If the Mac already created an empty database” in section 3.

**Two different quantities on two devices.** They are talking to two servers. Stop every copy except this Mac’s container. Check the address in the phone’s bookmark.

**`docker ps` no longer shows an old stack.** The install only starts project `cotton-clay`. If another stack is missing, it was not this install — start that project from its own folder again.

**Port 43123 is in use.** An old `npm run dev`, an old Node LaunchAgent, or another container is bound to it. Stop that, then install again.

**The Mac restarted and the site is down.** Log in. Wait for Docker Desktop. The LaunchAgent retries until Docker answers, then starts the container. Tailscale needs to be connected as well.

**A report photo will not upload from the phone.** Stay on the Tailscale HTTPS address if you can. The file picker still works on plain HTTP on the LAN. Files stay in the data repository on this Mac, not in iCloud.
