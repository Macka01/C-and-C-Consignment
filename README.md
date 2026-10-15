# Cotton & Clay consignment tracker

Internal tracker for Cotton & Clay. It records stock placed with consignee stores, transfers in and out, sales from shop reports, rent and commission invoices, and the photo or PDF of each period’s report.

Everyone uses the same server. Phones and shop computers open one address and see the same stores, quantities, sales, invoices, and files. The browser is not the database — nothing important is kept in localStorage.

There is no login in this version. Anyone who can open the address can view and change the tracker. Use it on a trusted network.

## Run it on this computer

```bash
npm install
npm run dev
```

The dev server listens on all network interfaces at port **43123**.

On this computer, open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## Open it from another device

1. Leave `npm run dev` (or the production server below) running.
2. Find this computer’s address on the local network:

   ```bash
   hostname -I
   ```

   On macOS, use System Settings → Network, or `ipconfig getifaddr en0`. On Tailscale, use the machine name or `tailscale ip -4`.

3. On a phone or another computer on the same network, open `http://<this-computer-ip>:43123`.

   Example: `http://192.168.1.20:43123`.

The machine’s firewall has to allow inbound TCP **43123**. The dashboard also lists the addresses this server can see. On the MacBook server, phones on the tailnet should use the Tailscale HTTPS address instead.

## Production

```bash
npm run build
npm run start
```

`npm run start` also binds to `0.0.0.0` on port **43123**. Other devices use the same `http://<this-computer-ip>:43123` address.

## MacBook Pro as the server

The business runs on one MacBook Pro that already has Docker Desktop and Tailscale. That Mac serves the pages in a Compose container (`cotton-clay-tracker`) and keeps the data repository on its disk. Other Docker stacks stay as they are. Phones reach it on the tailnet (HTTPS via Tailscale Serve) and on the studio Wi-Fi. The steps are in [docs/mac-server.md](docs/mac-server.md).

On the Mac, with Docker Desktop running, from the project folder:

```bash
bash server/macos/install.sh
```

Do not turn on Tailscale Funnel. There is no login on the tracker.

## Where the data lives

- Development: `data/consignment.db` and `data/reports/` inside the project folder (created on first launch)
- Mac server: `~/Library/Application Support/CottonAndClay/data/` when `CONSIGNMENT_DATA_DIR` is set

Those paths are on the computer running the server. Every device reads and writes that one copy. Two people can record a sale or a transfer at the same time; each change is applied to the current quantity, and a transfer out or sale will not take stock below zero.

The first launch of a development database loads sample shops. The Mac server install sets `CONSIGNMENT_SEED=0`, so a new repository starts empty. A database you copy across keeps the records already in it.

Sample stores, products, transfers, sales, one invoice, and one report are loaded the first time the database is created. They are ordinary records — edit or delete them. Deleting everything does not bring the sample back.

## Camera and files

“Take a photo” uses the phone’s camera through the file picker (`capture`), which works over plain `http://` on the local network. A live in-browser camera preview is not used, because browsers block that API unless the site is served over HTTPS.

Uploads accept JPEG, PNG, WEBP, HEIC, and PDF, up to 20 MB. Files stay on this server’s disk. They are not sent to a cloud store.

## Limits

- No user accounts, roles, or audit of who changed a row.
- Data exists only on the machine that runs the app. On the Mac server, back up the data repository with `bash server/macos/backup.sh` (the install also schedules a daily copy).
- “This month” on the dashboard follows the server’s clock.
