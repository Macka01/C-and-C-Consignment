# Move the tracker onto the MacBook Pro

One MacBook Pro does both jobs:

- **Web page server.** It serves the tracker on port **43123** for every phone and shop computer.
- **Data repository.** It keeps the only database and the shop report files. The pages on a phone read and write that copy. Nothing important is stored in the browser.

After the move, record sales, transfers, invoices, and reports only on this Mac’s address. Stop the copy that was running on any other computer.

## What you will have when it is done

| Piece | Where it lives |
| --- | --- |
| The app | A folder on the Mac, for example `~/cotton-clay` |
| The service | Starts when you log in, restarts if it crashes |
| The data repository | `~/Library/Application Support/CottonAndClay/data` |
| Database | `consignment.db` inside that folder |
| Report photos and PDFs | `reports/` inside that folder |
| Daily backups | `~/Library/Application Support/CottonAndClay/backups` |
| Logs | `~/Library/Logs/CottonAndClay` |
| Address on this Mac | `http://127.0.0.1:43123` |
| Address from a phone | `http://<the-mac-name>.local:43123` |

The data repository sits outside the app folder on purpose. Updating the app copies new code in and leaves the database where it is.

A new repository starts empty. The sample shops (Harbour Linen and the others) are only created when you run the app for development. If you copy an existing database across, the stores already in it come with it.

## 1. Prepare the MacBook

Do this on the MacBook Pro itself, in Terminal. The commands are for that Mac’s disk.

1. Plug in the power adapter and leave it plugged in. A MacBook on battery will sleep, and the phones will lose the tracker.
2. Leave the lid open. Closing the lid sleeps a MacBook. An external display plus the power adapter is the arrangement that keeps working with the lid closed. Otherwise leave the lid open and let the screen sleep.
3. Stay logged in. The service is tied to your login. The screen can lock. After a restart or a power cut, log in once and the tracker starts again.
4. Turn on **Start up automatically after a power failure** if you see it under Battery or Energy settings. It applies while the power adapter is connected.
5. Stop the Mac sleeping while it is on power. In Terminal:

   ```bash
   sudo pmset -c sleep 0 disksleep 0 displaysleep 10 womp 1 tcpkeepalive 1
   ```

   `displaysleep 10` lets the screen turn off after 10 minutes. `sleep 0` keeps the computer awake. `womp 1` allows wake for network access.

6. Give the Mac a short name the phones can remember. System Settings → General → Sharing → Local hostname. Set it to `cotton-clay`. The tracker is then `http://cotton-clay.local:43123`. You can also run:

   ```bash
   sudo scutil --set LocalHostName cotton-clay
   ```

7. Put the Mac on the same Wi-Fi as the phones. A guest network often blocks devices from seeing each other, so use the main network. Ethernet through a USB-C adapter is steadier if the router is nearby.
8. On the router, reserve the Mac’s address (a DHCP reservation) so the number does not change. The `.local` name still works if the number does change. The dashboard lists the addresses the Mac can see.

FileVault can stay on. Unlock the disk and log in after a restart.

## 2. Install Node.js

The tracker needs **Node.js 22 LTS** or newer (20.9 is the oldest that runs it).

