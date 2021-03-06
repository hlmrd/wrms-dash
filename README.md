# wrms-dash

![Screenshot](https://github.com/jlabusch/wrms-dash/raw/ecs/example.png)

## Brief

This aggregates information about our Service Level Agreements into real-time dashboards we (and our customers!) can use to evaluate account status and manage service delivery.

## Quick start

Prerequisites: `git` and `docker`.

 - `git clone git@github.com:jlabusch/wrms-dash.git`
 - `cd wrms-dash`
 - `git submodule update --init`
 - Create `./config/default.json`
 - `make build`
 - `make start`
 - Browse to http://localhost to test

## How it works

![Architecture](https://github.com/jlabusch/wrms-dash/raw/ecs/overview.png)

 - `wrms-dash-nginx` serves static files (CSS, JS, images) and proxy-passes dynamic requests to `wrms-dash-frontend`
 - `wrms-dash-frontend` is a Django instance that performs authentication and user management and proxies all API requests to `wrms-dash-api`
 - `wrms-dash-frontend-db` is used by Django for user management and not much else. This container is for testing only; in production this should be a persistent PostgreSQL instance. This component will disappear almost entirely when we replace the user management layer with WRMS user integration.
 - `wrms-dash-api` aggregates various data sources (including `wrms-dash-sync`) into APIs for the front end
 - `wrms-dash-sync` builds an in-memory data model of client information drawn from WRMS and our CRM (or static configuration if not connected to the CRM)

## Initial data load

If you have data to load, e.g. because you dumped the old SQLite version of the DB using `docker exec -it wrms-dash_frontend ./manage.py dumpdata --exclude contenttypes > db.json`, then you can do the following:

 - `make -C wrms-dash-frontend-db build start` # wait for postgres to start
 - `make -C wrms-dash-frontend    build start` # runs initial migrations
 - `docker cp db.json wrms-dash-frontend:/opt/`
 - `docker exec -it wrms-dash-frontend ./manage.py loaddata /opt/db.json`

On the other hand, if you don't have anything to import:

 - Start the frontend and frontend-db containers as above
 - `docker exec -it wrms-dash-frontend ./manage.py createsuperuser`

## Volumes

#### wrms-dash-db-vol

 - Built by `wrms-dash-frontend-db`
 - Contains Postgres data files. Not needed if you're using a real DB instance.

#### Things that are no longer volumes

`wrms-dash-frontend` and `wrms-dash-nginx` share the same static files. To avoid dealing with volumes on ECS we copy the files into both images at build time. Same deal with sharing the node config between `wrms-dash-api` and `wrms-dash-sync`.

## Noteworthy environment variables

 - `DJANGO_DEBUG` (`wrms-dash-frontend`) and `DEBUG` (`wrms-dash-api`, `wrms-dash-sync`)
 - `DJANGO_SECRET` (`wrms-dash-frontend`)
 - `ICINGA_BASIC_AUTH` (`wrms-dash-api`)
 - `CONFIG` (base64 encoded node config used by `wrms-dash-api` and `wrms-dash-sync`, e.g. `export CONFIG=$(base64 < ./config/default.json.example)`)
 -  `DB_PASS` (Postgres password used by `wrms-dash-frontend` and `wrms-dash-frontend-db`. See also `wrms-dash-frontend/dashboard/settings.py` for the rest of the DB configuration.)

## Integrations

The dash relies on a few internal systems:

  - Espo CRM for account and contract details (alternative: you can put these into `$CONFIG`)
  - WRMS for ticket, quote and timesheet information
  - JSON configuration endpoints equivlant to the EU metadata (https://reviews.ci.catalyst-eu.net/#/admin/projects/eumetadata) [Optional]
  - Chkm8 reports for application/plugin patch levels (see https://jenkins-eu.ci.catalyst-eu.net/metadata/updates.json) [Optional]
  - Icinga endpoints for measuring site availability [Optional]
  - Odoo ERP for invoicing reports [Optional]
  - Plugins for reporting user numbers and storage utilisation [Optional, currently exist for Moodle/Mahara/Totara]

### Dev notes

 - Each dashboard's widget's back end code is in `wrms-dash-api/lib/get_XXX.js`. Frontend JS is in `wrms-dash-frontend/static/dash.js`
 - check out https://github.com/keen/keen-dataviz.js/blob/master/docs/README.md#chart-types for front-end options, or just use your favourite charting library. Google charts also play nicely with this dash.

##### User accounts

To change a user's password, run `docker exec -it wrms-dash_frontend ./manage.py changepassword <username>`

Current (pre-WRMS IdP) user model is:

- Each organisation has a group whose name is the WRMS org ID
- Client users belong to their organisation's group and no permissions
- Catalyst users have the "staff status" and "superuser status" options checked and no groups or additional permissions

### WRMS metadata

We use a few conventions within WRMS:

 - By default work is funded from the SLA budget dictated by the contract and stored in the CRM (i.e. the literal WRMS organisation and system IDs are stored in the CRM.)
 - Additional work beyond the scope of the SLA can be marked as such by adding the "Additional" tag to the WR. This work won't be counted in the "hours remaining" widget.
 - WRs with approved quotes will be treated as strictly fixed price, with all timesheet hours ignored
 - WRs tagged with "Warranty" or "Maintenance" won't have their timesheet hours counted regardless of quotes
 - The `invoice_to` field can reclassify individual quotes as belonging to a different time period or budget (SLA vs. Additional service hours.)

Using `invoice_to` quote 1234 can be allocated to the March 2016 SLA budget by saying:

> 1234: 2016-3 SLA

Quote 1234 can instead be allocated to Additional service hours with:

> 1234: 2016-3 Additional

For T&M requests, timesheet adjustments (e.g. writing off new staff training hours) can be added using the "Adjust" keyword... but using adjustments probably means you're doing something wrong, and the exact syntax isn't documented here.

### Thanks

Ashley Mcnamara's Gophers licensed under CC (https://github.com/ashleymcnamara/gophers).

### How to contribute

*Imposter syndrome disclaimer*: I want your help. No really, I do.

There might be a little voice inside that tells you you're not ready; that you need to do one more tutorial, or learn another framework, or write a few more blog posts before you can help me with this project.

I assure you, that's not the case.

If you'd like to throw ideas around before starting any development, happy to do that. If you'd rather start by improving documentation, test coverage or even just giving general feedback, you're very welcome.

Thank you for contributing!
