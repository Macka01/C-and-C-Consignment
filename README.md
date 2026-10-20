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

The business runs on one MacBook Pro that already has Docker Desktop, Tailscale, and Compose project `homeserver` (`homeserver-caddy-1` on 80/443, `homeserver-hello-1`, `homeserver-postgres-1`). The tracker is a fourth container (`cotton-clay-tracker`) on port 43123 only. Those three stay running; add a hostname on Caddy that proxies to `http://cotton-clay-tracker:43123`. The data repository stays on the Mac disk. The steps are in [docs/mac-server.md](docs/mac-server.md).

On the Mac, with Docker Desktop running, from the project folder:

```bash
bash server/macos/install.sh
```

The Mac server’s data repository is SQLite at `~/Library/Application Support/CottonAndClay/data` (`consignment.db` plus `reports/`). That is **not** `homeserver-postgres-1`. Turn on Funnel only after `CONSIGNMENT_ACCESS_CODE` is set (`server/macos/enable-public.sh`).

To **use** the tracker from Mini / iPad / iPhone away from home: a shared access code plus Tailscale Funnel (`server/macos/enable-public.sh`), then Safari → Add to Home Screen. Until Funnel is on, Tailscale on the device and [http://100.73.158.74:43123](http://100.73.158.74:43123) still works. See [Open the tracker on Mini, iPad, iPhone](docs/mac-server.md#12-open-the-tracker-on-mini-ipad-iphone).

To **manage** Wendys-MBP from the Mac Mini, use ordinary `ssh` to Tailscale name **homeserver** at `100.73.158.74` (Remote Login). The macOS name `Wendys-MBP` will not resolve. The Mac GUI cannot run Tailscale SSH. See [Manage from the Mac Mini](docs/mac-server.md#11-manage-from-the-mac-mini).

## Where the data lives

- Development: `data/consignment.db` and `data/reports/` inside the project folder (created on first launch)
- Mac server: `/Users/stevemcintyre/Library/Application Support/CottonAndClay/data/` (`consignment.db`, `reports/`). Not Postgres.

Those paths are on the computer running the server. Every device reads and writes that one copy. Two people can record a sale or a transfer at the same time; each change is applied to the current quantity, and a transfer out or sale will not take stock below zero.

The first launch of a development database loads sample shops. The Mac server install sets `CONSIGNMENT_SEED=0`, so a new repository starts empty. A database you copy across keeps the records already in it.

Sample stores, products, transfers, sales, one invoice, and one report are loaded the first time the database is created. They are ordinary records — edit or delete them. Deleting everything does not bring the sample back.

## Camera and files

“Take a photo” uses the phone’s camera through the file picker (`capture`), which works over plain `http://` on the local network. A live in-browser camera preview is not used, because browsers block that API unless the site is served over HTTPS.

Uploads accept JPEG, PNG, WEBP, HEIC, and PDF, up to 20 MB. Files stay on this server’s disk. They are not sent to a cloud store.

## Shopify reporting

Quantity, sales, and transfers come from Shopify. This app does not record shelf movements. A store name matches a Shopify location. A product is created if Shopify has it at that location and it is not in the catalog yet (name, price, product type, SKU). The catalog, store stock list, and Consignment Stock Listing group by Shopify product type. If type is empty, a local group is left as it is.

The Admin API token needs `read_inventory`, `read_locations`, `read_products`, `read_orders`, and `read_inventory_transfers`.

Invoices and consignee report files are still entered here. A shop PDF is paperwork only — it does not subtract stock.

```bash
# development
SHOPIFY_SHOP=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_...
```

On the Mac, add the same two lines to `server/macos/host.env`, then:

```bash
cd /Users/stevemcintyre/cotton-clay
bash server/macos/start.sh
```

`start.sh` keeps those two values when it rewrites `host.env`.

## Limits

- No user accounts, roles, or audit of who changed a row.
- Data exists only on the machine that runs the app. On the Mac server, back up the data repository with `bash server/macos/backup.sh` (the install also schedules a daily copy).
- “This month” on the dashboard follows the server’s clock.
- Shopify is the source for on-hand, sales, and transfers. Manual stock movements are disabled.