1. Download the macOS installer from [https://nodejs.org](https://nodejs.org) (the LTS package). Homebrew is fine too: `brew install node`.
2. Open a new Terminal window so `node` is on the path.
3. Check:

   ```bash
   node -v
   npm -v
   ```

   You want `v22` or newer.

`better-sqlite3` ships a Mac build. If `npm ci` later says it cannot compile, install the Xcode Command Line Tools (`xcode-select --install`) and run the install again.

## 3. Put the app on the Mac

Clone the project into your home folder, or copy the project folder onto the Mac. Name it `cotton-clay`.

```bash
git clone <the repository URL> "$HOME/cotton-clay"
cd "$HOME/cotton-clay"
```

Use a copy that contains `server/macos/install.sh`. That is the Mac server version of the tracker.

Leave out `node_modules` if you are copying a folder from another computer. The install downloads the Mac versions. Leave the database out of this folder too if you are placing it in the data repository yourself in the next step.

Keep this folder on the Mac’s disk. iCloud Drive, Desktop, or Documents are poor homes for the app if those folders sync: a sync client can lock files while the server is running.

## 4. Move the data

There are two situations.

### You already have real records on another computer

Those records are the `data` folder next to the app: `consignment.db`, and if they exist `consignment.db-wal` and `consignment.db-shm`, plus everything in `data/reports/`.

1. On the old computer, stop the server. In the Terminal window that is running it, press Control-C. Quit `npm run dev` and `npm run start`. Check that the page no longer loads.
2. Copy that `data` folder onto a USB stick, or AirDrop a zip of it. Copy it once, while the server is stopped. A cloud-synced folder can deliver a half-written database, so use the stick or AirDrop for this one copy.
3. On the Mac, create the repository and put the files in it **before** the first start:

   ```bash
   mkdir -p "$HOME/Library/Application Support/CottonAndClay/data/reports"
   ```

   Copy `consignment.db` (and the `-wal` and `-shm` files if you have them) into `data/`. Copy the report files into `data/reports/`.

4. Then run the install in the next section. It sees the database and does not replace it.

### You only have the sample shops, or you have not started the tracker yet

Skip the copy. The install creates an empty repository. Add the real consignee stores on the Mac. The four sample shops are not created.

### If the Mac already created an empty database

Stop the service, move the empty file aside, put the real database in place, and install again:

```bash
bash server/macos/uninstall.sh
cd "$HOME/Library/Application Support/CottonAndClay/data"
mv consignment.db consignment.db.empty
# copy the real consignment.db and reports/ in now
cd "$HOME/cotton-clay"
bash server/macos/install.sh
```

The install refuses to overwrite a database that is already in the repository, which is why the empty file has to be moved aside first.

## 5. Install the server

From the project folder on the Mac:

```bash
cd "$HOME/cotton-clay"
bash server/macos/install.sh
```

The script:

1. Creates the data repository, the backup folder, and the log folder.
2. Copies `data/consignment.db` from the project into the repository only when the repository does not already have one.
3. Installs dependencies and builds the production site.
4. Writes a backup of any database that is already there.
5. Registers two login services:
   - `com.cottonandclay.tracker` serves the site and restarts it if it stops.
   - `com.cottonandclay.backup` copies the repository every day at 2:15am.
6. Opens `http://127.0.0.1:43123/api/health` and waits until it answers.

When it finishes it prints the phone address, the data repository path, and the log path.

The service runs as your user. It listens on every network interface, port **43123**. `CONSIGNMENT_DATA_DIR` points at the repository. `CONSIGNMENT_SEED=0` keeps a brand-new database empty.

Run the script again any time you need to rebuild. It leaves an existing database in place.

## 6. Check it from the Mac, then from a phone

1. On the Mac, open `http://127.0.0.1:43123`.
2. If you copied a database, confirm a store you recognise is there, with the quantities you expect. Open one report file and confirm the photo or PDF loads.
3. If you started empty, add one real store and confirm it is still there after you refresh.
4. On a phone on the same Wi-Fi, open `http://cotton-clay.local:43123`. The dashboard on the Mac also lists the address.
5. If the `.local` name sits there and never loads, use the numeric address from the dashboard, such as `http://192.168.1.20:43123`. Phones sometimes try an IPv6 address for `.local` first.
6. Bookmark that address on each phone.
7. Leave the old computer’s server stopped. Two running copies become two different sets of stock.

The home page should say **This computer is the shared server** and offer the address other devices can open.

## 7. Let the Mac accept connections

The first time a phone connects, macOS may ask to allow incoming connections for `node`. Allow it.

If the phone cannot connect and the Mac can, the firewall may be holding `node`. In Terminal, using the Node path the install printed (`command -v node`):

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$(command -v node)"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "$(command -v node)"
```

Run those two lines again after you upgrade Node, because the program path changes. Then run `bash server/macos/install.sh` again so the service points at the new Node.

## 8. Backups

The database and the report files exist on this Mac. A backup is a second copy of that repository.

- Every day at **2:15am** the Mac writes a dated folder under `~/Library/Application Support/CottonAndClay/backups`. Fourteen copies are kept. The database copy is taken while the server is running, so you do not have to stop it.
- That job runs only if the Mac is awake. If it was asleep at 2:15, make a copy the next time you are at the machine:

  ```bash
  cd "$HOME/cotton-clay"
  npm run backup
  ```

- Each backup folder contains `consignment.db`, `reports/`, and a `README.txt` that says when it was taken.
- Time Machine, if you use it, includes Application Support as well. The dated backup is the consistent copy to keep. Copy the `backups` folder to a USB stick now and then and store the stick away from the Mac.
- The install also writes a backup before it replaces the running app.

### Restore a backup

1. Stop the service: `bash server/macos/uninstall.sh`
2. Replace `consignment.db` and the `reports` folder in `~/Library/Application Support/CottonAndClay/data` with the copies from the backup folder you want.
3. Start again: `bash server/macos/install.sh`
4. Open the site and confirm the stores look like that day’s records.

## 9. Update the app later

From the project folder, when you want a newer version of the tracker:

```bash
cd "$HOME/cotton-clay"
bash server/macos/update.sh
```

That pulls the latest code, backs up the repository, rebuilds, and restarts the service. The data repository path does not change.

If this folder is not a git checkout, copy the new app files in yourself, leave the Application Support folder alone, and run `bash server/macos/install.sh`.

## 10. Day to day

- Leave the Mac plugged in, logged in, and awake (lid open, or lid closed with power and an external display).
- Use the site from phones and shop computers at the address you bookmarked.
- Logs, if a page will not load: `~/Library/Logs/CottonAndClay/tracker.err.log` and `tracker.log`.
- Restart the service without reinstalling:

  ```bash
  launchctl kickstart -k "gui/$(id -u)/com.cottonandclay.tracker"
  ```

- Stop it, and keep the data:

  ```bash
  bash server/macos/uninstall.sh
  ```

- See that it is up: open `http://127.0.0.1:43123/api/health`. A healthy server answers `{"ok":true}`.

## When something is wrong

**The phone cannot open the page.** The Mac is asleep, logged out, on a different Wi-Fi, or the firewall blocked Node. Wake it, log in, and try `http://127.0.0.1:43123` on the Mac itself. If that works, use the numeric address from the dashboard on the phone and check the firewall commands above.

**The page loads and the stores are missing.** The server started before the database was copied, so it created an empty repository. Follow “If the Mac already created an empty database” in section 4. Your copied `consignment.db` is still the one with the records.

**Two different quantities on two devices.** They are talking to two servers. Stop every copy except this Mac. Check the address in the phone’s bookmark.

**After a macOS or Node upgrade the service will not start.** Open a new Terminal, `cd "$HOME/cotton-clay"`, and run `bash server/macos/install.sh`. Read the last lines of `tracker.err.log` if the health check still fails.

**The Mac restarted and the site is down.** Log in. The service starts at login. It does not run on the login window before that.
